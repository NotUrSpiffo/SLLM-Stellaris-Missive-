/** Portable SLLM module. No API keys, network calls, game effects, or model catalogue. */
export interface RotationConfig {
  enabled: boolean;
  /** Ordered, explicitly selected model IDs on ONE existing Gemini connection. */
  models: string[];
}
export interface RotationSession { model?: string }
export type QuotaScope = 'model' | 'project' | 'unknown';
export class ModelHttpError extends Error {
  constructor(readonly status: number, readonly quotaScope: QuotaScope = 'unknown',
    readonly retryMs = 0, readonly daily = false) {
    super(`AI_HTTP_${status}`); this.name = 'ModelHttpError';
  }
}
export type StopCode = 'INVALID_CONFIG' | 'QUEUE_FULL' | 'WAIT_REQUIRED' | 'DEADLINE' | 'CANCELLED';
export class RotationStop extends Error {
  constructor(readonly code: StopCode, readonly retryAt?: number) { super(code); this.name = 'RotationStop'; }
}
export interface RotationEvent {
  kind: 'attempt' | 'limited' | 'success'; model: string; attempt: number;
  scope?: QuotaScope; retryAt?: number;
}
export interface RotationOptions {
  signal?: AbortSignal;
  /** Includes time spent waiting behind another request. */
  deadlineMs?: number;
  session?: RotationSession;
  onEvent?: (event: RotationEvent) => void;
}
export interface CooldownSnapshot {
  version: 1;
  entries: Array<{ group: string; model: string | null; until: number }>;
}
const MAX_MODELS = 8, MAX_GROUPS = 64, MAX_QUEUE = 32;
const MAX_COOLDOWN = 7 * 86400000;
const saneModel = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(s);
export function parseRotationConfig(raw: unknown): RotationConfig {
  if (!raw || typeof raw !== 'object') throw new RotationStop('INVALID_CONFIG');
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled !== 'boolean' || !Array.isArray(r.models) || r.models.length > MAX_MODELS || !r.models.every(saneModel)) throw new RotationStop('INVALID_CONFIG');
  const models = [...new Set(r.models as string[])];
  if (r.enabled && !models.length) throw new RotationStop('INVALID_CONFIG');
  return { enabled: r.enabled, models };
}
function stopFor(signal: AbortSignal): Error {
  return signal.reason instanceof RotationStop ? signal.reason : new RotationStop('CANCELLED');
}
/** Observes rejection even if abort wins. A timed-out callback is never retried. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(stopFor(signal));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(v => { signal.removeEventListener('abort', abort); resolve(v); }, e => { signal.removeEventListener('abort', abort); reject(e); });
    if (signal.aborted) abort();
  });
}
type Group = { blocked: number; models: Map<string, number>; tail: Promise<void>; queued: number };
export class ModelRotation {
  private groups = new Map<string, Group>();
  private group(key: string): Group {
    // Opaque local project-group identifier, NEVER an API key or prompt.
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new RotationStop('INVALID_CONFIG');
    let g = this.groups.get(key);
    if (!g) {
      if (this.groups.size >= MAX_GROUPS) {
        const idle = [...this.groups].find(([,x]) => !x.queued && x.blocked <= Date.now() && [...x.models.values()].every(t => t <= Date.now()));
        if (!idle) throw new RotationStop('QUEUE_FULL');
        this.groups.delete(idle[0]);
      }
      g = { blocked: 0, models: new Map(), tail: Promise.resolve(), queued: 0 }; this.groups.set(key, g);
    }
    return g;
  }
  /** Caller supplies the CURRENT connection, messages and options through send.
   * send must honour signal and perform only ONE HTTP generation request.
   * Provider/endpoint/key never change here. No game actions inside send.
   */
  async run<T>(groupKey: string, config: RotationConfig, primary: string,
    send: (model: string, signal: AbortSignal) => Promise<T>, options: RotationOptions = {}): Promise<{ value: T; model: string; attempts: number }> {
    const cfg = parseRotationConfig(config);
    if (!saneModel(primary)) throw new RotationStop('INVALID_CONFIG');
    if (cfg.enabled && !cfg.models.includes(primary)) throw new RotationStop('INVALID_CONFIG');
    const candidates = cfg.enabled ? cfg.models.slice() : [primary];
    if (options.session?.model && candidates.includes(options.session.model)) {
      candidates.splice(candidates.indexOf(options.session.model), 1); candidates.unshift(options.session.model);
    }
    const g = this.group(groupKey);
    if (g.queued >= MAX_QUEUE) throw new RotationStop('QUEUE_FULL');
    const requestedDeadline = options.deadlineMs ?? 90000;
    if (!Number.isFinite(requestedDeadline) || requestedDeadline <= 0) throw new RotationStop('INVALID_CONFIG');
    const control = new AbortController();
    const cancel = () => control.abort(new RotationStop('CANCELLED'));
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timer = setTimeout(() => control.abort(new RotationStop('DEADLINE')), Math.min(requestedDeadline, 180000));
    const previous = g.tail;
    let release!: () => void;
    const turn = new Promise<void>(resolve => { release = resolve; });
    g.tail = previous.then(() => turn); g.queued++;
    const emit = (e: RotationEvent) => { try { options.onEvent?.(e); } catch { /* Diagnostics cannot change request outcome. */ } };
    try {
      await abortable(previous, control.signal);
      if (control.signal.aborted) throw stopFor(control.signal);
      if (g.blocked > Date.now()) throw new RotationStop('WAIT_REQUIRED', g.blocked);
      let attempts = 0;
      for (const model of candidates) {
        if (control.signal.aborted) throw stopFor(control.signal);
        if ((g.models.get(model) ?? 0) > Date.now()) continue;
        attempts++;
        emit({ kind: 'attempt', model, attempt: attempts });
        try {
          const value = await abortable(Promise.resolve().then(() => {
            if (control.signal.aborted) throw stopFor(control.signal);
            return send(model, control.signal);
          }), control.signal);
          if (control.signal.aborted) throw stopFor(control.signal);
          if (options.session) options.session.model = model;
          g.models.delete(model);
          emit({ kind: 'success', model, attempt: attempts });
          return { value, model, attempts };
        } catch (error) {
          if (control.signal.aborted) throw stopFor(control.signal);
          // No rotation for auth, malformed request, network/timeout, invalid JSON,
          // filtered output, truncation or ambiguous server errors.
          if (!(error instanceof ModelHttpError) || error.status !== 429) throw error;
          const fallback = error.daily ? 86400000 : 60000;
          const retry = Number.isFinite(error.retryMs) && error.retryMs > 0 ? error.retryMs : fallback;
          const until = Date.now() + Math.min(MAX_COOLDOWN, Math.max(1000, retry));
          emit({ kind: 'limited', model, attempt: attempts, scope: error.quotaScope, retryAt: until });
          if (error.quotaScope !== 'model') {
            g.blocked = Math.max(g.blocked, until);
            throw new RotationStop('WAIT_REQUIRED', g.blocked);
          }
          // Bound state if users repeatedly change their candidate lists.
          for (const [id,t] of g.models) if (t <= Date.now()) g.models.delete(id);
          if (g.models.size >= 128 && !g.models.has(model)) {
            g.blocked = Math.max(until, ...g.models.values());
            throw new RotationStop('WAIT_REQUIRED', g.blocked);
          }
          g.models.set(model, Math.max(g.models.get(model) ?? 0, until));
        }
      }
      throw new RotationStop('WAIT_REQUIRED', Math.min(...candidates.map(m => g.models.get(m) ?? Date.now())));
    } finally {
      clearTimeout(timer); options.signal?.removeEventListener('abort', cancel);
      release(); g.queued--;
    }
  }
  /** UI/persistence: identifiers and timestamps only. Save per-user, never in logs ZIP by default. */
  snapshot(now = Date.now()): CooldownSnapshot {
    const entries: CooldownSnapshot['entries'] = [];
    for (const [group,g] of this.groups) {
      if (g.blocked > now) entries.push({ group, model: null, until: g.blocked });
      for (const [model,until] of g.models) if (until > now) entries.push({ group, model, until });
    }
    return { version: 1, entries };
  }
  /** Call once at startup, before requests; untrusted persisted values are bounded. */
  restore(raw: unknown, now = Date.now()): void {
    if ([...this.groups.values()].some(g => g.queued)) throw new RotationStop('INVALID_CONFIG');
    const r = raw as Partial<CooldownSnapshot> | null;
    if (!r || r.version !== 1 || !Array.isArray(r.entries)) return;
    for (const e of r.entries.slice(0, 512)) {
      if (!e || typeof e.group !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(e.group) || (e.model !== null && !saneModel(e.model)) || !Number.isFinite(e.until) || e.until <= now) continue;
      if (!this.groups.has(e.group) && this.groups.size >= MAX_GROUPS) break;
      const g = this.group(e.group), until = Math.min(e.until, now + MAX_COOLDOWN);
      if (e.model === null) g.blocked = Math.max(g.blocked, until);
      else if (g.models.size < 128 || g.models.has(e.model)) g.models.set(e.model, Math.max(g.models.get(e.model) ?? 0, until));
    }
  }
}

/** Convert structured Google quota details to a redacted typed error.
 * Unknown scope blocks this group conservatively; never infer scope from prose.
 * rawBody is inspected in memory only and is never retained in the error.
 */
export function googleHttpError(status: number, rawBody: string, retryAfter: string | null, now = Date.now()): ModelHttpError {
  let retryMs = 0;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    retryMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(retryAfter) - now);
    if (!Number.isFinite(retryMs)) retryMs = 0;
  }
  let scope: QuotaScope = 'unknown', daily = false;
  if (status === 429 && rawBody.length <= 262144) {
    try {
      const data = JSON.parse(rawBody);
      const details = Array.isArray(data?.error?.details) ? data.error.details : [];
      const violations: unknown[] = [];
      for (const d of details) {
        if (d?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && typeof d.retryDelay === 'string') {
          const match = /^(\d+(?:\.\d+)?)s$/.exec(d.retryDelay);
          if (match) retryMs = Math.max(retryMs, Number(match[1]) * 1000);
        }
        if (d?.['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' && Array.isArray(d.violations)) violations.push(...d.violations);
      }
      const scopes = violations.map(v => {
        const x = v as { quotaId?: unknown; quotaDimensions?: { model?: unknown } } | null;
        const id = typeof x?.quotaId === 'string' ? x.quotaId : '';
        if (/PerDay/i.test(id)) daily = true;
        if (/PerModel/i.test(id) || typeof x?.quotaDimensions?.model === 'string') return 'model';
        if (/PerProject/i.test(id)) return 'project';
        return 'unknown';
      });
      if (scopes.includes('project')) scope = 'project';
      else if (scopes.length && scopes.every(s => s === 'model')) scope = 'model';
    } catch { /* Unknown error format: no model hopping. */ }
  }
  // Without an authoritative reset timestamp, daily quotas wait a conservative 24h.
  if (daily) retryMs = Math.max(retryMs, 86400000);
  return new ModelHttpError(status, scope, Math.min(MAX_COOLDOWN, retryMs), daily);
}

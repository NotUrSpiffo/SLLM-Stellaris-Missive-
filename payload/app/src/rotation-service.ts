import { ModelRotation, parseRotationConfig, RotationStop,
  type RotationConfig, type RotationOptions, type RotationSession } from './model-rotation';

/** Connect to the host's existing per-user storage. Never store credentials here. */
export interface RotationStorage {
  read(): Promise<unknown>;
  /** Must atomically replace the stored document, or reject. */
  write(value: unknown): Promise<void>;
}
interface Setting { revision: number; config: RotationConfig }
export interface SettingView extends Setting { connectionId: string }
/** Last model that actually answered on a connection, for the settings display. Memory only; never prompts or keys. */
export interface RotationUse { model: string; primary: string; at: number; switched: boolean; conversation: boolean }
export interface RotationUsageView { last: RotationUse | null; conversations: Array<{ model: string; count: number }> }
export class SettingsConflict extends Error {
  constructor() { super('SETTINGS_CONFLICT'); }
}
const validId = (x: unknown): x is string => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
const copy = (s: Setting): Setting => ({ revision: s.revision, config: { enabled: s.config.enabled, models: [...s.config.models] } });

/** One instance in main process. Settings are loaded before any public operation.
 * Queue ownership, cancellation and HTTP behavior remain in ModelRotation.
 * Host owns IPC authorization, credentials, language and game effects.
 */
export class RotationService {
  private readonly rotation = new ModelRotation();
  private readonly settings = new Map<string, Setting>();
  private readonly sessions = new Map<string, { value: RotationSession; active: number; touched: number }>();
  private tail: Promise<unknown> = Promise.resolve();
  private readonly lastUse = new Map<string, RotationUse>();
  /** Host hook: called after each answered request (e.g. to tell the player the active model changed). Errors are ignored. */
  onUse?: (connectionId: string, use: RotationUse, previous: RotationUse | undefined) => void;
  private readonly ready: Promise<void>;
  constructor(private readonly storage: RotationStorage,
    private readonly diagnostic: (code: string) => void = () => {}) {
    this.ready = this.load();
  }
  private report(code: string): void { try { this.diagnostic(code); } catch {} }
  private async load(): Promise<void> {
    // Read errors propagate: do not silently overwrite inaccessible existing settings.
    const raw = await this.storage.read();
    if (raw == null) return;
    const data = raw as { version?: unknown; settings?: unknown; cooldown?: unknown };
    if (data.version !== 1 || !Array.isArray(data.settings)) throw new RotationStop('INVALID_CONFIG');
    if (data.settings.length > 128) throw new RotationStop('INVALID_CONFIG');
    for (const entry of data.settings) {
      if (!entry || !validId(entry.connectionId) || !Number.isSafeInteger(entry.revision) || entry.revision < 0 || this.settings.has(entry.connectionId)) throw new RotationStop('INVALID_CONFIG');
      this.settings.set(entry.connectionId, { revision: entry.revision, config: parseRotationConfig(entry.config) });
    }
    this.rotation.restore(data.cooldown);
  }
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const work = this.tail.then(fn);
    this.tail = work.catch(() => {});
    return work;
  }
  private document(settings = this.settings): unknown {
    return { version: 1, settings: [...settings].map(([connectionId, value]) => ({ connectionId, ...copy(value) })), cooldown: this.rotation.snapshot() };
  }
  async get(connectionId: string): Promise<SettingView> {
    await this.ready;
    if (!validId(connectionId)) throw new RotationStop('INVALID_CONFIG');
    return { connectionId, ...copy(this.settings.get(connectionId) ?? { revision: 0, config: { enabled: false, models: [] } }) };
  }
  /** main process must obtain primaryModel from its actual connection, not renderer. */
  async save(connectionId: string, expectedRevision: number, raw: unknown, primaryModel: string): Promise<SettingView> {
    await this.ready;
    const config = parseRotationConfig(raw);
    if (!validId(connectionId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || (config.enabled && !config.models.includes(primaryModel))) throw new RotationStop('INVALID_CONFIG');
    return this.serialize(async () => {
      const current = this.settings.get(connectionId);
      if ((current?.revision ?? 0) !== expectedRevision) throw new SettingsConflict();
      if ((!current && this.settings.size >= 128) || expectedRevision >= Number.MAX_SAFE_INTEGER) throw new RotationStop('INVALID_CONFIG');
      const next = { revision: expectedRevision + 1, config };
      const staged = new Map(this.settings); staged.set(connectionId, next);
      await this.storage.write(this.document(staged));
      this.settings.set(connectionId, next);
      return { connectionId, ...copy(next) };
    });
  }
  /** Use a save-specific conversation ID. Optional omission means no model affinity.
   * Default quota group deliberately shares limits between all Gemini connections.
   * Use a distinct group only when the host knows it is a different Google project.
   */
  async run<T>(connectionId: string, primaryModel: string,
    sendOne: (model: string, signal: AbortSignal) => Promise<T>,
    options: Omit<RotationOptions, 'session'> & { conversationId?: string; quotaGroup?: string } = {}) {
    const setting = await this.get(connectionId);
    const group = options.quotaGroup ?? 'gemini_default';
    if (!validId(group) || (options.conversationId !== undefined && !validId(options.conversationId))) throw new RotationStop('INVALID_CONFIG');
    const key = options.conversationId ? `${connectionId}:${setting.revision}:${group}:${options.conversationId}` : undefined;
    let session = key ? this.sessions.get(key) : undefined;
    if (key && !session) {
      if (this.sessions.size >= 256) {
        const oldest = [...this.sessions].filter(([,s]) => !s.active).sort((a,b) => a[1].touched - b[1].touched)[0];
        if (!oldest) throw new RotationStop('QUEUE_FULL');
        this.sessions.delete(oldest[0]);
      }
      session = { value: {}, active: 0, touched: Date.now() }; this.sessions.set(key, session);
    }
    if (session) session.active++;
    try {
      const result = await this.rotation.run(group, setting.config, primaryModel, sendOne, { ...options, session: session?.value });
      const use: RotationUse = { model: result.model, primary: primaryModel, at: Date.now(), switched: result.model !== primaryModel, conversation: !!session };
      const previous = this.lastUse.get(connectionId); this.lastUse.set(connectionId, use);
      try { this.onUse?.(connectionId, use, previous); } catch { /* Display hooks never change the reply. */ }
      return result;
    } finally {
      if (session) { session.active--; session.touched = Date.now(); }
      // Serialized saves prevent an older cooldown snapshot overwriting a settings save.
      try { await this.serialize(() => this.storage.write(this.document())); }
      catch { this.report('ROTATION_STATE_SAVE_FAILED'); }
    }
  }
  async status() { await this.ready; return this.rotation.snapshot(); }
  /** Current model per connection, and how many live conversations are pinned to each model (no conversation ids or text). */
  async usage(connectionId: string): Promise<RotationUsageView> {
    await this.ready;
    if (!validId(connectionId)) throw new RotationStop('INVALID_CONFIG');
    const counts = new Map<string, number>();
    for (const [key, s] of this.sessions) if (key.startsWith(connectionId + ':') && s.value.model) counts.set(s.value.model, (counts.get(s.value.model) ?? 0) + 1);
    const last = this.lastUse.get(connectionId);
    return { last: last ? { ...last } : null, conversations: [...counts].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count) };
  }
}

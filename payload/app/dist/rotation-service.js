"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RotationService = exports.SettingsConflict = void 0;
const model_rotation_1 = require("./model-rotation");
class SettingsConflict extends Error {
    constructor() { super('SETTINGS_CONFLICT'); }
}
exports.SettingsConflict = SettingsConflict;
const validId = (x) => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
const copy = (s) => ({ revision: s.revision, config: { enabled: s.config.enabled, models: [...s.config.models] } });
/** One instance in main process. Settings are loaded before any public operation.
 * Queue ownership, cancellation and HTTP behavior remain in ModelRotation.
 * Host owns IPC authorization, credentials, language and game effects.
 */
class RotationService {
    storage;
    diagnostic;
    rotation = new model_rotation_1.ModelRotation();
    settings = new Map();
    sessions = new Map();
    tail = Promise.resolve();
    lastUse = new Map();
    /** Host hook: called after each answered request (e.g. to tell the player the active model changed). Errors are ignored. */
    onUse;
    ready;
    constructor(storage, diagnostic = () => { }) {
        this.storage = storage;
        this.diagnostic = diagnostic;
        this.ready = this.load();
    }
    report(code) { try {
        this.diagnostic(code);
    }
    catch { } }
    async load() {
        // Read errors propagate: do not silently overwrite inaccessible existing settings.
        const raw = await this.storage.read();
        if (raw == null)
            return;
        const data = raw;
        if (data.version !== 1 || !Array.isArray(data.settings))
            throw new model_rotation_1.RotationStop('INVALID_CONFIG');
        if (data.settings.length > 128)
            throw new model_rotation_1.RotationStop('INVALID_CONFIG');
        for (const entry of data.settings) {
            if (!entry || !validId(entry.connectionId) || !Number.isSafeInteger(entry.revision) || entry.revision < 0 || this.settings.has(entry.connectionId))
                throw new model_rotation_1.RotationStop('INVALID_CONFIG');
            this.settings.set(entry.connectionId, { revision: entry.revision, config: (0, model_rotation_1.parseRotationConfig)(entry.config) });
        }
        this.rotation.restore(data.cooldown);
    }
    serialize(fn) {
        const work = this.tail.then(fn);
        this.tail = work.catch(() => { });
        return work;
    }
    document(settings = this.settings) {
        return { version: 1, settings: [...settings].map(([connectionId, value]) => ({ connectionId, ...copy(value) })), cooldown: this.rotation.snapshot() };
    }
    async get(connectionId) {
        await this.ready;
        if (!validId(connectionId))
            throw new model_rotation_1.RotationStop('INVALID_CONFIG');
        return { connectionId, ...copy(this.settings.get(connectionId) ?? { revision: 0, config: { enabled: false, models: [] } }) };
    }
    /** main process must obtain primaryModel from its actual connection, not renderer. */
    async save(connectionId, expectedRevision, raw, primaryModel) {
        await this.ready;
        const config = (0, model_rotation_1.parseRotationConfig)(raw);
        if (!validId(connectionId) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || (config.enabled && !config.models.includes(primaryModel)))
            throw new model_rotation_1.RotationStop('INVALID_CONFIG');
        return this.serialize(async () => {
            const current = this.settings.get(connectionId);
            if ((current?.revision ?? 0) !== expectedRevision)
                throw new SettingsConflict();
            if ((!current && this.settings.size >= 128) || expectedRevision >= Number.MAX_SAFE_INTEGER)
                throw new model_rotation_1.RotationStop('INVALID_CONFIG');
            const next = { revision: expectedRevision + 1, config };
            const staged = new Map(this.settings);
            staged.set(connectionId, next);
            await this.storage.write(this.document(staged));
            this.settings.set(connectionId, next);
            return { connectionId, ...copy(next) };
        });
    }
    /** Use a save-specific conversation ID. Optional omission means no model affinity.
     * Default quota group deliberately shares limits between all Gemini connections.
     * Use a distinct group only when the host knows it is a different Google project.
     */
    async run(connectionId, primaryModel, sendOne, options = {}) {
        const setting = await this.get(connectionId);
        const group = options.quotaGroup ?? 'gemini_default';
        if (!validId(group) || (options.conversationId !== undefined && !validId(options.conversationId)))
            throw new model_rotation_1.RotationStop('INVALID_CONFIG');
        const key = options.conversationId ? `${connectionId}:${setting.revision}:${group}:${options.conversationId}` : undefined;
        let session = key ? this.sessions.get(key) : undefined;
        if (key && !session) {
            if (this.sessions.size >= 256) {
                const oldest = [...this.sessions].filter(([, s]) => !s.active).sort((a, b) => a[1].touched - b[1].touched)[0];
                if (!oldest)
                    throw new model_rotation_1.RotationStop('QUEUE_FULL');
                this.sessions.delete(oldest[0]);
            }
            session = { value: {}, active: 0, touched: Date.now() };
            this.sessions.set(key, session);
        }
        if (session)
            session.active++;
        try {
            const result = await this.rotation.run(group, setting.config, primaryModel, sendOne, { ...options, session: session?.value });
            const use = { model: result.model, primary: primaryModel, at: Date.now(), switched: result.model !== primaryModel, conversation: !!session };
            const previous = this.lastUse.get(connectionId);
            this.lastUse.set(connectionId, use);
            try {
                this.onUse?.(connectionId, use, previous);
            }
            catch { /* Display hooks never change the reply. */ }
            return result;
        }
        finally {
            if (session) {
                session.active--;
                session.touched = Date.now();
            }
            // Serialized saves prevent an older cooldown snapshot overwriting a settings save.
            try {
                await this.serialize(() => this.storage.write(this.document()));
            }
            catch {
                this.report('ROTATION_STATE_SAVE_FAILED');
            }
        }
    }
    async status() { await this.ready; return this.rotation.snapshot(); }
    /** Current model per connection, and how many live conversations are pinned to each model (no conversation ids or text). */
    async usage(connectionId) {
        await this.ready;
        if (!validId(connectionId))
            throw new model_rotation_1.RotationStop('INVALID_CONFIG');
        const counts = new Map();
        for (const [key, s] of this.sessions)
            if (key.startsWith(connectionId + ':') && s.value.model)
                counts.set(s.value.model, (counts.get(s.value.model) ?? 0) + 1);
        const last = this.lastUse.get(connectionId);
        return { last: last ? { ...last } : null, conversations: [...counts].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count) };
    }
}
exports.RotationService = RotationService;
//# sourceMappingURL=rotation-service.js.map
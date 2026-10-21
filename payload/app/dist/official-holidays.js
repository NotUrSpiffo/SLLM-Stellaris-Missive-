"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidayStore = void 0;
exports.holidayCommand = holidayCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const national_events_1 = require("./national-events");
class HolidayStore {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    file(sid) { if (!/^\d+$/.test(sid))
        throw Error('HOLIDAY_SESSION'); return path.join(this.dir, (0, crypto_1.createHash)('sha256').update(sid).digest('hex') + '.json'); }
    read(sid) { try {
        const s = JSON.parse(fs.readFileSync(this.file(sid), 'utf8'));
        if (s?.version !== 1 || s.sid !== sid || !Number.isSafeInteger(s.revision) || !Array.isArray(s.items) || !Array.isArray(s.history))
            throw Error('HOLIDAY_STORE');
        return s;
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return { version: 1, sid, revision: 0, autoSpend: false, items: [], history: [] };
        throw e;
    } }
    commit(s) { fs.mkdirSync(this.dir, { recursive: true }); const file = this.file(s.sid), lock = file + '.lock', tmp = file + '.' + (0, crypto_1.randomUUID)() + '.tmp'; let fd; try {
        fd = fs.openSync(lock, 'wx');
    }
    catch {
        throw Error('HOLIDAY_BUSY');
    } try {
        if (this.read(s.sid).revision !== s.revision)
            throw Error('HOLIDAY_CONFLICT');
        s.revision++;
        fs.writeFileSync(tmp, JSON.stringify(s));
        fs.renameSync(tmp, file);
        return s;
    }
    finally {
        if (fs.existsSync(tmp))
            fs.unlinkSync(tmp);
        fs.closeSync(fd);
        fs.unlinkSync(lock);
    } }
    change(sid, revision, date, action, input) {
        const d = (0, national_events_1.nationalDate)(date);
        if (!d)
            throw Error('HOLIDAY_SESSION');
        const s = this.read(sid);
        if (s.revision !== revision)
            throw Error('HOLIDAY_CONFLICT');
        let id = input?.id;
        if (action === 'auto') {
            if (typeof input !== 'boolean')
                throw Error('HOLIDAY_INPUT');
            s.autoSpend = input;
        }
        else if (action === 'delete') {
            if (!s.items.some(h => h.id === id))
                throw Error('HOLIDAY_INPUT');
            s.items = s.items.filter(h => h.id !== id);
        }
        else if (action === 'save') {
            if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120 || typeof input.text !== 'string' || input.text.length > 5000 || !Number.isInteger(input.month) || input.month < 1 || input.month > 12 || !['festival', 'mourning', 'annual'].includes(input.art) || typeof input.enabled !== 'boolean')
                throw Error('HOLIDAY_INPUT');
            const prior = id ? s.items.find(h => h.id === id) : undefined;
            if (id && !prior)
                throw Error('HOLIDAY_INPUT');
            if (s.items.some(h => h.id !== id && h.month === input.month))
                throw Error('HOLIDAY_MONTH');
            const firstYear = prior && prior.month === input.month ? prior.firstYear : d.year + (input.month <= d.month ? 1 : 0);
            const h = { id: prior?.id || (0, crypto_1.randomUUID)(), name: input.name.trim(), month: input.month, text: input.text, art: input.art, enabled: input.enabled, firstYear, created: prior?.created || date };
            id = h.id;
            if (prior)
                s.items[s.items.indexOf(prior)] = h;
            else
                s.items.push(h);
        }
        else
            throw Error('HOLIDAY_INPUT');
        s.history.push({ date, action, id });
        return this.commit(s);
    }
    record(sid, date, id, year, status) { const s = this.read(sid); s.history.push({ date, action: 'preparation', id, year, status }); return this.commit(s); }
}
exports.HolidayStore = HolidayStore;
// Flags are month/year scoped, preventing abolition and recreation from charging the same month twice.
// The save's flags, never the app history, are authoritative for payment and cancellation.
function holidayCommand(req, sid, idx, year, month, mode) {
    if (![req, idx, year, month].every(Number.isSafeInteger) || req < 1 || idx < 0 || year < 1 || month < 1 || month > 12 || !/^\d+$/.test(sid) || !['prepare', 'query', 'cancel'].includes(mode))
        throw Error('HOLIDAY_INPUT');
    const key = `sllm_holiday_${year}_${month}`, log = (status) => `log = "SLLM:HOLIDAYPAY/;/req=${req}/;/sid=[This.sllm_save_id]/;/year=${year}/;/month=${month}/;/status=${status}"`;
    const next = month === 12 ? `${year + 1}.1.1` : `${year}.${month + 1}.1`;
    const pay = `if = { limit = { has_resource = { type = energy amount >= 150 } has_resource = { type = minerals amount >= 100 } has_resource = { type = food amount >= 300 } } add_resource = { energy = -150 minerals = -100 food = -300 } set_country_flag = ${key}_paid ${log('paid')} } else = { set_country_flag = ${key}_short ${log('short')} }`;
    const status = `if = { limit = { has_country_flag = ${key}_cancel } ${log('cancelled')} } else_if = { limit = { has_country_flag = ${key}_paid } ${log('paid')} } else_if = { limit = { has_country_flag = ${key}_short } ${log('short')} } else = { ${mode === 'prepare' ? pay : log('unprepared')} }`;
    return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_idx value = ${idx} } check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { current_date >= ${year}.${month}.1 current_date < ${next} } ${mode === 'cancel' ? `set_country_flag = ${key}_cancel ${log('cancelled')}` : status} } else = { ${log('stale')} } }`;
}
//# sourceMappingURL=official-holidays.js.map
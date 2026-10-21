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
exports.registerOfficialHolidays = registerOfficialHolidays;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const official_holidays_1 = require("../official-holidays");
const national_events_1 = require("../national-events");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const office_app_1 = require("./office-app");
const gamestate_app_1 = require("./gamestate-app");
const terminal_1 = require("./terminal");
const settings_ui_1 = require("./settings-ui");
let storage;
const store = () => storage ??= new official_holidays_1.HolidayStore(path.join(electron_1.app.getPath('userData'), 'official-holidays'));
const session = () => `${ctx_1.ctx.curSaveId}:${game_link_1.link.epoch}`;
const busy = new Set(), results = new Map();
let observed = '', autoBlocked = '';
function context() { const d = (0, national_events_1.nationalDate)(ctx_1.ctx.gameDate); if (!game_link_1.link.sessionReady || !/^\d+$/.test(ctx_1.ctx.curSaveId) || !d)
    throw Error('HOLIDAY_SESSION'); return { ...d, sid: ctx_1.ctx.curSaveId, token: session() }; }
function authorize(e, token) { if (!office_app_1.office.win || office_app_1.office.win.isDestroyed() || e.sender !== office_app_1.office.win.webContents || e.senderFrame !== e.sender.mainFrame)
    throw Error('HOLIDAY_SESSION'); const c = context(); if (token !== undefined && token !== c.token)
    throw Error('HOLIDAY_SESSION'); return c; }
function error(e) { const code = e.message; const map = { HOLIDAY_SESSION: (0, settings_ui_1.pick)('세이브를 확인하고 달력을 다시 열어 주세요.', 'Check the save and reopen the calendar.'), HOLIDAY_INPUT: (0, settings_ui_1.pick)('기념일 이름·월·내용을 확인해 주세요.', 'Check the holiday name, month and text.'), HOLIDAY_MONTH: (0, settings_ui_1.pick)('그 달에는 이미 기념일이 있습니다. 중지하거나 올해 취소해도 월은 유지됩니다.', 'That month already has a holiday. Pausing or cancelling this year does not free the month.'), HOLIDAY_CONFLICT: (0, settings_ui_1.pick)('기념일이 변경되었습니다. 다시 열어 주세요.', 'Holidays changed. Reopen the calendar.'), HOLIDAY_STORE: (0, settings_ui_1.pick)('기념일 기록을 읽지 못했습니다. 원본을 보존합니다.', 'Could not read holiday records. The original is preserved.'), HOLIDAY_BUSY: (0, settings_ui_1.pick)('처리 중입니다. 잠시 후 다시 확인해 주세요.', 'An operation is in progress. Check again shortly.'), HOLIDAY_DUE: (0, settings_ui_1.pick)('활성 기념일의 행사 월에만 준비할 수 있습니다.', 'Preparation is available only during an active holiday’s eligible month.') }; return map[code] || code; }
function view() { const c = context(), s = store().read(c.sid); return { ...s, session: c.token, date: ctx_1.ctx.gameDate, year: c.year, month: c.month, statuses: Object.fromEntries(s.items.map(h => [h.id, results.get(`${c.token}:${c.year}:${h.month}`) || 'unknown'])) }; }
async function processHoliday(id, mode) {
    const c = context(), h = store().read(c.sid).items.find(h => h.id === id);
    if (!h || h.month !== c.month || h.firstYear > c.year || (mode === 'prepare' && !h.enabled))
        throw Error('HOLIDAY_DUE');
    const key = `${c.token}:${c.year}:${c.month}`;
    if (busy.has(key))
        throw Error('HOLIDAY_BUSY');
    busy.add(key);
    try {
        const req = ++game_link_1.link.reqCounter;
        results.set(key, 'pending');
        const r = await (0, terminal_1.terminalRequest)((0, official_holidays_1.holidayCommand)(req, c.sid, ctx_1.ctx.playerIdx, c.year, c.month, mode), 'HOLIDAYPAY', req);
        if (session() !== c.token || ctx_1.ctx.gameDate.split('.').slice(0, 2).map(Number).join('.') !== `${c.year}.${c.month}` || r.kv.sid !== c.sid || Number(r.kv.year) !== c.year || Number(r.kv.month) !== c.month)
            throw Error('HOLIDAY_SESSION');
        if (!['paid', 'short', 'cancelled', 'unprepared', 'stale'].includes(r.kv.status))
            throw Error('HOLIDAY_SESSION');
        results.set(key, r.kv.status);
        store().record(c.sid, ctx_1.ctx.gameDate, h.id, c.year, r.kv.status);
        return view();
    }
    catch (e) {
        if (session() === c.token)
            results.set(key, 'pending');
        throw e;
    }
    finally {
        busy.delete(key);
    }
}
function registerOfficialHolidays(router) {
    router.on(log_router_1.SLOT.OFFICIAL_HOLIDAYS, 'national:holidays', m => { if (m.kind === 'HOLIDAYPAY')
        terminal_1.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); });
    electron_1.ipcMain.handle('holidayState', e => { try {
        authorize(e);
        return { ok: true, state: view() };
    }
    catch (e) {
        return { ok: false, error: error(e) };
    } });
    electron_1.ipcMain.handle('holidayChange', (e, token, revision, action, input) => { try {
        const c = authorize(e, token);
        if (busy.has(`${c.token}:${c.year}:${c.month}`))
            throw Error('HOLIDAY_BUSY');
        store().change(c.sid, revision, ctx_1.ctx.gameDate, action, input);
        autoBlocked = `${c.token}:${c.year}:${c.month}`;
        return { ok: true, state: view() };
    }
    catch (e) {
        return { ok: false, error: error(e) };
    } });
    electron_1.ipcMain.handle('holidayPrepare', async (e, token, id, mode) => { try {
        authorize(e, token);
        if (!['prepare', 'query', 'cancel'].includes(mode))
            throw Error('HOLIDAY_INPUT');
        return { ok: true, state: await processHoliday(id, mode) };
    }
    catch (e) {
        return { ok: false, error: error(e) };
    } });
    (0, gamestate_app_1.onGameSnapshot)(snapshot => { try {
        if (snapshot.sid !== ctx_1.ctx.curSaveId)
            return;
        const c = context(), key = `${c.token}:${c.year}:${c.month}`;
        if (key === observed)
            return;
        const previous = observed;
        observed = key;
        results.clear();
        if (!previous || !previous.startsWith(c.token + ':') || key === autoBlocked)
            return;
        const priorDate = previous.split(':').slice(-2).map(Number);
        if (c.year * 12 + c.month <= priorDate[0] * 12 + priorDate[1])
            return;
        const s = store().read(c.sid);
        if (!s.autoSpend)
            return;
        const h = s.items.find(h => h.enabled && h.month === c.month && h.firstYear <= c.year);
        if (h)
            void processHoliday(h.id, 'prepare').catch(() => { });
    }
    catch { /* Keep game observations running when holiday storage is unavailable. */ } });
}
//# sourceMappingURL=official-holidays-app.js.map
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
exports.govReport = void 0;
exports.onNewYear = onNewYear;
exports.offer = offer;
exports.openGovReport = openGovReport;
exports.registerGovReport = registerGovReport;
exports.demoGovReport = demoGovReport;
// A-26 총독 홀로그램 보고(앱 쪽): 새해(YEAR)마다 행성 목록을 읽어 문제가 큰 행성의 총독이 통신을 요청한다.
// 알림의 "통신 받기" → 통치자 집무실 컨셉의 별도 홀로그램 창(ui/govreport.html). 총독 기억은 총독 대화와 같은 저장소를 쓴다.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const planets_1 = require("../planets");
const govreport_1 = require("../govreport");
const govmemory_1 = require("../govmemory");
const speciesClass_1 = require("../speciesClass");
const protocol_1 = require("../protocol");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const gov_1 = require("./gov");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)
exports.govReport = { win: null, cur: null, busy: false };
const asked = new Map(); // sid → 이미 요청한 해(같은 해에 두 번 오지 않게)
const startedAt = Date.now();
/** 행성 목록을 게임에 요청하고 PLANETS_END 를 기다린다(총독 창과 같은 대기열). */
async function readPlanets() {
    const sid = ctx_1.ctx.curSaveId;
    let waiter = null, timer = null;
    const wait = new Promise((res) => {
        waiter = (l) => { if (timer)
            clearTimeout(timer); res(sid && l.sid && l.sid !== sid ? null : l); }; // 다른 세이브의 목록은 받지 않는다(총독 창과 같은 규칙, 2026-10-18)
        gov_1.gov.waiters.push(waiter);
        timer = setTimeout(() => { const i = waiter ? gov_1.gov.waiters.indexOf(waiter) : -1; if (i >= 0)
            gov_1.gov.waiters.splice(i, 1); res(null); }, 15000);
    });
    try {
        await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)((0, protocol_1.planetsEffect)()));
    }
    catch (error) {
        (0, diagnostics_1.logDiagnostic)('warn', 'govreport.request_failed', { error });
        return null;
    }
    return wait;
}
/** 새해 신호: 같은 세이브·같은 해에는 한 번만. 앱을 켠 직후(지난 로그를 다시 읽는 중)이거나 게임이 꺼져 있으면 하지 않는다. */
async function onNewYear(date) {
    const sid = ctx_1.ctx.curSaveId, year = (date || '').split('.')[0];
    if (!sid || !year || !ctx_1.ctx.gameRunning || Date.now() - startedAt < 20000)
        return;
    if (asked.get(sid) === year)
        return;
    asked.set(sid, year);
    const list = await readPlanets();
    if (!list || ctx_1.ctx.curSaveId !== sid)
        return;
    const pick = (0, govreport_1.pickReport)(list);
    if (!pick) {
        (0, diagnostics_1.logDiagnostic)('info', 'govreport.none', { year });
        return;
    }
    offer({ sid, year, list, index: pick.index, reasons: pick.reasons, history: [], opened: false, first: null, demo: false });
}
function offer(r) {
    exports.govReport.cur = r;
    const p = r.list.planets[r.index];
    ctx_1.ctx.notify({ kind: 'gov', title: L('총독 통신 요청', 'Governor calling'), body: L(`${p.name}의 ${(0, planets_1.governorName)(p)}: 보고드릴 것이 있습니다 (${r.reasons.join(', ')})`, `${(0, planets_1.governorName)(p)} of ${p.name}: I have something to report (${r.reasons.join(', ')})`), action: L('통신 받기', 'Take the call') });
}
const memKey = (r) => { const p = r.list.planets[r.index], n = (0, planets_1.governorName)(p); return n === planets_1.DEFAULT_GOVERNOR ? null : (0, govmemory_1.govKey)(r.list.sid || r.sid, n); };
function view() {
    const r = exports.govReport.cur;
    if (!r)
        return null;
    const p = r.list.planets[r.index];
    return { demo: r.demo, empire: r.list.empire, year: r.year, planet: p.name, type: (0, planets_1.planetType)(p), capital: p.capital, pops: p.pops, popsApprox: !!p.popsApprox, stability: p.stability, amenities: p.amenities, housing: p.housing,
        governor: (0, planets_1.governorName)(p), cls: (0, speciesClass_1.classKey)(r.list.cls), clsName: (0, planets_1.className)(r.list.cls), reasons: r.reasons, log: r.history.map((m) => ({ who: m.role === 'user' ? 'me' : 'gov', text: m.content })).filter((l, i) => !(i === 0 && l.who === 'me')), first: r.first, busy: exports.govReport.busy };
}
function push() { if (exports.govReport.win && !exports.govReport.win.isDestroyed())
    exports.govReport.win.webContents.send('govReport', view()); }
function openGovReport() {
    if (!exports.govReport.cur)
        return;
    exports.govReport.cur.opened = true;
    if (exports.govReport.win && !exports.govReport.win.isDestroyed()) {
        exports.govReport.win.show();
        exports.govReport.win.focus();
        push();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1180, Math.round(area.width * 0.78)), height: Math.min(800, Math.round(area.height * 0.86)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.govReport.win = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 720, minHeight: 520, frame: false, show: false, backgroundColor: '#05090c', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.govReport.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.govReport.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'govreport.html'));
    exports.govReport.win.once('ready-to-show', () => { exports.govReport.win?.show(); push(); void speak(null); });
    exports.govReport.win.on('closed', () => { exports.govReport.win = null; });
}
/** 총독의 한 마디. text 가 null 이면 첫 보고. */
async function speak(text) {
    const r = exports.govReport.cur;
    if (!r)
        return { ok: false, error: L('보고가 없습니다.', 'No report.') };
    if (text === null && r.first)
        return { ok: true };
    if (exports.govReport.busy)
        return { ok: false, error: L('총독이 말하는 중입니다.', 'The governor is speaking.') };
    exports.govReport.busy = true;
    push();
    try {
        const p = r.list.planets[r.index], key = memKey(r), mv = key ? (0, gov_1.govMem)().view(key) : null;
        const q = text === null ? (0, govreport_1.reportOpening)(p, r.reasons) : text;
        const msgs = (0, planets_1.govMessages)(r.list, p, ctx_1.ctx.playerName, r.history, q, mv ? mv.own : undefined, mv ? mv.other : undefined);
        let raw = await ctx_1.ctx.ai.chat(msgs, { maxTokens: 1500 });
        (0, gov_1.govRawLog)(q, raw, false);
        if ((0, planets_1.govLooksCut)(raw)) {
            raw = await ctx_1.ctx.ai.chat([...msgs, { role: 'user', content: '[System notice] Your last reply was cut off. Say the same thing again in three or four sentences, finishing every sentence.' }], { maxTokens: 2500 });
            (0, gov_1.govRawLog)(q, raw, true);
        }
        if (exports.govReport.cur !== r)
            return { ok: false, error: L('보고가 바뀌었습니다.', 'The report has changed.') };
        const ex = (0, planets_1.extractGovSay)(raw);
        if (key && ex.memo)
            (0, gov_1.govMem)().add(key, (0, govmemory_1.cleanMemText)(ex.memo), ctx_1.ctx.gameDate);
        r.history.push({ role: 'user', content: q }, { role: 'assistant', content: ex.say });
        if (text === null)
            r.first = ex.say;
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
    finally {
        exports.govReport.busy = false;
        push();
    }
}
function registerGovReport(router) {
    router.on(log_router_1.SLOT.GOVREPORT, 'govreport:year', (m) => { if (m.kind === 'YEAR')
        void onNewYear(m.kv.date ?? ''); });
    electron_1.ipcMain.handle('govReportState', async () => view());
    electron_1.ipcMain.handle('govReportSay', async (_e, text) => {
        const t = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
        if (!t)
            return { ok: false, error: L('할 말을 적어 주세요.', 'Write what you want to say.') };
        return speak(t);
    });
    electron_1.ipcMain.handle('govReportRetry', async () => speak(null));
    electron_1.ipcMain.handle('govReportClose', async () => { if (exports.govReport.win && !exports.govReport.win.isDestroyed())
        exports.govReport.win.close(); exports.govReport.win = null; return true; });
}
/** 개발자 시험: 가짜 행성 목록으로 보고 창을 바로 연다(게임 명령 없음, AI 연결은 필요). */
function demoGovReport() {
    const list = { run: 0, sid: 'dev', cls: 1, empire: '[시험] 인류 연방', planets: [
            { name: '[시험] 뉴 아테네', pops: 42, stability: 31, amenities: -8.5, housing: -3, capital: false, pc: 3, governor: '[시험] 엘레나 바로스' },
            { name: '[시험] 지구', pops: 120, stability: 72, amenities: 12, housing: 4, capital: true, pc: 3, governor: null },
        ] };
    const t = (0, govreport_1.planetTrouble)(list.planets[0]);
    exports.govReport.cur = { sid: 'dev', year: '2210', list, index: 0, reasons: t.reasons, history: [], opened: false, first: null, demo: true };
    openGovReport();
}
//# sourceMappingURL=govreport.js.map
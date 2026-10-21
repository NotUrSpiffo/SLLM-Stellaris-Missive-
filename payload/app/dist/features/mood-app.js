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
exports.mood = void 0;
exports.onMoodSnapshot = onMoodSnapshot;
exports.moodNudge = moodNudge;
exports.moodPromptNow = moodPromptNow;
exports.moodView = moodView;
exports.registerMood = registerMood;
// 민심(2026-10-20 알파 10): 월간 상황(STATE)이 올 때마다 점수를 계산해 세이브별로 기록하고, 급락·분노 단계 진입을 알린다.
// 규칙: src/mood.ts. 화면: ui/office-mood.js(집무실 머리말의 민심 칩). 신문·라디오는 moodPromptNow() 한 줄을 프롬프트에 넣는다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const chronicle_app_1 = require("./chronicle-app");
const music_1 = require("../music");
const mood_1 = require("../mood");
const L = settings_ui_1.pick;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_mood.json');
let store = null;
function all() { if (store)
    return store; try {
    store = (0, mood_1.sanitizeMood)(JSON.parse(fs.readFileSync(file(), 'utf8')));
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'mood', error: e });
    store = (0, mood_1.sanitizeMood)({});
} return store; }
let saveTimer = null;
function save() { if (saveTimer)
    return; saveTimer = setTimeout(() => { saveTimer = null; try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'mood', error: e });
} }, 2000); }
const entry = (sid) => (all().saves[(0, music_1.safeKey)(sid)] ??= { series: [], alerted: '', adj: [] });
exports.mood = { cur: null, date: '' };
function onMoodSnapshot(snap) {
    if (!snap.sid || snap.sid !== ctx_1.ctx.curSaveId)
        return;
    const e = entry(snap.sid), m = (0, mood_1.computeMood)(snap, (0, mood_1.activeAdj)(e.adj, snap.date));
    if (!m)
        return;
    exports.mood.cur = m;
    exports.mood.date = snap.date;
    e.series = (0, mood_1.pushMood)(e.series, { date: snap.date, score: m.score });
    const al = (0, mood_1.moodAlert)(e.series, e.alerted);
    if (al) {
        e.alerted = m.level;
        ctx_1.ctx.notify({ kind: 'info', title: al.kind === 'unrest' ? L('민심이 분노로 치달았습니다', 'Public mood has turned to unrest') : L(`민심이 반년 사이 ${al.drop}점 떨어졌습니다`, `Public mood fell ${al.drop} points in half a year`), body: L(`지금 민심: ${mood_1.MOOD_KO[m.level]} ${m.score}/100`, `Public mood now: ${mood_1.MOOD_EN[m.level]} ${m.score}/100`) });
        (0, chronicle_app_1.chronNoteWorld)(`${snap.date} ${L(`민심 ${mood_1.MOOD_KO[m.level]}(${m.score})`, `Public mood ${mood_1.MOOD_EN[m.level]} (${m.score})`)}`, true);
    }
    else if (e.alerted && m.score >= 45)
        e.alerted = ''; // 회복하면 다시 알릴 수 있게
    save();
    pushView();
}
/** 사건이 민심을 잠시 흔든다(비방 기사 대응 등). value −15~+15, 1년에 걸쳐 사라진다. */
function moodNudge(value, why) {
    if (!ctx_1.ctx.curSaveId || !value)
        return;
    const e = entry(ctx_1.ctx.curSaveId);
    e.adj.push({ date: ctx_1.ctx.gameDate || exports.mood.date || '', value: Math.max(-15, Math.min(15, Math.round(value))), why: why.slice(0, 120) });
    e.adj = e.adj.slice(-20);
    save();
}
/** 신문·라디오 프롬프트 한 줄(없으면 빈 글). */
function moodPromptNow() {
    if (!exports.mood.cur || !ctx_1.ctx.curSaveId)
        return '';
    return (0, mood_1.moodPromptLine)(exports.mood.cur, (0, mood_1.moodTrend)(entry(ctx_1.ctx.curSaveId).series));
}
function moodView() {
    const sid = ctx_1.ctx.curSaveId || '', e = sid ? entry(sid) : null, m = exports.mood.cur, last = e?.series[e.series.length - 1];
    const score = m?.score ?? last?.score ?? null, level = m?.level ?? (score !== null ? (0, mood_1.moodLevel)(score) : null); // 이번 실행에서 아직 상황이 안 왔으면 지난 기록으로
    return { sid, date: exports.mood.date || last?.date || '', score, level, label: level ? L(mood_1.MOOD_KO[level], mood_1.MOOD_EN[level]) : '', parts: m?.parts ?? null, trend: e ? (0, mood_1.moodTrend)(e.series) : 0, series: e ? e.series.slice(-24) : [], adj: e ? e.adj.slice(-5).reverse() : [] };
}
function pushView() { try {
    const v = moodView();
    for (const bw of electron_1.BrowserWindow.getAllWindows())
        if (!bw.isDestroyed())
            bw.webContents.send('moodUpdate', v);
}
catch { /* 창 없음 */ } }
function registerMood() {
    electron_1.ipcMain.handle('moodState', async () => moodView());
}
//# sourceMappingURL=mood-app.js.map
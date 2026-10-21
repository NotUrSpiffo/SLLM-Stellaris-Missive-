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
exports._crisisTest = exports.crisisIsSpecial = exports.crisisRadio = void 0;
exports.setCrisisExtra = setCrisisExtra;
exports.setCrisisSpecial = setCrisisSpecial;
exports.crisisView = crisisView;
exports.crisisNewsWrap = crisisNewsWrap;
exports.crisisMarkIssue = crisisMarkIssue;
exports.onCrisisBatch = onCrisisBatch;
exports.registerCrisis = registerCrisis;
// 은하 위기 특집 방송(앱 쪽, 2026-10-17). 순수 로직은 src/crisis.ts.
// 모드(sllm_crisis.1)가 매달 남기는 CRISIS/CRISIS_END 묶음으로 지금 은하에 있는 위기를 정하고,
// 라디오(radio-app)·신문(media)이 프롬프트와 지면 모양을 바꿀 수 있게 상태를 내준다. 창들에는 'crisisState' 로 알린다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const safe_send_1 = require("../safe-send");
const crisis_1 = require("../crisis");
const chronicle_app_1 = require("./chronicle-app");
const settings_ui_1 = require("./settings-ui");
let data = null;
/** 호외 예약(media.noteExtra)·위기 특별판 발행(media.publishCrisisSpecial). 가져오기 고리를 만들지 않으려고 media 가 시작할 때 넣어 준다. */
let noteExtra = () => { };
let publishSpecial = async () => { };
function setCrisisExtra(fn) { noteExtra = fn; }
function setCrisisSpecial(fn) { publishSpecial = fn; }
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_crisis.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = j && typeof j === 'object' ? j : {};
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'crisis', error: e });
        data = {};
    }
    return data;
}
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'crisis', error: e });
} }
const cur = () => { const sid = ctx_1.ctx.curSaveId; if (!sid)
    return (0, crisis_1.emptyCrisis)(); const d = all(); const s = (d[sid] ??= (0, crisis_1.emptyCrisis)()); s.issues ??= []; s.since ??= {}; s.ended ??= {}; s.active ??= []; return s; };
/** 화면에 보낼 상태(창은 이 값으로 특별 테마를 켜고 끈다). */
function crisisView() {
    const s = cur();
    return { active: s.active.length > 0, kinds: s.active.slice(), names: (0, crisis_1.crisisNames)(s.active, 'ko'), namesEn: (0, crisis_1.crisisNames)(s.active, 'en'), since: { ...s.since }, issues: s.issues.slice(), labels: { ...(s.labels ?? {}) } };
}
const broadcast = () => { const v = crisisView(); for (const w of electron_1.BrowserWindow.getAllWindows())
    (0, safe_send_1.safeSend)(w, 'crisisState', v); };
/** 라디오(radio-app)용: 위기 동안 덧붙일 지시와, 새 사건이 없을 때 쓸 위기 특보 사실. */
const crisisRadio = () => { const s = cur(); return { directive: (0, crisis_1.crisisRadioDirective)(s), facts: (0, crisis_1.crisisFacts)(s, ctx_1.ctx.gameDate) }; };
exports.crisisRadio = crisisRadio;
/** 신문(media)용: 위기 동안 프롬프트 앞에 특별판 지시를 끼운다(없으면 그대로). */
function crisisNewsWrap(messages) { const d = (0, crisis_1.crisisNewsDirective)(cur()); return d ? [messages[0], { role: 'system', content: d }, ...messages.slice(1)] : messages; }
/** 신문(media)용: 위기 특별판 호를 표시(이 호만 특별판 지면). */
function crisisMarkIssue(id, label) { const s = cur(); (0, crisis_1.markCrisisIssue)(s, id, label); save(); broadcast(); }
/** 신문(media)용: 이 호가 위기 특별판인가(호외 연 상한 계산에서 뺀다). */
const crisisIsSpecial = (id) => cur().issues.includes(id);
exports.crisisIsSpecial = crisisIsSpecial;
const collector = new crisis_1.CrisisCollector();
function onCrisisBatch(kinds, date) {
    if (!ctx_1.ctx.curSaveId)
        return;
    const s = cur();
    const { began, ended } = (0, crisis_1.applyCrisis)(s, kinds, date || ctx_1.ctx.gameDate);
    if (!began.length && !ended.length)
        return;
    save();
    for (const k of began) {
        const t = (0, crisis_1.crisisBeginText)(k);
        (0, chronicle_app_1.chronNoteWorld)(t, false);
        const nm = (0, crisis_1.crisisName)(k, (0, settings_ui_1.selectedBase)());
        ctx_1.ctx.notify({ kind: 'news', title: (0, settings_ui_1.pick)('⚠ 은하 위기 · 긴급 특별 방송', '⚠ Galactic crisis · Emergency broadcast'), body: `"${nm}" — ` + (0, settings_ui_1.pick)('신문과 라디오가 특별 편성으로 바뀝니다.', 'newspapers and radio switch to special programming.') });
    }
    if (began.length)
        void publishSpecial(date || ctx_1.ctx.gameDate, (0, crisis_1.crisisSpecialFact)(began, date || ctx_1.ctx.gameDate), { ko: (0, crisis_1.crisisNames)(began, 'ko'), en: (0, crisis_1.crisisNames)(began, 'en') }); // 위기 특별판은 이때 한 번만(정기호·일반 호외는 평소 지면)
    for (const k of ended) {
        const t = (0, crisis_1.crisisEndText)(k);
        (0, chronicle_app_1.chronNoteWorld)(t, false);
        if (!s.active.length)
            noteExtra('war_end', date || ctx_1.ctx.gameDate, t);
    }
    (0, diagnostics_1.logDiagnostic)('info', 'crisis.changed', { began, ended, active: s.active });
    broadcast();
}
function registerCrisis(router) {
    router.on(log_router_1.SLOT.CRISIS, 'crisis:scan', (m) => {
        if (m.kind !== 'CRISIS' && m.kind !== 'CRISIS_END')
            return;
        const r = collector.feed(m.kind, m.kv);
        if (r)
            onCrisisBatch(r.kinds, r.date);
    });
    electron_1.ipcMain.handle('crisisState', async () => crisisView());
}
exports._crisisTest = { reset: () => { data = {}; } };
//# sourceMappingURL=crisis-app.js.map
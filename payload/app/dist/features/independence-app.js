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
exports.registerIndependence = registerIndependence;
// 독립 선언 서신(앱 쪽, 2026-10-19). 순수 로직은 src/independence.ts.
// 모드 SLLM:ORIGIN(반란군 행성 장악·평화 협상 독립) → 새 나라를 세이브마다 기록 → 그 나라의 통신 번호(IDX)를 알면
// 연대기(새 나라·부모 나라 쪽)에 남기고 「독립 선언문」 외교 서신을 플레이어 서신함에 넣는다. 번호를 모르면 매달 다시 보고 24개월까지 기다린다.
// 저장: sllm_independence.json { saves: { [세이브]: IndepRecord[] } }.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const mail_1 = require("../mail");
const gamestate_app_1 = require("./gamestate-app");
const chronicle_app_1 = require("./chronicle-app");
const mail_app_1 = require("./mail-app");
const independence_1 = require("../independence");
let data = null;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_independence.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = { saves: j && typeof j.saves === 'object' ? j.saves : {} };
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'independence', error: e });
        data = { saves: {} };
    }
    return data;
}
function save() { try {
    const tmp = file() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8');
    fs.renameSync(tmp, file());
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'independence', error: e });
} }
const listOf = (sid) => (all().saves[sid] ??= []);
/** 이름 → 통신 번호(IDX 신호로 알게 된 것만). */
function idxOf(name) { for (const [i, n] of chronicle_app_1.idxNames)
    if (n === name && i > 0 && i < 9000)
        return i; return 0; }
const busy = new Set();
/** 기다리는 선언문을 보낼 수 있으면 보낸다(번호를 알게 됐을 때). */
async function deliver(sid, r) {
    if (r.state !== 'wait' || busy.has(sid + ':' + r.country))
        return;
    const date = ctx_1.ctx.gameDate || r.date;
    if ((0, independence_1.indepExpired)(r, date)) {
        r.state = 'expired';
        save();
        (0, diagnostics_1.logDiagnostic)('info', 'independence.expired', { country: r.country });
        return;
    }
    const idx = idxOf(r.country);
    if (!idx)
        return; // 아직 연락이 닿지 않음 → 다음 달에 다시
    busy.add(sid + ':' + r.country);
    try {
        const lines = (0, independence_1.indepChronLines)(r);
        (0, chronicle_app_1.chronNote)(idx, lines.child, true);
        (0, chronicle_app_1.chronNoteByName)(r.from, lines.parent, false); // 대화에서 "어디서 갈라져 나왔는지"를 기억(연대기 → withLore)
        const profile = ctx_1.ctx.profileWithEthics(ctx_1.ctx.profiles.get(idx) ?? mail_app_1.mail.countries.get(idx)?.profile, idx);
        const raw = await ctx_1.ctx.ai.chat((0, independence_1.declarationMessages)({ player: ctx_1.ctx.playerName, date, r, profile }), { maxTokens: 1400 });
        const text = (0, independence_1.cleanDeclaration)(raw);
        if (!text || sid !== ctx_1.ctx.curSaveId)
            return;
        (0, mail_app_1.receiveLetter)(sid, ctx_1.ctx.govMem().currentBranch(sid), { idx, name: r.country, date, text, proposal: null, expires: (0, mail_1.addYears)(date, 2), read: false, sourceId: 'independence:' + r.country });
        r.state = 'sent';
        save();
        (0, diagnostics_1.logDiagnostic)('info', 'independence.sent', { country: r.country, from: r.from, kind: r.kind });
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'independence.letter_failed', { country: r.country, error: String(e) });
    } // 다음 달에 다시
    finally {
        busy.delete(sid + ':' + r.country);
    }
}
function onOrigin(o) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return;
    const r = (0, independence_1.noteIndependence)(listOf(sid), o, ctx_1.ctx.playerName, ctx_1.ctx.gameDate || o.date);
    if (!r)
        return;
    save();
    (0, diagnostics_1.logDiagnostic)('info', 'independence.noted', { country: r.country, from: r.from, kind: r.kind, state: r.state });
    void deliver(sid, r);
}
function registerIndependence() {
    (0, gamestate_app_1.onGameOrigin)(onOrigin);
    (0, gamestate_app_1.onGameSnapshot)((snap) => { if (snap.sid !== ctx_1.ctx.curSaveId)
        return; for (const r of listOf(snap.sid))
        if (r.state === 'wait')
            void deliver(snap.sid, r); }); // 매달: 연락이 닿았는지 다시 본다
}
//# sourceMappingURL=independence-app.js.map
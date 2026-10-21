"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameState = void 0;
exports.onGameSnapshot = onGameSnapshot;
exports.onGameOrigin = onGameOrigin;
exports.onGameSpyOp = onGameSpyOp;
exports.registerGameState = registerGameState;
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const i18n_pick_1 = require("../i18n-pick"); // 연대기 문장은 인터페이스 언어로(2026-10-19)
const chronicle_app_1 = require("./chronicle-app");
const faction_app_1 = require("./faction-app");
const mediation_app_1 = require("./mediation-app");
const vassal_app_1 = require("./vassal-app");
const policy_app_1 = require("./policy-app");
const mood_app_1 = require("./mood-app"); // 민심(알파 10, 2026-10-20)
const gamestate_1 = require("../gamestate");
const MAX_KEEP = 50;
exports.gameState = {
    collector: new gamestate_1.StateCollector(),
    /** 마지막으로 완성된 월간 상황(세이브 번호 포함) */
    last: null,
    origins: [],
    spyOps: [],
};
const snapListeners = [];
/** 매달 게임 상황을 받고 싶은 기능(이 파일을 가져오는 쪽)이 등록한다 — 가져오기 순환 없이(2026-10-19, 비서 상황 이벤트 기한). */
function onGameSnapshot(fn) { snapListeners.push(fn); }
const originListeners = [];
/** 반란·독립으로 새 나라가 생겼을 때(모드 SLLM:ORIGIN) 받고 싶은 기능이 등록한다(2026-10-19, 독립 선언 서신). */
function onGameOrigin(fn) { originListeners.push(fn); }
const spyListeners = [];
/** 끝난 첩보 작전(SPYOP)을 받는다 — 비방 공작 스캔들(scandal-app, 2026-10-20). */
function onGameSpyOp(fn) { spyListeners.push(fn); }
function registerGameState(router) {
    let lastAgendaFinished = '';
    let pendingAgendaFinished = null;
    router.on(log_router_1.SLOT.GAMESTATE, 'gamestate', (m) => {
        if (m.kind === 'AGENDA_FINISHED') {
            // The event immediately follows this marker with a fresh snapshot.
            pendingAgendaFinished = m.kv.sid === ctx_1.ctx.curSaveId ? { sid: m.kv.sid, date: m.kv.date } : null;
            return;
        }
        const snap = exports.gameState.collector.feed(m);
        if (snap) {
            exports.gameState.last = snap;
            const key = `${snap.sid}:${snap.n}`;
            const finished = pendingAgendaFinished?.sid === snap.sid && pendingAgendaFinished?.date === snap.date && key !== lastAgendaFinished;
            pendingAgendaFinished = null;
            (0, faction_app_1.onFactionSnapshot)(snap, finished);
            (0, mediation_app_1.onMediationYear)(snap); // 해가 바뀌면 AI 끼리 전쟁 중재 제안을 굴린다(LLM 없음)
            (0, vassal_app_1.onVassalSnapshot)(snap); // 종속국 통신 채널: 채널 갱신·충성도 급변 서신(2026-10-17)
            (0, policy_app_1.onPolicySnapshot)(snap); // 정책 퀘스트: 한 달 측정·판정(2026-10-18)
            (0, mood_app_1.onMoodSnapshot)(snap); // 민심: 점수·추이 기록, 급락 알림(2026-10-20 알파 10)
            for (const f of snapListeners) {
                try {
                    f(snap);
                }
                catch (e) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'gamestate.listener_failed', { error: String(e) });
                }
            } // 비서 상황 이벤트 기한 등(2026-10-19)
            if (finished) {
                lastAgendaFinished = key;
                (0, chronicle_app_1.chronNoteWorld)((0, i18n_pick_1.L)(`제국 평의회 의제가 완료되어 새 의제를 선택할 수 있습니다. (${snap.date})`, `The empire's council agenda is complete; a new agenda can be chosen. (${snap.date})`), true);
                (0, diagnostics_1.logDiagnostic)('info', 'faction.agenda_finished', { sid: snap.sid, date: snap.date, factions: snap.factions.length });
            }
            (0, diagnostics_1.logDiagnostic)('info', 'gamestate.snapshot', { date: snap.date, wars: snap.wars.length, factions: snap.factions.length, spynets: snap.spynets.length, subject: !!snap.subject });
            return;
        }
        const o = (0, gamestate_1.originFrom)(m);
        if (o) {
            exports.gameState.origins.push(o);
            exports.gameState.origins.splice(0, Math.max(0, exports.gameState.origins.length - MAX_KEEP));
            (0, chronicle_app_1.chronNoteWorld)((0, gamestate_1.originText)(o), true);
            for (const f of originListeners) {
                try {
                    f(o);
                }
                catch (e) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'gamestate.origin_listener_failed', { error: String(e) });
                }
            }
            return;
        }
        const op = (0, gamestate_1.spyOpFrom)(m);
        if (op) {
            exports.gameState.spyOps.push(op);
            exports.gameState.spyOps.splice(0, Math.max(0, exports.gameState.spyOps.length - MAX_KEEP));
            const cand = (0, gamestate_1.spyCandidate)(op, ctx_1.ctx.playerName);
            (0, diagnostics_1.logDiagnostic)('info', 'gamestate.spyop', { phase: op.phase, owner: op.owner, target: op.target, role: cand?.role ?? null, type: op.type ?? null });
            for (const f of spyListeners) {
                try {
                    f(op);
                }
                catch (e) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'gamestate.spyop_listener_failed', { error: String(e) });
                }
            }
        }
    });
}
//# sourceMappingURL=gamestate-app.js.map
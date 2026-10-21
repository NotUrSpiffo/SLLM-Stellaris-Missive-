"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactName = exports.fedWarTargets = void 0;
exports.registerPeace = registerPeace;
exports.refreshContacts = refreshContacts;
exports.listGameWars = listGameWars;
exports.scanWar = scanWar;
exports.applyPeace = applyPeace;
exports.playerPeace = playerPeace;
const log_router_1 = require("../app/log-router");
const game_link_1 = require("../app/game-link");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const terminal_1 = require("./terminal");
const peace_core_1 = require("../peace-core");
const i18n_pick_1 = require("../i18n-pick"); // 한/영 문구(2026-10-19 영어 화면 점검)
const rowsOf = new Map();
const ENDS = { MEDWARS_END: 'MEDWAR', MEDSCAN_END: 'MEDSYS', MEDAPPLY_END: 'MEDGIVE' };
function registerPeace(router) {
    router.on(log_router_1.SLOT.PEACE, 'peace', (m) => {
        if (m.kind === 'MEDWAR' || m.kind === 'MEDSYS' || m.kind === 'MEDGIVE') {
            const key = m.kind + ':' + m.kv.req, list = rowsOf.get(key);
            if (list && list.length < 400)
                list.push(m);
        }
        else if (ENDS[m.kind])
            terminal_1.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
    });
}
/** 요청을 보내고 끝 줄을 기다린 뒤, 그 사이에 온 목록 줄을 함께 돌려준다. */
async function request(build, end) {
    if (!ctx_1.ctx.gameRunning)
        throw new Error((0, i18n_pick_1.L)('게임이 켜져 있어야 합니다.', 'The game must be running.'));
    const req = ++game_link_1.link.reqCounter, key = ENDS[end] + ':' + req;
    rowsOf.set(key, []);
    try {
        const m = await (0, terminal_1.terminalRequest)(build(req), end, req);
        if (m.kv.sid !== ctx_1.ctx.curSaveId)
            throw new Error((0, i18n_pick_1.L)('세이브가 바뀌어 결과를 쓰지 않았습니다.', 'The save changed, so the result was not written.'));
        return { end: m, rows: rowsOf.get(key) ?? [] };
    }
    finally {
        rowsOf.delete(key);
    }
}
async function refreshContacts() {
    const req = ++game_link_1.link.reqCounter;
    await (0, terminal_1.terminalRequest)('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
}
const isRegularContact = (idx) => terminal_1.terminal.sid === ctx_1.ctx.curSaveId && terminal_1.terminal.items.some((c) => c.idx === idx && c.type === 'default' && !!c.name.trim());
/** 연방회의 전쟁 선포 대상: 통신 가능한 일반 제국 가운데 연방 회원국이 아닌 곳. */
const fedWarTargets = (memberIdx) => terminal_1.terminal.sid !== ctx_1.ctx.curSaveId ? [] : terminal_1.terminal.items.filter((c) => c.type === 'default' && !!c.name.trim() && !memberIdx.includes(c.idx)).map((c) => ({ idx: c.idx, name: c.name }));
exports.fedWarTargets = fedWarTargets;
const contactName = (idx) => terminal_1.terminal.items.find((c) => c.idx === idx)?.name || `제국 #${idx}`;
exports.contactName = contactName;
/** 플레이어가 끼지 않은, 통신 가능한 일반 제국 끼리의 전쟁. 양쪽 다 연락처에 이름이 있는 일반 제국(type default)일 때만 돌려준다. */
async function listGameWars() {
    await refreshContacts();
    const r = await request(peace_core_1.medWarsCommand, 'MEDWARS_END');
    const seen = new Set();
    return r.rows.map(peace_core_1.medWarFrom).filter((w) => !!w).filter((w) => { const k = w.a + ':' + w.d; return seen.has(k) ? false : (seen.add(k), true); })
        .filter((w) => isRegularContact(w.a) && isRegularContact(w.d))
        .map((w) => ({ ...w, aName: (0, exports.contactName)(w.a), dName: (0, exports.contactName)(w.d) }));
}
/** 전쟁의 지금 점령 상황. found=false 면 전쟁을 찾지 못함. */
async function scanWar(t) {
    const r = await request((req) => (0, peace_core_1.medScanCommand)(req, t), 'MEDSCAN_END');
    return { found: r.end.kv.found === '1', rows: (0, peace_core_1.uniqueRows)(r.rows.map(peace_core_1.medSysFrom).filter((x) => !!x)) };
}
async function applyPeace(t, plan) {
    const r = await request((req) => (0, peace_core_1.medApplyCommand)(req, t, plan), 'MEDAPPLY_END');
    const result = (0, peace_core_1.readApply)(r.end, r.rows, plan);
    (0, diagnostics_1.logDiagnostic)('info', 'peace.apply', { kind: t.kind, peace: result.peace, gives: result.gives.map((g) => g.status) });
    return result;
}
/** 대화에서 합의한 평화(플레이어 ↔ AI 둘만의 전쟁): 현상 유지 규칙 — 영유권 안 점령지는 점령국에, 나머지는 원래 주인에게. */
async function playerPeace(tid, enemyName) {
    try {
        const t = { kind: 'player', tid };
        const scan = await scanWar(t);
        if (!scan.found)
            return { outcome: 'fail', text: (0, i18n_pick_1.L)('실패: 둘만의 전쟁이 아니거나 전쟁 중이 아닙니다.', 'Failed: this is not a two-party war, or they are not at war.'), lines: [] };
        const plan = (0, peace_core_1.cessionCandidates)(scan.rows);
        const res = await applyPeace(t, plan);
        const lines = (0, peace_core_1.applySummary)(res, { p1: ctx_1.ctx.playerName || '우리 제국', p2: enemyName });
        if (res.peace === 'no_war')
            return { outcome: 'fail', text: lines.join('\n'), lines };
        return { outcome: res.peace === 'unknown' ? 'timeout' : 'ok', text: lines.join('\n'), lines };
    }
    catch (e) {
        const msg = e.message;
        (0, diagnostics_1.logDiagnostic)('warn', 'peace.player.failed', { error: msg });
        return { outcome: /응답이 없습니다/.test(msg) ? 'timeout' : 'fail', text: (0, i18n_pick_1.L)('평화 처리 실패: ', 'Peace processing failed: ') + msg, lines: [] };
    }
}
//# sourceMappingURL=peace-app.js.map
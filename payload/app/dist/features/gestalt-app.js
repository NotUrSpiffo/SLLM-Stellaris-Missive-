"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gestaltCode = exports.isGestalt = void 0;
exports.noteGestaltSnapshot = noteGestaltSnapshot;
exports.playerGestalt = playerGestalt;
// 단일 의식(기계 지성·군체) 플레이어 제국 판정(2026-10-19 사용자 결정): 파벌·언론·시민 개개인을 전제로 한 기능은 막고, 인물 기능은 말투를 바꾼다.
// 어디서 알게 되나: 플레이어 제국 정보(PROFILE gest 1=기계·2=군체) → 외교 단말기 연락처(playerGest) → 월간 상황(COUNCILAG gest, 종류는 모름).
// 가져오기 고리를 만들지 않으려고 월간 상황은 main.ts 가 noteGestaltSnapshot 으로 넘겨 준다(이 파일은 ctx·terminal 만 가져온다).
const ctx_1 = require("../app/ctx");
const terminal_1 = require("./terminal");
let snap = null;
function noteGestaltSnapshot(s) { if (s.sid && typeof s.gestalt === 'boolean')
    snap = { sid: s.sid, on: s.gestalt }; }
/** 지금 세이브의 플레이어 제국이 단일 의식이면 그 종류, 아니면 ''. */
function playerGestalt() {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return '';
    const g = ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.gest;
    if (g === 1)
        return 'machine';
    if (g === 2)
        return 'hive';
    if (terminal_1.terminal.sid === sid) {
        if (terminal_1.terminal.playerGest === 1)
            return 'machine';
        if (terminal_1.terminal.playerGest === 2)
            return 'hive';
    }
    if (snap && snap.sid === sid)
        return snap.on ? 'gestalt' : '';
    return '';
}
const isGestalt = () => playerGestalt() !== '';
exports.isGestalt = isGestalt;
/** 인물 프롬프트에 넘길 값(persona/letters/memorial): 1 기계, 2 군체(종류를 모르면 군체로 보지 않고 1·2 둘 다 아님 → 3). */
const gestaltCode = () => { const k = playerGestalt(); return k === 'machine' ? 1 : k === 'hive' ? 2 : k === 'gestalt' ? 3 : 0; };
exports.gestaltCode = gestaltCode;
//# sourceMappingURL=gestalt-app.js.map
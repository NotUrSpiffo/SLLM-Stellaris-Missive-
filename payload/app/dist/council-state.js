"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouncilState = exports.stanceOf = exports.COUNT_VIRTUAL_SEAT = exports.FORCE_PCT = void 0;
exports.councilHash = councilHash;
exports.initialSeats = initialSeats;
exports.tally = tally;
exports.devTally = devTally;
exports.applyDelta = applyDelta;
const i18n_pick_1 = require("./i18n-pick");
// A-16: 강제 통과·취소 전에 앱(본체)이 의회 집계를 다시 확인한다. 2026-10-15 추가팀.
// 회의 창(ui/council.html)과 같은 규칙으로 명단·가중치·입장을 들고 있다가, 강제 결정 요청이 오면 80%를 다시 계산한다.
// 화면 쪽이 조작돼도(F-05 같은 구멍) 미달이면 게임에 아무것도 보내지 않게 하는 마지막 방어선. 순수 모듈(Electron 없음).
// 연결(6단계): 회의 창을 열 때 open(), councilDebate 결과마다 noteDebate(), councilForce 맨 앞에서 check().
// 화면 규칙과 어긋나지 않는지는 selftest가 council.html의 실제 계산 코드와 비교한다.
/** 강제 결정에 필요한 비율(%) — council.html 과 같음 */
exports.FORCE_PCT = 80;
/**
 * 플레이어가 은하공동체 비회원일 때 붙는 가상 의석(전체 가중치의 10%)을 집계에 넣을지.
 * F-15 후속으로 게임 확인 뒤 사용자가 정한다. 정하기 전에는 화면과 같은 규칙(넣음). 바꿀 곳은 여기 한 곳.
 */
exports.COUNT_VIRTUAL_SEAT = true;
const VIRTUAL_SHARE = 0.1;
/** council.html 의 hash 와 같은 FNV-1a(이름으로 만든 가상 입장) */
function councilHash(str) { let h = 2166136261; for (const c of str) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
} return h >>> 0; }
const stanceOf = (p) => (p >= 25 ? 'f' : p <= -25 ? 'a' : 'u');
exports.stanceOf = stanceOf;
/** 회의 창이 실제 안건으로 여는 경우와 같은 조건·같은 값으로 의석을 만든다(council.html 117~120줄). 실제 안건이 아니면 null. */
function initialSeats(info) {
    const real = info && !info.demo && Array.isArray(info.members) && info.members.length >= 2 ? info.members : null;
    if (!real)
        return null;
    const anyPos = real.some((mb) => mb.ai !== false && (mb.pos ?? 0) > 0);
    const M = real.map((mb) => {
        const h = councilHash(mb.name + '|' + (info.key || '')) % 181 - 90;
        return { idx: mb.idx, name: mb.name, w: Math.round((mb.weight || 1) * 10) / 10, p: mb.ai === false ? 0 : (mb.pos === 1 ? 90 : mb.pos === 2 ? -90 : mb.pos === 3 ? 0 : anyPos ? 0 : h), player: mb.ai === false };
    });
    if (!M.some((m) => m.player))
        M.push({ name: (0, i18n_pick_1.L)('플레이어 제국 (비회원 가상 의석)', 'Player empire (virtual non-member seat)'), w: Math.round(M.reduce((a, m) => a + m.w, 0) * VIRTUAL_SHARE * 10) / 10 || 1, p: 0, player: true, virtual: true });
    return M;
}
/** 찬성·반대·기권 비율(%). 플레이어는 미는 방향으로 투표한다(council.html stOf·tallyPct). */
function tally(seats, dir, countVirtual = exports.COUNT_VIRTUAL_SEAT) {
    const sum = { f: 0, a: 0, u: 0 };
    for (const m of seats) {
        if (m.virtual && !countVirtual)
            continue;
        const st = m.player ? dir : (0, exports.stanceOf)(m.p);
        sum[st] += m.w;
    }
    const t = sum.f + sum.a + sum.u || 1;
    return { f: sum.f / t * 100, a: sum.a / t * 100, u: sum.u / t * 100 };
}
/** 개발자 고정 집계(council.html tallyPct 의 fixedVotes 분기) */
function devTally(dev) {
    if (!dev || (dev.vote !== 'for' && dev.vote !== 'against'))
        return null;
    const n = Number(dev.percent), p = Number.isFinite(n) ? Math.max(80, Math.min(100, Math.round(n))) : 85;
    return dev.vote === 'for' ? { f: p, a: 100 - p, u: 0 } : { f: 100 - p, a: p, u: 0 };
}
/** 설득 변화 적용(council.html 292~293줄): 소수 한 자리 반올림, -100~100 */
function applyDelta(p, delta) {
    const add = Number.isFinite(Number(delta)) ? Number(delta) : 0;
    return Math.max(-100, Math.min(100, Math.round((p + add) * 10) / 10));
}
/** 지금 열린 회의 하나의 상태(메모리만, 회의 창을 닫으면 clear). */
class CouncilState {
    cur = null;
    /** 회의 창을 열 때(또는 "정보 다시 읽기" 뒤 다시 열 때). 실제 안건이 아니면 상태를 비운다. */
    open(sid, info) {
        const seats = initialSeats(info);
        this.cur = seats && info ? { sid, key: info.key || '', reliable: info.reliable === true, seats, dir: 'f' } : null;
    }
    clear() { this.cur = null; }
    /** 토론 한 번의 결과: 플레이어가 민 방향과 의원별 설득 변화(id = 의석 순서, councilDebate 와 같은 번호). 개발자 고정 집계 중이면 화면처럼 변화를 더하지 않는다. */
    noteDebate(sid, key, dir, replies, devFixed = false) {
        const c = this.cur;
        if (!c || c.sid !== sid || c.key !== key)
            return false;
        c.dir = dir === 'a' ? 'a' : 'f';
        for (const r of replies) {
            const m = c.seats[Number(r.id)];
            if (!m || m.player)
                continue;
            m.p = applyDelta(m.p, devFixed ? 0 : r.delta);
        }
        return true;
    }
    /** 지금 상태(진단·selftest 용 복사본) */
    view() { const c = this.cur; return c ? { sid: c.sid, key: c.key, dir: c.dir, seats: c.seats.map((s) => ({ ...s })) } : null; }
    /** 강제 결정 직전 확인. 통과(pass=true)는 찬성, 취소(pass=false)는 반대가 80% 이상이어야 한다. 모르는 회의·불완전한 정보면 보내지 않는다. */
    check(sid, key, pass, dev = null) {
        const c = this.cur;
        if (!c || c.sid !== sid || c.key !== key)
            return { ok: false, reason: (0, i18n_pick_1.L)('앱이 이 회의의 집계를 갖고 있지 않습니다. 회의 창을 다시 열어 주세요.', 'The app has no tally for this meeting. Please reopen the council window.') };
        if (!c.reliable)
            return { ok: false, reason: (0, i18n_pick_1.L)('게임 정보를 완전히 읽지 못한 회의라 강제 결정을 보낼 수 없습니다.', 'The game information for this meeting was not fully read, so a forced decision cannot be sent.') };
        const pct = devTally(dev) ?? tally(c.seats, c.dir);
        const side = pass ? pct.f : pct.a;
        if (side < exports.FORCE_PCT)
            return { ok: false, reason: (0, i18n_pick_1.L)(`앱의 집계로는 ${pass ? '찬성' : '반대'}이 ${Math.floor(side * 10) / 10}%라 ${exports.FORCE_PCT}%에 못 미칩니다. 게임에 보내지 않았습니다.`, `By the app's tally, ${pass ? 'For' : 'Against'} is ${Math.floor(side * 10) / 10}%, short of ${exports.FORCE_PCT}%. Not sent to the game.`), pct };
        return { ok: true, pct };
    }
}
exports.CouncilState = CouncilState;
//# sourceMappingURL=council-state.js.map
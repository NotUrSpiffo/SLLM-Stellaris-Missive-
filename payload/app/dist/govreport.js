"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_MIN_SCORE = void 0;
exports.planetTrouble = planetTrouble;
exports.pickReport = pickReport;
exports.reportOpening = reportOpening;
const i18n_pick_1 = require("./i18n-pick");
/** 문제 점수: 안정도 50 미만, 여가 부족, 주거 부족. 수치를 못 읽은 항목은 0. */
function planetTrouble(p) {
    const reasons = [];
    let score = 0;
    if (p.stability !== null && p.stability < 50) {
        score += (50 - p.stability) * 2;
        reasons.push((0, i18n_pick_1.L)(`안정도 ${Math.round(p.stability)}`, `Stability ${Math.round(p.stability)}`));
    }
    if (p.amenities !== null && p.amenities < 0) {
        score += -p.amenities * 3;
        reasons.push((0, i18n_pick_1.L)(`여가 시설 ${Math.round(-p.amenities)} 부족`, `Amenities short by ${Math.round(-p.amenities)}`));
    }
    if (p.housing !== null && p.housing < 0) {
        score += -p.housing * 3;
        reasons.push((0, i18n_pick_1.L)(`주거 ${Math.round(-p.housing)} 부족`, `Housing short by ${Math.round(-p.housing)}`));
    }
    return { score: Math.round(score), reasons };
}
exports.REPORT_MIN_SCORE = 10;
/** 가장 문제가 큰 행성 하나(점수가 같으면 주민이 많은 쪽, 그다음 수도). 보고할 만한 곳이 없으면 null. */
function pickReport(list) {
    if (!list)
        return null;
    let best = null;
    list.planets.forEach((p, index) => {
        const t = planetTrouble(p);
        if (t.score < exports.REPORT_MIN_SCORE)
            return;
        const better = !best || t.score > best.score || (t.score === best.score && ((p.pops ?? 0) > (list.planets[best.index].pops ?? 0) || (p.capital && !list.planets[best.index].capital)));
        if (better)
            best = { index, score: t.score, reasons: t.reasons };
    });
    return best;
}
/** 보고의 첫 요청(지도자가 보고를 받으려고 통신을 연 상황). govPrompt 의 "묻기 전에는 보고하지 말 것" 규칙과 맞도록 지도자가 묻는 형식이다. */
function reportOpening(p, reasons) {
    return `[Ruler's office · comms hologram] The governor asked to report, and the leader took the call. Leader: "Report." `
        + `First give a concise report on ${p.name}'s current problems (${reasons.join(', ') || 'general status'}), then suggest one or two likely causes and the orders or decisions you want from the leader. Keep the greeting short.`;
}
//# sourceMappingURL=govreport.js.map
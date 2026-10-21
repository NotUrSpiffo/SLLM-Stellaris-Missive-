"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respMood = exports.EXPOSE_CHANCE = exports.SCANDAL_MOOD = void 0;
exports.scandalFrom = scandalFrom;
exports.sanitizeScandal = sanitizeScandal;
/** 민심 조정(사건 조정은 mood.ts 에서 ±15 로 묶이고 1년에 걸쳐 사라진다). */
exports.SCANDAL_MOOD = { hit: -5, pressGood: 6, pressBad: -4, radio: 3, ignore: -2, exposed: -4 };
exports.EXPOSE_CHANCE = 0.2;
/** 대응별 민심. 기자회견은 인터뷰 평가(good)에 따라. */
const respMood = (r, good = false) => (r === 'press' ? (good ? exports.SCANDAL_MOOD.pressGood : exports.SCANDAL_MOOD.pressBad) : exports.SCANDAL_MOOD[r]);
exports.respMood = respMood;
/** 비방 공작 기록 하나를 스캔들로(플레이어와 관계없는 작전·비방이 아닌 작전은 null). */
function scandalFrom(op, player, rand) {
    if (op.phase !== 'finished' || op.type !== 'smear' || !player)
        return null;
    if (op.target === player && op.owner !== player)
        return { id: 'smear|' + op.owner + '|' + op.date, date: op.date, side: 'against', other: op.owner, resp: '', text: '', exposed: false };
    if (op.owner === player && op.target !== player)
        return { id: 'smear|' + op.target + '|' + op.date, date: op.date, side: 'ours', other: op.target, resp: '', text: '', exposed: rand < exports.EXPOSE_CHANCE };
    return null;
}
function sanitizeScandal(v) {
    const o = (v && typeof v === 'object' ? v : {}), saves = {};
    if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves))
        for (const [sid, list] of Object.entries(o.saves).slice(0, 500)) {
            if (!Array.isArray(list))
                continue;
            const out = [];
            for (const d of list.slice(-30)) {
                const x = (d && typeof d === 'object' ? d : {});
                if (typeof x.id !== 'string' || (x.side !== 'against' && x.side !== 'ours') || typeof x.other !== 'string')
                    continue;
                out.push({ id: x.id.slice(0, 160), date: typeof x.date === 'string' ? x.date.slice(0, 20) : '', side: x.side, other: x.other.slice(0, 80), resp: x.resp === 'press' || x.resp === 'radio' || x.resp === 'ignore' ? x.resp : '', text: typeof x.text === 'string' ? x.text.slice(0, 600) : '', exposed: x.exposed === true });
            }
            if (out.length)
                saves[sid.slice(0, 60)] = out;
        }
    return { saves };
}
//# sourceMappingURL=scandal.js.map
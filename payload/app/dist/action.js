"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAR_REASONS = exports.MAX_ENERGY = void 0;
exports.moodText = moodText;
exports.moodDelta = moodDelta;
exports.netSteps = netSteps;
exports.parseReply = parseReply;
exports.describe = describe;
exports.outcomeOf = outcomeOf;
exports.locSafe = locSafe;
// LLM 응답(JSON)을 해석하고 검증한다. 형식이 틀리면 말로만 처리하고 행동은 버린다.
const i18n_pick_1 = require("./i18n-pick");
exports.MAX_ENERGY = 300;
// 선전포고 사유. kind 는 게임의 sllm_probe_diplo KIND 번호.
exports.WAR_REASONS = {
    humiliation: { kind: 3, ko: '굴욕감 주기', en: 'humiliation' },
    tribute: { kind: 4, ko: '공물 요구', en: 'demand tribute' },
    revenge: { kind: 5, ko: '복수', en: 'revenge' },
};
// mood: 0 변화 없음, 1 조금 오름, 2 많이 오름, 3 조금 내림, 4 많이 내림(게임의 STEP 번호와 같다)
const MOODS = { none: 0, warmer_small: 1, warmer_large: 2, colder_small: 3, colder_large: 4 };
function moodText(step) {
    return [['', ''], ['조금 올랐습니다', 'rose a little'], ['많이 올랐습니다', 'rose a lot'], ['조금 내렸습니다', 'fell a little'], ['많이 내렸습니다', 'fell a lot']].map(([k, e]) => (0, i18n_pick_1.L)(k, e))[step] ?? '';
}
// 호감 변화 단계(1~4)가 주는 수치. 게임의 수정자 값(+5/+15/-5/-15)과 같다.
function moodDelta(step) {
    return { 1: 5, 2: 15, 3: -5, 4: -15 }[step] ?? 0;
}
// 대화 중 쌓인 변화를 합산해 필요한 단계만 남긴다(서로 상쇄되면 빈 배열).
function netSteps(steps) {
    let d = steps.reduce((a, s) => a + moodDelta(s), 0);
    const out = [];
    const sign = d < 0 ? -1 : 1;
    d = Math.abs(d);
    while (d >= 15) {
        out.push(sign > 0 ? 2 : 4);
        d -= 15;
    }
    while (d >= 5) {
        out.push(sign > 0 ? 1 : 3);
        d -= 5;
    }
    return out;
}
function extractJson(text) {
    const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
        return JSON.parse(t);
    }
    catch { /* 앞뒤에 말이 붙은 경우를 위해 첫 {…} 를 찾는다 */ }
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
        try {
            return JSON.parse(t.slice(a, b + 1));
        }
        catch { /* 아래에서 처리 */ }
    }
    return null;
}
function parseReply(raw) {
    const j = extractJson(raw);
    if (!j || typeof j !== 'object' || typeof j.say !== 'string') {
        return { say: raw.trim(), action: null, mood: 0, note: (0, i18n_pick_1.L)('JSON 형식이 아니어서 말만 표시했습니다.', 'The reply was not JSON, so only the words were shown.') };
    }
    const say = j.say.trim();
    const mood = typeof j.mood === 'string' && j.mood in MOODS ? MOODS[j.mood] : 0;
    const a = j.action;
    if (!a || a.type === 'none' || a.type === undefined)
        return { say, action: null, mood };
    switch (a.type) {
        case 'give_energy':
        case 'take_energy': {
            const amt = Number(a.amount);
            if (!Number.isInteger(amt) || amt < 1)
                return { say, action: null, mood, note: (0, i18n_pick_1.L)('금액이 올바르지 않아 행동을 무시했습니다.', 'The amount was invalid, so the action was ignored.') };
            if (amt > exports.MAX_ENERGY)
                return { say, action: { type: a.type, amount: exports.MAX_ENERGY }, mood, note: (0, i18n_pick_1.L)(`금액을 상한 ${exports.MAX_ENERGY}으로 줄였습니다.`, `Reduced the amount to the cap of ${exports.MAX_ENERGY}.`) };
            return { say, action: { type: a.type, amount: amt }, mood };
        }
        case 'open_borders':
        case 'make_peace':
            return { say, action: { type: a.type }, mood };
        case 'defer': {
            // 조약은 앱이 맺을 수 없다. "의원들과 논의한 뒤 서신으로 알린다"는 약속만 남긴다.
            const topic = typeof a.topic === 'string' ? a.topic.replace(/\s+/g, ' ').trim().slice(0, 30) : '';
            return { say, action: { type: 'defer', topic: topic || '조약 제안' }, mood };
        }
        case 'declare_war': {
            const reason = typeof a.reason === 'string' && a.reason in exports.WAR_REASONS ? a.reason : 'humiliation';
            return { say, action: { type: 'declare_war', reason }, mood };
        }
        default:
            return { say, action: null, mood, note: (0, i18n_pick_1.L)('알 수 없는 행동이라 무시했습니다: ', 'Unknown action, ignored: ') + String(a.type) };
    }
}
// 플레이어에게 보여 줄 제안 문구. give = AI 가 플레이어에게 준다, take = 플레이어가 AI 에게 준다.
function describe(a, aiName) {
    switch (a.type) {
        case 'give_energy': return (0, i18n_pick_1.L)(`${aiName}이(가) 에너지 ${a.amount}을(를) 제공하겠다고 합니다.`, `${aiName} offers ${a.amount} energy.`);
        case 'take_energy': return (0, i18n_pick_1.L)(`${aiName}이(가) 에너지 ${a.amount}을(를) 받기를 요청합니다(내 에너지가 줄어듭니다).`, `${aiName} asks to receive ${a.amount} energy (your energy will go down).`);
        case 'open_borders': return (0, i18n_pick_1.L)(`${aiName}이(가) 국경 제한을 풀겠다고 합니다.`, `${aiName} offers to open borders.`);
        case 'make_peace': return (0, i18n_pick_1.L)(`${aiName}이(가) 전쟁을 끝내자고 합니다(실험 기능).`, `${aiName} proposes to end the war (experimental).`);
        case 'defer': return (0, i18n_pick_1.L)(`${aiName}이(가) "${a.topic ?? '조약'}" 건을 논의한 뒤 서신으로 알리겠다고 합니다.`, `${aiName} will discuss "${a.topic ?? 'the treaty'}" and reply by letter.`);
        case 'declare_war': {
            const r = exports.WAR_REASONS[a.reason ?? 'humiliation'] ?? exports.WAR_REASONS.humiliation;
            return (0, i18n_pick_1.L)(`${aiName}이(가) 당신에게 선전포고하려 합니다(사유: ${r.ko})(실험 기능). 수락하면 전쟁이 시작됩니다.`, `${aiName} intends to declare war on you (reason: ${r.en}) (experimental). Accepting starts the war.`);
        }
    }
}
function outcomeOf(fields, kv) {
    if (fields.includes('stale'))
        return 'stale';
    if (fields.includes('dup'))
        return 'dup';
    if (kv.result === '1' || fields.includes('ok'))
        return 'ok';
    return 'fail';
}
// 지역화 파일에 쓸 수 있게 문장을 정리한다. 따옴표와 줄바꿈을 바꾸고, 게임이 ?로 깨뜨리는 특수 따옴표·줄임표도 바꾼다.
function locSafe(t) {
    return t
        .replace(/[\u201c\u201d\u201e\u201f]/g, '"').replace(/[\u2018\u2019\u201a\u201b]/g, "'")
        .replace(/[\u2026]/g, '...').replace(/[\u2013\u2014]/g, '-')
        .replace(/\\/g, '/').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\$/g, '');
}
//# sourceMappingURL=action.js.map
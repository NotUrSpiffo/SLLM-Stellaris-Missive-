"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallenText = exports.yearKey = void 0;
exports.fallenState = fallenState;
exports.fallenKind = fallenKind;
exports.fallenLines = fallenLines;
exports.answerChance = answerChance;
exports.hangupChance = hangupChance;
// 몰락한 제국·각성한 제국의 외교 통신(2026-10-19 사용자 결정).
// 1) 말투: 젊은 제국을 하등·미개한 존재, 아직 배워야 할 존재로 본다. 종류(가치관)에 따라 「보호해야 할 하등 생물」로 보기도 한다.
// 2) 각성: 여전히 미개하게 보지만, 깨어난 이유가 있어 늘 분노에 차 있다. 단호하고 철저하게 개미를 보는 시선.
// 3) 몰락(잠든) 상태: 일방적인 통신. 그들이 응할 때만 연결되고, 한 번 말을 주고받을 때마다 통신을 끊을 확률이 20%씩 오른다. 거절·끊음 뒤 그 해에는 다시 응하지 않는다.
// 순수 모듈(전자·파일 없음). 문구는 L(한, 영). AI 지시문은 영어(답 언어는 AiRouter 가 정함).
const i18n_pick_1 = require("./i18n-pick");
/** 국가 유형 키(GetCountryType) → 몰락/각성. 아니면 null. */
function fallenState(type) {
    const t = String(type || '').trim().toLowerCase();
    if (t === 'fallen_empire')
        return 'dormant';
    if (t === 'awakened_fallen_empire')
        return 'awakened';
    return null;
}
/** 몰락한 제국의 종류: 가치관 키가 먼저, 없으면 성향(personality) 이름(한/영)으로. */
function fallenKind(ethicIds, personality) {
    const ids = (ethicIds || []).map((x) => String(x).toLowerCase());
    const has = (k) => ids.some((x) => x.includes(k));
    if (has('xenophile'))
        return 'xenophile';
    if (has('materialist'))
        return 'materialist';
    if (has('spiritualist'))
        return 'spiritualist';
    if (has('xenophobe'))
        return 'xenophobe';
    const p = String(personality || '').toLowerCase();
    if (/observer|관찰/.test(p))
        return 'xenophile';
    if (/keeper|knowledge|지식/.test(p))
        return 'materialist';
    if (/holy|guardian|성스러운|수호/.test(p))
        return 'spiritualist';
    if (/isolation|militant|고립|호전/.test(p))
        return 'xenophobe';
    return 'unknown';
}
const VIEW = {
    xenophile: 'You are benevolent wardens: you see them as fragile lesser creatures under your protection, like small animals in a preserve. Your condescension is gentle and patronizing; you shield them, scold them and keep them from hurting themselves or one another.',
    materialist: 'You are keepers of knowledge: you see them as ignorant pupils who must still learn, toddlers playing with technology they do not understand. Lecture them, correct them, and warn them away from forbidden or dangerous science.',
    spiritualist: 'You are holy guardians: you see them as a lost, ignorant flock who know nothing of the sacred. Speak with serene, righteous condescension, as to children who must be kept away from holy worlds and taught reverence.',
    xenophobe: 'You are militant isolationists: you see them as lesser vermin. Your contempt is cold and full of disgust; you tolerate their existence only while they keep their distance from your borders.',
    unknown: 'See them as lesser beings who still have everything to learn.',
};
const WHY_AWAKE = {
    xenophile: 'the younger races have grown too reckless to be left unsupervised, and the wards must now be disciplined by force',
    materialist: 'the younger races reached for knowledge and technology they were never meant to touch',
    spiritualist: 'the younger races have desecrated what is sacred',
    xenophobe: 'the alien filth has spread too far and must be purged or driven back',
    unknown: 'the younger races crossed a line that should never have been crossed',
};
/** 대화 AI 지시 줄. final = 이번 답을 마지막으로 통신을 끊는다(몰락 상태). */
function fallenLines(state, kind, final = false) {
    const out = [];
    if (state === 'dormant') {
        out.push('You are a Fallen Empire: an ancient civilization of immense, near-godlike advancement that has slumbered in quiet decline for millennia. You regard the younger empires, including this one, as lesser, primitive beings who still have everything to learn. Never treat them as equals; speak down to them.');
        out.push(VIEW[kind]);
        out.push('This is a one-sided transmission, not a dialogue. You pronounce; you do not converse. Do not ask them questions, do not negotiate, do not explain yourself at length; dismiss whatever you judge beneath you. You only deigned to answer at all.');
        out.push('You do not trade, make deals, open borders, promise treaties or declare war in this channel. Use action type none.');
        if (final)
            out.push('This reply is your last: you are done with them. End with a curt, dismissive line that makes clear you are closing the channel.');
    }
    else {
        out.push('You are an Awakened Fallen Empire: an ancient, near-godlike civilization that has risen from its long slumber because ' + WHY_AWAKE[kind] + '. You still regard the younger empires as primitive lesser beings.');
        out.push(VIEW[kind]);
        out.push('Now you are always filled with wrath. Be curt, absolute and merciless: no warmth, no bargaining as equals, only verdicts and commands. Look at them the way one looks at ants.');
    }
    return out;
}
/** 몰락 상태가 통신에 응할 확률(0.1~0.85). 호감이 높을수록, 보호자형(외계인 친화)일수록 잘 응한다. 전쟁 중이면 0.1. */
function answerChance(score, kind, atWar = false) {
    if (atWar)
        return 0.1;
    const base = 0.35 + (Number(score) || 0) / 200 + (kind === 'xenophile' ? 0.15 : kind === 'xenophobe' ? -0.1 : 0);
    return Math.max(0.1, Math.min(0.85, base));
}
/** n 번째 주고받기(1부터)에서 이 답을 마지막으로 끊을 확률: 20%씩 늘어 5번째에 100%. */
function hangupChance(n) { return Math.max(0, Math.min(1, 0.2 * Math.max(1, Math.floor(n)))); }
/** 게임 날짜 'YYYY.MM.DD' → 해 열쇠 'YYYY'. 끊거나 거절한 해에는 다시 응하지 않는다(2026-10-19 사용자 결정). */
const yearKey = (date) => (/^(\d{3,4})\./.exec(String(date || '')) || [])[1] || '';
exports.yearKey = yearKey;
/** 화면 안내 문구. */
exports.fallenText = {
    refused: (name) => (0, i18n_pick_1.L)(`${name}은(는) 통신에 응하지 않았습니다. 하등한 존재의 부름에 답할 생각이 없는 듯합니다.`, `${name} did not answer the call. They seem to have no interest in answering lesser beings.`),
    refusedYear: (name) => (0, i18n_pick_1.L)(`${name}은(는) 올해에는 다시 응하지 않습니다. 내년에 다시 시도하세요.`, `${name} will not answer again this year. Try again next year.`),
    accepted: (name) => (0, i18n_pick_1.L)(`${name}이(가) 통신에 응했습니다. 몰락한 제국은 언제든 통신을 끊을 수 있습니다.`, `${name} answered the call. A fallen empire may cut the channel at any moment.`),
    hungUp: (name) => (0, i18n_pick_1.L)(`${name}이(가) 통신을 끊었습니다.`, `${name} closed the channel.`),
    closed: () => (0, i18n_pick_1.L)('통신이 끊겼습니다. 외교 단말기에서 다시 연결하세요(올해에는 응하지 않습니다).', 'The channel is closed. Reconnect from the diplomatic terminal (they will not answer again this year).'),
};
//# sourceMappingURL=fallen.js.map
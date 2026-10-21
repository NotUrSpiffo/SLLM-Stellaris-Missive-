"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanEpitaph = exports.chronLine = exports.colleagueMemo = exports.bondScore = exports.farewellWorthy = exports.emptyMemorial = exports.FAREWELL_TRUST = exports.FAREWELL_CAP = void 0;
exports.deathKind = deathKind;
exports.pickFarewells = pickFarewells;
exports.colleagues = colleagues;
exports.deeds = deeds;
exports.epitaphMessages = epitaphMessages;
const persona_1 = require("./persona");
const letters_1 = require("./letters");
const i18n_pick_1 = require("./i18n-pick");
const ROLE_EN = { ruler: 'Ruler', governor: 'Governor', admiral: 'Admiral', general: 'General', scientist: 'Scientist', commander: 'Commander', official: 'Official' };
exports.FAREWELL_CAP = 3;
exports.FAREWELL_TRUST = 20; // 호의 이상
const emptyMemorial = () => ({ stones: [], departed: [], queue: [] });
exports.emptyMemorial = emptyMemorial;
/** 사망 + 같은 달(또는 바로 전 달)에 그 지휘관의 전투 기록이 있으면 전사. */
function deathKind(battleDates, date) {
    const d = (0, letters_1.monthNo)(date);
    if (d === null)
        return 'death';
    return battleDates.some((b) => { const m = (0, letters_1.monthNo)(b); return m !== null && d - m >= 0 && d - m <= 1; }) ? 'fallen' : 'death';
}
/** 작별 편지를 받을 만큼 관계가 있었나. */
const farewellWorthy = (m, letters) => (m ? m.trust >= exports.FAREWELL_TRUST || m.talks > 0 : false) || letters > 0;
exports.farewellWorthy = farewellWorthy;
/** 관계 깊이(줄 세우기용): 신뢰 + 대화·편지 횟수. */
const bondScore = (m, letters) => (m ? m.trust + m.talks * 5 : 0) + letters * 5;
exports.bondScore = bondScore;
/** 이번 달 대기열에서 관계 깊은 순으로 cap 명만 작별 편지. 나머지는 편지 없이(추모관·떠난 사람들에는 그대로). */
function pickFarewells(q, cap = exports.FAREWELL_CAP) { return q.slice().sort((a, b) => b.score - a.score).slice(0, cap); }
/** 함께 일한 동료(같은 평의회, 또는 같은 직책에서 지도자와 이야기해 본 인물)에게 남길 기억 한 줄. */
function colleagues(dead, living, talked) {
    return living.filter((p) => p.key !== dead.key && ((dead.council && p.council) || (p.role === dead.role && talked(p.key)))).map((p) => p.key);
}
// 기억·연대기 문장은 기록할 때의 화면 언어로(2026-10-19).
const colleagueMemo = (name, why) => (why === 'fallen' ? (0, i18n_pick_1.L)(`동료 ${name}이(가) 전사했다`, `My colleague ${name} fell in battle`) : (0, i18n_pick_1.L)(`동료 ${name}이(가) 세상을 떠났다`, `My colleague ${name} passed away`));
exports.colleagueMemo = colleagueMemo;
/** 연대기 한 줄(신문 연감의 재료가 되어 부고처럼 실린다. '지도자 사망:'으로 시작하면 신문이 빼므로 쓰지 않는다). */
const chronLine = (s) => (0, i18n_pick_1.L)(`추모: ${persona_1.ROLE_KO[s.role] ?? '인물'} ${s.name} ${s.why === 'fallen' ? '전사' : '서거'} (${s.first || '?'} ~ ${s.gone})`, `In memoriam: ${ROLE_EN[s.role] ?? 'Leader'} ${s.name} ${s.why === 'fallen' ? 'fell in battle' : 'passed away'} (${s.first || '?'} – ${s.gone})`);
exports.chronLine = chronLine;
/** 비석의 "남긴 일" 줄(화면용 재료, 문장은 화면에서 번역 열쇠로 만든다). */
function deeds(s) {
    const out = [];
    if (s.planet)
        out.push({ k: 'planet', v: s.planet });
    if (s.fleet)
        out.push({ k: 'fleet', v: s.fleet });
    if (s.battles)
        out.push({ k: 'battles', v: s.battles });
    if (s.acclaimed)
        out.push({ k: 'acclaimed', v: 1 });
    if (s.council)
        out.push({ k: 'council', v: 1 });
    if (s.letters)
        out.push({ k: 'letters', v: s.letters });
    if (s.talks)
        out.push({ k: 'talks', v: s.talks });
    return out;
}
/** 비문 한 줄(처음 볼 때 한 번). */
function epitaphMessages(s, persona, traitNames, empire, gestalt = 0) {
    const facts = [
        `${ROLE_EN[s.role] ?? 'Leader'} ${s.name} of ${empire || 'the player empire'}`,
        `Served ${s.first || '?'} – ${s.gone}, ${s.why === 'fallen' ? 'fell in battle' : 'passed away'}`,
        s.lv ? `Skill level ${s.lv}` : '', traitNames.length ? `Traits: ${traitNames.join(', ')}` : '',
        s.planet ? `Governed planet ${s.planet}` : '', s.fleet ? `Commanded fleet ${s.fleet}` : '', s.battles ? `${s.battles} recorded battles` : '',
        s.acclaimed ? 'Acclaimed at a hearing' : '', s.council ? 'Council member' : '',
        persona ? `Personality and manner of speech: ${persona}` : '', `Relationship with the leader: ${(0, persona_1.trustLevel)(s.trust).en}`,
        s.mems.length ? `Memories: ${s.mems.join(' / ')}` : '',
        gestalt === 1 ? 'This empire is a machine intelligence: the subject was a unit of it, so prefer words like service, function and shutdown over personal feeling.' : gestalt === 2 ? 'This empire is a hive mind: the subject was a drone of the one consciousness, so speak of what the hive keeps of them rather than a personal life.' : gestalt === 3 ? 'This empire is a gestalt consciousness: the subject was part of one mind rather than an individual.' : '',
    ].filter(Boolean);
    return [
        { role: 'system', content: ['Write a one-line epitaph to engrave on a stone in a Stellaris empire\'s memorial. Let this person\'s life and character come through; dignified and understated.', 'Use only the given facts; do not invent anything. No lists of numbers. One sentence of about 40 characters (Korean) or 12 words.', 'Output only one JSON object: {"epitaph":"..."}'].join('\n') },
        { role: 'user', content: facts.join('\n') },
    ];
}
const cleanEpitaph = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().replace(/^["“「]+|["”」]+$/g, '').trim().slice(0, 80);
exports.cleanEpitaph = cleanEpitaph;
//# sourceMappingURL=memorial.js.map
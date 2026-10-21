"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeEnough = exports.annivText = exports.ANNIV = exports.monthKey = exports.MAX_LIKES = exports.NUDGE_CHANCE = exports.lifeOf = exports.emptyLife = void 0;
exports.anniversaries = anniversaries;
exports.markAnniv = markAnniv;
exports.annivNote = annivNote;
exports.nudgeDecision = nudgeDecision;
exports.nudgeMessages = nudgeMessages;
const secretary_1 = require("./secretary");
const secretary_events_1 = require("./secretary-events");
const emptyLife = () => ({ annivSeen: {}, nudge: null, nudgeAt: '' });
exports.emptyLife = emptyLife;
const lifeOf = (s) => { const l = (s.life ??= (0, exports.emptyLife)()); l.annivSeen ??= {}; l.nudge ??= null; l.nudgeAt ??= ''; return l; };
exports.lifeOf = lifeOf;
exports.NUDGE_CHANCE = 0.4, exports.MAX_LIKES = 8;
const ym = (date) => { const m = /^(\d{3,5})\.(\d{1,2})/.exec(String(date || '').trim()); return m ? [Number(m[1]), Number(m[2])] : null; };
/** "2245.3.01" → "2245.03" (못 읽으면 ''). */
const monthKey = (date) => { const v = ym(date); return v ? `${v[0]}.${String(v[1]).padStart(2, '0')}` : ''; };
exports.monthKey = monthKey;
exports.ANNIV = {
    since: ['지금 통치자와 처음 만난 지 {n}년', '{n} year(s) since you first met'],
    lover: ['연인이 된 지 {n}년', '{n} year(s) since you became lovers'],
    spouse: ['결혼한 지 {n}년', '{n} year(s) since your wedding'],
};
const annivText = (a, en = false) => exports.ANNIV[a.kind][en ? 1 : 0].replace('{n}', String(a.years));
exports.annivText = annivText;
/** 이번 달이 기념일인지(지금 통치자, 1년 이상, 올해 아직 안 챙김). 연애 꺼짐이면 처음 만난 날만. */
function anniversaries(s, b, romance, date) {
    const now = ym(date);
    if (!b || !now)
        return [];
    const l = (0, exports.lifeOf)(s);
    const out = [];
    const add = (kind, from) => {
        const f = from ? ym(from) : null;
        if (!f || f[1] !== now[1] || now[0] - f[0] < 1)
            return;
        const key = `${kind}:${b.key}`;
        if (l.annivSeen[key] === now[0])
            return;
        out.push({ key, kind, years: now[0] - f[0], from: from });
    };
    add('since', b.since);
    if (romance) {
        add('lover', b.loverAt);
        add('spouse', b.spouseAt);
    }
    return out;
}
/** 기념일을 챙겼다(첫 마디에서 말했다). */
function markAnniv(s, list, date) { const now = ym(date); if (!now)
    return; const l = (0, exports.lifeOf)(s); for (const a of list)
    l.annivSeen[a.key] = now[0]; }
function annivNote(list) {
    if (!list.length)
        return '';
    return `[Anniversary] This month marks ${list.map((a) => (0, exports.annivText)(a, true)).join(', ')}. In your first line, before the work report, briefly mark it in your own way (a small congratulation or a sentence or two of feeling).`;
}
/** 먼저 쪽지를 남길 만큼 가까운 사이인지(연애 켬: 호감 신뢰 단계, 끔: 업무 신뢰 40). */
const closeEnough = (s, b, romance) => (romance ? (b?.aff ?? 0) >= secretary_1.AFF_TRUST : s.trust >= 40);
exports.closeEnough = closeEnough;
/** 이번 달 쪽지를 남길지(한 달에 한 번만 굴린다 — 굴렸으면 앱이 nudgeAt 을 이번 달로 적는다). 기념일이면 꼭. */
function nudgeDecision(s, b, romance, date, rand = Math.random) {
    const month = (0, exports.monthKey)(date);
    if (!s.name || !b || !month)
        return null;
    const l = (0, exports.lifeOf)(s);
    if (l.nudgeAt === month)
        return null;
    const anniv = anniversaries(s, b, romance, date);
    if (anniv.length)
        return { kind: 'anniv', anniv };
    if ((0, exports.closeEnough)(s, b, romance) && rand() < exports.NUDGE_CHANCE)
        return { kind: 'note', anniv: [] };
    return null;
}
/** 쪽지 한 장(1~2문장). 업무 보고가 아니라 사적인 한마디. */
function nudgeMessages(a) {
    const { s, bond, romance, c } = a;
    const stage = (0, secretary_1.bondStage)(bond);
    const e = (0, secretary_events_1.evOf)(s);
    const recent = e.recall.filter((r) => r.ruler === bond.key).slice(-2).map((r) => { const d = (0, secretary_events_1.evDef)(r.id); const cs = (0, secretary_events_1.recallChoices)(r).map((x) => x.intent); return `- ${r.date} "${d ? d.title[1] : r.id}"${cs.length ? ': the ruler ' + cs.join(' → ') : ''}`; });
    const mood = (0, secretary_events_1.activeMood)(s, bond.key, c.date);
    const sys = [
        `You are "${s.name || 'Secretary'}", an android secretary built in secret by the Stellaris empire "${c.empire || 'the player empire'}". The current ruler is ${c.ruler || 'unknown'}, date ${c.date || 'unknown'}.`,
        '[Personality] Precise, composed, with a touch of dry wit. Still learning emotions, so awkward at expressing them but sincere. She addresses the ruler with a respectful honorific (like "Your Excellency").',
        romance ? `[Relationship] ${secretary_1.BOND_EN[stage]} (affection ${bond.aff}/100). ${secretary_1.STAGE_GUIDE[stage]}` : '[Relationship] Romance is off: a polite professional relationship. No expressions of affection.',
        bond.mems.length ? `[Shared memories]\n${bond.mems.slice(-4).map((m) => `- ${m.date} ${m.text}`).join('\n')}` : '',
        recent.length ? `[Recent events together]\n${recent.join('\n')}` : '',
        (0, secretary_1.likesBlock)(bond),
        mood ? `[Current mood] The afterglow of something you shared recently (${mood.tone === 'warm' ? 'tenderness' : mood.tone === 'cool' ? 'hurt' : 'calm'}) still lingers.` : '',
        `[State of the empire (reference only)]\n${c.facts.slice(0, 4).map((f) => '- ' + f).join('\n')}`,
        a.kind === 'anniv'
            ? `[Situation] This month marks ${a.anniv.map((x) => (0, exports.annivText)(x, true)).join(', ')}. Before the ruler enters the office, you remember it and leave a short note on the desk.`
            : '[Situation] Before the ruler enters the office, you leave a short note on the desk. Not a work report but a personal word (one of: asking after them, a worry, small thanks, recalling something you shared, looking after the ruler\'s tastes).',
        'The note is 1-2 sentences in her own handwriting voice. Do not invent game numbers, and do not write work orders or reports. Content limit: up to flutters and expressions of affection.',
        (0, secretary_1.POSE_RULE)(),
        'Output one JSON object only: {"pose":"smile","reply":"..."}',
    ].filter(Boolean).join('\n');
    return [{ role: 'system', content: sys }, { role: 'user', content: '[Write the note]' }];
}
//# sourceMappingURL=secretary-life.js.map
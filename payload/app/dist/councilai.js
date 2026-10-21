"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLIP_AT = exports.MAX_SHIFT = void 0;
exports.debateMessages = debateMessages;
exports.parseDebate = parseDebate;
exports.applyShift = applyShift;
exports.similarText = similarText;
exports.withDeltas = withDeltas;
const SN = { f: 'for', a: 'against', u: 'abstain' };
const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
exports.MAX_SHIFT = 10;
exports.FLIP_AT = 25; // 입장 점수가 ±25를 넘으면 찬성/반대, 그 사이는 기권
// 프롬프트는 영어(2026-10-19 사용자 결정). 답의 언어는 AiRouter 가 붙이는 응답 언어 지시를 따른다.
function debateMessages(r) {
    const firmWord = (f) => (f >= 0.75 ? 'very stubborn' : f >= 0.45 ? 'moderate' : 'flexible');
    const want = r.dir === 'f' ? 'FOR' : 'AGAINST';
    const sys = [
        'You are the scene writer for a Galactic Community (council) session in the space strategy game "Stellaris". In response to the player empire delegate\'s speech, each AI empire delegate who has the floor answers in one or two sentences, true to their own character.',
        'Rules:',
        '- Each delegate speaks in a voice that fits their empire\'s ethics, government, species and relationship with the player. They must not all sound the same.',
        '- Actively use the empire description, origin, attitude and role in this resolution (proposer/target). A proposer defends its own resolution; a target reacts fiercely if it is harmed. Hostile or angry empires do not take the player\'s words kindly; friendly empires are more open.',
        '- Do not invent effects that are not in the resolution. Base everything only on the supplied description.',
        `- The player is trying to persuade the delegates to vote ${want}. Rate for each delegate how well that persuasion worked as shift (integer, -${exports.MAX_SHIFT} to +${exports.MAX_SHIFT}). + means their mind moved toward what the player wants (${want}); - means resentment.`,
        '  · Most values are 0–3. Use 4–7 only for a concrete argument that precisely fits that empire\'s ethics and interests, and 8–10 only for a truly decisive argument.',
        '  · Empty words, purely emotional appeals, pressure and repeating an earlier argument are 0. Threats, proposals against that empire\'s national interest and insults are negative (resentment).',
        '  · The more strongly an empire already leans, or the more stubborn it is, the smaller the value.',
        '- The app calculates the position score. In the dialogue, do not announce a reversal; express only as much wavering, deliberation or conditional openness as the shift size warrants. If they hold firm, they push back with reasons.',
        '- reason is a very short summary (about 5 words) of why you rated it that way (e.g. "agrees with the security case", "argument repeated", "resents the threat").',
        '- Each answer is 1–2 sentences, at most about 90 characters (the response language follows the language instruction below). Dialogue only, no stage directions or quotation marks. Each line must have a clearly different voice and concern (military powers talk security, commercial empires profit, peaceful empires cooperation, authoritarian empires hierarchy and order). No repeated sentences or empty agreement; respond specifically to what the player said, rebutting or agreeing from their own position.',
        'Answer with a single JSON object only: {"replies":[{"id":number,"text":"dialogue","shift":integer,"reason":"reason"}]}  Give exactly one reply for every supplied id.',
    ].join('\n');
    const sp = r.speakers
        .map((s) => `- id ${s.id}: ${s.name} / currently ${SN[s.stance]} (position score ${Math.round(s.score)}; within ±${exports.FLIP_AT} means abstain) / stubbornness ${firmWord(s.firm)} / ethics ${s.personality || '?'} / government ${s.gov || '?'} / species ${s.species || '?'} / relationship with the player ${s.rel || 'nothing notable'} / weight ${s.weight.toFixed(1)}K${s.origin ? ' / origin ' + s.origin : ''}${s.ruler ? ' / ruler ' + s.ruler : ''}${s.att ? ' / attitude toward the player ' + s.att : ''}${s.role ? ' / role in this resolution ' + s.role : ''}${s.notes && s.notes.length ? '\n   earlier shifts of opinion: ' + s.notes.join(' → ') : ''}${s.lore ? '\n   empire description: ' + clip(s.lore, 220) : ''}`)
        .join('\n');
    const user = [
        `Resolution: ${r.title}${r.proposer ? ` (proposer: ${r.proposer}${r.target ? ', target: ' + r.target : ''})` : ''}`,
        r.desc ? `Resolution description: ${clip(r.desc, 700)}` : '',
        `Player empire: ${r.player || 'Player'} — persuading the council to vote ${want} on this resolution`,
        `Current tally (weight %): for ${Math.round(r.tally.f)} / against ${Math.round(r.tally.a)} / abstain ${Math.round(r.tally.u)}`,
        r.history.length ? `Earlier speeches:\n${r.history.slice(-8).join('\n')}` : '',
        `This player speech (to the whole council): ${clip(r.text, 400)}`,
        r.repeat ? 'NOTE: This speech repeats an earlier argument. There is no new argument, so rate shift at 0 or below.' : '',
        `Delegates who answer:\n${sp}`,
    ].filter(Boolean).join('\n');
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
function parseDebate(raw, allowed) {
    const ok = new Set(allowed), seen = new Set(), out = [];
    const push = (x) => {
        if (!x || typeof x !== 'object')
            return;
        const id = Number(x.id ?? x.idx ?? x.speaker), tv = x.text ?? x.say ?? x.reply ?? x.line ?? x.speech;
        const text = typeof tv === 'string' ? tv.replace(/\s+/g, ' ').trim() : '';
        if (!ok.has(id) || seen.has(id) || !text)
            return;
        const sh = Number(x.shift ?? x.strength ?? x.persuasion ?? 0);
        const shift = Number.isFinite(sh) ? Math.max(-exports.MAX_SHIFT, Math.min(exports.MAX_SHIFT, Math.round(sh))) : 0; // 못 읽으면 0(입장 유지)
        const rv = x.reason ?? x.why;
        seen.add(id);
        out.push({ id, text: clip(text, 160), shift, reason: typeof rv === 'string' ? clip(rv.replace(/\s+/g, ' ').trim(), 40) : '' });
    };
    const cleaned = raw.replace(/ …\(잘림\)\s*$/, '').replace(/^```(?:json)?\s*|\s*```$/g, '');
    let obj = null;
    try {
        obj = JSON.parse(cleaned);
    }
    catch {
        const m = /[\[{][\s\S]*[\]}]/.exec(cleaned);
        if (m) {
            try {
                obj = JSON.parse(m[0]);
            }
            catch {
                obj = null;
            }
        }
    }
    const list = Array.isArray(obj) ? obj : Array.isArray(obj?.replies) ? obj.replies : Array.isArray(obj?.responses) ? obj.responses : [];
    list.forEach(push);
    if (!out.length) { // 잘렸거나 깨진 JSON: 객체 조각을 하나씩 건진다
        for (const m of cleaned.matchAll(/\{[^{}]*\}/g)) {
            try {
                push(JSON.parse(m[0]));
            }
            catch { /* 건너뜀 */ }
        }
    }
    return out;
}
/**
 * AI가 매긴 shift(플레이어가 원하는 쪽이 +)를 실제 입장 점수 변화로 바꾼다. 한 차례 최대 ±MAX_SHIFT.
 * - 완고한 제국은 폭이 줄고, 이미 반대편으로 강하게 기운 제국(|점수|>=60)은 더 움직이기 어렵다.
 * - 같은 주장을 반복하면 긍정 효과는 거의 사라진다(반감은 그대로).
 * dir: +1 찬성 설득, -1 반대 설득. 돌려주는 값은 더해질 점수(부호 포함).
 */
function applyShift(score, shift, dir, firm, repeat) {
    let e = Math.max(-exports.MAX_SHIFT, Math.min(exports.MAX_SHIFT, shift));
    const f = Math.max(0, Math.min(1, firm));
    if (e > 0) {
        e *= 1 - 0.6 * f;
        if (Math.sign(score) === -dir && Math.abs(score) >= 60)
            e *= 0.5;
        if (repeat)
            e *= 0.25;
    }
    else if (e < 0 && repeat)
        e *= 1; // 반감은 줄이지 않는다
    e = Math.max(-exports.MAX_SHIFT, Math.min(exports.MAX_SHIFT, e));
    return Math.round(e * dir * 10) / 10;
}
/** 두 발언이 사실상 같은 주장인가: 글자 2-gram 자카드 유사도. */
function similarText(a, b) {
    const g = (s) => { const t = s.replace(/\s+/g, ''); const set = new Set(); for (let i = 0; i < t.length - 1; i++)
        set.add(t.slice(i, i + 2)); return set; };
    const A = g(a), B = g(b);
    if (!A.size || !B.size)
        return 0;
    let n = 0;
    A.forEach((x) => { if (B.has(x))
        n++; });
    return n / (A.size + B.size - n);
}
/** 답변마다 실제로 더할 점수(delta)를 붙인다. 설득 계산은 여기 한 곳에서만 한다(F-10: 회의 창은 결과만 받는다). */
function withDeltas(replies, speakers, dir, repeat) {
    const by = new Map(speakers.map((s) => [s.id, s]));
    return replies.map((r) => { const s = by.get(r.id); return { ...r, delta: s ? applyShift(s.score, Number(r.shift) || 0, dir === 'a' ? -1 : 1, s.firm, repeat) : 0 }; });
}
//# sourceMappingURL=councilai.js.map
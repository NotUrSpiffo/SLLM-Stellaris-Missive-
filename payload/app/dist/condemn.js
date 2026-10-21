"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANCE_EN = exports.STANCE_KO = void 0;
exports.voiceScore = voiceScore;
exports.stanceOf = stanceOf;
exports.galcomStance = galcomStance;
exports.pickSpeakers = pickSpeakers;
exports.countStances = countStances;
exports.reactionMessages = reactionMessages;
exports.parseReactions = parseReactions;
exports.stanceStep = stanceStep;
exports.sanitizeCondemn = sanitizeCondemn;
exports.voiceFromKv = voiceFromKv;
exports.countsLine = countsLine;
exports.parseForeignWar = parseForeignWar;
exports.advisorStance = advisorStance;
exports.foreignWorthNotice = foreignWorthNotice;
exports.ourStatementSteps = ourStatementSteps;
exports.ourPastStanceOn = ourPastStanceOn;
const warinfo_1 = require("./warinfo");
const music_1 = require("./music");
exports.STANCE_KO = { condemn: '규탄', concern: '우려 표명', silent: '침묵', support: '지지' };
exports.STANCE_EN = { condemn: 'Condemnation', concern: 'Expression of concern', silent: 'Silence', support: 'Support' };
const has = (ethics, k) => ethics.some((e) => e.toLowerCase().replace(/^ethic_/, '').replace(/^fanatic_/, '') === k);
const fanatic = (ethics, k) => ethics.some((e) => /fanatic_/i.test(e) && e.toLowerCase().replace(/^ethic_/, '').replace(/^fanatic_/, '') === k);
/** 한 제국의 점수: 양수 = 지지 쪽, 음수 = 규탄 쪽. 우리가 공격 측일 때 기준(방어 측이면 부호를 뒤집고 침략성은 상대 것). */
function voiceScore(v, w, ourSideIsAttacker) {
    const ag = (0, warinfo_1.warAggression)(w), e = v.ethics;
    let s = 0;
    // 관계가 가장 크다
    if (v.flags.subject)
        s += 40;
    if (v.flags.overlord)
        s += 25;
    if (v.flags.fed)
        s += 35;
    if (v.flags.ally)
        s += 25;
    if (v.flags.enemySubject)
        s -= 40;
    if (v.flags.enemyFed)
        s -= 35;
    if (v.flags.enemyAlly)
        s -= 25;
    if (v.flags.rival)
        s -= 20;
    if (v.flags.enemyRival)
        s += 15;
    if (v.flags.war)
        s -= 30;
    if (v.flags.weCondemned)
        s -= 12;
    if (v.flags.weSupported)
        s += 12; // 되갚음: 예전에 우리가 낸 성명을 기억한다
    // 호감(-1000..1000 → -20..20)
    s += Math.max(-20, Math.min(20, v.opinion / 50));
    // 가치관 × 명분
    const inv = ourSideIsAttacker ? 1 : -1; // 방어 측이면 침략자는 상대 → 침략성이 높을수록 우리 지지
    const agg = ag * (ourSideIsAttacker ? -1 : 1) * 8; // 공격자 기준: 정복 -16, 정화 -24; 방어자 기준: +
    s += agg;
    if (warinfo_1.GOAL_INFO[w.attGoal]?.kind === 'purge')
        s += ourSideIsAttacker ? -12 : 12; // 잔혹 행위(정화·동화·흡수·콜로서스)는 동맹도 감싸기 어렵다
    if (has(e, 'pacifist'))
        s += (ourSideIsAttacker ? -1 : 0.5) * (fanatic(e, 'pacifist') ? 22 : 14);
    if (has(e, 'militarist'))
        s += ourSideIsAttacker ? (fanatic(e, 'militarist') ? 8 : 5) : 0;
    if (has(e, 'egalitarian') && w.attGoal === 'wg_independence')
        s += 18 * (w.side === 'att' ? 1 : -1) * inv; // 독립 전쟁: 평등주의는 독립 쪽
    if (has(e, 'authoritarian') && (w.rel === 1 || w.rel === 2))
        s += 18 * (w.rel === 1 ? 1 : -1) * (w.side === 'att' ? 1 : -1); // 권위주의는 종주국 쪽
    if (has(e, 'egalitarian') && w.attGoal === 'wg_force_ideology' && ourSideIsAttacker)
        s += 10; // 해방전은 평등주의가 호의적
    if (has(e, 'xenophobe'))
        s *= 0.4; // 외계인 혐오: 남의 일에 덜 관여(점수 줄여 침묵 쪽으로)
    if (has(e, 'spiritualist') && ['wg_cleansing', 'wg_colossus', 'wg_blaze'].includes(w.attGoal))
        s += ourSideIsAttacker ? -12 : 12;
    if (has(e, 'xenophile') && ag >= 3)
        s += ourSideIsAttacker ? -12 : 12;
    return Math.round(s);
}
function stanceOf(score) { return score <= -22 ? 'condemn' : score <= -8 ? 'concern' : score >= 18 ? 'support' : 'silent'; }
/** 은하 공동체 입장: 회원국 점수 평균(비회원 제외). 회원이 3개 미만이면 없음. 우리가 회원이 아니어도 낸다. */
function galcomStance(voices, w, ourSideIsAttacker) {
    const m = voices.filter((v) => v.flags.galcom);
    if (m.length < 3)
        return null;
    const avg = m.reduce((a, v) => a + voiceScore(v, w, ourSideIsAttacker), 0) / m.length;
    return { stance: stanceOf(avg - (ourSideIsAttacker ? 6 : 0)), score: Math.round(avg) }; // 공동체는 침략에 조금 더 엄격
}
/** 성명을 낼 제국 고르기: 점수 절댓값이 큰 순으로 최대 max 개(침묵은 뺀다). 나머지는 숫자로만 집계. */
function pickSpeakers(voices, w, ourSideIsAttacker, max = 4) {
    return voices.map((v) => { const score = voiceScore(v, w, ourSideIsAttacker); return { v, score, stance: stanceOf(score) }; })
        .filter((x) => x.stance !== 'silent').sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, max);
}
function countStances(voices, w, ourSideIsAttacker) {
    const c = { condemn: 0, concern: 0, silent: 0, support: 0 };
    for (const v of voices)
        c[stanceOf(voiceScore(v, w, ourSideIsAttacker))]++;
    return c;
}
/** AI 요청: 여러 제국의 성명을 한 번에(JSON 배열). 각 제국은 정해진 입장에 맞는 1~2문장만. */
function reactionMessages(player, w, speakers, galcom, declaration) {
    const sys = 'You write short diplomatic statements issued by space empires in the game Stellaris in reaction to a war. '
        + 'Each statement is 1-2 sentences in the voice of that empire\'s government, matching the STANCE given for it exactly (condemn = sharp denunciation; concern = measured worry, calls for restraint; support = approval or solidarity). '
        + 'If an empire "remembers" something the player did, it may throw it back at the player in its statement. Refer to the actual cause of the war. ORIGINAL text only, never quote real-world statements. Output ONLY JSON: {"galcom":"statement or empty string","items":[{"name":"empire name","text":"statement"}]}.';
    const lines = [`Player empire: ${player.slice(0, 80)}`, `War: ${w.war.slice(0, 120)} — attacker ${w.attacker.slice(0, 80)}, defender ${w.defender.slice(0, 80)}; the player is the ${w.side === 'att' ? 'attacker' : 'defender'}.`, 'Cause: ' + (0, warinfo_1.describeWar)(w, 'en').slice(0, 400)];
    if (declaration)
        lines.push('Excerpt of the player\'s declaration: "' + declaration.replace(/\s+/g, ' ').slice(0, 300) + '"');
    if (galcom)
        lines.push(`Galactic Community statement — STANCE: ${galcom}`);
    for (const s of speakers)
        lines.push(`${s.name.slice(0, 80)} — STANCE: ${s.stance}${s.ethics.length ? ' — ethics: ' + s.ethics.slice(0, 4).join(', ') : ''}${s.memory ? ' — remembers: ' + s.memory.slice(0, 200) : ''}`);
    return [{ role: 'system', content: sys }, { role: 'user', content: lines.join('\n') }];
}
function parseReactions(raw) {
    const s = typeof raw === 'string' ? raw : '';
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a)
        return null;
    try {
        const j = JSON.parse(s.slice(a, b + 1));
        const items = Array.isArray(j.items) ? j.items.map((x) => { const o = (x && typeof x === 'object' ? x : {}); return { name: (0, music_1.cleanTitle)(o.name), text: typeof o.text === 'string' ? o.text.replace(/\s+/g, ' ').trim().slice(0, 400) : '' }; }).filter((x) => x.name && x.text) : [];
        return { galcom: typeof j.galcom === 'string' ? j.galcom.replace(/\s+/g, ' ').trim().slice(0, 400) : '', items };
    }
    catch {
        return null;
    }
}
/** 호감 적용 단계(모드 sllm_probe_opinion_shift STEP: 1 warm small · 2 warm large · 3 cold small · 4 cold large). 침묵·우려는 적용 없음. */
function stanceStep(st) { return st === 'condemn' ? 3 : st === 'support' ? 1 : 0; }
function sanitizeCondemn(v) {
    const o = (v && typeof v === 'object' ? v : {}), saves = {};
    const st = (x) => (x === 'condemn' || x === 'concern' || x === 'support' ? x : 'silent');
    if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves))
        for (const [sid, list] of Object.entries(o.saves).slice(0, 500)) {
            if (!Array.isArray(list))
                continue;
            const out = [];
            for (const d of list.slice(-30)) {
                if (!d || typeof d !== 'object')
                    continue;
                const x = d;
                if (typeof x.war !== 'string' || !x.war)
                    continue;
                const g = x.galcom && typeof x.galcom === 'object' ? x.galcom : null;
                const ag = Number(x.aggression);
                out.push({ war: x.war.slice(0, 120), date: typeof x.date === 'string' ? x.date.slice(0, 20) : '', side: x.side === 'def' ? 'def' : 'att', aggression: (ag >= 0 && ag <= 3 ? Math.round(ag) : 1),
                    galcom: g ? { stance: st(g.stance), score: Number(g.score) || 0, text: typeof g.text === 'string' ? g.text.slice(0, 400) : '' } : null,
                    reactions: Array.isArray(x.reactions) ? x.reactions.slice(0, 8).map((r) => { const q = (r && typeof r === 'object' ? r : {}); return { idx: Number(q.idx) || 0, name: typeof q.name === 'string' ? q.name.slice(0, 80) : '', stance: st(q.stance), score: Number(q.score) || 0, text: typeof q.text === 'string' ? q.text.slice(0, 400) : '' }; }).filter((r) => r.name) : [],
                    counts: { condemn: Number(x.counts?.condemn) || 0, concern: Number(x.counts?.concern) || 0, silent: Number(x.counts?.silent) || 0, support: Number(x.counts?.support) || 0 } });
            }
            if (out.length)
                saves[sid.slice(0, 60)] = out;
        }
    const ours = {};
    if (o.ours && typeof o.ours === 'object' && !Array.isArray(o.ours))
        for (const [sid, list] of Object.entries(o.ours).slice(0, 500)) {
            if (!Array.isArray(list))
                continue;
            const out = list.slice(-40).map((d) => {
                const x = (d && typeof d === 'object' ? d : {});
                const t = (k, n) => (typeof x[k] === 'string' ? x[k].slice(0, n) : '');
                const n = (k) => (Number.isSafeInteger(Number(x[k])) && Number(x[k]) > 0 ? Number(x[k]) : 0);
                return { war: t('war', 120), date: t('date', 20), attacker: t('attacker', 80), defender: t('defender', 80), ai: n('ai'), di: n('di'), goal: t('goal', 60), stance: st(x.stance), text: t('text', 600) };
            }).filter((x) => x.war && x.stance !== 'silent');
            if (out.length)
                ours[sid.slice(0, 60)] = out;
        }
    return { applyOpinion: typeof o.applyOpinion === 'boolean' ? o.applyOpinion : true, foreignNotify: typeof o.foreignNotify === 'boolean' ? o.foreignNotify : true, saves, ours };
}
/** 알림 한 줄: "규탄 3 · 우려 2 · 지지 1 (침묵 9)". */
/** 모드 WARVOICE 한 줄 → Voice(가치관·호감은 앱이 따로 채운다). */
function voiceFromKv(kv, attackerIsUs) {
    const idx = Number(kv.idx);
    if (!Number.isSafeInteger(idx) || idx <= 0 || !kv.name)
        return null;
    const b = (k) => kv[k] === '1';
    const us = attackerIsUs ? { fed: b('fa'), subject: b('sa'), rival: b('ra'), ally: b('da') } : { fed: b('fd'), subject: b('sd'), rival: b('rd'), ally: b('dd') };
    const them = attackerIsUs ? { fed: b('fd'), subject: b('sd'), rival: b('rd'), ally: b('dd') } : { fed: b('fa'), subject: b('sa'), rival: b('ra'), ally: b('da') };
    return { idx, name: String(kv.name).slice(0, 80), flags: { galcom: b('gc'), fed: us.fed, subject: us.subject, rival: us.rival, ally: us.ally, enemyFed: them.fed, enemySubject: them.subject, enemyRival: them.rival, enemyAlly: them.ally, war: b('w') } };
}
function countsLine(c, ko) {
    const k = ko ? exports.STANCE_KO : exports.STANCE_EN;
    const parts = ['condemn', 'concern', 'support'].filter((s) => c[s]).map((s) => `${k[s]} ${c[s]}`);
    return (parts.length ? parts.join(' · ') : (ko ? '성명 없음' : 'No statements')) + (c.silent ? ` (${k.silent} ${c.silent})` : '');
}
function parseForeignWar(kv, parse) {
    const w = parse({ ...kv, side: 'att' });
    if (!w)
        return null;
    const n = (k) => { const v = Number(kv[k]); return Number.isSafeInteger(v) && v > 0 ? v : 0; }, b = (k) => kv[k] === '1';
    return { ...w, ai: n('ai'), di: n('di'), rel2: { fedA: b('pfa'), fedD: b('pfd'), subA: b('psa'), subD: b('psd'), rivA: b('pra'), rivD: b('prd'), pactA: b('pda'), pactD: b('pdd') } };
}
/** 자문관 권고: 우리 가치관·관계로 본 공격국에 대한 자연스러운 입장(voiceScore 를 우리 시점으로). */
function advisorStance(f, ourEthics, opinionOfAttacker = 0) {
    const v = { idx: 0, name: '', opinion: opinionOfAttacker, ethics: ourEthics, flags: { fed: f.rel2.fedA, subject: f.rel2.subA, rival: f.rel2.rivA, ally: f.rel2.pactA, enemyFed: f.rel2.fedD, enemySubject: f.rel2.subD, enemyRival: f.rel2.rivD, enemyAlly: f.rel2.pactD } };
    const score = voiceScore(v, f, true);
    return { stance: stanceOf(score), score };
}
/** 알림을 띄울 만한 전쟁인가: 침략성 2 이상이거나 우리와 관계가 있는 나라가 낀 전쟁. 나머지는 조용히 연대기에만. */
function foreignWorthNotice(f) {
    const r = f.rel2;
    return (0, warinfo_1.warAggression)(f) >= 2 || r.fedA || r.fedD || r.subA || r.subD || r.rivA || r.rivD || r.pactA || r.pactD;
}
/** 우리 성명이 두 나라에 주는 호감 단계 [공격국, 방어국]: 규탄 → 공격국 cold small(3)·방어국 warm small(1), 지지 → 반대, 우려·침묵 → 없음. */
function ourStatementSteps(st) { return st === 'condemn' ? [3, 1] : st === 'support' ? [1, 3] : [0, 0]; }
/** 되갚음: 이 제국(idx)이 연 전쟁에 우리가 냈던 성명 중 가장 최근 것. */
function ourPastStanceOn(list, idx) {
    for (const s of (list ?? []).slice().reverse())
        if (s.ai === idx)
            return s;
    return null;
}
//# sourceMappingURL=condemn.js.map
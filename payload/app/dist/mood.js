"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOOD_SERIES_MAX = exports.MOOD_TUNE = exports.MOOD_EN = exports.MOOD_KO = void 0;
exports.moodLevel = moodLevel;
exports.computeMood = computeMood;
exports.pushMood = pushMood;
exports.moodTrend = moodTrend;
exports.moodAlert = moodAlert;
exports.moodPromptLine = moodPromptLine;
exports.sanitizeMood = sanitizeMood;
exports.activeAdj = activeAdj;
exports.MOOD_KO = { jubilant: '열광', content: '만족', steady: '보통', discontent: '불만', unrest: '분노' };
exports.MOOD_EN = { jubilant: 'Jubilant', content: 'Content', steady: 'Steady', discontent: 'Discontent', unrest: 'Unrest' };
exports.MOOD_TUNE = { wStab: 0.55, wApp: 0.45, warMax: 20, unrestMax: 15, adjMax: 15 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function moodLevel(score) { return score >= 75 ? 'jubilant' : score >= 60 ? 'content' : score >= 45 ? 'steady' : score >= 30 ? 'discontent' : 'unrest'; }
/** 점수: 안정도 평균(0~100)과 파벌 승인도(지지율 가중 평균, 0~100)를 섞고, 전쟁 피로도·불안 행성 비율로 깎는다.
 *  eventAdj = 최근 사건(비방 기사 반박 실패 등)의 일시 조정(−15~+15). 재료가 하나도 없으면 null. */
function computeMood(s, eventAdj = 0) {
    const m = s.mood, stab = m && m.cnt > 0 ? clamp(m.sum / m.cnt, 0, 100) : null;
    const fs = s.gestalt ? [] : (s.factions ?? []).filter((f) => f.support > 0);
    const tot = fs.reduce((a, f) => a + f.support, 0);
    const app = tot > 0 ? clamp((fs.reduce((a, f) => a + f.approval * f.support, 0) / tot) * 100, 0, 100) : null;
    if (stab === null && app === null)
        return null;
    const base = stab !== null && app !== null ? stab * exports.MOOD_TUNE.wStab + app * exports.MOOD_TUNE.wApp : (stab ?? app);
    const ex = m ? Math.max(m.ox, m.dx) : 0, warPenalty = Math.round(clamp(ex, 0, 1) * exports.MOOD_TUNE.warMax);
    const unrestPenalty = m && m.cnt > 0 ? Math.round(clamp(m.low / m.cnt, 0, 1) * exports.MOOD_TUNE.unrestMax) : 0;
    const adj = clamp(Math.round(eventAdj), -exports.MOOD_TUNE.adjMax, exports.MOOD_TUNE.adjMax);
    const score = Math.round(clamp(base - warPenalty - unrestPenalty + adj, 0, 100));
    return { score, level: moodLevel(score), parts: { stability: stab === null ? null : Math.round(stab), approval: app === null ? null : Math.round(app), warPenalty, unrestPenalty, eventAdj: adj } };
}
exports.MOOD_SERIES_MAX = 60;
function pushMood(series, p, max = exports.MOOD_SERIES_MAX) {
    const out = series.filter((x) => x.date !== p.date);
    out.push(p);
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out.slice(-max);
}
/** 추이: 6개 전(대략 반년 전) 점수와의 차이. 점이 2개 미만이면 0. */
function moodTrend(series, back = 6) {
    if (series.length < 2)
        return 0;
    const now = series[series.length - 1], then = series[Math.max(0, series.length - 1 - back)];
    return now.score - then.score;
}
/** 알림을 띄울 변화: 반년 사이 12점 이상 떨어졌거나, 분노 단계로 처음 들어섰을 때. 같은 단계에서는 다시 알리지 않는다. */
function moodAlert(series, lastAlertLevel) {
    if (series.length < 2)
        return null;
    const now = series[series.length - 1], lv = moodLevel(now.score), tr = moodTrend(series);
    if (lv === 'unrest' && lastAlertLevel !== 'unrest')
        return { kind: 'unrest', drop: -tr };
    if (tr <= -12 && lastAlertLevel !== lv)
        return { kind: 'drop', drop: -tr };
    return null;
}
/** 신문·라디오 AI 에 넣는 한 줄(영어, 답 언어는 설정을 따른다). */
function moodPromptLine(m, trend) {
    const dir = trend >= 5 ? 'rising' : trend <= -5 ? 'falling' : 'stable';
    const why = [];
    if (m.parts.stability !== null)
        why.push(`average planetary stability ${m.parts.stability}`);
    if (m.parts.approval !== null)
        why.push(`faction approval ${m.parts.approval}`);
    if (m.parts.warPenalty)
        why.push('war weariness');
    if (m.parts.unrestPenalty)
        why.push('unrest on some worlds');
    if (m.parts.eventAdj < 0)
        why.push('a recent scandal');
    return `Public mood in the player empire: ${exports.MOOD_EN[m.level]} (${m.score}/100, ${dir}${trend ? ' ' + (trend > 0 ? '+' : '') + trend : ''})${why.length ? ' — ' + why.join(', ') : ''}. Let this color the tone of coverage about the player empire (do not state the number unless natural).`;
}
function sanitizeMood(v) {
    const o = (v && typeof v === 'object' ? v : {}), saves = {};
    const lv = (x) => (x === 'jubilant' || x === 'content' || x === 'steady' || x === 'discontent' || x === 'unrest' ? x : '');
    if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves))
        for (const [sid, e] of Object.entries(o.saves).slice(0, 500)) {
            if (!e || typeof e !== 'object')
                continue;
            const x = e;
            const series = Array.isArray(x.series) ? x.series.map((p) => { const q = (p && typeof p === 'object' ? p : {}); return { date: typeof q.date === 'string' ? q.date.slice(0, 20) : '', score: Number(q.score) }; }).filter((p) => p.date && Number.isFinite(p.score) && p.score >= 0 && p.score <= 100).slice(-exports.MOOD_SERIES_MAX) : [];
            const adj = Array.isArray(x.adj) ? x.adj.map((a) => { const q = (a && typeof a === 'object' ? a : {}); return { date: typeof q.date === 'string' ? q.date.slice(0, 20) : '', value: clamp(Number(q.value) || 0, -15, 15), why: typeof q.why === 'string' ? q.why.slice(0, 120) : '' }; }).filter((a) => a.date && a.value).slice(-20) : [];
            if (series.length || adj.length)
                saves[sid.slice(0, 60)] = { series, alerted: lv(x.alerted), adj };
        }
    return { saves };
}
/** 일시 조정 합: 사건마다 value 를 주고, 12개월에 걸쳐 0 으로 줄어든다(게임 날짜 yyyy.mm.dd). */
function activeAdj(adj, today) {
    const ym = (d) => { const m = /^(\d+)\.(\d+)/.exec(d); return m ? Number(m[1]) * 12 + Number(m[2]) : NaN; };
    const t = ym(today);
    if (!Number.isFinite(t))
        return 0;
    let sum = 0;
    for (const a of adj) {
        const age = t - ym(a.date);
        if (!Number.isFinite(age) || age < 0 || age >= 12)
            continue;
        sum += a.value * (1 - age / 12);
    }
    return Math.round(clamp(sum, -exports.MOOD_TUNE.adjMax, exports.MOOD_TUNE.adjMax));
}
//# sourceMappingURL=mood.js.map
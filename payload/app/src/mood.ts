// 민심(시민 지지도, 2026-10-20 알파 10): 게임의 행성 안정도·파벌 승인도·전쟁 피로도로 0~100 점수를 계산한다. 읽기 전용(게임에 효과 없음).
// 신문·라디오 논조에 먼저 반영하고, 나중에 내정 요청·거절 반응으로 넓힌다. 앱: features/mood-app.ts, 화면: ui/office-mood.js. 모드: sllm_probe_scan.txt 의 SLLM:MOOD.
import type { StateSnapshot } from './gamestate';

export type MoodLevel = 'jubilant' | 'content' | 'steady' | 'discontent' | 'unrest';
export const MOOD_KO: Record<MoodLevel, string> = { jubilant: '열광', content: '만족', steady: '보통', discontent: '불만', unrest: '분노' };
export const MOOD_EN: Record<MoodLevel, string> = { jubilant: 'Jubilant', content: 'Content', steady: 'Steady', discontent: 'Discontent', unrest: 'Unrest' };
export interface MoodParts { stability: number | null; approval: number | null; warPenalty: number; unrestPenalty: number; eventAdj: number }
export interface Mood { score: number; level: MoodLevel; parts: MoodParts }
export interface MoodPoint { date: string; score: number }
export const MOOD_TUNE = { wStab: 0.55, wApp: 0.45, warMax: 20, unrestMax: 15, adjMax: 15 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function moodLevel(score: number): MoodLevel { return score >= 75 ? 'jubilant' : score >= 60 ? 'content' : score >= 45 ? 'steady' : score >= 30 ? 'discontent' : 'unrest'; }
/** 점수: 안정도 평균(0~100)과 파벌 승인도(지지율 가중 평균, 0~100)를 섞고, 전쟁 피로도·불안 행성 비율로 깎는다.
 *  eventAdj = 최근 사건(비방 기사 반박 실패 등)의 일시 조정(−15~+15). 재료가 하나도 없으면 null. */
export function computeMood(s: Pick<StateSnapshot, 'mood' | 'factions' | 'gestalt'>, eventAdj = 0): Mood | null {
  const m = s.mood, stab = m && m.cnt > 0 ? clamp(m.sum / m.cnt, 0, 100) : null;
  const fs = s.gestalt ? [] : (s.factions ?? []).filter((f) => f.support > 0);
  const tot = fs.reduce((a, f) => a + f.support, 0);
  const app = tot > 0 ? clamp((fs.reduce((a, f) => a + f.approval * f.support, 0) / tot) * 100, 0, 100) : null;
  if (stab === null && app === null) return null;
  const base = stab !== null && app !== null ? stab * MOOD_TUNE.wStab + app * MOOD_TUNE.wApp : (stab ?? app)!;
  const ex = m ? Math.max(m.ox, m.dx) : 0, warPenalty = Math.round(clamp(ex, 0, 1) * MOOD_TUNE.warMax);
  const unrestPenalty = m && m.cnt > 0 ? Math.round(clamp(m.low / m.cnt, 0, 1) * MOOD_TUNE.unrestMax) : 0;
  const adj = clamp(Math.round(eventAdj), -MOOD_TUNE.adjMax, MOOD_TUNE.adjMax);
  const score = Math.round(clamp(base - warPenalty - unrestPenalty + adj, 0, 100));
  return { score, level: moodLevel(score), parts: { stability: stab === null ? null : Math.round(stab), approval: app === null ? null : Math.round(app), warPenalty, unrestPenalty, eventAdj: adj } };
}
export const MOOD_SERIES_MAX = 60;
export function pushMood(series: MoodPoint[], p: MoodPoint, max = MOOD_SERIES_MAX): MoodPoint[] {
  const out = series.filter((x) => x.date !== p.date); out.push(p); out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.slice(-max);
}
/** 추이: 6개 전(대략 반년 전) 점수와의 차이. 점이 2개 미만이면 0. */
export function moodTrend(series: MoodPoint[], back = 6): number {
  if (series.length < 2) return 0; const now = series[series.length - 1], then = series[Math.max(0, series.length - 1 - back)];
  return now.score - then.score;
}
/** 알림을 띄울 변화: 반년 사이 12점 이상 떨어졌거나, 분노 단계로 처음 들어섰을 때. 같은 단계에서는 다시 알리지 않는다. */
export function moodAlert(series: MoodPoint[], lastAlertLevel: MoodLevel | ''): { kind: 'drop' | 'unrest'; drop: number } | null {
  if (series.length < 2) return null; const now = series[series.length - 1], lv = moodLevel(now.score), tr = moodTrend(series);
  if (lv === 'unrest' && lastAlertLevel !== 'unrest') return { kind: 'unrest', drop: -tr };
  if (tr <= -12 && lastAlertLevel !== lv) return { kind: 'drop', drop: -tr };
  return null;
}
/** 신문·라디오 AI 에 넣는 한 줄(영어, 답 언어는 설정을 따른다). */
export function moodPromptLine(m: Mood, trend: number): string {
  const dir = trend >= 5 ? 'rising' : trend <= -5 ? 'falling' : 'stable';
  const why: string[] = [];
  if (m.parts.stability !== null) why.push(`average planetary stability ${m.parts.stability}`);
  if (m.parts.approval !== null) why.push(`faction approval ${m.parts.approval}`);
  if (m.parts.warPenalty) why.push('war weariness');
  if (m.parts.unrestPenalty) why.push('unrest on some worlds');
  if (m.parts.eventAdj < 0) why.push('a recent scandal');
  return `Public mood in the player empire: ${MOOD_EN[m.level]} (${m.score}/100, ${dir}${trend ? ' ' + (trend > 0 ? '+' : '') + trend : ''})${why.length ? ' — ' + why.join(', ') : ''}. Let this color the tone of coverage about the player empire (do not state the number unless natural).`;
}
export interface MoodStore { saves: Record<string, { series: MoodPoint[]; alerted: MoodLevel | ''; adj: Array<{ date: string; value: number; why: string }> }> }
export function sanitizeMood(v: unknown): MoodStore {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, saves: MoodStore['saves'] = {};
  const lv = (x: unknown): MoodLevel | '' => (x === 'jubilant' || x === 'content' || x === 'steady' || x === 'discontent' || x === 'unrest' ? x : '');
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) for (const [sid, e] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
    if (!e || typeof e !== 'object') continue; const x = e as Record<string, unknown>;
    const series = Array.isArray(x.series) ? (x.series as unknown[]).map((p) => { const q = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>; return { date: typeof q.date === 'string' ? q.date.slice(0, 20) : '', score: Number(q.score) }; }).filter((p) => p.date && Number.isFinite(p.score) && p.score >= 0 && p.score <= 100).slice(-MOOD_SERIES_MAX) : [];
    const adj = Array.isArray(x.adj) ? (x.adj as unknown[]).map((a) => { const q = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>; return { date: typeof q.date === 'string' ? q.date.slice(0, 20) : '', value: clamp(Number(q.value) || 0, -15, 15), why: typeof q.why === 'string' ? q.why.slice(0, 120) : '' }; }).filter((a) => a.date && a.value).slice(-20) : [];
    if (series.length || adj.length) saves[sid.slice(0, 60)] = { series, alerted: lv(x.alerted), adj };
  }
  return { saves };
}
/** 일시 조정 합: 사건마다 value 를 주고, 12개월에 걸쳐 0 으로 줄어든다(게임 날짜 yyyy.mm.dd). */
export function activeAdj(adj: Array<{ date: string; value: number }>, today: string): number {
  const ym = (d: string) => { const m = /^(\d+)\.(\d+)/.exec(d); return m ? Number(m[1]) * 12 + Number(m[2]) : NaN; };
  const t = ym(today); if (!Number.isFinite(t)) return 0;
  let sum = 0; for (const a of adj) { const age = t - ym(a.date); if (!Number.isFinite(age) || age < 0 || age >= 12) continue; sum += a.value * (1 - age / 12); }
  return Math.round(clamp(sum, -MOOD_TUNE.adjMax, MOOD_TUNE.adjMax));
}

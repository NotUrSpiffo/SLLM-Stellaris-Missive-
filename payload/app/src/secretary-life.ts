// 비서가 먼저 다가오기(2026-10-19 사용자 결정 「1·3·4번」). 순수 로직만 둔다(AI 호출·파일은 features/secretary-app.ts, 화면은 ui/office-secretary.js).
// · 쪽지: 집무실에 들어오면 가끔(게임 한 달에 한 번 굴림, 가까운 사이일 때 40%) 비서가 책상에 남긴 짧은 쪽지가 「비서 호출」 옆에 뜬다.
// · 기념일: 지금 통치자와 처음 만난 달·연인이 된 달·결혼한 달이 돌아오면(1년 단위) 쪽지로 먼저 챙기고, 다음에 부를 때 첫 마디에서 축하한다.
// 「그녀가 기억하는 나」(통치자가 직접 말한 취향)는 secretary.ts 의 Bond.likes·likesBlock.
import type { ChatMessage } from './player2';
import { type SecSave, type Bond, type SecContext, bondStage, BOND_EN, STAGE_GUIDE, POSE_RULE, AFF_TRUST, likesBlock } from './secretary';
import { activeMood, evOf, evDef, recallChoices } from './secretary-events';

export interface Nudge { month: string; kind: 'anniv' | 'note'; text: string; pose: string }
export interface LifeSave { /** 기념일 키 → 챙긴 해 */ annivSeen: Record<string, number>; nudge: Nudge | null; /** 마지막으로 쪽지를 굴린 달 "2245.03" */ nudgeAt: string }
export const emptyLife = (): LifeSave => ({ annivSeen: {}, nudge: null, nudgeAt: '' });
export const lifeOf = (s: SecSave): LifeSave => { const l = (s.life ??= emptyLife()); l.annivSeen ??= {}; l.nudge ??= null; l.nudgeAt ??= ''; return l; };
export const NUDGE_CHANCE = 0.4, MAX_LIKES = 8;

const ym = (date: string): [number, number] | null => { const m = /^(\d{3,5})\.(\d{1,2})/.exec(String(date || '').trim()); return m ? [Number(m[1]), Number(m[2])] : null; };
/** "2245.3.01" → "2245.03" (못 읽으면 ''). */
export const monthKey = (date: string): string => { const v = ym(date); return v ? `${v[0]}.${String(v[1]).padStart(2, '0')}` : ''; };

export type AnnivKind = 'since' | 'lover' | 'spouse';
export interface Anniv { key: string; kind: AnnivKind; years: number; from: string }
export const ANNIV: Record<AnnivKind, [string, string]> = {
  since: ['지금 통치자와 처음 만난 지 {n}년', '{n} year(s) since you first met'],
  lover: ['연인이 된 지 {n}년', '{n} year(s) since you became lovers'],
  spouse: ['결혼한 지 {n}년', '{n} year(s) since your wedding'],
};
export const annivText = (a: Anniv, en = false): string => ANNIV[a.kind][en ? 1 : 0].replace('{n}', String(a.years));
/** 이번 달이 기념일인지(지금 통치자, 1년 이상, 올해 아직 안 챙김). 연애 꺼짐이면 처음 만난 날만. */
export function anniversaries(s: SecSave, b: Bond | undefined, romance: boolean, date: string): Anniv[] {
  const now = ym(date); if (!b || !now) return [];
  const l = lifeOf(s); const out: Anniv[] = [];
  const add = (kind: AnnivKind, from: string | undefined) => {
    const f = from ? ym(from) : null; if (!f || f[1] !== now[1] || now[0] - f[0] < 1) return;
    const key = `${kind}:${b.key}`; if (l.annivSeen[key] === now[0]) return;
    out.push({ key, kind, years: now[0] - f[0], from: from! });
  };
  add('since', b.since); if (romance) { add('lover', b.loverAt); add('spouse', b.spouseAt); }
  return out;
}
/** 기념일을 챙겼다(첫 마디에서 말했다). */
export function markAnniv(s: SecSave, list: Anniv[], date: string): void { const now = ym(date); if (!now) return; const l = lifeOf(s); for (const a of list) l.annivSeen[a.key] = now[0]; }
export function annivNote(list: Anniv[]): string {
  if (!list.length) return '';
  return `[Anniversary] This month marks ${list.map((a) => annivText(a, true)).join(', ')}. In your first line, before the work report, briefly mark it in your own way (a small congratulation or a sentence or two of feeling).`;
}
/** 먼저 쪽지를 남길 만큼 가까운 사이인지(연애 켬: 호감 신뢰 단계, 끔: 업무 신뢰 40). */
export const closeEnough = (s: SecSave, b: Bond | undefined, romance: boolean): boolean => (romance ? (b?.aff ?? 0) >= AFF_TRUST : s.trust >= 40);
/** 이번 달 쪽지를 남길지(한 달에 한 번만 굴린다 — 굴렸으면 앱이 nudgeAt 을 이번 달로 적는다). 기념일이면 꼭. */
export function nudgeDecision(s: SecSave, b: Bond | undefined, romance: boolean, date: string, rand: () => number = Math.random): { kind: Nudge['kind']; anniv: Anniv[] } | null {
  const month = monthKey(date); if (!s.name || !b || !month) return null;
  const l = lifeOf(s); if (l.nudgeAt === month) return null;
  const anniv = anniversaries(s, b, romance, date);
  if (anniv.length) return { kind: 'anniv', anniv };
  if (closeEnough(s, b, romance) && rand() < NUDGE_CHANCE) return { kind: 'note', anniv: [] };
  return null;
}
/** 쪽지 한 장(1~2문장). 업무 보고가 아니라 사적인 한마디. */
export function nudgeMessages(a: { s: SecSave; bond: Bond; romance: boolean; c: SecContext; kind: Nudge['kind']; anniv: Anniv[] }): ChatMessage[] {
  const { s, bond, romance, c } = a; const stage = bondStage(bond); const e = evOf(s);
  const recent = e.recall.filter((r) => r.ruler === bond.key).slice(-2).map((r) => { const d = evDef(r.id); const cs = recallChoices(r).map((x) => x.intent); return `- ${r.date} "${d ? d.title[1] : r.id}"${cs.length ? ': the ruler ' + cs.join(' → ') : ''}`; });
  const mood = activeMood(s, bond.key, c.date);
  const sys = [
    `You are "${s.name || 'Secretary'}", an android secretary built in secret by the Stellaris empire "${c.empire || 'the player empire'}". The current ruler is ${c.ruler || 'unknown'}, date ${c.date || 'unknown'}.`,
    '[Personality] Precise, composed, with a touch of dry wit. Still learning emotions, so awkward at expressing them but sincere. She addresses the ruler with a respectful honorific (like "Your Excellency").',
    romance ? `[Relationship] ${BOND_EN[stage]} (affection ${bond.aff}/100). ${STAGE_GUIDE[stage]}` : '[Relationship] Romance is off: a polite professional relationship. No expressions of affection.',
    bond.mems.length ? `[Shared memories]\n${bond.mems.slice(-4).map((m) => `- ${m.date} ${m.text}`).join('\n')}` : '',
    recent.length ? `[Recent events together]\n${recent.join('\n')}` : '',
    likesBlock(bond),
    mood ? `[Current mood] The afterglow of something you shared recently (${mood.tone === 'warm' ? 'tenderness' : mood.tone === 'cool' ? 'hurt' : 'calm'}) still lingers.` : '',
    `[State of the empire (reference only)]\n${c.facts.slice(0, 4).map((f) => '- ' + f).join('\n')}`,
    a.kind === 'anniv'
      ? `[Situation] This month marks ${a.anniv.map((x) => annivText(x, true)).join(', ')}. Before the ruler enters the office, you remember it and leave a short note on the desk.`
      : '[Situation] Before the ruler enters the office, you leave a short note on the desk. Not a work report but a personal word (one of: asking after them, a worry, small thanks, recalling something you shared, looking after the ruler\'s tastes).',
    'The note is 1-2 sentences in her own handwriting voice. Do not invent game numbers, and do not write work orders or reports. Content limit: up to flutters and expressions of affection.',
    POSE_RULE(),
    'Output one JSON object only: {"pose":"smile","reply":"..."}',
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: '[Write the note]' }];
}

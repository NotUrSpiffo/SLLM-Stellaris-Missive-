// 라디오 찬반 논평(2026-10-20 알파 10 ②, 같은 날 라디오 전용으로 바꿈): 큰 사건이 생기면 우리 제국 파벌 중 가장 찬성할 쪽과 가장 반대할 쪽의
// 의원(이름은 앱이 게임 이름 표에서 우리 제국 종족 비율대로 뽑음 — features/namegen-app.ts) 두 사람이 라디오에 나와 세 번씩 주고받는다. 진행자가 처음에 열고 끝에서 정리한다(8줄: 진행자 → 찬·반 ×3 → 진행자).
// 언론사(라디오)만의 코너: 신문 재료·집무실 민심 칸에는 싣지 않는다. 사건이 나면 알림만 띄우고, 들으려 할 때 AI 를 한 번 부른다.
// 찬반은 파벌 성향 템플릿(아래 표)이 정하고, AI 는 말만 쓴다. 군체·기계 제국은 자유 언론·파벌이 없어 하지 않는다.
// 앱: features/debate-app.ts. 화면: ui/radio.html.
import type { ChatMessage } from './player2';
import type { StateFaction, FactionEthic } from './gamestate';

export type DebateKind = 'war_att' | 'war_def' | 'our_condemn' | 'our_concern' | 'our_support' | 'galcom_condemn' | 'smeared' | 'smear_ok';
/** 사건 종류별 파벌 성향 점수(+ 찬성, − 반대). 키는 게임 파벌 가치관(FACTION_ETHICS). */
export const DEBATE_TEMPLATE: Record<DebateKind, Partial<Record<FactionEthic, number>>> = {
  war_att: { militarist: 2, authoritarian: 1, xenophobe: 1, pacifist: -2, egalitarian: -1, xenophile: -1 },
  war_def: { militarist: 2, authoritarian: 1, xenophobe: 1, spiritualist: 1, pacifist: -1, materialist: -1 }, // 방어전: 반대는 '협상했어야'·'전쟁 비용' 정도
  our_condemn: { pacifist: 2, xenophile: 1, egalitarian: 1, militarist: -1, xenophobe: -2 }, // 외계인 혐오: 남의 일에 끼지 말라
  our_concern: { pacifist: 1, materialist: 1, militarist: -2, xenophobe: -1 }, // 군국주의: 미지근하다
  our_support: { militarist: 2, authoritarian: 1, pacifist: -2, egalitarian: -1, xenophile: -1 },
  galcom_condemn: { xenophobe: 2, authoritarian: 2, militarist: 1, pacifist: -2, xenophile: -2, egalitarian: -1 }, // 찬성 = 정부 편(규탄을 일축), 반대 = 규탄에 동의
  smeared: { authoritarian: 1, militarist: 1, egalitarian: -1, materialist: -1 }, // 우리 정부 스캔들: 찬성 = 정부 옹호, 반대 = 해명 요구
  smear_ok: { authoritarian: 1, xenophobe: 1, militarist: 1, egalitarian: -2, pacifist: -1 }, // 우리 첩보가 상대를 비방(보도된 경우): 반대 = 더러운 공작 비판
};
/** 찬성·반대 파벌 고르기: 점수 × (지지율 + 0.15). 찬성은 최고(>0), 반대는 최저(<0). 주고받는 대담이라 둘 다 있어야 한다(없으면 null). */
export function pickSides(kind: DebateKind, factions: StateFaction[] | undefined, gestalt: boolean): { pro: StateFaction; con: StateFaction } | null {
  if (gestalt) return null;
  const t = DEBATE_TEMPLATE[kind], fs = (factions ?? []).filter((f) => f.ethic && f.support > 0);
  let pro: StateFaction | null = null, con: StateFaction | null = null, best = 0, worst = 0;
  for (const f of fs) { const v = (t[f.ethic] ?? 0) * (f.support + 0.15); if (v > best) { best = v; pro = f; } if (v < worst) { worst = v; con = f; } }
  return pro && con ? { pro, con } : null;
}
export type Gender = 'm' | 'f';
export interface DebateSide { faction: string; ethic: FactionEthic; support: number; gender: Gender; name: string }
export type DebateWho = 'announcer' | 'pro' | 'con';
export interface DebateLine { who: DebateWho; text: string }
/** 알림이 뜬 논평 한 건. lines 가 비어 있으면 아직 방송 전(들으려 할 때 AI 가 쓴다). */
export interface Debate { id: string; date: string; kind: DebateKind; topic: string; pro: DebateSide; con: DebateSide; lines: DebateLine[]; aired: boolean; station?: string }
/** 두 의원의 성별: 찬성은 무작위, 반대는 그 반대(목소리가 겹치지 않게). */
export function debateGenders(r: number): { pro: Gender; con: Gender } { return r < 0.5 ? { pro: 'm', con: 'f' } : { pro: 'f', con: 'm' }; }
/** 라디오 음성 칸: 남성 의원은 기자 목소리, 여성 의원은 공동 진행자 목소리를 빌린다. */
export const voiceOf = (g: Gender): 'reporter' | 'cohost' => (g === 'm' ? 'reporter' : 'cohost');
/** 게임 이름 표를 못 읽었을 때만 쓰는 무작위 이름(우주 느낌의 음절 조합). */
const SYL_A = ['Ka', 'Vel', 'Tor', 'Mi', 'Ra', 'Zen', 'Or', 'Lys', 'Dar', 'Sen', 'Ve', 'Nor', 'Ith', 'Qua', 'Sol', 'Bre', 'Ty', 'Al', 'Mar', 'Cor'];
const SYL_B = ['an', 'is', 'ek', 'ora', 'un', 'eth', 'ix', 'a', 'ar', 'on'];
const SYL_C = ['Thal', 'Vonn', 'Kess', 'Reyl', 'Duun', 'Mara', 'Sk', 'Ovan', 'Tieg', 'Hal'];
export function randomName(rand: () => number = Math.random): string {
  const p = <T,>(a: T[]) => a[Math.floor(rand() * a.length) % a.length];
  return `${p(SYL_A)}${p(SYL_B)} ${p(SYL_C)}${p(SYL_B)}`;
}
const KIND_EN: Record<DebateKind, string> = {
  war_att: 'our government has gone to war (we are the attacker)', war_def: 'we have been attacked and our government is at war (we are the defender)',
  our_condemn: 'our government publicly condemned another empire\'s war', our_concern: 'our government issued a cautious statement of concern about another empire\'s war', our_support: 'our government publicly backed another empire\'s war of aggression',
  galcom_condemn: 'the Galactic Community condemned our war', smeared: 'a scandal about our government, planted by a foreign spy network, is spreading in the press', smear_ok: 'reports suggest our spies ran a smear campaign against another empire',
};
export const DEBATE_ORDER: DebateWho[] = ['announcer', 'pro', 'con', 'pro', 'con', 'pro', 'con', 'announcer'];
/** AI 요청: 라디오 찬반 대담 8줄 + 두 의원 이름. 찬성·반대의 방향은 규칙이 정한다. */
export function debateMessages(player: string, d: Pick<Debate, 'kind' | 'topic' | 'pro' | 'con'>, host: string, station: string): ChatMessage[] {
  const g = (x: Gender) => (x === 'm' ? 'male' : 'female');
  const sys = [
    `You write a live "for and against" debate segment for the radio station "${station.slice(0, 80)}" in the game Stellaris. The listener is the leader of ${player.slice(0, 80) || 'the player empire'}; never ask the listener for a reply.`,
    `The host "${host.slice(0, 60)}" moderates. Two members of the empire's assembly are guests: one from the faction that backs the government on this event (PRO) and one from the faction that criticizes it (CON).`,
    'The guests\' names are given below; use them exactly as written (the host introduces them by name). Each guest speaks true to their faction\'s ideology, answers the other directly, and keeps it civil but pointed.',
    'Exactly 8 lines in this order: host opens and introduces both guests and the topic → PRO → CON → PRO → CON → PRO → CON → host wraps up neutrally and signs off. One or two spoken sentences per line.',
    'Say only what is in the event details; do not invent numbers, battles, casualties or new facts. Original text only.',
    'Output ONLY JSON: {"lines":[{"who":"announcer","text":"…"},{"who":"pro","text":"…"},{"who":"con","text":"…"}, …]} with exactly 8 lines and no ellipsis.',
  ].join('\n');
  const side = (s: DebateSide) => `${(s.name || 'unnamed member').slice(0, 40)} — the ${s.faction.slice(0, 60)} (${s.ethic} faction, ${Math.round(s.support * 100)}% support), ${g(s.gender)}`;
  const usr = [`Event: ${KIND_EN[d.kind]}.`, `Details: ${d.topic.replace(/\s+/g, ' ').slice(0, 400)}`, `PRO guest: ${side(d.pro)}`, `CON guest: ${side(d.con)}`].join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
/** 응답 읽기: 8줄이 진행자 → 찬·반 ×3 → 진행자 순서일 때만. */
export function parseDebate(raw: unknown): { lines: DebateLine[] } | null {
  const s = typeof raw === 'string' ? raw.replace(/```(?:json)?/g, '') : ''; const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(s.slice(a, b + 1)) as Record<string, unknown>; const t = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
    const lines = (Array.isArray(j.lines) ? j.lines : []).map((l) => { const x = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>; return { who: x.who as DebateWho, text: t(x.text, 320) }; });
    if (!completeDebate(lines)) return null;
    return { lines };
  } catch { return null; }
}
export function completeDebate(lines: DebateLine[]): boolean { return lines.length === 8 && lines.every((l, i) => l.who === DEBATE_ORDER[i] && !!l.text); }
export interface DebateStore { alarm: boolean; saves: Record<string, Debate[]> }
const KINDS: DebateKind[] = ['war_att', 'war_def', 'our_condemn', 'our_concern', 'our_support', 'galcom_condemn', 'smeared', 'smear_ok'];
/** 저장 파일 검사. alarm(알림 띄우기)은 기본 켬. 세이브마다 20건. */
export function sanitizeDebate(v: unknown): DebateStore {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, saves: DebateStore['saves'] = {};
  const side = (x: unknown): DebateSide | null => { if (!x || typeof x !== 'object') return null; const q = x as Record<string, unknown>; return typeof q.faction === 'string' && q.faction ? { faction: q.faction.slice(0, 80), ethic: (typeof q.ethic === 'string' ? q.ethic : '') as FactionEthic, support: typeof q.support === 'number' && q.support >= 0 && q.support <= 1 ? q.support : 0, gender: q.gender === 'f' ? 'f' : 'm', name: typeof q.name === 'string' ? q.name.slice(0, 40) : '' } : null; };
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) for (const [sid, list] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
    if (!Array.isArray(list)) continue;
    const out: Debate[] = [];
    for (const d of list.slice(-20)) {
      const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>, pro = side(x.pro), con = side(x.con);
      if (!KINDS.includes(x.kind as DebateKind) || !pro || !con || typeof x.id !== 'string') continue;
      const lines = (Array.isArray(x.lines) ? x.lines : []).map((l) => { const q = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>; return { who: q.who as DebateWho, text: typeof q.text === 'string' ? q.text.slice(0, 320) : '' }; });
      out.push({ id: x.id.slice(0, 120), date: typeof x.date === 'string' ? x.date.slice(0, 20) : '', kind: x.kind as DebateKind, topic: typeof x.topic === 'string' ? x.topic.slice(0, 300) : '', pro, con, lines: completeDebate(lines) ? lines : [], aired: x.aired === true, ...(typeof x.station === 'string' ? { station: x.station.slice(0, 80) } : {}) });
    }
    if (out.length) saves[sid.slice(0, 60)] = out;
  }
  return { alarm: o.alarm !== false, saves };
}

// 집무실 4단계: 작별·추모관(2026-10-18). 순수 로직만 둔다(파일·AI·게임 신호 처리는 features/memorial-app.ts).
// - 추모관 = 명예의 전당: 세상을 떠난 인물만(전사·서거). 해임·행방 불명은 「떠난 사람들」에 따로 둔다(사용자 확정).
// - 비석 자료(재임 기간·레벨·특성·남긴 일·기억)는 앱이 모은다(AI 없음). 비문 한 줄만 처음 볼 때 AI 로 한 번(플레이어가 고쳐 쓸 수 있음).
// - 작별 편지: 관계가 있던 사람만(신뢰 호의 이상, 또는 대화·편지를 한 번이라도), 한 달에 관계 깊은 순으로 FAREWELL_CAP 통까지. 본문은 서신함처럼 열 때 AI.
import type { ChatMessage } from './player2';
import { trustLevel, ROLE_KO, type PersonaMem } from './persona';
import { monthNo } from './letters';
import { L } from './i18n-pick';
const ROLE_EN: Record<string, string> = { ruler: 'Ruler', governor: 'Governor', admiral: 'Admiral', general: 'General', scientist: 'Scientist', commander: 'Commander', official: 'Official' };

export type OutWhy = 'death' | 'fallen' | 'fired' | 'lost';
export const FAREWELL_CAP = 3;
export const FAREWELL_TRUST = 20; // 호의 이상

export interface Stone {
  key: string; lid: number; name: string; role: string; why: 'death' | 'fallen'; first: string; gone: string;
  lv?: number; traits?: string[]; place?: string; planet?: string; fleet?: string; council?: boolean;
  battles?: number; acclaimed?: boolean; reprimanded?: boolean; letters: number; talks: number; trust: number; mems: string[];
  epitaph?: string; epitaphBy?: 'ai' | 'me'; seen: boolean;
}
export interface Departed { key: string; lid: number; name: string; role: string; why: 'fired' | 'lost'; date: string; first: string }
export interface MemorialSave { stones: Stone[]; departed: Departed[]; queue: Array<{ key: string; why: OutWhy; score: number; date: string }> }
export const emptyMemorial = (): MemorialSave => ({ stones: [], departed: [], queue: [] });

/** 사망 + 같은 달(또는 바로 전 달)에 그 지휘관의 전투 기록이 있으면 전사. */
export function deathKind(battleDates: string[], date: string): 'fallen' | 'death' {
  const d = monthNo(date); if (d === null) return 'death';
  return battleDates.some((b) => { const m = monthNo(b); return m !== null && d - m >= 0 && d - m <= 1; }) ? 'fallen' : 'death';
}
/** 작별 편지를 받을 만큼 관계가 있었나. */
export const farewellWorthy = (m: PersonaMem | undefined, letters: number): boolean => (m ? m.trust >= FAREWELL_TRUST || m.talks > 0 : false) || letters > 0;
/** 관계 깊이(줄 세우기용): 신뢰 + 대화·편지 횟수. */
export const bondScore = (m: PersonaMem | undefined, letters: number): number => (m ? m.trust + m.talks * 5 : 0) + letters * 5;
/** 이번 달 대기열에서 관계 깊은 순으로 cap 명만 작별 편지. 나머지는 편지 없이(추모관·떠난 사람들에는 그대로). */
export function pickFarewells<T extends { score: number }>(q: T[], cap = FAREWELL_CAP): T[] { return q.slice().sort((a, b) => b.score - a.score).slice(0, cap); }

/** 함께 일한 동료(같은 평의회, 또는 같은 직책에서 지도자와 이야기해 본 인물)에게 남길 기억 한 줄. */
export function colleagues(dead: { key: string; role: string; council?: boolean }, living: Array<{ key: string; role: string; council?: boolean }>, talked: (key: string) => boolean): string[] {
  return living.filter((p) => p.key !== dead.key && ((dead.council && p.council) || (p.role === dead.role && talked(p.key)))).map((p) => p.key);
}
// 기억·연대기 문장은 기록할 때의 화면 언어로(2026-10-19).
export const colleagueMemo = (name: string, why: 'death' | 'fallen'): string => (why === 'fallen' ? L(`동료 ${name}이(가) 전사했다`, `My colleague ${name} fell in battle`) : L(`동료 ${name}이(가) 세상을 떠났다`, `My colleague ${name} passed away`));
/** 연대기 한 줄(신문 연감의 재료가 되어 부고처럼 실린다. '지도자 사망:'으로 시작하면 신문이 빼므로 쓰지 않는다). */
export const chronLine = (s: Pick<Stone, 'name' | 'role' | 'why' | 'first' | 'gone'>): string => L(`추모: ${ROLE_KO[s.role] ?? '인물'} ${s.name} ${s.why === 'fallen' ? '전사' : '서거'} (${s.first || '?'} ~ ${s.gone})`, `In memoriam: ${ROLE_EN[s.role] ?? 'Leader'} ${s.name} ${s.why === 'fallen' ? 'fell in battle' : 'passed away'} (${s.first || '?'} – ${s.gone})`);

/** 비석의 "남긴 일" 줄(화면용 재료, 문장은 화면에서 번역 열쇠로 만든다). */
export function deeds(s: Stone): Array<{ k: string; v: string | number }> {
  const out: Array<{ k: string; v: string | number }> = [];
  if (s.planet) out.push({ k: 'planet', v: s.planet });
  if (s.fleet) out.push({ k: 'fleet', v: s.fleet });
  if (s.battles) out.push({ k: 'battles', v: s.battles });
  if (s.acclaimed) out.push({ k: 'acclaimed', v: 1 });
  if (s.council) out.push({ k: 'council', v: 1 });
  if (s.letters) out.push({ k: 'letters', v: s.letters });
  if (s.talks) out.push({ k: 'talks', v: s.talks });
  return out;
}

/** 비문 한 줄(처음 볼 때 한 번). */
export function epitaphMessages(s: Stone, persona: string, traitNames: string[], empire: string, gestalt = 0): ChatMessage[] {
  const facts = [
    `${ROLE_EN[s.role] ?? 'Leader'} ${s.name} of ${empire || 'the player empire'}`,
    `Served ${s.first || '?'} – ${s.gone}, ${s.why === 'fallen' ? 'fell in battle' : 'passed away'}`,
    s.lv ? `Skill level ${s.lv}` : '', traitNames.length ? `Traits: ${traitNames.join(', ')}` : '',
    s.planet ? `Governed planet ${s.planet}` : '', s.fleet ? `Commanded fleet ${s.fleet}` : '', s.battles ? `${s.battles} recorded battles` : '',
    s.acclaimed ? 'Acclaimed at a hearing' : '', s.council ? 'Council member' : '',
    persona ? `Personality and manner of speech: ${persona}` : '', `Relationship with the leader: ${trustLevel(s.trust).en}`,
    s.mems.length ? `Memories: ${s.mems.join(' / ')}` : '',
    gestalt === 1 ? 'This empire is a machine intelligence: the subject was a unit of it, so prefer words like service, function and shutdown over personal feeling.' : gestalt === 2 ? 'This empire is a hive mind: the subject was a drone of the one consciousness, so speak of what the hive keeps of them rather than a personal life.' : gestalt === 3 ? 'This empire is a gestalt consciousness: the subject was part of one mind rather than an individual.' : '',
  ].filter(Boolean);
  return [
    { role: 'system', content: ['Write a one-line epitaph to engrave on a stone in a Stellaris empire\'s memorial. Let this person\'s life and character come through; dignified and understated.', 'Use only the given facts; do not invent anything. No lists of numbers. One sentence of about 40 characters (Korean) or 12 words.', 'Output only one JSON object: {"epitaph":"..."}'].join('\n') },
    { role: 'user', content: facts.join('\n') },
  ];
}
export const cleanEpitaph = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim().replace(/^["“「]+|["”」]+$/g, '').trim().slice(0, 80);

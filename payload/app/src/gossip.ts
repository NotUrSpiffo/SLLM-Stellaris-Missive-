// 엿들은 소문: 플레이어와 상관없이 두 AI 제국이 비공개로 나눈 대화를 만들어 보여 준다.
// 이것은 게임 사실이 아니다(조약·전쟁을 정하지 않고, 연대기에도 남기지 않는다). 재료는 앱이 아는 것뿐이다:
// 각 제국의 성향, 플레이어를 향한 태도, 최근 사건.
import { ChatMessage } from './player2';
import { MailCountry, News, involves, newsText } from './mail';
import { stance, paperBlock } from './prompt';

export interface GossipLine { who: string; say: string }
export interface Gossip { id: number; date: string; a: string; b: string; lines: GossipLine[] }

/** 소문을 낼 두 제국을 고른다. 둘이 함께 나온 사건이 있으면 더 자주 고르고, 직전과 같은 쌍은 피한다. */
export function pickPair(countries: MailCountry[], news: News[], playerIdx: number, lastKey = '', rnd: () => number = Math.random): [MailCountry, MailCountry] | null {
  const seen = new Map<number, MailCountry>();
  for (const c of countries) if (c.idx !== playerIdx && c.name && c.profile) seen.set(c.idx, c);
  const list = [...seen.values()];
  if (list.length < 2) return null;
  const pairs: Array<{ a: MailCountry; b: MailCountry; w: number; key: string }> = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const both = news.filter((n) => involves(n, a) && involves(n, b)).length;
    pairs.push({ a, b, w: 1 + 3 * Math.min(both, 3), key: `${a.idx}-${b.idx}` });
  }
  const pool = pairs.length > 1 ? pairs.filter((p) => p.key !== lastKey) : pairs;
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = rnd() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return [p.a, p.b]; }
  const p = pool[pool.length - 1]; return [p.a, p.b];
}
export const pairKey = (a: MailCountry, b: MailCountry): string => `${Math.min(a.idx, b.idx)}-${Math.max(a.idx, b.idx)}`;

function who(c: MailCountry, player: string): string {
  const p = c.profile;
  const st = stance({ idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: p });
  return `- ${c.name}: ${p.gov || 'government unknown'}, ${p.species || 'species unknown'}, personality ${p.personality || 'unknown'}, leader ${p.title || ''} ${p.ruler || ''}`.trimEnd() + `\n  Feelings toward ${player}: ${st}`;
}

export function gossipMessages(player: string, date: string, a: MailCountry, b: MailCountry, news: News[], paper?: string[]): ChatMessage[] {
  const ev = news.filter((n) => involves(n, a) || involves(n, b)).slice(-8).map((n) => '- ' + n.date + ' ' + newsText(n));
  const system = [
    `You write a short private conversation between the leaders of two empires in the galactic political world: ${a.name} and ${b.name}.`,
    `${player} (the player) happened to overhear it. Each leader speaks according to their personality and mood and, if relevant, shares their private feelings about ${player} with the other.`,
    `Rules: do not invent wars, treaties, betrayals or alliances not in the "Known events" below. Do not write that the two empires agreed on anything (only small talk and opinions). No numbers or statistics.`,
    `4-6 lines, the two taking turns; each line is one or two sentences.`,
    `Answer with exactly one JSON: {"lines":[{"who":"empire name","say":"line"}, ...]} who must be exactly "${a.name}" or "${b.name}".`,
  ].join('\n');
  const user = [
    `Date: ${date}`, 'The two empires:', who(a, player), who(b, player),
    ev.length ? `Known events:\n${ev.join('\n')}` : 'Known events: none (only light opinions and small talk fitting their personalities)',
    paperBlock(paper),
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** 모델 답에서 대사들을 꺼낸다. 이름이 두 제국이 아닌 줄은 버린다. 쓸 만한 줄이 2개 미만이면 null. */
export function parseGossip(raw: string, a: string, b: string): GossipLine[] | null {
  let obj: any = null;
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s >= 0 && e > s) { try { obj = JSON.parse(raw.slice(s, e + 1)); } catch { /* 아래에서 정규식으로 */ } }
  let lines: GossipLine[] = [];
  if (obj && Array.isArray(obj.lines)) lines = obj.lines.filter((l: any) => l && typeof l.who === 'string' && typeof l.say === 'string').map((l: any) => ({ who: l.who.trim(), say: l.say.trim() }));
  else {
    const re = /"who"\s*:\s*"([^"]+)"\s*,\s*"say"\s*:\s*"((?:[^"\\]|\\.)*)"/g; let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) lines.push({ who: m[1].trim(), say: m[2].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim() });
  }
  lines = lines.filter((l) => (l.who === a || l.who === b) && l.say).map((l) => ({ who: l.who, say: l.say.slice(0, 200) })).slice(0, 8);
  return lines.length >= 2 ? lines : null;
}

/**
 * 2026-10-16 토큰 낭비 수정. 실사용 기록에서 소문 9건 중 8건·신문 6건 중 4건이 응답 한도(900/1800)에 닿아
 * 글이 거의 없이 끝났다(Gemini 3 Flash 의 내부 생각 토큰이 응답 한도를 함께 쓴다). 한도를 넉넉히 올린다.
 * 한도는 '최대'일 뿐이라 실제로 쓴 만큼만 든다.
 */
export const GOSSIP_MAX_TOKENS = 2000, NEWS_MAX_TOKENS = 3500;
/** 소문은 게임 날짜가 바뀌었을 때만 만든다(게임이 멈춰 있으면 같은 날짜에 실시간 10분마다 또 만들던 문제). */
export function gossipDue(lastKey: string, sid: string, date: string): boolean { return !!sid && !!date && lastKey !== sid + '|' + date; }

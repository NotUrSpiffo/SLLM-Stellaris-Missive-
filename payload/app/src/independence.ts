// 독립 선언 서신(2026-10-19 사용자 결정): 반란·분리 독립으로 새 나라가 생기면, 그 나라가 "우리는 정당한 국가다"라는 선언문을
// 은하의 모든 나라에 돌린다(실제로는 플레이어에게만 외교 서신으로). 어디서 갈라져 나왔는지(부모 제국)는 기록해 대화·연대기에 쓴다.
// 순수 로직만 둔다. 게임 신호는 모드의 SLLM:ORIGIN(sllm_probe_state_events.txt, 반란군 행성 장악·평화 협상 독립), 앱은 features/independence-app.ts.
import type { ChatMessage } from './player2';
import type { OriginRecord } from './gamestate';
import type { Profile } from './prompt';
import { L } from './i18n-pick';

export interface IndepRecord extends OriginRecord { /** 선언문을 보냈는지('sent') · 기다리는 중('wait') · 너무 늦어 접음('expired') · 플레이어 자신('self') */ state: 'wait' | 'sent' | 'expired' | 'self'; seen: string }
export type IndepStance = 'against_us' | 'released_from_us' | 'freed_by_us' | 'neutral';
/** 이 나라의 통신 번호를 모르면(아직 연락이 닿지 않음) 기다리는 최대 개월. 지나면 선언문은 접는다(연대기에는 남음). */
export const INDEP_WAIT_MONTHS = 24;
const norm = (s: string | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** 새 독립 기록(같은 나라는 한 번만 — 반란군은 행성을 장악할 때마다 신호가 온다). 돌려주는 값: 새로 넣은 기록 또는 null. */
export function noteIndependence(list: IndepRecord[], o: OriginRecord, player: string, date: string): IndepRecord | null {
  const c = norm(o.country); if (!c || !norm(o.from) || c === norm(o.from)) return null;
  if (list.some((r) => norm(r.country) === c)) return null;
  const r: IndepRecord = { ...o, country: c, from: norm(o.from), state: c === norm(player) ? 'self' : 'wait', seen: o.date || date };
  list.push(r); if (list.length > 60) list.splice(0, list.length - 60);
  return r;
}
/** 플레이어와의 관계: 우리에게서 반란으로 갈라짐 / 평화 협상으로 우리에게서 풀려남 / 우리가 풀어 줌 / 남의 일. */
export function indepStance(r: OriginRecord, player: string): IndepStance {
  const p = norm(player); if (!p) return 'neutral';
  if (norm(r.from) === p) return r.kind === 'released' ? 'released_from_us' : 'against_us';
  if (norm(r.by) === p) return 'freed_by_us';
  return 'neutral';
}
const ym = (d: string) => { const m = /^(\d{3,5})\.(\d{1,2})/.exec(String(d || '')); return m ? Number(m[1]) * 12 + Number(m[2]) : null; };
/** 통신 번호를 너무 오래 못 찾았는지. */
export function indepExpired(r: IndepRecord, date: string): boolean { const a = ym(r.seen), b = ym(date); return a !== null && b !== null && b - a > INDEP_WAIT_MONTHS; }
/** 연대기에 남길 줄: 새 나라 쪽(대화에서 "우리는 ~에서 독립했다"를 기억), 부모 쪽. */
export function indepChronLines(r: OriginRecord): { child: string; parent: string } {
  // 연대기 문장은 기록할 때의 화면 언어로 남긴다(2026-10-19).
  return r.kind === 'rebels'
    ? { child: L(`${r.from}에 맞선 반란으로 ${r.planet ? r.planet + '을(를) 장악하며 ' : ''}독립해 새 나라를 세웠다.`, `Won independence in a revolt against ${r.from}${r.planet ? ', seizing ' + r.planet : ''}, and founded a new nation.`), parent: L(`반란으로 ${r.country}이(가) 갈라져 나가 독립을 선언했다.`, `${r.country} broke away in a revolt and declared independence.`) }
    : { child: L(`${r.by ? r.by + '의 평화 협상으로 ' : ''}${r.from}에서 풀려나 독립국이 되었다.`, `Was released from ${r.from}${r.by ? ' through peace talks with ' + r.by : ''} and became independent.`), parent: L(`${r.by ? r.by + '와(과)의 평화 협상으로 ' : ''}${r.country}을(를) 독립국으로 풀어 주었다.`, `Released ${r.country} as an independent nation${r.by ? ' through peace talks with ' + r.by : ''}.`) };
}
const STANCE_GUIDE: Record<IndepStance, string> = {
  against_us: 'The recipient (the player empire) is the very former ruler you threw off in revolt. Be unyielding and proud: make clear independence is irreversible and you will resist interference. It is an official document, so be firm without insults.',
  released_from_us: 'The recipient (the player empire) is the former ruler that had to give you up under a peace deal. Be cold and formal, and demand to be treated as an equal sovereign state from now on.',
  freed_by_us: 'The recipient (the player empire) is the nation whose peace talks won your independence. Express deep gratitude and hope for future friendship (do not promise any specific treaty).',
  neutral: 'The recipient (the player empire) has no direct part in this independence. Write a polite diplomatic document explaining the new nation\'s legitimacy and asking for recognition and peaceful relations.',
};
/** 독립 선언 회람 서신(AI). 본문만 받는다. 프롬프트는 영어(답 언어는 AI 라우터가 정함, 2026-10-19). */
export function declarationMessages(a: { player: string; date: string; r: OriginRecord; profile?: Profile }): ChatMessage[] {
  const { r, profile: p } = a; const stance = indepStance(r, a.player);
  const how = r.kind === 'rebels' ? `won independence in a revolt against ${r.from}${r.planet ? `, seizing ${r.planet}` : ''}` : `was released from ${r.from} through peace talks${r.by ? ` led by ${r.by}` : ''}`;
  const sys = [
    `You are the leadership of "${r.country}", a nation just born in the Stellaris galaxy. It ${how} (${r.date || a.date}).`,
    p ? `[Nation info] Government: ${p.gov || 'unknown'}, species: ${p.species || 'unknown'}, leader: ${p.ruler || 'unknown'}${p.title ? ` (${p.title})` : ''}.${p.ethicsText ? `\n[Ethics]\n${p.ethicsText}` : ''}` : '[Nation info] A new nation not yet known in detail.',
    `You are circulating a "Declaration of Independence" to every nation in the galaxy. Core message: "We are a legitimate state." Include why independence was unavoidable (describe what you suffered under the old rule only in general terms; do not invent specific events or figures), a demand that your sovereignty and borders be respected, and your stance going forward.`,
    `[Nation receiving this copy] ${a.player || 'the player empire'}. ${STANCE_GUIDE[stance]}`,
    'Format: an official declaration. First line: a title (e.g. "Declaration of Independence"), then a 4-7 sentence body, ending with the date and a signature with the leader\'s title and name. Do not write that anything was carried out in the game. Do not make treaties or declare war in this document.',
    'Output only the declaration text (no JSON, no explanation).',
  ].join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: `[${a.date}] Write the declaration of independence.` }];
}
/** AI 가 준 선언문 다듬기(코드 블록·따옴표 제거, 길이 제한). */
export function cleanDeclaration(v: unknown): string {
  return String(v ?? '').replace(/^```[a-z]*\s*|```\s*$/gi, '').replace(/^["“]|["”]$/g, '').trim().slice(0, 2400);
}

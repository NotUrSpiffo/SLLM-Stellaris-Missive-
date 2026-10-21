import { L } from './i18n-pick';
// 만찬 자원 선물(알파 6, 2026-10-17 사용자 확정): 대화 중 플레이어가 자원을 보내겠다고 하면 AI 응답에서 자원·양을 뽑아 확인 카드를 띄우고,
// 플레이어가 [보내기]를 눌러야만 게임에 적용한다. 상대가 부족한(ec 1~3) 자원을 100 이상 보내면 만찬당 한 번 호의 +1.
// 대화 호의와 합쳐 만찬당 총 5 상한(MAX_CONVERSATION_FAVORS)을 넘지 않는다. 모드 변경 없음: 앱이 콘솔 효과 한 줄을 만들어 보낸다.
export const GIFT_RES = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods'] as const;
export type GiftRes = typeof GIFT_RES[number];
/** 호의가 오르는 최소량(사용자 확정 100). 이보다 적으면 자원은 가고 감사 인사만. */
export const GIFT_MIN_FAVOR = 100;
/** 한 번에 보낼 수 있는 최대량(오타로 창고를 비우는 일을 막는 상한). */
export const GIFT_MAX = 100000;
export const GIFT_KO: Record<GiftRes, string> = { energy: '에너지', minerals: '광물', food: '식량', alloys: '합금', consumer_goods: '소비재' };
export interface GiftOffer { res: GiftRes; amt: number }

const ALIAS: Record<string, GiftRes> = { energy: 'energy', credits: 'energy', '에너지': 'energy', minerals: 'minerals', mineral: 'minerals', '광물': 'minerals', food: 'food', '식량': 'food',
  alloys: 'alloys', alloy: 'alloys', '합금': 'alloys', consumer_goods: 'consumer_goods', consumergoods: 'consumer_goods', goods: 'consumer_goods', '소비재': 'consumer_goods' };
export function giftRes(v: unknown): GiftRes | null { return typeof v === 'string' ? ALIAS[v.trim().toLowerCase().replace(/\s+/g, '_')] ?? ALIAS[v.trim()] ?? null : null; }
export function giftAmount(v: unknown): number | null { const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : Number(v); return Number.isSafeInteger(n) && n >= 1 && n <= GIFT_MAX ? n : null; }

/** AI 응답 JSON 의 gift 칸 { res, amount } → 제안. 형식이 틀리면 null(무시). */
export function parseGiftOffer(raw: unknown): GiftOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { res?: unknown; resource?: unknown; amount?: unknown; amt?: unknown };
  const res = giftRes(o.res ?? o.resource), amt = giftAmount(o.amount ?? o.amt);
  return res && amt ? { res, amt } : null;
}
/** 모델 응답 원문에서 gift 칸만 꺼낸다(parseReply 와 별개로, JSON 이 아니면 null). */
export function giftFromReply(raw: string): GiftOffer | null {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { const j = JSON.parse(raw.slice(s, e + 1)); return parseGiftOffer(j && j.gift); } catch { return null; }
}
/** 상대 제국이 이 자원이 부족한가(PROFILE ec: 에너지·광물·식량·합금·소비재 순, 1 재고 부족 2 월 적자 3 심각). */
export function isShort(ec: string | undefined, res: GiftRes): boolean {
  if (!ec || !/^[0-4]{5}$/.test(ec)) return false;
  const d = ec[GIFT_RES.indexOf(res)];
  return d === '1' || d === '2' || d === '3';
}
export type GiftFavorReason = 'ok' | 'small' | 'not_short' | 'already' | 'full';
/** 이 선물로 호의 +1 을 받을 수 있는가. already: 이 만찬에서 선물 호의를 이미 받음. settled: 대화 정산으로 이미 받은 호의 수(끝났을 때만). */
export function giftFavor(o: GiftOffer, ec: string | undefined, already: boolean, settled = 0, max = 5): { favor: boolean; reason: GiftFavorReason } {
  if (already) return { favor: false, reason: 'already' };
  if (!isShort(ec, o.res)) return { favor: false, reason: 'not_short' };
  if (o.amt < GIFT_MIN_FAVOR) return { favor: false, reason: 'small' };
  if (settled >= max) return { favor: false, reason: 'full' };
  return { favor: true, reason: 'ok' };
}
/** 만찬 끝 대화 호의 정산량: 선물로 이미 받은 호의만큼 상한에서 뺀다(만찬당 총 5). */
export function settleAmount(conversation: number, giftPaid: number, max = 5): number { return Math.max(0, Math.min(max - giftPaid, conversation)); }

/** 게임 명령 한 줄. check=true 면 창고만 확인(status=ok|short), 아니면 보낸다(status=sent|short|duplicate). 대상이 없으면 no_target.
 * 범위: every_country(대상 AI) 안의 prev = { … } 에서 THIS 는 플레이어, PREV 는 대상 제국(호의 지급 명령과 같은 구조). */
export function giftCommand(req: number, sid: string, idx: number, cid: string, o: GiftOffer, check: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(idx) || idx < 1 || !/^[a-f0-9]{32}$/.test(cid) || !GIFT_RES.includes(o.res) || giftAmount(o.amt) === null) throw new Error(L('선물 인자가 올바르지 않습니다.', 'Invalid gift arguments.'));
  const log = (status: string) => `log = "SLLM:GIFT/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/idx=${idx}/;/res=${o.res}/;/amt=${o.amt}/;/mode=${check ? 'check' : 'send'}/;/status=${status}"`;
  const enough = `has_resource = { type = ${o.res} amount >= ${o.amt} }`;
  const mark = `sllm_gift_${cid}`;
  const body = check
    ? `if = { limit = { ${enough} } ${log('ok')} } else = { ${log('short')} }`
    : `if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { NOT = { ${enough} } } ${log('short')} } else = { set_variable = { which = ${mark} value = 1 } add_resource = { ${o.res} = -${o.amt} } prev = { add_resource = { ${o.res} = ${o.amt} } } ${log('sent')} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_gift_found value = 0 } every_country = { limit = { is_ai = yes is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } has_communications = prev } prev = { set_variable = { which = sllm_gift_found value = 1 } ${body} } } if = { limit = { check_variable = { which = sllm_gift_found value = 0 } } ${log('no_target')} } clear_variable = sllm_gift_found }`;
}

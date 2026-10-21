// 만찬 표본 선물(알파 6 수집품 2단계, 2026-10-17 사용자 확정): 🏛 수집품 목록에서 표본을 골라 확인 카드 → 게임 확인 → [보내기].
// 보상(희귀도): common 호의 +1 / rare +1·관계 소 / epic +2 / exceptional +2·관계 대.
// 표본 선물 호의는 자원 선물 호의와 따로 세고, 대화·자원·표본을 합친 만찬 호의 상한 5 는 그대로다.
// 3단계(지도자 역요구): 지도자가 대화 중 플레이어의 표본 하나를 요구 → 주면 한 단계 높은 보상, 거절하면 물질주의 지도자만 신뢰 -30.
// 게임 쪽: 받는 쪽 can_give_specimen(이미 가졌는지·전시 자리) 확인 → give_specimen → 받은 것을 확인한 뒤에만 보낸 쪽 remove_specimen.
import { SPEC_BY_KEY, type SpecRarity } from './archive';
import { L } from './i18n-pick';

export type SpecOpinion = 'small' | 'large' | null;
export const SPEC_REWARD: Record<SpecRarity, { favor: number; opinion: SpecOpinion }> = {
  common: { favor: 1, opinion: null },
  rare: { favor: 1, opinion: 'small' },
  epic: { favor: 2, opinion: null },
  exceptional: { favor: 2, opinion: 'large' },
};
/** 관계 보정 이름(모드 common/opinion_modifiers/sllm_specimen_gift_opinion.txt). */
export const SPEC_OPINION_MOD: Record<'small' | 'large', string> = { small: 'sllm_specimen_gift_small', large: 'sllm_specimen_gift_large' };

/** 이번 표본 선물로 받을 호의. paid = 이 만찬에서 이미 받은(또는 정산된) 호의 합계. */
export function specimenFavor(rarity: SpecRarity, paid: number, max = 5, asked = false): number {
  const r = asked ? askedReward(rarity) : SPEC_REWARD[rarity];
  return r ? Math.max(0, Math.min(r.favor, max - Math.max(0, paid))) : 0;
}

// 수집품 3단계(2026-10-17 사용자 확정): 지도자가 먼저 달라고 한 표본을 주면 보상을 한 단계 높여 준다(희귀도 한 칸 위의 보상).
// 최고 등급(exceptional)은 더 올릴 칸이 없어 호의 +1 을 더한다. 만찬 호의 상한 5 는 그대로.
const NEXT_RARITY: Record<SpecRarity, SpecRarity | null> = { common: 'rare', rare: 'epic', epic: 'exceptional', exceptional: null };
export function askedReward(rarity: SpecRarity): { favor: number; opinion: SpecOpinion } {
  const n = NEXT_RARITY[rarity];
  return n ? SPEC_REWARD[n] : { favor: SPEC_REWARD.exceptional.favor + 1, opinion: 'large' };
}
/** 요구를 거절했을 때, 물질주의 지도자의 신뢰가 깎이는 양(그 밖의 지도자는 손해 없음). 신뢰는 게임 규칙대로 시간이 지나며 다시 쌓인다. */
export const REFUSE_TRUST = -30;
/** AI 응답 JSON 의 request 칸 { key } → 요구한 표본 키. 플레이어가 가진 표본(owned)만 인정, 형식이 틀리면 null. */
export function askFromReply(raw: string, owned: ReadonlySet<string>): string | null {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    const j = JSON.parse(raw.slice(s, e + 1));
    const k = j && j.request && typeof j.request === 'object' ? (j.request as { key?: unknown }).key : null;
    return typeof k === 'string' && /^[a-z0-9_]{1,80}$/.test(k) && SPEC_BY_KEY.has(k) && owned.has(k) ? k : null;
  } catch { return null; }
}
export type SpecRefuseStatus = 'trust_cut' | 'no_trust' | 'no_target' | 'duplicate';
/** 요구 거절 명령: 상대가 물질주의(일반·광신)면 add_trust -30, 아니면 아무 일 없음. 같은 요구는 한 번만(중복 표시). */
export function specimenRefuseCommand(req: number, sid: string, idx: number, cid: string, key: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(idx) || idx < 1 || !/^[a-f0-9]{32}$/.test(cid) || !SPEC_BY_KEY.has(key) || !/^[a-z0-9_]{1,80}$/.test(key)) throw new Error(L('표본 요구 거절 인자가 올바르지 않습니다.', 'Invalid arguments for refusing the specimen request.'));
  const log = (status: SpecRefuseStatus) => `log = "SLLM:SPECGIFT/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/idx=${idx}/;/k=${key}/;/mode=refuse/;/status=${status}"`;
  const mark = `sllm_specrefuse_${cid}`;
  const body = `if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } prev = { if = { limit = { OR = { has_ethic = ethic_materialist has_ethic = ethic_fanatic_materialist } } add_trust = { amount = ${REFUSE_TRUST} who = prev } ${log('trust_cut')} } else = { ${log('no_trust')} } } }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_specrefuse_found value = 0 } every_country = { limit = { is_ai = yes is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } has_communications = prev } prev = { set_variable = { which = sllm_specrefuse_found value = 1 } ${body} } } if = { limit = { check_variable = { which = sllm_specrefuse_found value = 0 } } ${log('no_target')} } clear_variable = sllm_specrefuse_found }`;
}

export type SpecGiftStatus = 'ok' | 'not_owned' | 'cant_receive' | 'no_target' | 'sent' | 'give_failed' | 'duplicate';
/** 게임 명령 한 줄. check=true 면 확인만(ok|not_owned|cant_receive), 아니면 보낸다(sent|give_failed|not_owned|cant_receive|duplicate). 대상이 없으면 no_target.
 * 범위: every_country(대상 AI) 안의 prev = { … } 에서 THIS 는 플레이어, PREV 는 대상 제국(자원 선물과 같은 구조). */
export function specimenGiftCommand(req: number, sid: string, idx: number, cid: string, key: string, check: boolean, opinion: SpecOpinion = null): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(idx) || idx < 1 || !/^[a-f0-9]{32}$/.test(cid) || !SPEC_BY_KEY.has(key) || !/^[a-z0-9_]{1,80}$/.test(key)) throw new Error(L('표본 선물 인자가 올바르지 않습니다.', 'Invalid specimen gift arguments.'));
  const log = (status: SpecGiftStatus) => `log = "SLLM:SPECGIFT/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/idx=${idx}/;/k=${key}/;/mode=${check ? 'check' : 'send'}/;/status=${status}"`;
  const mark = `sllm_specgift_${cid}`;
  const op = opinion ? ` prev = { add_opinion_modifier = { who = prev modifier = ${SPEC_OPINION_MOD[opinion]} } }` : '';
  const body = check
    ? `if = { limit = { NOT = { has_specimen = ${key} } } ${log('not_owned')} } else_if = { limit = { prev = { can_give_specimen = ${key} } } ${log('ok')} } else = { ${log('cant_receive')} }`
    : `if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { NOT = { has_specimen = ${key} } } ${log('not_owned')} } else_if = { limit = { prev = { NOT = { can_give_specimen = ${key} } } } ${log('cant_receive')} } else = { set_variable = { which = ${mark} value = 1 } prev = { give_specimen = { key = ${key} } } if = { limit = { prev = { has_specimen = ${key} } } remove_specimen = ${key}${op} ${log('sent')} } else = { ${log('give_failed')} } }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_specgift_found value = 0 } every_country = { limit = { is_ai = yes is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } has_communications = prev } prev = { set_variable = { which = sllm_specgift_found value = 1 } ${body} } } if = { limit = { check_variable = { which = sllm_specgift_found value = 0 } } ${log('no_target')} } clear_variable = sllm_specgift_found }`;
}

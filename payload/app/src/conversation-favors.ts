import { moodDelta } from './action';
import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)
export const CONVERSATION_TURNS=10;
export const MAX_CONVERSATION_FAVORS=5;
export function favorPoints(moods:number[]):number{return moods.reduce((n,m)=>n+Math.sign(moodDelta(m)),0);}
export function conversationFavors(moods:number[]):number{return Math.max(0,Math.min(MAX_CONVERSATION_FAVORS,favorPoints(moods)));}
export function favorsCommand(req:number,sid:string,idx:number,cid:string,amount:number):string{
 if(!Number.isSafeInteger(req)||req<1||!/^\d+$/.test(sid)||!Number.isSafeInteger(idx)||idx<1||!/^[a-f0-9]{32}$/.test(cid)||!Number.isSafeInteger(amount)||amount<1||amount>5)throw new Error(L('호의 지급 인자가 올바르지 않습니다.', 'Invalid favor grant arguments.'));
 const mark=`sllm_favor_claim_${cid}`;
 const log=(status:string,extra='')=>`log = "SLLM:FAVORS/;/req=${req}/;/sid=${sid}/;/cid=${cid}/;/idx=${idx}/;/status=${status}${extra}"`;
 // Within prev={...}, THIS is the human player and PREV is the selected foreign empire.
 const award=`if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } export_trigger_value_to_variable = { trigger = num_favors parameters = { target = prev } variable = sllm_favor_before } add_favors = { target = prev value = ${amount} } export_trigger_value_to_variable = { trigger = num_favors parameters = { target = prev } variable = sllm_favor_after } ${log('readback','/;/before=\\[This.sllm_favor_before]/;/after=\\[This.sllm_favor_after]')} clear_variable = sllm_favor_before clear_variable = sllm_favor_after }`;
 return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_favor_found value = 0 } every_country = { limit = { is_ai = yes is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } has_communications = prev } prev = { set_variable = { which = sllm_favor_found value = 1 } ${award} } } if = { limit = { check_variable = { which = sllm_favor_found value = 0 } } ${log('no_target')} } clear_variable = sllm_favor_found }`;
}

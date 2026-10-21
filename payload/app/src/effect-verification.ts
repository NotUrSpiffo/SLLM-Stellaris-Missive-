import { REWARD_POOLS, rewardModifier, MEET_TUNE } from './faction-meeting';
import { L } from './i18n-pick';
export interface VerifyEffect { id:string; label:string; /** 영어 이름(화면 언어 영어일 때, features/effect-verifier.ts 가 고름) */ labelEn?:string; scope:'country'|'faction'|'opinion'; modifier:string; expected?:number; prototype?:boolean }
export const VERIFY_EFFECTS: VerifyEffect[] = [
 ...Object.entries({war:['전쟁 연설','War speech'],laststand:['결사항전 연설','Last-stand speech'],discovery:['탐험 연설','Discovery speech'],civil:['민간 격려 연설','Civil encouragement speech']}).flatMap(([key,[label,en]])=>[1,2,3].map(n=>({id:`speech_${key}_${n}`,label:`${label} ${n}등급`,labelEn:`${en} tier ${n}`,scope:'country' as const,modifier:`sllm_speech_${key}_${n}`}))),
 ...Object.values(REWARD_POOLS).flat().map(r=>({id:`faction_${r.id}`,label:r.label,scope:r.scope,modifier:rewardModifier(r)})),
 {id:'faction_slighted',label:'표결 패배 파벌 승인도 −5%',labelEn:'Losing faction approval −5%',scope:'faction',modifier:MEET_TUNE.slightedModifier},
 {id:'faction_forced',label:'강제 통과 파벌 승인도 −15%',labelEn:'Forced passage faction approval −15%',scope:'faction',modifier:MEET_TUNE.forcedFactionModifier},
 {id:'faction_unrest',label:'강제 통과 안정도·영향력 제재',labelEn:'Forced passage stability/influence penalty',scope:'country',modifier:MEET_TUNE.forcedEmpireModifier},
 ...[1,2,3].map(n=>({id:`spy_output_${n}`,label:`첩보 실패 ${n}건 · 생산 −${9*n}% (시험 정의)`,labelEn:`${n} failed spy op(s) · output −${9*n}% (test definition)`,scope:'country' as const,modifier:`sllm_verify_spy_output_${n}`,prototype:true})),
 ...[1,2,3].map(n=>({id:`spy_opinion_${n}`,label:`첩보 실패 ${n}건 · 상대 관계 −${100*n} (시험 정의)`,labelEn:`${n} failed spy op(s) · their opinion −${100*n} (test definition)`,scope:'opinion' as const,modifier:`sllm_verify_spy_opinion_${n}`,expected:-100*n,prototype:true})),
 ...[1,2,3].map(n=>({id:`spy_live_output_${n}`,label:`첩보 제재(실사용) 생산 −${9*n}%`,labelEn:`Spy penalty (live) output −${9*n}%`,scope:'country' as const,modifier:`sllm_spy_output_${n}`})),
 ...[1,2,3].map(n=>({id:`spy_live_opinion_${n}`,label:`첩보 제재(실사용) 상대 관계 −${100*n}`,labelEn:`Spy penalty (live) their opinion −${100*n}`,scope:'opinion' as const,modifier:`sllm_spy_opinion_${n}`,expected:-100*n})),
];
export function verificationCommand(e:VerifyEffect,req:number,sid:string,target:number):string {
 if(!VERIFY_EFFECTS.some(x=>x.id===e.id&&x.modifier===e.modifier&&x.scope===e.scope)||!Number.isSafeInteger(req)||req<1||!/^\d+$/.test(sid)||!Number.isSafeInteger(target)||target<0)throw new Error(L('검증 인자가 올바르지 않습니다.', 'Invalid verification arguments.'));
 const log=(status:string,extra='')=>`log = "SLLM:VERIFY_EFFECT/;/sid=${sid}/;/req=${req}/;/id=${e.id}/;/status=${status}${extra}"`;
 const has=e.scope==='opinion'?`has_opinion_modifier = { who = prev modifier = ${e.modifier} }`:`has_modifier = ${e.modifier}`;
 const add=e.scope==='opinion'?`add_opinion_modifier = { who = prev modifier = ${e.modifier} days = 2 }`:`add_modifier = { modifier = ${e.modifier} days = 2 }`;
 const remove=e.scope==='opinion'?`remove_opinion_modifier = { who = prev modifier = ${e.modifier} }`:`remove_modifier = ${e.modifier}`;
 const opinion=(name:string)=>e.scope==='opinion'?`export_trigger_value_to_variable = { trigger = opinion parameters = { who = prev } variable = sllm_verify_${name} }`:'';
 const numbers=e.scope==='opinion'?'/;/before=\\[This.sllm_verify_before]/;/after=\\[This.sllm_verify_after]/;/restored=\\[This.sllm_verify_restored]':'';
 const test=`if = { limit = { ${has} } ${log('existing')} } else = { ${opinion('before')} ${add} ${opinion('after')} if = { limit = { ${has} } ${remove} ${opinion('restored')} if = { limit = { ${has} } ${log('cleanup_failed')} } else = { ${log('attached_removed',numbers)} } } else = { ${log('attach_failed')} } ${e.scope==='opinion'?'clear_variable = sllm_verify_before clear_variable = sllm_verify_after clear_variable = sllm_verify_restored':''} }`;
 let body=test;
 if(e.scope==='faction')body=`if = { limit = { any_pop_faction = { is_variable_set = sllm_fid check_variable = { which = sllm_fid value = ${target} } } } every_pop_faction = { limit = { is_variable_set = sllm_fid check_variable = { which = sllm_fid value = ${target} } } ${test} } } else = { ${log('no_target')} }`;
 if(e.scope==='opinion')body=`if = { limit = { any_country = { is_ai = yes is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${target} } has_communications = prev } } every_country = { limit = { is_ai = yes is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${target} } has_communications = prev } ${test} } } else = { ${log('no_target')} }`;
 return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;
}

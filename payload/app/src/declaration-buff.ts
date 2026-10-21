/** Declaration bonuses are independent of policy/speech modifiers. */
export function declarationBuffCommand(req: number, sid: string, playerIdx: number, side: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(Number(sid)) || !Number.isSafeInteger(playerIdx) || playerIdx < 0 || !['att', 'def'].includes(side)) throw new Error('Invalid declaration context');
  const modifier = side === 'att' ? 'sllm_declaration_offensive' : 'sllm_declaration_resistance';
  const log = (status: string) => `log = "SLLM:DECLBUFF/;/req=${req}/;/sid=[This.sllm_save_id]/;/status=${status}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } check_variable = { which = sllm_idx value = ${playerIdx} } } save_event_target_as = sllm_decl_player if = { limit = { any_war = { is_war_participant = { who = event_target:sllm_decl_player side = ${side === 'att' ? 'attackers' : 'defenders'} } } } if = { limit = { has_modifier = ${modifier} } ${log('duplicate')} } else = { add_modifier = { modifier = ${modifier} days = 720 } if = { limit = { has_modifier = ${modifier} } ${log('applied')} } else = { ${log('failed')} } } } else = { ${log('no_war')} } }`;
}

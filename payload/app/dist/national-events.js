"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nationalDate = nationalDate;
exports.validAnniversary = validAnniversary;
exports.foundingCommand = foundingCommand;
function nationalDate(date) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(date);
    if (!m)
        return null;
    const [year, month, day] = m.slice(1).map(Number);
    return Number.isSafeInteger(year) && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 30 ? { year, month, day } : null;
}
function validAnniversary(month, day) { return Number.isInteger(month) && Number(month) >= 1 && Number(month) <= 12 && Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 30; }
function foundingCommand(req, sid, idx, year) {
    if (![req, idx, year].every(Number.isSafeInteger) || req < 1 || idx < 0 || year < 1 || !/^\d+$/.test(sid))
        throw new Error('Invalid founding context');
    const log = (status) => `log = "SLLM:NATIONFX/;/req=${req}/;/sid=[This.sllm_save_id]/;/status=${status}"`;
    return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_idx value = ${idx} } check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { check_variable = { which = sllm_founding_reward_year value >= ${year} } } ${log('duplicate')} } else = { add_modifier = { modifier = sllm_founding_day days = 180 } if = { limit = { has_modifier = sllm_founding_day } set_variable = { which = sllm_founding_reward_year value = ${year} } ${log('applied')} } else = { ${log('failed')} } } }`;
}
//# sourceMappingURL=national-events.js.map
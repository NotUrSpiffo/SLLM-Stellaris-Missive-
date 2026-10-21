"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COND_KO = exports.GROUP_KO = exports.DISGRUNTLED = exports.FORCED_DAYS = exports.FORCED_MOD = exports.RULE_TEXT = void 0;
exports.reviewRule = reviewRule;
exports.reviewPolicy = reviewPolicy;
exports.forcedCommand = forcedCommand;
const i18n_pick_1 = require("./i18n-pick");
/** 정부 형태 번호(모드 sllm_probe_secretary auth: 1 민주 2 과두 3 독재 4 제국 5 기업 6 군체 7 기계, 0·없음 = 모름) → 심사 규칙. */
function reviewRule(auth) {
    if (auth === 1)
        return 'vote';
    if (auth === 3 || auth === 6 || auth === 7)
        return 'none';
    return 'force';
}
exports.RULE_TEXT = {
    vote: ['민주정: 파벌 표결에서 과반 찬성을 얻어야 선포할 수 있습니다(강행 불가).', 'Democracy: the factions must approve by majority before you can proclaim (no forcing).'],
    force: ['파벌 표결에서 부결돼도 강행할 수 있지만, 반대한 파벌의 승인도가 1년 동안 떨어집니다.', 'You may force it through even if the factions reject it, but the opposing factions lose approval for a year.'],
    none: ['독재정: 파벌 심사 없이 선포합니다.', 'Dictatorship: proclaimed without faction review.'],
};
/** 강행했을 때 반대 파벌에 거는 승인도 하락(모드 sllm_policy_review_modifiers.txt). */
exports.FORCED_MOD = 'sllm_policy_forced', exports.FORCED_DAYS = 360, exports.DISGRUNTLED = 0.35;
/** 가치관 × 버프 분야 점수(−2..2). */
const GROUP_AFFINITY = {
    militarist: { fleet: 2, army: 2, build: 1, explore: 1, diplomacy: -1 },
    pacifist: { fleet: -2, army: -2, diplomacy: 2, society: 1, economy: 1 },
    authoritarian: { empire: 2, leader: 1, army: 1, society: -1 },
    egalitarian: { society: 2, research: 1, economy: 1, empire: -1 },
    xenophile: { diplomacy: 2, trade: 2, explore: 1, army: -1 },
    xenophobe: { army: 1, fleet: 1, build: 1, diplomacy: -1, trade: -1 },
    materialist: { research: 2, build: 1, economy: 1, explore: 1 },
    spiritualist: { society: 2, empire: 1, research: -1 },
};
/** 가치관 × 정책 조건 점수. */
const COND_AFFINITY = {
    militarist: { rival: 2, naval: 1, friend: -1, peace: -2 },
    pacifist: { peace: 2, friend: 1, federation: 1, galcom: 1, pact: 1, rival: -2, naval: -1 },
    authoritarian: { subjects: 1, capstab: 1 },
    egalitarian: { galcom: 1, capstab: 1 },
    xenophile: { friend: 2, federation: 1, galcom: 1, pact: 1, rival: -1 },
    xenophobe: { rival: 2, friend: -2, federation: -1, galcom: -1, pact: -1 },
    materialist: { income: 1, pact: 1 },
    spiritualist: { capstab: 1, peace: 1 },
};
exports.GROUP_KO = {
    economy: ['경제', 'economy'], research: ['연구', 'research'], society: ['사회', 'society'], build: ['건설', 'construction'], empire: ['제국 운영', 'administration'], leader: ['지도자', 'leaders'],
    explore: ['탐사', 'exploration'], diplomacy: ['외교', 'diplomacy'], fleet: ['함대', 'the fleet'], army: ['지상군', 'armies'], trade: ['교역', 'trade'],
};
exports.COND_KO = {
    rival: ['경쟁 상대 압박', 'pressuring a rival'], friend: ['우호 관계', 'friendship'], peace: ['평화 유지', 'keeping the peace'], naval: ['해군 증강', 'naval buildup'], federation: ['연방', 'the federation'],
    galcom: ['은하 공동체', 'the Galactic Community'], pact: ['협약', 'pacts'], subjects: ['종속국', 'subjects'], capstab: ['수도 안정', 'capital stability'], income: ['수입 증대', 'income growth'],
};
/** 파벌 표결. groups = 고른 버프 분야 2개, conds = 뽑힌 조건 종류. 파벌이 없으면 null(심사 없이 통과). */
function reviewPolicy(factions, groups, conds) {
    const fs = factions.filter((f) => f && f.name && f.support > 0);
    if (!fs.length)
        return null;
    const votes = fs.map((f) => {
        let score = 0;
        const why = [];
        if (f.ethic) {
            const e = f.ethic;
            for (const g of groups) {
                const v = GROUP_AFFINITY[e]?.[g] ?? 0;
                if (v) {
                    score += v;
                    const n = exports.GROUP_KO[g] ?? [g, g];
                    why.push(v > 0 ? [`${n[0]} 강화 환영`, `welcomes more ${n[1]}`] : [`${n[0]} 강화 반대`, `opposes more ${n[1]}`]);
                }
            }
            for (const c of conds) {
                const v = COND_AFFINITY[e]?.[c] ?? 0;
                if (v) {
                    score += v;
                    const n = exports.COND_KO[c] ?? [c, c];
                    why.push(v > 0 ? [`${n[0]} 지지`, `supports ${n[1]}`] : [`${n[0]} 반대`, `opposes ${n[1]}`]);
                }
            }
        }
        if (f.approval < exports.DISGRUNTLED) {
            score -= 1;
            why.push(['정부에 불만', 'unhappy with the government']);
        }
        return { ...(f.fid !== undefined ? { fid: f.fid } : {}), name: f.name, ethic: f.ethic, support: f.support, vote: score > 0 ? 'yes' : score < 0 ? 'no' : 'abstain', score, why };
    });
    const sum = (k) => Math.round(votes.filter((v) => v.vote === k).reduce((a, v) => a + v.support, 0) * 1000) / 1000;
    const yes = sum('yes'), no = sum('no'), abstain = sum('abstain');
    return { votes, yes, no, abstain, passed: yes > no };
}
/** 강행: 반대한 파벌(sllm_f_id)에 승인도 하락 1년 → SLLM:POLICYFORCE req·sid·status. */
function forcedCommand(req, sid, fids) {
    const ids = fids.filter((x) => Number.isSafeInteger(x) && x > 0);
    if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !ids.length)
        throw new Error((0, i18n_pick_1.L)('강행 인자가 올바르지 않습니다.', 'Invalid force-through arguments.'));
    const log = (status) => `log = "SLLM:POLICYFORCE/;/req=${req}/;/sid=${sid}/;/status=${status}"`;
    return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } every_pop_faction = { limit = { OR = { ${ids.map((i) => `check_variable = { which = sllm_f_id value = ${i} }`).join(' ')} } } remove_modifier = ${exports.FORCED_MOD} add_modifier = { modifier = ${exports.FORCED_MOD} days = ${exports.FORCED_DAYS} } } ${log('applied')} }`;
}
//# sourceMappingURL=policy-review.js.map
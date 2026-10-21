"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOAL_INFO = exports.WARGOAL_CODES = void 0;
exports.parseWarInfo = parseWarInfo;
exports.describeWar = describeWar;
exports.warAggression = warAggression;
// 전쟁 정보(2026-10-20 알파 10): 모드 SLLM:WARINFO 한 줄(전쟁 시작 때)을 읽어 명분을 사람 말로 바꾼다. 전쟁 선언문·규탄 성명의 AI 요청에 들어간다.
// 코드 표는 모드 common/scripted_effects/sllm_probe_warinfo.txt 와 같다. 모르는 코드는 0(알 수 없는 명분).
exports.WARGOAL_CODES = {
    1: 'wg_conquest', 2: 'wg_humiliation', 3: 'wg_subjugation', 4: 'wg_tribute', 5: 'wg_independence', 6: 'wg_force_ideology', 7: 'wg_plunder', 8: 'wg_plunder_raid', 9: 'wg_cleansing', 10: 'wg_assimilation',
    11: 'wg_absorption', 12: 'wg_colossus', 13: 'wg_end_threat', 14: 'wg_counterattack', 15: 'wg_scion', 16: 'wg_hegemon', 17: 'wg_leave_hegemony', 18: 'wg_megacorp_subjugate', 19: 'wg_hostile_takeover', 20: 'wg_expel_corp',
    21: 'wg_allegiance', 22: 'wg_payback_stop_atrocities', 23: 'wg_nomad_raid', 24: 'wg_expel_nomads', 25: 'wg_imperial_crusade', 26: 'wg_galactic_civil_war_loyalists', 27: 'wg_galactic_civil_war_rebels', 28: 'wg_restore_the_community', 29: 'wg_proxy_war', 30: 'wg_blaze',
    31: 'wg_take_galatron', 32: 'wg_steal_galatron', 33: 'wg_sllm_humiliation', 34: 'wg_sllm_tribute', 35: 'wg_sllm_revenge', 36: 'wg_vs_fallen_empire',
};
exports.GOAL_INFO = {
    wg_conquest: { ko: '정복 — 영유권을 주장한 영토를 빼앗는다', en: 'Conquest — seize claimed territory', aggression: 2, kind: 'conquest' },
    wg_humiliation: { ko: '굴욕 — 상대를 무릎 꿇린다', en: 'Humiliation — bring the rival to its knees', aggression: 2, kind: 'punish' },
    wg_subjugation: { ko: '속국화 — 상대를 종속국으로 삼는다', en: 'Subjugation — make them a subject', aggression: 3, kind: 'vassal' },
    wg_tribute: { ko: '조공 — 상대를 조공국으로 삼는다', en: 'Tribute — make them a tributary', aggression: 3, kind: 'vassal' },
    wg_independence: { ko: '독립 — 종주국에서 벗어난다', en: 'Independence — break free from the overlord', aggression: 0, kind: 'independence' },
    wg_force_ideology: { ko: '이념 강요(해방) — 상대 정부를 우리 가치관으로 바꾼다', en: 'Impose ideology (liberation) — change their government to our ethics', aggression: 2, kind: 'liberate' },
    wg_plunder: { ko: '약탈', en: 'Plunder', aggression: 3, kind: 'raid' },
    wg_plunder_raid: { ko: '약탈 습격', en: 'Raid', aggression: 3, kind: 'raid' },
    wg_cleansing: { ko: '정화 — 상대 인구를 숙청한다', en: 'Cleansing — purge their population', aggression: 3, kind: 'purge' },
    wg_assimilation: { ko: '동화 — 상대 인구를 흡수한다', en: 'Assimilation — absorb their population', aggression: 3, kind: 'purge' },
    wg_absorption: { ko: '흡수 — 상대를 집단 의식에 흡수한다', en: 'Absorption — absorb them into the collective', aggression: 3, kind: 'purge' },
    wg_colossus: { ko: '총력전(콜로서스) — 행성째 파괴한다', en: 'Total war (Colossus) — destroy whole planets', aggression: 3, kind: 'purge' },
    wg_end_threat: { ko: '위협 제거 — 은하를 위협하는 세력을 끝낸다', en: 'End threat — stop a galactic menace', aggression: 0, kind: 'threat' },
    wg_counterattack: { ko: '반격 — 침략에 맞서 되친다', en: 'Counterattack — strike back at the aggressor', aggression: 0, kind: 'other' },
    wg_scion: { ko: '후계국 — 몰락 제국의 보호를 받는다', en: 'Scion — fallen-empire protection', aggression: 1, kind: 'other' },
    wg_hegemon: { ko: '패권 — 패권 연방에 끌어들인다', en: 'Hegemony — force them into the hegemony', aggression: 2, kind: 'vassal' },
    wg_leave_hegemony: { ko: '패권 이탈 — 패권 연방을 떠난다', en: 'Leave hegemony', aggression: 0, kind: 'independence' },
    wg_megacorp_subjugate: { ko: '기업 종속 — 상대를 기업 종속국으로', en: 'Corporate subjugation', aggression: 3, kind: 'vassal' },
    wg_hostile_takeover: { ko: '적대적 인수 — 상대 기업을 삼킨다', en: 'Hostile takeover', aggression: 2, kind: 'conquest' },
    wg_expel_corp: { ko: '기업 추방 — 상대 기업 지사를 쫓아낸다', en: 'Expel corporation', aggression: 1, kind: 'punish' },
    wg_allegiance: { ko: '충성 요구 — 숨은 충성 서약을 실현한다', en: 'Demand allegiance — honor a secret fealty', aggression: 2, kind: 'vassal' },
    wg_payback_stop_atrocities: { ko: '응징 — 잔혹 행위를 멈추게 한다', en: 'Payback — stop their atrocities', aggression: 0, kind: 'threat' },
    wg_nomad_raid: { ko: '유랑 습격', en: 'Nomad raid', aggression: 3, kind: 'raid' },
    wg_expel_nomads: { ko: '유랑 세력 축출', en: 'Expel nomads', aggression: 1, kind: 'punish' },
    wg_imperial_crusade: { ko: '제국 성전 — 은하 제국에 복속시킨다', en: 'Imperial crusade — bring them under the Imperium', aggression: 3, kind: 'vassal' },
    wg_galactic_civil_war_loyalists: { ko: '은하 내전 — 황제 측', en: 'Galactic civil war — loyalists', aggression: 1, kind: 'civil' },
    wg_galactic_civil_war_rebels: { ko: '은하 내전 — 반란 측', en: 'Galactic civil war — rebels', aggression: 1, kind: 'civil' },
    wg_restore_the_community: { ko: '공동체 복원 — 은하 제국을 무너뜨린다', en: 'Restore the Community — overthrow the Imperium', aggression: 1, kind: 'civil' },
    wg_proxy_war: { ko: '대리전', en: 'Proxy war', aggression: 2, kind: 'other' },
    wg_blaze: { ko: '불길 — 모든 것을 태운다', en: 'Blaze — burn everything', aggression: 3, kind: 'purge' },
    wg_take_galatron: { ko: '갤라트론 탈취', en: 'Take the Galatron', aggression: 2, kind: 'raid' },
    wg_steal_galatron: { ko: '갤라트론 강탈', en: 'Steal the Galatron', aggression: 2, kind: 'raid' },
    wg_sllm_humiliation: { ko: '굴욕(SLLM 외교 결렬)', en: 'Humiliation (SLLM diplomacy)', aggression: 2, kind: 'punish' },
    wg_sllm_tribute: { ko: '조공(SLLM 외교 결렬)', en: 'Tribute (SLLM diplomacy)', aggression: 3, kind: 'vassal' },
    wg_sllm_revenge: { ko: '복수(SLLM 외교 결렬)', en: 'Revenge (SLLM diplomacy)', aggression: 2, kind: 'punish' },
    wg_vs_fallen_empire: { ko: '몰락 제국 상대 흡수·정화', en: 'Purge or absorb a fallen empire', aggression: 3, kind: 'purge' },
};
const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
function parseWarInfo(kv) {
    const war = s(kv.war, 120);
    if (!war)
        return null;
    const code = (v) => { const n = Number(v); return Number.isSafeInteger(n) ? exports.WARGOAL_CODES[n] ?? '' : ''; };
    const rel = Number(kv.rel);
    return { war, attacker: s(kv.att, 120), defender: s(kv.def, 120), side: kv.side === 'att' ? 'att' : 'def', attGoal: code(kv.ag), defGoal: code(kv.dg), total: kv.total === '1', rel: rel === 1 ? 1 : rel === 2 ? 2 : 0, date: s(kv.date, 20) };
}
/** 전쟁의 성격 한 줄(AI 요청·화면용). 독립 전쟁과 종주국의 종속국 침공은 명분보다 관계가 먼저다. */
function describeWar(w, lang) {
    const g = exports.GOAL_INFO[w.attGoal], ko = lang === 'ko';
    const parts = [];
    if (w.rel === 2 || w.attGoal === 'wg_independence')
        parts.push(ko ? `독립 전쟁: ${w.attacker || '종속국'}이(가) 종주국 ${w.defender || ''}에게서 벗어나려 한다` : `War of independence: ${w.attacker || 'a subject'} rises against its overlord ${w.defender || ''}`);
    else if (w.rel === 1)
        parts.push(ko ? `종주국 ${w.attacker}이(가) 자기 종속국 ${w.defender}을(를) 친다` : `Overlord ${w.attacker} turns on its own subject ${w.defender}`);
    if (g)
        parts.push((ko ? '명분: ' : 'Casus belli: ') + (ko ? g.ko : g.en));
    else
        parts.push(ko ? '명분: 알 수 없음' : 'Casus belli: unknown');
    if (w.total)
        parts.push(ko ? '총력전(점령 즉시 병합)' : 'Total war (occupied systems change hands at once)');
    if (w.defGoal && exports.GOAL_INFO[w.defGoal])
        parts.push((ko ? '방어 측 목표: ' : 'Defender\'s goal: ') + (ko ? exports.GOAL_INFO[w.defGoal].ko : exports.GOAL_INFO[w.defGoal].en));
    return parts.join(' · ');
}
/** 침략성 0~3(규탄의 기본 입장에 쓴다). 독립 전쟁은 0, 총력전은 +1. */
function warAggression(w) {
    if (w.rel === 2 || w.attGoal === 'wg_independence')
        return 0;
    const base = exports.GOAL_INFO[w.attGoal]?.aggression ?? 1;
    return Math.min(3, base + (w.total ? 1 : 0));
}
//# sourceMappingURL=warinfo.js.map
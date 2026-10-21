// A-01 연방 정상회담의 순수 부분(Electron 없음, selftest 가 직접 부른다): 자리 배치, 결정 방식(연방 법에서 읽기), 집계.
// Shared view/model for live summit and offline demonstrations.
// 게임 쪽 이름(연방 종류·법 키)은 3.x 바닐라 기준 추정이다. 탐색팀 E-30·수집 결과(common/federation_laws)로 확인 필요.
import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

/** 연방회의 안건은 둘뿐이다: 결속 다지기(응집력), 전쟁 선포 찬반(2026-10-17 사용자 결정). 법·회장·회원 안건은 두지 않는다. */
export type FedAgendaKind = 'cohesion' | 'war';
export type FedVote = 'yes' | 'no' | 'abstain';
export type FedWeight = 'equal' | 'diplo';
export type FedPass = 'unanimous' | 'majority' | 'leader';

export interface FedMember {
  idx: number;
  name: string;
  /** 통치자 이름 */
  ruler: string;
  /** 통치자 직함(없으면 '통치자') */
  title?: string;
  /** 종족 계열 키(초상화) */
  cls?: string;
  /** 외교 가중치(표 무게가 외교 가중치일 때) */
  weight: number;
  /** 연방 회장 */
  leader: boolean;
  /** 플레이어 국가 */
  player: boolean;
  /** 이 안건에 대한 입장 -100(반대)~100(찬성). 플레이어는 쓰지 않음 */
  stance: number;
}
export interface FedInfo {
  sid: string;
  name: string;
  /** 연방 종류 키(예: trade_federation) */
  type: string;
  level: number;
  /** 응집력 0~100 */
  cohesion: number;
  /** 지금 켜진 연방 법 키 */
  laws: string[];
  members: FedMember[];
  /** 전쟁 선포 안건에서 고를 수 있는 대상(통신 가능한 일반 제국 가운데 회원국이 아닌 곳) */
  warTargets?: Array<{ idx: number; name: string }>;
  /** 가짜 데이터(시연판). 결정 적용을 막는다 */
  demo?: boolean;
}
export interface FedAgenda {
  kind: FedAgendaKind;
  /** 전쟁 선포: 대상 국가 idx */
  target?: number;
}
export interface FedRule { weight: FedWeight; pass: FedPass; known: boolean; source: string }
export interface FedTally {
  yes: number; no: number; abstain: number; total: number;
  /** 찬성 비율(%) */
  pct: number;
  passed: boolean;
  /** 판정 이유(화면 표시용) */
  reason: string;
  /** 투표에서 빠진 나라(내보내기 대상) */
  excluded: number[];
}

/** 연방 종류 이름(4.5.2 바닐라 common/federation_types 키로 확인). 모르는 키는 키를 그대로 보여 준다. */
export const FED_TYPES: Record<string, { name: string; en: string; tone: string }> = {
  default_federation: { name: '은하 연합', en: 'Galactic Union', tone: 'union' },
  trade_federation: { name: '무역 연맹', en: 'Trade League', tone: 'trade' },
  military_federation: { name: '군사 동맹', en: 'Martial Alliance', tone: 'military' },
  research_federation: { name: '연구 협력체', en: 'Research Cooperative', tone: 'research' },
  hegemony_federation: { name: '패권 연합', en: 'Hegemony', tone: 'hegemony' },
  spiritualist_federation: { name: '신성 서약', en: 'Holy Covenant', tone: 'holy' },
  imperial_loyalists_federation: { name: '제국 충성파 연합', en: 'Imperial Loyalists', tone: 'hegemony' },
};
export const fedTypeName = (t: string) => (FED_TYPES[t] ? L(FED_TYPES[t].name, FED_TYPES[t].en) : (t || L('연방', 'Federation')));

export const FED_AGENDAS: Record<FedAgendaKind, { name: string; effect: string; nameEn: string; effectEn: string; needs: '' | 'target' }> = {
  cohesion: { name: '결속 다지기', effect: '연방 응집력을 조금 올립니다(add_cohesion).', nameEn: 'Strengthen cohesion', effectEn: 'Raises federation cohesion a little (add_cohesion).', needs: '' },
  war: { name: '전쟁 선포 찬반', effect: '통과하면 연방 회장이 대상 국가에 선전포고하고 회원국이 함께 참전합니다(declare_war).', nameEn: 'War declaration vote', effectEn: 'If passed, the federation president declares war on the target and the members join (declare_war).', needs: 'target' },
};
/** 화면용 안건 이름(한/영). */
export const fedAgendaName = (k: FedAgendaKind): string => L(FED_AGENDAS[k].name, FED_AGENDAS[k].nameEn);
export const PASS_NAME: Record<FedPass, string> = { unanimous: '만장일치', majority: '다수결', leader: '회장 결정' };
export const WEIGHT_NAME: Record<FedWeight, string> = { equal: '한 나라 한 표', diplo: '외교 가중치' };
const PASS_EN: Record<FedPass, string> = { unanimous: 'Unanimous', majority: 'Majority', leader: 'President decides' };
const WEIGHT_EN: Record<FedWeight, string> = { equal: 'One empire, one vote', diplo: 'Diplomatic weight' };

/**
 * 결정 방식: 그 연방의 실제 법을 따른다(사용자 결정 2026-10-15). 못 읽으면 가장 보수적인 만장일치·한 나라 한 표.
 * - 표 무게: vote_weight_diplomatic → 외교 가중치, vote_weight_equal → 한 나라 한 표
 * - 전쟁 선포: declare_war_(unanimous|majority|president)_vote
 * - 확인하지 못한 안건 규칙은 앱 합의용 만장일치로 제한한다(게임 투표 규칙으로 단정하지 않음).
 */
export function decisionRule(info: Pick<FedInfo, 'laws' | 'type'>, kind: FedAgendaKind): FedRule {
  const has = (k: string) => info.laws.includes(k);
  const weight: FedWeight = has('vote_weight_diplomatic') || has('vote_weight_diplomatic_imperial_loyalists') ? 'diplo' : 'equal';
  const wKnown = weight === 'diplo' || has('vote_weight_equal');
  if (kind === 'war') {
    const m = info.laws.map((l) => /^declare_war_(unanimous|majority|president)_vote(?:_hegemony|_imperial_loyalists)?$/.exec(l)).find(Boolean);
    if (m) return { weight, pass: m[1] === 'president' ? 'leader' : (m[1] as FedPass), known: wKnown, source: m[0] };
    return { weight, pass: 'unanimous', known: false, source: L('전쟁 선포 법을 못 읽어 만장일치', 'War law unreadable, so unanimous') };
  }
  return { weight, pass: 'unanimous', known: false, source: L('게임의 결정 규칙을 확인하지 못해 앱 회담은 만장일치로 합의', 'Game voting rule unconfirmed, so the app summit needs unanimity') };
}

/** AI 입장 → 표(의회와 같은 기준: 25 이상 찬성, -25 이하 반대). */
export const voteOf = (stance: number): FedVote => (stance >= 25 ? 'yes' : stance <= -25 ? 'no' : 'abstain');

/** 안건이 성립하는가(전쟁 대상이 맞는가). 문제가 있으면 이유, 없으면 ''. */
export function agendaProblem(info: FedInfo, a: FedAgenda): string {
  const need = FED_AGENDAS[a.kind]?.needs;
  if (need === undefined) return L('알 수 없는 안건입니다.', 'Unknown agenda.');
  if (need === 'target') {
    const t = info.warTargets?.find((x) => x.idx === a.target);
    if (!t) return L('전쟁 대상을 고르세요.', 'Choose a war target.');
    if (info.members.some((m) => m.idx === a.target)) return L('연방 회원국에는 선전포고할 수 없습니다.', 'You cannot declare war on a federation member.');
  }
  return '';
}

/**
 * 집계: 플레이어는 고른 표, AI 는 입장에서 나온 표.
 * 만장일치 = 투표하는 모든 나라가 찬성(기권도 통과를 막음), 다수결 = 찬성 무게가 전체의 절반 초과, 회장 결정 = 회장의 표.
 */
export function tallyFed(info: FedInfo, agenda: FedAgenda, playerVote: FedVote, rule: FedRule): FedTally {
  const excluded: number[] = []; // 안건 때문에 투표에서 빠지는 나라는 없다(전쟁 대상은 회원국이 아님)
  const voters = info.members.filter((m) => !excluded.includes(m.idx));
  const w = (m: FedMember) => (rule.weight === 'diplo' ? Math.max(0, m.weight) : 1);
  const vote = (m: FedMember) => (m.player ? playerVote : voteOf(m.stance));
  let yes = 0, no = 0, abstain = 0;
  for (const m of voters) { const v = vote(m); if (v === 'yes') yes += w(m); else if (v === 'no') no += w(m); else abstain += w(m); }
  const r1 = (x: number) => Math.round(x * 10) / 10;
  yes = r1(yes); no = r1(no); abstain = r1(abstain);
  const total = r1(yes + no + abstain), pct = total > 0 ? Math.round((yes / total) * 1000) / 10 : 0;
  let passed = false, reason = '';
  if (!voters.length || total <= 0) reason = '투표할 나라가 없습니다.';
  else if (rule.pass === 'unanimous') {
    const notYes = voters.filter((m) => vote(m) !== 'yes');
    passed = notYes.length === 0;
    reason = passed ? '모든 회원국이 찬성했습니다.' : `만장일치가 아닙니다(찬성하지 않은 나라 ${notYes.length}곳).`;
  } else if (rule.pass === 'majority') {
    passed = yes > total / 2;
    reason = passed ? `찬성이 절반을 넘었습니다(${pct}%).` : `찬성이 절반을 넘지 못했습니다(${pct}%).`;
  } else {
    const ld = voters.find((m) => m.leader);
    if (!ld) reason = '회장이 투표하지 않아 결정할 수 없습니다.';
    else { const v = vote(ld); passed = v === 'yes'; reason = passed ? `회장(${ld.name})이 찬성했습니다.` : `회장(${ld.name})이 ${v === 'no' ? '반대' : '유보'}했습니다.`; }
  }
  return { yes, no, abstain, total, pct, passed, reason, excluded };
}

/** 회의 테이블(양 끝이 둥근 긴 탁자)의 위치(회담장 화면 비율 %). 화면과 자리 계산이 같이 쓴다. */
export const TABLE = { left: 20, right: 80, top: 41, bottom: 71 };
export type SeatSide = 'head' | 'foot' | 'far' | 'near';
/**
 * 긴 회의 테이블의 자리(회담장 화면 비율 %). 회장은 왼쪽 끝(상석), 플레이어는 맞은편 오른쪽 끝,
 * 나머지는 테이블 건너편(far, 위)과 이쪽(near, 아래)에 번갈아 앉는다. x 는 자리의 가운데, y 는 그 자리가 테이블에 닿는 선.
 * 플레이어가 회장이면 왼쪽 끝에 앉고, 남은 수가 홀수면 한 나라가 오른쪽 끝에 앉는다. 반환 순서는 members 순서와 같다.
 */
export function seatLayout(members: Array<Pick<FedMember, 'leader' | 'player'>>): Array<{ x: number; y: number; side: SeatSide }> {
  const n = members.length;
  const out: Array<{ x: number; y: number; side: SeatSide }> = new Array(n);
  if (!n) return out;
  let head = members.findIndex((m) => m.leader);
  if (head < 0) head = members.findIndex((m) => !m.player);
  if (head < 0) head = 0;
  let foot = members.findIndex((m, i) => m.player && i !== head);
  const rest = members.map((_, i) => i).filter((i) => i !== head && i !== foot);
  if (foot < 0 && rest.length % 2 === 1) foot = rest.shift()!;
  const mid = (TABLE.top + TABLE.bottom) / 2;
  out[head] = { x: TABLE.left - 1, y: mid, side: 'head' };
  if (foot >= 0) out[foot] = { x: TABLE.right + 1, y: mid, side: 'foot' };
  const far = rest.filter((_, k) => k % 2 === 0), near = rest.filter((_, k) => k % 2 === 1);
  // 양 끝의 둥근 부분은 비우고 곧은 부분(테이블 길이의 가운데 80%)에 고르게
  const x0 = TABLE.left + (TABLE.right - TABLE.left) * 0.12, x1 = TABLE.right - (TABLE.right - TABLE.left) * 0.12;
  const along = (k: number, cnt: number) => Math.round((x0 + ((x1 - x0) * (k + 0.5)) / cnt) * 10) / 10;
  far.forEach((i, k) => { out[i] = { x: along(k, far.length), y: TABLE.top, side: 'far' }; });
  near.forEach((i, k) => { out[i] = { x: along(k, near.length), y: TABLE.bottom, side: 'near' }; });
  return out;
}

/** 화면에 보낼 회의 상태 한 묶음(앱이 계산하고 화면은 그리기만 한다 — A-16 교훈). */
export function summitView(info: FedInfo, agenda: FedAgenda, playerVote: FedVote) {
  const rule = decisionRule(info, agenda.kind);
  const problem = agendaProblem(info, agenda);
  const tally = tallyFed(info, agenda, playerVote, rule);
  const seats = seatLayout(info.members);
  return {
    info: { ...info, typeName: fedTypeName(info.type), tone: FED_TYPES[info.type]?.tone ?? 'union' },
    agenda: { ...agenda, name: fedAgendaName(agenda.kind), effect: L(FED_AGENDAS[agenda.kind].effect, FED_AGENDAS[agenda.kind].effectEn), problem },
    rule: { ...rule, passName: L(PASS_NAME[rule.pass], PASS_EN[rule.pass]), weightName: L(WEIGHT_NAME[rule.weight], WEIGHT_EN[rule.weight]) },
    tally,
    playerVote,
    members: info.members.map((m, i) => ({ ...m, vote: m.player ? playerVote : voteOf(m.stance), seat: seats[i], excluded: tally.excluded.includes(m.idx) })),
  };
}

// ---- A-01 2단계(2026-10-15): 모드 줄 SLLM:FED·FEDMEMBER·FEDLAW·FEDEND 를 받아 FedInfo 로 만든다(순수, selftest 대상).
/** 모드 sllm_probe_fed_read 의 type 번호 순서(1부터). 4.5.2 바닐라 common/federation_types 순서와 같아야 한다. */
export const FED_TYPE_KEYS = ["default_federation", "trade_federation", "research_federation", "military_federation", "hegemony_federation", "spiritualist_federation", "imperial_loyalists_federation"] as const;
/** 모드가 하나씩 확인하는 연방 법 키(4.5.2 바닐라 common/federation_laws). 모드 파일과 같아야 한다(selftest). */
export const FED_LAW_KEYS: readonly string[] = ["allow_subjects_to_join_no", "allow_subjects_to_join_yes", "allow_subjects_to_join_yes_imperial_loyalists", "centralization_high", "centralization_imperial_loyalists", "centralization_low", "centralization_medium", "centralization_minimal", "centralization_very_high", "challenge_type_arena_combat", "challenge_type_bidding_war", "challenge_type_conclave", "challenge_type_psionic_battle", "challenge_type_thesis", "commercial_pact_no", "commercial_pact_yes", "declare_war_majority_vote", "declare_war_majority_vote_hegemony", "declare_war_president_vote", "declare_war_president_vote_imperial_loyalists", "declare_war_unanimous_vote", "federation_build_fleets_everyone", "federation_build_fleets_only_leader", "fleet_contribution_high", "fleet_contribution_high_hegemony", "fleet_contribution_high_martial", "fleet_contribution_high_trade", "fleet_contribution_low", "fleet_contribution_low_hegemony", "fleet_contribution_low_martial", "fleet_contribution_low_research", "fleet_contribution_low_trade", "fleet_contribution_medium", "fleet_contribution_medium_hegemony", "fleet_contribution_medium_martial", "fleet_contribution_medium_research", "fleet_contribution_medium_trade", "fleet_contribution_none", "free_migration_no", "free_migration_yes", "invite_members_majority_vote", "invite_members_president_vote", "invite_members_president_vote_hegemony", "invite_members_president_vote_imperial_loyalists", "invite_members_unanimous_vote", "kick_members_majority_vote", "kick_members_president_vote", "kick_members_president_vote_hegemony", "kick_members_president_vote_imperial_loyalists", "research_pact_no", "research_pact_yes", "succession_power_diplomatic_weight", "succession_power_economy", "succession_power_fleet", "succession_power_tech", "succession_term_perpetual", "succession_term_status_change", "succession_term_years_10", "succession_term_years_20", "succession_term_years_30", "succession_term_years_40", "succession_type_challenge", "succession_type_none", "succession_type_random", "succession_type_rotation", "succession_type_strongest", "succession_type_strongest_hegemony", "treaties_separate_no", "treaties_separate_no_imperial_loyalists", "treaties_separate_yes", "vote_weight_diplomatic", "vote_weight_diplomatic_imperial_loyalists", "vote_weight_equal"];
/** 법 묶음(같은 묶음 안에서 하나만 켜짐). 긴 접두어부터 맞춘다. */
export const FED_LAW_GROUPS = ['centralization', 'fleet_contribution', 'succession_type', 'succession_term', 'succession_power', 'federation_build_fleets', 'allow_subjects_to_join', 'vote_weight', 'declare_war', 'invite_members', 'kick_members', 'free_migration', 'treaties_separate', 'challenge_type', 'commercial_pact', 'research_pact'] as const;
export const lawGroup = (k: string): string => [...FED_LAW_GROUPS].sort((a, b) => b.length - a.length).find((g) => k === g || k.startsWith(g + '_')) ?? '';
export interface FedRead { none: boolean; name: string; type: string; level: number; cohesion: number; laws: string[]; members: Array<{ idx: number; name: string; ruler: string; title: string; weight: number; ai: boolean; leader: boolean }>; done: boolean }
/** 한 번 읽기(FED → FEDMEMBER… → FEDLAW… → FEDEND)를 모은다. FED 줄이 새로 오면 처음부터. */
export class FedCollector {
  cur: FedRead | null = null;
  feed(m: { kind: string; kv: Record<string, string> }): boolean {
    const kv = m.kv || {}, num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    if (m.kind === 'FED') {
      if (kv.none === '1') { this.cur = { none: true, name: '', type: '', level: 0, cohesion: 0, laws: [], members: [], done: true }; return true; }
      const ti = Math.round(num(kv.type));
      this.cur = { none: false, name: (kv.name || '').slice(0, 120), type: FED_TYPE_KEYS[ti - 1] ?? '', level: Math.max(1, Math.min(5, Math.round(num(kv.level, 1)))), cohesion: Math.max(-100, Math.min(100, Math.round(num(kv.coh)))), laws: [], members: [], done: false };
      return true;
    }
    const c = this.cur; if (!c || c.done) return false;
    if (m.kind === 'FEDMEMBER') {
      const idx = Math.round(num(kv.idx, -1)); if (idx <= 0) return true;
      const row = { idx, name: (kv.name || '').slice(0, 120), ruler: (kv.ruler || '').slice(0, 80), title: (kv.title || '').slice(0, 40), weight: Math.max(0, num(kv.weight)), ai: kv.ai !== '0', leader: kv.leader === '1' };
      const at = c.members.findIndex((x) => x.idx === idx); if (at >= 0) c.members[at] = row; else c.members.push(row);
      return true;
    }
    if (m.kind === 'FEDLAW') { const k = kv.key || ''; if (FED_LAW_KEYS.includes(k) && !c.laws.includes(k)) c.laws.push(k); return true; }
    if (m.kind === 'FEDEND') { c.done = true; return true; }
    return false;
  }
}
/** 읽은 결과 → 회담 정보. 플레이어(ai=0)가 회원이 아니거나 2개국 미만이면 null. AI 입장은 0으로 시작하고 실제 토론 응답에서 정함. */
export function fedInfoFrom(r: FedRead, sid: string, clsOf: (idx: number) => string = () => ''): FedInfo | null {
  if (r.none || !r.done || r.members.length < 2 || !r.members.some((m) => !m.ai)) return null;
  return {
    sid, name: r.name || fedTypeName(r.type), type: r.type, level: r.level, cohesion: r.cohesion, laws: [...r.laws],
    members: r.members.map((m) => ({ idx: m.idx, name: m.name, ruler: m.ruler, title: m.title || undefined, cls: clsOf(m.idx) || undefined, weight: m.weight, leader: m.leader, player: !m.ai, stance: 0 })),
  };
}

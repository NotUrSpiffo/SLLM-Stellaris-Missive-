// 평화 중재·강제 평화의 게임 연결(2026-10-17). 순수 함수: 콘솔 명령 만들기, 모드 로그 읽기, 넘길 성계 고르기.
// 규칙(사용자 결정 2026-10-17): 점령했고 점령국이 영유권을 가진 성계만 넘긴다. 영유권 밖 점령지는 종전 후 원래 주인에게 남는다.
// 실제 적용은 모드(sllm_probe_mediation.txt)가 적용 순간 조건을 다시 확인한다.
import type { SllmMessage } from './protocol';
import { wrapForPlayer } from './protocol';
import type { MediationClaim, MediationParty, MediationWar } from './mediation';
import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

export interface MedWarRow { name: string; a: number; d: number; ax: number; dx: number }
/** side 1 = p1(주 공격국 · 강제 평화에서는 플레이어) 소유를 p2 가 점령, 2 = 그 반대 */
export interface MedSysRow { side: 1 | 2; sid: number; name: string; claim: boolean; starbase: boolean; planets: number; occupiedPlanets: number }
export interface MedTransfer { sid: number; from: 'p1' | 'p2'; to: 'p1' | 'p2'; name: string }
export type MedTarget = { kind: 'ai'; a: number; d: number } | { kind: 'player'; tid: number };

const posInt = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
const num = (v: string | undefined) => { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) ? n : NaN; };

function findPart(req: number, t: MedTarget): string {
  if (!posInt(req)) throw new Error(L('요청 번호가 올바르지 않습니다.', 'Invalid request number.'));
  if (t.kind === 'ai') {
    if (!posInt(t.a) || !posInt(t.d) || t.a === t.d) throw new Error(L('교전국 번호가 올바르지 않습니다.', 'Invalid belligerent number.'));
    return `sllm_probe_med_find = { REQ = ${req} A = ${t.a} D = ${t.d} }`;
  }
  if (!posInt(t.tid)) throw new Error(L('상대 제국 번호가 올바르지 않습니다.', 'Invalid empire number.'));
  return `sllm_probe_med_find_player = { REQ = ${req} TID = ${t.tid} }`;
}
export function medWarsCommand(req: number): string {
  if (!posInt(req)) throw new Error(L('요청 번호가 올바르지 않습니다.', 'Invalid request number.'));
  return wrapForPlayer(`sllm_probe_med_wars = { REQ = ${req} }`);
}
export function medScanCommand(req: number, t: MedTarget): string {
  return wrapForPlayer(`${findPart(req, t)} sllm_probe_med_scan = yes`);
}
export function medApplyCommand(req: number, t: MedTarget, gives: MedTransfer[]): string {
  const seen = new Set<number>();
  for (const g of gives) {
    if (!posInt(g.sid) || seen.has(g.sid) || !['p1', 'p2'].includes(g.from) || !['p1', 'p2'].includes(g.to) || g.from === g.to) throw new Error(L('넘길 성계 목록이 올바르지 않습니다.', 'Invalid list of systems to transfer.'));
    seen.add(g.sid);
  }
  if (gives.length > 40) throw new Error(L('한 번에 넘길 수 있는 성계는 40개까지입니다.', 'Up to 40 systems can be transferred at once.'));
  return wrapForPlayer([findPart(req, t), ...gives.map((g) => `sllm_probe_med_give = { FROM = ${g.from} TO = ${g.to} SID = ${g.sid} }`), 'sllm_probe_med_peace = yes'].join(' '));
}

export function medWarFrom(m: SllmMessage): MedWarRow | null {
  if (m.kind !== 'MEDWAR') return null;
  const a = num(m.kv.a), d = num(m.kv.d), ax = num(m.kv.ax), dx = num(m.kv.dx);
  if (!posInt(a) || !posInt(d) || a === d) return null;
  return { name: m.kv.name ?? '', a, d, ax: Number.isFinite(ax) ? ax : 0, dx: Number.isFinite(dx) ? dx : 0 };
}
export function medSysFrom(m: SllmMessage): MedSysRow | null {
  if (m.kind !== 'MEDSYS') return null;
  const side = num(m.kv.side), sid = num(m.kv.sid);
  if ((side !== 1 && side !== 2) || !posInt(sid)) return null;
  const pl = num(m.kv.pl), po = num(m.kv.po);
  return { side: side as 1 | 2, sid, name: m.kv.name || L(`성계 #${sid}`, `System #${sid}`), claim: m.kv.claim === '1', starbase: m.kv.sb === '1', planets: Number.isFinite(pl) ? pl : 0, occupiedPlanets: Number.isFinite(po) ? po : 0 };
}
/** 같은 성계 번호가 두 번 오면 처음 것만 쓴다. */
export function uniqueRows(rows: MedSysRow[]): MedSysRow[] {
  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(r.sid) ? false : (seen.add(r.sid), true)));
}
/** 넘길 수 있는 성계 = 점령 + 점령국의 영유권. */
export function cessionCandidates(rows: MedSysRow[]): MedTransfer[] {
  return uniqueRows(rows).filter((r) => r.claim).map((r) => ({ sid: r.sid, name: r.name, from: r.side === 1 ? 'p1' : 'p2', to: r.side === 1 ? 'p2' : 'p1' }));
}
export function outsideClaims(rows: MedSysRow[]): MedSysRow[] { return uniqueRows(rows).filter((r) => !r.claim); }

export const claimIdOf = (sid: number) => `s${sid}`;
export function sidOfClaim(id: string): number | null { const m = /^s(\d+)$/.exec(id); return m ? Number(m[1]) : null; }

/** 실제 전쟁을 중재 테이블 자료로. 당사국 id 는 게임 제국 번호(sllm_idx). */
export function gameMediationWar(sid: string, war: MedWarRow, parties: [MediationParty, MediationParty], rows: MedSysRow[], date: string): MediationWar {
  const [p1, p2] = parties;
  const claims: MediationClaim[] = cessionCandidates(rows).map((t) => ({ id: claimIdOf(t.sid), system: t.name, claimant: t.to === 'p1' ? p1.id : p2.id, holder: t.from === 'p1' ? p1.id : p2.id, occupied: true }));
  const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
  const outside = outsideClaims(rows);
  const facts = [
    L(`게임에서 읽은 실제 전쟁입니다(${date || '날짜 미확인'} 기준).`, `This is a real war read from the game (as of ${date || 'unknown date'}).`),
    L(`전쟁 피로도: ${p1.name} ${pct(war.ax)} · ${p2.name} ${pct(war.dx)}`, `War exhaustion: ${p1.name} ${pct(war.ax)} · ${p2.name} ${pct(war.dx)}`),
    claims.length ? L(`영유권 안 점령지 ${claims.length}곳은 협상으로 넘길 수 있습니다.`, `${claims.length} occupied system(s) inside claims can be transferred by negotiation.`) : L('영유권 안에서 점령한 성계가 없습니다. 넘길 수 있는 영토가 없습니다.', 'No systems are occupied inside claims. There is no territory to transfer.'),
    ...(outside.length ? [L(`영유권 밖 점령지(종전 시 원래 주인에게 남음): ${outside.map((r) => `${r.name}(${r.side === 1 ? p2.name : p1.name} 점령)`).join(', ')}`, `Occupied systems outside claims (return to their owners at peace): ${outside.map((r) => `${r.name} (held by ${r.side === 1 ? p2.name : p1.name})`).join(', ')}`)] : []),
    L('합의가 이루어지면 게임에 종전·휴전과 선택한 성계 이전을 적용합니다. 적용 순간 점령·영유권을 다시 확인합니다.', 'If agreed, peace/truce and the chosen system transfers are applied in the game. Occupation and claims are re-checked at that moment.'),
  ];
  return { id: `game-${sid}-${war.a}-${war.d}`, name: war.name || L(`${p1.name} ↔ ${p2.name} 전쟁`, `${p1.name} ↔ ${p2.name} war`), source: 'game', parties: [p1, p2], facts, claims, goals: [], game: { sid, a: war.a, d: war.d } };
}

/** 합의한 협상안에서 실제로 넘길 성계. 백지평화 = 없음, 현상 유지 = 영유권 안 점령지 전부, 절충안 = 고른 것만. */
export function transfersForOffer(war: MediationWar, basis: 'white_peace' | 'status_quo' | 'negotiated', chosen: string[]): MedTransfer[] {
  if (basis === 'white_peace') return [];
  const ids = basis === 'status_quo' ? (war.claims ?? []).map((c) => c.id) : chosen;
  const [p1, p2] = war.parties;
  return ids.map((id) => {
    const c = (war.claims ?? []).find((x) => x.id === id), sid = sidOfClaim(id);
    if (!c || sid === null) throw new Error(L('알 수 없는 성계가 협상안에 있습니다.', 'The proposal contains an unknown system.'));
    const side = (pid: number): 'p1' | 'p2' => { if (pid === p1.id) return 'p1'; if (pid === p2.id) return 'p2'; throw new Error(L('성계의 당사국을 확인할 수 없습니다.', 'Could not determine which side owns the system.')); };
    return { sid, name: c.system, from: side(c.holder), to: side(c.claimant) };
  });
}

// ---- 해마다 중재 제안 알림(LLM 없음, 앱이 계산) ----
/** 확률 = 기본 + 양측 피로도 각각에 비례. 피로도는 0..1. */
export const MED_OFFER_TUNE = { base: 0.05, perExhaustion: 0.45, max: 0.9 };
export function mediationChance(ax: number, dx: number): number {
  const c = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
  const t = MED_OFFER_TUNE;
  return Math.min(t.max, t.base + t.perExhaustion * c(ax) + t.perExhaustion * c(dx));
}
/** 전쟁마다 따로 굴리고, 걸린 전쟁 가운데 확률이 가장 높은 하나만 고른다(한 해 한 번). rnd 는 0..1 난수. */
export function pickMediationOffer<T extends { ax: number; dx: number }>(wars: T[], rnd: () => number): (T & { chance: number }) | null {
  const hits = wars.map((w) => ({ ...w, chance: mediationChance(w.ax, w.dx) })).filter((w) => rnd() < w.chance);
  return hits.sort((a, b) => b.chance - a.chance)[0] ?? null;
}
/** 알림 문구: 어느 두 제국의 전쟁인지 정확히 'A-B 전쟁'으로. */
export function mediationOfferText(aName: string, dName: string, ax: number, dx: number): { title: string; body: string } {
  const pct = (x: number) => Math.round(Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)) * 100) + '%';
  return { title: L(`평화 중재 제안 · ${aName}-${dName} 전쟁`, `Peace mediation offer · ${aName}–${dName} war`), body: L(`${aName}-${dName} 전쟁으로 양국이 지쳐 있습니다(피로도 ${aName} ${pct(ax)} · ${dName} ${pct(dx)}). 평화 중재를 시도하시겠습니까?`, `Both sides are exhausted by the ${aName}–${dName} war (war exhaustion ${aName} ${pct(ax)} · ${dName} ${pct(dx)}). Attempt peace mediation?`) };
}
/** 해가 바뀌었는지: 처음 보는 세이브는 그해를 기록만 하고 굴리지 않는다. */
export function mediationYearDue(lastYear: number | undefined, date: string): { due: boolean; year: number | null } {
  const y = Number(/^(\d+)\./.exec(date)?.[1]);
  if (!Number.isSafeInteger(y)) return { due: false, year: null };
  return { due: lastYear !== undefined && y > lastYear, year: y };
}

export interface MedGiveResult { sid: number; name: string; to: 'p1' | 'p2'; status: 'transferred' | 'unverified' | 'skipped' | 'unknown' }
export interface MedApplyResult { peace: 'peace' | 'still_war' | 'no_war' | 'unknown'; gives: MedGiveResult[] }
export function readApply(end: SllmMessage, gives: SllmMessage[], plan: MedTransfer[]): MedApplyResult {
  const peace = end.kv.found === '0' ? 'no_war' : end.kv.peace === '1' ? 'peace' : end.kv.peace === '2' ? 'still_war' : end.kv.peace === '0' ? 'no_war' : 'unknown';
  return {
    peace,
    gives: plan.map((t) => {
      const g = gives.find((m) => Number(m.kv.sid) === t.sid);
      const status = !g ? 'unknown' : g.kv.hit === '2' ? 'transferred' : g.kv.hit === '1' ? 'unverified' : g.kv.hit === '0' ? 'skipped' : 'unknown';
      return { sid: t.sid, name: t.name, to: t.to, status };
    }),
  };
}
export function applySummary(r: MedApplyResult, names: { p1: string; p2: string }): string[] {
  const head = r.peace === 'peace' ? L('게임 적용: 종전·휴전 확인', 'Applied in game: peace/truce confirmed') : r.peace === 'still_war' ? L('게임 적용: 이 전쟁은 끝냈지만 두 나라가 다른 전쟁으로 아직 교전 중', 'Applied in game: this war ended, but the two are still fighting in another war') : r.peace === 'no_war' ? L('게임 적용 실패: 해당 전쟁을 찾지 못했습니다(이미 끝났거나 참전국이 바뀜). 아무것도 바꾸지 않았습니다.', 'Game apply failed: the war was not found (it ended or its participants changed). Nothing was changed.') : L('게임 적용 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다.', 'Could not confirm the result in the game. It will not be resent automatically.');
  const st: Record<MedGiveResult['status'], string> = { transferred: L('이전 확인', 'Transfer confirmed'), unverified: L('이전 요청(소유 확인 못 함)', 'Transfer requested (ownership unconfirmed)'), skipped: L('조건 불충족으로 이전 안 함', 'Not transferred (conditions not met)'), unknown: L('결과 미확인', 'Result unknown') };
  return [head, ...r.gives.map((g) => `${g.name} → ${names[g.to]}: ${st[g.status]}`), ...(r.gives.length ? [] : [L('영토 이전 없음', 'No territory transferred')])];
}

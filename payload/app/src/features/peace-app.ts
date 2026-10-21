// 평화 중재·강제 평화 게임 연결(2026-10-17). 모드 sllm_probe_mediation.txt 와 주고받는다.
// 읽기(전쟁 목록·점령 상황)와 적용(성계 이전·종전·휴전)은 모두 요청 번호로 묶고, 결과는 게임이 다시 확인한 값만 믿는다.
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { link } from '../app/game-link';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies, terminal } from './terminal';
import { MedWarRow, MedSysRow, MedTarget, MedTransfer, MedApplyResult, medWarsCommand, medScanCommand, medApplyCommand, medWarFrom, medSysFrom, cessionCandidates, uniqueRows, readApply, applySummary } from '../peace-core';
import { L } from '../i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

const rowsOf = new Map<string, SllmMessage[]>();
const ENDS: Record<string, string> = { MEDWARS_END: 'MEDWAR', MEDSCAN_END: 'MEDSYS', MEDAPPLY_END: 'MEDGIVE' };
export function registerPeace(router: LogRouter): void {
  router.on(SLOT.PEACE, 'peace', (m: SllmMessage) => {
    if (m.kind === 'MEDWAR' || m.kind === 'MEDSYS' || m.kind === 'MEDGIVE') {
      const key = m.kind + ':' + m.kv.req, list = rowsOf.get(key);
      if (list && list.length < 400) list.push(m);
    } else if (ENDS[m.kind]) terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
}
/** 요청을 보내고 끝 줄을 기다린 뒤, 그 사이에 온 목록 줄을 함께 돌려준다. */
async function request(build: (req: number) => string, end: keyof typeof ENDS): Promise<{ end: SllmMessage; rows: SllmMessage[] }> {
  if (!ctx.gameRunning) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  const req = ++link.reqCounter, key = ENDS[end] + ':' + req;
  rowsOf.set(key, []);
  try {
    const m = await terminalRequest(build(req), end, req);
    if (m.kv.sid !== ctx.curSaveId) throw new Error(L('세이브가 바뀌어 결과를 쓰지 않았습니다.', 'The save changed, so the result was not written.'));
    return { end: m, rows: rowsOf.get(key) ?? [] };
  } finally { rowsOf.delete(key); }
}
export async function refreshContacts(): Promise<void> {
  const req = ++link.reqCounter;
  await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
}
const isRegularContact = (idx: number) => terminal.sid === ctx.curSaveId && terminal.items.some((c) => c.idx === idx && c.type === 'default' && !!c.name.trim());
/** 연방회의 전쟁 선포 대상: 통신 가능한 일반 제국 가운데 연방 회원국이 아닌 곳. */
export const fedWarTargets = (memberIdx: number[]): Array<{ idx: number; name: string }> =>
  terminal.sid !== ctx.curSaveId ? [] : terminal.items.filter((c) => c.type === 'default' && !!c.name.trim() && !memberIdx.includes(c.idx)).map((c) => ({ idx: c.idx, name: c.name }));
export const contactName = (idx: number) => terminal.items.find((c) => c.idx === idx)?.name || `제국 #${idx}`;

/** 플레이어가 끼지 않은, 통신 가능한 일반 제국 끼리의 전쟁. 양쪽 다 연락처에 이름이 있는 일반 제국(type default)일 때만 돌려준다. */
export async function listGameWars(): Promise<(MedWarRow & { aName: string; dName: string })[]> {
  await refreshContacts();
  const r = await request(medWarsCommand, 'MEDWARS_END');
  const seen = new Set<string>();
  return r.rows.map(medWarFrom).filter((w): w is MedWarRow => !!w).filter((w) => { const k = w.a + ':' + w.d; return seen.has(k) ? false : (seen.add(k), true); })
    .filter((w) => isRegularContact(w.a) && isRegularContact(w.d))
    .map((w) => ({ ...w, aName: contactName(w.a), dName: contactName(w.d) }));
}
/** 전쟁의 지금 점령 상황. found=false 면 전쟁을 찾지 못함. */
export async function scanWar(t: MedTarget): Promise<{ found: boolean; rows: MedSysRow[] }> {
  const r = await request((req) => medScanCommand(req, t), 'MEDSCAN_END');
  return { found: r.end.kv.found === '1', rows: uniqueRows(r.rows.map(medSysFrom).filter((x): x is MedSysRow => !!x)) };
}
export async function applyPeace(t: MedTarget, plan: MedTransfer[]): Promise<MedApplyResult> {
  const r = await request((req) => medApplyCommand(req, t, plan), 'MEDAPPLY_END');
  const result = readApply(r.end, r.rows, plan);
  logDiagnostic('info', 'peace.apply', { kind: t.kind, peace: result.peace, gives: result.gives.map((g) => g.status) });
  return result;
}

/** 대화에서 합의한 평화(플레이어 ↔ AI 둘만의 전쟁): 현상 유지 규칙 — 영유권 안 점령지는 점령국에, 나머지는 원래 주인에게. */
export async function playerPeace(tid: number, enemyName: string): Promise<{ outcome: 'ok' | 'fail' | 'timeout'; text: string; lines: string[] }> {
  try {
    const t: MedTarget = { kind: 'player', tid };
    const scan = await scanWar(t);
    if (!scan.found) return { outcome: 'fail', text: L('실패: 둘만의 전쟁이 아니거나 전쟁 중이 아닙니다.', 'Failed: this is not a two-party war, or they are not at war.'), lines: [] };
    const plan = cessionCandidates(scan.rows);
    const res = await applyPeace(t, plan);
    const lines = applySummary(res, { p1: ctx.playerName || '우리 제국', p2: enemyName });
    if (res.peace === 'no_war') return { outcome: 'fail', text: lines.join('\n'), lines };
    return { outcome: res.peace === 'unknown' ? 'timeout' : 'ok', text: lines.join('\n'), lines };
  } catch (e) {
    const msg = (e as Error).message;
    logDiagnostic('warn', 'peace.player.failed', { error: msg });
    return { outcome: /응답이 없습니다/.test(msg) ? 'timeout' : 'fail', text: L('평화 처리 실패: ', 'Peace processing failed: ') + msg, lines: [] };
  }
}

// 함대 사령부(앱 쪽, 2026-10-17) — 제독 전투 기록(최근 3건)과 청문회(기자회견·직접 대면). 순수 로직은 src/fleet.ts.
// 라디오와 겹치지 않게 전용 on_actions·이벤트(sllm_fleet)와 전용 로그 자리(FLEET 246)만 쓴다.
import { glassWin } from '../office';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { FleetStore, BattleCollector, Hearing, addBattle, canHear, newHearing, pressRound, faceTurn, judgeCase, abandon, readyToJudge, goodCount, parsePressRound, parseVerdict, checkText, pressRoundMessages, faceMessages, verdictMessages, admiralApplyCommand, battleText, KEEP_BATTLES, FACE_TURNS, ADM_XP, TEXT_MAX } from '../fleet';
import type { SllmMessage } from '../protocol';
import { redactKey, conversationOf } from '../aiclient';
import { logDiagnostic } from '../diagnostics';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { safeSend } from '../safe-send';
import { chronNoteWorld } from './chronicle-app';
import { terminalRequest, terminalReplies } from './terminal';
import { pick } from './settings-ui';
import { classKey } from '../speciesClass';

const L = pick; // 한국어·영어·언어 팩(2026-10-18)
export const fleet = { win: null as BrowserWindow | null, busy: false, hearing: null as { sid: string; h: Hearing } | null, collector: new BattleCollector() };
let storeInst: FleetStore | null = null;
const store = () => (storeInst ??= new FleetStore(path.join(app.getPath('userData'), 'sllm_fleet.json')));
const admirals = () => (ctx.curSaveId ? store().get(ctx.curSaveId).admirals : {});
const curHearing = () => (fleet.hearing && fleet.hearing.sid === ctx.curSaveId ? fleet.hearing : null);

export function fleetView() {
  const list = Object.values(admirals()).sort((a, b) => (b.battles.at(-1)?.date ?? '').localeCompare(a.battles.at(-1)?.date ?? '') || a.name.localeCompare(b.name, 'ko'));
  const h = curHearing()?.h ?? null;
  return { sid: ctx.curSaveId, running: ctx.gameRunning, busy: fleet.busy, empire: ctx.playerName, cls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human', // 지휘관 초상화 = 플레이어 종족 계열(2026-10-18)
    keep: KEEP_BATTLES, faceTurns: FACE_TURNS, xp: ADM_XP, textMax: TEXT_MAX,
    admirals: list.map((a) => ({ ...a, canHear: canHear(a), battles: a.battles.map((b) => ({ ...b, text: battleText(b) })) })),
    hearing: h ? { ...h, good: goodCount(h), ready: readyToJudge(h), cases: h.cases.map((c) => ({ ...c, text: battleText(c.battle) })) } : null };
}
const push = () => safeSend(fleet.win, 'fleetState', fleetView());
export function openFleet(glass = false) {
  if (fleet.win && !fleet.win.isDestroyed()) { fleet.win.show(); fleet.win.focus(); push(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1300, Math.round(area.width * 0.84)), height: Math.min(900, Math.round(area.height * 0.88)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  fleet.win = new BrowserWindow({ ...sz, x, y, minWidth: 860, minHeight: 560, frame: false, show: false, backgroundColor: '#06141b', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  fleet.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void fleet.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'fleet.html'));
  fleet.win.once('ready-to-show', () => { fleet.win?.show(); push(); });
  // 청문회 도중 창을 닫으면 남은 전투는 나쁨으로 보고 결과를 확정한다(첩보 청문회와 같은 규칙).
  fleet.win.on('close', () => { const c = curHearing(); if (c && !c.h.done) { c.h = abandon(c.h); void applyOutcome(c); } });
  fleet.win.on('closed', () => { fleet.win = null; });
}
export function closeFleet() { if (fleet.win && !fleet.win.isDestroyed()) fleet.win.close(); }

function profile(name: string): string { return name ? `${name}` : ''; }
/** 끝난 청문회 결과를 게임에 건다(무난이면 보낼 것 없음). 보내기 전에 기록, 응답이 없어도 다시 보내지 않는다. 끝나면 그 제독의 전투 기록을 비운다(다음 청문회는 새 전투 3건). */
async function applyOutcome(c: { sid: string; h: Hearing }) {
  const h = c.h; if (!h.done || h.applied) return;
  const a = store().get(c.sid).admirals[String(h.lid)], date = ctx.gameDate;
  const finish = (msg: string) => { h.applied = msg; if (a) { a.battles = []; a.hearings++; a.notified = false; if (h.outcome === 'acclaimed' || h.outcome === 'reprimanded') { a.status = h.outcome; a.statusDate = date; } } store().save(); push(); };
  if (h.outcome === 'neutral') { finish(L('무난: 좋음 2건 · 효과 없음', 'Neutral: 2 good · no effect')); return; }
  if (!/^\d+$/.test(c.sid) || c.sid !== ctx.curSaveId || !ctx.gameRunning) { finish(L('게임이 꺼져 있거나 세이브가 바뀌어 적용하지 않았습니다.', 'Not applied: game closed or save changed.')); return; }
  const cid = randomUUID().replace(/-/g, ''), req = ++link.reqCounter; h.applied = L('게임에 적용하는 중…', 'Applying in game…');
  if (a) { a.battles = []; store().save(); } // 보내기 전에 이 전투 기록을 비워 둔다: 응답 전에 앱이 꺼져도 같은 전투로 청문회를 다시 열어 두 번 적용하지 않게(2026-10-18)
  push();
  let status = 'uncertain';
  try { const r = await terminalRequest(admiralApplyCommand(req, c.sid, cid, h.lid, h.outcome as 'acclaimed' | 'reprimanded'), 'ADMAPPLY', req); if (r.kv.cid === cid && r.kv.sid === c.sid) status = r.kv.status ?? 'uncertain'; }
  catch (e) { logDiagnostic('warn', 'fleet.apply.failed', { error: String(e) }); }
  const acc = h.outcome === 'acclaimed';
  const msg = status === 'applied' ? (acc ? L(`추앙: 함대 무기 피해·지상군 피해 +5% (1년) · 경험치 +${ADM_XP}`, `Acclaimed: fleet weapon & army damage +5% (1 yr) · XP +${ADM_XP}`) : L('질책: 함대·지상군 피해 −5% · 감봉(유지비 −25%) (1년)', 'Reprimanded: fleet & army damage −5% · pay cut (upkeep −25%) (1 yr)'))
    : status === 'no_target' ? L('게임에서 이 지휘관을 찾지 못해 적용하지 않았습니다.', 'This commander was not found in game; nothing applied.')
    : status === 'duplicate' ? L('이미 적용한 결정입니다.', 'Already applied.')
    : L('게임 적용을 확인하지 못했습니다(자동 재전송 없음).', 'Could not confirm in game (no automatic resend).');
  if (status === 'applied') chronNoteWorld(L(`지휘관 ${h.name}이(가) ${h.mode === 'press' ? '기자회견' : '지도자 대면'} 청문회에서 ${acc ? '추앙받았다' : '질책받았다'} (${date})`, `Commander ${h.name} was ${acc ? 'honored' : 'reprimanded'} at a ${h.mode === 'press' ? 'press conference' : 'face-to-face'} hearing (${date})`), false);
  finish(msg);
  logDiagnostic('info', 'fleet.hearing', { outcome: h.outcome, status, mode: h.mode });
}
const guard = (e: Electron.IpcMainInvokeEvent) => !!fleet.win && e.sender === fleet.win.webContents;

export function registerFleet(router: LogRouter): void {
  router.on(SLOT.FLEET, 'fleet:battle', (m: SllmMessage) => {
    if (m.kind === 'ADMAPPLY') { terminalReplies.get('ADMAPPLY:' + m.kv.req)?.(m); return; }
    if (m.kind === 'ADMEXPIRE') { const a = Object.values(admirals()).find((x) => String(x.lid) === m.kv.lid); if (a) { a.status = 'none'; store().save(); push(); } return; }
    const b = fleet.collector.feed(m); if (!b || !ctx.curSaveId) return;
    const a = addBattle(store().get(ctx.curSaveId).admirals, b); if (!a) return;
    if (canHear(a) && !a.notified) { a.notified = true; ctx.notify({ kind: 'fleet', title: L(`지휘관 ${a.name}: 전투 기록 ${KEEP_BATTLES}건`, `Commander ${a.name}: ${KEEP_BATTLES} battles on record`), body: L('청문회를 열 수 있습니다.', 'A hearing can now be held.'), action: L('함대 사령부', 'Fleet Command') }); }
    store().save(); push();
  });
  ipcMain.handle('fleetState', async () => fleetView());
  ipcMain.handle('fleetClose', async (e) => { if (!guard(e)) return false; closeFleet(); return true; });
  ipcMain.handle('fleetHearing', async (e, lid: unknown, mode: unknown) => {
    if (!guard(e)) return { ok: false, error: L('함대 사령부 창에서만 열 수 있습니다.', 'Can only be opened from the Fleet Command window.') };
    if (fleet.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    const c = curHearing(); if (c && !c.h.done) return { ok: false, error: L('진행 중인 청문회가 있습니다.', 'A hearing is already in progress.') };
    if (mode !== 'press' && mode !== 'face') return { ok: false, error: L('청문 방식을 고르세요.', 'Choose a hearing format.') };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 청문회를 열 수 있습니다.', 'The game must be running to hold a hearing.') };
    const a = admirals()[String(lid)];
    try { fleet.hearing = { sid: ctx.curSaveId, h: newHearing(a!, mode) }; push(); return { ok: true }; } catch (err) { return { ok: false, error: (err as Error).message }; }
  });
  /** 기자회견: 지금 전투의 공방 4줄을 만들고 바로 평가한다. */
  ipcMain.handle('fleetPressNext', async (e) => {
    if (!guard(e)) return { ok: false, error: L('함대 사령부 창에서만 진행할 수 있습니다.', 'Can only be done from the Fleet Command window.') };
    const c = curHearing(); if (!c || c.h.done || c.h.mode !== 'press') return { ok: false, error: L('진행 중인 기자회견이 없습니다.', 'No press conference in progress.') };
    if (fleet.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    fleet.busy = true; push();
    try {
      const h0 = c.h; let h = h0, lines = null as ReturnType<typeof parsePressRound> | null;
      for (let i = 0; i < 2 && !lines; i++) { try { lines = parsePressRound(await ctx.ai.chat(pressRoundMessages(ctx.playerName, h, profile(h.name)), { purpose: 'fleet-press', json: true, maxTokens: 1400 * (i + 1) })); } catch (err) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'fleet-press', attempt: i + 1, error: String(err) }); } }
      if (!lines) return { ok: false, error: L('기자회견 공방을 만들지 못했습니다. 다시 눌러 주세요.', 'Could not generate the press exchange. Press again.') };
      // AI 를 기다리는 동안 창을 닫아 청문회가 끝났으면(abandon → 결과 적용) 이 응답으로 덮어쓰지 않는다. 덮어쓰면 같은 결과가 게임에 두 번 들어간다(2026-10-18).
      if (c.h !== h0 || h0.done) return { ok: false, error: L('청문회가 바뀌었습니다.', 'The hearing changed.') };
      h = pressRound(h, lines); c.h = h; push();
      return await judgeNow(c);
    } catch (err) { return { ok: false, error: redactKey((err as Error).message) }; }
    finally { fleet.busy = false; push(); }
  });
  /** 직접 대면: 플레이어 심문 → 제독 답. 3번째 심문 뒤 평가. */
  ipcMain.handle('fleetFaceSay', async (e, text: unknown) => {
    if (!guard(e)) return { ok: false, error: L('함대 사령부 창에서만 심문할 수 있습니다.', 'Questioning is only possible from the Fleet Command window.') };
    const c = curHearing(); if (!c || c.h.done || c.h.mode !== 'face') return { ok: false, error: L('진행 중인 대면이 없습니다.', 'No face-to-face hearing in progress.') };
    if (typeof text !== 'string') return { ok: false, error: L('내용을 확인해 주세요.', 'Check what you entered.') };
    const bad = checkText(text); if (bad) return { ok: false, error: bad };
    if (fleet.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    fleet.busy = true; push();
    try {
      const clean = text.replace(/\s+/g, ' ').trim(), h0 = c.h;
      const reply = (await ctx.ai.chat(faceMessages(ctx.playerName, h0, clean, profile(h0.name)), { purpose: 'fleet-face', maxTokens: 1000, conversationId: conversationOf(c) })).trim();
      if (!reply) return { ok: false, error: L('제독의 답을 읽지 못했습니다. 다시 시도해 주세요(이번 심문은 세지 않습니다).', 'Could not read the admiral\'s answer. Try again (this question is not counted).') };
      if (c.h !== h0) return { ok: false, error: L('청문회가 바뀌었습니다.', 'The hearing changed.') };
      c.h = faceTurn(h0, clean, reply); push();
      if (readyToJudge(c.h)) return await judgeNow(c);
      return { ok: true };
    } catch (err) { return { ok: false, error: redactKey((err as Error).message) }; }
    finally { fleet.busy = false; push(); }
  });
  /** 평가가 실패했을 때 다시 평가만 한다. */
  ipcMain.handle('fleetJudge', async (e) => {
    if (!guard(e)) return { ok: false, error: L('함대 사령부 창에서만 진행할 수 있습니다.', 'Can only be done from the Fleet Command window.') };
    const c = curHearing(); if (!c || !readyToJudge(c.h)) return { ok: false, error: L('평가할 전투가 없습니다.', 'No battle to assess.') };
    if (fleet.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    fleet.busy = true; push();
    try { return await judgeNow(c); } catch (err) { return { ok: false, error: redactKey((err as Error).message) }; } finally { fleet.busy = false; push(); }
  });
  ipcMain.handle('fleetHearingClose', async (e) => { if (!guard(e)) return false; const c = curHearing(); if (c && c.h.done) { fleet.hearing = null; push(); } return true; });
}
async function judgeNow(c: { sid: string; h: Hearing }) {
  let v: ReturnType<typeof parseVerdict> | null = null;
  for (let i = 0; i < 2 && !v; i++) { try { v = parseVerdict(await ctx.ai.chat(verdictMessages(ctx.playerName, c.h), { purpose: 'fleet-verdict', json: true, maxTokens: 800 * (i + 1) })); } catch (err) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'fleet-verdict', attempt: i + 1, error: String(err) }); } }
  if (!v) return { ok: false, error: L('감찰관 평가를 읽지 못했습니다. [평가 다시]를 눌러 주세요.', 'Could not read the inspector\'s assessment. Press [Rate again].') };
  if (c.h.done) return { ok: false, error: L('청문회가 이미 끝났습니다.', 'The hearing has already ended.') }; // 평가를 기다리는 동안 창을 닫아 확정된 경우
  c.h = judgeCase(c.h, v); push();
  if (c.h.done) await applyOutcome(c);
  return { ok: true };
}

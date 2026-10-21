// 종속국 통신 채널(앱 쪽, 2026-10-17) — 별도 오버레이 아이콘 창. 순수 로직은 src/vassal.ts.
// 월간 상황(STATE)의 VASSAL·SUBJECT 줄로 채널을 갱신하고, 충성도가 크게 바뀌면 서신, 그 밖에는 실시간 타이머로 청원·요구.
import { glassWin } from '../office';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { VassalStore, VChannel, VKind, VMsg, applySnapshot, pickTimerChannel, timerKind, parseLetter, addLetter, letterMessages, replyMessages, decisionMessages, historyLines, checkText, vassalApplyCommand, overlordApplyCommand, pickAsk, sanitizeAsk, VAsk, ASK_KO, ASK_EN, RESEARCH_AID, DEFY_OPINION, unread, trim, newId, LetterCtx, VASSAL_MONTHLY, VASSAL_DAYS, TEXT_MAX } from '../vassal';
import type { StateSnapshot } from '../gamestate';
import type { SllmMessage } from '../protocol';
import { chronKey, chronLines } from '../chronicle';
import { redactKey } from '../aiclient';
import { logDiagnostic } from '../diagnostics';
import { settings } from '../app/settings';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { safeSend } from '../safe-send';
import { chron, chronNote } from './chronicle-app';
import { terminalRequest, terminalReplies } from './terminal';
import { pick } from './settings-ui';

const L = pick; // 한국어·영어·언어 팩(2026-10-18)
/** 결재 결과 한 줄(시스템 기록) */
export function decisionNote(role: 'vassal' | 'overlord', name: string, status: string | undefined, ask?: VAsk): string {
  const gave = ask ? (ask.type === 'resource' ? L(`${ASK_KO[ask.res]} ${ask.amt}을(를) 보냈습니다`, `sent ${ask.amt} ${ASK_EN[ask.res]}`) : L(`1년간 연구 지원(우리 −${RESEARCH_AID}%, ${name} +${RESEARCH_AID}%)`, `research aid for 1 year (us −${RESEARCH_AID}%, ${name} +${RESEARCH_AID}%)`)) : '';
  if (status === 'accepted') return role === 'vassal' ? L(`청원을 들어주었습니다${gave ? ' · ' + gave : ''} · ${name} 충성도 매달 +${VASSAL_MONTHLY} (1년)`, `Petition granted${gave ? ' · ' + gave : ''} · ${name} loyalty +${VASSAL_MONTHLY}/month (1 yr)`) : L(`요구를 이행했습니다 · ${gave}`, `Demand fulfilled · ${gave}`);
  if (status === 'refused') return role === 'vassal' ? L(`청원을 거절했습니다 · ${name} 충성도 매달 −${VASSAL_MONTHLY} (1년)`, `Petition refused · ${name} loyalty −${VASSAL_MONTHLY}/month (1 yr)`) : L(`요구를 거절했습니다 · ${name}의 우리 관계 −${DEFY_OPINION} (약 1년에 걸쳐 회복)`, `Demand refused · ${name}'s opinion of us −${DEFY_OPINION} (recovers over about a year)`);
  if (status === 'no_target') return role === 'vassal' ? L('게임에서 이 종속국을 찾지 못해 적용하지 않았습니다.', 'This subject was not found in game; nothing was applied.') : L('게임에서 종주국을 찾지 못해 적용하지 않았습니다.', 'No overlord was found in game; nothing was applied.');
  if (status === 'duplicate') return L('이미 적용한 결정입니다.', 'This decision was already applied.');
  return L('게임 적용을 확인하지 못했습니다. 자동으로 다시 보내지 않습니다.', 'Could not confirm the effect in game. It will not be resent automatically.');
}
export const vassal = { win: null as BrowserWindow | null, busy: false, lastTimer: Date.now(), queue: [] as Array<() => Promise<void>>, running: false, snap: null as StateSnapshot | null };
let storeInst: VassalStore | null = null;
const store = () => (storeInst ??= new VassalStore(path.join(app.getPath('userData'), 'sllm_vassal.json')));
const cur = () => store().get(ctx.curSaveId);

function profileOf(ch: VChannel): { ruler?: string; profile?: string } {
  let idx = ch.idx;
  if (ch.role === 'overlord') { for (const [i, c] of ctx.mailCountries) if (c.name === ch.name) { idx = i; break; } }
  const p = idx > 0 ? ctx.profileWithEthics(ctx.profiles.get(idx) ?? ctx.mailCountries.get(idx)?.profile, idx) : undefined;
  return p ? { ruler: p.ruler || undefined, profile: [p.gov, p.species, p.ethicsText].filter(Boolean).join(' · ') } : {};
}
function letterCtx(ch: VChannel, delta?: number): LetterCtx {
  const s = vassal.snap, situation: string[] = [];
  if (s) { for (const w of s.wars.slice(0, 4)) situation.push(`Player empire war: ${w.name} (${w.side === 'att' ? 'attacker' : 'defender'} side)`); }
  let chronicle: string[] = [];
  if (ch.role === 'vassal' && ctx.curSaveId) { try { chronicle = chronLines(ctx.govMem().split(ctx.curSaveId, chron().list(chronKey(ctx.curSaveId, ch.idx))).own, 6); } catch { /* 연대기 없음 */ } }
  return { empire: ctx.playerName || 'the player empire', ...profileOf(ch), situation: [...situation, ...chronicle.map((c) => 'Relationship record: ' + c)], history: historyLines(ch), delta };
}
export function vassalView() {
  const sv = ctx.curSaveId ? cur() : { channels: {} as Record<string, VChannel> };
  const chans = Object.values(sv.channels).sort((a, b) => (a.role === b.role ? Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ko') : a.role === 'overlord' ? -1 : 1));
  return { sid: ctx.curSaveId, running: ctx.gameRunning, busy: vassal.busy, empire: ctx.playerName, playerIdx: ctx.playerIdx, // 우리 깃발(2026-10-18)
    monthly: VASSAL_MONTHLY, days: VASSAL_DAYS, textMax: TEXT_MAX, channels: chans.map((c) => ({ ...c, unread: unread(c), msgs: c.msgs.slice(-80) })) };
}
const push = () => safeSend(vassal.win, 'vassalState', vassalView());
export const vassalUnread = () => (ctx.curSaveId ? Object.values(cur().channels).reduce((n, c) => n + unread(c), 0) : 0);
export function openVassal(glass = false) {
  if (vassal.win && !vassal.win.isDestroyed()) { vassal.win.show(); vassal.win.focus(); push(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1180, Math.round(area.width * 0.78)), height: Math.min(860, Math.round(area.height * 0.86)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  vassal.win = new BrowserWindow({ ...sz, x, y, minWidth: 780, minHeight: 520, frame: false, show: false, backgroundColor: '#06141b', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  vassal.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void vassal.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'vassal.html'));
  vassal.win.once('ready-to-show', () => { vassal.win?.show(); push(); });
  vassal.win.on('closed', () => { vassal.win = null; });
}
export function closeVassal() { if (vassal.win && !vassal.win.isDestroyed()) vassal.win.close(); }

/** AI 호출은 하나씩(서신이 몰려도 순서대로). */
function enqueue(job: () => Promise<void>) { vassal.queue.push(job); void pump(); }
async function pump() { if (vassal.running) return; vassal.running = true; try { while (vassal.queue.length) { const j = vassal.queue.shift()!; try { await j(); } catch (e) { logDiagnostic('warn', 'vassal.job.failed', { error: String(e) }); } } } finally { vassal.running = false; } }
async function writeLetter(sid: string, key: string, kind: VKind, delta?: number) {
  const ch = store().get(sid).channels[key]; if (!ch || !ch.active) return;
  let got: ReturnType<typeof parseLetter> | null = null;
  const ask = kind === 'petition' || kind === 'demand' ? pickAsk() : undefined; // 내용은 앱이 정한다(게임에서 이행되는 것만, 2026-10-18)
  for (let i = 0; i < 2 && !got; i++) { try { got = parseLetter(await ctx.ai.chat(letterMessages(ch, kind, letterCtx(ch, delta), ask), { purpose: 'vassal-letter', json: true, maxTokens: 1000 * (i + 1) }), kind, !!ask); } catch (e) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'vassal-letter', attempt: i + 1, error: String(e) }); } }
  if (!got || sid !== ctx.curSaveId) return;
  const m = addLetter(ch, kind, ctx.gameDate, got, ask); store().save(); push();
  const who = ch.role === 'overlord' ? L('종주국', 'Overlord') : L('종속국', 'Subject');
  ctx.notify({ kind: 'vassal', title: L(`${who} 서신 · ${ch.name}`, `${who} letter · ${ch.name}`), body: m.title ?? '', action: L('열기', 'Open') });
  logDiagnostic('info', 'vassal.letter', { role: ch.role, kind });
}
/** 월간 상황(gamestate-app 이 부른다): 채널 갱신 + 충성도 급변 서신 */
export function onVassalSnapshot(snap: StateSnapshot) {
  if (!ctx.curSaveId || snap.sid !== ctx.curSaveId) return;
  vassal.snap = snap; const sid = snap.sid;
  const triggers = applySnapshot(store().get(sid), snap.vassals ?? [], snap.subject);
  store().save(); push();
  for (const t of triggers) enqueue(() => writeLetter(sid, t.key, t.kind, t.delta));
}
/** 실시간 타이머: 서신 간격(설정 aiEveryMin, 기본 10분)마다 조용한 채널 하나가 청원·요구를 보낸다. 본 창을 쓰는 중이거나 게임이 꺼져 있으면 쉰다. */
function timerTick() {
  if (!ctx.gameRunning || !ctx.curSaveId || ctx.appOpen || vassal.running) return;
  if (Date.now() - vassal.lastTimer < Math.min(30, Math.max(1, settings.aiEveryMin)) * 60000) return;
  const sid = ctx.curSaveId, ch = pickTimerChannel(store().get(sid)); vassal.lastTimer = Date.now(); if (!ch) return;
  enqueue(() => writeLetter(sid, ch.key, timerKind(ch)));
}
const guard = (e: Electron.IpcMainInvokeEvent) => !!vassal.win && e.sender === vassal.win.webContents;
const chanOf = (key: unknown) => (typeof key === 'string' && ctx.curSaveId ? cur().channels[key] ?? null : null);
const say = async (m: Parameters<typeof replyMessages>, purpose: string) => (await ctx.ai.chat(replyMessages(...m), { purpose, maxTokens: 900 })).trim();

export function registerVassal(router: LogRouter): void {
  router.on(SLOT.VASSAL, 'vassal:apply', (m: SllmMessage) => { if (m.kind === 'VASSALAPPLY') terminalReplies.get('VASSALAPPLY:' + m.kv.req)?.(m); });
  setInterval(timerTick, 60000);
  ipcMain.handle('vassalState', async () => vassalView());
  ipcMain.handle('vassalClose', async (e) => { if (!guard(e)) return false; closeVassal(); return true; });
  ipcMain.handle('vassalRead', async (e, key: unknown) => { if (!guard(e)) return false; const ch = chanOf(key); if (!ch) return false; let ch2 = false; for (const m of ch.msgs) if (!m.read) { m.read = true; ch2 = true; } if (ch2) { store().save(); push(); } return true; });
  /** 플레이어가 채널에 통신을 보낸다 → 상대가 답한다(게임 수치는 바뀌지 않음). */
  ipcMain.handle('vassalSay', async (e, key: unknown, text: unknown) => {
    if (!guard(e)) return { ok: false, error: L('종속국 통신 창에서만 보낼 수 있습니다.', 'You can send only from the subject comms window.') };
    const ch = chanOf(key); if (!ch || !ch.active) return { ok: false, error: L('통신할 수 있는 채널이 아닙니다.', 'This channel cannot be contacted.') };
    if (typeof text !== 'string') return { ok: false, error: L('내용을 확인해 주세요.', 'Please check the content.') };
    const bad = checkText(text); if (bad) return { ok: false, error: bad };
    if (vassal.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already processing.') };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 통신할 수 있습니다.', 'The game must be running to communicate.') };
    vassal.busy = true; const sid = ctx.curSaveId; push();
    try {
      const clean = text.replace(/\s+/g, ' ').trim(), c = letterCtx(ch);
      const reply = await say([ch, clean, c], 'vassal-reply');
      if (!reply) return { ok: false, error: L('상대의 답을 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read their reply. Please try again.') };
      if (sid !== ctx.curSaveId) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      ch.msgs.push({ id: newId(), who: 'me', kind: 'player', date: ctx.gameDate, text: clean, read: true }, { id: newId(), who: 'them', kind: 'reply', date: ctx.gameDate, text: reply.slice(0, 2000), read: true });
      trim(ch); store().save(); return { ok: true };
    } catch (err) { return { ok: false, error: redactKey((err as Error).message) }; }
    finally { vassal.busy = false; push(); }
  });
  /** 청원(종속국)·요구(종주국)에 답한다(2026-10-18 이행형). 내용(ask)이 있으면 수락 = 실제 이행(자원 보냄 / 연구 지원 1년),
   * 종속국 청원은 충성도 수정자(수락 +, 거절 −, 1년), 종주국 요구 거절은 종주국 관계 −60. ask 가 없는 옛 서신은 예전처럼(종속국 = 충성도만, 종주국 = 기록만). */
  ipcMain.handle('vassalDecide', async (e, key: unknown, id: unknown, accept: unknown) => {
    if (!guard(e)) return { ok: false, error: L('종속국 통신 창에서만 답할 수 있습니다.', 'You can reply only from the subject comms window.') };
    const ch = chanOf(key), m = ch?.msgs.find((x) => x.id === id) as VMsg | undefined;
    if (!ch || !m || m.status !== 'pending') return { ok: false, error: L('대답할 청원이 없습니다.', 'There is no petition to answer.') };
    if (vassal.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already processing.') };
    const yes = accept === true, sid = ctx.curSaveId, ask = sanitizeAsk(m.ask) ?? undefined, inGame = ch.role === 'vassal' || !!ask;
    if (inGame && (!ctx.gameRunning || !/^\d+$/.test(sid))) return { ok: false, error: L('게임이 켜져 있어야 결정을 게임에 적용할 수 있습니다.', 'The game must be running to apply this decision.') };
    vassal.busy = true; push();
    try {
      if (inGame) {
        const cid = randomUUID().replace(/-/g, ''), req = ++link.reqCounter;
        // 보내기 전에 기록한다: 응답이 없어도 같은 결정을 두 번 걸지 않는다.
        m.status = 'sending'; m.cid = cid;
        if (!store().save()) { m.status = 'pending'; delete m.cid; push(); return { ok: false, error: L('기록을 저장하지 못해 게임에 보내지 않았습니다. 디스크 공간·권한을 확인해 주세요.', 'Could not save the record, so nothing was sent to the game. Check disk space and permissions.') }; }
        push();
        let short = false;
        try {
          const cmd = ch.role === 'vassal' ? vassalApplyCommand(req, sid, cid, ch.idx, yes, ask) : overlordApplyCommand(req, sid, cid, yes, ask!);
          const r = await terminalRequest(cmd, 'VASSALAPPLY', req);
          if (r.kv.cid !== cid || r.kv.sid !== sid) throw new Error(L('응답의 결정 번호가 다릅니다.', 'The reply\'s decision ID does not match.'));
          short = r.kv.status === 'short';
          m.status = r.kv.status === 'applied' ? (yes ? 'accepted' : 'refused') : r.kv.status === 'duplicate' ? 'duplicate' : r.kv.status === 'no_target' ? 'no_target' : r.kv.status === 'failed' ? 'failed' : short ? 'pending' : 'uncertain';
        } catch (err) { m.status = 'uncertain'; logDiagnostic('warn', 'vassal.apply.failed', { error: String(err) }); }
        if (short && ask && ask.type === 'resource') { // 창고 부족: 아무것도 바뀌지 않았으니 결재 대기로 되돌린다
          delete m.cid; store().save();
          return { ok: false, error: L(`창고에 ${ASK_KO[ask.res]}이(가) 부족합니다(필요 ${ask.amt}). 모은 뒤 다시 결재하거나 거절하세요.`, `Not enough ${ASK_EN[ask.res]} in stock (need ${ask.amt}). Gather it and try again, or refuse.`) };
        }
        ch.msgs.push({ id: newId(), who: 'system', kind: 'note', date: ctx.gameDate, text: decisionNote(ch.role, ch.name, m.status, ask), read: true });
        if (m.status === 'accepted' || m.status === 'refused') { const rq = m.request ?? '', yes = m.status === 'accepted'; chronNote(ch.idx, ch.role === 'vassal' ? L(`종주국이 청원 "${rq}"을(를) ${yes ? '들어주었다' : '거절했다'}`, `The overlord ${yes ? 'granted' : 'refused'} the petition "${rq}"`) : L(`종속국이 요구 "${rq}"을(를) ${yes ? '이행했다' : '거절했다'}`, `The subject ${yes ? 'fulfilled' : 'refused'} the demand "${rq}"`)); }
      } else {
        m.status = yes ? 'accepted' : 'refused';
        ch.msgs.push({ id: newId(), who: 'system', kind: 'note', date: ctx.gameDate, text: yes ? L('요구를 받아들이겠다고 답했습니다(기록만, 게임 수치 변화 없음).', 'You agreed to the demand (record only, no game change).') : L('요구를 거절했습니다(기록만, 게임 수치 변화 없음).', 'You refused the demand (record only, no game change).'), read: true });
      }
      store().save(); push();
      if (m.status === 'accepted' || m.status === 'refused') {
        try { const r = (await ctx.ai.chat(decisionMessages(ch, m, m.status === 'accepted', letterCtx(ch)), { purpose: 'vassal-decision', maxTokens: 1500 })).trim(); if (r && sid === ctx.curSaveId) { ch.msgs.push({ id: newId(), who: 'them', kind: 'reply', date: ctx.gameDate, text: r.slice(0, 1200), read: true }); trim(ch); store().save(); } } catch { /* 반응 문장은 없어도 된다 */ }
      }
      return { ok: true, status: m.status };
    } catch (err) { return { ok: false, error: redactKey((err as Error).message) }; }
    finally { vassal.busy = false; push(); }
  });
}

// Federation summit: live AI discussion, correlated reads and developer-only experimental effects.
// Engine law eligibility/cooldown verification remains an in-game task.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { FedInfo, FedAgenda, FedAgendaKind, FedVote, FED_AGENDAS, FED_LAW_KEYS, FedCollector, FedRead, fedInfoFrom, summitView, agendaProblem, voteOf } from '../federation';
import { fedWarTargets, refreshContacts } from './peace-app';
import { fedReadEffect, SllmMessage } from '../protocol';
import { classKey } from '../speciesClass';
import { enqueue, sendConsole, link } from '../app/game-link';
import { settings } from '../app/settings';
import { parseSummitReplies, summitMessages, federationFingerprint, summitApplyProblem, summitOperationId, SummitJournal, summitApplyEffect, summitResultConfirmed } from '../summit-core';
import { chronNoteWorld } from './chronicle-app';
import { LogRouter, SLOT } from '../app/log-router';
import { summitDemoReplies } from '../dev-fake';
import { safeSend } from '../safe-send';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

export const summit = {
  win: null as BrowserWindow | null,
  info: null as FedInfo | null,
  agenda: { kind: 'cohesion' } as FedAgenda,
  playerVote: 'yes' as FedVote,
  turn: 0,
  busy: false,
  epoch: 0,
  heard: new Set<number>(),
  applied: false,
  uncertain: false,
  aiDemo: false,
  log: [] as Array<{ who: string; idx?: number; text: string; kind: 'me' | 'ai' | 'sys' }>,
};

const view = () => (summit.info ? { ...summitView(summit.info, summit.agenda, summit.playerVote), busy: summit.busy, applied: summit.applied, uncertain: summit.uncertain, aiDemo: summit.aiDemo, experimental: settings.devMode, heard: [...summit.heard], log: summit.log, flags: Object.fromEntries(summit.info.members.map((m) => [m.idx, ctx.flagUrlFor(m.idx)])) } : null);
const push = () => safeSend(summit.win, 'summitState', view());
const sys = (text: string) => { summit.log.push({ who: '', text, kind: 'sys' }); if (summit.log.length > 200) summit.log.splice(0, summit.log.length - 200); };

/** 회담 창을 연다(이미 열려 있으면 새 정보로 바꾼다). */
export function openSummit(info: FedInfo, aiDemo = false): boolean {
  if (summit.busy) return false;
  summit.info = { ...info, members: info.members.map((m) => ({ ...m })) };
  summit.agenda = { kind: 'cohesion' }; summit.playerVote = 'yes'; summit.turn = 0; summit.log = [];
  summit.epoch = link.epoch; summit.heard = new Set(); summit.applied = false; summit.uncertain = false; summit.aiDemo = aiDemo && !!info.demo;
  sys(`${info.demo ? L('[시연판] ', '[Demo] ') : ''}${L(`정상회담을 열었습니다. 참석 ${info.members.length}개국.`, `Summit opened. ${info.members.length} member(s) attending.`)}`);
  logDiagnostic('info', 'summit.open', { sid: info.sid, demo: !!info.demo, members: info.members.length });
  if (summit.win && !summit.win.isDestroyed()) { summit.win.show(); summit.win.focus(); push(); return true; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  const w = new BrowserWindow({ ...sz, x, y, minWidth: 900, minHeight: 680, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  summit.win = w;
  w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'summit.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (summit.win === w) { summit.win = null; summit.info = null; } });
  return true;
}
export function closeSummit(): void { if (summit.win && !summit.win.isDestroyed()) summit.win.close(); summit.win = null; summit.info = null; }

// ---- 2단계: 게임에서 플레이어 연방 읽기
const fedCol = new FedCollector();
let fedReading = false, fedLast = 0;
let fedReq = 0, fedSid = '', fedEpoch = 0;
/** 전쟁 선포 적용 결과(SLLM:FEDWAR): 요청 번호·세이브가 맞는 줄만 받는다. null = 아직 못 받음 */
let warReq = 0, warSid = '', warAt: boolean | null = null;
export function registerSummitLog(router: LogRouter): void {
  router.on(SLOT.FEDERATION, 'summit:federation', (m: SllmMessage) => {
    if (m.kind === 'FEDWAR') { if (Number(m.kv.req) === warReq && m.kv.sid === warSid) warAt = m.kv.at === '1'; return; }
    if (!/^FED(MEMBER|LAW|END)?$/.test(m.kind)) return;
    if (!fedReading) return; // 앱이 묻지 않은 줄(지난 로그 다시 읽기 등)은 무시
    if (Number(m.kv.req) !== fedReq || m.kv.sid !== fedSid || ctx.curSaveId !== fedSid || link.epoch !== fedEpoch) return;
    if (fedCol.feed(m)) fedLast = Date.now();
  });
}
/** 게임에 플레이어 연방을 물어 회담 정보로 만든다. 연방이 없으면 'none', 응답이 없거나 불완전하면 null. */
export async function readFederation(): Promise<FedInfo | 'none' | null> {
  if (fedReading) return null;
  fedReading = true; fedCol.cur = null as FedRead | null; fedLast = 0;
  fedReq = ++link.reqCounter; fedSid = ctx.curSaveId; fedEpoch = link.epoch;
  try {
    if (!fedSid) return null;
    await enqueue(() => sendConsole(fedReadEffect(fedReq)));
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) { await new Promise((r) => setTimeout(r, 250)); if ((fedCol.cur as FedRead | null)?.done) break; }
    const r = fedCol.cur as FedRead | null;
    logDiagnostic('info', 'summit.fed_read', { got: !!r, none: !!r?.none, done: !!r?.done, members: r?.members.length ?? 0, laws: r?.laws.length ?? 0, last: fedLast });
    if (!r || !r.done || ctx.curSaveId !== fedSid || link.epoch !== fedEpoch) return null;
    if (r.none) return 'none';
    const info = fedInfoFrom(r, ctx.curSaveId, (idx) => classKey(ctx.profiles.get(idx)?.cls) ?? '');
    if (info) info.warTargets = fedWarTargets(info.members.map((m) => m.idx));
    return info;
  } finally { fedReading = false; }
}

const isKind = (k: unknown): k is FedAgendaKind => typeof k === 'string' && Object.hasOwn(FED_AGENDAS, k);
const isVote = (v: unknown): v is FedVote => v === 'yes' || v === 'no' || v === 'abstain';

export function registerSummit(): void {
  ipcMain.handle('summitOpen', async () => {
    try {
      if (summit.busy) return { ok: false, error: L('진행 중인 회담 작업을 기다려 주세요.', 'Please wait for the current summit task.') };
      try { await refreshContacts(); } catch { /* 연락처를 못 새로 읽어도 지난 목록으로 연다 */ }
      const info = await readFederation();
      if (!info || info === 'none') return { ok: false, error: info === 'none' ? L('가입한 연방이 없습니다.', 'You are not in a federation.') : L('연방 정보를 읽지 못했습니다. 게임과 최신 모드 연결을 확인해 주세요.', 'Could not read the federation. Check the game and that the latest mod is connected.') };
      return { ok: openSummit(info) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('devSummitAi', async () => {
    if (!settings.devMode) return { ok: false, error: L('개발자 모드에서만 사용할 수 있습니다.', 'Available only in developer mode.') };
    const { sampleFederation } = await import('../dev-fake');
    return { ok: openSummit(sampleFederation(), true), message: L('시험 연방에 실제 AI를 연결했습니다. API를 사용하지만 게임에는 적용하지 않습니다.', 'Connected real AI to the test federation. Uses the API but is not applied to the game.') };
  });
  ipcMain.handle('summitState', async () => view());
  ipcMain.handle('summitAgenda', async (_e, a: { kind?: unknown; target?: unknown }) => {
    if (!summit.info) return { ok: false, error: L('열린 정상회담이 없습니다.', 'No summit is open.') };
    if (summit.busy || summit.uncertain || summit.applied) return { ok: false, error: L('작업 결과를 확인한 뒤 회담을 다시 열어 주세요.', 'Check the result, then reopen the summit.') };
    if (!isKind(a?.kind)) return { ok: false, error: L('알 수 없는 안건입니다.', 'Unknown agenda.') };
    const next: FedAgenda = { kind: a.kind, ...(a.kind === 'war' && typeof a.target === 'number' ? { target: a.target } : {}) };
    if (JSON.stringify(summit.agenda) !== JSON.stringify(next)) { summit.heard.clear(); summit.info.members.forEach(m => { m.stance = 0; }); summit.log = []; summit.turn = 0; }
    summit.agenda = next;
    const p = agendaProblem(summit.info, next);
    sys(L(`안건: ${FED_AGENDAS[next.kind].name}${p ? ` — ${p}` : ''}`, `Agenda: ${FED_AGENDAS[next.kind].nameEn}${p ? ` — ${p}` : ''}`));
    push(); return { ok: true };
  });
  ipcMain.handle('summitVote', async (_e, v: unknown) => {
    if (!summit.info || !isVote(v)) return { ok: false, error: L('표를 고르지 못했습니다.', 'Could not set your vote.') };
    if (summit.busy || summit.applied || summit.uncertain) return { ok: false, error: L('회담 작업을 기다려 주세요.', 'Please wait for the summit task.') };
    summit.playerVote = v; push(); return { ok: true };
  });
  // Live and AI-demo rounds use the configured provider; fixed demo stays offline.
  ipcMain.handle('summitSay', async (_e, r: { text?: unknown; to?: unknown }) => {
    const info = summit.info;
    if (!info) return { ok: false, error: L('열린 정상회담이 없습니다.', 'No summit is open.') };
    if (summit.busy || summit.applied || summit.uncertain) return { ok: false, error: L('회담 작업을 기다리거나 회담을 다시 열어 주세요.', 'Wait for the summit task, or reopen the summit.') };
    if (!info.demo && (ctx.curSaveId !== info.sid || link.epoch !== summit.epoch)) return { ok: false, error: L('게임 상태가 바뀌었습니다. 회담을 다시 열어 주세요.', 'The game state changed. Please reopen the summit.') };
    const problem = agendaProblem(info, summit.agenda); if (problem) return { ok: false, error: problem };
    const text = typeof r?.text === 'string' ? r.text.trim().slice(0, 600) : '';
    if (!text) return { ok: false, error: L('할 말을 입력하세요.', 'Type what you want to say.') };
    const to = typeof r?.to === 'number' && info.members.some((m) => m.idx === r.to && !m.player) ? (r.to as number) : null;
    const me = info.members.find((m) => m.player);
    summit.log.push({ who: (me?.ruler || me?.name || L('나', 'Me')) + // 「나」 대신 통치자 이름(2026-10-18)
      (to !== null ? ` → ${info.members.find((m) => m.idx === to)!.name}` : L(' → 전체', ' → all')), text, kind: 'me' });
    if (!info.demo || summit.aiDemo) {
      summit.busy = true; push();
      const epoch = summit.epoch;
      try {
        const speakers = info.members.filter(m => !m.player && (to === null || m.idx === to));
        if (!speakers.length) throw new Error(L('답할 회원국이 없습니다.', 'No member can reply.'));
        const replies = await ctx.ai.session(async chat => {
          const out: ReturnType<typeof parseSummitReplies> = [];
          for (let i = 0; i < speakers.length; i += 6) {
            if (summit.info !== info || (!info.demo && (ctx.curSaveId !== info.sid || link.epoch !== epoch))) throw new Error(L('회담 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The summit or game state changed, so the replies were not applied.'));
            const batch = speakers.slice(i, i + 6), ids = batch.map(m => m.idx);
            const profiles = batch.map(m => { const p = ctx.profileWithEthics(ctx.profiles.get(m.idx), m.idx); return { idx: m.idx, personality: p?.personality, ethics: p?.ethicsText, government: p?.gov, relations: p?.flags }; });
            const raw = await chat(summitMessages(info, summit.agenda, ids, text, [...summit.log, ...out], profiles), { purpose: 'federation-summit', json: true, maxTokens: 3000 });
            out.push(...parseSummitReplies(raw, ids));
          }
          return out;
        });
        if (summit.info !== info || (!info.demo && (ctx.curSaveId !== info.sid || link.epoch !== epoch))) throw new Error(L('회담 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The summit or game state changed, so the replies were not applied.'));
        for (const rp of replies) { const m = info.members.find(m => m.idx === rp.idx)!; m.stance = summit.heard.has(m.idx) ? Math.max(m.stance - 25, Math.min(m.stance + 25, rp.stance)) : rp.stance; summit.heard.add(m.idx); summit.log.push({ who: m.name, idx: m.idx, text: rp.say, kind: 'ai' }); }
        summit.turn++; summit.log = summit.log.slice(-200);
        logDiagnostic('info', 'summit.debate', { sid: info.sid, turn: summit.turn, speakers: replies.length });
        return { ok: true, replies };
      } catch (e) { const error = (e as Error).message; if (summit.info === info) sys(error); logDiagnostic('warn', 'summit.debate.failed', { error }); return { ok: false, error }; }
      finally { summit.busy = false; push(); }
    }
    summit.turn += 1;
    const replies = summitDemoReplies(info, to, summit.playerVote, summit.turn);
    for (const rp of replies) {
      const m = info.members.find((x) => x.idx === rp.idx); if (!m) continue;
      const before = voteOf(m.stance);
      m.stance = Math.max(-100, Math.min(100, m.stance + rp.delta));
      summit.heard.add(m.idx);
      summit.log.push({ who: m.name, idx: m.idx, text: rp.say + (before !== voteOf(m.stance) ? L(' (입장이 바뀌었습니다)', ' (changed position)') : ''), kind: 'ai' });
    }
    push(); return { ok: true, replies };
  });
  // Reserve before sending once, then re-read game state. Never automatically retry uncertain effects.
  ipcMain.handle('summitApply', async (_e, experimentalConfirmed?: unknown) => {
    const info = summit.info;
    if (!info) return { ok: false, state: 'refused', error: L('열린 정상회담이 없습니다.', 'No summit is open.') };
    const why = summit.busy || summit.applied || summit.uncertain ? L('이미 처리 중이거나 요청한 결정입니다.', 'Already processing or decided.') : summitApplyProblem(info, summit.agenda, summit.playerVote, summit.heard);
    if (why || !settings.devMode || experimentalConfirmed !== true) return { ok: false, state: 'refused', error: why || L('게임 적용은 개발자 검수에서만 가능합니다. 법 해금·재사용 대기시간은 검증 전입니다.', 'Applying to the game is available only in developer review. Law unlocks and cooldowns are not verified yet.') };
    const epoch = summit.epoch, agenda = { ...summit.agenda };
    const current = () => summit.info === info && ctx.curSaveId === info.sid && link.epoch === epoch;
    if (!current()) return { ok: false, error: L('게임 상태가 바뀌었습니다. 회담을 다시 열어 주세요.', 'The game state changed. Please reopen the summit.') };
    summit.busy = true; push(); let reserved = false;
    try {
      const fresh = await readFederation();
      if (!current()) throw new Error(L('게임 상태가 바뀌어 적용을 중단했습니다.', 'The game state changed, so applying stopped.'));
      if (!fresh || fresh === 'none' || federationFingerprint(info) !== federationFingerprint(fresh)) throw new Error(L('회원국·통치자·법·가중치가 바뀌었습니다. 회담을 다시 열어 주세요.', 'Members, rulers, laws or weights changed. Please reopen the summit.'));
      if (agenda.kind === 'cohesion' && fresh.cohesion >= 100) throw new Error(L('이미 최대 응집력입니다.', 'Cohesion is already at maximum.'));
      const journal = new SummitJournal(path.join(app.getPath('userData'), 'sllm_summit_apply.json'));
      const id = summitOperationId(fresh, agenda, ctx.gameDate), req = ++link.reqCounter;
      const command = summitApplyEffect(fresh, agenda, req);
      warReq = req; warSid = info.sid; warAt = null;
      journal.reserve(id, JSON.stringify({ sid: info.sid, federation: info.name, agenda, date: ctx.gameDate, req })); reserved = true;
      summit.uncertain = true;
      await enqueue(async () => { if (!current()) throw new Error(L('게임 상태가 바뀌어 적용을 중단했습니다.', 'The game state changed, so applying stopped.')); await sendConsole(command); });
      if (agenda.kind === 'war') { const t0 = Date.now(); while (warAt === null && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 250)); }
      const after = agenda.kind === 'war' ? null : await readFederation();
      const confirmed = current() && summitResultConfirmed(fresh, after, agenda, warAt === true);
      journal.finish(id, confirmed ? 'confirmed' : 'uncertain');
      logDiagnostic(confirmed ? 'info' : 'warn', 'summit.apply.result', { sid: info.sid, req, agenda, confirmed });
      if (!current()) return { ok: false, state: 'uncertain', error: L('게임 상태가 바뀌었습니다. 원래 세이브에서 적용 결과를 확인해 주세요.', 'The game state changed. Check the result in the original save.') };
      summit.applied = confirmed; summit.uncertain = !confirmed;
      if (confirmed && after && after !== 'none') summit.info = { ...after, members: after.members.map(m => ({ ...m, stance: info.members.find(old => old.idx === m.idx)?.stance ?? 0 })) };
      const message = confirmed ? L(`${FED_AGENDAS[agenda.kind].name}: 게임에서 변경된 상태를 다시 읽어 확인했습니다.`, `${FED_AGENDAS[agenda.kind].nameEn}: confirmed by re-reading the changed state from the game.`) : L('적용 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다. 게임에서 직접 확인해 주세요.', 'Could not confirm the result. It will not be resent automatically. Please check in the game.');
      sys(message);
      if (confirmed) { const tgt = agenda.target ? ': ' + (info.warTargets?.find(t=>t.idx===agenda.target)?.name ?? '') : ''; chronNoteWorld(L(`${info.name} 정상회담 — ${FED_AGENDAS[agenda.kind].name}${tgt} 적용 확인.`, `${info.name} summit — ${FED_AGENDAS[agenda.kind].nameEn}${tgt} confirmed.`)); }
      return { ok: confirmed, state: confirmed ? 'confirmed' : 'uncertain', error: confirmed ? undefined : message };
    } catch (e) { const error = (e as Error).message; if (summit.info === info) { summit.uncertain = reserved; sys(error); } logDiagnostic('warn', 'summit.apply.failed', { error, reserved }); return { ok: false, state: reserved ? 'uncertain' : 'refused', error }; }
    finally { summit.busy = false; push(); }
  });
  ipcMain.handle('summitClose', async () => { closeSummit(); return true; });
}

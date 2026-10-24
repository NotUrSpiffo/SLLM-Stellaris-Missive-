// Allied council window. Reads defensive-pact and subject/overlord empires, then applies
// the same kinds of effects chat, vassal petitions and two-party peace already use.
import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { enqueue, sendConsole, expectAck, link } from '../app/game-link';
import { terminalRequest, terminalReplies, terminal } from './terminal';
import { refreshContacts, playerPeace } from './peace-app';
import { settings } from '../app/settings';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { classKey } from '../speciesClass';
import { chronNoteWorld } from './chronicle-app';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import {
  AllyAct, AllyDecision, AllySeat, CouncilInfo, MAX_SEATS, RES_CAP, RES_MIN,
  addAllyTrait, allyActEffect, allyDemoReply, allyFromLog, allyMessages, allyReadEffect,
  applyProblem, bondLabel, decisionFamily, decisionNotice, mergeAllies, parseAllyReplies,
  parseDecision, planCouncil, presentCouncil, sameDecision, sampleCouncil, shapeStance,
  statusLine, traitLabel, willingness,
} from '../allied-council';

export const ally = {
  win: null as BrowserWindow | null,
  info: null as CouncilInfo | null,
  seated: [] as number[],
  decision: null as AllyDecision | null,
  heard: new Set<number>(),
  turn: 0,
  busy: false,
  epoch: 0,
  applied: false,
  uncertain: false,
  aiDemo: false,
  log: [] as Array<{ who: string; idx?: number; text: string; kind: 'me' | 'ai' | 'sys' }>,
};

const rowsOf = new Map<string, SllmMessage[]>();
let allyWatch = 0;
let allyAck: { req: number; status: number } | null = null;
/** Read after the log slot may have filled allyAck. Kept outside the waiter so a null write is not treated as final. */
function ackStatus(req: number): number {
  const a = allyAck;
  return a && a.req === req ? a.status : 0;
}

const sys = (text: string) => { ally.log.push({ who: '', text, kind: 'sys' }); if (ally.log.length > 200) ally.log.splice(0, ally.log.length - 200); };
const seats = () => (ally.info ? ally.info.candidates.filter((c) => ally.seated.includes(c.idx)) : []);
const liveOk = () => !!ally.info && (ally.info.demo || (ctx.curSaveId === ally.info.sid && link.epoch === ally.epoch));

function card(s: AllySeat, withWill: boolean) {
  const family = ally.decision ? decisionFamily(ally.decision) : null;
  const paying = ally.decision?.kind === 'trade' && ally.decision.dir === 'take';
  return {
    idx: s.idx, name: s.name, ruler: s.ruler, personality: s.personality, bond: s.bond, bondLabel: bondLabel(s.bond),
    loyalty: s.loyalty, opinion: s.opinion, stance: s.stance, heard: ally.heard.has(s.idx), cls: classKey(s.cls) || '',
    traits: s.traits.map(traitLabel), atWar: s.atWar, truce: s.truce,
    will: withWill && family ? willingness(s, family, paying) : null,
  };
}
const view = () => {
  const info = ally.info;
  if (!info) return null;
  const sat = seats();
  const problem = sat.length && ally.decision ? applyProblem(sat, ally.decision, ally.heard, info.contacts, info.playerIdx) : '';
  return {
    phase: ally.seated.length ? 'table' : 'pick',
    demo: info.demo, aiDemo: ally.aiDemo, busy: ally.busy, applied: ally.applied, uncertain: ally.uncertain,
    candidates: info.candidates.map((s) => card(s, false)),
    seats: sat.map((s) => card(s, true)),
    player: { name: info.playerName, idx: info.playerIdx, cls: classKey(info.playerCls) || '' },
    decision: ally.decision,
    notice: ally.decision ? decisionNotice(sat.length ? sat : info.candidates, ally.decision, info.contacts) : '',
    problem: problem || '',
    contacts: info.contacts.filter((c) => c.idx !== info.playerIdx && !ally.seated.includes(c.idx)),
    limits: RES_CAP, minAmt: RES_MIN, maxSeats: MAX_SEATS,
    log: ally.log,
    flags: Object.fromEntries(info.candidates.map((s) => [s.idx, ctx.flagUrlFor(s.idx)])),
    playerFlag: ctx.flagUrlFor(info.playerIdx),
  };
};
const push = () => safeSend(ally.win, 'allyState', view());

export function openAlly(info: CouncilInfo, aiDemo = false): boolean {
  if (ally.busy) return false;
  const shown = presentCouncil(info);
  ally.info = { ...shown, candidates: shown.candidates.map((s) => ({ ...s, traits: [...s.traits], stance: 0 })) };
  ally.seated = []; ally.decision = null; ally.heard = new Set(); ally.turn = 0; ally.log = [];
  ally.epoch = link.epoch; ally.applied = false; ally.uncertain = false; ally.aiDemo = aiDemo && info.demo;
  sys(`${info.demo ? L('[시연] ', '[Demo] ') : ''}${L(`평의회를 열었습니다. 부를 수 있는 나라 ${info.candidates.length}.`, `Council opened. ${info.candidates.length} empires can be summoned.`)}`);
  logDiagnostic('info', 'ally.open', { sid: info.sid, demo: info.demo, n: info.candidates.length });
  if (ally.win && !ally.win.isDestroyed()) { ally.win.show(); ally.win.focus(); push(); return true; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1280, Math.round(area.width * 0.86)), height: Math.min(860, Math.round(area.height * 0.88)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  const w = new BrowserWindow({ ...sz, x, y, minWidth: 860, minHeight: 640, frame: false, show: false, backgroundColor: '#10140f', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  ally.win = w;
  w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'allied-council.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (ally.win === w) { ally.win = null; ally.info = null; } });
  return true;
}
export function closeAlly(): void { if (ally.win && !ally.win.isDestroyed()) ally.win.close(); ally.win = null; ally.info = null; }

async function readAllies(): Promise<AllySeat[] | null> {
  const req = ++link.reqCounter;
  const keyA = 'ALLY:' + req, keyT = 'ALLYTRAIT:' + req;
  rowsOf.set(keyA, []); rowsOf.set(keyT, []);
  try {
    const end = await terminalRequest(allyReadEffect(req), 'ALLYEND', req);
    if (end.kv.sid !== ctx.curSaveId) return null;
    const seats = mergeAllies((rowsOf.get(keyA) ?? []).map((m) => allyFromLog(m.kv)).filter((s): s is AllySeat => !!s));
    for (const m of rowsOf.get(keyT) ?? []) addAllyTrait(seats, Number(m.kv.idx), m.kv.t || '');
    return seats;
  } finally { rowsOf.delete(keyA); rowsOf.delete(keyT); }
}

export function registerAllyLog(router: LogRouter): void {
  router.on(SLOT.ALLY, 'ally', (m: SllmMessage) => {
    if (m.kind === 'ACK' && m.fields.includes('ally') && Number(m.kv.req) === allyWatch) {
      allyAck = { req: Number(m.kv.req), status: Number(m.kv.status) };
      return;
    }
    if (m.kind === 'ALLY' || m.kind === 'ALLYTRAIT') {
      const list = rowsOf.get(m.kind + ':' + m.kv.req);
      if (list && list.length < 400) list.push(m);
    } else if (m.kind === 'ALLYEND') terminalReplies.get('ALLYEND:' + m.kv.req)?.(m);
  });
}

const whoOf = (step: AllyAct, sat: AllySeat[], player: string) => {
  const id = step.actor > 0 ? step.actor : step.tid;
  return (id > 0 ? sat.find((s) => s.idx === id)?.name : player) || player;
};

async function runStep(step: AllyAct, sid: string): Promise<{ outcome: 'ok' | 'fail' | 'stale' | 'dup' | 'timeout'; status: number }> {
  return enqueue(async () => {
    const req = ++link.reqCounter;
    allyWatch = req; allyAck = null;
    const done = expectAck(req);
    await sendConsole(allyActEffect(req, sid, step));
    const outcome = await done;
    return { outcome, status: ackStatus(req) };
  });
}

export function registerAlly(): void {
  ipcMain.handle('allyOpen', async () => {
    try {
      if (ally.busy) return { ok: false, error: L('진행 중인 평의회 작업을 기다려 주세요.', 'Please wait for the current council task.') };
      if (!ctx.gameRunning || !/^\d+$/.test(ctx.curSaveId)) return { ok: false, error: L('게임이 켜져 있고 세이브를 불러온 뒤에 평의회를 열 수 있습니다.', 'Open a save with the game running before opening the council.') };
      try { await refreshContacts(); } catch { /* keep the previous contact list */ }
      const found = await readAllies();
      if (!found) return { ok: false, error: L('동맹 목록을 읽지 못했습니다. 게임과 최신 모드 연결을 확인해 주세요.', 'Could not read the allies. Check the game and that the latest mod is connected.') };
      if (!found.length) return { ok: false, error: L('부를 수 있는 나라가 없습니다. 방어 협정이나 종속·종주 관계가 필요합니다. 연방 회원과 독립 보장은 여기 나오지 않습니다.', 'No empire can be summoned. A defensive pact or a subject/overlord relation is required. Federation members and independence guarantees are not listed here.') };
      const contacts = terminal.sid === ctx.curSaveId ? terminal.items.filter((c) => c.type === 'default' && !!c.name.trim() && c.idx !== ctx.playerIdx).map((c) => ({ idx: c.idx, name: c.name, nameEn: c.name })) : [];
      const info: CouncilInfo = {
        sid: ctx.curSaveId, demo: false, candidates: found, contacts,
        playerName: ctx.playerName || L('우리', 'Us'), playerNameEn: ctx.playerName || 'Us',
        playerIdx: ctx.playerIdx, playerCls: ctx.profiles.get(ctx.playerIdx)?.cls ?? 0,
      };
      return { ok: openAlly(info) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('devAllyAi', async () => {
    if (!settings.devMode) return { ok: false, error: L('개발자 모드에서만 사용할 수 있습니다.', 'Available only in developer mode.') };
    return { ok: openAlly(sampleCouncil(), true), message: L('시험 평의회에 실제 AI를 연결했습니다. API를 사용하지만 게임에는 적용하지 않습니다.', 'Connected real AI to the test council. Uses the API but is not applied to the game.') };
  });
  ipcMain.handle('allyState', async () => view());
  ipcMain.handle('allySummon', async (_e, idxs: unknown) => {
    const info = ally.info;
    if (!info) return { ok: false, error: L('열린 평의회가 없습니다.', 'No council is open.') };
    if (ally.busy || ally.uncertain) return { ok: false, error: L('평의회 작업을 기다려 주세요.', 'Please wait for the council task.') };
    if (!Array.isArray(idxs) || !idxs.length || idxs.length > MAX_SEATS || idxs.some((n) => typeof n !== 'number' || !info.candidates.some((c) => c.idx === n))) return { ok: false, error: L('한 명에서 여섯 명까지, 목록에 있는 나라만 부릅니다.', 'Summon one to six empires from the list.') };
    ally.seated = [...new Set(idxs as number[])];
    ally.decision = null; ally.heard = new Set(); ally.turn = 0; ally.applied = false; ally.log = [];
    for (const s of info.candidates) s.stance = 0;
    sys(L(`자리에 ${ally.seated.length}명이 앉았습니다.`, `${ally.seated.length} leaders took their seats.`));
    push(); return { ok: true };
  });
  ipcMain.handle('allyBack', async () => {
    if (!ally.info || ally.busy || ally.uncertain) return { ok: false, error: L('평의회 작업을 기다려 주세요.', 'Please wait for the council task.') };
    ally.seated = []; ally.decision = null; ally.heard = new Set(); ally.applied = false; push(); return { ok: true };
  });
  ipcMain.handle('allyAgenda', async (_e, raw: unknown) => {
    const info = ally.info;
    if (!info || !ally.seated.length) return { ok: false, error: L('먼저 지도자를 부르세요.', 'Summon the leaders first.') };
    if (ally.busy || ally.uncertain || ally.applied) return { ok: false, error: L('결과를 확인한 뒤 평의회를 다시 열어 주세요.', 'Check the result, then reopen the council.') };
    const next = parseDecision(raw);
    if (!next) return { ok: false, error: L('안건을 아직 다 고르지 않았습니다.', 'The proposal is not complete yet.') };
    if (!sameDecision(ally.decision, next)) { ally.heard.clear(); for (const s of seats()) s.stance = 0; ally.turn = 0; }
    ally.decision = next;
    const why = applyProblem(seats(), next, ally.heard, info.contacts, info.playerIdx);
    sys(decisionNotice(seats(), next, info.contacts) + (why ? ` — ${why}` : ''));
    push(); return { ok: true, error: why || undefined };
  });
  ipcMain.handle('allySay', async (_e, r: { text?: unknown; to?: unknown }) => {
    const info = ally.info;
    if (!info || !ally.seated.length) return { ok: false, error: L('열린 평의회가 없습니다.', 'No council is open.') };
    if (ally.busy || ally.applied || ally.uncertain) return { ok: false, error: L('평의회 작업을 기다리거나 평의회를 다시 열어 주세요.', 'Wait for the council task, or reopen the council.') };
    if (!liveOk()) return { ok: false, error: L('게임 상태가 바뀌었습니다. 평의회를 다시 열어 주세요.', 'The game state changed. Please reopen the council.') };
    if (!ally.decision) return { ok: false, error: L('먼저 안건을 고르세요.', 'Choose a proposal first.') };
    const text = typeof r?.text === 'string' ? r.text.trim().slice(0, 600) : '';
    if (!text) return { ok: false, error: L('할 말을 입력하세요.', 'Type what you want to say.') };
    const sat = seats();
    const to = typeof r?.to === 'number' && sat.some((s) => s.idx === r.to) ? r.to : null;
    ally.log.push({ who: info.playerName + (to !== null ? ` → ${sat.find((s) => s.idx === to)!.name}` : L(' → 전체', ' → all')), text, kind: 'me' });
    const family = decisionFamily(ally.decision);
    const paying = ally.decision.kind === 'trade' && ally.decision.dir === 'take';
    const speakers = sat.filter((s) => to === null || s.idx === to);
    if (!info.demo || ally.aiDemo) {
      ally.busy = true; push();
      const epoch = ally.epoch, decision = ally.decision;
      try {
        const replies = await ctx.ai.session(async (chat) => {
          const raw = await chat(allyMessages(sat, speakers, decision, info.playerName, text, ally.log.filter((l) => l.kind !== 'sys').map((l) => ({ who: l.who, text: l.text })), ctx.profiles.get(info.playerIdx)?.gest ?? 0, info.contacts), { purpose: 'allied-council', json: true, maxTokens: 2200 });
          if (ally.info !== info || !liveOk() || link.epoch !== epoch) throw new Error(L('평의회 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The council or the game state changed, so the replies were not applied.'));
          return parseAllyReplies(raw, speakers.map((s) => s.idx));
        });
        if (ally.info !== info || !liveOk() || link.epoch !== epoch) throw new Error(L('평의회 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The council or the game state changed, so the replies were not applied.'));
        const got = new Set(replies.map((rp) => rp.idx));
        for (const rp of replies) {
          const s = sat.find((x) => x.idx === rp.idx); if (!s || !family) continue;
          const will = willingness(s, family, paying);
          s.stance = shapeStance(rp.stance, will, ally.heard.has(s.idx) ? s.stance : undefined);
          ally.heard.add(s.idx);
          ally.log.push({ who: s.ruler || s.name, idx: s.idx, text: rp.say, kind: 'ai' });
        }
        for (const s of speakers) if (!got.has(s.idx) && family) {
          const will = willingness(s, family, paying);
          s.stance = shapeStance(will, will, ally.heard.has(s.idx) ? s.stance : undefined);
          ally.heard.add(s.idx);
          sys(L(`${s.name}: 응답이 없어 성향으로 입장을 정했습니다.`, `${s.name}: no reply, so their nature set the stance.`));
        }
        ally.turn++;
        return { ok: true };
      } catch (e) { const error = (e as Error).message; if (ally.info === info) sys(error); return { ok: false, error }; }
      finally { ally.busy = false; push(); }
    }
    ally.turn += 1;
    for (const s of speakers) {
      const rp = allyDemoReply(s, ally.decision, ally.turn);
      s.stance = rp.stance; ally.heard.add(s.idx);
      ally.log.push({ who: s.ruler || s.name, idx: s.idx, text: rp.say, kind: 'ai' });
    }
    push(); return { ok: true };
  });
  ipcMain.handle('allyApply', async (_e, confirmed?: unknown) => applyDecision(false, confirmed === true));
  ipcMain.handle('allyBreak', async (_e, confirmed?: unknown) => applyDecision(true, confirmed === true));
  ipcMain.handle('allyClose', async () => { closeAlly(); return { ok: true }; });
}

async function applyDecision(snub: boolean, confirmed: boolean): Promise<{ ok: boolean; error?: string }> {
  const info = ally.info;
  if (!info || !seats().length) return { ok: false, error: L('열린 평의회가 없습니다.', 'No council is open.') };
  if (info.demo) return { ok: false, error: L('시연 평의회는 게임에 적용하지 않습니다.', 'The demo council is not applied to the game.') };
  if (!confirmed) return { ok: false, error: L('적용 확인이 필요합니다.', 'Confirmation is required.') };
  if (ally.busy || ally.applied || ally.uncertain) return { ok: false, error: L('이미 처리 중이거나 요청한 결정입니다.', 'Already processing or already requested.') };
  if (!liveOk()) return { ok: false, error: L('게임 상태가 바뀌었습니다. 평의회를 다시 열어 주세요.', 'The game state changed. Please reopen the council.') };
  const decision = snub ? { kind: 'snub' as const } : ally.decision;
  if (!decision) return { ok: false, error: L('먼저 안건을 고르세요.', 'Choose a proposal first.') };
  const sat = seats();
  const why = applyProblem(sat, decision, ally.heard, info.contacts, info.playerIdx);
  if (why) return { ok: false, error: why };
  const plan = planCouncil(sat, decision);
  if (!plan.steps.length && !plan.playerPeace) return { ok: false, error: plan.notes.join(' ') || L('적용할 결정이 없습니다.', 'There is nothing to apply.') };
  ally.busy = true; push();
  const lines: string[] = [...plan.notes];
  let anyOk = false;
  try {
    if (plan.playerPeace && decision.kind === 'peace') {
      const enemy = info.contacts.find((c) => c.idx === decision.target)?.name || `#${decision.target}`;
      const peace = await playerPeace(decision.target, enemy);
      lines.push(peace.text);
      if (peace.outcome === 'timeout') { ally.uncertain = true; lines.push(L('응답을 확인하지 못해 더 보내지 않습니다. 평의회를 다시 열어 주세요.', 'The reply was not confirmed, so nothing further was sent. Please reopen the council.')); }
      else if (peace.outcome === 'ok') anyOk = true;
    }
    if (!ally.uncertain) {
      for (const step of plan.steps) {
        const r = await runStep(step, info.sid);
        if (r.outcome === 'timeout') {
          ally.uncertain = true;
          lines.push(L('응답을 확인하지 못해 더 보내지 않습니다. 평의회를 다시 열어 주세요.', 'The reply was not confirmed, so nothing further was sent. Please reopen the council.'));
          break;
        }
        const code = r.outcome === 'ok' ? 1 : r.status;
        lines.push(statusLine(code || 0, whoOf(step, sat, info.playerName)));
        if (code === 1) anyOk = true;
        else if (step.halt || r.outcome === 'stale' || r.outcome === 'dup') break;
      }
    }
    for (const line of lines) sys(line);
    if (anyOk) {
      ally.applied = true;
      chronNoteWorld(lines.filter(Boolean).slice(0, 4).join(' · ').slice(0, 400), true);
    }
    logDiagnostic('info', 'ally.apply', { kind: decision.kind, ok: anyOk, uncertain: ally.uncertain });
    return { ok: anyOk, error: anyOk ? undefined : lines.join('\n') };
  } catch (e) {
    if (anyOk) ally.uncertain = true;
    const error = (e as Error).message;
    sys(error);
    return { ok: false, error };
  } finally { ally.busy = false; push(); }
}

export { sampleCouncil };

// A-00b 5번: 연설(앱 쪽) — 연설 준비·진행·버프 적용, 연설 창, IPC 5개, 로그 분배 자리 SPEECH_PF·SPEECH.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 순수 로직은 src/speech.ts. speechCtx(군중 상황)는 ctx와 헷갈리지 않게 speech.crowdCtx로 이름만 바꿨다.
// ---- 연설: 결정을 누르면 3개월 뒤 준비 완료 알림 → 종류 선택 → 연설문 → AI 등급 → 고정 버프
import { glassWin } from '../office';
import { SpeechCtxCollector } from '../gamestate';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { SpeechStore, SpeechSess, SpeechPf, SpeechCtx, SPEECH_TYPES, GRADES, TURN_MIN, TURN_MAX, speechType, speechApplyEffect, pfFrom, ctxFrom, baseMood, crowdProfile, speechStage, stageView, newSession, applyTurn, parseTurn, moodGrade, checkTurnText, turnMessages, speechAppliedMatches } from '../speech';
import { classKey } from '../speciesClass';
import { redactKey, conversationOf } from '../aiclient';
import { RADIO_IDX } from '../chronicle';
import type { SllmMessage } from '../protocol';
import { settings } from '../app/settings';
import { enqueue, sendConsole, link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { chronPut } from './chronicle-app';
import { radio } from './radio-app';
import { imageState } from './images';
import { ctx } from '../app/ctx';
import { pick } from './settings-ui';
const L = pick; // 한국어·영어·언어 팩

export const speech = {
  /** 세이브 번호를 모를 때 들어온 연설 준비 시작(번호를 알면 시작한다) */
  prepPending: null as { date: string; pf: SpeechPf | null } | null,
  pfLast: null as SpeechPf | null,
  /** 군중 상황(SPEECHCTX) */
  crowdCtx: null as SpeechCtx | null,
  busy: false,
  applyN: 0,
  win: null as BrowserWindow | null,
  /** 지금 진행 중인 연설(앱을 끄면 사라지고, 준비는 그대로 남는다) */
  sess: null as { sid: string; sess: SpeechSess } | null,
  ackWaiter: null as ((sid: string, key: string, n: number) => void) | null,
  /** 버프 명령을 이미 보낸 연설(확인 전이라도 다시 보내지 않는다, 2026-10-18) */
  sentFor: null as { cur: object; epoch: number } | null,
  /** 확인 시간을 넘긴 버프 명령. 늦게 확인 줄이 오면 그때 연설을 마무리한다. */
  late: null as { sid: string; n: number; key: string; finish: () => void } | null,
};
let speechStoreInst: SpeechStore | null = null;
export const speechStore = () => (speechStoreInst ??= new SpeechStore(path.join(app.getPath('userData'), 'sllm_speech.json')));

export const speechReady = () => !!ctx.curSaveId && speechStore().get(ctx.curSaveId).phase === 'ready';
const outlookOf = (b: number) => (b >= 8 ? '호의적' : b <= -8 ? '냉담' : '반반'); // 화면이 이 값으로 색을 고른다(보이는 글은 outlookText)
const outlookText = (o: string) => (o === '호의적' ? L('호의적', 'Favorable') : o === '냉담' ? L('냉담', 'Cold') : L('반반', 'Mixed'));
export function leaderPortrait(pf: SpeechPf | null): string | null {
  const k = pf?.cls ? classKey(pf.cls) : null; if (!k) return imageState().images['ruler:player'] ?? null; // 플레이어 통치자 그림은 계열을 몰라도 쓴다
  const st = imageState(); return st.images['ruler:player'] ?? st.images[`leader:${k}`] ?? st.images[`class:${k}`] ?? st.defaults[k] ?? null;
}
export function speechView() {
  const st = ctx.curSaveId ? speechStore().get(ctx.curSaveId) : { phase: 'none', start: '', due: '', pf: null as SpeechPf | null };
  const pf = ctx.speechWithEthics(st.pf ?? speech.pfLast), cp = crowdProfile(pf, speech.crowdCtx, L), cur = speech.sess && speech.sess.sid === ctx.curSaveId ? speech.sess.sess : null;
  return {
    phase: st.phase, start: st.start, due: st.due, date: ctx.gameDate, running: ctx.gameRunning, minChars: TURN_MIN, maxChars: TURN_MAX, turns: settings.speechTurns,
    empire: ctx.playerName, leader: leaderPortrait(pf), crowd: { summary: cp.summary, lines: cp.lines, gestalt: cp.gestalt, kind: pf?.auth === 7 ? 'machine' : pf?.auth === 6 ? 'hive' : 'normal' }, stage: stageView(speechStage(pf), L),
    types: SPEECH_TYPES.map((t) => { const o = outlookOf(baseMood(pf, t.key, speech.crowdCtx)); return { key: t.key, name: t.name, effects: L(t.effects, t.effectsEn), outlook: o, outlookText: outlookText(o) }; }),
    grades: GRADES.map((g) => ({ grade: g.grade, name: g.name, days: g.days })),
    sess: cur ? { kind: cur.kind, turns: cur.turns, max: cur.max, mood: cur.mood, log: cur.log.slice(-400), done: cur.done } : null,
  };
}
export function pushSpeech() { if (speech.win && !speech.win.isDestroyed()) speech.win.webContents.send('speechState', speechView()); }
const SPEECH_TURN_TOKENS = 1500; // 군중 반응 한 번의 토큰 한도(다시 부를 때는 두 배)
const SPEECH_ACK_MS = 15000;     // 버프 명령을 보낸 뒤 게임의 확인(SPEECH phase=applied)을 기다리는 시간
/** 연설을 끝내고 기록을 남긴다(버프가 확인됐거나 등급 0 이라 보낼 것이 없을 때). */
export function finishSpeech(cur: { sid: string; sess: SpeechSess }, t: NonNullable<ReturnType<typeof speechType>>, grade: number, gname: string, date: string): void {
  const s = cur.sess;
  s.done = true; if (speech.sess === cur) speech.sess = null; speechStore().finish(cur.sid);
  // 기록은 남기는 순간의 인터페이스 언어로(2026-10-19)
  const GEN = ['Failed', 'Acceptable', 'Good', 'Excellent'], gEn = GEN[grade] ?? gname;
  chronPut(RADIO_IDX, date, L(`연설: ${t.name}(${gname}) — 국민 분위기 ${s.mood >= 55 ? '열광' : s.mood >= 30 ? '호응' : s.mood >= 8 ? '무난' : '싸늘'}`, `Speech: ${t.nameEn} (${gEn}) — public mood ${s.mood >= 55 ? 'enthusiastic' : s.mood >= 30 ? 'responsive' : s.mood >= 8 ? 'fair' : 'chilly'}`), false, { name: '성간라디오 전용 연대기', world: true, uid: `speech|${date}|${speech.applyN}` });
  if (radio.on) radio.q.push({ kind: 'speech', date, text: L(`연설: ${ctx.playerName || '플레이어 제국'}의 지도자가 ${t.name} 연설을 했다(국민 반응: ${gname})`, `Speech: the leader of ${ctx.playerName || 'the player empire'} gave a ${t.nameEn} speech (public reaction: ${gEn})`), n: speech.applyN, id: `speech|${date}|${speech.applyN}` });
  pushSpeech();
}
/** SPEECH phase=applied 줄: 기다리는 요청이 있으면 그쪽으로, 시간이 지난 요청이면 늦게라도 마무리한다. */
export function onSpeechApplied(sid: string, key: string, n: number): void {
  if (sid !== ctx.curSaveId) return;
  if (speech.ackWaiter) { speech.ackWaiter(sid, key, n); return; }
  if (speech.late && speechAppliedMatches(speech.late, sid, key, n)) { const f = speech.late.finish; speech.late = null; f(); }
}
export function openSpeech(glass = false) {
  if (speech.win && !speech.win.isDestroyed()) { speech.win.show(); speech.win.focus(); pushSpeech(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1700, Math.round(area.width * 0.94)), height: Math.min(960, Math.round(area.height * 0.9)) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  speech.win = new BrowserWindow({ ...sz, x, y, resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  speech.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void speech.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'speech.html'));
  speech.win.once('ready-to-show', () => { speech.win?.show(); pushSpeech(); });
  speech.win.on('closed', () => { speech.win = null; });
}
/** 결정을 눌렀다는 로그. 세이브 번호를 아직 모르면 번호를 알 때까지 기다린다. */
export function startSpeechPrep(date: string, pf: SpeechPf | null) {
  if (!ctx.curSaveId) { speech.prepPending = { date, pf }; return; }
  if (speechStore().start(ctx.curSaveId, date, pf)) { const due = speechStore().get(ctx.curSaveId).due; ctx.notify({ kind: 'info', title: pick('연설 준비 시작', 'Speech preparation started'), body: pick(`연설 준비를 시작했습니다. 게임 날짜로 3개월 뒤(${due})에 알려 드립니다.`, `Speech preparation has started. You will be notified in 3 game months (${due}).`) }); pushSpeech(); }
}


/** SPEECHWAR 줄을 모아 SPEECHCTX 원시값과 함께 군중 상황으로 바꾼다(2026-10-16, src/gamestate.ts). */
const crowdCtxCollector = new SpeechCtxCollector();
export function registerSpeech(router: LogRouter): void {
  router.on(SLOT.SPEECH_PF, 'speech:pf', (m: SllmMessage) => {
    { const spf = pfFrom(m); if (spf) speech.pfLast = spf; const sc = crowdCtxCollector.feed(m); if (sc) speech.crowdCtx = sc; }
  });
  router.on(SLOT.SPEECH, 'speech:phase', (m: SllmMessage) => {
    if (m.kind === 'SPEECH') { if (m.kv.phase === 'prep') startSpeechPrep(ctx.gameDate, speech.pfLast); else if (m.kv.phase === 'applied') onSpeechApplied(m.kv.sid ?? '', m.kv.key ?? '', m.kv.n === undefined ? NaN : Number(m.kv.n)); }
  });
  ipcMain.handle('speechState', async () => speechView());
  ipcMain.handle('speechClose', async () => { if (speech.win && !speech.win.isDestroyed()) speech.win.close(); return true; });
  ipcMain.handle('speechStart', async (_e, kind: unknown) => {
    const t = speechType(kind); if (!t) return { ok: false, error: pick('연설 종류를 확인해 주세요.', 'Please check the speech type.') };
    if (!speechReady() || !ctx.curSaveId) return { ok: false, error: pick('아직 연설 준비가 끝나지 않았습니다.', 'The speech is not ready yet.') };
    if (speech.sess && speech.sess.sid === ctx.curSaveId && speech.sess.sess.turns > 0) return { ok: false, error: pick('이미 연설이 진행 중입니다.', 'A speech is already in progress.') };
    const speechSid=ctx.curSaveId; await ctx.refreshEthics(ctx.playerIdx);
    if(speechSid!==ctx.curSaveId||!speechReady())return {ok:false,error:pick('연설 상태가 바뀌었습니다.', 'The speech state changed.')};
    const pf = ctx.speechWithEthics(speechStore().get(ctx.curSaveId).pf ?? speech.pfLast);
    speech.sess = { sid: ctx.curSaveId, sess: newSession(t.key, pf, settings.speechTurns, speech.crowdCtx) };
    pushSpeech(); return { ok: true, state: speechView() };
  });
  ipcMain.handle('speechSay', async (_e, text: unknown) => {
    if (typeof text !== 'string') return { ok: false, error: pick('발언을 확인해 주세요.', 'Please check what you said.') };
    const bad = checkTurnText(text); if (bad) return { ok: false, error: bad };
    if (speech.busy) return { ok: false, error: pick('이미 처리 중입니다.', 'Already in progress.') };
    if (!speech.sess || speech.sess.sid !== ctx.curSaveId || !speechReady()) return { ok: false, error: pick('진행 중인 연설이 없습니다.', 'No speech is in progress.') };
    if (speech.sess.sess.done) return { ok: false, error: pick('발언 횟수를 모두 썼습니다. 결과를 확정해 주세요.', 'You have used all your turns. Please finalize the result.') };
    if (!ctx.gameRunning) return { ok: false, error: pick('게임이 켜져 있어야 연설할 수 있습니다.', 'The game must be running to give a speech.') };
    speech.busy = true; const cur = speech.sess, s = cur.sess;
    try {
      const pf = ctx.speechWithEthics(speechStore().get(cur.sid).pf ?? speech.pfLast), date = ctx.gameDate, clean = text.replace(/\s+/g, ' ').trim(), final = s.turns + 1 >= s.max;
      // 추론 모델은 추론 토큰도 한도에 들어가 700 으로는 자주 끊겼다. 1500 으로 부르고, 끊기면 한도를 두 배로 늘리고 짧게 쓰라고 다시 부른다.
      let r: ReturnType<typeof parseTurn> = null;
      for (let i = 0; i < 2; i++) {
        let cut = false;
        const p = parseTurn(await ctx.ai.chat(turnMessages(ctx.playerName, pf, s, clean, date, final, speech.crowdCtx, i > 0), { maxTokens: SPEECH_TURN_TOKENS * (i + 1), json: true, conversationId: conversationOf(s), onTruncated: () => { cut = true; } }));
        if (p && !p.partial) { r = p; break; }
        if (p && !r) r = p; // 끊긴 조각에서 되살린 반응은 다시 시도해도 안 될 때 쓴다
        logDiagnostic('warn', 'ai.response.invalid', { feature: 'speech', attempt: i + 1, truncated: cut, partial: !!p });
      }
      if (!r) return { ok: false, error: pick('국민의 반응을 읽지 못했습니다. 다시 시도해 주세요(이번 발언은 횟수에 세지 않습니다).', 'Could not read the people\'s reaction. Please try again (this line does not count as a turn).') };
      if (speech.sess !== cur) return { ok: false, error: pick('연설이 바뀌었습니다.', 'The speech changed.') }; // 도중에 세이브가 바뀌거나 취소됨
      const { delta } = applyTurn(s, clean, r); pushSpeech();
      return { ok: true, delta, state: speechView() };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { speech.busy = false; }
  });
  /** 연설을 마친다(횟수를 다 썼거나 플레이어가 마치기를 눌렀을 때). 최종 분위기로 등급을 정하고 버프를 건다. */
  ipcMain.handle('speechEnd', async () => {
    if (speech.busy) return { ok: false, error: pick('이미 처리 중입니다.', 'Already in progress.') };
    if (!speech.sess || speech.sess.sid !== ctx.curSaveId || !speechReady()) return { ok: false, error: pick('진행 중인 연설이 없습니다.', 'No speech is in progress.') };
    const cur = speech.sess, s = cur.sess; if (s.turns < 1) return { ok: false, error: pick('한 번도 발언하지 않았습니다.', 'You have not spoken yet.') };
    if (speech.sentFor && speech.sentFor.cur === cur && speech.sentFor.epoch === link.epoch) return { ok: false, error: pick('이 연설의 버프 명령은 이미 보냈습니다. 게임이 확인해 주면 자동으로 마무리됩니다(다시 보내지 않습니다).', 'This speech\'s buff command was already sent. It will finish automatically once the game confirms (it will not be resent).') };
    if (!ctx.gameRunning) return { ok: false, error: pick('게임이 켜져 있어야 연설을 마칠 수 있습니다.', 'The game must be running to finish the speech.') };
    speech.busy = true;
    try {
      const t = speechType(s.kind)!, date = ctx.gameDate, grade = moodGrade(s.mood), gname = GRADES.find((g) => g.grade === grade)?.name ?? '';
      if (grade > 0) {
        const n = ++link.reqCounter, cmd = speechApplyEffect(t.key, grade, n)!;
        speech.applyN = n;
        const expected = { sid: cur.sid, n, key: `sllm_speech_${t.key}_${grade}` };
        speech.late = null;
        // 대기는 명령을 큐에 넣기 전에 걸어 두되(빨리 온 확인도 받도록), 시간 재기는 명령이 실제로 나간 뒤에 시작한다.
        let acked = false, to: ReturnType<typeof setTimeout> | null = null, settle: (v: boolean) => void = () => {};
        const ack = new Promise<boolean>((resolve) => { settle = resolve; });
        speech.ackWaiter = (sid, key, number) => { if (speech.sess !== cur || ctx.curSaveId !== cur.sid || !speechAppliedMatches(expected, sid, key, number)) return; acked = true; if (to) clearTimeout(to); speech.ackWaiter = null; settle(true); };
        speech.sentFor = { cur, epoch: link.epoch }; // 보내기 전에 표시(세이브를 다시 불러오면 epoch 가 바뀌어 다시 보낼 수 있다)(시간 초과 뒤 [마치기]를 다시 눌러도 같은 버프를 두 번 걸지 않게)
        try { await enqueue(() => sendConsole(cmd)); } catch (e) { speech.ackWaiter = null; speech.sentFor = null; return { ok: false, error: pick('게임에 명령을 보내지 못했습니다: ', 'Could not send the command to the game: ') + (e as Error).message }; }
        if (!acked) to = setTimeout(() => { if (speech.ackWaiter) speech.ackWaiter = null; settle(false); }, SPEECH_ACK_MS);
        if (!(await ack)) {
          // 늦게라도 SPEECH phase=applied 가 오면 그때 마무리한다(자동 재전송은 하지 않는다).
          speech.late = { ...expected, finish: () => { if (speech.sess !== cur || ctx.curSaveId !== cur.sid) return; finishSpeech(cur, t, grade, gname, date); ctx.notify({ kind: 'speech', title: pick('연설 마무리', 'Speech concluded'), body: pick(`게임이 늦게 버프 적용을 확인했습니다: ${t.name}(${gname})`, `The game confirmed the buffs late: ${t.name} (${gname})`) }); } };
          return { ok: false, error: pick('게임이 아직 버프 적용을 확인해 주지 않았습니다. 늦게라도 확인되면 자동으로 마무리됩니다. 게임이 켜져 있는지, 모드가 최신인지 확인해 주세요(연설 내용은 그대로 남아 있습니다).', 'The game has not confirmed the buffs yet. It will finish automatically if confirmed later. Check that the game is running and the mod is up to date (your speech is kept).') };
        }
      }
      if (ctx.curSaveId !== cur.sid || speech.sess !== cur) return { ok: false, error: pick('세이브 또는 연설이 바뀌어 결과를 확정하지 않았습니다.', 'The save or speech changed, so the results were not finalized.') };
      finishSpeech(cur, t, grade, gname, date);
      return { ok: true, grade, gradeName: gname, mood: s.mood, days: GRADES.find((g) => g.grade === grade)?.days ?? 0, type: t.key, turns: s.turns };
    } finally { speech.busy = false; }
  });
}

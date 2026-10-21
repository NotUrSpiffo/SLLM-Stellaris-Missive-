// 언론사 인터뷰(앱 쪽, 2026-10-17) — 시행령 준비·3개월 뒤 알림·인터뷰 창·평가·행복도 버프 적용. 순수 로직은 src/press.ts.
// 흐름은 연설(speech-app.ts)과 같다: 시행령 → SLLM:PRESS phase=prep → 월 신호로 준비 완료 → 알림 → 창 → 끝나면 버프 1번.
import { glassWin } from '../office';
import { isGestalt } from './gestalt-app';
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { SpeechStore, ctxLines, crowdProfile } from '../speech';
import { randomUUID } from 'crypto';
import { addDays } from '../policy';
import { PressSess, pressGovIndex, PRESS_TOPICS, PRESS_STEP_PCT, PRESS_DAYS, parsePressTopics, parsePressVerdict, newPressSess, pressPick, pressAnswer, pressCloseTopic, pressFinish, pressAllClosed, pressGood, pressPercent, pressApplyEffect, pressModifierKey, pressAppliedMatches, checkPressText, pressMaterial, pressTopicMessages, newScandalSess, pressBribeCommand, PRESS_BRIBE_COST, BRIBED_REPORTER, BRIBED_DESK, pressReplyMessages, pressVerdictMessages } from '../press';
import { gameName } from './namegen-app'; // 기자 이름(게임 이름 표)
import { RADIO_IDX } from '../chronicle';
import type { SllmMessage } from '../protocol';
import { redactKey, conversationOf } from '../aiclient';
import { logDiagnostic } from '../diagnostics';
import { settings } from '../app/settings';
import { enqueue, sendConsole, link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { chron, chronPut } from './chronicle-app';
import { radio } from './radio-app';
import { splitAbout } from '../radio';
import { speech, leaderPortrait } from './speech-app';
import { pick } from './settings-ui';
import { policyForPress, policyAnnounced, policyModsInUse } from './policy-app';
import { chronNote } from './chronicle-app';
import { writeLetter } from './mail-app';
import { terminalRequest, terminalReplies } from './terminal';
import { edictStore, activeEdict } from './edict-store';
import { type EdictPick, type EdictPlan, edictPlan, planAdds, fmtValue, edictCommand, govReplyMessages, govVerdictMessages, parseGovVerdict, edictChronLine, protestWhy, isEdictYears, ETHICS, STRENGTH_KO, STRENGTH_EN, PROTEST_LETTERS, EDICT_YEARS } from '../edict';
/** 알림 문구: 숫자·날짜가 들어간 문장은 번역 사전으로 못 바꾸므로 여기서 고른다(고정 문구는 i18n-catalog). */
const L = pick; // 한국어·영어·언어 팩(2026-10-18)

export const press = {
  /** 세이브 번호를 모를 때 들어온 준비 시작(번호를 알면 시작한다) */
  prepPending: null as { date: string } | null,
  busy: false,
  win: null as BrowserWindow | null,
  /** 진행 중인 인터뷰(앱을 끄면 사라지고, 준비 완료 상태는 그대로 남는다) */
  sess: null as PressCur | null,
  /** 칙령 적용 중 반대 가치관 제국 번호(EDICTX, 요청 번호별) */
  edictFoes: new Map<number, number[]>(),
  ackWaiter: null as ((sid: string, key: string, n: number) => void) | null,
  late: null as { sid: string; n: number; key: string; finish: () => void } | null,
  readyNotified: '',
  /** 방금 끝난 인터뷰 결과(창에 결과를 보여 주려고 남겨 둔다) */
  last: null as { sid: string; outlet: string; topics: PressSess['topics']; good: number; percent: number; date: string; edict?: string; scandal?: 'scandal' | 'hearing' } | null,
  /** 긴급 기자회견(2026-10-20): 준비 기간 없이 열리고 한 주제만. kind = scandal(추문, scandal-app) 또는 hearing(첩보 의혹 청문회의 국내 기자회견, espionage-app). 끝나면 done(호평?) */
  scandal: null as { sid: string; id: string; suspect: string; date: string; done: (good: boolean) => void; kind?: 'scandal' | 'hearing'; topic?: { title: string; question: string; source: string }; bribed?: boolean } | null,
};
const scandalNow = () => (press.scandal && press.scandal.sid === ctx.curSaveId ? press.scandal : null);
/** 추문 기자회견 열기. 다른 인터뷰가 진행 중이면 오류 문구. */
export function openScandalPress(s: NonNullable<typeof press.scandal>): string {
  if (press.sess && press.sess.sid === ctx.curSaveId && !press.sess.scandal) return L('다른 언론사 인터뷰가 진행 중입니다. 먼저 끝내 주세요.', 'Another press interview is in progress. Finish it first.');
  press.scandal = s; press.last = null; openPress(); pushPress(); return '';
}
/** 「정부 발표」 칸 상태(2026-10-18): 분류된 칙령 후보 → 인터뷰 끝낼 때 확인 카드 → 확정/버림 */
interface GovState { policy: { id: string; title: string } | null; pick: EdictPick | null; state: 'none' | 'pending' | 'applied' | 'skipped'; applied?: string }
type PressCur = { sid: string; sess: PressSess; gov: GovState; scandal?: boolean; kind?: 'scandal' | 'hearing'; bribed?: boolean };
let storeInst: SpeechStore | null = null;
/** 준비 상태 저장소: 연설과 같은 규칙(세이브마다 하나, 3개월 뒤 ready, 되감기면 취소)이라 같은 클래스를 다른 파일로 쓴다. */
export const pressStore = () => (storeInst ??= new SpeechStore(path.join(app.getPath('userData'), 'sllm_press.json')));
export const pressReady = () => !!ctx.curSaveId && pressStore().get(ctx.curSaveId).phase === 'ready';
const ACK_MS = 15000;

function situation(): string[] {
  const EN = (_ko: string, en: string) => en; // 프롬프트는 영어(2026-10-19), 답 언어는 AI 언어 설정을 따른다
  const pf = ctx.speechWithEthics(speech.pfLast), cp = crowdProfile(pf, speech.crowdCtx, EN);
  return [`Public outlook: ${cp.summary}`, ...ctxLines(speech.crowdCtx, EN)].slice(0, 12);
}
/** 이 세이브의 연대기(현재 시간선) — 제국별 기록 + 성간라디오 전용 연대기 + 세계 소식 */
function material(): string[] {
  if (!ctx.curSaveId) return [];
  try {
    const groups = chron().groups(ctx.curSaveId, (all) => ctx.govMem().split(ctx.curSaveId, all).own);
    const all = groups.flatMap((g) => g.items.map((e) => ({ date: e.date, who: g.idx === RADIO_IDX ? '' : g.name, text: e.text })));
    // 라디오 연대기는 제국별 기록을 '○○ 관련: …'으로 옮겨 둔 사본을 가진다(알파 6). 같은 날 같은 사실은 한 줄만 자료로 넣는다(제국 이름이 붙은 원본 우선, 2026-10-18).
    // 키는 날짜|제국|문장: 라디오 사본 '○○ 관련: x'는 ○○ 제국의 x 와 같은 줄로 보고, 다른 제국의 같은 문장은 따로 둔다.
    const key = (l: { date: string; who: string; text: string }) => { const t = l.text.replace(/\s+/g, ' ').trim(), m = l.who ? null : splitAbout(t); return l.date + '|' + (m ? m[0] + '|' + m[1] : l.who + '|' + t); }; // '○○ 관련: x' / 'About ○○: x' 둘 다
    const seen = new Set<string>();
    const lines = [...all.filter((l) => l.who), ...all.filter((l) => !l.who)].filter((l) => { const k = key(l); if (seen.has(k)) return false; seen.add(k); return true; });
    return pressMaterial(lines, 40);
  } catch (e) { logDiagnostic('warn', 'press.material.failed', { error: String(e) }); return []; }
}
function outletName(): string {
  const names = (settings.mediaPrefs || []).map((m) => m.paperName).filter((n) => typeof n === 'string' && n.trim());
  return names.length ? names[Math.floor(Math.random() * names.length)] : L('은하 언론', 'Galactic Press');
}
export function pressView() {
  const st = ctx.curSaveId ? pressStore().get(ctx.curSaveId) : { phase: 'none', start: '', due: '' };
  const cur = press.sess && press.sess.sid === ctx.curSaveId ? press.sess.sess : null;
  const sc = scandalNow();
  return {
    scandal: sc ? { suspect: sc.suspect, date: sc.date, kind: sc.kind ?? 'scandal', bribed: !!sc.bribed, bribeCost: PRESS_BRIBE_COST } : null,
    phase: st.phase, start: st.start, due: st.due, date: ctx.gameDate, running: ctx.gameRunning, busy: press.busy,
    empire: ctx.playerName, leader: leaderPortrait(speech.pfLast), step: PRESS_STEP_PCT, days: PRESS_DAYS, maxTopics: PRESS_TOPICS,
    last: press.last && press.last.sid === ctx.curSaveId ? { outlet: press.last.outlet, topics: press.last.topics, good: press.last.good, percent: press.last.percent, date: press.last.date, edict: press.last.edict ?? '', scandal: press.last.scandal ?? '' } : null,
    edictNow: (() => { const a = activeEdict(ctx.curSaveId, ctx.gameDate); return a ? { title: a.title, end: a.end } : null; })(),
    sess: cur ? { scandal: press.sess && press.sess.scandal ? press.sess.kind ?? 'scandal' : '', outlet: cur.outlet, reporter: cur.reporter, topics: cur.topics, current: cur.current, log: cur.log.slice(-300), done: cur.done, good: pressGood(cur), percent: pressPercent(cur), gov: govView() } : null,
  };
}
/** 확인 카드(언어 팩: pick). 효과 줄은 앱이 정한 묶음에서 만든다. */
function edictCard(p: EdictPick): { title: string; name: string; strength: string; positive: boolean; lines: Array<{ t: string; c: 'pro' | 'con' | 'foe' | 'drop' }>; years: readonly number[]; defYears: number; replaces: string } | null {
  let pl: EdictPlan; try { pl = edictPlan(p, policyModsInUse()); } catch { return null; }
  const lines: Array<{ t: string; c: 'pro' | 'con' | 'foe' | 'drop' }> = [];
  for (const l of pl.pros) lines.push(l.dropped ? { t: L(`${l.ko} ${fmtValue(l)} — ${l.dropped === 'policy' ? '집무실 정책과 겹쳐 빠짐' : '기자 반응이 나빠 빠짐'}`, `${l.en} ${fmtValue(l)} — ${l.dropped === 'policy' ? 'dropped (same effect as an office policy)' : 'dropped (poor press reception)'}`), c: 'drop' } : { t: `${L(l.ko, l.en)} ${fmtValue(l)}`, c: 'pro' });
  lines.push({ t: `${L(pl.con.ko, pl.con.en)} ${fmtValue(pl.con)}`, c: 'con' });
  if (pl.def.foe) lines.push({ t: L(`${ETHICS[pl.def.foe].ko} 제국들의 우리 관계 ${pl.opinionValue}`, `${ETHICS[pl.def.foe].en} empires' opinion of us ${pl.opinionValue}`), c: 'foe' });
  const prev = activeEdict(ctx.curSaveId, ctx.gameDate);
  return { title: p.title, name: L(pl.def.ko, pl.def.en), strength: L(STRENGTH_KO[p.strength], STRENGTH_EN[p.strength]), positive: p.positive, lines, years: EDICT_YEARS, defYears: 2, replaces: prev ? prev.title : '' };
}
function govView() {
  const c = press.sess && press.sess.sid === ctx.curSaveId ? press.sess : null; if (!c) return null;
  const g = c.gov; return { state: g.state, policy: g.policy ? g.policy.title : '', applied: g.applied ?? '', card: g.pick && g.state === 'pending' ? edictCard(g.pick) : null };
}
export function pushPress() { if (press.win && !press.win.isDestroyed()) press.win.webContents.send('pressState', pressView()); }
export function openPress(glass = false) {
  if (isGestalt() && !(press.win && !press.win.isDestroyed())) { ctx.notify({ kind: 'info', title: L('언론사 인터뷰 없음', 'No press interviews'), body: L('단일 의식(기계 지성·군체) 제국에는 자유 언론이 없어 인터뷰를 열 수 없습니다.', 'A gestalt empire (machine intelligence or hive mind) has no free press, so interviews are unavailable.') }); return; } // 2026-10-19 사용자 결정
  if (press.win && !press.win.isDestroyed()) { press.win.show(); press.win.focus(); pushPress(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.round(area.width), height: Math.round(area.height) };
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  press.win = new BrowserWindow({ ...sz, x, y, minWidth: 900, minHeight: 600, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  press.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void press.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'press.html'));
  press.win.once('ready-to-show', () => { press.win?.show(); pushPress(); });
  press.win.on('closed', () => { press.win = null; });
}
/** 시행령을 켰다는 로그. 세이브 번호를 아직 모르면 번호를 알 때까지 기다린다. */
export function startPressPrep(date: string) {
  if (!ctx.curSaveId) { press.prepPending = { date }; return; }
  if (pressStore().start(ctx.curSaveId, date, null)) {
    const due = pressStore().get(ctx.curSaveId).due;
    ctx.notify({ kind: 'info', title: L('언론사 인터뷰 준비 시작', 'Press interview preparation started'), body: L(`인터뷰 준비를 시작했습니다. 게임 날짜로 3개월 뒤(${due})에 알려 드립니다.`, `Interview preparation has started. You will be notified in 3 months (game date ${due}).`) });
    pushPress();
  }
}
function onMonth(date: string) {
  if (press.prepPending && ctx.curSaveId) { const q = press.prepPending; press.prepPending = null; startPressPrep(q.date); }
  const sid = ctx.curSaveId; if (!sid || !date) return;
  const justReady = pressStore().tick(sid, date);
  // 이미 준비가 끝난 채로 불러온 세이브도 앱을 켠 뒤 첫 월 신호에 한 번 알린다(연설과 같음).
  if (justReady || (pressStore().get(sid).phase === 'ready' && press.readyNotified !== sid)) {
    press.readyNotified = sid;
    ctx.notify({ kind: 'press', title: L('언론사 인터뷰 준비 완료', 'Press interview ready'), body: L('기자들이 인터뷰를 기다리고 있습니다. 인터뷰를 시작하시겠습니까?', 'The reporters are waiting. Start the interview?'), action: L('인터뷰하기', 'Start interview') });
    pushPress();
  }
}
function onApplied(sid: string, key: string, n: number) {
  if (sid !== ctx.curSaveId) return;
  if (press.ackWaiter) { press.ackWaiter(sid, key, n); return; }
  if (press.late && pressAppliedMatches(press.late, sid, key, n)) { const f = press.late.finish; press.late = null; f(); }
}
/** 인터뷰를 끝내고 기록을 남긴다(버프가 확인됐거나 호평 0 이라 보낼 것이 없을 때). */
function finishPress(cur: PressCur, date: string, n: number) {
  const s = cur.sess, good = pressGood(s), pct = pressPercent(s);
  if (press.sess === cur) press.sess = null; pressStore().finish(cur.sid);
  press.last = { sid: cur.sid, outlet: s.outlet, topics: s.topics, good, percent: pct, date, edict: cur.gov.applied ?? '' };
  // 기록은 남기는 순간의 인터페이스 언어로(2026-10-19)
  const topics = s.topics.map((t) => `${t.title}(${t.status === 'good' ? L('호평', 'well received') : t.status === 'bad' ? L('미지근', 'lukewarm') : L('다루지 않음', 'not covered')})`).join(', ');
  const text = L(`언론사 인터뷰(${s.outlet}): ${topics} — 국민 행복도 +${pct}%${cur.gov.applied ? ` · 칙령 「${cur.gov.applied}」 발표` : ''}`, `Press interview (${s.outlet}): ${topics} — public happiness +${pct}%${cur.gov.applied ? ` · edict "${cur.gov.applied}" announced` : ''}`);
  chronPut(RADIO_IDX, date, text, false, { name: '성간라디오 전용 연대기', world: true, uid: `press|${date}|${n}` });
  if (radio.on) radio.q.push({ kind: 'press', date, text: L(`${ctx.playerName || '플레이어 제국'}의 지도자가 ${s.outlet}과 인터뷰했다(호평 ${good}/${PRESS_TOPICS})${cur.gov.applied ? `. 이 자리에서 「${cur.gov.applied}」 칙령을 발표했다` : ''}`, `The leader of ${ctx.playerName || 'the player empire'} gave an interview to ${s.outlet} (well received ${good}/${PRESS_TOPICS})${cur.gov.applied ? `, announcing the edict "${cur.gov.applied}"` : ''}`), n, id: `press|${date}|${n}` });
  pushPress();
}
const guard = (event: Electron.IpcMainInvokeEvent) => !!press.win && event.sender === press.win.webContents;
const current = () => (press.sess && press.sess.sid === ctx.curSaveId ? press.sess : null);
const govLog = (s: PressSess) => s.log.filter((l) => l.topic === pressGovIndex(s) && l.who !== 'desk').map((l) => ({ who: l.who as 'reporter' | 'player', text: l.text }));
async function judge(cur: PressCur): Promise<PressSess> {
  const s = cur.sess, t = s.topics[s.current];
  if (!t || t.turns === 0) return pressCloseTopic(s);
  if (t.gov) return judgeGov(cur);
  let v: { positive: boolean; reason: string } | null = null;
  for (let i = 0; i < 2 && !v; i++) {
    try { v = parsePressVerdict(await ctx.ai.chat((() => { const m = pressVerdictMessages(ctx.playerName, s, situation()); if (cur.bribed) m.splice(1, 0, { role: 'system', content: BRIBED_DESK }); return m; })(), { purpose: 'press-verdict', json: true, maxTokens: 900 * (i + 1) })); }
    catch (e) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'press-verdict', attempt: i + 1, error: String(e) }); }
  }
  if (!v) throw new Error(L('편집국 평가를 읽지 못했습니다. 다시 눌러 주세요(주제는 그대로 남아 있습니다).', 'Could not read the editors\' verdict. Press again (the topic is kept).'));
  return pressCloseTopic(s, v);
}
/** 「정부 발표」 칸을 닫는다: 평가 + 칙령 분류(한 번에). 집무실 정책 발표면 그 정책에 반영, 칙령이면 확인 카드 대기. */
async function judgeGov(cur: PressCur): Promise<PressSess> {
  const s = cur.sess; let v: ReturnType<typeof parseGovVerdict> | null = null;
  for (let i = 0; i < 2 && !v; i++) {
    try { v = parseGovVerdict(await ctx.ai.chat(govVerdictMessages(ctx.playerName, s.outlet, govLog(s), situation(), cur.gov.policy?.title ?? ''), { purpose: 'press-gov-verdict', json: true, maxTokens: 900 * (i + 1) }), !!cur.gov.policy); }
    catch (e) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'press-gov-verdict', attempt: i + 1, error: String(e) }); }
  }
  if (!v) throw new Error(L('편집국 평가를 읽지 못했습니다. 다시 눌러 주세요(발표는 그대로 남아 있습니다).', 'Could not read the editorial verdict. Try again (your announcement is kept).'));
  if (v.edict === 'policy' && cur.gov.policy) { policyAnnounced(cur.gov.policy.id, v.positive); cur.gov.state = 'none'; }
  else if (v.edict && v.edict !== 'policy') { cur.gov.pick = { id: v.edict, title: v.title, strength: v.strength, positive: v.positive }; cur.gov.state = 'pending'; }
  return pressCloseTopic(s, { positive: v.positive, reason: v.reason });
}
/** 칙령 확정: 게임에 적용 → 기록·연대기 → 반대 가치관 제국 1~2곳 항의 서신. */
async function applyEdict(cur: PressCur, years: number): Promise<{ ok: boolean; error?: string }> {
  const p = cur.gov.pick; if (!p) return { ok: true };
  const pl = edictPlan(p, policyModsInUse()), add = planAdds(pl), st = edictStore().get(cur.sid), prev = activeEdict(cur.sid, ctx.gameDate);
  const cid = randomUUID().replace(/-/g, ''), req = ++link.reqCounter, days = years * 360, date = ctx.gameDate;
  press.edictFoes.set(req, []);
  let r;
  try { r = await terminalRequest(edictCommand(req, cur.sid, cid, add, prev ? prev.mods : [], days, pl.opinion, pl.def.foe), 'EDICTAPPLY', req); }
  catch (e) { press.edictFoes.delete(req); return { ok: false, error: (e as Error).message }; }
  const foes = press.edictFoes.get(req) ?? []; press.edictFoes.delete(req);
  if (r.kv.sid !== cur.sid || (r.kv.status !== 'applied' && r.kv.status !== 'duplicate')) return { ok: false, error: L('게임이 칙령 적용을 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm the edict. Check that the mod is up to date.') };
  const end = addDays(date, days);
  if (prev) st.history.push(prev); st.history.splice(0, Math.max(0, st.history.length - 30));
  st.active = { cid, id: p.id, title: p.title, strength: p.strength, positive: p.positive, years, date, end, mods: add, outlet: cur.sess.outlet, foes: foes.length };
  edictStore().save();
  cur.gov.state = 'applied'; cur.gov.applied = p.title;
  if (ctx.playerIdx > 0) chronNote(ctx.playerIdx, edictChronLine(date, cur.sess.outlet, p.title, pl.def, p.strength, years, p.positive));
  const pickFoes = [...new Set(foes)].sort(() => Math.random() - 0.5).slice(0, PROTEST_LETTERS);
  for (const idx of pickFoes) void writeLetter(idx, protestWhy(p.title, pl.def, p.strength)).catch(() => {});
  logDiagnostic('info', 'press.edict', { id: p.id, strength: p.strength, positive: p.positive, years, foes: foes.length });
  return { ok: true };
}

export function registerPress(router: LogRouter): void {
  router.on(SLOT.PRESS, 'press:phase', (m: SllmMessage) => {
    if (m.kind === 'PRESS') { if (m.kv.phase === 'prep') startPressPrep(ctx.gameDate); else if (m.kv.phase === 'applied') onApplied(m.kv.sid ?? '', m.kv.key ?? '', m.kv.n === undefined ? NaN : Number(m.kv.n)); }
    else if (m.kind === 'MONTH' && m.kv.date) onMonth(m.kv.date);
    else if (m.kind === 'EDICTX') { const l = press.edictFoes.get(Number(m.kv.req)), i = Number(m.kv.idx); if (l && Number.isSafeInteger(i) && i > 0) l.push(i); }
    else if (m.kind === 'EDICTAPPLY') terminalReplies.get('EDICTAPPLY:' + m.kv.req)?.(m);
    else if (m.kind === 'PRESSBRIBE') terminalReplies.get('PRESSBRIBE:' + m.kv.req)?.(m); // 기자 매수 확인(2026-10-20)
  });
  ipcMain.handle('pressState', async () => pressView());
  /** 긴급 기자회견 전에 기자 매수(에너지 크레딧 1000, 2026-10-20). 게임이 차감을 확인해야 매수된다. */
  ipcMain.handle('pressBribe', async (event) => {
    if (!guard(event)) return { ok: false, error: L('인터뷰 창에서만 할 수 있습니다.', 'Only from the interview window.') };
    const sc = scandalNow(); if (!sc || current()) return { ok: false, error: L('기자회견을 시작하기 전에만 매수할 수 있습니다.', 'You can only bribe before the press conference starts.') };
    if (sc.bribed) return { ok: true };
    if (!ctx.gameRunning || !ctx.curSaveId) return { ok: false, error: L('게임이 켜져 있어야 크레딧을 쓸 수 있습니다.', 'The game must be running to spend credits.') };
    if (press.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    press.busy = true; pushPress();
    try {
      const req = ++link.reqCounter, m = await terminalRequest(pressBribeCommand(req, ctx.curSaveId), 'PRESSBRIBE', req);
      if (m.kv.status === 'short') return { ok: false, error: L(`에너지 크레딧이 모자랍니다(${PRESS_BRIBE_COST} 필요).`, `Not enough energy credits (${PRESS_BRIBE_COST} needed).`) };
      if (m.kv.status !== 'applied' || m.kv.sid !== ctx.curSaveId) return { ok: false, error: L('게임이 크레딧 차감을 확인해 주지 않았습니다.', 'The game did not confirm the payment.') };
      if (press.scandal === sc) sc.bribed = true;
      logDiagnostic('info', 'press.bribe', { kind: sc.kind ?? 'scandal' });
      return { ok: true };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { press.busy = false; pushPress(); }
  });
  ipcMain.handle('pressClose', async (event) => { if (!guard(event)) return false; press.win?.close(); return true; });
  /** 인터뷰 시작: 기자가 연대기에서 주제 3개를 골라 온다. */
  ipcMain.handle('pressBegin', async (event) => {
    if (!guard(event)) return { ok: false, error: L('인터뷰 창에서만 시작할 수 있습니다.', 'Can only be started from the interview window.') };
    if (press.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    if (current()) return { ok: false, error: L('이미 인터뷰가 진행 중입니다.', 'An interview is already in progress.') };
    const sc = scandalNow();
    if (sc) { // 추문 긴급 기자회견: 준비 기간·AI 주제 고르기 없이 추문 한 주제
      const outlet = outletName(), reporter = gameName(Math.random() < 0.5 ? 'm' : 'f') ?? '';
      press.sess = { sid: sc.sid, scandal: true, kind: sc.kind ?? 'scandal', bribed: !!sc.bribed, gov: { policy: null, pick: null, state: 'none' }, sess: newScandalSess(outlet, reporter, sc.topic ?? {
        title: L('정부 추문 의혹', 'The government scandal'),
        question: L(`정부 관리들이 외국 정부를 모욕·기만했다는 문서가 돌고 있습니다. 정부는 위조라고 하지만, ${sc.suspect}의 첩보망이 퍼뜨렸다는 증거가 있습니까? 국민에게 어떻게 해명하시겠습니까?`, `Documents claim our officials insulted and deceived foreign governments. The government calls them forgeries — is there proof that ${sc.suspect}'s spy network planted them? How will you explain this to the public?`),
        source: L(`${sc.date} 추문 보도`, `${sc.date} scandal report`) }) };
      press.last = null; pushPress(); return { ok: true };
    }
    if (!pressReady() || !ctx.curSaveId) return { ok: false, error: L('아직 인터뷰 준비가 끝나지 않았습니다.', 'The interview is not ready yet.') };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 인터뷰할 수 있습니다.', 'The game must be running to give an interview.') };
    press.busy = true; pushPress(); const sid = ctx.curSaveId;
    try {
      const outlet = outletName(), reporter = gameName(Math.random() < 0.5 ? 'm' : 'f') ?? ''; let got: ReturnType<typeof parsePressTopics> | null = null; // 기자 이름: 게임 이름 표(우리 제국 종족 비율)
      for (let i = 0; i < 2 && !got; i++) {
        try { got = parsePressTopics(await ctx.ai.chat(pressTopicMessages(ctx.playerName, outlet, material(), situation(), reporter), { purpose: 'press-topics', json: true, maxTokens: 1400 * (i + 1) })); }
        catch (e) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'press-topics', attempt: i + 1, error: String(e) }); }
      }
      if (!got) return { ok: false, error: L('기자가 주제를 준비하지 못했습니다. 다시 시도해 주세요.', 'The reporter could not prepare topics. Please try again.') };
      if (sid !== ctx.curSaveId || !pressReady()) return { ok: false, error: L('세이브 또는 인터뷰 상태가 바뀌었습니다.', 'The save or interview state changed.') };
      // 「정부 발표」 칸(2026-10-18): 기자 주제 3개 옆에 하나 더, 인터뷰 한 번에 하나. 아직 발표하지 않은 집무실 정책이 있으면 질문에 넣는다.
      const pp = policyForPress();
      const gov = { title: L('정부 발표', 'Government announcement'), source: pp ? L(`집무실 정책 「${pp.title}」`, `Office policy "${pp.title}"`) : L('정부가 직접 발표', 'Announced by the government'),
        question: pp ? L(`정부 발표가 있다고 들었습니다. 집무실에서 선포하신 「${pp.title}」 정책을 설명하시겠습니까, 아니면 다른 발표가 있습니까?`, `We hear the government has an announcement. Will you explain the "${pp.title}" policy you declared, or is there something else?`)
          : L('오늘 정부 발표가 있다고 들었습니다. 무엇을 발표하시겠습니까?', 'We hear the government has an announcement today. What would you like to announce?') };
      press.sess = { sid, sess: newPressSess(outlet, reporter || got.reporter, got.topics, gov), gov: { policy: pp ? { id: pp.id, title: pp.title } : null, pick: null, state: 'none' } }; press.last = null;
      return { ok: true };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { press.busy = false; pushPress(); }
  });
  ipcMain.handle('pressPick', async (event, i: unknown) => {
    if (!guard(event)) return { ok: false, error: L('인터뷰 창에서만 고를 수 있습니다.', 'Can only be chosen from the interview window.') };
    const cur = current(); if (!cur) return { ok: false, error: L('진행 중인 인터뷰가 없습니다.', 'No interview is in progress.') };
    if (press.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    try { cur.sess = pressPick(cur.sess, Number(i)); pushPress(); return { ok: true }; } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('pressSay', async (event, text: unknown) => {
    if (!guard(event)) return { ok: false, error: L('인터뷰 창에서만 답할 수 있습니다.', 'Can only be answered from the interview window.') };
    if (typeof text !== 'string') return { ok: false, error: L('답변을 확인해 주세요.', 'Please check your answer.') };
    const bad = checkPressText(text); if (bad) return { ok: false, error: bad };
    if (press.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    const cur = current(); if (!cur || cur.sess.done) return { ok: false, error: L('진행 중인 인터뷰가 없습니다.', 'No interview is in progress.') };
    if (cur.sess.current < 0) return { ok: false, error: L('먼저 이야기할 주제를 고르세요.', 'Choose a topic to talk about first.') };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 인터뷰할 수 있습니다.', 'The game must be running to give an interview.') };
    press.busy = true; pushPress();
    try {
      const s = cur.sess, clean = text.replace(/\s+/g, ' ').trim();
      const gt = s.topics[s.current]?.gov;
      const reply = (await ctx.ai.chat(gt ? govReplyMessages(ctx.playerName, s.outlet, s.reporter, govLog(s), clean, situation(), cur.gov.policy?.title ?? '') : (() => { const m = pressReplyMessages(ctx.playerName, s, clean, situation()); if (cur.bribed) m.splice(1, 0, { role: 'system', content: BRIBED_REPORTER }); return m; })(), { purpose: gt ? 'press-gov-reply' : 'press-reply', maxTokens: 1200, conversationId: conversationOf(s) })).trim();
      if (!reply) return { ok: false, error: L('기자의 반응을 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read the reporter\'s reaction. Please try again.') };
      if (press.sess !== cur || cur.sess !== s) return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') };
      cur.sess = pressAnswer(s, clean, reply); return { ok: true };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { press.busy = false; pushPress(); }
  });
  /** 다음 주제로: 지금 주제를 평가하고 닫는다(긍정이면 +3%). */
  ipcMain.handle('pressNext', async (event) => {
    if (!guard(event)) return { ok: false, error: L('인터뷰 창에서만 넘길 수 있습니다.', 'Can only move on from the interview window.') };
    if (press.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    const cur = current(); if (!cur || cur.sess.done || cur.sess.current < 0) return { ok: false, error: L('진행 중인 주제가 없습니다.', 'No topic is in progress.') };
    press.busy = true; pushPress();
    try { const s = cur.sess, n = await judge(cur); if (press.sess !== cur || cur.sess !== s) return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') }; cur.sess = n; return { ok: true, allClosed: pressAllClosed(n) }; }
    catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { press.busy = false; pushPress(); }
  });
  /** 인터뷰 종료: 진행 중 주제를 평가하고, 호평 수를 합산해 행복도 버프(1년)를 건다. */
  ipcMain.handle('pressEnd', async (event, decision?: { edict?: unknown; years?: unknown }) => {
    if (!guard(event)) return { ok: false, error: L('인터뷰 창에서만 끝낼 수 있습니다.', 'Can only be ended from the interview window.') };
    if (press.busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
    const cur = current(); if (!cur) return { ok: false, error: L('진행 중인 인터뷰가 없습니다.', 'No interview is in progress.') };
    if (cur.scandal) { // 추문 기자회견: 평가만 하고 민심으로(게임 버프·칙령·준비 소모 없음)
      press.busy = true; pushPress();
      try {
        if (!cur.sess.done) { if (cur.sess.current >= 0) { const s = cur.sess, n = await judge(cur); if (press.sess !== cur || cur.sess !== s) return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') }; cur.sess = n; } cur.sess = pressFinish(cur.sess); }
        const good = cur.sess.topics.some((t) => t.status === 'good'), sc = press.scandal;
        press.last = { sid: cur.sid, outlet: cur.sess.outlet, topics: cur.sess.topics, good: good ? 1 : 0, percent: 0, date: ctx.gameDate, scandal: cur.kind ?? 'scandal' };
        press.sess = null; press.scandal = null;
        if (sc) sc.done(good);
        return { ok: true, good: good ? 1 : 0, percent: 0, scandal: true };
      } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
      finally { press.busy = false; pushPress(); }
    }
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 결과를 적용할 수 있습니다.', 'The game must be running to apply the results.') };
    press.busy = true; pushPress();
    try {
      if (!cur.sess.done) {
        if (cur.sess.current >= 0) { const s = cur.sess, n = await judge(cur); if (press.sess !== cur || cur.sess !== s) return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') }; cur.sess = n; }
        cur.sess = pressFinish(cur.sess); pushPress();
      }
      // 칙령 확인 카드(2026-10-18): 플레이어가 확정해야 게임에 들어간다.
      if (cur.gov.state === 'pending' && cur.gov.pick) {
        const want = decision?.edict;
        if (want !== 'apply' && want !== 'skip') return { ok: false, confirm: true };
        if (want === 'skip') cur.gov.state = 'skipped';
        else {
          const y = decision?.years === undefined ? 2 : Number(decision.years);
          if (!isEdictYears(y)) return { ok: false, error: L('칙령 기간은 1~3년 중에서 골라 주세요.', 'Pick an edict length of 1 to 3 years.') };
          const r = await applyEdict(cur, y); if (!r.ok) return { ok: false, error: r.error };
        }
        pushPress();
      }
      const good = pressGood(cur.sess), date = ctx.gameDate, n = ++link.reqCounter;
      if (good > 0) {
        const key = pressModifierKey(good)!, cmd = pressApplyEffect(good, n)!, expected = { sid: cur.sid, n, key };
        press.late = null;
        let acked = false, to: ReturnType<typeof setTimeout> | null = null, settle: (v: boolean) => void = () => {};
        const ack = new Promise<boolean>((resolve) => { settle = resolve; });
        press.ackWaiter = (sid, k, num) => { if (press.sess !== cur || ctx.curSaveId !== cur.sid || !pressAppliedMatches(expected, sid, k, num)) return; acked = true; if (to) clearTimeout(to); press.ackWaiter = null; settle(true); };
        try { await enqueue(() => sendConsole(cmd)); } catch (e) { press.ackWaiter = null; return { ok: false, error: L('게임에 명령을 보내지 못했습니다: ', 'Could not send the command to the game: ') + (e as Error).message }; }
        if (!acked) to = setTimeout(() => { if (press.ackWaiter) press.ackWaiter = null; settle(false); }, ACK_MS);
        if (!(await ack)) {
          // 늦게라도 PRESS phase=applied 가 오면 그때 마무리한다(자동 재전송은 하지 않는다).
          press.late = { ...expected, finish: () => { if (press.sess !== cur || ctx.curSaveId !== cur.sid) return; finishPress(cur, date, n); ctx.notify({ kind: 'press', title: L('언론사 인터뷰 마무리', 'Press interview concluded'), body: L(`게임이 늦게 버프 적용을 확인했습니다: 행복도 +${pressPercent(cur.sess)}%`, `The game confirmed the effect late: Happiness +${pressPercent(cur.sess)}%`) }); } };
          return { ok: false, error: L('게임이 아직 버프 적용을 확인해 주지 않았습니다. 늦게라도 확인되면 자동으로 마무리됩니다. 게임이 켜져 있는지, 모드가 최신인지 확인해 주세요.', 'The game has not confirmed the buffs yet. It will finish automatically if confirmed later. Check that the game is running and the mod is up to date.') };
        }
      }
      if (ctx.curSaveId !== cur.sid || press.sess !== cur) return { ok: false, error: L('세이브 또는 인터뷰가 바뀌어 결과를 확정하지 않았습니다.', 'The save or interview changed, so the results were not finalized.') };
      const pct = pressPercent(cur.sess); finishPress(cur, date, n);
      logDiagnostic('info', 'press.finished', { good, percent: pct });
      return { ok: true, good, percent: pct, days: PRESS_DAYS };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { press.busy = false; pushPress(); }
  });
}

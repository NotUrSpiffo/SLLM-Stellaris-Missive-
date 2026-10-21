// A-00b 5번: 언론(앱 쪽) — 은하 뉴스 저장소·새해 신문 만들기, 소문 만들기, 신문 창, 언론사 설정 IPC.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 서신·소문을 번갈아 돌리는 자동 작업 타이머(aiTick)는 main.ts에 남아 있다(서신과 함께 옮길 예정).
import { glassWin } from '../office';
import { crisisNewsWrap, crisisMarkIssue, crisisIsSpecial, setCrisisExtra, setCrisisSpecial } from './crisis-app';
import { pick } from './settings-ui';
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { IssueStore, Issue, collectFacts, newsMessages, parseIssue, paperLines, pickPaper, MIN_FACTS, EXTRA_KINDS, extraMessages, parseExtra } from '../galnews';
import { pickPair, pairKey, gossipMessages, parseGossip, Gossip, gossipDue, GOSSIP_MAX_TOKENS, NEWS_MAX_TOKENS } from '../gossip';
import { MEDIA_FAMILIES, sanitizeMedia, effectivePaper, mediaView, storeBrand, resetBrand, cleanFont } from '../media-custom';
import { isDefaultPersona } from '../media-prefs';
import { cmpDate, addYears } from '../mail';
import { RADIO_IDX } from '../chronicle';
import { settings, settingsPath } from '../app/settings';
import { radio, pushRadioState } from './radio-app';
import { ctx } from '../app/ctx';
import { BoundsStore, restoreRect } from '../window-bounds';
import { moodPromptNow } from './mood-app'; // 민심이 신문 논조에(2026-10-20 알파 10)

export const media = {
  paperWin: null as BrowserWindow | null,
  paperMode: 'paper' as 'paper' | 'office' | 'display', // display: 집무실 「크게 보기」로 따로 연 큰 디스플레이 지면(2026-10-18) // 2026-10-18: 오버레이 신문 아이콘 = 종이 지면만, 집무실 = 디스플레이 지면만(지면 바꾸기 단추 없음)
  /** 언론사 설정이 바뀔 때마다 올라간다(라디오 대화 기록을 버릴지 판단) */
  revision: 0,
  /** 최근 소문(최대 30) */
  gossips: [] as Gossip[],
};
let issueStore: IssueStore | null = null;
/** 창 크기·위치 기억(집무실·큰 신문 창, 2026-10-18). office-app 도 같이 쓴다. */
export const winBounds = new BoundsStore(() => path.join(app.getPath('userData'), 'sllm_window_bounds.json'), (error) => logDiagnostic('warn', 'storage.write_failed', { store: 'window_bounds', error }));
/** 새 호 표시(집무실 책상 신문, 2026-10-18): 세이브별로 신문을 연 순간의 호 수를 기억하고, 그보다 많으면 새 호. */
export const paperHooks = { changed: (): void => {} };
let seenData: Record<string, number> | null = null;
const seenFile = () => path.join(app.getPath('userData'), 'sllm_paper_seen.json');
function seenAll(): Record<string, number> { if (seenData) return seenData; try { const j = JSON.parse(fs.readFileSync(seenFile(), 'utf8')); seenData = j && typeof j === 'object' ? j : {}; } catch { seenData = {}; } return seenData!; }
const ownIssueCount = (sid: string): number => ctx.govMem().split(sid, issues().list(sid)).own.length;
export function paperUnseen(): boolean { const sid = ctx.curSaveId; if (!sid) return false; try { return ownIssueCount(sid) > (seenAll()[sid] ?? 0); } catch { return false; } }
export function markPaperSeen(): void {
  const sid = ctx.curSaveId; if (!sid) return;
  try { const n = ownIssueCount(sid); if (seenAll()[sid] === n) return; seenAll()[sid] = n; fs.writeFileSync(seenFile(), JSON.stringify(seenAll()), 'utf8'); } catch (e) { logDiagnostic('warn', 'storage.write_failed', { store: 'paper_seen', error: e }); }
  paperHooks.changed();
}
export function issues(): IssueStore { return (issueStore ??= new IssueStore(path.join(app.getPath('userData'), 'sllm_galnews.json'), (sid) => ctx.govMem().currentBranch(sid))); }

export function closePaper() { if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.close(); media.paperWin = null; }
/** 신문은 본 창과 따로, 게임 화면 대부분을 덮는 큰 창으로 연다. */
export function openPaper(glass = false, opt: { display?: boolean; unfold?: boolean } = {}) {
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1320, area.width), height: Math.min(1000, Math.round(area.height * 0.92)) };
  let x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  // glass: 집무실 화면에 붙는 디스플레이 지면. display: 집무실 「크게 보기」로 따로 연 큰 디스플레이 지면. 그 밖: 종이 지면(오버레이 아이콘·집무실 책상 신문)
  const mode = glass ? 'office' : opt.display ? 'display' : 'paper';
  markPaperSeen();
  if (media.paperWin && !media.paperWin.isDestroyed()) {
    if (media.paperMode === mode) { media.paperWin.show(); media.paperWin.focus(); media.paperWin.webContents.send('paperInit'); return; }
    media.paperWin.close(); // 다른 지면으로 열려 있으면 닫고 새로(집무실에 붙어 있던 신문이면 집무실은 바탕화면으로 돌아간다)
  }
  media.paperMode = mode;
  if (!glass) { // 큰 창은 지난번 높이·위치를 기억한다(폭은 지면 폭으로 고정)
    const saved = restoreRect(winBounds.get('paper'), screen.getAllDisplays().map((d) => d.workArea), { width: sz.width, height: 560 });
    if (saved) { x = saved.x; y = saved.y; sz.height = saved.height; }
  }
  const w = media.paperWin = new BrowserWindow({ ...sz, x, y, minWidth: sz.width, maxWidth: sz.width, minHeight: 560, maximizable: false, frame: false, show: false, backgroundColor: '#0a0d12', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  media.paperWin.setAlwaysOnTop(true, 'screen-saver', 1);
  media.paperWin.loadFile(path.join(__dirname, '..', '..', 'ui', 'paper.html'), { query: { mode, ...(opt.unfold ? { unfold: '1' } : {}) } });
  if (!glass) { const keep = () => (w.isDestroyed() ? null : w.getBounds()); w.on('move', () => winBounds.later('paper', keep)); w.on('resize', () => winBounds.later('paper', keep)); w.on('close', () => { const b = keep(); if (b) winBounds.set('paper', b); }); }
  media.paperWin.once('ready-to-show', () => { if (!w.isDestroyed()) w.show(); });
  media.paperWin.on('closed', () => { if (media.paperWin === w) media.paperWin = null; }); // 닫히는 옛 창이 새 창을 지우지 않게
}

export function announceMedia() {
  const state = mediaView(settings.mediaPrefs);
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('mediaChanged', state);
  pushRadioState();
}

/** 가장 최근 은하 뉴스(2년 안)를 프롬프트 줄로. 이 제국들도 읽은 것으로 친다. */
export function currentPaper(): string[] {
  if (!ctx.curSaveId) return [];
  const own = ctx.govMem().split(ctx.curSaveId, issues().list(ctx.curSaveId)).own; const last = own[own.length - 1];
  if (!last || (ctx.gameDate && cmpDate(last.date, addYears(ctx.gameDate, -2)) < 0)) return [];
  return paperLines(last);
}
/** 사실에 나온 제국들의 종족·성향 한 줄 요약(신문사의 논조 판단 재료). 아는 제국만. */
/** 신문 프롬프트 자료: 등장 제국 정보 + 우리 제국 민심 한 줄(2026-10-20). */
export function empireInfo(facts: Array<{ who: string; text: string }>): string[] { const mood = moodPromptNow(); return [...empireInfoOnly(facts), ...(mood ? ['- ' + mood] : [])]; }
function empireInfoOnly(facts: Array<{ who: string; text: string }>): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const c of ctx.mailCountries.values()) {
    if (seen.has(c.name) || !c.name || !c.profile) continue;
    if (!facts.some((f) => f.who === c.name || f.text.includes(c.name))) continue;
    seen.add(c.name); out.push(`- ${c.name}: species ${c.profile.species || 'unknown'}, personality ${c.profile.personality || 'unknown'}, ${c.profile.gov || ''}`.trim()); // 프롬프트 자료(영어, 2026-10-19)
  }
  return out.slice(0, 12);
}
/** 새해가 되면 지난 한 해의 연대기로 은하 뉴스 한 호를 낸다. 사실이 MIN_FACTS 건보다 적으면 내지 않는다. */
const publishing = new Set<string>(); // 같은 날짜 신호가 두 번 와도(재연결 때 로그 다시 읽기 등) 한 호만 만든다(2026-10-18)
export async function publishNews(date: string) {
  if (!ctx.curSaveId || !date || issues().has(ctx.curSaveId, date)) return;
  const sid = ctx.curSaveId, pk = sid + '|' + date;
  if (publishing.has(pk)) return;
  publishing.add(pk);
  try { await publishNewsNow(sid, date); } finally { publishing.delete(pk); }
}
async function publishNewsNow(sid: string, date: string) {
  const groups = ctx.chron().groups(sid, (all) => ctx.govMem().split(sid, all).own).filter((g) => g.idx !== RADIO_IDX).map((g) => ({ ...g, items: g.items.filter((e) => !e.text.startsWith('지도자 사망:') && !/(^|\s)NAME_[A-Za-z0-9_]+/.test(e.text)) })).filter((g) => g.items.length); // 라디오 전용 연대기는 신문 재료가 아니다. 알파5.1까지 제국 연대기에 들어간 일반 지도자 '사망' 줄(은퇴도 포함됨)은 뺀다
  const facts = collectFacts(groups, addYears(date, -1), 40, date);
  if (facts.length < MIN_FACTS) return;
  try {
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = pickPaper(lastIssue?.paper, Math.random, settings.papersOn);
    if (pi < 0) return; // 켜진 신문사가 없으면 신문을 내지 않는다
    const paper = effectivePaper(settings.mediaPrefs, pi);
    const raw = await ctx.ai.chat(newsMessages(ctx.playerName || 'the player empire', date, facts, paper, empireInfo(facts)), { purpose: 'newspaper', maxTokens: NEWS_MAX_TOKENS, json: true });
    const body = parseIssue(raw); if (!body) {logDiagnostic('warn','ai.response.invalid',{feature:'newspaper',chars:raw.length});return;}if(ctx.curSaveId!==sid){logDiagnostic('info','ai.response.discarded',{feature:'newspaper',reason:'save_changed'});return;}
    const it = issues().add(sid, date, body, pi);
    ctx.toUi('galnews', { ...it, paperInfo: paper });
    if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
    paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
    ctx.notify({ kind: 'news', title: effectivePaper(settings.mediaPrefs, pi).name, body: it.headline });
  } catch (e) { ctx.mailNote(pick('은하 뉴스 만들기 실패: ', 'Failed to make the Galactic News: ') + (e as Error).message); }
}
/** 호외 후보: 세이브마다 이번 달 가장 큰 사건 하나. 달이 지나면(다음 월 신호) 낸다. 앱을 껐다 켜면 사라진다. */
const pendingExtra = new Map<string, { date: string; kind: string; text: string; pri: number }>();
export function noteExtra(kind: string, date: string, text: string) {
  const sid = ctx.curSaveId; const pri = EXTRA_KINDS[kind];
  if (!sid || !date || !pri || !settings.extraOn) return;
  const cur = pendingExtra.get(sid);
  if (cur && cur.date.slice(0, 7) === date.slice(0, 7) && cur.pri >= pri) return;
  pendingExtra.set(sid, { date, kind, text, pri });
}
/** 달이 바뀌었을 때 지난 달의 큰 사건이 있고 그해 호외 상한 안이면 호외 한 장을 낸다. 사건이 없으면 AI 를 부르지 않는다. */
export async function publishExtra(nowDate: string) {
  const sid = ctx.curSaveId; const p = sid ? pendingExtra.get(sid) : undefined;
  if (!sid || !p || !nowDate || p.date.slice(0, 7) === nowDate.slice(0, 7)) return;
  pendingExtra.delete(sid);
  const specials = issues().list(sid).filter((i) => i.extra && i.date.slice(0, 4) === p.date.slice(0, 4) && crisisIsSpecial(i.id)).length; // 위기 특별판은 호외 연 상한에 넣지 않는다
  if (!settings.extraOn || issues().extraCount(sid, p.date.slice(0, 4)) - specials >= settings.extraMax) return;
  try {
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = pickPaper(lastIssue?.paper, Math.random, settings.papersOn);
    if (pi < 0) return;
    const paper = effectivePaper(settings.mediaPrefs, pi);
    const raw = await ctx.ai.chat(extraMessages(ctx.playerName || 'the player empire', nowDate, p.text, paper, empireInfo([{ who: '', text: p.text }])), { purpose: 'newspaper', maxTokens: 2000, json: true });
    const body = parseExtra(raw); if (!body) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'newspaper_extra', chars: raw.length }); return; }
    if (ctx.curSaveId !== sid) { logDiagnostic('info', 'ai.response.discarded', { feature: 'newspaper_extra', reason: 'save_changed' }); return; }
    const it = issues().add(sid, nowDate, body, pi, true);
    ctx.toUi('galnews', { ...it, paperInfo: paper });
    if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
    paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
    ctx.notify({ kind: 'news', title: pick('[호외] ', '[Extra] ') + paper.name, body: it.headline });
  } catch (e) { ctx.mailNote(pick('호외 만들기 실패: ', 'Failed to make the extra edition: ') + (e as Error).message); }
}
let gossipSeq = 0, lastPair = '', lastGossipKey = '';
export async function makeGossip() {
  const sid = ctx.curSaveId, date = ctx.gameDate;
  if (!gossipDue(lastGossipKey, sid, date)) { logDiagnostic('info', 'gossip.skip', { reason: 'same_game_date', date }); return; }
  const pr = pickPair([...ctx.mailCountries.values()], ctx.news, ctx.playerIdx, lastPair);
  if (!pr) return;
  lastGossipKey = sid + '|' + date; // 실패해도 같은 날짜에는 다시 부르지 않는다
  const [a, b] = pr; lastPair = pairKey(a, b);
  const raw = await ctx.ai.chat(gossipMessages(ctx.playerName || 'the player empire', date, a, b, ctx.news, currentPaper()), { purpose: 'gossip', maxTokens: GOSSIP_MAX_TOKENS, json: true });
  const lines = parseGossip(raw, a.name, b.name);
  if (!lines) {logDiagnostic('warn','ai.response.invalid',{feature:'gossip',chars:raw.length});return;}
  const g: Gossip = { id: ++gossipSeq, date: ctx.gameDate, a: a.name, b: b.name, lines };
  media.gossips.push(g); while (media.gossips.length > 30) media.gossips.shift();
  ctx.toUi('gossip', g);
  ctx.notify({ kind: 'info', title: pick('엿들은 소문', 'Overheard rumor'), body: pick(`${a.name}와(과) ${b.name}의 비공개 대화를 엿들었습니다.`, `Overheard a private conversation between ${a.name} and ${b.name}.`) });
}

export function registerMedia(): void {
  ipcMain.handle('mediaGet', async () => mediaView(settings.mediaPrefs));
  ipcMain.handle('mediaSave', async (_e, id: unknown, value: unknown) => {
    try {
      const index = MEDIA_FAMILIES.findIndex((f) => f.id === id);
      if (index < 0) throw new Error(pick('알 수 없는 언론사입니다.', 'Unknown media outlet.'));
      const v = value as { persona?: unknown; comments?: unknown; paperName?: unknown; radioName?: unknown; font?: unknown } | null;
      if (v !== null && (typeof v?.persona !== 'string' || !v.persona.trim() || v.persona.length > 4000 || typeof v.comments !== 'boolean')) throw new Error(pick('페르소나를 1~4000자로 입력하세요.', 'Enter a persona of 1–4000 characters.'));
      if (v !== null && [v.paperName, v.radioName].some((name) => typeof name !== 'string' || !name.trim() || name.trim().length > 40)) throw new Error(pick('신문사·방송사 이름을 각각 1~40자로 입력하세요.', 'Enter newspaper and station names of 1–40 characters each.'));
      const next = settings.mediaPrefs.slice();
      next[index] = v === null ? { ...sanitizeMedia(null)[index], paperName: next[index].paperName, radioName: next[index].radioName, font: next[index].font } : { paperName: (v.paperName as string).trim(), radioName: (v.radioName as string).trim(), persona: isDefaultPersona(index, v.persona as string) ? '' : (v.persona as string).trim(), comments: v.comments as boolean, font: v.font === undefined ? next[index].font : cleanFont(v.font) };
      fs.writeFileSync(settingsPath(), JSON.stringify({ ...settings, mediaPrefs: next }, null, 2), 'utf8');
      settings.mediaPrefs = next; media.revision++; radio.history.delete(MEDIA_FAMILIES[index].id); radio.history.delete(MEDIA_FAMILIES[index].id + ':daily'); announceMedia();
      return { ok: true, state: mediaView(settings.mediaPrefs) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('mediaBrand', async (_e, id: string, kind: string, reset: boolean) => {
    try {
      if (!MEDIA_FAMILIES.some((f) => f.id === id) || !['paper', 'radio'].includes(kind)) throw new Error(pick('알 수 없는 브랜드입니다.', 'Unknown brand.'));
      if (reset === true) resetBrand(id, kind);
      else {
        const owner = ctx.setWin && !ctx.setWin.isDestroyed() ? ctx.setWin : ctx.win!;
        const result = await dialog.showOpenDialog(owner, { title: pick('브랜드 그림 고르기 (8MB 이하)', 'Choose a brand image (8 MB or less)'), properties: ['openFile'], filters: [{ name: pick('그림', 'Images'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
        if (result.canceled || !result.filePaths[0]) return { ok: true, cancelled: true };
        storeBrand(id, kind, result.filePaths[0]);
      }
      announceMedia(); return { ok: true, state: mediaView(settings.mediaPrefs) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('newsList', async () => (ctx.curSaveId ? ctx.govMem().split(ctx.curSaveId, issues().list(ctx.curSaveId)).own.slice().reverse().map((i: Issue) => ({ ...i, paperInfo: effectivePaper(settings.mediaPrefs, i.paper ?? 0) })) : []));
  ipcMain.handle('gossipList', async () => media.gossips.slice());
  ipcMain.handle('paperOpen', async () => { openPaper(); return true; });
  ipcMain.handle('paperDesk', async () => { openPaper(false, { unfold: true }); return true; }); // 집무실 책상 위 신문: 종이 지면 큰 창 + 펼치는 효과(2026-10-18)
  ipcMain.handle('paperBig', async () => { openPaper(false, { display: true }); return true; }); // 집무실 신문 「크게 보기」: 디스플레이 지면 큰 창
  ipcMain.handle('paperClose', async () => { closePaper(); return true; });
}
/** 은하 위기 특별판(2026-10-17): 위기가 새로 나타난 달에 바로 한 장. 호외 모양 + 특별판 지면, 호외 연 상한과 별개. 정기호·일반 호외는 평소대로. */
export async function publishCrisisSpecial(date: string, fact: string, label: { ko: string; en: string }) {
  const sid = ctx.curSaveId; if (!sid || !date) return;
  try {
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = pickPaper(lastIssue?.paper, Math.random, settings.papersOn);
    if (pi < 0) return;
    const paper = effectivePaper(settings.mediaPrefs, pi);
    const raw = await ctx.ai.chat(crisisNewsWrap(extraMessages(ctx.playerName || 'the player empire', date, fact, paper, empireInfo([{ who: '', text: fact }]))), { purpose: 'newspaper', maxTokens: 2000, json: true });
    const body = parseExtra(raw); if (!body) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'newspaper_crisis', chars: raw.length }); return; }
    if (ctx.curSaveId !== sid) { logDiagnostic('info', 'ai.response.discarded', { feature: 'newspaper_crisis', reason: 'save_changed' }); return; }
    const it = issues().add(sid, date, body, pi, true); crisisMarkIssue(it.id, label);
    ctx.toUi('galnews', { ...it, paperInfo: paper });
    if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
    paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
    ctx.notify({ kind: 'news', title: pick('[위기 특별판]', '[Crisis special edition]') + ' ' + paper.name, body: it.headline });
  } catch (e) { ctx.mailNote(pick('위기 특별판 만들기 실패: ', 'Failed to make the crisis special edition: ') + (e as Error).message); }
}
setCrisisExtra(noteExtra); // 은하 위기가 끝날 때 일반 호외 예약 — 2026-10-17
setCrisisSpecial(publishCrisisSpecial); // 위기가 나타날 때 특별판 발행

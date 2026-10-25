import { startDiagnostics, logDiagnostic, diagnosticSpan, flushDiagnostics } from './diagnostics';
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { ModResources } from './mod-resources';
import { ModCompatibility } from './mod-compat';
import { FlagProvider } from './flags';
import { LoreStore, clipLore } from './lore';
import { SpeechPf } from './speech';
import { chronKey, chronLines, RADIO_IDX } from './chronicle';
import { buildBriefing, briefingPrompt } from './briefing';
import { LogWatcher } from './logWatcher';
import { initializeEnvironment, resolveEnvironment, environmentSaveRoots, setRuntimeUserDir, defaultConnectionMod } from './environment-paths';
import { Player2Client } from './player2';
import { AiRouter } from './aiclient';
import { warmUpInput } from './keyboard';
import { SllmMessage, reqSeenIn, modProtocolState, MOD_PROTOCOL, MOD_PROTOCOL_NOTICE } from './protocol';
import { Profile } from './prompt';
import { cleanSaveId } from './images';
import { settings, loadSettingsFile, activeCustom } from './app/settings';
import { safeSend } from './safe-send';
import { bindCtx } from './app/ctx';
import { chat, registerChat, resetConversation } from './features/chat';
import { terminal, terminalReplies, terminalView, terminalRequest, registerTerminal } from './features/terminal';
import { mail, registerMail, syncInbox, mailNote, restartAiTimer } from './features/mail-app';
import { registerCouncil } from './features/council';
import { speech, registerSpeech, startSpeechPrep } from './features/speech-app';
import { registerGameState, onGameSnapshot } from './features/gamestate-app';
import { noteGestaltSnapshot } from './features/gestalt-app';
import { initAddons, addonCompat, registerAddons } from './features/addons-app';
import { registerFaction, registerFactionLog, setCabinetPersona, setCabinetOfficeNotify, cabinetReady } from './features/faction-app';
import { gov, registerGov, govMem, openGov } from './features/gov';
import { registerGovReport } from './features/govreport';
import { media, registerMedia, currentPaper } from './features/media';
import { registerChronicle, chron, chronPut, flushChronPending, idxNames } from './features/chronicle-app';
import { registerSupport } from './features/support';
import { registerImages, imageState } from './features/images';
import { registerPortraitLib, autoPortraitUrl } from './features/portrait-lib-app';
import { registerEnvironment, environmentInfo } from './features/environment';
import { registerAiSettings, syncP2Ping } from './features/ai-settings';
import { radio, registerRadio, radioResetForSave } from './features/radio-app';
import { link, consoleLog, registerGameLink } from './app/game-link';
import { LogRouter, SLOT } from './app/log-router';
import { registerDevTools } from './features/dev-tools';
import { registerEspionage } from './features/espionage-app';
import { registerPress } from './features/press-app';
import { registerVassal } from './features/vassal-app';
import { registerFleet } from './features/fleet-app';
import { registerChronBook } from './features/chronbook-app';
import { registerTts } from './features/tts-app';
import { registerCrisis } from './features/crisis-app';
import { registerPrivateRooms } from './features/private-rooms-app';
import { registerOffice, setOfficeCabinet, pushOffice } from './features/office-app';
import { registerPeople } from './features/people-app';
import { registerPolicy, policyResetForSave } from './features/policy-app';
import { registerPersona, personaPeek, personaNote } from './features/persona-app';
import { registerLetters } from './features/letters-app';
import { registerMemorial } from './features/memorial-app';
import { registerSecretary } from './features/secretary-app';
import { registerOfficeStyle } from './features/office-style-app';
import { registerIndependence } from './features/independence-app';
import { registerPetitions } from './features/petition-app';
import { registerEmbassy } from './features/embassy-app';
import { registerMusic } from './features/music-app';
import { registerMood } from './features/mood-app';
import { registerDebate } from './features/debate-app';
import { registerScandal } from './features/scandal-app';
import { registerAgents } from './features/agents-app';
import { registerOfficialHolidays } from './features/official-holidays-app';
import { registerNationalEvents } from './features/national-events-app';
import { registerCeremony } from './features/ceremony-app';
import { registerDeclare } from './features/declare-app';
import { registerCondemn, resetCondemnSession } from './features/condemn-app';
import { registerEffectVerifier } from './features/effect-verifier';
import { registerConversationFavors } from './features/conversation-favors';
import { registerBanquet } from './features/banquet-app';
import { registerArchive } from './features/archive-app';
import { registerDinner } from './features/dinner-app';
import { registerMediation } from './features/mediation-app';
import { registerPeace } from './features/peace-app';
import { registerSummit, registerSummitLog } from './features/summit';
import { registerAlly, registerAllyLog } from './features/allied-council-app';
import { registerAppUpdate } from './features/app-update';
import { registerBackstory, backstories } from './features/backstory-app';
import { wins, registerWindows, quitAll, toUi, createWindow, createTray, startFade, registerHotkey, notify, needPaused, refreshTray, updateBadge, onMonthTick, setAppOpen, BASE_ICON, iconBaseHeight } from './features/windows';
import { registerSettingsUi, CLIENT_ID, uiText, aiLanguage, locFolder, pick } from './features/settings-ui';
import { setPicker } from './i18n-pick';
setPicker(pick); // 순수 로직 파일의 L(한, 영)도 화면 언어·언어 팩을 따르게(2026-10-19)
const router = new LogRouter();

// Tester preferences and histories are separate from the Workshop release.
app.setPath('userData', path.join(app.getPath('appData'), 'SLLM-Missive-Tester'));

// 배포 설정(release-config)·Game Client ID: src/features/settings-ui.ts 로 옮김(A-00b 7번)
let GAME_LOG =
  process.env.SLLM_GAME_LOG ?? path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Stellaris', 'logs', 'game.log');

let MOD_DIR =
  process.env.SLLM_MOD_DIR ?? defaultConnectionMod();
const p2 = new Player2Client(CLIENT_ID);
// 모든 기능은 ai.chat() 하나만 쓴다(Player2 또는 사용자의 개인 API). 자동 대체 연결은 없다.
const ai = new AiRouter(p2, () => activeCustom(), () => (settings.aiMode === 'custom' ? 'custom' : 'player2'), () => aiLanguage());
const watcher = new LogWatcher(GAME_LOG, 200, true); // 과거 줄은 요청 번호만 복구하고 기능은 새 줄에서만 실행한다(F-41)
const profiles = new Map<number, Profile>(); // 게임이 같은 줄을 중복으로 걸러 PROFILE 이 빠져도 마지막 값을 쓴다
// 총독 대화 상태(행성 목록·대화 기록): src/features/gov.ts 의 gov 객체(A-00b 5번)
const gameSignalCounts:Record<string,number>={};let lastGameSignal:unknown=null;
let curSaveId = ''; // 지금 불러온 세이브의 번호(모드가 기록). 세이브마다 초상화를 따로 두는 데 쓴다
// ---- 외교 대화(제안·호감·doChat·게임 안 키보드): src/features/chat.ts 로 옮김(A-00b 6번)
// 게임으로 명령 보내기(콘솔 큐·입력 표시·ACK): src/app/game-link.ts 로 옮김(A-00b 3번)

// ---- 설정: src/app/settings.ts 로 옮김(A-00b 2번)
// 사용자 그림(배경·초상화) 상태: src/features/images.ts 로 옮김(A-00b 4번)
// 조약 보류 서신 저장소(deferred): src/features/mail-app.ts 로 옮김(A-00b 6번)
// 은하 뉴스 저장소: src/features/media.ts 로 옮김(A-00b 5번)
// 연대기 저장소·기록 함수: src/features/chronicle-app.ts 로 옮김(A-00b 4번)
// 총독 기억 저장소·총독 답 원문 기록: src/features/gov.ts 로 옮김(A-00b 5번)
function syncPlayer2Activity(): void {
  if (settings.aiMode !== 'player2' || !wins.gameRunning || !(process.env.SLLM_CLIENT_ID || settings.player2ClientId || CLIENT_ID)) p2.stop();
  else p2.startHealthPing(e => toUi('status', uiText(e.message)));
}
// 화면 언어(selectedLanguage·uiText·languageView): src/features/settings-ui.ts 로 옮김(A-00b 7번)
function applyEnvironment(): void {
  const e = resolveEnvironment(settings);
  setRuntimeUserDir(e.userDir);
  GAME_LOG = e.log; MOD_DIR = e.mod || defaultConnectionMod();
  watcher.setPath(GAME_LOG); link.runtimeMod = null;
  flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: e.saveRoots });
}
function loadSettings() {
  loadSettingsFile();
  p2.configureClientId(process.env.SLLM_CLIENT_ID || settings.player2ClientId || CLIENT_ID);
  flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: environmentSaveRoots(settings.userDir) });
}

// ---- (실험) AI 가 먼저 보내는 편지
let playerName = '';
// 통신 단말기(연락처·단말기 명령 응답 대기·상대 연결): src/features/terminal.ts 로 옮김(A-00b 6번)
let playerIdx = 0; // 플레이어 제국의 모드 번호(IDX 줄의 rel=self)
let gameDate = '';
/** 게임 로그 줄 앞의 날짜("[2200.1.1]")를 "2200.01.01" 꼴로. 없으면 ''. */
function logLineDate(raw: string): string { const r = /\]:\s*\[(\d{4})\.(\d{1,2})\.(\d{1,2})\]/.exec(raw ?? ''); return r ? `${r[1]}.${r[2].padStart(2, '0')}.${r[3].padStart(2, '0')}` : ''; }
// ---- 서신(후보 수집·AI 편지·조약 보류 서신·서신함): src/features/mail-app.ts 로 옮김(A-00b 6번)


const flagProv = new FlagProvider();
const loreStore = new LoreStore();
const modResources = new ModResources(() => flagProv.game());
initAddons(modResources); // 애드온: 켠 모드의 sllm/addon + 앱 데이터 addons 폴더 (src/features/addons-app.ts)
const modCompatibility = new ModCompatibility(modResources, () => path.join(app.getPath('userData'),'compatibility'), locFolder, addonCompat);
flagProv.useResources(modResources);
function adoptedEthics(idx: number): { text: string; names: string[]; source: string } {
  const live=modCompatibility.liveFor(curSaveId,idx), saved=flagProv.ethicsFor(idx), ids=live?.ids ?? saved;
  if(!ids?.length)return {text:'',names:[],source:'unknown'};
  const rows=modCompatibility.describe(ids), source=live?'live '+live.date:'save '+flagProv.latestDate();
  return {text:source+'\n'+modCompatibility.text(ids),names:rows.map(e=>e.name),source};
}
function profileWithEthics(pr: Profile | undefined, idx: number): Profile | undefined { return pr ? {...pr,ethicsText:adoptedEthics(idx).text} : undefined; }
function speechWithEthics(pf: SpeechPf | null): SpeechPf | null { if(!pf)return null;const e=adoptedEthics(playerIdx);return e.text?{...pf,modEthics:e.text,modEthicsNames:e.names}:pf; }
function actionsAllowed(idx: number): boolean { const type=terminal.items.find(c=>c.idx===idx)?.type || flagProv.typeFor(idx); return type ? modCompatibility.policy(type).actions : true; }
async function refreshEthics(idx: number): Promise<void> {
  const req=++link.reqCounter, body=modCompatibility.queryBody(idx,req);if(!body||!wins.gameRunning||!curSaveId)return;
  try { await terminalRequest('effect every_playable_country = { limit = { is_ai = no } '+body+' }','ETHIC_END',req); }
  catch(e){ consoleLog('가치관 실시간 조회 실패: '+(e as Error).message); }
}
/** 사용자 글을 뺀 제국 전기(backstory-app 의 입력 칸에 미리 보여 줄 것). withLore 의 a 와 같은 순서. */
function autoLore(name: string, idx?: number): string {
  const ov = modCompatibility.empire(name)?.lore; if (ov) return ov;
  const bio = typeof idx === 'number' ? flagProv.bioFor(idx) : null; if (bio) return clipLore(modCompatibility.biography(bio));
  return (modCompatibility.lore(name) ?? loreStore.lookup(name, flagProv.game()))?.text ?? '';
}
/** 대화 상대와 플레이어 제국의 설명(전기)을 붙인다. 못 찾으면 그대로. */
function withLore<T extends { name: string; idx?: number; player?: string }>(t: T): T & { autoPortrait?: string; lore?: string; playerLore?: string; briefing?: string; chronicle?: string[]; galnews?: string[]; playerGest?: number } {
  try {
    const gd = flagProv.game();
    // 세이브에 든 전기(커스텀 제국, 다른 사람이 만든 것 포함)가 가장 정확하다. 없으면 설계 파일, 기본 제국 설명 순.
    const bioA = typeof t.idx === 'number' ? flagProv.bioFor(t.idx) : null;
    const overrideA=modCompatibility.empire(t.name)?.lore;
    const userA = backstories.empire(t.name), userB = t.player ? backstories.empire(t.player) : ''; // 사용자가 쓴 제국 전기가 가장 먼저(2026-10-18)
    const a = userA ? {text:userA} : overrideA ? {text:overrideA} : bioA ? { text: clipLore(modCompatibility.biography(bioA)) } : modCompatibility.lore(t.name) ?? loreStore.lookup(t.name, gd);
    const bioB = playerIdx > 0 ? flagProv.bioFor(playerIdx) : null;
    const b = userB ? {text:userB} : t.player && modCompatibility.empire(t.player)?.lore ? {text:modCompatibility.empire(t.player)!.lore} : bioB ? { text: clipLore(modCompatibility.biography(bioB)) } : t.player ? modCompatibility.lore(t.player) ?? loreStore.lookup(t.player, gd) : null;
    let briefing = '', chronicle: string[] = [];
    if (typeof t.idx === 'number' && t.idx > 0) {
      const br = buildBriefing({ ai: flagProv.statsFor(t.idx), player: playerIdx > 0 ? flagProv.statsFor(playerIdx) : null, aiName: t.name, playerName: t.player ?? '', date: flagProv.latestDate() });
      briefing = briefingPrompt(br);
      if (curSaveId) chronicle = chronLines(govMem().split(curSaveId, chron().list(chronKey(curSaveId, t.idx))).own.filter((e) => !e.world));
    }
    const paper = currentPaper();
    const pr = profileWithEthics((t as T & {profile?:Profile}).profile, t.idx || 0);
    return {
      ...t,
      readOnlyActions: typeof t.idx === 'number' && !actionsAllowed(t.idx),
      ...(typeof t.idx === 'number' && autoPortraitUrl(t.idx) ? { autoPortrait: autoPortraitUrl(t.idx) } : {}),
      ...(pr ? { profile: pr } : {}),
      ...(terminal.sid === curSaveId && terminal.playerGest ? { playerGest: terminal.playerGest } : {}),
      ...(typeof t.idx === 'number' && t.idx > 0 ? (() => { const ct = terminal.items.find((c) => c.idx === t.idx)?.type || flagProv.typeFor(t.idx!); const eth = modCompatibility.liveFor(curSaveId, t.idx!)?.ids ?? flagProv.ethicsFor(t.idx!); return { ...(ct ? { ctype: ct } : {}), ...(eth?.length ? { ethicIds: eth } : {}) }; })() : {}), // 몰락한 제국 말투(2026-10-19)
      ...(paper.length ? { galnews: paper } : {}),
      ...(a ? { lore: a.text } : {}),
      ...(b ? { playerLore: b.text } : {}),
      ...(briefing ? { briefing } : {}),
      ...(chronicle.length ? { chronicle } : {}),
    };
  } catch { return t; }
}
/** 대화 상대의 깃발 그림(세이브 + 게임 폴더 이미지). 읽지 못하면 null 이라 화면은 임시 그림을 쓴다. */
function flagUrlFor(idx: unknown): string | null {
  try { if(typeof idx!=='number'||idx<=0)return null;const name=terminal.items.find(c=>c.idx===idx)?.name||idxNames.get(idx)||'';return modCompatibility.flagOverride(name)||flagProv.urlFor(idx); } catch { return null; }
}
// ---- 창(메인·런처·말풍선·설정 창·알림 카드·트레이·투명도·게임 창 따라가기·게이트)과 toUi: src/features/windows.ts 로 옮김(A-00b 7번)

// ---- 은하 의회 창(별도 창). 지금은 개발자 모드에서 강제로 여는 시연판이다(가짜 의원·가짜 응답).
// 안건 상정 알림: 안건이 표결에 오르면 알림이 뜨지만, 회의는 플레이어가 '안건 회의 직접 참여하기'를 눌러야만 열린다. 넘기고 싶으면 그냥 두면 된다(게임 안에서 AI가 알아서 표결한다).
// ---- 은하 의회(안건 알림·회원 정보 수집·회의 창·토론·강제 결정): src/features/council.ts 로 옮김(A-00b 6번, A-16 연결)
// ---- 신문 창: src/features/media.ts 로 옮김(A-00b 5번)
// ---- 행성 총독 창: src/features/gov.ts 로 옮김(A-00b 5번)
// ---- 연설: src/features/speech-app.ts 로 옮김(A-00b 5번)

// ---- 성간 라디오: src/features/radio-app.ts 로 옮김(A-00b 4번)
// 언론사 설정 바뀜 알림: src/features/media.ts 로 옮김(A-00b 5번)
// 서신·소문 자동 작업 타이머(aiTick): src/features/mail-app.ts 로 옮김(A-00b 6번)
// 은하 뉴스·소문 만들기: src/features/media.ts 로 옮김(A-00b 5번)
process.on('uncaughtExceptionMonitor',(error,origin)=>{logDiagnostic('error','process.uncaught',{error,origin});flushDiagnostics();});
process.on('unhandledRejection',(error)=>{logDiagnostic('error','process.unhandled_rejection',{error});flushDiagnostics();});
app.on('before-quit',()=>{logDiagnostic('info','app.quit');flushDiagnostics();});
app.on('render-process-gone',(_e,contents,details)=>logDiagnostic('error','renderer.gone',{webContentsId:contents.id,...details}));
app.on('child-process-gone',(_e,details)=>logDiagnostic('error','child_process.gone',details));
app.on('web-contents-created',(_e,contents)=>{
  contents.on('preload-error',(_event,file,error)=>logDiagnostic('error','renderer.preload_error',{file,error}));
  contents.on('did-fail-load',(_event,code,description,url)=>logDiagnostic('error','renderer.load_failed',{code,description,url}));
  contents.on('console-message',(_event,level,message,line,source)=>{if(level>=2)logDiagnostic(level>=3?'error':'warn','renderer.console',{message,line,source});});
});
const handleIpc=ipcMain.handle.bind(ipcMain);
ipcMain.handle=((channel:string,listener:any)=>handleIpc(channel,async(event,...args)=>{
  const span=diagnosticSpan('ipc',{channel});
  try {
    const result = await listener(event, ...args);
    if (
      result &&
      typeof result === 'object' &&
      (result.ok === false || ['fail', 'timeout', 'error', 'unknown', 'pending'].includes(result.outcome || result.state))
    )
      logDiagnostic('warn', 'ipc.result', {
        id: span.id,
        channel,
        state: result.state || result.outcome,
        error: result.error || result.message,
      });
    span.end({ ok: result?.ok, state: result?.state || result?.outcome });
    return result;
  } catch (error) {
    span.fail(error);
    throw error;
  }
})) as typeof ipcMain.handle;
// A-00b: 기능 모듈이 쓰는 공유 상태 연결(src/app/ctx.ts)
bindCtx({
  curSaveId: { get: () => curSaveId, set: (v) => { curSaveId = v; } },
  gameDate: { get: () => gameDate, set: (v) => { gameDate = v; } },
  playerName: { get: () => playerName, set: (v) => { playerName = v; } },
  playerIdx: { get: () => playerIdx, set: (v) => { playerIdx = v; } },
  gameRunning: { get: () => wins.gameRunning, set: (v) => { wins.gameRunning = v; } },
  gameDip: { get: () => wins.gameDip },
  launcher: { get: () => wins.launcher },
  curScale: { get: () => wins.curScale },
  BASE_ICON: { get: () => BASE_ICON },
  iconBaseHeight: () => iconBaseHeight(),
  ai,
  p2,
  syncPlayer2Activity,
  govMem,
  chron,
  mediaRevision: { get: () => media.revision },
  flagProv,
  modCompatibility,
  terminal,
  terminalView,
  talk: { get: () => chat.talk, set: (v) => { if(chat.talk?.idx!==v?.idx)resetConversation(); chat.talk = v; } },
  withLore,
  adoptedEthics,
  flagUrlFor,
  pend: { get: () => chat.pend },
  pending: { get: () => chat.pending, set: (v) => { chat.pending = v; } },
  pendingSeq: { get: () => chat.pendingSeq, set: (v) => { chat.pendingSeq = v; } },
  history: { get: () => chat.history },
  mailReplyBusy: { get: () => mail.replyBusy },
  lastSay: { get: () => chat.lastSay, set: (v) => { chat.lastSay = v; } },
  applyEnvironment,
  MOD_DIR: { get: () => MOD_DIR },
  GAME_LOG: { get: () => GAME_LOG },
  gameFront: { get: () => wins.gameFront },
  gameSignalCounts,
  lastGameSignal: { get: () => lastGameSignal },
  watcher,
  profiles,
  mailCountries: mail.countries,
  news: { get: () => mail.news },
  notify,
  mailNote,
  setWin: { get: () => wins.setWin },
  needPaused,
  refreshTray,
  profileWithEthics,
  loreStore,
  updateBadge,
  onMonthTick,
  appOpen: { get: () => wins.appOpen },
  setAppOpen,
  actionsAllowed,
  speechWithEthics,
  refreshEthics,
  imageState,
  terminalRequest,
  win: { get: () => wins.win },
  toUi,
});
app.on('browser-window-created', (_e, win) => {
  // 테두리 없는 창의 드래그 영역이 있으면 윈도우는 입력 칸이 no-drag 가 아닐 때 글쇠를 삼킨다(클릭·캐럿은 된다).
  win.webContents.on('dom-ready', () => { void win.webContents.insertCSS('input,textarea,select,[contenteditable="true"]{-webkit-app-region:no-drag}').catch(() => {}); });
});
app.whenReady().then(() => {
  process.setSourceMapsEnabled?.(true);
  startDiagnostics(path.join(app.getPath('userData'),'logs'),()=>({version:app.getVersion(),sid:curSaveId,date:gameDate,gameRunning: wins.gameRunning,devMode:settings.devMode,aiMode:settings.aiMode}));
  if (process.platform === 'win32') warmUpInput(); // 선택한 전달 방식 준비
  restartAiTimer();
  initializeEnvironment(app.getPath('documents'));
  loadSettings();
  applyEnvironment();
  createWindow();
  createTray();
  startFade();
  { const err = registerHotkey(); if (err) setTimeout(() => toUi('status', err), 1500); }
  const noteSave = (sid: string) => {
    if (!sid || sid === curSaveId) return;
    // 다른 세이브로 바뀜: 제국 번호는 세이브마다 다시 매겨지므로 이전 세이브의 기억을 비운다
    logDiagnostic('info','game.save_changed',{previousSid:curSaveId,sid});
    link.epoch++; resetCondemnSession();
    const firstId = !curSaveId;
    terminal.reset(); toUi('contacts', terminalView());
    modCompatibility.clearLive(); flagProv.setExpectedSid(sid);
    curSaveId = sid;
    radioResetForSave(); policyResetForSave();
    mail.plan.set('', []);
    mail.roll = [];
    mail.news = [];
    syncInbox();
    if (firstId) {
      flushChronPending();
      if (speech.prepPending !== null) {
        const q = speech.prepPending;
        speech.prepPending = null;
        startSpeechPrep(q.date, q.pf);
      }
    }
    profiles.clear();
    mail.countries.clear();
    chat.history = []; chat.histories.clear();
    chat.talk = null;
    chat.pend = null; resetConversation();
    chat.pending = null;
    gov.planetList = null;
    gov.history = [];
    toUi('talk', null);
    toUi('planets', null);
    toUi('images', imageState());
  };
  watcher.on('diagnostic',(data)=>logDiagnostic(data.event.includes('failed')?'warn':'info',data.event,data));
  // 게임 로그 줄 분배: 원래 한 함수였던 처리를 같은 순서의 자리 번호로 나눴다(src/app/log-router.ts, A-00b 3번)
  router.on(SLOT.STATS, 'main:stats', (m: SllmMessage) => {
    if(Object.keys(gameSignalCounts).length<200||gameSignalCounts[m.kind]!==undefined)gameSignalCounts[m.kind]=(gameSignalCounts[m.kind]||0)+1;lastGameSignal={kind:m.kind,time:new Date().toISOString()};
    const metadata=Object.fromEntries(['req','last','idx','sid','n','date','phase','state','kind','ok','key','protocol','version','type','rel'].filter(k=>m.kv[k]!==undefined).map(k=>[k,m.kv[k]]));logDiagnostic('info','game.signal',{kind:m.kind,...metadata});
  });
  let protoWarnedEpoch = -1;
  router.on(SLOT.HELLO, 'main:hello', (m: SllmMessage) => {
    if (m.kind === 'HELLO') {
      const req = Number(m.kv.req);
      link.runtimeMod = { version: m.kv.version || '?', protocol: Number(m.kv.protocol) || 0, verified: req > 0 && terminalReplies.has('HELLO:' + req) };
      terminalReplies.get('HELLO:' + req)?.(m);
      toUi('environment', environmentInfo());
      const hp = Number(m.kv.protocol) || 0, ps = modProtocolState(hp); // 연결 규격이 다르면 연결 한 번당 한 번 알린다(알파 6)
      if (ps !== 'ok' && protoWarnedEpoch !== link.epoch) { protoWarnedEpoch = link.epoch; logDiagnostic('warn', 'mod.protocol_mismatch', { mod: hp, app: MOD_PROTOCOL, state: ps }); toUi('event', MOD_PROTOCOL_NOTICE[ps]); }
    }
  });
  router.on(SLOT.COMPAT_FEED, 'main:compat_feed', (m: SllmMessage) => {
    modCompatibility.feed(m,curSaveId);
  });
  router.on(SLOT.ETHIC_END, 'main:ethic_end', (m: SllmMessage) => {
    if (m.kind === 'ETHIC_END') { terminalReplies.get('ETHIC_END:'+m.kv.req)?.(m); if(chat.talk && chat.talk.idx===Number(m.kv.idx) && m.kv.sid===curSaveId) { chat.talk=withLore(chat.talk); toUi('talk',chat.talk); } }
  });
  router.on(SLOT.COMPAT_EVENT, 'main:compat_event', (m: SllmMessage) => {
    if (m.kind === 'COMPAT_EVENT') {
      const ev = modCompatibility.event(m, curSaveId);
      if (ev) {
        chronPut(RADIO_IDX, ev.date, ev.text, false, {
          name: '성간라디오 전용 연대기',
          world: true,
          uid: ev.kind + '|' + curSaveId + '|' + ev.n,
        });
        if (radio.on) {
          radio.q.push({ ...ev, id: ev.kind + '|' + curSaveId + '|' + ev.n });
          safeSend(radio.win, 'radioQueue', radio.q.size);
        }
      }
    }
  });
  router.on(SLOT.CONTACT_BEGIN, 'main:contact_begin', (m: SllmMessage) => {
    if (m.kind === 'CONTACT_BEGIN') noteSave(cleanSaveId(m.kv.sid));
  });
  // SLOT.TERMINAL: src/features/terminal.ts registerTerminal()
  router.on(SLOT.LINE_DATE, 'main:line_date', (m: SllmMessage) => {
    { const d = logLineDate(m.raw); if (d) gameDate = d; } // 로그 줄 앞의 게임 날짜. 새 게임을 시작하면 LOADED/MONTH 신호가 오기 전에도 날짜가 맞도록 매 줄에서 갱신한다
  });
  // SLOT.REQSEEN: src/app/game-link.ts registerGameLink()
  // SLOT.OPSHIFT: src/features/chat.ts registerChat()
  // SLOT.ACK: src/app/game-link.ts registerGameLink()
  // SLOT.RESOLUTION: src/features/council.ts registerCouncil()
  // SLOT.AGENDA: src/features/council.ts registerCouncil()
  router.on(SLOT.PLANETS, 'main:planets', (m: SllmMessage) => {
    { const pl = gov.collector.feed(m); if (pl) { if (pl.sid) noteSave(pl.sid); gov.planetList = pl; toUi('planets', pl); gov.waiters.splice(0).forEach((w) => w(pl)); } }
  });
  // SLOT.MAIL: src/features/mail-app.ts registerMail()
  // SLOT.KEYBOARD: src/features/chat.ts registerChat()
  registerSpeech(router); // SLOT.SPEECH_PF·SLOT.SPEECH + 연설 IPC 5개 (src/features/speech-app.ts)
  registerAddons(); // 애드온 IPC 4개 (src/features/addons-app.ts)
  registerGameState(router); // SLOT.GAMESTATE 월간 상황·출신·첩보 작전 (src/features/gamestate-app.ts)
  onGameSnapshot(noteGestaltSnapshot); // 단일 의식 제국 판정(언론사 인터뷰·내각 회의 막기, 인물 말투) — 2026-10-19
  registerFactionLog(router); registerFaction(); // SLOT.FACTION_MEET + 내각(장관) 회의 IPC (src/features/faction-app.ts, 2026-10-19 파벌 회의에서 바뀜)
  setCabinetPersona({ mem: personaPeek, note: personaNote }); // 장관들의 1:1 통신 말투·신뢰·기억(persona-app)
  setOfficeCabinet(cabinetReady); setCabinetOfficeNotify(pushOffice); // 집무실 책상 태블릿·「내각 회의가 준비되었습니다」 알람(2026-10-19)
  router.on(SLOT.GOVTALK, 'main:govtalk', (m: SllmMessage) => {
    if (m.kind === 'GOVTALK' && m.kv.name) openGov(m.kv.name.slice(0, 80));
  });
  // SLOT.END: src/features/chat.ts registerChat()
  // SLOT.RESKEY: src/features/council.ts registerCouncil()
  router.on(SLOT.LOADED, 'main:loaded', (m: SllmMessage) => {
    if (m.kind === 'LOADED') {
      link.epoch++; resetCondemnSession(); // Same-save reload also invalidates commands queued before loading.
      // 같은 세이브를 다시 불러와도(과거 자동 저장 포함) 이전 시점의 수락 대기 제안·쌓인 호감은 버린다(2026-10-18). 다른 세이브면 noteSave 가 비운다.
      if (chat.pending || chat.pend) { chat.pending = null; chat.pend = null; toUi('event', pick('세이브를 다시 불러와 수락 대기 중이던 제안을 취소했습니다.', 'The save was reloaded, so the pending proposal was cancelled.')); }
      const sid = cleanSaveId(m.kv.sid); noteSave(sid);
      if (m.kv.date) { gameDate = m.kv.date; if (sid && govMem().track(sid, m.kv.date)) toUi('event', pick('세이브를 과거로 불러와 총독 기억의 시간선이 갈라졌습니다.', 'An earlier save was loaded, so the governor memory timeline branched.')); }
    }
  });
  // SLOT.TALK: src/features/chat.ts registerChat()
  // SLOT.PROFILE: src/features/chat.ts registerChat()
  // SLOT.INBOX_SYNC: src/features/mail-app.ts registerMail()
  router.on(SLOT.TO_UI, 'main:to_ui', (m: SllmMessage) => {
    toUi('sllm', m);
  });
  registerGameLink(router);
  // F-41: replay never enters the feature router or marks the game ready.
  watcher.on('history', (m: SllmMessage) => {
    link.reqCounter = Math.max(link.reqCounter, reqSeenIn(m));
  });
  watcher.on('message', (m: SllmMessage) => router.dispatch(m));
  watcher.on('reset', () => {
    link.epoch++; resetCondemnSession(); link.runtimeMod = null; link.reqCounter = 0; link.sessionReady = false; link.lastModLineAt = 0; terminal.reset(); modCompatibility.clearLive(); flagProv.setExpectedSid(''); curSaveId = ''; chat.history = []; chat.histories.clear(); chat.talk = null; chat.pend = null; resetConversation(); chat.pending = null;
    profiles.clear(); mail.countries.clear(); idxNames.clear(); playerIdx = 0; playerName = ''; mail.plan.set('', []); mail.roll = []; mail.news = [];
    radioResetForSave();
    toUi('contacts', terminalView()); toUi('talk', null); syncInbox();
  }); // 게임을 다시 켜서 로그가 비워짐
  watcher.start();
  syncP2Ping();
  if (settings.aiMode !== 'custom') p2.login()
    .then(() => toUi('status', pick('Player2 로그인 완료', 'Player2 login complete')))
    .catch((e) => toUi('status', pick('Player2 로그인 실패: ', 'Player2 login failed: ') + e.message));

  // ---- AI 연결 설정: src/features/ai-settings.ts 로 옮김(A-00b 4번)
  registerAiSettings();

  registerTerminal(router); // contactsList·contactsRefresh·contactDial + 로그 자리 TERMINAL (src/features/terminal.ts)
  registerChat(router, noteSave); // chat·accept·finish·reject·forcePeace·apply + 로그 자리 OPSHIFT·KEYBOARD·END·TALK·PROFILE (src/features/chat.ts)

  // ---- 설정과 (실험) 편지
  // 모드 호환 팩 IPC 3개: src/features/environment.ts 로 옮김(A-00b 4번)
  // 버그 신고 묶음 IPC 4개: src/features/support.ts 로 옮김(A-00b 4번)
  registerSupport();
  registerBackstory(autoLore); // backstoryEmpire·backstoryEmpireSet·backstoryPerson·backstoryPersonSet 제국·인물 전기 입력 (src/features/backstory-app.ts) — 2026-10-18
  registerAppUpdate(); // 창작마당 모드로 받은 앱 업데이트 알림·교체 (src/features/app-update.ts) — 2026-10-18
  registerSettingsUi(); // getSettings·setPlayer2ClientId·setAiLanguage·setLanguage·setMailEnabled·getCustomCss·openCustomCss (src/features/settings-ui.ts)
  registerWindows(); // 창·런처·알림 카드·게이트·창 설정 IPC 17개 (src/features/windows.ts)
  // 사용자 그림 IPC 6개 + flagFor: src/features/images.ts 로 옮김(A-00b 4번)
  registerImages();
  registerPortraitLib();
  registerMedia(); // mediaGet·mediaSave·mediaBrand·newsList·gossipList·paperOpen·paperClose (src/features/media.ts)
  registerRadio(); // radioGet·radioSelect·radioOff·radioNow (src/features/radio-app.ts)
  // 연설 IPC 5개: src/features/speech-app.ts registerSpeech()
  registerCouncil(router); // 의회 IPC 6개 + 로그 자리 RESOLUTION·AGENDA·RESKEY (src/features/council.ts)
  registerGovReport(router); // A-26 총독 홀로그램 보고: govReportState·govReportSay·govReportRetry·govReportClose + SLOT.GOVREPORT (src/features/govreport.ts)
  registerGov(); // govRefresh·govReset·govMemList·govMemAdd·govMemDel·govChat·planetArt·govClose (src/features/gov.ts)
  registerChronicle(); // chronList (src/features/chronicle-app.ts)
  // ---- 경로(게임 사용자 폴더·모드 폴더·세이브·게임 설치) IPC 9개: src/features/environment.ts 로 옮김(A-00b 4번)
  registerEnvironment();
  registerMediation();
  registerSummit(); // 연방 정상회담(A-01 1단계, 시연판): summitState·summitAgenda·summitVote·summitSay·summitApply·summitClose (src/features/summit.ts)
  registerSummitLog(router); // A-01 2단계: SLOT.FEDERATION(FED·FEDMEMBER·FEDLAW·FEDEND) — 앱이 물었을 때만 모은다
  registerAlly(); // 동맹 평의회: 방어 협정·종속·종주 (src/features/allied-council-app.ts)
  registerAllyLog(router); // SLOT.ALLY(ALLY·ALLYTRAIT·ALLYEND) — 앱이 물었을 때만 모은다
  registerDevTools(router); // 개발자 모드 전용: 게임 없이 새 기능 화면 시험(src/features/dev-tools.ts)
  registerMail(router);
  registerDinner(router);
  registerEspionage(router); // + SLOT.SPY_APPLY 첩보 제재 게임 적용 응답
  registerPolicy(router); // + SLOT.POLICY 정책 퀘스트(집무실 정책 칸) — 2026-10-18
  registerPeople(router); // + SLOT.PEOPLE 내 지도자 명단(집무실 연락처) — 2026-10-18
  registerPersona(); // personaInfo·personaOpen·personaSay·personaEnd 집무실 인물 대화+기억 — 2026-10-18
  registerLetters(); // 개인 서신: 6개월마다 후보 중 무작위, 열 때 본문 — 2026-10-18
  registerSecretary(router); // + SLOT.SECRETARY 집무실 비서(업무 보고·지식·연애) — 2026-10-18
  registerMemorial(); // 작별·추모관: 사망 → 비석(명예의 전당), 해임·행방 불명 → 떠난 사람들 — 2026-10-18
  registerPrivateRooms(router);
  registerOffice(); // officeState·officeOpen·officeClose·officePlanets 집무실(홀로그램 바탕화면) — 2026-10-18
  registerOfficeStyle(); // officeStyle·officeStyleSet 집무실 종류(제국 가치관별 배경) — 2026-10-19
  registerIndependence(); // 반란·독립 → 부모 제국 기록·연대기 + 「독립 선언문」 서신 — 2026-10-19
  registerPetitions(router); // + SLOT.PETITION 시민 청원(집무실 바탕화면) — 2026-10-19
  registerEmbassy(router); // + SLOT.EMBASSY 대사관 보고서(집무실 바탕화면) — 2026-10-19
  registerMusic(); // 국가·군가(집무실 바탕화면, 앱 전용) — 2026-10-20 알파 10 앞당김
  registerMood(); // 민심(시민 지지도) 화면 자료 — 2026-10-20 알파 10
  registerDebate(); // 신문·라디오 찬반 논평 — 2026-10-20 알파 10
  registerScandal(); // 비방 공작 → 신문 추문·대응 — 2026-10-20 알파 9
  registerAgents(); // 첩보망 = 공작원 인물(이름·암호명·위장·연락 두절) — 2026-10-20 알파 9
  registerNationalEvents(router);
  registerOfficialHolidays(router);
  registerCeremony(router); // 출정 의식(복무신조 전체화면 낭독) — 2026-10-20
  registerCondemn(router); // + SLOT.CONDEMN 규탄 성명(WARVOICE → 판정·알림·호감) — 2026-10-20
  registerDeclare(router); // + SLOT.DECLARE 전쟁 선언문(전쟁 시작 알림 → 선언문 → 낭독 방송 → 출정 의식) — 2026-10-20
  registerCrisis(router); // + SLOT.CRISIS 은하 위기 특집 방송(신문 특별판·라디오 긴급 특별 방송) — 2026-10-17
  registerTts(); // ttsAiCheck·ttsAiSpeak 라디오 AI 음성(OpenAI /audio/speech) — 2026-10-17
  registerChronBook(); // chronBookExport 연대기 책 내보내기(HTML/PDF) — 2026-10-17
  registerFleet(router); // + SLOT.FLEET 함대 사령부(제독 전투 기록·청문회) — 2026-10-17
  registerVassal(router); // + SLOT.VASSAL 종속국 통신 채널(청원 결과 적용 응답·타이머 서신) — 2026-10-17
  registerPress(router); // + SLOT.PRESS 언론사 인터뷰(시행령 준비·월 신호·버프 확인) — 2026-10-17
  registerEffectVerifier(router);
  registerConversationFavors(router);
  registerArchive(router); // 대보관소 표본 읽기(알파 6 수집품 1단계)
  registerPeace(router); // SLOT.PEACE 평화 중재·강제 평화 게임 연결 (src/features/peace-app.ts)
  registerBanquet(); // inbox·openLetter + 로그 자리 MAIL·INBOX_SYNC (src/features/mail-app.ts). replyLetter 는 단말기와 함께 옮김
  // replyLetter: src/features/mail-app.ts registerMail()

  // accept·finish·reject·forcePeace·apply: src/features/chat.ts registerChat()
});

app.on('window-all-closed', () => quitAll());







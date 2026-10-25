"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("./diagnostics");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const mod_resources_1 = require("./mod-resources");
const mod_compat_1 = require("./mod-compat");
const flags_1 = require("./flags");
const lore_1 = require("./lore");
const chronicle_1 = require("./chronicle");
const briefing_1 = require("./briefing");
const logWatcher_1 = require("./logWatcher");
const environment_paths_1 = require("./environment-paths");
const player2_1 = require("./player2");
const aiclient_1 = require("./aiclient");
const keyboard_1 = require("./keyboard");
const protocol_1 = require("./protocol");
const images_1 = require("./images");
const settings_1 = require("./app/settings");
const safe_send_1 = require("./safe-send");
const ctx_1 = require("./app/ctx");
const chat_1 = require("./features/chat");
const terminal_1 = require("./features/terminal");
const mail_app_1 = require("./features/mail-app");
const council_1 = require("./features/council");
const speech_app_1 = require("./features/speech-app");
const gamestate_app_1 = require("./features/gamestate-app");
const gestalt_app_1 = require("./features/gestalt-app");
const addons_app_1 = require("./features/addons-app");
const faction_app_1 = require("./features/faction-app");
const gov_1 = require("./features/gov");
const govreport_1 = require("./features/govreport");
const media_1 = require("./features/media");
const chronicle_app_1 = require("./features/chronicle-app");
const support_1 = require("./features/support");
const images_2 = require("./features/images");
const portrait_lib_app_1 = require("./features/portrait-lib-app");
const environment_1 = require("./features/environment");
const ai_settings_1 = require("./features/ai-settings");
const radio_app_1 = require("./features/radio-app");
const game_link_1 = require("./app/game-link");
const log_router_1 = require("./app/log-router");
const dev_tools_1 = require("./features/dev-tools");
const espionage_app_1 = require("./features/espionage-app");
const press_app_1 = require("./features/press-app");
const vassal_app_1 = require("./features/vassal-app");
const fleet_app_1 = require("./features/fleet-app");
const chronbook_app_1 = require("./features/chronbook-app");
const tts_app_1 = require("./features/tts-app");
const crisis_app_1 = require("./features/crisis-app");
const private_rooms_app_1 = require("./features/private-rooms-app");
const office_app_1 = require("./features/office-app");
const people_app_1 = require("./features/people-app");
const policy_app_1 = require("./features/policy-app");
const persona_app_1 = require("./features/persona-app");
const letters_app_1 = require("./features/letters-app");
const memorial_app_1 = require("./features/memorial-app");
const secretary_app_1 = require("./features/secretary-app");
const office_style_app_1 = require("./features/office-style-app");
const independence_app_1 = require("./features/independence-app");
const petition_app_1 = require("./features/petition-app");
const embassy_app_1 = require("./features/embassy-app");
const music_app_1 = require("./features/music-app");
const mood_app_1 = require("./features/mood-app");
const debate_app_1 = require("./features/debate-app");
const scandal_app_1 = require("./features/scandal-app");
const agents_app_1 = require("./features/agents-app");
const official_holidays_app_1 = require("./features/official-holidays-app");
const national_events_app_1 = require("./features/national-events-app");
const ceremony_app_1 = require("./features/ceremony-app");
const declare_app_1 = require("./features/declare-app");
const condemn_app_1 = require("./features/condemn-app");
const effect_verifier_1 = require("./features/effect-verifier");
const conversation_favors_1 = require("./features/conversation-favors");
const banquet_app_1 = require("./features/banquet-app");
const archive_app_1 = require("./features/archive-app");
const dinner_app_1 = require("./features/dinner-app");
const mediation_app_1 = require("./features/mediation-app");
const peace_app_1 = require("./features/peace-app");
const summit_1 = require("./features/summit");
const allied_council_app_1 = require("./features/allied-council-app");
const app_update_1 = require("./features/app-update");
const backstory_app_1 = require("./features/backstory-app");
const windows_1 = require("./features/windows");
const settings_ui_1 = require("./features/settings-ui");
const i18n_pick_1 = require("./i18n-pick");
(0, i18n_pick_1.setPicker)(settings_ui_1.pick); // 순수 로직 파일의 L(한, 영)도 화면 언어·언어 팩을 따르게(2026-10-19)
const router = new log_router_1.LogRouter();
// Tester preferences and histories are separate from the Workshop release.
electron_1.app.setPath('userData', path.join(electron_1.app.getPath('appData'), 'SLLM-Missive-Tester'));
// 배포 설정(release-config)·Game Client ID: src/features/settings-ui.ts 로 옮김(A-00b 7번)
let GAME_LOG = process.env.SLLM_GAME_LOG ?? path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Stellaris', 'logs', 'game.log');
let MOD_DIR = process.env.SLLM_MOD_DIR ?? (0, environment_paths_1.defaultConnectionMod)();
const p2 = new player2_1.Player2Client(settings_ui_1.CLIENT_ID);
// 모든 기능은 ai.chat() 하나만 쓴다(Player2 또는 사용자의 개인 API). 자동 대체 연결은 없다.
const ai = new aiclient_1.AiRouter(p2, () => (0, settings_1.activeCustom)(), () => (settings_1.settings.aiMode === 'custom' ? 'custom' : 'player2'), () => (0, settings_ui_1.aiLanguage)());
const watcher = new logWatcher_1.LogWatcher(GAME_LOG, 200, true); // 과거 줄은 요청 번호만 복구하고 기능은 새 줄에서만 실행한다(F-41)
const profiles = new Map(); // 게임이 같은 줄을 중복으로 걸러 PROFILE 이 빠져도 마지막 값을 쓴다
// 총독 대화 상태(행성 목록·대화 기록): src/features/gov.ts 의 gov 객체(A-00b 5번)
const gameSignalCounts = {};
let lastGameSignal = null;
let curSaveId = ''; // 지금 불러온 세이브의 번호(모드가 기록). 세이브마다 초상화를 따로 두는 데 쓴다
// ---- 외교 대화(제안·호감·doChat·게임 안 키보드): src/features/chat.ts 로 옮김(A-00b 6번)
// 게임으로 명령 보내기(콘솔 큐·입력 표시·ACK): src/app/game-link.ts 로 옮김(A-00b 3번)
// ---- 설정: src/app/settings.ts 로 옮김(A-00b 2번)
// 사용자 그림(배경·초상화) 상태: src/features/images.ts 로 옮김(A-00b 4번)
// 조약 보류 서신 저장소(deferred): src/features/mail-app.ts 로 옮김(A-00b 6번)
// 은하 뉴스 저장소: src/features/media.ts 로 옮김(A-00b 5번)
// 연대기 저장소·기록 함수: src/features/chronicle-app.ts 로 옮김(A-00b 4번)
// 총독 기억 저장소·총독 답 원문 기록: src/features/gov.ts 로 옮김(A-00b 5번)
function syncPlayer2Activity() {
    if (settings_1.settings.aiMode !== 'player2' || !windows_1.wins.gameRunning || !(process.env.SLLM_CLIENT_ID || settings_1.settings.player2ClientId || settings_ui_1.CLIENT_ID))
        p2.stop();
    else
        p2.startHealthPing(e => (0, windows_1.toUi)('status', (0, settings_ui_1.uiText)(e.message)));
}
// 화면 언어(selectedLanguage·uiText·languageView): src/features/settings-ui.ts 로 옮김(A-00b 7번)
function applyEnvironment() {
    const e = (0, environment_paths_1.resolveEnvironment)(settings_1.settings);
    (0, environment_paths_1.setRuntimeUserDir)(e.userDir);
    GAME_LOG = e.log;
    MOD_DIR = e.mod || (0, environment_paths_1.defaultConnectionMod)();
    watcher.setPath(GAME_LOG);
    game_link_1.link.runtimeMod = null;
    flagProv.configure({ saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, roots: e.saveRoots });
}
function loadSettings() {
    (0, settings_1.loadSettingsFile)();
    p2.configureClientId(process.env.SLLM_CLIENT_ID || settings_1.settings.player2ClientId || settings_ui_1.CLIENT_ID);
    flagProv.configure({ saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, roots: (0, environment_paths_1.environmentSaveRoots)(settings_1.settings.userDir) });
}
// ---- (실험) AI 가 먼저 보내는 편지
let playerName = '';
// 통신 단말기(연락처·단말기 명령 응답 대기·상대 연결): src/features/terminal.ts 로 옮김(A-00b 6번)
let playerIdx = 0; // 플레이어 제국의 모드 번호(IDX 줄의 rel=self)
let gameDate = '';
/** 게임 로그 줄 앞의 날짜("[2200.1.1]")를 "2200.01.01" 꼴로. 없으면 ''. */
function logLineDate(raw) { const r = /\]:\s*\[(\d{4})\.(\d{1,2})\.(\d{1,2})\]/.exec(raw ?? ''); return r ? `${r[1]}.${r[2].padStart(2, '0')}.${r[3].padStart(2, '0')}` : ''; }
// ---- 서신(후보 수집·AI 편지·조약 보류 서신·서신함): src/features/mail-app.ts 로 옮김(A-00b 6번)
const flagProv = new flags_1.FlagProvider();
const loreStore = new lore_1.LoreStore();
const modResources = new mod_resources_1.ModResources(() => flagProv.game());
(0, addons_app_1.initAddons)(modResources); // 애드온: 켠 모드의 sllm/addon + 앱 데이터 addons 폴더 (src/features/addons-app.ts)
const modCompatibility = new mod_compat_1.ModCompatibility(modResources, () => path.join(electron_1.app.getPath('userData'), 'compatibility'), settings_ui_1.locFolder, addons_app_1.addonCompat);
flagProv.useResources(modResources);
function adoptedEthics(idx) {
    const live = modCompatibility.liveFor(curSaveId, idx), saved = flagProv.ethicsFor(idx), ids = live?.ids ?? saved;
    if (!ids?.length)
        return { text: '', names: [], source: 'unknown' };
    const rows = modCompatibility.describe(ids), source = live ? 'live ' + live.date : 'save ' + flagProv.latestDate();
    return { text: source + '\n' + modCompatibility.text(ids), names: rows.map(e => e.name), source };
}
function profileWithEthics(pr, idx) { return pr ? { ...pr, ethicsText: adoptedEthics(idx).text } : undefined; }
function speechWithEthics(pf) { if (!pf)
    return null; const e = adoptedEthics(playerIdx); return e.text ? { ...pf, modEthics: e.text, modEthicsNames: e.names } : pf; }
function actionsAllowed(idx) { const type = terminal_1.terminal.items.find(c => c.idx === idx)?.type || flagProv.typeFor(idx); return type ? modCompatibility.policy(type).actions : true; }
async function refreshEthics(idx) {
    const req = ++game_link_1.link.reqCounter, body = modCompatibility.queryBody(idx, req);
    if (!body || !windows_1.wins.gameRunning || !curSaveId)
        return;
    try {
        await (0, terminal_1.terminalRequest)('effect every_playable_country = { limit = { is_ai = no } ' + body + ' }', 'ETHIC_END', req);
    }
    catch (e) {
        (0, game_link_1.consoleLog)('가치관 실시간 조회 실패: ' + e.message);
    }
}
/** 사용자 글을 뺀 제국 전기(backstory-app 의 입력 칸에 미리 보여 줄 것). withLore 의 a 와 같은 순서. */
function autoLore(name, idx) {
    const ov = modCompatibility.empire(name)?.lore;
    if (ov)
        return ov;
    const bio = typeof idx === 'number' ? flagProv.bioFor(idx) : null;
    if (bio)
        return (0, lore_1.clipLore)(modCompatibility.biography(bio));
    return (modCompatibility.lore(name) ?? loreStore.lookup(name, flagProv.game()))?.text ?? '';
}
/** 대화 상대와 플레이어 제국의 설명(전기)을 붙인다. 못 찾으면 그대로. */
function withLore(t) {
    try {
        const gd = flagProv.game();
        // 세이브에 든 전기(커스텀 제국, 다른 사람이 만든 것 포함)가 가장 정확하다. 없으면 설계 파일, 기본 제국 설명 순.
        const bioA = typeof t.idx === 'number' ? flagProv.bioFor(t.idx) : null;
        const overrideA = modCompatibility.empire(t.name)?.lore;
        const userA = backstory_app_1.backstories.empire(t.name), userB = t.player ? backstory_app_1.backstories.empire(t.player) : ''; // 사용자가 쓴 제국 전기가 가장 먼저(2026-10-18)
        const a = userA ? { text: userA } : overrideA ? { text: overrideA } : bioA ? { text: (0, lore_1.clipLore)(modCompatibility.biography(bioA)) } : modCompatibility.lore(t.name) ?? loreStore.lookup(t.name, gd);
        const bioB = playerIdx > 0 ? flagProv.bioFor(playerIdx) : null;
        const b = userB ? { text: userB } : t.player && modCompatibility.empire(t.player)?.lore ? { text: modCompatibility.empire(t.player).lore } : bioB ? { text: (0, lore_1.clipLore)(modCompatibility.biography(bioB)) } : t.player ? modCompatibility.lore(t.player) ?? loreStore.lookup(t.player, gd) : null;
        let briefing = '', chronicle = [];
        if (typeof t.idx === 'number' && t.idx > 0) {
            const br = (0, briefing_1.buildBriefing)({ ai: flagProv.statsFor(t.idx), player: playerIdx > 0 ? flagProv.statsFor(playerIdx) : null, aiName: t.name, playerName: t.player ?? '', date: flagProv.latestDate() });
            briefing = (0, briefing_1.briefingPrompt)(br);
            if (curSaveId)
                chronicle = (0, chronicle_1.chronLines)((0, gov_1.govMem)().split(curSaveId, (0, chronicle_app_1.chron)().list((0, chronicle_1.chronKey)(curSaveId, t.idx))).own.filter((e) => !e.world));
        }
        const paper = (0, media_1.currentPaper)();
        const pr = profileWithEthics(t.profile, t.idx || 0);
        return {
            ...t,
            readOnlyActions: typeof t.idx === 'number' && !actionsAllowed(t.idx),
            ...(typeof t.idx === 'number' && (0, portrait_lib_app_1.autoPortraitUrl)(t.idx) ? { autoPortrait: (0, portrait_lib_app_1.autoPortraitUrl)(t.idx) } : {}),
            ...(pr ? { profile: pr } : {}),
            ...(terminal_1.terminal.sid === curSaveId && terminal_1.terminal.playerGest ? { playerGest: terminal_1.terminal.playerGest } : {}),
            ...(typeof t.idx === 'number' && t.idx > 0 ? (() => { const ct = terminal_1.terminal.items.find((c) => c.idx === t.idx)?.type || flagProv.typeFor(t.idx); const eth = modCompatibility.liveFor(curSaveId, t.idx)?.ids ?? flagProv.ethicsFor(t.idx); return { ...(ct ? { ctype: ct } : {}), ...(eth?.length ? { ethicIds: eth } : {}) }; })() : {}), // 몰락한 제국 말투(2026-10-19)
            ...(paper.length ? { galnews: paper } : {}),
            ...(a ? { lore: a.text } : {}),
            ...(b ? { playerLore: b.text } : {}),
            ...(briefing ? { briefing } : {}),
            ...(chronicle.length ? { chronicle } : {}),
        };
    }
    catch {
        return t;
    }
}
/** 대화 상대의 깃발 그림(세이브 + 게임 폴더 이미지). 읽지 못하면 null 이라 화면은 임시 그림을 쓴다. */
function flagUrlFor(idx) {
    try {
        if (typeof idx !== 'number' || idx <= 0)
            return null;
        const name = terminal_1.terminal.items.find(c => c.idx === idx)?.name || chronicle_app_1.idxNames.get(idx) || '';
        return modCompatibility.flagOverride(name) || flagProv.urlFor(idx);
    }
    catch {
        return null;
    }
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
process.on('uncaughtExceptionMonitor', (error, origin) => { (0, diagnostics_1.logDiagnostic)('error', 'process.uncaught', { error, origin }); (0, diagnostics_1.flushDiagnostics)(); });
process.on('unhandledRejection', (error) => { (0, diagnostics_1.logDiagnostic)('error', 'process.unhandled_rejection', { error }); (0, diagnostics_1.flushDiagnostics)(); });
electron_1.app.on('before-quit', () => { (0, diagnostics_1.logDiagnostic)('info', 'app.quit'); (0, diagnostics_1.flushDiagnostics)(); });
electron_1.app.on('render-process-gone', (_e, contents, details) => (0, diagnostics_1.logDiagnostic)('error', 'renderer.gone', { webContentsId: contents.id, ...details }));
electron_1.app.on('child-process-gone', (_e, details) => (0, diagnostics_1.logDiagnostic)('error', 'child_process.gone', details));
electron_1.app.on('web-contents-created', (_e, contents) => {
    contents.on('preload-error', (_event, file, error) => (0, diagnostics_1.logDiagnostic)('error', 'renderer.preload_error', { file, error }));
    contents.on('did-fail-load', (_event, code, description, url) => (0, diagnostics_1.logDiagnostic)('error', 'renderer.load_failed', { code, description, url }));
    contents.on('console-message', (_event, level, message, line, source) => { if (level >= 2)
        (0, diagnostics_1.logDiagnostic)(level >= 3 ? 'error' : 'warn', 'renderer.console', { message, line, source }); });
});
const handleIpc = electron_1.ipcMain.handle.bind(electron_1.ipcMain);
electron_1.ipcMain.handle = ((channel, listener) => handleIpc(channel, async (event, ...args) => {
    const span = (0, diagnostics_1.diagnosticSpan)('ipc', { channel });
    try {
        const result = await listener(event, ...args);
        if (result &&
            typeof result === 'object' &&
            (result.ok === false || ['fail', 'timeout', 'error', 'unknown', 'pending'].includes(result.outcome || result.state)))
            (0, diagnostics_1.logDiagnostic)('warn', 'ipc.result', {
                id: span.id,
                channel,
                state: result.state || result.outcome,
                error: result.error || result.message,
            });
        span.end({ ok: result?.ok, state: result?.state || result?.outcome });
        return result;
    }
    catch (error) {
        span.fail(error);
        throw error;
    }
}));
// A-00b: 기능 모듈이 쓰는 공유 상태 연결(src/app/ctx.ts)
(0, ctx_1.bindCtx)({
    curSaveId: { get: () => curSaveId, set: (v) => { curSaveId = v; } },
    gameDate: { get: () => gameDate, set: (v) => { gameDate = v; } },
    playerName: { get: () => playerName, set: (v) => { playerName = v; } },
    playerIdx: { get: () => playerIdx, set: (v) => { playerIdx = v; } },
    gameRunning: { get: () => windows_1.wins.gameRunning, set: (v) => { windows_1.wins.gameRunning = v; } },
    gameDip: { get: () => windows_1.wins.gameDip },
    launcher: { get: () => windows_1.wins.launcher },
    curScale: { get: () => windows_1.wins.curScale },
    BASE_ICON: { get: () => windows_1.BASE_ICON },
    iconBaseHeight: () => (0, windows_1.iconBaseHeight)(),
    ai,
    p2,
    syncPlayer2Activity,
    govMem: gov_1.govMem,
    chron: chronicle_app_1.chron,
    mediaRevision: { get: () => media_1.media.revision },
    flagProv,
    modCompatibility,
    terminal: terminal_1.terminal,
    terminalView: terminal_1.terminalView,
    talk: { get: () => chat_1.chat.talk, set: (v) => { if (chat_1.chat.talk?.idx !== v?.idx)
            (0, chat_1.resetConversation)(); chat_1.chat.talk = v; } },
    withLore,
    adoptedEthics,
    flagUrlFor,
    pend: { get: () => chat_1.chat.pend },
    pending: { get: () => chat_1.chat.pending, set: (v) => { chat_1.chat.pending = v; } },
    pendingSeq: { get: () => chat_1.chat.pendingSeq, set: (v) => { chat_1.chat.pendingSeq = v; } },
    history: { get: () => chat_1.chat.history },
    mailReplyBusy: { get: () => mail_app_1.mail.replyBusy },
    lastSay: { get: () => chat_1.chat.lastSay, set: (v) => { chat_1.chat.lastSay = v; } },
    applyEnvironment,
    MOD_DIR: { get: () => MOD_DIR },
    GAME_LOG: { get: () => GAME_LOG },
    gameFront: { get: () => windows_1.wins.gameFront },
    gameSignalCounts,
    lastGameSignal: { get: () => lastGameSignal },
    watcher,
    profiles,
    mailCountries: mail_app_1.mail.countries,
    news: { get: () => mail_app_1.mail.news },
    notify: windows_1.notify,
    mailNote: mail_app_1.mailNote,
    setWin: { get: () => windows_1.wins.setWin },
    needPaused: windows_1.needPaused,
    refreshTray: windows_1.refreshTray,
    profileWithEthics,
    loreStore,
    updateBadge: windows_1.updateBadge,
    onMonthTick: windows_1.onMonthTick,
    appOpen: { get: () => windows_1.wins.appOpen },
    setAppOpen: windows_1.setAppOpen,
    actionsAllowed,
    speechWithEthics,
    refreshEthics,
    imageState: images_2.imageState,
    terminalRequest: terminal_1.terminalRequest,
    win: { get: () => windows_1.wins.win },
    toUi: windows_1.toUi,
});
electron_1.app.on('browser-window-created', (_e, win) => {
    // 테두리 없는 창의 드래그 영역이 있으면 윈도우는 입력 칸이 no-drag 가 아닐 때 글쇠를 삼킨다(클릭·캐럿은 된다).
    win.webContents.on('dom-ready', () => { void win.webContents.insertCSS('input,textarea,select,[contenteditable="true"]{-webkit-app-region:no-drag}').catch(() => { }); });
});
electron_1.app.whenReady().then(() => {
    process.setSourceMapsEnabled?.(true);
    (0, diagnostics_1.startDiagnostics)(path.join(electron_1.app.getPath('userData'), 'logs'), () => ({ version: electron_1.app.getVersion(), sid: curSaveId, date: gameDate, gameRunning: windows_1.wins.gameRunning, devMode: settings_1.settings.devMode, aiMode: settings_1.settings.aiMode }));
    if (process.platform === 'win32')
        (0, keyboard_1.warmUpInput)(); // 선택한 전달 방식 준비
    (0, mail_app_1.restartAiTimer)();
    (0, environment_paths_1.initializeEnvironment)(electron_1.app.getPath('documents'));
    loadSettings();
    applyEnvironment();
    (0, windows_1.createWindow)();
    (0, windows_1.createTray)();
    (0, windows_1.startFade)();
    {
        const err = (0, windows_1.registerHotkey)();
        if (err)
            setTimeout(() => (0, windows_1.toUi)('status', err), 1500);
    }
    const noteSave = (sid) => {
        if (!sid || sid === curSaveId)
            return;
        // 다른 세이브로 바뀜: 제국 번호는 세이브마다 다시 매겨지므로 이전 세이브의 기억을 비운다
        (0, diagnostics_1.logDiagnostic)('info', 'game.save_changed', { previousSid: curSaveId, sid });
        game_link_1.link.epoch++;
        (0, condemn_app_1.resetCondemnSession)();
        const firstId = !curSaveId;
        terminal_1.terminal.reset();
        (0, windows_1.toUi)('contacts', (0, terminal_1.terminalView)());
        modCompatibility.clearLive();
        flagProv.setExpectedSid(sid);
        curSaveId = sid;
        (0, radio_app_1.radioResetForSave)();
        (0, policy_app_1.policyResetForSave)();
        mail_app_1.mail.plan.set('', []);
        mail_app_1.mail.roll = [];
        mail_app_1.mail.news = [];
        (0, mail_app_1.syncInbox)();
        if (firstId) {
            (0, chronicle_app_1.flushChronPending)();
            if (speech_app_1.speech.prepPending !== null) {
                const q = speech_app_1.speech.prepPending;
                speech_app_1.speech.prepPending = null;
                (0, speech_app_1.startSpeechPrep)(q.date, q.pf);
            }
        }
        profiles.clear();
        mail_app_1.mail.countries.clear();
        chat_1.chat.history = [];
        chat_1.chat.histories.clear();
        chat_1.chat.talk = null;
        chat_1.chat.pend = null;
        (0, chat_1.resetConversation)();
        chat_1.chat.pending = null;
        gov_1.gov.planetList = null;
        gov_1.gov.history = [];
        (0, windows_1.toUi)('talk', null);
        (0, windows_1.toUi)('planets', null);
        (0, windows_1.toUi)('images', (0, images_2.imageState)());
    };
    watcher.on('diagnostic', (data) => (0, diagnostics_1.logDiagnostic)(data.event.includes('failed') ? 'warn' : 'info', data.event, data));
    // 게임 로그 줄 분배: 원래 한 함수였던 처리를 같은 순서의 자리 번호로 나눴다(src/app/log-router.ts, A-00b 3번)
    router.on(log_router_1.SLOT.STATS, 'main:stats', (m) => {
        if (Object.keys(gameSignalCounts).length < 200 || gameSignalCounts[m.kind] !== undefined)
            gameSignalCounts[m.kind] = (gameSignalCounts[m.kind] || 0) + 1;
        lastGameSignal = { kind: m.kind, time: new Date().toISOString() };
        const metadata = Object.fromEntries(['req', 'last', 'idx', 'sid', 'n', 'date', 'phase', 'state', 'kind', 'ok', 'key', 'protocol', 'version', 'type', 'rel'].filter(k => m.kv[k] !== undefined).map(k => [k, m.kv[k]]));
        (0, diagnostics_1.logDiagnostic)('info', 'game.signal', { kind: m.kind, ...metadata });
    });
    let protoWarnedEpoch = -1;
    router.on(log_router_1.SLOT.HELLO, 'main:hello', (m) => {
        if (m.kind === 'HELLO') {
            const req = Number(m.kv.req);
            game_link_1.link.runtimeMod = { version: m.kv.version || '?', protocol: Number(m.kv.protocol) || 0, verified: req > 0 && terminal_1.terminalReplies.has('HELLO:' + req) };
            terminal_1.terminalReplies.get('HELLO:' + req)?.(m);
            (0, windows_1.toUi)('environment', (0, environment_1.environmentInfo)());
            const hp = Number(m.kv.protocol) || 0, ps = (0, protocol_1.modProtocolState)(hp); // 연결 규격이 다르면 연결 한 번당 한 번 알린다(알파 6)
            if (ps !== 'ok' && protoWarnedEpoch !== game_link_1.link.epoch) {
                protoWarnedEpoch = game_link_1.link.epoch;
                (0, diagnostics_1.logDiagnostic)('warn', 'mod.protocol_mismatch', { mod: hp, app: protocol_1.MOD_PROTOCOL, state: ps });
                (0, windows_1.toUi)('event', protocol_1.MOD_PROTOCOL_NOTICE[ps]);
            }
        }
    });
    router.on(log_router_1.SLOT.COMPAT_FEED, 'main:compat_feed', (m) => {
        modCompatibility.feed(m, curSaveId);
    });
    router.on(log_router_1.SLOT.ETHIC_END, 'main:ethic_end', (m) => {
        if (m.kind === 'ETHIC_END') {
            terminal_1.terminalReplies.get('ETHIC_END:' + m.kv.req)?.(m);
            if (chat_1.chat.talk && chat_1.chat.talk.idx === Number(m.kv.idx) && m.kv.sid === curSaveId) {
                chat_1.chat.talk = withLore(chat_1.chat.talk);
                (0, windows_1.toUi)('talk', chat_1.chat.talk);
            }
        }
    });
    router.on(log_router_1.SLOT.COMPAT_EVENT, 'main:compat_event', (m) => {
        if (m.kind === 'COMPAT_EVENT') {
            const ev = modCompatibility.event(m, curSaveId);
            if (ev) {
                (0, chronicle_app_1.chronPut)(chronicle_1.RADIO_IDX, ev.date, ev.text, false, {
                    name: '성간라디오 전용 연대기',
                    world: true,
                    uid: ev.kind + '|' + curSaveId + '|' + ev.n,
                });
                if (radio_app_1.radio.on) {
                    radio_app_1.radio.q.push({ ...ev, id: ev.kind + '|' + curSaveId + '|' + ev.n });
                    (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioQueue', radio_app_1.radio.q.size);
                }
            }
        }
    });
    router.on(log_router_1.SLOT.CONTACT_BEGIN, 'main:contact_begin', (m) => {
        if (m.kind === 'CONTACT_BEGIN')
            noteSave((0, images_1.cleanSaveId)(m.kv.sid));
    });
    // SLOT.TERMINAL: src/features/terminal.ts registerTerminal()
    router.on(log_router_1.SLOT.LINE_DATE, 'main:line_date', (m) => {
        {
            const d = logLineDate(m.raw);
            if (d)
                gameDate = d;
        } // 로그 줄 앞의 게임 날짜. 새 게임을 시작하면 LOADED/MONTH 신호가 오기 전에도 날짜가 맞도록 매 줄에서 갱신한다
    });
    // SLOT.REQSEEN: src/app/game-link.ts registerGameLink()
    // SLOT.OPSHIFT: src/features/chat.ts registerChat()
    // SLOT.ACK: src/app/game-link.ts registerGameLink()
    // SLOT.RESOLUTION: src/features/council.ts registerCouncil()
    // SLOT.AGENDA: src/features/council.ts registerCouncil()
    router.on(log_router_1.SLOT.PLANETS, 'main:planets', (m) => {
        {
            const pl = gov_1.gov.collector.feed(m);
            if (pl) {
                if (pl.sid)
                    noteSave(pl.sid);
                gov_1.gov.planetList = pl;
                (0, windows_1.toUi)('planets', pl);
                gov_1.gov.waiters.splice(0).forEach((w) => w(pl));
            }
        }
    });
    // SLOT.MAIL: src/features/mail-app.ts registerMail()
    // SLOT.KEYBOARD: src/features/chat.ts registerChat()
    (0, speech_app_1.registerSpeech)(router); // SLOT.SPEECH_PF·SLOT.SPEECH + 연설 IPC 5개 (src/features/speech-app.ts)
    (0, addons_app_1.registerAddons)(); // 애드온 IPC 4개 (src/features/addons-app.ts)
    (0, gamestate_app_1.registerGameState)(router); // SLOT.GAMESTATE 월간 상황·출신·첩보 작전 (src/features/gamestate-app.ts)
    (0, gamestate_app_1.onGameSnapshot)(gestalt_app_1.noteGestaltSnapshot); // 단일 의식 제국 판정(언론사 인터뷰·내각 회의 막기, 인물 말투) — 2026-10-19
    (0, faction_app_1.registerFactionLog)(router);
    (0, faction_app_1.registerFaction)(); // SLOT.FACTION_MEET + 내각(장관) 회의 IPC (src/features/faction-app.ts, 2026-10-19 파벌 회의에서 바뀜)
    (0, faction_app_1.setCabinetPersona)({ mem: persona_app_1.personaPeek, note: persona_app_1.personaNote }); // 장관들의 1:1 통신 말투·신뢰·기억(persona-app)
    (0, office_app_1.setOfficeCabinet)(faction_app_1.cabinetReady);
    (0, faction_app_1.setCabinetOfficeNotify)(office_app_1.pushOffice); // 집무실 책상 태블릿·「내각 회의가 준비되었습니다」 알람(2026-10-19)
    router.on(log_router_1.SLOT.GOVTALK, 'main:govtalk', (m) => {
        if (m.kind === 'GOVTALK' && m.kv.name)
            (0, gov_1.openGov)(m.kv.name.slice(0, 80));
    });
    // SLOT.END: src/features/chat.ts registerChat()
    // SLOT.RESKEY: src/features/council.ts registerCouncil()
    router.on(log_router_1.SLOT.LOADED, 'main:loaded', (m) => {
        if (m.kind === 'LOADED') {
            game_link_1.link.epoch++;
            (0, condemn_app_1.resetCondemnSession)(); // Same-save reload also invalidates commands queued before loading.
            // 같은 세이브를 다시 불러와도(과거 자동 저장 포함) 이전 시점의 수락 대기 제안·쌓인 호감은 버린다(2026-10-18). 다른 세이브면 noteSave 가 비운다.
            if (chat_1.chat.pending || chat_1.chat.pend) {
                chat_1.chat.pending = null;
                chat_1.chat.pend = null;
                (0, windows_1.toUi)('event', (0, settings_ui_1.pick)('세이브를 다시 불러와 수락 대기 중이던 제안을 취소했습니다.', 'The save was reloaded, so the pending proposal was cancelled.'));
            }
            const sid = (0, images_1.cleanSaveId)(m.kv.sid);
            noteSave(sid);
            if (m.kv.date) {
                gameDate = m.kv.date;
                if (sid && (0, gov_1.govMem)().track(sid, m.kv.date))
                    (0, windows_1.toUi)('event', (0, settings_ui_1.pick)('세이브를 과거로 불러와 총독 기억의 시간선이 갈라졌습니다.', 'An earlier save was loaded, so the governor memory timeline branched.'));
            }
        }
    });
    // SLOT.TALK: src/features/chat.ts registerChat()
    // SLOT.PROFILE: src/features/chat.ts registerChat()
    // SLOT.INBOX_SYNC: src/features/mail-app.ts registerMail()
    router.on(log_router_1.SLOT.TO_UI, 'main:to_ui', (m) => {
        (0, windows_1.toUi)('sllm', m);
    });
    (0, game_link_1.registerGameLink)(router);
    // F-41: replay never enters the feature router or marks the game ready.
    watcher.on('history', (m) => {
        game_link_1.link.reqCounter = Math.max(game_link_1.link.reqCounter, (0, protocol_1.reqSeenIn)(m));
    });
    watcher.on('message', (m) => router.dispatch(m));
    watcher.on('reset', () => {
        game_link_1.link.epoch++;
        (0, condemn_app_1.resetCondemnSession)();
        game_link_1.link.runtimeMod = null;
        game_link_1.link.reqCounter = 0;
        game_link_1.link.sessionReady = false;
        game_link_1.link.lastModLineAt = 0;
        terminal_1.terminal.reset();
        modCompatibility.clearLive();
        flagProv.setExpectedSid('');
        curSaveId = '';
        chat_1.chat.history = [];
        chat_1.chat.histories.clear();
        chat_1.chat.talk = null;
        chat_1.chat.pend = null;
        (0, chat_1.resetConversation)();
        chat_1.chat.pending = null;
        profiles.clear();
        mail_app_1.mail.countries.clear();
        chronicle_app_1.idxNames.clear();
        playerIdx = 0;
        playerName = '';
        mail_app_1.mail.plan.set('', []);
        mail_app_1.mail.roll = [];
        mail_app_1.mail.news = [];
        (0, radio_app_1.radioResetForSave)();
        (0, windows_1.toUi)('contacts', (0, terminal_1.terminalView)());
        (0, windows_1.toUi)('talk', null);
        (0, mail_app_1.syncInbox)();
    }); // 게임을 다시 켜서 로그가 비워짐
    watcher.start();
    (0, ai_settings_1.syncP2Ping)();
    if (settings_1.settings.aiMode !== 'custom')
        p2.login()
            .then(() => (0, windows_1.toUi)('status', (0, settings_ui_1.pick)('Player2 로그인 완료', 'Player2 login complete')))
            .catch((e) => (0, windows_1.toUi)('status', (0, settings_ui_1.pick)('Player2 로그인 실패: ', 'Player2 login failed: ') + e.message));
    // ---- AI 연결 설정: src/features/ai-settings.ts 로 옮김(A-00b 4번)
    (0, ai_settings_1.registerAiSettings)();
    (0, terminal_1.registerTerminal)(router); // contactsList·contactsRefresh·contactDial + 로그 자리 TERMINAL (src/features/terminal.ts)
    (0, chat_1.registerChat)(router, noteSave); // chat·accept·finish·reject·forcePeace·apply + 로그 자리 OPSHIFT·KEYBOARD·END·TALK·PROFILE (src/features/chat.ts)
    // ---- 설정과 (실험) 편지
    // 모드 호환 팩 IPC 3개: src/features/environment.ts 로 옮김(A-00b 4번)
    // 버그 신고 묶음 IPC 4개: src/features/support.ts 로 옮김(A-00b 4번)
    (0, support_1.registerSupport)();
    (0, backstory_app_1.registerBackstory)(autoLore); // backstoryEmpire·backstoryEmpireSet·backstoryPerson·backstoryPersonSet 제국·인물 전기 입력 (src/features/backstory-app.ts) — 2026-10-18
    (0, app_update_1.registerAppUpdate)(); // 창작마당 모드로 받은 앱 업데이트 알림·교체 (src/features/app-update.ts) — 2026-10-18
    (0, settings_ui_1.registerSettingsUi)(); // getSettings·setPlayer2ClientId·setAiLanguage·setLanguage·setMailEnabled·getCustomCss·openCustomCss (src/features/settings-ui.ts)
    (0, windows_1.registerWindows)(); // 창·런처·알림 카드·게이트·창 설정 IPC 17개 (src/features/windows.ts)
    // 사용자 그림 IPC 6개 + flagFor: src/features/images.ts 로 옮김(A-00b 4번)
    (0, images_2.registerImages)();
    (0, portrait_lib_app_1.registerPortraitLib)();
    (0, media_1.registerMedia)(); // mediaGet·mediaSave·mediaBrand·newsList·gossipList·paperOpen·paperClose (src/features/media.ts)
    (0, radio_app_1.registerRadio)(); // radioGet·radioSelect·radioOff·radioNow (src/features/radio-app.ts)
    // 연설 IPC 5개: src/features/speech-app.ts registerSpeech()
    (0, council_1.registerCouncil)(router); // 의회 IPC 6개 + 로그 자리 RESOLUTION·AGENDA·RESKEY (src/features/council.ts)
    (0, govreport_1.registerGovReport)(router); // A-26 총독 홀로그램 보고: govReportState·govReportSay·govReportRetry·govReportClose + SLOT.GOVREPORT (src/features/govreport.ts)
    (0, gov_1.registerGov)(); // govRefresh·govReset·govMemList·govMemAdd·govMemDel·govChat·planetArt·govClose (src/features/gov.ts)
    (0, chronicle_app_1.registerChronicle)(); // chronList (src/features/chronicle-app.ts)
    // ---- 경로(게임 사용자 폴더·모드 폴더·세이브·게임 설치) IPC 9개: src/features/environment.ts 로 옮김(A-00b 4번)
    (0, environment_1.registerEnvironment)();
    (0, mediation_app_1.registerMediation)();
    (0, summit_1.registerSummit)(); // 연방 정상회담(A-01 1단계, 시연판): summitState·summitAgenda·summitVote·summitSay·summitApply·summitClose (src/features/summit.ts)
    (0, summit_1.registerSummitLog)(router); // A-01 2단계: SLOT.FEDERATION(FED·FEDMEMBER·FEDLAW·FEDEND) — 앱이 물었을 때만 모은다
    (0, allied_council_app_1.registerAlly)(); // 동맹 평의회: 방어 협정·종속·종주 (src/features/allied-council-app.ts)
    (0, allied_council_app_1.registerAllyLog)(router); // SLOT.ALLY(ALLY·ALLYTRAIT·ALLYEND) — 앱이 물었을 때만 모은다
    (0, dev_tools_1.registerDevTools)(router); // 개발자 모드 전용: 게임 없이 새 기능 화면 시험(src/features/dev-tools.ts)
    (0, mail_app_1.registerMail)(router);
    (0, dinner_app_1.registerDinner)(router);
    (0, espionage_app_1.registerEspionage)(router); // + SLOT.SPY_APPLY 첩보 제재 게임 적용 응답
    (0, policy_app_1.registerPolicy)(router); // + SLOT.POLICY 정책 퀘스트(집무실 정책 칸) — 2026-10-18
    (0, people_app_1.registerPeople)(router); // + SLOT.PEOPLE 내 지도자 명단(집무실 연락처) — 2026-10-18
    (0, persona_app_1.registerPersona)(); // personaInfo·personaOpen·personaSay·personaEnd 집무실 인물 대화+기억 — 2026-10-18
    (0, letters_app_1.registerLetters)(); // 개인 서신: 6개월마다 후보 중 무작위, 열 때 본문 — 2026-10-18
    (0, secretary_app_1.registerSecretary)(router); // + SLOT.SECRETARY 집무실 비서(업무 보고·지식·연애) — 2026-10-18
    (0, memorial_app_1.registerMemorial)(); // 작별·추모관: 사망 → 비석(명예의 전당), 해임·행방 불명 → 떠난 사람들 — 2026-10-18
    (0, private_rooms_app_1.registerPrivateRooms)(router);
    (0, office_app_1.registerOffice)(); // officeState·officeOpen·officeClose·officePlanets 집무실(홀로그램 바탕화면) — 2026-10-18
    (0, office_style_app_1.registerOfficeStyle)(); // officeStyle·officeStyleSet 집무실 종류(제국 가치관별 배경) — 2026-10-19
    (0, independence_app_1.registerIndependence)(); // 반란·독립 → 부모 제국 기록·연대기 + 「독립 선언문」 서신 — 2026-10-19
    (0, petition_app_1.registerPetitions)(router); // + SLOT.PETITION 시민 청원(집무실 바탕화면) — 2026-10-19
    (0, embassy_app_1.registerEmbassy)(router); // + SLOT.EMBASSY 대사관 보고서(집무실 바탕화면) — 2026-10-19
    (0, music_app_1.registerMusic)(); // 국가·군가(집무실 바탕화면, 앱 전용) — 2026-10-20 알파 10 앞당김
    (0, mood_app_1.registerMood)(); // 민심(시민 지지도) 화면 자료 — 2026-10-20 알파 10
    (0, debate_app_1.registerDebate)(); // 신문·라디오 찬반 논평 — 2026-10-20 알파 10
    (0, scandal_app_1.registerScandal)(); // 비방 공작 → 신문 추문·대응 — 2026-10-20 알파 9
    (0, agents_app_1.registerAgents)(); // 첩보망 = 공작원 인물(이름·암호명·위장·연락 두절) — 2026-10-20 알파 9
    (0, national_events_app_1.registerNationalEvents)(router);
    (0, official_holidays_app_1.registerOfficialHolidays)(router);
    (0, ceremony_app_1.registerCeremony)(router); // 출정 의식(복무신조 전체화면 낭독) — 2026-10-20
    (0, condemn_app_1.registerCondemn)(router); // + SLOT.CONDEMN 규탄 성명(WARVOICE → 판정·알림·호감) — 2026-10-20
    (0, declare_app_1.registerDeclare)(router); // + SLOT.DECLARE 전쟁 선언문(전쟁 시작 알림 → 선언문 → 낭독 방송 → 출정 의식) — 2026-10-20
    (0, crisis_app_1.registerCrisis)(router); // + SLOT.CRISIS 은하 위기 특집 방송(신문 특별판·라디오 긴급 특별 방송) — 2026-10-17
    (0, tts_app_1.registerTts)(); // ttsAiCheck·ttsAiSpeak 라디오 AI 음성(OpenAI /audio/speech) — 2026-10-17
    (0, chronbook_app_1.registerChronBook)(); // chronBookExport 연대기 책 내보내기(HTML/PDF) — 2026-10-17
    (0, fleet_app_1.registerFleet)(router); // + SLOT.FLEET 함대 사령부(제독 전투 기록·청문회) — 2026-10-17
    (0, vassal_app_1.registerVassal)(router); // + SLOT.VASSAL 종속국 통신 채널(청원 결과 적용 응답·타이머 서신) — 2026-10-17
    (0, press_app_1.registerPress)(router); // + SLOT.PRESS 언론사 인터뷰(시행령 준비·월 신호·버프 확인) — 2026-10-17
    (0, effect_verifier_1.registerEffectVerifier)(router);
    (0, conversation_favors_1.registerConversationFavors)(router);
    (0, archive_app_1.registerArchive)(router); // 대보관소 표본 읽기(알파 6 수집품 1단계)
    (0, peace_app_1.registerPeace)(router); // SLOT.PEACE 평화 중재·강제 평화 게임 연결 (src/features/peace-app.ts)
    (0, banquet_app_1.registerBanquet)(); // inbox·openLetter + 로그 자리 MAIL·INBOX_SYNC (src/features/mail-app.ts). replyLetter 는 단말기와 함께 옮김
    // replyLetter: src/features/mail-app.ts registerMail()
    // accept·finish·reject·forcePeace·apply: src/features/chat.ts registerChat()
});
electron_1.app.on('window-all-closed', () => (0, windows_1.quitAll)());
//# sourceMappingURL=main.js.map
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
exports.iconBaseHeight = exports.BASE_ICON = exports.wins = void 0;
exports.toUi = toUi;
exports.createWindow = createWindow;
exports.giveBackToGame = giveBackToGame;
exports.closeSettings = closeSettings;
exports.openSettings = openSettings;
exports.applyScale = applyScale;
exports.gateBlocked = gateBlocked;
exports.pushGate = pushGate;
exports.needPaused = needPaused;
exports.onMonthTick = onMonthTick;
exports.setAppOpen = setAppOpen;
exports.hideToast = hideToast;
exports.showToast = showToast;
exports.notify = notify;
exports.updateBadge = updateBadge;
exports.registerHotkey = registerHotkey;
exports.createTray = createTray;
exports.refreshTray = refreshTray;
exports.startFade = startFade;
exports.quitAll = quitAll;
exports.raise = raise;
exports.registerWindows = registerWindows;
// A-00b 7번: 창 관리(앱 쪽) — 메인 창·구석 아이콘(런처)·이름표·설정 창·알림 카드·트레이·단축키·자동 흐려짐·항상 위,
// 게임 창 따라가기(GameWindowWatcher), 일시정지 안내(게이트), 화면으로 보내기(toUi), 앱 종료(quitAll)와 그 IPC 17개.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 다른 모듈은 이 상태를 ctx.win·ctx.launcher·ctx.appOpen 등으로 본다.
// 기능 모듈(의회·연설·라디오·총독·신문·서신·대화)을 부르므로 app/ 대신 features/ 에 둠(app/* 는 features 를 가져오지 않음).
const faction_app_1 = require("./faction-app");
const mediation_app_1 = require("./mediation-app");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const settings_1 = require("../app/settings");
const safe_send_1 = require("../safe-send");
const ctx_1 = require("../app/ctx");
const gameWindow_1 = require("../gameWindow");
const game_display_1 = require("../game-display");
const environment_paths_1 = require("../environment-paths");
const overlayPrefs_1 = require("../overlayPrefs");
const theme_1 = require("../theme");
const speech_1 = require("../speech");
const galnews_1 = require("../galnews");
const media_custom_1 = require("../media-custom");
const settings_ui_1 = require("./settings-ui");
const council_1 = require("./council");
const speech_app_1 = require("./speech-app");
const press_app_1 = require("./press-app");
const vassal_app_1 = require("./vassal-app");
const fleet_app_1 = require("./fleet-app");
const office_app_1 = require("./office-app");
const declare_app_1 = require("./declare-app"); // 전쟁 선언문 알림(2026-10-20)
const debate_app_1 = require("./debate-app"); // 라디오 찬반 논평 알림(2026-10-20)
const scandal_app_1 = require("./scandal-app"); // 비방 공작 추문 대응(2026-10-20)
const espionage_app_1 = require("./espionage-app"); // 실제 게임 사건 청문회(2026-10-20)
const condemn_app_1 = require("./condemn-app"); // 남의 전쟁에 우리 성명(2026-10-20)
const office_1 = require("../office");
const radio_app_1 = require("./radio-app");
const gov_1 = require("./gov");
const media_1 = require("./media");
const govreport_1 = require("./govreport");
const mail_app_1 = require("./mail-app");
const chat_1 = require("./chat");
const banquet_app_1 = require("./banquet-app");
const mediation_app_2 = require("./mediation-app");
const summit_1 = require("./summit");
const game_link_1 = require("../app/game-link");
/** 창 상태(main.ts의 let 변수들을 모았다). 다른 모듈은 ctx 로 본다 */
exports.wins = {
    /** 메인 창(통신 단말기) */
    win: null,
    /** 구석의 아이콘 창(런처) */
    launcher: null,
    /** 설정 전용 창 */
    setWin: null,
    /** 사용자가 메인 창을 열어 둔 상태 */
    appOpen: false,
    gameRunning: false,
    gameHwnd: 0, // 게임 창 손잡이(창을 닫을 때 게임을 다시 앞으로 보내는 데 쓴다)
    gameFront: false,
    /** 게임 창 영역(화면 좌표, DIP). 게임이 꺼져 있으면 null */
    gameDip: null,
    /** 창 크기 배율 */
    curScale: 1,
};
function toUi(channel, payload) {
    if (['status', 'mailstatus', 'event'].includes(channel) && typeof payload === 'string')
        (0, diagnostics_1.logDiagnostic)('info', 'ui.notice', { channel, message: payload });
    if (typeof payload === 'string' && ['status', 'mailstatus', 'event'].includes(channel))
        payload = (0, settings_ui_1.uiText)(payload);
    if (channel === 'talk' && payload && typeof payload === 'object') {
        const fu = ctx_1.ctx.flagUrlFor(payload.idx);
        if (fu)
            payload = { ...payload, flagUrl: fu };
    }
    if (channel === 'talk' || channel === 'kbchat' || channel === 'mail' || channel === 'mood' || channel === 'event')
        bumpFade();
    (0, safe_send_1.safeSend)(exports.wins.win, channel, payload);
    // 설정 창(같은 index.html, mode=settings)도 상태 문구·환경 확인·그림 목록을 받는다. API 키 저장 실패 등이 숨은 메인 창으로만 가던 문제(2026-10-18).
    if ((channel === 'status' || channel === 'environment' || channel === 'images') && exports.wins.setWin && !exports.wins.setWin.isDestroyed())
        (0, safe_send_1.safeSend)(exports.wins.setWin, channel, payload);
    if ((channel === 'images' || channel === 'planets') && gov_1.gov.win && !gov_1.gov.win.isDestroyed())
        (0, safe_send_1.safeSend)(gov_1.gov.win, channel, payload);
}
function createWindow() {
    exports.wins.win = new electron_1.BrowserWindow({
        width: 480,
        height: 660,
        minWidth: 440,
        minHeight: 520,
        frame: false, // 테두리 없이 게임풍으로(제목 줄은 화면 안에 직접 그린다)
        show: false, // 집무실 바탕화면의 「외교 단말기」 아이콘(또는 알림·트레이·단축키)으로 연다
        ...(0, office_1.glassWin)(true), // 투명 창: 따로 뜰 때는 body 가 불투명하게 칠해져 그대로이고, 집무실에 붙으면 유리처럼 비친다
        alwaysOnTop: true,
        webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
    });
    exports.wins.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'index.html'));
    createLauncher();
    exports.wins.win.webContents.on('did-finish-load', () => applyScale(true));
    exports.wins.launcher?.webContents.on('did-finish-load', () => applyScale(true));
    keepOnTop();
    follow();
    (0, office_app_1.setTerminalHook)({
        win: () => (exports.wins.win && !exports.wins.win.isDestroyed() ? exports.wins.win : null),
        open: () => { if (!exports.wins.appOpen)
            (0, safe_send_1.safeSend)(exports.wins.win, 'pane', 'contacts'); setAppOpen(true); },
        close: () => setAppOpen(false),
        unread: () => mail_app_1.mail.inbox.filter((l) => !l.read).length,
        back: () => { if (exports.wins.gameRunning && exports.wins.gameHwnd)
            (0, gameWindow_1.focusGame)(exports.wins.gameHwnd); },
        restore: () => { if (exports.wins.win && !exports.wins.win.isDestroyed()) {
            exports.wins.win.setAlwaysOnTop(settings_1.settings.keepOnTop, 'screen-saver', 1);
            exports.wins.win.setMaximumSize(10000, 10000);
        } freePlaced = false; userMoveAt = 0; applyScale(true); }, // 떼면 원래 크기로, 자리는 다음 게임 창 확인 때 다시 붙는다
    });
}
// ---- OP.GG 처럼 게임 창에 붙어 다니기
// Stellaris 가 앞에 있으면 보이고, 다른 프로그램으로 가면 같이 숨는다(게임이 꺼져 있으면 구석 아이콘은 숨기고, 본 창은 트레이/단축키로 연 경우만 보인다).
// 게임 창 가장자리에 붙고, 플레이어가 끌어서 옮기면 그 자리(게임 창 기준)를 기억한다.
const gameWatcher = new gameWindow_1.GameWindowWatcher();
let lastAutoMove = 0, userMoveAt = 0, userMoveL = 0, freePlaced = false;
let overlayPreviewActive = false;
let previewDockPos = null, previewLauncherPos = null;
let previewFreePos = null;
function follow() {
    if (!exports.wins.win)
        return;
    // 사용자가 창을 끌면(move 가 계속 오는 동안) 자동 정렬을 멈추고, 놓은 자리를 기억한다. 'moved' 는 이 창(프레임 없음)에서 오지 않을 때가 있어 'move' 를 쓴다.
    let saveT = null;
    exports.wins.win.on('move', () => {
        if (!exports.wins.win || Date.now() - lastAutoMove < 400 || (0, office_app_1.terminalDocked)())
            return; // 앱이 스스로 옮긴 이동·집무실에 붙어 있는 동안은 무시
        userMoveAt = Date.now();
        if (saveT)
            clearTimeout(saveT);
        saveT = setTimeout(() => {
            if (!exports.wins.win || exports.wins.win.isDestroyed())
                return;
            const b = exports.wins.win.getBounds();
            if (overlayPreviewActive) {
                if (!settings_1.settings.dockLock)
                    previewFreePos = { x: b.x, y: b.y };
                else if (exports.wins.gameDip)
                    previewDockPos = (0, gameWindow_1.toFrac)(b, exports.wins.gameDip);
                return;
            }
            if (!settings_1.settings.dockLock)
                settings_1.settings.freePos = { x: b.x, y: b.y };
            else if (exports.wins.gameDip && settings_1.settings.dock !== 'off')
                settings_1.settings.dockPos = (0, gameWindow_1.toFrac)(b, exports.wins.gameDip);
            (0, settings_1.saveSettings)();
        }, 400);
    });
    let saveL = null;
    exports.wins.launcher?.on('move', () => {
        if (!exports.wins.launcher || Date.now() - lastAutoMoveL < 400)
            return;
        userMoveL = Date.now();
        if (saveL)
            clearTimeout(saveL);
        saveL = setTimeout(() => {
            if (!exports.wins.launcher || exports.wins.launcher.isDestroyed() || !exports.wins.gameDip)
                return;
            if (overlayPreviewActive) {
                previewLauncherPos = (0, gameWindow_1.toFrac)(exports.wins.launcher.getBounds(), exports.wins.gameDip);
                return;
            }
            settings_1.settings.launcherPos = (0, gameWindow_1.toFrac)(exports.wins.launcher.getBounds(), exports.wins.gameDip);
            (0, settings_1.saveSettings)();
        }, 400);
    });
    gameWatcher.on('state', (g0) => {
        if (!exports.wins.win || exports.wins.win.isDestroyed())
            return;
        // 개발자 모드 + 오버레이 강제 표시: 게임이 꺼져 있어도 주 화면을 게임 창으로 보고 아이콘/대화창을 띄운다(시험용)
        const preview = settings_1.settings.devMode && settings_1.settings.forceOverlay && !g0.running;
        if (overlayPreviewActive !== preview) {
            freePlaced = false;
            lastAutoMove = Date.now();
            lastAutoMoveL = Date.now();
        }
        overlayPreviewActive = preview;
        let g = g0;
        if (preview) {
            const d = electron_1.screen.getPrimaryDisplay(), f = d.scaleFactor || 1;
            g = { running: true, foreground: true, minimized: false, x: Math.round(d.workArea.x * f), y: Math.round(d.workArea.y * f), w: Math.round(d.workArea.width * f), h: Math.round(d.workArea.height * f), fgPid: g0.fgPid };
        }
        const appInFront = g.fgPid === process.pid || exports.wins.win.isFocused();
        const front = g.running && !g.minimized && (g.foreground || appInFront); // 게임이 꺼져 있으면 아이콘은 숨긴다(트레이로만 연다)
        // 게임이 꺼지면 OP.GG처럼 모든 창을 숨기고 트레이(윈도우 작업 표시줄 오른쪽 아이콘)로만 연다
        if (exports.wins.gameRunning && !g0.running && exports.wins.appOpen && !preview)
            setAppOpen(false);
        if (!exports.wins.gameRunning && g0.running)
            displayModeNotice(); // 게임이 막 켜졌을 때 화면 모드 확인(독점 전체화면이면 안내)
        exports.wins.gameFront = !preview && front;
        exports.wins.gameRunning = g0.running;
        exports.wins.gameHwnd = g0.hwnd ?? 0;
        (0, game_link_1.noteGameProcess)(g0.running);
        ctx_1.ctx.syncPlayer2Activity(); // 미리보기는 게임 실행으로 취급하지 않는다
        const visible = settings_1.settings.autoHide ? front : true;
        // 본 창은 사용자가 열어 둔 상태(appOpen)일 때만, 아이콘 창은 늘(숨김 조건만 따라)
        const wantMain = exports.wins.appOpen && (visible || !g.running), wantIcon = visible && g.running;
        const docked = (0, office_app_1.terminalDocked)(); // 집무실에 붙은 단말기는 집무실 창을 따라가므로 여기서 숨기거나 옮기지 않는다
        if (!docked) {
            if (wantMain && !exports.wins.win.isVisible()) {
                exports.wins.win.showInactive();
                raise();
            }
            else if (!wantMain && exports.wins.win.isVisible())
                exports.wins.win.hide();
        }
        if (exports.wins.launcher && !exports.wins.launcher.isDestroyed()) {
            if (wantIcon && !exports.wins.launcher.isVisible()) {
                exports.wins.launcher.showInactive();
                raiseIcon();
                introToast();
            }
            else if (!wantIcon && exports.wins.launcher.isVisible())
                exports.wins.launcher.hide();
        }
        if (!g.running) {
            exports.wins.gameDip = null;
            return;
        }
        if (g.minimized || g.w <= 0 || g.h <= 0)
            return;
        exports.wins.gameDip = electron_1.screen.screenToDipRect(null, { x: g.x, y: g.y, width: g.w, height: g.h });
        applyScale(false);
        const dockPos = preview ? previewDockPos : settings_1.settings.dockPos;
        const launcherPos = preview ? previewLauncherPos : settings_1.settings.launcherPos;
        const freePos = preview ? previewFreePos : settings_1.settings.freePos;
        if (docked) { /* 집무실 홀로그램 자리에 있음 */ }
        else if (!settings_1.settings.dockLock) { // 고정 해제: 자동으로 옮기지 않는다(처음 한 번만 마지막 자리로 보낸다)
            if (!freePlaced && freePos) {
                lastAutoMove = Date.now();
                exports.wins.win.setPosition(Math.round(freePos.x), Math.round(freePos.y));
            }
            freePlaced = true;
        }
        else if (settings_1.settings.dock !== 'off' && Date.now() - userMoveAt > 1500) {
            const [aw, ah] = exports.wins.win.getSize();
            // 아이콘이 구석에 고정돼 있으면(끌어서 옮기지 않았으면) 대화창은 그 바로 옆에 선다
            const iconSide = launcherPos ? null : (settings_1.settings.launcherCorner === 'br' || settings_1.settings.launcherCorner === 'tr' ? 'right' : 'left');
            const r = (0, gameWindow_1.dockRect)(exports.wins.gameDip, { width: aw, height: ah }, settings_1.settings.dock, dockPos, exports.wins.curScale, iconSide);
            const b = exports.wins.win.getBounds();
            if (Math.abs(b.x - r.x) > 1 || Math.abs(b.y - r.y) > 1) {
                lastAutoMove = Date.now();
                exports.wins.win.setBounds({ x: r.x, y: r.y, width: aw, height: ah });
            }
        }
        if (exports.wins.launcher && !exports.wins.launcher.isDestroyed() && Date.now() - userMoveL > 1500) {
            const [lw, lh] = exports.wins.launcher.getSize();
            const r = (0, gameWindow_1.launcherRect)(exports.wins.gameDip, { width: lw, height: lh }, settings_1.settings.launcherCorner, launcherPos, exports.wins.curScale);
            const b = exports.wins.launcher.getBounds();
            if (Math.abs(b.x - r.x) > 1 || Math.abs(b.y - r.y) > 1) {
                lastAutoMoveL = Date.now();
                exports.wins.launcher.setBounds(r);
            }
        }
        (0, radio_app_1.placeRadio)();
    });
    gameWatcher.on('error', (e) => toUi('status', '게임 창 추적 실패: ' + e.message));
    gameWatcher.start();
}
/** 독점 전체화면 안내(앱 실행마다 한 번): 이 모드에서는 우리 창이 뜨면 게임이 내려가므로 테두리 없음으로 바꾸라고 알린다. */
let displayNoticeShown = false;
function displayModeNotice() {
    if (displayNoticeShown || (0, game_display_1.readDisplayMode)((0, environment_paths_1.runtimeUserDir)()) !== 'exclusive')
        return;
    displayNoticeShown = true;
    setTimeout(() => notify({ kind: 'info', title: '게임 화면 모드 안내', body: '스텔라리스가 전체화면(독점) 모드라 앱 창이 뜨면 게임이 내려갑니다. 설정 → 게임 연동에서 테두리 없는 전체화면으로 바꿀 수 있어요.' }), 4000);
    toUi('status', game_display_1.DISPLAY_HINT_KO);
}
/** 앱 창을 접을 때 게임을 다시 앞으로. 우리 창이 앞에 있었을 때만 윈도우가 허락하므로 숨기기 전에 부른다. */
function giveBackToGame() { if (exports.wins.gameRunning && exports.wins.gameHwnd && !(0, office_app_1.terminalDocked)())
    (0, gameWindow_1.focusGame)(exports.wins.gameHwnd); }
let toastActionKind = 'agenda'; // 알림 카드의 버튼이 연설 창을 열지, 안건 회의를 열지
// ---- 설정 전용 창: 대화 화면(본 창)과 따로 뜬다.
function closeSettings() { if (exports.wins.setWin && !exports.wins.setWin.isDestroyed()) {
    if (exports.wins.setWin.isFocused())
        giveBackToGame();
    exports.wins.setWin.close();
} exports.wins.setWin = null; }
function openSettings() {
    if (exports.wins.setWin && !exports.wins.setWin.isDestroyed()) {
        exports.wins.setWin.show();
        exports.wins.setWin.focus();
        return;
    }
    const area = exports.wins.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(560, Math.round(area.width * 0.5)), height: Math.min(760, Math.round(area.height * 0.86)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.wins.setWin = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 420, minHeight: 420, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.wins.setWin.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.wins.setWin.loadFile(path.join(__dirname, '..', '..', 'ui', 'index.html'), { query: { mode: 'settings' } });
    exports.wins.setWin.once('ready-to-show', () => exports.wins.setWin?.show());
    exports.wins.setWin.on('closed', () => { exports.wins.setWin = null; });
}
// ---- 구석의 아이콘 창(런처): 눌러서 본 창을 열고 닫는다. 게임이 계속 포커스를 가지도록 포커스는 받지 않는다.
let lastAutoMoveL = 0;
// 창 크기 배율: 바뀔 때만 창 크기와 화면 확대를 맞춘다(사용자가 직접 늘린 크기를 매 순간 덮어쓰지 않도록).
const BASE_MAIN = { width: 480, height: 660 };
exports.BASE_ICON = { width: 46, height: 203 }; // 아이콘 줄: 손잡이, 집무실, 신문, 라디오, 설정(단말기·총독·종속국·함대는 집무실 바탕화면에서 연다)
const iconBaseHeight = () => exports.BASE_ICON.height;
exports.iconBaseHeight = iconBaseHeight;
function applyScale(force) {
    const s = (0, gameWindow_1.layoutScale)(exports.wins.gameDip ? exports.wins.gameDip.height : null, settings_1.settings.uiScale, settings_1.settings.autoScale);
    if (!force && Math.abs(s - exports.wins.curScale) < 0.01)
        return;
    exports.wins.curScale = s;
    if (exports.wins.win && !exports.wins.win.isDestroyed() && !(0, office_app_1.terminalDocked)()) { // 집무실에 붙어 있는 동안은 홀로그램 자리 크기를 지킨다
        const sz = exports.wins.gameDip ? (0, gameWindow_1.fitSize)({ width: BASE_MAIN.width * s, height: BASE_MAIN.height * s }, exports.wins.gameDip) : { width: Math.round(BASE_MAIN.width * s), height: Math.round(BASE_MAIN.height * s) };
        const zoom = Math.max(0.5, sz.width / BASE_MAIN.width);
        exports.wins.win.setMinimumSize(Math.round(440 * zoom), Math.round(520 * zoom));
        exports.wins.win.setSize(sz.width, sz.height);
        exports.wins.win.webContents.setZoomFactor(zoom);
    }
    if (exports.wins.launcher && !exports.wins.launcher.isDestroyed()) {
        exports.wins.launcher.setSize(Math.round(exports.BASE_ICON.width * s), Math.round((0, exports.iconBaseHeight)() * s));
        exports.wins.launcher.webContents.setZoomFactor(s);
    }
}
// ---- 아이콘 이름표: 런처 창이 좁아서, 마우스를 올리면 따로 작은 창으로 이름을 보여 준다.
let tipWin = null;
function hideTip() { if (tipWin && !tipWin.isDestroyed())
    tipWin.hide(); }
function showTip(label, y, h) {
    if (!exports.wins.launcher || exports.wins.launcher.isDestroyed())
        return;
    const lb = exports.wins.launcher.getBounds(), s = exports.wins.curScale || 1;
    const w = Math.round((label.length * 13 + 26) * s), th = Math.round(28 * s);
    const disp = electron_1.screen.getDisplayMatching(lb).workArea;
    const left = lb.x + lb.width / 2 > disp.x + disp.width / 2;
    const x = left ? lb.x - w - 4 : lb.x + lb.width + 4, yy = Math.round(lb.y + (y + h / 2) * s - th / 2);
    if (!tipWin || tipWin.isDestroyed()) {
        tipWin = new electron_1.BrowserWindow({ width: w, height: th, x, y: yy, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true, show: false });
        tipWin.setIgnoreMouseEvents(true);
        tipWin.setAlwaysOnTop(true, 'screen-saver', 2);
        tipWin.on('closed', () => { tipWin = null; });
        void tipWin.loadURL('data:text/html;charset=utf-8,' +
            encodeURIComponent('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#t{box-sizing:border-box;height:100%;display:flex;align-items:center;justify-content:center;background:#06141bf0;border:1px solid #5fd4e4aa;color:#dcecf0;font:13px "Malgun Gothic",sans-serif;white-space:nowrap}</style><div id="t"></div>'));
    }
    const tw = tipWin;
    tw.setBounds({ x, y: yy, width: w, height: th });
    const apply = () => { tw.webContents.executeJavaScript(`document.getElementById('t').textContent=${JSON.stringify(label)};document.getElementById('t').style.fontSize='${Math.round(13 * s)}px'`).then(() => { if (!tw.isDestroyed())
        tw.showInactive(); }).catch(() => { }); };
    if (tw.webContents.isLoading())
        tw.webContents.once('did-finish-load', apply);
    else
        apply();
}
function createLauncher() {
    exports.wins.launcher = new electron_1.BrowserWindow({
        width: 46, height: 281, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
        focusable: false, alwaysOnTop: true, show: false,
        webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
    });
    exports.wins.launcher.setAlwaysOnTop(true, 'screen-saver', 1);
    exports.wins.launcher.loadFile(path.join(__dirname, '..', '..', 'ui', 'launcher.html'));
    // 게임이 켜져 있을 때만 아이콘을 보인다(게임 상태 추적이 보이고 숨긴다). 안내 카드는 아이콘이 처음 보일 때 한 번.
    exports.wins.launcher.once('ready-to-show', () => { if (exports.wins.gameRunning) {
        exports.wins.launcher?.showInactive();
        introToast();
    } });
}
let introShown = false;
function introToast() { if (introShown)
    return; introShown = true; setTimeout(() => showToast({ kind: 'info', title: 'SLLM · SteLLaris Missive', body: (0, settings_ui_1.pick)('이 아이콘을 누르면 대화창이 열립니다.', 'Click this icon to open the chat window.') }, 6000), 2500); }
function raiseIcon() {
    if (!exports.wins.launcher || exports.wins.launcher.isDestroyed() || !exports.wins.launcher.isVisible() || !settings_1.settings.keepOnTop)
        return;
    exports.wins.launcher.setAlwaysOnTop(true, 'screen-saver', 1);
    exports.wins.launcher.moveTop();
}
// ---- 일시정지 확인: 달 신호(MONTH)가 오면 게임이 진행 중이다. 진행 중이면 대화를 막고, 사용자가 일시정지한 뒤
// [정지했습니다]를 누르면 푼다. 그 뒤 달 신호가 또 오면(게임을 다시 돌렸으면) 다시 막는다.
let runAck = false, runAckAt = 0;
let lastTickAt = 0; // 마지막으로 게임 달 신호가 온 시각(진행 중이라는 뜻). 멈춘 게임에서는 오지 않는다
function gateBlocked() { return settings_1.settings.pauseGate && exports.wins.gameRunning && Date.now() - lastTickAt < 40000; } // 지금은 대화를 막지 않고 안내만 보인다
function pushGate() { toUi('rungate', { blocked: gateBlocked(), enabled: settings_1.settings.pauseGate }); }
/** 예전에는 게임이 진행 중이면 대화를 막았지만, 지금은 막지 않고 앱이 "정지한 상태로 진행하기를 권장합니다"라고만 알린다. */
function needPaused() { }
function onMonthTick() { lastTickAt = Date.now(); pushGate(); }
setInterval(() => pushGate(), 5000); // 달 신호가 끊기면(일시정지) 안내를 거둔다
function setAppOpen(v) {
    const changed = exports.wins.appOpen !== v;
    exports.wins.appOpen = v;
    if (changed && v) {
        runAck = false;
        pushGate();
    }
    if (!exports.wins.win || exports.wins.win.isDestroyed())
        return;
    if (v) {
        exports.wins.win.show();
        raise();
    }
    else {
        if (exports.wins.win.isFocused())
            giveBackToGame();
        exports.wins.win.hide();
    }
    (0, safe_send_1.safeSend)(exports.wins.launcher, 'appopen', v);
}
// ---- 게임 위에 뜨는 알림 카드(아이콘 옆). 누르면 본 창이 열린다. 게임이 앞에 없으면 윈도우 알림으로 대신한다.
// ToastMsg 타입: src/app/ctx.ts
let toastH = 84;
let toast = null, toastReady = false, toastTimer = null, toastQueue = null;
function createToast() {
    toast = new electron_1.BrowserWindow({
        width: 300, height: 84, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false,
        focusable: false, alwaysOnTop: true, show: false,
        webPreferences: { preload: path.join(__dirname, '..', 'preload.js') },
    });
    toast.setAlwaysOnTop(true, 'screen-saver', 1);
    toast.loadFile(path.join(__dirname, '..', '..', 'ui', 'toast.html'));
    toast.webContents.on('did-finish-load', () => { toastReady = true; if (toastQueue) {
        const q = toastQueue;
        toastQueue = null;
        showToast(q);
    } });
}
function placeToast() {
    if (!toast || !exports.wins.launcher || exports.wins.launcher.isDestroyed())
        return;
    const s = exports.wins.curScale, w = Math.round(300 * s), h = Math.round(toastH * s);
    const lb = exports.wins.launcher.getBounds();
    const area = exports.wins.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const left = lb.x + lb.width / 2 > area.x + area.width / 2;
    let x = left ? lb.x - w - 8 : lb.x + lb.width + 8, y = lb.y;
    x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - w));
    y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - h));
    toast.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
    toast.webContents.setZoomFactor(s);
}
function hideToast() { if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
} if (toast && !toast.isDestroyed() && toast.isVisible())
    toast.hide(); }
function showToast(msg, ms = 7000) {
    if (!toast || toast.isDestroyed())
        createToast();
    if (!toastReady) {
        toastQueue = msg;
        return;
    }
    toastH = msg.action ? 118 : 84;
    placeToast();
    (0, safe_send_1.safeSend)(toast, 'toast', msg);
    toast.showInactive();
    toast.setAlwaysOnTop(true, 'screen-saver', 1);
    if (toastTimer)
        clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, msg.action ? Math.max(ms, 30000) : ms);
}
/** 알림: 아이콘 숫자는 늘 갱신하고, 설정이 켜져 있으면 카드를 띄운다(아이콘이 안 보일 때는 윈도우 알림). */
function notify(msg) {
    msg = { ...msg, title: (0, settings_ui_1.uiText)(msg.title), body: (0, settings_ui_1.uiText)(msg.body), ...(msg.action ? { action: (0, settings_ui_1.uiText)(msg.action) } : {}) };
    if (msg.action)
        toastActionKind = msg.kind === 'speech' ? 'speech' : msg.kind === 'press' ? 'press' : msg.kind === 'vassal' ? 'vassal' : msg.kind === 'fleet' ? 'fleet' : msg.kind === 'office' ? 'office' : msg.kind === 'declare' ? 'declare' : msg.kind === 'statement' ? 'statement' : msg.kind === 'debate' ? 'debate' : msg.kind === 'scandal' ? 'scandal' : msg.kind === 'hearing' ? 'hearing' : msg.kind === 'gov' ? 'gov' : msg.kind === 'faction' ? 'faction' : msg.kind === 'mediation' ? 'mediation' : 'agenda';
    updateBadge();
    if (!settings_1.settings.notify)
        return;
    if (exports.wins.launcher && !exports.wins.launcher.isDestroyed() && exports.wins.launcher.isVisible())
        showToast(msg);
    else if (electron_1.Notification.isSupported())
        new electron_1.Notification({ title: msg.title, body: msg.body }).show();
}
function updateBadge() { (0, safe_send_1.safeSend)(exports.wins.launcher, 'badge', mail_app_1.mail.inbox.filter((l) => !l.read).length); (0, office_app_1.pushOffice)(); } // 집무실 「외교 단말기」 아이콘 숫자도 같이
// ---- 전역 단축키, 트레이 아이콘, 자동 흐려짐
let tray = null, fadeCur = 1, fadeHoldUntil = 0;
function bumpFade() { fadeHoldUntil = Date.now() + 4000; }
/** 단축키를 (다시) 등록한다. 실패하면 이유 문장을, 성공하거나 꺼져 있으면 null. */
function registerHotkey() {
    electron_1.globalShortcut.unregisterAll();
    if (!settings_1.settings.hotkey)
        return null;
    const ok = electron_1.globalShortcut.register(settings_1.settings.hotkey, () => { if (exports.wins.gameFront || !exports.wins.gameRunning || (exports.wins.win && exports.wins.win.isFocused()))
        setAppOpen(!exports.wins.appOpen); });
    return ok ? null : `단축키 ${settings_1.settings.hotkey}을(를) 등록하지 못했습니다. 다른 프로그램이 쓰고 있을 수 있어요. 다른 키를 골라 보세요.`;
}
function createTray() {
    try {
        const img = electron_1.nativeImage.createFromPath(path.join(__dirname, '..', '..', 'ui', 'tray.png'));
        tray = new electron_1.Tray(img.isEmpty() ? electron_1.nativeImage.createEmpty() : img);
        tray.setToolTip((0, settings_ui_1.pick)('SLLM · SteLLaris Missive (실험)', 'SLLM · SteLLaris Missive (experimental)'));
        tray.on('click', () => setAppOpen(!exports.wins.appOpen));
        refreshTray();
    }
    catch (e) {
        toUi('status', (0, settings_ui_1.pick)('트레이 아이콘을 만들지 못했습니다: ', 'Could not create the tray icon: ') + e.message);
    }
}
function trayMenu() {
    return electron_1.Menu.buildFromTemplate([
        { label: (0, settings_ui_1.pick)('통신 단말기 열기/닫기', 'Open/close the comms terminal'), click: () => setAppOpen(!exports.wins.appOpen) },
        { label: (0, council_1.joinLabel)(), enabled: !!council_1.council.pendingAgenda, click: () => { void (0, council_1.openCouncilLive)(); } },
        { label: (0, settings_ui_1.pick)('연설하기', 'Give a speech'), enabled: (0, speech_app_1.speechReady)(), click: () => (0, speech_app_1.openSpeech)() },
        { label: (0, settings_ui_1.pick)('언론사 인터뷰', 'Press interview'), enabled: (0, press_app_1.pressReady)(), click: () => (0, press_app_1.openPress)() },
        { label: (0, settings_ui_1.pick)('설정', 'Settings'), click: () => { openSettings(); } },
        { label: (0, settings_ui_1.pick)('창 위치 초기화', 'Reset window positions'), click: () => { settings_1.settings.dockPos = null; settings_1.settings.launcherPos = null; settings_1.settings.radioDockPos = null; (0, settings_1.saveSettings)(); } },
        { type: 'separator' },
        { label: (0, settings_ui_1.pick)('앱 완전히 끝내기', 'Quit the app completely'), click: () => quitAll() },
    ]);
}
function refreshTray() { try {
    tray?.setContextMenu(trayMenu());
}
catch { /* 트레이가 없으면 건너뜀 */ } }
function startFade() {
    setInterval(() => {
        if (!exports.wins.win || exports.wins.win.isDestroyed() || !exports.wins.win.isVisible())
            return;
        if ((0, office_app_1.terminalDocked)()) {
            if (fadeCur !== 1) {
                fadeCur = 1;
                exports.wins.win.setOpacity(1);
            }
            return;
        } // 집무실 안에서는 흐려지지 않는다
        const target = (0, overlayPrefs_1.fadeTarget)({ enabled: settings_1.settings.fadeEnabled, inside: (0, overlayPrefs_1.pointInRect)(electron_1.screen.getCursorScreenPoint(), exports.wins.win.getBounds()), focused: exports.wins.win.isFocused(), recent: Date.now() < fadeHoldUntil, base: settings_1.settings.fadeOpacity });
        const next = (0, overlayPrefs_1.stepOpacity)(fadeCur, target, 0.12);
        if (next !== fadeCur) {
            fadeCur = next;
            exports.wins.win.setOpacity(fadeCur);
        }
    }, 80);
}
function quitAll() {
    electron_1.globalShortcut.unregisterAll();
    tray?.destroy();
    tray = null;
    // 아직 게임에 보내지 않은 호감 변화가 있으면 보낸 뒤 끝낸다(최대 20초 기다림).
    const done = () => { (0, radio_app_1.setRadio)(false); ctx_1.ctx.watcher.stop(); gameWatcher.stop(); ctx_1.ctx.p2.stop(); electron_1.app.quit(); };
    Promise.race([(0, chat_1.flushMoods)(), new Promise((r) => setTimeout(r, 20000))]).then(done, done);
}
// 게임(테두리 없는 창)을 클릭하면 게임이 자기 창을 맨 위로 올려서 앱이 뒤로 숨는다.
// 일반 '항상 위'보다 높은 층(screen-saver)에 두고, 포커스를 잃을 때와 몇 초마다 다시 맨 위로 올린다.
// 게임이 '독점 전체화면'이면 어떤 창도 위에 못 뜨므로, 게임은 테두리 없는 창 모드를 권장한다.
function raise() {
    if (!exports.wins.win || exports.wins.win.isDestroyed() || exports.wins.win.isMinimized() || !exports.wins.win.isVisible() || !settings_1.settings.keepOnTop)
        return;
    // 집무실처럼 다른 창이 앞에 있을 때 단말기를 다시 올리면, 그 창의 글 입력이 단말기로 새어 나간다.
    if (electron_1.BrowserWindow.getAllWindows().some((w) => w !== exports.wins.win && !w.isDestroyed() && w.isVisible() && w.isFocused()))
        return;
    exports.wins.win.setAlwaysOnTop(true, 'screen-saver', 1);
    exports.wins.win.moveTop();
}
function keepOnTop() {
    if (!exports.wins.win)
        return;
    exports.wins.win.setAlwaysOnTop(settings_1.settings.keepOnTop, 'screen-saver', 1);
    exports.wins.win.on('blur', () => setTimeout(raise, 150));
    exports.wins.win.on('minimize', () => { if (exports.wins.appOpen)
        setAppOpen(false); }); // 윈도우 단축키 등으로 최소화돼도 다시 튀어나오지 않게 접어 둔다
    setInterval(() => { if (exports.wins.win && !exports.wins.win.isDestroyed() && !exports.wins.win.isFocused())
        raise(); raiseIcon(); }, 2000);
}
function registerWindows() {
    electron_1.ipcMain.handle('setKeepOnTop', async (_e, on) => {
        settings_1.settings.keepOnTop = !!on;
        (0, settings_1.saveSettings)();
        exports.wins.win?.setAlwaysOnTop(settings_1.settings.keepOnTop, 'screen-saver', 1);
        return settings_1.settings;
    });
    electron_1.ipcMain.handle('setWindowPrefs', async (_e, prefs) => {
        if (prefs.launcherCorner === 'tr' ||
            prefs.launcherCorner === 'tl' ||
            prefs.launcherCorner === 'br' ||
            prefs.launcherCorner === 'bl') {
            settings_1.settings.launcherCorner = prefs.launcherCorner;
            settings_1.settings.launcherPos = null;
            previewLauncherPos = null;
        }
        if (prefs.councilMode === 'weighted' || prefs.councilMode === 'equal')
            settings_1.settings.councilMode = prefs.councilMode;
        if (prefs.councilTurns !== undefined)
            settings_1.settings.councilTurns = (0, settings_1.clampTurns)(prefs.councilTurns);
        if (prefs.speechTurns !== undefined)
            settings_1.settings.speechTurns = (0, speech_1.clampSpeechTurns)(prefs.speechTurns);
        if (prefs.councilSlots !== undefined)
            settings_1.settings.councilSlots = (0, settings_1.clampSlots)(prefs.councilSlots);
        if (typeof prefs.forceOverlay === 'boolean')
            settings_1.settings.forceOverlay = prefs.forceOverlay;
        if (typeof prefs.devMode === 'boolean') {
            settings_1.settings.devMode = prefs.devMode;
            applyScale(true);
            (0, safe_send_1.safeSend)(exports.wins.launcher, 'dev', settings_1.settings.devMode);
            if (!settings_1.settings.devMode)
                (0, council_1.closeCouncil)();
        }
        if (settings_1.settings.devMode) {
            if (prefs.devCouncilVote !== undefined)
                settings_1.settings.devCouncilVote = (0, settings_1.devVoteMode)(prefs.devCouncilVote);
            if (prefs.devCouncilPercent !== undefined)
                settings_1.settings.devCouncilPercent = (0, settings_1.devVotePercent)(prefs.devCouncilPercent);
            if (typeof prefs.devCouncilNoAi === 'boolean')
                settings_1.settings.devCouncilNoAi = prefs.devCouncilNoAi;
        }
        else {
            settings_1.settings.devCouncilVote = 'normal';
            settings_1.settings.devCouncilNoAi = false;
        }
        (0, safe_send_1.safeSend)(council_1.council.win, 'devCouncilPrefs', {
            devMode: settings_1.settings.devMode,
            devCouncilVote: settings_1.settings.devCouncilVote,
            devCouncilPercent: settings_1.settings.devCouncilPercent,
            devCouncilNoAi: settings_1.settings.devCouncilNoAi,
        });
        if (typeof prefs.autoHide === 'boolean')
            settings_1.settings.autoHide = prefs.autoHide;
        if (typeof prefs.fx === 'boolean')
            settings_1.settings.fx = prefs.fx;
        if (prefs.dock === 'off' || prefs.dock === 'left' || prefs.dock === 'right') {
            settings_1.settings.dock = prefs.dock;
            settings_1.settings.dockPos = null;
            previewDockPos = null;
        }
        if (typeof prefs.dockLock === 'boolean') {
            settings_1.settings.dockLock = prefs.dockLock;
            if (settings_1.settings.dockLock) {
                freePlaced = false;
            }
            else if (exports.wins.win && !exports.wins.win.isDestroyed()) {
                const b = exports.wins.win.getBounds();
                if (overlayPreviewActive)
                    previewFreePos = { x: b.x, y: b.y };
                else
                    settings_1.settings.freePos = { x: b.x, y: b.y };
            }
        }
        if (prefs.resetPos) {
            settings_1.settings.dockPos = null;
            settings_1.settings.launcherPos = null;
            settings_1.settings.freePos = null;
            settings_1.settings.radioDockPos = null;
            previewDockPos = null;
            previewLauncherPos = null;
            previewFreePos = null;
        }
        if (typeof prefs.autoScale === 'boolean')
            settings_1.settings.autoScale = prefs.autoScale;
        let hotkeyError = null;
        if (prefs.hotkey !== undefined) {
            settings_1.settings.hotkey = (0, overlayPrefs_1.sanitizeHotkey)(prefs.hotkey, settings_1.settings.hotkey);
            hotkeyError = registerHotkey();
        }
        if (typeof prefs.fadeEnabled === 'boolean')
            settings_1.settings.fadeEnabled = prefs.fadeEnabled;
        if (prefs.fadeOpacity !== undefined)
            settings_1.settings.fadeOpacity = (0, overlayPrefs_1.clampFade)(prefs.fadeOpacity, settings_1.settings.fadeOpacity);
        if (typeof prefs.notify === 'boolean')
            settings_1.settings.notify = prefs.notify;
        if (typeof prefs.autoOpenOnTalk === 'boolean')
            settings_1.settings.autoOpenOnTalk = prefs.autoOpenOnTalk;
        if (prefs.uiScale !== undefined)
            settings_1.settings.uiScale = (0, gameWindow_1.layoutScale)(null, Number(prefs.uiScale), false);
        if (prefs.uiScale !== undefined || typeof prefs.autoScale === 'boolean')
            applyScale(true);
        if (!settings_1.settings.autoHide && exports.wins.win && !exports.wins.win.isVisible())
            exports.wins.win.showInactive();
        (0, settings_1.saveSettings)();
        return { ...settings_1.settings, hotkeyError };
    });
    // 색 테마
    electron_1.ipcMain.handle('setTheme', async (_e, v) => {
        if (v.theme !== undefined)
            settings_1.settings.theme = (0, theme_1.sanitizeTheme)(v.theme);
        if (v.custom !== undefined)
            settings_1.settings.custom = (0, theme_1.sanitizeCustom)(v.custom);
        (0, settings_1.saveSettings)();
        (0, safe_send_1.safeSend)(exports.wins.launcher, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(toast, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(council_1.council.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(gov_1.gov.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(banquet_app_1.banquet.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(mediation_app_2.mediation.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(summit_1.summit.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        if (exports.wins.setWin && !exports.wins.setWin.isDestroyed())
            (0, safe_send_1.safeSend)(exports.wins.setWin, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        if (radio_app_1.radio.win && !radio_app_1.radio.win.isDestroyed())
            (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom });
        (0, safe_send_1.safeSend)(speech_app_1.speech.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // A-22: 연설 창도 테마를 따라감
        (0, safe_send_1.safeSend)(fleet_app_1.fleet.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // 함대 사령부 창
        (0, safe_send_1.safeSend)(office_app_1.office.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // 집무실 창
        (0, safe_send_1.safeSend)(vassal_app_1.vassal.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // 종속국 통신 채널 창
        (0, safe_send_1.safeSend)(press_app_1.press.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // 언론사 인터뷰 창
        (0, safe_send_1.safeSend)(govreport_1.govReport.win, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // A-26 총독 보고 창
        (0, safe_send_1.safeSend)(media_1.media.paperWin, 'theme', { theme: settings_1.settings.theme, custom: settings_1.settings.custom }); // A-22 2단계: 신문 지면 모양(자동)
        return settings_1.settings;
    });
    electron_1.ipcMain.handle('gateInfo', async () => ({ blocked: gateBlocked(), enabled: settings_1.settings.pauseGate, aiEveryMin: settings_1.settings.aiEveryMin, gossipOn: settings_1.settings.gossipOn, extraOn: settings_1.settings.extraOn, extraMax: settings_1.settings.extraMax, papers: settings_1.settings.papersOn, paperNames: galnews_1.PAPERS.map((_, i) => (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, i).name) }));
    electron_1.ipcMain.handle('gateAck', async () => { runAck = true; runAckAt = Date.now(); pushGate(); return true; });
    electron_1.ipcMain.handle('gateSet', async (_e, a) => {
        if (typeof a?.enabled === 'boolean')
            settings_1.settings.pauseGate = a.enabled;
        if (typeof a?.gossipOn === 'boolean')
            settings_1.settings.gossipOn = a.gossipOn;
        if (typeof a?.extraOn === 'boolean')
            settings_1.settings.extraOn = a.extraOn;
        {
            const x = Number(a?.extraMax);
            if (a?.extraMax !== undefined && Number.isFinite(x) && x >= 1 && x <= 12)
                settings_1.settings.extraMax = Math.round(x);
        }
        if (Array.isArray(a?.papers))
            settings_1.settings.papersOn = galnews_1.PAPERS.map((_, i) => a.papers[i] !== false);
        const n = Number(a?.aiEveryMin);
        if (Number.isFinite(n) && n >= 1 && n <= 30) {
            settings_1.settings.aiEveryMin = Math.round(n);
            (0, mail_app_1.restartAiTimer)();
        }
        (0, settings_1.saveSettings)();
        pushGate();
        return { blocked: gateBlocked(), enabled: settings_1.settings.pauseGate, aiEveryMin: settings_1.settings.aiEveryMin, gossipOn: settings_1.settings.gossipOn, extraOn: settings_1.settings.extraOn, extraMax: settings_1.settings.extraMax, papers: settings_1.settings.papersOn, paperNames: galnews_1.PAPERS.map((_, i) => (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, i).name) };
    });
    electron_1.ipcMain.handle('winCtl', async (_e, what) => { if (what === 'setclose')
        closeSettings();
    else
        setAppOpen(false); return true; }); // 최소화와 닫기 모두 아이콘으로 접는다(진짜 최소화는 상태 감시가 곧바로 다시 띄운다)
    // 아이콘 창(런처)
    electron_1.ipcMain.handle('launcherClick', async (_e, act) => {
        if (act === 'office') {
            if (office_app_1.office.win && !office_app_1.office.win.isDestroyed())
                (0, office_app_1.closeOffice)();
            else
                (0, office_app_1.openOffice)();
            return true;
        }
        if (act === 'fleet') {
            if (fleet_app_1.fleet.win && !fleet_app_1.fleet.win.isDestroyed())
                (0, fleet_app_1.closeFleet)();
            else
                (0, fleet_app_1.openFleet)();
            return true;
        }
        if (act === 'vassal') {
            if (vassal_app_1.vassal.win && !vassal_app_1.vassal.win.isDestroyed())
                (0, vassal_app_1.closeVassal)();
            else
                (0, vassal_app_1.openVassal)();
            return true;
        }
        if (act === 'radio') {
            if (radio_app_1.radio.on)
                (0, radio_app_1.setRadio)(false);
            else
                (0, radio_app_1.setRadio)(true);
            return true;
        }
        if (act === 'gov') {
            if (gov_1.gov.win && !gov_1.gov.win.isDestroyed())
                (0, gov_1.closeGov)();
            else
                (0, gov_1.openGov)();
            return true;
        }
        if (act === 'paper') {
            (0, media_1.openPaper)();
            return true;
        }
        if (act === 'toggle') {
            const opening = !exports.wins.appOpen;
            if (opening)
                (0, safe_send_1.safeSend)(exports.wins.win, 'pane', 'contacts');
            setAppOpen(opening);
            return true;
        }
        if (act === 'set' || act === 'tools') {
            openSettings();
            return true;
        }
        return false;
    });
    electron_1.ipcMain.handle('launcherState', async () => ({ open: exports.wins.appOpen, unread: mail_app_1.mail.inbox.filter((l) => !l.read).length, theme: settings_1.settings.theme, custom: settings_1.settings.custom, fx: settings_1.settings.fx, dev: settings_1.settings.devMode }));
    electron_1.ipcMain.handle('toastClick', async (_e, kind) => { hideToast(); if (kind === 'declare') {
        (0, declare_app_1.openDeclare)();
        return true;
    } if (kind === 'statement') {
        (0, condemn_app_1.openForeignStatement)();
        return true;
    } if (kind === 'debate') {
        void (0, debate_app_1.playDebate)();
        return true;
    } if (kind === 'scandal') {
        (0, scandal_app_1.openScandal)();
        return true;
    } if (kind === 'hearing') {
        (0, espionage_app_1.showHearing)();
        return true;
    } if (kind === 'speech') {
        (0, speech_app_1.openSpeech)();
        return true;
    } if (kind === 'press') {
        (0, press_app_1.openPress)();
        return true;
    } if (kind === 'vassal') {
        (0, vassal_app_1.openVassal)();
        return true;
    } if (kind === 'fleet') {
        (0, fleet_app_1.openFleet)();
        return true;
    } if (kind === 'office') {
        (0, office_app_1.openOffice)(office_app_1.office.toastGo);
        return true;
    } if (kind === 'news') {
        (0, media_1.openPaper)();
        return true;
    } if (kind === 'gov') {
        (0, govreport_1.openGovReport)();
        return true;
    } if (kind === 'faction') {
        if ((0, faction_app_1.openPendingFactionMeeting)())
            return true;
    } if (kind === 'mediation') {
        (0, mediation_app_1.openPendingMediation)();
        return true;
    } setAppOpen(true); if (kind === 'letter')
        (0, safe_send_1.safeSend)(exports.wins.win, 'showInbox'); return true; });
    electron_1.ipcMain.handle('toastClose', async () => { hideToast(); return true; });
    electron_1.ipcMain.handle('testToast', async () => { notify({ kind: 'letter', title: (0, settings_ui_1.pick)('알림 시험', 'Notification test'), body: (0, settings_ui_1.pick)('이 카드는 편지나 안건이 왔을 때 뜹니다. 누르면 통신 단말기가 열립니다.', 'This card appears when a letter or resolution arrives. Click it to open the comms terminal.') }); return true; });
    electron_1.ipcMain.handle('toastAction', async () => { hideToast(); if (toastActionKind === 'declare') {
        (0, declare_app_1.openDeclare)();
        return true;
    } if (toastActionKind === 'statement') {
        (0, condemn_app_1.openForeignStatement)();
        return true;
    } if (toastActionKind === 'debate') {
        void (0, debate_app_1.playDebate)();
        return true;
    } if (toastActionKind === 'scandal') {
        (0, scandal_app_1.openScandal)();
        return true;
    } if (toastActionKind === 'hearing') {
        (0, espionage_app_1.showHearing)();
        return true;
    } if (toastActionKind === 'speech')
        (0, speech_app_1.openSpeech)();
    else if (toastActionKind === 'press')
        (0, press_app_1.openPress)();
    else if (toastActionKind === 'vassal')
        (0, vassal_app_1.openVassal)();
    else if (toastActionKind === 'fleet')
        (0, fleet_app_1.openFleet)();
    else if (toastActionKind === 'office')
        (0, office_app_1.openOffice)(office_app_1.office.toastGo);
    else if (toastActionKind === 'gov')
        (0, govreport_1.openGovReport)();
    else if (toastActionKind === 'faction')
        (0, faction_app_1.openPendingFactionMeeting)();
    else if (toastActionKind === 'mediation')
        (0, mediation_app_1.openPendingMediation)();
    else if (council_1.council.pendingAgenda)
        void (0, council_1.openCouncilLive)(); return true; });
    electron_1.ipcMain.handle('launcherTip', async (_e, label, y, h) => { if (typeof label === 'string' && label)
        showTip(label.slice(0, 40), Number(y) || 0, Number(h) || 38);
    else
        hideTip(); return true; });
    electron_1.ipcMain.handle('quitApp', async () => { quitAll(); return true; });
}
//# sourceMappingURL=windows.js.map
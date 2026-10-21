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
exports.pathsInfo = exports.environmentInfo = void 0;
exports.registerEnvironment = registerEnvironment;
// A-00b 4번: 경로 설정(게임 사용자 폴더·연결 모드 폴더·세이브 폴더·게임 설치 폴더)과 모드 호환 팩 화면의 IPC 12개.
// 2026-10-15 main.ts whenReady 안에서 옮김(동작 변경 없음). environmentInfo()는 HELLO 처리에서도 쓴다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const environment_paths_1 = require("../environment-paths");
const flags_1 = require("../flags");
const aiclient_1 = require("../aiclient");
const settings_1 = require("../app/settings");
const game_link_1 = require("../app/game-link");
const ctx_1 = require("../app/ctx");
const version_check_1 = require("../version-check");
const game_display_1 = require("../game-display");
const settings_ui_1 = require("./settings-ui");
// ---- 경로(세이브 폴더 / 게임 폴더) ----
const environmentInfo = () => {
    const env = (0, environment_paths_1.resolveEnvironment)(settings_1.settings);
    let latestSave = null;
    try {
        latestSave = ctx_1.ctx.flagProv.latestSave();
    }
    catch { /* no saves */ }
    let fileVer = null;
    try {
        if (env.mod)
            fileVer = (0, version_check_1.descriptorVersion)(fs.readFileSync(path.join(env.mod, 'descriptor.mod'), 'utf8'));
    }
    catch { /* descriptor.mod 없음 */ }
    const versionInfo = (0, version_check_1.versionCheck)(electron_1.app.getVersion(), game_link_1.link.runtimeMod?.version, fileVer);
    const display = env.userExists ? (0, game_display_1.readDisplayMode)(env.userDir) : null; // 게임 화면 모드(독점 전체화면이면 경고)
    const hints = (0, environment_paths_1.environmentHints)(env);
    if (display === 'exclusive')
        hints.push({ level: 'warn', text: game_display_1.DISPLAY_HINT_KO });
    return { ...env, hints, display, versionCheck: versionInfo, setupDone: settings_1.settings.setupDone, latestSave, appVersion: electron_1.app.getVersion(), protocol: game_link_1.CONNECTION_PROTOCOL, runtime: game_link_1.link.runtimeMod, note: null };
};
exports.environmentInfo = environmentInfo;
const pathsInfo = () => {
    let latest = null;
    try {
        latest = ctx_1.ctx.flagProv.latestSave();
    }
    catch { /* 없음 */ }
    return { saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, latestSave: latest, gameFound: ctx_1.ctx.flagProv.game(), autoGame: (0, flags_1.findGameDir)() };
};
exports.pathsInfo = pathsInfo;
function registerEnvironment() {
    electron_1.ipcMain.handle('compatibilityInfo', async () => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: (0, settings_ui_1.pick)('개발자 모드에서 확인할 수 있습니다.', 'Available in developer mode.') };
        return {
            ok: true,
            ...ctx_1.ctx.modCompatibility.diagnostics(),
            save: ctx_1.ctx.flagProv.diagnostics(),
            contacts: ctx_1.ctx.terminal.items.map((c) => ({
                ...c,
                ...ctx_1.ctx.modCompatibility.policy(c.type),
                ethics: ctx_1.ctx.adoptedEthics(c.idx),
                lore: ctx_1.ctx.modCompatibility.empire(c.name)?.lore
                    ? 'compatibility override'
                    : ctx_1.ctx.flagProv.bioFor(c.idx)
                        ? 'save species biography'
                        : ctx_1.ctx.modCompatibility.lore(c.name)?.source || 'unknown',
                flag: ctx_1.ctx.flagUrlFor(c.idx) ? 'available' : 'missing',
            })),
            player: { idx: ctx_1.ctx.playerIdx, ethics: ctx_1.ctx.adoptedEthics(ctx_1.ctx.playerIdx) },
        };
    });
    electron_1.ipcMain.handle('compatibilityReload', async () => {
        if (!settings_1.settings.devMode)
            return { ok: false };
        ctx_1.ctx.modCompatibility.invalidate();
        ctx_1.ctx.modCompatibility.clearLive();
        ctx_1.ctx.flagProv.configure({ saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, roots: (0, environment_paths_1.environmentSaveRoots)(settings_1.settings.userDir) });
        ctx_1.ctx.toUi('contacts', ctx_1.ctx.terminalView());
        if (ctx_1.ctx.talk) {
            ctx_1.ctx.talk = ctx_1.ctx.withLore(ctx_1.ctx.talk);
            ctx_1.ctx.toUi('talk', ctx_1.ctx.talk);
        }
        return { ok: true };
    });
    electron_1.ipcMain.handle('compatibilityOpen', async () => {
        if (!settings_1.settings.devMode)
            return { ok: false };
        const folder = path.join(electron_1.app.getPath('userData'), 'compatibility');
        fs.mkdirSync(folder, { recursive: true });
        const example = path.join(folder, 'example.json.disabled');
        if (!fs.existsSync(example))
            fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', 'compatibility-example.json'), example);
        const readme = path.join(folder, 'README_KO.md');
        if (!fs.existsSync(readme))
            fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', 'compatibility-readme-ko.md'), readme);
        const giga = path.join(folder, 'gigastructures.json.disabled');
        if (!fs.existsSync(giga))
            fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', 'compatibility-gigastructures.json'), giga);
        const err = await electron_1.shell.openPath(folder);
        return { ok: !err, error: err };
    });
    electron_1.ipcMain.handle('environmentInfo', async () => (0, exports.environmentInfo)());
    // 게임 화면 모드를 테두리 없는 전체화면으로(2026-10-18). 게임이 켜져 있으면 끌 때 설정을 덮어쓰므로 꺼져 있을 때만.
    electron_1.ipcMain.handle('displayFix', async () => {
        if (ctx_1.ctx.gameRunning)
            return { ...(0, exports.environmentInfo)(), note: (0, settings_ui_1.pick)('게임이 켜져 있습니다. 스텔라리스를 끈 뒤 다시 눌러 주세요(켜진 채로 바꾸면 게임이 종료할 때 원래대로 덮어씁니다).', 'The game is running. Close Stellaris and press again (if changed while running, the game overwrites it on exit).') };
        const env = (0, environment_paths_1.resolveEnvironment)(settings_1.settings);
        try {
            const n = (0, game_display_1.fixDisplayMode)(env.userDir);
            return { ...(0, exports.environmentInfo)(), note: n ? (0, settings_ui_1.pick)('게임 화면 모드를 테두리 없는 전체화면으로 바꿨습니다. 다음에 게임을 켜면 적용됩니다(원본은 settings.txt.sllm-bak).', 'Switched the game display mode to borderless fullscreen. It applies the next time you start the game (original saved as settings.txt.sllm-bak).') : (0, settings_ui_1.pick)('이미 테두리 없는 전체화면입니다.', 'Already in borderless fullscreen.') };
        }
        catch (e) {
            return { ...(0, exports.environmentInfo)(), note: (0, settings_ui_1.pick)('게임 설정 파일을 고치지 못했습니다: ', 'Could not edit the game settings file: ') + e.message };
        }
    });
    electron_1.ipcMain.handle('environmentPick', async (_e, kind) => {
        if (ctx_1.ctx.pend || ctx_1.ctx.pending)
            return { ...(0, exports.environmentInfo)(), note: (0, settings_ui_1.pick)('진행 중인 통신과 제안을 마친 뒤 경로를 바꿔 주세요.', 'Finish the ongoing comms and proposals before changing paths.') };
        if (kind !== 'user' && kind !== 'mod')
            return { ...(0, exports.environmentInfo)(), note: (0, settings_ui_1.pick)('잘못된 경로 종류입니다.', 'Invalid path type.') };
        const r = await electron_1.dialog.showOpenDialog(ctx_1.ctx.win, { title: kind === 'user' ? (0, settings_ui_1.pick)('Stellaris 게임 사용자 폴더 선택 (logs / save games)', 'Choose the Stellaris user folder (logs / save games)') : (0, settings_ui_1.pick)('SLLM 연결 모드 폴더 선택', 'Choose the SLLM link mod folder'), properties: ['openDirectory'] });
        if (r.canceled || !r.filePaths[0])
            return (0, exports.environmentInfo)();
        const picked = r.filePaths[0];
        const dir = kind === 'mod' ? (0, environment_paths_1.normalizeModDir)(picked) : (0, environment_paths_1.normalizeUserDir)(picked);
        if (!dir)
            return { ...(0, exports.environmentInfo)(), note: kind === 'mod' ? (0, settings_ui_1.pick)('고른 폴더와 그 위·아래 폴더에서 SLLM 연결 모드 파일(common\\scripted_effects\\sllm_probe_effects.txt)을 찾지 못했습니다. 스팀 창작마당 구독을 마쳤다면 자동으로 찾으니 [자동 찾기]를 눌러 보세요.', 'Could not find the SLLM link mod file (common\\scripted_effects\\sllm_probe_effects.txt) in the chosen folder or above/below it. If you subscribed on the Steam Workshop it is found automatically — try [Auto-detect].') : (0, settings_ui_1.pick)('고른 폴더 근처에서 Stellaris 사용자 폴더(logs·save games·settings.txt가 있는 곳)를 찾지 못했습니다. 보통 "문서\\Paradox Interactive\\Stellaris"입니다. 게임을 한 번도 실행하지 않았다면 먼저 실행해 주세요.', 'Could not find the Stellaris user folder (with logs, save games and settings.txt) near the chosen folder. It is usually "Documents\\Paradox Interactive\\Stellaris". If you have never run the game, run it first.') };
        const moved = path.resolve(picked) !== dir;
        if (kind === 'user')
            settings_1.settings.userDir = dir;
        else
            settings_1.settings.modDir = dir;
        (0, settings_1.saveSettings)();
        ctx_1.ctx.applyEnvironment();
        ctx_1.ctx.toUi('images', ctx_1.ctx.imageState());
        return moved ? { ...(0, exports.environmentInfo)(), note: (0, settings_ui_1.pick)('고른 폴더 대신 올바른 폴더를 찾아 사용합니다: ', 'Using the correct folder found instead of the chosen one: ') + path.basename(dir) } : (0, exports.environmentInfo)();
    });
    electron_1.ipcMain.handle('environmentReset', async () => { if (ctx_1.ctx.pend || ctx_1.ctx.pending)
        return { ...(0, exports.environmentInfo)(), note: (0, settings_ui_1.pick)('진행 중인 통신과 제안을 마친 뒤 경로를 바꿔 주세요.', 'Finish the ongoing comms and proposals before changing paths.') }; settings_1.settings.userDir = null; settings_1.settings.modDir = null; (0, settings_1.saveSettings)(); ctx_1.ctx.applyEnvironment(); return (0, exports.environmentInfo)(); });
    electron_1.ipcMain.handle('environmentDone', async () => { settings_1.settings.setupDone = true; (0, settings_1.saveSettings)(); for (const w of electron_1.BrowserWindow.getAllWindows())
        w.webContents.send('environment', (0, exports.environmentInfo)()); return true; });
    electron_1.ipcMain.handle('environmentCheck', async () => {
        const notes = [];
        if (!ctx_1.ctx.gameRunning)
            notes.push((0, settings_ui_1.pick)('게임을 실행하고 세이브를 불러온 뒤 다시 확인하세요.', 'Start the game, load a save, then check again.'));
        else {
            const req = ++game_link_1.link.reqCounter;
            try {
                await ctx_1.ctx.terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_hello = { REQ = ' + req + ' } }', 'HELLO', req);
                notes.push(game_link_1.link.runtimeMod?.protocol === game_link_1.CONNECTION_PROTOCOL ? (0, settings_ui_1.pick)('게임 연결 규격 일치', 'Game link protocol matches') : (0, settings_ui_1.pick)('연결 모드 업데이트 필요', 'Link mod needs an update'));
            }
            catch (e) {
                notes.push(e.message);
            }
        }
        if (settings_1.settings.aiMode === 'player2') {
            try {
                await ctx_1.ctx.p2.health();
                notes.push((0, settings_ui_1.pick)('Player2 앱 응답 확인', 'Player2 app responded'));
            }
            catch (e) {
                notes.push((0, aiclient_1.redactKey)(e.message));
            }
        }
        else
            notes.push((0, settings_ui_1.pick)('개인 API 연결 선택됨. AI 연결 탭에서 응답 시험을 실행하세요.', 'Personal API connection selected. Run the response test in the AI connection tab.'));
        return { ...(0, exports.environmentInfo)(), note: notes.join(' · ') };
    });
    electron_1.ipcMain.handle('pathsInfo', async () => (0, exports.pathsInfo)());
    electron_1.ipcMain.handle('pickSaveDir', async () => {
        const r = await electron_1.dialog.showOpenDialog(ctx_1.ctx.win, { title: (0, settings_ui_1.pick)('스텔라리스 세이브 폴더 고르기 (save games)', 'Choose the Stellaris save folder (save games)'), properties: ['openDirectory'] });
        if (r.canceled || !r.filePaths[0])
            return { ...(0, exports.pathsInfo)(), note: null };
        const dir = (0, environment_paths_1.normalizeSaveDir)(r.filePaths[0]);
        if (!dir)
            return { ...(0, exports.pathsInfo)(), note: (0, settings_ui_1.pick)('이 폴더 근처에서 .sav 파일을 찾지 못했습니다. 세이브를 한 번 저장한 뒤 "save games" 폴더(또는 그 안의 제국 폴더)를 골라 주세요.', 'No .sav files near this folder. Save once, then choose the "save games" folder (or an empire folder inside it).') };
        settings_1.settings.saveDir = dir;
        (0, settings_1.saveSettings)();
        ctx_1.ctx.flagProv.configure({ saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, roots: (0, environment_paths_1.environmentSaveRoots)(settings_1.settings.userDir) });
        return { ...(0, exports.pathsInfo)(), note: null };
    });
    electron_1.ipcMain.handle('pickGameDir', async () => {
        const r = await electron_1.dialog.showOpenDialog(ctx_1.ctx.win, { title: (0, settings_ui_1.pick)('스텔라리스 설치 폴더 고르기 (Stellaris)', 'Choose the Stellaris install folder (Stellaris)'), properties: ['openDirectory'] });
        if (r.canceled || !r.filePaths[0])
            return { ...(0, exports.pathsInfo)(), note: null };
        const dir = (0, environment_paths_1.normalizeGameDir)(r.filePaths[0]);
        if (!dir)
            return { ...(0, exports.pathsInfo)(), note: (0, settings_ui_1.pick)('이 폴더 근처에서 flags\\colors.txt 를 찾지 못했습니다. 게임이 설치된 "Stellaris" 폴더(또는 Steam 라이브러리 폴더)를 골라 주세요.', 'Could not find flags\\colors.txt near this folder. Choose the "Stellaris" folder where the game is installed (or the Steam library folder).') };
        settings_1.settings.gameDir = dir;
        (0, settings_1.saveSettings)();
        ctx_1.ctx.flagProv.configure({ saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, roots: (0, environment_paths_1.environmentSaveRoots)(settings_1.settings.userDir) });
        return { ...(0, exports.pathsInfo)(), note: null };
    });
    electron_1.ipcMain.handle('clearPaths', async (_e, which) => {
        if (which === 'save' || which === 'all')
            settings_1.settings.saveDir = null;
        if (which === 'game' || which === 'all')
            settings_1.settings.gameDir = null;
        (0, settings_1.saveSettings)();
        ctx_1.ctx.flagProv.configure({ saveDir: settings_1.settings.saveDir, gameDir: settings_1.settings.gameDir, roots: (0, environment_paths_1.environmentSaveRoots)(settings_1.settings.userDir) });
        return { ...(0, exports.pathsInfo)(), note: null };
    });
}
//# sourceMappingURL=environment.js.map
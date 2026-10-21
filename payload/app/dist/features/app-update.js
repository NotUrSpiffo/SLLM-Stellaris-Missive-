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
exports.updateModDirs = updateModDirs;
exports.checkAppUpdate = checkAppUpdate;
exports.registerAppUpdate = registerAppUpdate;
// 창작마당 모드로 받은 앱 업데이트 알림(2026-10-18). 스팀이 구독 모드를 새로 받으면 그 안의 sllm_app_update/ 를 확인해
// "새 버전 … 업데이트할까요?" 를 묻고, 누르면 바뀐 파일만 교체한 뒤 앱을 다시 시작한다. 판정·교체는 ../app-update-core.ts.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const app_update_core_1 = require("../app-update-core");
const environment_paths_1 = require("../environment-paths");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const windows_1 = require("./windows");
const FIRST_CHECK_MS = 8000, RECHECK_MS = 20 * 60 * 1000;
let asked = '', busy = false; // 한 번 "나중에" 를 누른 버전은 앱을 다시 켤 때까지 묻지 않는다
/** 설치기로 설치한 앱에서만 켠다(개발 폴더는 bat 가 빌드·동기화한다). SLLM_UPDATE_DEV=1 이면 개발 폴더에서도 시험 가능. */
function enabled(appDir) {
    if (!fs.existsSync(path.join(appDir, app_update_core_1.PUBLIC_KEY_FILE)))
        return false;
    return process.env.SLLM_UPDATE_DEV === '1' || fs.existsSync(path.join(appDir, 'game-install-path.txt')) || fs.existsSync(path.join(appDir, 'SLLM-tester-installed.txt'));
}
/** 창작마당 구독본 + 문서 mod 폴더의 업로드 원본(sllm_missive). */
function updateModDirs() {
    return [...(0, environment_paths_1.connectionWorkshopCandidates)(), ...(0, environment_paths_1.userCandidates)().filter(Boolean).map((u) => path.join(u, 'mod', 'sllm_missive'))];
}
async function ask(r) {
    const cur = electron_1.app.getVersion(), ver = r.version, parent = windows_1.wins.win && !windows_1.wins.win.isDestroyed() ? windows_1.wins.win : undefined;
    const opts = (o) => parent ? electron_1.dialog.showMessageBox(parent, o) : electron_1.dialog.showMessageBox(o);
    if (r.kind === 'needs_installer') {
        await opts({ type: 'info', title: (0, settings_ui_1.pick)('SLLM 업데이트', 'SLLM update'), buttons: [(0, settings_ui_1.pick)('확인', 'OK')],
            message: (0, settings_ui_1.pick)(`새 버전 ${ver}이(가) 나왔습니다(지금 ${cur}).`, `A new version ${ver} is available (current ${cur}).`),
            detail: (0, settings_ui_1.pick)('이번 업데이트는 게임 연결 DLL이 바뀌어 앱 안에서 업데이트할 수 없습니다. 새 설치 프로그램을 받아 설치해 주세요. 대화 기록과 설정은 그대로 남습니다.', 'This update changes the game connection DLL, so it cannot be applied inside the app. Please download and run the new installer. Your chat history and settings are kept.') });
        return;
    }
    const res = await opts({ type: 'question', title: (0, settings_ui_1.pick)('SLLM 업데이트', 'SLLM update'), buttons: [(0, settings_ui_1.pick)('업데이트', 'Update'), (0, settings_ui_1.pick)('나중에', 'Later')], defaultId: 0, cancelId: 1,
        message: (0, settings_ui_1.pick)(`새 버전 ${ver}을(를) 설치할 수 있습니다(지금 ${cur}).`, `A new version ${ver} can be installed (current ${cur}).`),
        detail: (0, settings_ui_1.pick)('창작마당 모드와 함께 받은 앱 업데이트입니다. 업데이트하면 앱이 다시 시작됩니다. 대화 기록과 설정은 그대로 남습니다.', 'This app update came with the Workshop mod. The app restarts after updating. Your chat history and settings are kept.') });
    if (res.response !== 0)
        return;
    const appDir = electron_1.app.getAppPath();
    try {
        (0, app_update_core_1.applyUpdate)(appDir, r.bundleDir, r.changed, path.join(electron_1.app.getPath('userData'), 'update-backup'));
        (0, diagnostics_1.logDiagnostic)('info', 'app_update.applied', { from: cur, to: ver, files: r.changed.length });
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('error', 'app_update.failed', { from: cur, to: ver, error: String(e?.message || e) });
        await opts({ type: 'error', title: (0, settings_ui_1.pick)('SLLM 업데이트', 'SLLM update'), buttons: [(0, settings_ui_1.pick)('확인', 'OK')],
            message: (0, settings_ui_1.pick)('업데이트하지 못해 원래 파일로 되돌렸습니다.', 'The update failed, so the original files were restored.'),
            detail: (0, settings_ui_1.pick)('앱을 다시 켜면 다시 물어봅니다. 계속 실패하면 새 설치 프로그램을 받아 설치해 주세요.', 'You will be asked again next time the app starts. If it keeps failing, please install the new installer.') + '\n\n' + String(e?.message || e) });
        return;
    }
    await opts({ type: 'info', title: (0, settings_ui_1.pick)('SLLM 업데이트', 'SLLM update'), buttons: [(0, settings_ui_1.pick)('다시 시작', 'Restart')],
        message: (0, settings_ui_1.pick)(`${ver}(으)로 업데이트했습니다. 앱을 다시 시작합니다.`, `Updated to ${ver}. The app will restart.`) });
    electron_1.app.relaunch();
    electron_1.app.exit(0);
}
async function checkAppUpdate() {
    if (busy)
        return;
    const appDir = electron_1.app.getAppPath();
    if (!enabled(appDir))
        return;
    busy = true;
    try {
        const key = fs.readFileSync(path.join(appDir, app_update_core_1.PUBLIC_KEY_FILE), 'utf8');
        const r = (0, app_update_core_1.checkForUpdate)(appDir, electron_1.app.getVersion(), updateModDirs(), key);
        if (r.kind === 'none') {
            if (r.reason !== 'no bundle' && r.reason !== 'not newer')
                (0, diagnostics_1.logDiagnostic)('warn', 'app_update.skip', { reason: r.reason });
            return;
        }
        if (asked === r.version)
            return;
        asked = r.version;
        await ask(r);
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'app_update.check_failed', { error: String(e?.message || e) });
    }
    finally {
        busy = false;
    }
}
function registerAppUpdate() {
    setTimeout(() => { void checkAppUpdate(); }, FIRST_CHECK_MS);
    setInterval(() => { void checkAppUpdate(); }, RECHECK_MS).unref?.();
}
//# sourceMappingURL=app-update.js.map
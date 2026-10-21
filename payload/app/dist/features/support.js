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
exports.registerSupport = registerSupport;
// A-00b 4번: 버그 신고 로그 묶음(supportPrepare·supportPreview·supportExport·supportReveal).
// 2026-10-15 main.ts whenReady 안에서 옮김(동작 변경 없음). 빌드 지문은 dist 최상위 파일(main.js 등)이라 '..'을 붙였다.
const electron_1 = require("electron");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const support_bundle_1 = require("../support-bundle");
const diagnostics_1 = require("../diagnostics");
const environment_paths_1 = require("../environment-paths");
const settings_1 = require("../app/settings");
const game_link_1 = require("../app/game-link");
const radio_app_1 = require("./radio-app");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
const supportBundles = new support_bundle_1.SupportBundles(() => electron_1.app.getPath('userData'), () => ctx_1.ctx.GAME_LOG, () => {
    const active = settings_1.settings.aiConns.find(c => c.id === settings_1.settings.aiActive);
    let endpoint = '';
    try {
        endpoint = active ? new URL(active.baseUrl).origin : '';
    }
    catch { }
    const buildHashes = Object.fromEntries(['main.js', 'aiclient.js', 'diagnostics.js', 'support-bundle.js', 'mod-compat.js'].map(file => { try {
        return [file, (0, crypto_1.createHash)('sha256').update(fs.readFileSync(path.join(__dirname, '..', file))).digest('hex')];
    }
    catch {
        return [file, 'unavailable'];
    } }));
    const modHashes = Object.fromEntries([
        'descriptor.mod',
        'common/scripted_effects/sllm_probe_terminal.txt',
        'common/scripted_effects/sllm_probe_speech.txt',
        'common/scripted_effects/sllm_probe_compat.txt',
        'common/on_actions/sllm_probe_radio_on_actions.txt',
    ].map((file) => {
        try {
            return [
                file,
                ctx_1.ctx.MOD_DIR
                    ? (0, crypto_1.createHash)('sha256')
                        .update(fs.readFileSync(path.join(ctx_1.ctx.MOD_DIR, file)))
                        .digest('hex')
                    : 'unavailable',
            ];
        }
        catch {
            return [file, 'unavailable'];
        }
    }));
    return {
        buildHashes,
        modHashes,
        displays: electron_1.screen
            .getAllDisplays()
            .map((d) => ({ id: d.id, scale: d.scaleFactor, bounds: d.bounds, workArea: d.workArea, rotation: d.rotation })),
        app: {
            name: electron_1.app.getName(),
            version: electron_1.app.getVersion(),
            packaged: electron_1.app.isPackaged,
            locale: electron_1.app.getLocale(),
            uptimeSeconds: Math.round(process.uptime()),
        },
        connection: { protocol: game_link_1.CONNECTION_PROTOCOL, runtime: game_link_1.link.runtimeMod },
        environment: (() => { const e = (0, environment_paths_1.resolveEnvironment)(settings_1.settings); return { ...e, hints: (0, environment_paths_1.environmentHints)(e), tried: (0, environment_paths_1.environmentTried)() }; })(),
        watcher: ctx_1.ctx.watcher.status(),
        game: {
            running: ctx_1.ctx.gameRunning,
            front: ctx_1.ctx.gameFront,
            date: ctx_1.ctx.gameDate,
            sid: ctx_1.ctx.curSaveId,
            queuedConsole: game_link_1.link.queued,
            contacts: ctx_1.ctx.terminal.items.length,
            lastSignal: ctx_1.ctx.lastGameSignal,
            signalCounts: ctx_1.ctx.gameSignalCounts,
        },
        ai: { mode: settings_1.settings.aiMode, provider: active?.provider, model: active?.model, endpoint },
        preferences: {
            language: settings_1.settings.language,
            aiLanguage: settings_1.settings.aiLanguage,
            devMode: settings_1.settings.devMode,
            forceOverlay: settings_1.settings.forceOverlay,
            councilMode: settings_1.settings.councilMode,
            councilTurns: settings_1.settings.councilTurns,
            speechTurns: settings_1.settings.speechTurns,
            devCouncilVote: settings_1.settings.devCouncilVote,
            devCouncilPercent: settings_1.settings.devCouncilPercent,
            devCouncilNoAi: settings_1.settings.devCouncilNoAi,
            mailEnabled: settings_1.settings.mailEnabled,
            radioOn: radio_app_1.radio.on,
            uiScale: settings_1.settings.uiScale,
            autoScale: settings_1.settings.autoScale,
            dock: settings_1.settings.dock,
        },
        compatibility: ctx_1.ctx.modCompatibility.diagnostics(),
        save: ctx_1.ctx.flagProv.diagnostics(),
    };
});
function registerSupport() {
    electron_1.ipcMain.handle('supportPrepare', async (_event, input) => {
        try {
            for (const c of settings_1.settings.aiConns)
                (0, settings_1.getKey)(c.id);
            const report = supportBundles.prepare(input && typeof input === 'object' ? input : {});
            (0, diagnostics_1.logDiagnostic)('info', 'support.prepared', {
                reportId: report.id,
                files: report.files.map((f) => ({ name: f.name, bytes: f.bytes })),
                warnings: report.warnings,
            });
            return { ok: true, report };
        }
        catch (error) {
            (0, diagnostics_1.logDiagnostic)('error', 'support.prepare_failed', { error });
            return { ok: false, error: (0, diagnostics_1.sanitizeDiagnosticText)(error.message) };
        }
    });
    electron_1.ipcMain.handle('supportPreview', async (_event, id, name) => { try {
        return { ok: true, text: supportBundles.preview(String(id), String(name)) };
    }
    catch (error) {
        return { ok: false, error: (0, diagnostics_1.sanitizeDiagnosticText)(error.message) };
    } });
    electron_1.ipcMain.handle('supportExport', async (event, id) => {
        const report = supportBundles.get(String(id));
        if (!report)
            return { ok: false, error: (0, settings_ui_1.pick)('미리보기가 만료됐습니다. 로그 묶음을 다시 만들어 주세요.', 'The preview expired. Create the log bundle again.') };
        const options = { title: (0, settings_ui_1.pick)('버그 신고 로그 ZIP 저장', 'Save bug-report log ZIP'), defaultPath: path.join(electron_1.app.getPath('downloads'), 'SLLM-Logs-' + report.created.replace(/[:.]/g, '-') + '-' + report.id.slice(0, 8) + '.zip'), filters: [{ name: 'ZIP', extensions: ['zip'] }] }, owner = electron_1.BrowserWindow.fromWebContents(event.sender);
        const result = owner ? await electron_1.dialog.showSaveDialog(owner, options) : await electron_1.dialog.showSaveDialog(options);
        if (result.canceled || !result.filePath)
            return { ok: false, canceled: true };
        try {
            supportBundles.export(report.id, result.filePath);
            (0, diagnostics_1.logDiagnostic)('info', 'support.exported', { reportId: report.id, path: result.filePath });
            return { ok: true, path: result.filePath };
        }
        catch (error) {
            (0, diagnostics_1.logDiagnostic)('error', 'support.export_failed', { error });
            return { ok: false, error: (0, diagnostics_1.sanitizeDiagnosticText)(error.message) };
        }
    });
    electron_1.ipcMain.handle('supportReveal', async (_event, id) => { const file = supportBundles.exported(String(id)); if (!file)
        return false; electron_1.shell.showItemInFolder(file); return true; });
}
//# sourceMappingURL=support.js.map
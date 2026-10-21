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
exports.registerEffectVerifier = registerEffectVerifier;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const effect_verification_1 = require("../effect-verification");
const effect_verified_1 = require("../effect-verified");
const settings_1 = require("../app/settings");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const terminal_1 = require("./terminal");
const log_router_1 = require("../app/log-router");
const gamestate_app_1 = require("./gamestate-app");
const safe_send_1 = require("../safe-send");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
let win = null, busy = false, stop = false;
let rows = [], reportPath = '', runId = '';
const lab = (e) => ({ ...e, label: (0, settings_ui_1.pick)(e.label, e.labelEn ?? e.label) }); // 효과 이름 한/영(2026-10-19)
const view = () => ({ busy, rows: rows.map(lab), reportPath, runId, effects: effect_verification_1.VERIFY_EFFECTS.filter(e => !effect_verified_1.ATTACHMENT_VERIFIED_IDS.has(e.id)).map(lab), verifiedCount: effect_verified_1.ATTACHMENT_VERIFIED_IDS.size, targets: ctx_1.ctx.terminal.items.filter(c => c.type === 'default'), sid: ctx_1.ctx.curSaveId, date: ctx_1.ctx.gameDate });
const push = () => (0, safe_send_1.safeSend)(win, 'effectVerifyState', view());
const permitted = (event) => settings_1.settings.devMode && event.sender === win?.webContents;
function registerEffectVerifier(router) {
    router.on(log_router_1.SLOT.EFFECT_VERIFY, 'effect-verify', m => { if (m.kind === 'VERIFY_EFFECT')
        terminal_1.terminalReplies.get('VERIFY_EFFECT:' + m.kv.req)?.(m); });
    electron_1.ipcMain.handle('devEffects', () => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: (0, settings_ui_1.pick)('개발자 모드에서만 열 수 있습니다.', 'Available only in developer mode.') };
        if (win && !win.isDestroyed()) {
            win.show();
            win.focus();
            return { ok: true };
        }
        const a = electron_1.screen.getPrimaryDisplay().workArea;
        win = new electron_1.BrowserWindow({ width: Math.min(1150, a.width), height: Math.min(850, a.height), minWidth: 720, minHeight: 500, backgroundColor: '#0b1820', webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
        void win.loadFile(path.join(__dirname, '..', '..', 'ui', 'effect-verifier.html'));
        win.webContents.once('did-finish-load', push);
        win.on('closed', () => { win = null; stop = true; });
        return { ok: true };
    });
    electron_1.ipcMain.handle('effectVerifyState', () => view());
    electron_1.ipcMain.handle('effectVerifyStop', event => { if (permitted(event))
        stop = true; return true; });
    electron_1.ipcMain.handle('effectVerifyReport', event => { if (permitted(event) && reportPath && fs.existsSync(reportPath))
        electron_1.shell.showItemInFolder(reportPath); return true; });
    electron_1.ipcMain.handle('effectVerifyRun', async (event, input) => {
        if (!permitted(event) || busy)
            return { ok: false, error: (0, settings_ui_1.pick)('검증 창과 개발자 모드를 확인하세요.', 'Check the verification window and developer mode.') };
        const v = input;
        if (!v?.saved || !Array.isArray(v.ids) || !v.ids.length || v.ids.length > effect_verification_1.VERIFY_EFFECTS.length)
            return { ok: false, error: (0, settings_ui_1.pick)('검증 항목과 테스트 세이브 저장 여부를 확인하세요.', 'Check the selected effects and that you saved a test save.') };
        const ids = v.ids;
        const selected = effect_verification_1.VERIFY_EFFECTS.filter(e => ids.includes(e.id));
        if (ids.length !== selected.length || new Set(ids).size !== selected.length)
            return { ok: false, error: (0, settings_ui_1.pick)('알 수 없거나 중복된 검증 항목입니다.', 'Unknown or duplicate effects.') };
        if (!ctx_1.ctx.gameRunning || !game_link_1.link.sessionReady || !/^\d+$/.test(ctx_1.ctx.curSaveId))
            return { ok: false, error: (0, settings_ui_1.pick)('게임과 연결 모드를 먼저 연결하세요.', 'Connect the game and the link mod first.') };
        const sid = ctx_1.ctx.curSaveId, epoch = game_link_1.link.epoch, target = Number(v.target) || 0;
        if (target !== 0 && !ctx_1.ctx.terminal.items.some(c => c.idx === target && c.type === 'default'))
            return { ok: false, error: (0, settings_ui_1.pick)('현재 세이브의 대상 제국을 선택하세요.', 'Choose a target empire from the current save.') };
        const snap = gamestate_app_1.gameState.last;
        const fid = snap?.sid === sid ? Number(snap.factions.find(f => f.fid)?.fid) || 0 : 0;
        const dir = path.join(electron_1.app.getPath('userData'), 'effect-verification');
        fs.mkdirSync(dir, { recursive: true });
        runId = new Date().toISOString().replace(/[:.]/g, '-');
        reportPath = path.join(dir, runId + '.json');
        rows = selected.map(e => ({ ...e, status: 'waiting' }));
        busy = true;
        stop = false;
        push();
        const errorStart = (() => { try {
            return fs.statSync(path.join(path.dirname(ctx_1.ctx.GAME_LOG), 'error.log')).size;
        }
        catch {
            return 0;
        } })();
        const persist = () => { const tmp = reportPath + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ runId, sid, epoch, date: ctx_1.ctx.gameDate, rows, limits: '부착·제거 검사. 생산량·기간은 별도 검증. 첩보는 시험 정의이며 자동 게임 연동 아님.' }, null, 2)); fs.renameSync(tmp, reportPath); };
        try {
            for (const row of rows) {
                if (stop || !settings_1.settings.devMode || ctx_1.ctx.curSaveId !== sid || game_link_1.link.epoch !== epoch) {
                    row.status = 'cancelled';
                    continue;
                }
                const actor = row.scope === 'faction' ? fid : target;
                if (row.scope !== 'country' && !actor) {
                    row.status = 'no_target';
                    push();
                    persist();
                    continue;
                }
                row.status = 'running';
                row.req = ++game_link_1.link.reqCounter;
                push();
                persist();
                try {
                    const command = (0, effect_verification_1.verificationCommand)(row, row.req, sid, actor);
                    const m = await (0, terminal_1.terminalRequest)(command, 'VERIFY_EFFECT', row.req);
                    if (ctx_1.ctx.curSaveId !== sid || game_link_1.link.epoch !== epoch || m.kv.sid !== sid || m.kv.id !== row.id)
                        throw new Error((0, settings_ui_1.pick)('세이브 또는 검증 대상이 바뀌었습니다.', 'The save or the verification target changed.'));
                    const statuses = ['existing', 'attached_removed', 'cleanup_failed', 'attach_failed', 'no_target'];
                    row.status = statuses.includes(m.kv.status) ? m.kv.status : 'unknown';
                    row.receipt = m.kv;
                    if (row.scope === 'opinion' && m.kv.before !== undefined) {
                        row.delta = Number(m.kv.after) - Number(m.kv.before);
                        row.numericConfirmed = row.delta === row.expected;
                        row.restored = Number(m.kv.restored) === Number(m.kv.before);
                    }
                    (0, diagnostics_1.logDiagnostic)('info', 'effect.verify.result', { id: row.id, req: row.req, status: row.status });
                    if (row.status === 'cleanup_failed' || row.status === 'unknown')
                        stop = true;
                }
                catch (e) {
                    row.status = 'unknown';
                    row.error = String(e);
                    stop = true;
                }
                persist();
                push();
            }
        }
        finally {
            busy = false;
            try {
                const f = path.join(path.dirname(ctx_1.ctx.GAME_LOG), 'error.log'), buf = fs.readFileSync(f);
                const start = buf.length >= errorStart ? errorStart : 0;
                fs.writeFileSync(reportPath.replace(/\.json$/, '.error.log'), buf.subarray(start));
            }
            catch { }
            persist();
            push();
        }
        return { ok: true, reportPath };
    });
}
//# sourceMappingURL=effect-verifier.js.map
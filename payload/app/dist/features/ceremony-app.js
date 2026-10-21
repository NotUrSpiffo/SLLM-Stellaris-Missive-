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
exports.MAX_CEREMONY_IMAGE = exports.CEREMONY_IMAGES = void 0;
exports.ceremonyImages = ceremonyImages;
exports.ceremonyOpen = ceremonyOpen;
exports.ceremonyClose = ceremonyClose;
exports.registerCeremony = registerCeremony;
// 출정 의식(2026-10-20 알파 10): 게임 화면을 덮는 전체화면 창에 복무신조가 아래에서 위로 올라가고 낭독 음성이 흐른다.
// 화면: ui/ceremony.html. 복무신조·음량·연출 설정은 features/music-app.ts(sllm_music.json). 그림은 앱 데이터 ceremony/ 폴더(march·speech·fleet, 4K 까지).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const music_app_1 = require("./music-app");
const log_router_1 = require("../app/log-router");
const game_link_1 = require("../app/game-link");
const terminal_1 = require("./terminal");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
exports.CEREMONY_IMAGES = ['march', 'speech', 'fleet'];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp'];
exports.MAX_CEREMONY_IMAGE = 48 * 1024 * 1024; // 4K png 도 넉넉히
const dir = () => path.join(electron_1.app.getPath('userData'), 'ceremony');
/** 그림 폴더에서 march/speech/fleet 를 찾는다(확장자는 png·jpg·jpeg·webp, 48MB 까지). */
function ceremonyImages() {
    const out = {};
    const bundled = path.join(__dirname, '..', '..', 'ui', 'assets', 'ceremony');
    for (const k of exports.CEREMONY_IMAGES) {
        for (const folder of [dir(), bundled]) {
            for (const ext of IMG_EXT) {
                const f = path.join(folder, `${k}.${ext}`);
                try {
                    const st = fs.statSync(f);
                    if (st.isFile() && st.size > 0 && st.size <= exports.MAX_CEREMONY_IMAGE) {
                        out[k] = (0, url_1.pathToFileURL)(f).href;
                        break;
                    }
                }
                catch { /* next candidate */ }
            }
            if (out[k])
                break;
        }
    }
    return out;
}
let win = null;
let address = null;
let onDone = null;
function ceremonyOpen(declaration, done) {
    if (!declaration.text.trim())
        return { ok: false, error: L('선언문 본문이 없습니다.', 'The declaration is empty.') };
    if (win && !win.isDestroyed()) {
        win.focus();
        return { ok: false, error: L('선언문을 발표 중입니다.', 'A declaration is already being presented.') };
    }
    address = { ...declaration, sid: ctx_1.ctx.curSaveId, epoch: game_link_1.link.epoch };
    onDone = done ?? null;
    // 게임이 있는 화면 전체(작업 표시줄 포함)를 덮는다.
    let area = ctx_1.ctx.gameDip ? electron_1.screen.getDisplayMatching(ctx_1.ctx.gameDip).bounds : electron_1.screen.getPrimaryDisplay().bounds;
    if (declaration.kind) {
        const office = electron_1.BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && /[/\\]office\.html(?:[?#]|$)/.test(w.webContents.getURL()));
        if (office)
            area = office.getBounds();
        else {
            const width = Math.min(1360, Math.round(area.width * .86)), height = Math.min(900, Math.round(area.height * .9));
            area = { x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height };
        }
    }
    win = new electron_1.BrowserWindow({ x: area.x, y: area.y, width: area.width, height: area.height, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, show: false, backgroundColor: '#000000', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), backgroundThrottling: false } });
    win.setAlwaysOnTop(true, 'screen-saver', 2);
    win.setMenuBarVisibility(false);
    void win.loadFile(path.join(__dirname, '..', '..', 'ui', declaration.kind ? 'national-ceremony.html' : 'ceremony.html'));
    win.once('ready-to-show', () => { win?.show(); win?.focus(); });
    win.on('closed', () => { win = null; address = null; const f = onDone; onDone = null; if (f)
        f(true); });
    (0, diagnostics_1.logDiagnostic)('info', 'declaration.presentation', { lines: declaration.text.split('\n').filter(x => x.trim()).length });
    return { ok: true };
}
function ceremonyClose() { if (win && !win.isDestroyed())
    win.close(); }
const rosterRequests = new Map();
async function departureFleets() {
    const sid = ctx_1.ctx.curSaveId, epoch = game_link_1.link.epoch;
    if (!ctx_1.ctx.gameRunning || !sid || !Number.isSafeInteger(ctx_1.ctx.playerIdx))
        return [];
    const req = ++game_link_1.link.reqCounter;
    const entry = { sid, rows: [] };
    rosterRequests.set(req, entry);
    // Read only: own mobile military fleets, including military-special classes; never civilian ships or transports.
    const body = `every_owned_fleet = { limit = { is_mobile = yes OR = { is_ship_class = shipclass_military is_ship_class = shipclass_military_special } } if = { limit = { exists = leader } leader = { log = "SLLM:CERFLEET/;/req=${req}/;/sid=[Owner.sllm_save_id]/;/name=[Prev.GetName]/;/admiral=[This.GetName]" } } else = { log = "SLLM:CERFLEET/;/req=${req}/;/sid=[Owner.sllm_save_id]/;/name=[This.GetName]" } } log = "SLLM:CERFLEET_END/;/req=${req}/;/sid=[This.sllm_save_id]"`;
    try {
        const m = await (0, terminal_1.terminalRequest)(`effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_idx value = ${ctx_1.ctx.playerIdx} } } ${body} }`, 'CERFLEET_END', req);
        return ctx_1.ctx.curSaveId === sid && game_link_1.link.epoch === epoch && m.kv.sid === sid ? entry.rows : [];
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'ceremony.fleet_read_failed', { error: String(e) });
        return [];
    }
    finally {
        rosterRequests.delete(req);
    }
}
function registerCeremony(router) {
    router.on(log_router_1.SLOT.CEREMONY, 'ceremony:fleets', (m) => {
        if (m.kind !== 'CERFLEET' && m.kind !== 'CERFLEET_END')
            return;
        const entry = rosterRequests.get(Number(m.kv.req));
        if (!entry || entry.sid !== ctx_1.ctx.curSaveId || m.kv.sid !== entry.sid)
            return;
        if (m.kind === 'CERFLEET_END') {
            terminal_1.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
            return;
        }
        const name = (m.kv.name || '').trim();
        if (name && !name.includes('['))
            entry.rows.push({ name: name.slice(0, 240), admiral: (m.kv.admiral || '').includes('[') ? '' : (m.kv.admiral || '').slice(0, 160) });
    });
    electron_1.ipcMain.handle('ceremonyData', async () => {
        const current = address, activeWindow = win;
        if (!current || current.sid !== ctx_1.ctx.curSaveId || current.epoch !== game_link_1.link.epoch)
            return null;
        const fleets = current.fleets === false ? [] : await departureFleets();
        if (address !== current || current.sid !== ctx_1.ctx.curSaveId || current.epoch !== game_link_1.link.epoch || win !== activeWindow || !win || win.isDestroyed())
            return null;
        const v = (0, music_app_1.musicView)(), fx = (0, music_app_1.musicCeremonyFx)();
        const lines = current.text.split('\n').map(x => x.trim()).filter(Boolean);
        const backdrop = current.kind ? (0, url_1.pathToFileURL)(path.join(__dirname, '..', '..', 'ui', 'assets', 'ceremony', current.kind + '-v1.png')).href : '';
        return { kind: current.kind, backdrop, title: current.title, lines, fleets, salute: !!current.salute, notice: current.notice, audio: v.tracks[current.track || 'march']?.url || '', volume: v.volume, flag: ctx_1.ctx.flagUrlFor(ctx_1.ctx.playerIdx) ?? '', images: ceremonyImages(), darkness: fx.darkness, embers: fx.embers, drone: false, persp: fx.persp };
    });
    electron_1.ipcMain.handle('ceremonyDone', async (_e, early) => { const f = onDone; onDone = null; if (win && !win.isDestroyed())
        win.close(); if (f)
        f(!!early); return true; });
    electron_1.ipcMain.handle('ceremonyImages', async () => { const im = ceremonyImages(); return { dir: dir(), march: !!im.march, speech: !!im.speech, fleet: !!im.fleet }; });
    electron_1.ipcMain.handle('ceremonyOpenFolder', async () => { try {
        fs.mkdirSync(dir(), { recursive: true });
        const r = await electron_1.shell.openPath(dir());
        return r ? { ok: false, error: r } : { ok: true };
    }
    catch (e) {
        return { ok: false, error: e.message };
    } });
}
//# sourceMappingURL=ceremony-app.js.map
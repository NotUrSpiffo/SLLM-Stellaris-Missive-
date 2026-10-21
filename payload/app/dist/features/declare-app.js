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
exports.declareFileUrl = exports.declare = void 0;
exports.warDeclarations = warDeclarations;
exports.registerDeclare = registerDeclare;
exports.openDeclare = openDeclare;
exports.closeDeclare = closeDeclare;
// 전쟁 선언문(2026-10-20 알파 10): 전쟁 시작(EVT war_start) → 알림 → 선언문 창(직접 쓰기·AI 초안) → 저장 → (선택) 출정 의식.
// 규칙: src/declare.ts, 화면: ui/declare.html. 저장: 앱 데이터 sllm_wardecl.json(세이브별 목록 — 신문·라디오·상대 제국이 나중에 재료로 쓴다).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const log_router_1 = require("../app/log-router");
const settings_ui_1 = require("./settings-ui");
const gamestate_app_1 = require("./gamestate-app");
const chronicle_app_1 = require("./chronicle-app");
const ceremony_app_1 = require("./ceremony-app");
const condemn_app_1 = require("./condemn-app");
const debate_app_1 = require("./debate-app"); // 찬반 논평(2026-10-20 알파 10)
const music_1 = require("../music");
const warinfo_1 = require("../warinfo");
const declare_1 = require("../declare");
const game_link_1 = require("../app/game-link");
const terminal_1 = require("./terminal");
const declaration_buff_1 = require("../declaration-buff");
const L = settings_ui_1.pick;
let owner = '', windowOwner = '', issuing = false;
let presentation = null;
const session = () => `${ctx_1.ctx.curSaveId}:${game_link_1.link.epoch}`;
function syncSession() {
    if (owner === session())
        return;
    owner = session();
    presentation = null;
    exports.declare.pending = null;
    exports.declare.info.clear();
    exports.declare.draft = null;
}
async function applyDeclarationBuff(side) {
    const sid = ctx_1.ctx.curSaveId, epoch = game_link_1.link.epoch;
    try {
        const req = ++game_link_1.link.reqCounter;
        const r = await (0, terminal_1.terminalRequest)((0, declaration_buff_1.declarationBuffCommand)(req, sid, ctx_1.ctx.playerIdx, side), 'DECLBUFF', req);
        if (sid !== ctx_1.ctx.curSaveId || epoch !== game_link_1.link.epoch || r.kv.sid !== sid)
            return L('세이브가 바뀌어 버프 결과를 확인하지 못했습니다.', 'The save changed before the bonus could be confirmed.');
        if (r.kv.status === 'applied')
            return side === 'att' ? L('2년간 함선 무기 피해량 +5%, 함선 이동 속도 +10% 적용 확인.', 'Confirmed: +5% ship weapon damage and +10% ship speed for 2 years.') : L('2년간 함선 내구도·보호막·장갑 +10% 적용 확인.', 'Confirmed: +10% ship hull, shields and armor for 2 years.');
        if (r.kv.status === 'duplicate')
            return L('같은 선언문 버프가 이미 적용 중입니다. 기간과 효과는 중첩되지 않습니다.', 'This declaration bonus is already active. Its duration and effects do not stack.');
        if (r.kv.status === 'no_war')
            return L('해당 공격·방어 전쟁에 참여 중이 아니어서 버프를 적용하지 않았습니다.', 'No bonus applied: you are not on the corresponding side of an active war.');
        return L('버프 적용을 확인하지 못했습니다. 최신 연결 모드를 켜고 게임을 다시 시작해 주세요.', 'The bonus was not confirmed. Enable the latest connection mod and restart the game.');
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'declare.buff_failed', { error: String(e) });
        return L('선언문은 저장했지만 버프 적용을 확인하지 못했습니다.', 'The declaration was saved, but the bonus could not be confirmed.');
    }
}
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_wardecl.json');
let store = null;
function all() { if (store)
    return store; try {
    store = (0, declare_1.sanitizeDecl)(JSON.parse(fs.readFileSync(file(), 'utf8')));
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'wardecl', error: e });
    store = (0, declare_1.sanitizeDecl)({});
} return store; }
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'wardecl', error: e });
} }
/** 이 세이브의 선언문 목록(신문·라디오·상대 제국이 재료로 쓸 때). 최근 것이 뒤. */
function warDeclarations(sid = ctx_1.ctx.curSaveId) { return all().saves[(0, music_1.safeKey)(sid)] ?? []; }
/** 전쟁 시작 알림 대기: 선언문 창이 열릴 때 쓴다. */
exports.declare = { pending: null, /** 전쟁 이름 → 모드가 보낸 전쟁 정보(명분·주도국·관계). 최근 20개 */ info: new Map(), win: null, draft: null, fullscreen: false };
function registerDeclare(router) {
    router.on(log_router_1.SLOT.DECLARE, 'declare:war', (m) => {
        if (m.kind === 'DECLBUFF') {
            terminal_1.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
            return;
        }
        syncSession();
        if (m.kv.sid && m.kv.sid !== ctx_1.ctx.curSaveId)
            return;
        if (m.kind === 'WARINFO') {
            const w = (0, warinfo_1.parseWarInfo)(m.kv);
            if (w) {
                exports.declare.info.set(w.war, w);
                (0, condemn_app_1.condemnSetInfo)(w);
                if (exports.declare.info.size > 20)
                    exports.declare.info.delete(exports.declare.info.keys().next().value);
                if (exports.declare.win && !exports.declare.win.isDestroyed())
                    exports.declare.win.webContents.send('declareInfo', L((0, warinfo_1.describeWar)(w, 'ko'), (0, warinfo_1.describeWar)(w, 'en')));
            }
            return;
        }
        if (m.kind !== 'EVT' || m.kv.kind !== 'war_start')
            return;
        const war = String(m.kv.war ?? '').slice(0, 120), date = String(m.kv.date ?? '').slice(0, 20);
        if (exports.declare.pending && exports.declare.pending.war === war)
            return; // 같은 전쟁 중복 신호
        exports.declare.pending = { war, date };
        const side = (0, declare_1.warSide)(gamestate_app_1.gameState.last?.wars, war).side;
        ctx_1.ctx.notify({ kind: 'declare', title: side === 'def' ? L('전쟁이 터졌습니다 — 항전 선언문을 작성하시겠습니까?', 'War has come — write a declaration of resistance?') : L('전쟁이 시작되었습니다 — 전쟁 선언문을 작성하시겠습니까?', 'War has begun — write a declaration of war?'), body: war || L('전쟁', 'War'), action: L('선언문 쓰기', 'Write the declaration') });
        (0, diagnostics_1.logDiagnostic)('info', 'declare.war_start', { war, date, side });
    });
    electron_1.ipcMain.handle('declareState', async () => {
        syncSession();
        const p = exports.declare.pending, ws = (0, declare_1.warSide)(gamestate_app_1.gameState.last?.wars, p?.war ?? '');
        const wi = p ? exports.declare.info.get(p.war) : undefined;
        return { war: p?.war ?? '', date: p?.date ?? ctx_1.ctx.gameDate ?? '', side: wi ? wi.side : ws.side, enemy: wi ? (wi.side === 'att' ? wi.defender : wi.attacker) || ws.enemy : ws.enemy, info: wi ? L((0, warinfo_1.describeWar)(wi, 'ko'), (0, warinfo_1.describeWar)(wi, 'en')) : '', title: L((0, declare_1.declTitle)(wi?.side ?? ws.side, true), (0, declare_1.declTitle)(wi?.side ?? ws.side, false)), empire: ctx_1.ctx.playerName || '', draft: exports.declare.draft, flag: ctx_1.ctx.flagUrlFor(ctx_1.ctx.playerIdx) ?? '', recent: warDeclarations().slice(-5).map((d) => ({ date: d.date, war: d.war, title: d.title, lines: d.text.split('\n').length })) };
    });
    electron_1.ipcMain.handle('declareDraft', async () => {
        const p = exports.declare.pending, ws = (0, declare_1.warSide)(gamestate_app_1.gameState.last?.wars, p?.war ?? ''), snap = gamestate_app_1.gameState.last;
        try {
            const wi = p ? exports.declare.info.get(p.war) : undefined;
            const raw = await ctx_1.ctx.ai.chat((0, declare_1.declMessages)(ctx_1.ctx.playerName || 'the player empire', p?.war ?? '', wi ? (wi.side === 'att' ? wi.defender : wi.attacker) || ws.enemy : ws.enemy, wi ? wi.side : ws.side, (0, music_1.creedEthics)(snap?.empireEth), !!snap?.gestalt, p?.date || ctx_1.ctx.gameDate || '', wi ? (0, warinfo_1.describeWar)(wi, 'en') : ''), { purpose: 'war-declaration', json: true, maxTokens: 1200 });
            const d = (0, declare_1.parseDecl)(raw);
            if (!d)
                return { ok: false, error: L('AI 답에서 선언문을 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read a declaration from the AI reply. Please try again.') };
            return { ok: true, title: d.title, text: d.text };
        }
        catch (e) {
            return { ok: false, error: L('AI 초안 실패: ', 'AI draft failed: ') + (e instanceof Error ? e.message : String(e)) };
        }
    });
    /** 저장: 이 세이브의 선언문 목록에 더한다. */
    electron_1.ipcMain.handle('declareSave', async (_e, titleIn, textIn) => {
        syncSession();
        if (issuing || !ctx_1.ctx.curSaveId || windowOwner !== session())
            return { ok: false, error: L('진행 중인 요청 또는 변경된 세이브입니다. 창을 다시 열어 주세요.', 'A request is pending or the save changed. Reopen this window.') };
        const text = (0, declare_1.cleanDeclText)(textIn);
        if (!text)
            return { ok: false, error: L('선언문 본문이 비어 있습니다.', 'The declaration is empty.') };
        const p = exports.declare.pending, ws = (0, declare_1.warSide)(gamestate_app_1.gameState.last?.wars, p?.war ?? '');
        const wi = p ? exports.declare.info.get(p.war) : undefined;
        const d = { date: p?.date || ctx_1.ctx.gameDate || '', war: p?.war ?? '', enemy: wi ? (wi.side === 'att' ? wi.defender : wi.attacker) || ws.enemy : ws.enemy, side: wi ? wi.side : ws.side, goal: wi?.attGoal ?? '', title: (typeof titleIn === 'string' && titleIn.trim() ? titleIn : L((0, declare_1.declTitle)(ws.side, true), (0, declare_1.declTitle)(ws.side, false))).slice(0, 80), text, audio: [], createdAt: Date.now() };
        const key = (0, music_1.safeKey)(ctx_1.ctx.curSaveId), list = (all().saves[key] ??= []);
        list.push(d);
        if (list.length > declare_1.DECL_KEEP)
            list.splice(0, list.length - declare_1.DECL_KEEP);
        save();
        (0, chronicle_app_1.chronNoteWorld)(`${d.date} ${d.title}: ${text.split('\n')[0]}`, true);
        if (d.war)
            (0, condemn_app_1.condemnAfterDeclaration)(d.war, text); // 선언문 뒤 은하의 반응(규탄 성명)
        void (0, debate_app_1.debateOn)(d.side === 'def' ? 'war_def' : 'war_att', `${d.title} — ${d.war}${d.enemy ? ' vs ' + d.enemy : ''}: ${text.split('\n')[0]}`, d.date); // 국내 찬반 논평
        exports.declare.draft = null;
        issuing = true;
        const issuedSession = session();
        try {
            const exactWar = gamestate_app_1.gameState.last?.sid === ctx_1.ctx.curSaveId ? gamestate_app_1.gameState.last.wars?.find(w => w.name === p?.war) : undefined;
            const side = wi?.side ?? exactWar?.side ?? '';
            const notice = side ? await applyDeclarationBuff(side) : L('선언문을 저장했습니다. 전쟁 정보를 확인할 수 없어 버프는 적용하지 않았습니다.', 'Declaration saved. No bonus applied because the war information is unavailable.');
            presentation = issuedSession === session() ? { title: d.title, text: d.text, notice, session: issuedSession } : null;
            return { ok: true, index: list.length - 1, notice };
        }
        finally {
            issuing = false;
        }
    });
    electron_1.ipcMain.handle('declareFullscreen', async (_e, on) => { setFullscreen(!!on); return true; });
    electron_1.ipcMain.handle('declareCeremony', async () => {
        if (!presentation || presentation.session !== session())
            return { ok: false, error: L('현재 세이브에서 선언문을 먼저 발표해 주세요.', 'Issue a declaration in the current save first.') };
        return (0, ceremony_app_1.ceremonyOpen)(presentation);
    });
    electron_1.ipcMain.handle('declareClose', async () => { closeDeclare(); return true; });
    electron_1.ipcMain.handle('declareOpen', async () => { openDeclare(); return true; });
}
function setFullscreen(on) {
    const w = exports.declare.win;
    if (!w || w.isDestroyed())
        return;
    if (on === exports.declare.fullscreen)
        return;
    exports.declare.fullscreen = on;
    if (on) {
        const b = ctx_1.ctx.gameDip ? electron_1.screen.getDisplayMatching(ctx_1.ctx.gameDip).bounds : electron_1.screen.getPrimaryDisplay().bounds;
        w.setResizable(true);
        w.setBounds(b);
        w.setAlwaysOnTop(true, 'screen-saver', 2);
    }
    else {
        const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
        const sz = winSize(area);
        w.setBounds({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) });
        w.setAlwaysOnTop(true, 'screen-saver', 1);
    }
}
const winSize = (area) => ({ width: Math.min(1100, Math.round(area.width * 0.8)), height: Math.min(820, Math.round(area.height * 0.86)) });
function openDeclare() {
    if (exports.declare.win && !exports.declare.win.isDestroyed()) {
        exports.declare.win.show();
        exports.declare.win.focus();
        return;
    }
    syncSession();
    windowOwner = session();
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea, sz = winSize(area);
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.declare.fullscreen = false;
    exports.declare.win = new electron_1.BrowserWindow({ ...sz, x, y, resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), backgroundThrottling: false } });
    exports.declare.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.declare.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'declare.html'));
    exports.declare.win.once('ready-to-show', () => { exports.declare.win?.show(); });
    exports.declare.win.on('closed', () => { exports.declare.win = null; exports.declare.fullscreen = false; });
}
function closeDeclare() { if (exports.declare.win && !exports.declare.win.isDestroyed())
    exports.declare.win.close(); }
const declareFileUrl = (f) => (0, url_1.pathToFileURL)(f).href;
exports.declareFileUrl = declareFileUrl;
//# sourceMappingURL=declare-app.js.map
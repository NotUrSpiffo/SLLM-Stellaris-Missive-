"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dialTerminal = exports.terminalView = exports.terminalReplies = exports.terminal = void 0;
exports.terminalRequest = terminalRequest;
exports.contactAllowed = contactAllowed;
exports.registerTerminal = registerTerminal;
// A-00b 6번: 통신 단말기(앱 쪽) — 연락처 목록(CONTACT_*), 단말기 명령을 보내고 끝 줄(KIND:req)을 기다리는 terminalRequest,
// 상대 연결(dialTerminal: 게임에 대화 창을 열게 함), IPC 3개. 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// HELLO·ETHIC_END 줄도 terminalReplies 로 응답을 받는다(그 처리는 main.ts 로그 자리에 남아 있음).
const electron_1 = require("electron");
const diagnostics_1 = require("../diagnostics");
const terminal_contacts_1 = require("../terminal-contacts");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
exports.terminal = new terminal_contacts_1.TerminalContacts();
exports.terminalReplies = new Map();
const terminalView = () => ({ sid: exports.terminal.sid, date: exports.terminal.date, items: exports.terminal.items.filter(c => contactAllowed(c.type)).map(c => ({ ...c, talkOnly: !ctx_1.ctx.modCompatibility.policy(c.type).actions })) }); // talkOnly: 대화 전용(게임 행동 없음, 알파 8)
exports.terminalView = terminalView;
async function terminalRequest(effect, end, req) {
    const key = end + ':' + req;
    let timer;
    let rejectResponse;
    const response = new Promise((resolve, reject) => {
        exports.terminalReplies.set(key, resolve);
        rejectResponse = reject;
    });
    // Observe a possible timeout even while another console command is still queued.
    void response.catch(() => { });
    try {
        await (0, game_link_1.enqueue)(async () => {
            timer = setTimeout(() => { (0, diagnostics_1.logDiagnostic)('warn', 'game.response.timeout', { req, end, timeoutMs: 12000 }); exports.terminalReplies.delete(key); rejectResponse(new Error((0, settings_ui_1.pick)('게임 응답이 없습니다. 게임과 최신 SLLM 연결 모드를 확인해 주세요.', 'No response from the game. Check the game and the latest SLLM link mod.'))); }, 12000);
            await (0, game_link_1.sendConsole)(effect);
        });
        return await response;
    }
    finally {
        if (timer)
            clearTimeout(timer);
        exports.terminalReplies.delete(key);
    }
}
function contactAllowed(type) { return ctx_1.ctx.modCompatibility.policy(type).contact; }
const dialTerminal = async (a) => {
    const idx = Number(a?.idx);
    if (!ctx_1.ctx.gameRunning)
        return { ok: false, error: (0, settings_ui_1.pick)('게임이 켜져 있어야 통신할 수 있습니다.', 'The game must be running to communicate.') };
    if (a?.sid !== ctx_1.ctx.curSaveId || exports.terminal.sid !== ctx_1.ctx.curSaveId || !Number.isSafeInteger(idx) || !exports.terminal.items.some(c => c.idx === idx && contactAllowed(c.type)))
        return { ok: false, error: (0, settings_ui_1.pick)('현재 세이브의 연락처를 다시 갱신해 주세요.', 'Please refresh the current save\'s contacts.') };
    if (ctx_1.ctx.pend || ctx_1.ctx.pending)
        return { ok: false, error: (0, settings_ui_1.pick)('진행 중인 통신과 제안을 마친 뒤 연결해 주세요.', 'Finish the ongoing call and proposals before connecting.') };
    const req = ++game_link_1.link.reqCounter;
    try {
        const m = await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_terminal_dial = { TID = ' + idx + ' REQ = ' + req + ' } }', 'DIAL_END', req);
        if (m.kv.sid !== ctx_1.ctx.curSaveId || Number(m.kv.ok) !== 1)
            return { ok: false, error: (0, settings_ui_1.pick)('상대와 통신할 수 없습니다. 연락처를 다시 갱신해 주세요.', 'Cannot reach them. Please refresh the contacts.') };
        if (a?.sid !== ctx_1.ctx.curSaveId)
            return { ok: false, error: (0, settings_ui_1.pick)('세이브가 바뀌었습니다.', 'The save changed.') };
        await ctx_1.ctx.refreshEthics(idx);
        if (a?.sid !== ctx_1.ctx.curSaveId)
            return { ok: false, error: (0, settings_ui_1.pick)('세이브가 바뀌었습니다.', 'The save changed.') };
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
};
exports.dialTerminal = dialTerminal;
function registerTerminal(router) {
    router.on(log_router_1.SLOT.TERMINAL, 'terminal:feed', (m) => {
        const contactsDone = exports.terminal.feed(m);
        if (contactsDone)
            ctx_1.ctx.toUi('contacts', (0, exports.terminalView)());
        if ((m.kind === 'CONTACT_END' && contactsDone) || m.kind === 'DIAL_END')
            exports.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
    });
    electron_1.ipcMain.handle('contactsList', async () => (0, exports.terminalView)());
    electron_1.ipcMain.handle('contactsRefresh', async () => {
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: (0, settings_ui_1.pick)('게임이 켜져 있어야 목록을 갱신할 수 있습니다.', 'The game must be running to refresh the list.') };
        const req = ++game_link_1.link.reqCounter;
        try {
            await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
            return { ok: true, state: (0, exports.terminalView)() };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('contactDial', async (_e, a) => {
        if (ctx_1.ctx.mailReplyBusy)
            return { ok: false, error: (0, settings_ui_1.pick)('편지 답장을 연결 중입니다.', 'Connecting the letter reply.') };
        return (0, exports.dialTerminal)(a);
    });
}
//# sourceMappingURL=terminal.js.map
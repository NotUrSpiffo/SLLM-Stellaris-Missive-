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
exports.dinnerTick = dinnerTick;
exports.registerDinner = registerDinner;
const banquet_app_1 = require("./banquet-app");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const dinner_1 = require("../dinner");
const gamedate_1 = require("../gamedate");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const mail_app_1 = require("./mail-app");
const chronicle_app_1 = require("./chronicle-app");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)
let store = null, win = null, busy = false;
const visits = () => store ??= new dinner_1.DinnerStore(path.join(electron_1.app.getPath('userData'), 'sllm_dinner_invites.json'));
const branch = () => ctx_1.ctx.govMem().currentBranch(ctx_1.ctx.curSaveId);
const message = (e) => e instanceof Error ? e.message : String(e);
const waits = new Map();
function list() { return ctx_1.ctx.curSaveId ? visits().list(ctx_1.ctx.curSaveId, branch()) : []; }
function signal(m) {
    if (m.kind !== 'DINNER' || m.kv.sid !== ctx_1.ctx.curSaveId)
        return;
    const row = list().find(x => x.id === Number(m.kv.vid) && x.idx === Number(m.kv.tid));
    if (row && ['arrival_requested', 'arrived'].includes(row.phase)) {
        if (m.kv.phase === 'open' && row.phase !== 'arrived') {
            visits().update({ ...row, phase: 'arrived', error: undefined });
            ctx_1.ctx.notify({ kind: 'event', title: L('지도자 도착', 'Leader arrived'), body: L(row.name + '의 지도자가 도착했습니다. 게임의 접대 선택지를 확인하세요.', 'The leader of ' + row.name + ' has arrived. Check the reception choices in the game.') });
        }
        if (m.kv.phase === 'finished' && ['grand', 'normal', 'humiliating'].includes(m.kv.greeting)) {
            const greeting = m.kv.greeting;
            visits().update({ ...row, phase: 'prepared', greeting, error: undefined });
            (0, banquet_app_1.openBanquet)({ ...row, phase: 'prepared', greeting });
            (0, chronicle_app_1.chronNote)(row.idx, L('지도자 방문 접대: ', 'Leader visit reception: ') + ({ grand: L('성대하게 대접', 'received grandly'), normal: L('일반적으로 대접', 'received normally'), humiliating: L('굴욕적으로 대접', 'received humiliatingly') })[greeting]);
        }
        if (m.kv.phase === 'unavailable')
            visits().update({ ...row, phase: 'cancelled', error: L('게임에서 상대와 통신할 수 없거나 전쟁 중이어서 방문하지 못했습니다.', 'The visit could not happen: no communications with them in the game, or you are at war.') });
        if (m.kv.phase === 'missing' || m.kv.phase === 'stale')
            visits().update({ ...row, error: L('게임의 방문 기록과 앱 예약이 일치하지 않습니다. 재전송하지 않고 확인을 기다립니다.', 'The game\'s visit record does not match the app\'s booking. Not resending; waiting for confirmation.') });
    }
    const w = waits.get(Number(m.kv.req));
    if (w && w.epoch === game_link_1.link.epoch && w.row.sid === m.kv.sid && w.row.id === Number(m.kv.vid) && w.row.idx === Number(m.kv.tid))
        w.resolve(m);
}
async function deliver(row, status) {
    const req = ++game_link_1.link.reqCounter, epoch = game_link_1.link.epoch;
    let timer;
    let resolve, reject;
    const response = new Promise((r, j) => { resolve = r; reject = j; });
    void response.catch(() => { });
    waits.set(req, { row, epoch, resolve });
    try {
        await (0, game_link_1.enqueue)(async () => {
            if (ctx_1.ctx.curSaveId !== row.sid || branch() !== row.branch || game_link_1.link.epoch !== epoch)
                throw new Error(L('세이브 또는 시간선이 바뀌었습니다.', 'The save or timeline changed.'));
            timer = setTimeout(() => reject(new Error(L('방문 이벤트 응답을 확인하지 못했습니다. 다음 게임 월에는 상태만 조회합니다.', 'Could not confirm the visit event reply. Next game month only the status will be checked.'))), 10000);
            await (0, game_link_1.sendConsole)((0, dinner_1.dinnerEffect)(row, req, status));
        });
        return await response;
    }
    finally {
        if (timer)
            clearTimeout(timer);
        waits.delete(req);
    }
}
async function dinnerTick() {
    if (busy || !ctx_1.ctx.curSaveId || !(0, dinner_1.validDinnerDate)(ctx_1.ctx.gameDate))
        return;
    const sid = ctx_1.ctx.curSaveId, b = branch(), epoch = game_link_1.link.epoch, date = ctx_1.ctx.gameDate;
    const current = () => ctx_1.ctx.curSaveId === sid && branch() === b && game_link_1.link.epoch === epoch;
    let active;
    busy = true;
    try {
        for (let row of visits().due(sid, b, date)) {
            active = row;
            if (!current())
                break;
            const contact = ctx_1.ctx.terminal.sid === sid ? ctx_1.ctx.terminal.items.find(x => x.idx === row.idx) : undefined;
            const profile = ctx_1.ctx.profiles.get(row.idx) ?? ctx_1.ctx.mailCountries.get(row.idx)?.profile;
            if (!contact) {
                visits().update({ ...row, error: L('통신 가능한 제국 목록에서 상대를 확인하지 못했습니다. 채널 갱신 후 다음 게임 월에 다시 확인합니다.', 'The empire was not found among reachable contacts. Will check again next game month after the channels refresh.') });
                continue;
            }
            if (row.ruler && profile?.ruler && row.ruler !== profile.ruler) {
                visits().update({ ...row, phase: 'cancelled', error: L('초대한 지도자가 바뀌어 방문 예약을 취소했습니다.', 'The invited leader changed, so the visit was cancelled.') });
                continue;
            }
            if (['waiting_reply', 'writing_reply', 'reply_ready'].includes(row.phase)) {
                if (row.phase === 'waiting_reply') {
                    const accepted = (0, dinner_1.dinnerAcceptance)(contact.score, profile?.flags ?? {}, Math.random());
                    row = { ...row, phase: 'writing_reply', accepted, ruler: row.ruler || profile?.ruler || '', arrival: accepted ? (0, gamedate_1.addMonths)(date, 6) : undefined };
                    // Reply date is actual game processing date; guests arrive six months after delivery, not a stale overdue date.
                    row.due = date;
                    visits().update(row);
                }
                // 이미 받은 답장(reply_ready)은 날짜만 옮기고 다시 쓰지 않는다(수신함 저장이 실패한 달마다 AI 답장을 새로 부르던 문제, 2026-10-18).
                if (row.due !== date) {
                    row = row.phase === 'reply_ready' && row.reply ? { ...row, due: date, arrival: row.accepted ? (0, gamedate_1.addMonths)(date, 6) : undefined } : { ...row, phase: 'writing_reply', due: date, arrival: row.accepted ? (0, gamedate_1.addMonths)(date, 6) : undefined, reply: undefined };
                    visits().update(row);
                }
                if (row.phase === 'writing_reply') {
                    const raw = await ctx_1.ctx.ai.chat((0, dinner_1.dinnerReplyMessages)(row, ctx_1.ctx.profileWithEthics(profile, row.idx), contact.score), { purpose: 'leader-dinner-invitation', json: true, maxTokens: 1200 });
                    if (!current())
                        break;
                    row = { ...row, phase: 'reply_ready', reply: (0, dinner_1.parseDinnerReply)(raw) };
                    visits().update(row);
                }
                if (!current())
                    break;
                // A failed AI/storage operation leaves the pending invitation intact for the next MONTH.
                (0, mail_app_1.inboxStore)().add(sid, b, { idx: row.idx, name: row.name, date: row.due, text: row.reply, proposal: null, expires: (0, gamedate_1.addYears)(row.due, 2), read: false, sourceId: 'dinner-reply:' + row.id });
                if ((0, mail_app_1.inboxStore)().error)
                    throw new Error((0, mail_app_1.inboxStore)().error);
                visits().update({ ...row, phase: row.accepted ? 'accepted' : 'declined', error: undefined });
                (0, mail_app_1.syncInbox)();
                ctx_1.ctx.notify({ kind: 'letter', title: L('지도자 초대 답장', 'Invitation reply'), body: row.accepted ? L(row.name + '에서 초대를 수락했습니다. 방문 예정일: ' + row.arrival, row.name + ' accepted the invitation. Expected visit: ' + row.arrival) : L(row.name + '에서 초대를 거절했습니다.', row.name + ' declined the invitation.') });
                continue;
            }
            if (profile?.flags.war && row.phase === 'accepted') {
                visits().update({ ...row, phase: 'cancelled', error: L('전쟁 중이어서 방문을 취소했습니다.', 'The visit was cancelled because of the war.') });
                continue;
            }
            if (row.phase === 'accepted') {
                row = { ...row, phase: 'arrival_requested', error: undefined };
                visits().update(row); // before sending: uncertainty never triggers an automatic resend
                const receipt = await deliver(row, false);
                if (!['open', 'finished', 'unavailable'].includes(receipt.kv.phase))
                    ctx_1.ctx.toUi('mailstatus', L('방문 이벤트를 확인하지 못했습니다. 자동 재전송 없이 상태만 조회합니다.', 'Could not confirm the visit event. Only checking status, without resending.'));
            }
            else if (row.phase === 'arrival_requested' || row.phase === 'arrived')
                await deliver(row, true);
        }
    }
    catch (e) {
        if (current() && active) {
            try {
                const saved = visits().list(sid, b).find(x => x.id === active.id);
                if (saved)
                    visits().update({ ...saved, error: message(e) });
            }
            catch { /* original error is reported below */ }
        }
        (0, diagnostics_1.logDiagnostic)('warn', 'dinner.tick.failed', { sid, error: message(e) });
        ctx_1.ctx.toUi('mailstatus', L('지도자 초대 처리: ', 'Leader invitation: ') + message(e));
    }
    finally {
        busy = false;
    }
}
function registerDinner(router) {
    router.on(log_router_1.SLOT.DINNER, 'dinner:calendar', m => {
        try {
            if (m.kind === 'DINNER')
                signal(m);
            if (m.kind === 'MONTH')
                void dinnerTick();
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'dinner.signal.failed', { error: message(e) });
        }
    });
    electron_1.ipcMain.handle('dinnerOpen', async () => {
        if (win && !win.isDestroyed()) {
            win.show();
            win.focus();
            return true;
        }
        const area = electron_1.screen.getPrimaryDisplay().workArea;
        const w = new electron_1.BrowserWindow({ width: Math.min(780, area.width), height: Math.min(760, area.height), minWidth: 600, minHeight: 550, frame: false, backgroundColor: '#081921', webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
        win = w;
        void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'dinner-invite.html'));
        w.on('closed', () => { if (win === w)
            win = null; });
        return true;
    });
    electron_1.ipcMain.handle('dinnerState', async () => { try {
        return { ok: true, sid: ctx_1.ctx.curSaveId, date: ctx_1.ctx.gameDate, branch: ctx_1.ctx.curSaveId ? branch() : 0, contacts: ctx_1.ctx.terminal.sid === ctx_1.ctx.curSaveId ? ctx_1.ctx.terminal.items.filter(x => x.idx !== ctx_1.ctx.playerIdx) : [], visits: list() };
    }
    catch (e) {
        return { ok: false, error: message(e) };
    } });
    electron_1.ipcMain.handle('dinnerInvite', async (_e, input) => {
        try {
            const v = input;
            if (!v || v.sid !== ctx_1.ctx.curSaveId || v.branch !== branch() || ctx_1.ctx.terminal.sid !== ctx_1.ctx.curSaveId || !(0, dinner_1.validDinnerDate)(ctx_1.ctx.gameDate))
                throw new Error(L('현재 세이브의 날짜와 연락처를 먼저 갱신해 주세요.', 'Refresh the current save\'s date and contacts first.'));
            const contact = ctx_1.ctx.terminal.items.find(c => c.idx === v.idx);
            if (!contact || contact.idx === ctx_1.ctx.playerIdx)
                throw new Error(L('초대할 제국을 선택해 주세요.', 'Choose an empire to invite.'));
            if (!ctx_1.ctx.actionsAllowed(contact.idx))
                throw new Error(L('이 제국에는 초대를 보낼 수 없습니다.', 'You cannot send an invitation to this empire.'));
            if (typeof v.body !== 'string')
                throw new Error(L('초대 서신을 입력해 주세요.', 'Please write the invitation letter.'));
            const row = visits().add({ sid: ctx_1.ctx.curSaveId, branch: branch(), idx: contact.idx, name: contact.name, ruler: ctx_1.ctx.profiles.get(contact.idx)?.ruler ?? ctx_1.ctx.mailCountries.get(contact.idx)?.profile.ruler ?? '', sent: ctx_1.ctx.gameDate, body: v.body.trim() }, 3 + Math.floor(Math.random() * 4));
            (0, diagnostics_1.logDiagnostic)('info', 'dinner.invited', { sid: row.sid, id: row.id, idx: row.idx, sent: row.sent, due: row.due });
            return { ok: true, invitation: row };
        }
        catch (e) {
            return { ok: false, error: message(e) };
        }
    });
    electron_1.ipcMain.handle('dinnerBanquet', async (_e, id) => { try {
        const row = list().find(x => x.id === id);
        if (!row)
            throw new Error(L('현재 시간선의 방문을 찾지 못했습니다.', 'No visit found on the current timeline.'));
        (0, banquet_app_1.openBanquet)(row);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: message(e) };
    } });
    electron_1.ipcMain.handle('dinnerClose', async () => { win?.close(); return true; });
}
//# sourceMappingURL=dinner-app.js.map
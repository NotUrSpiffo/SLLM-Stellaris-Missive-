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
exports.registerPrivateRooms = registerPrivateRooms;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const room_import_1 = require("../room-import");
const radio_app_1 = require("./radio-app");
const room_trophies_1 = require("../room-trophies");
const log_router_1 = require("../app/log-router");
const terminal_1 = require("./terminal");
const chronicle_app_1 = require("./chronicle-app");
const gamestate_app_1 = require("./gamestate-app");
const room_music_1 = require("../room-music");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const room_activity_1 = require("../room-activity");
const ctx_1 = require("../app/ctx");
const office_app_1 = require("./office-app");
const people_app_1 = require("./people-app");
const game_link_1 = require("../app/game-link");
const room_records_1 = require("../room-records");
const settings_ui_1 = require("./settings-ui");
const secretary_app_1 = require("./secretary-app");
const persona_app_1 = require("./persona-app");
const office_app_2 = require("./office-app");
let store;
let activityStore;
const activities = () => activityStore ??= new room_activity_1.RoomActivities(path.join(electron_1.app.getPath('userData'), 'private-room-activity'));
const records = () => store ??= (new room_records_1.RoomRecords(path.join(electron_1.app.getPath('userData'), 'private-room-records')));
const companions = new Map();
const sessions = new Map();
function actor() {
    const sid = ctx_1.ctx.curSaveId, r = (0, people_app_1.peopleOf)(sid).find(p => p.ruler && !p.gone);
    if (!game_link_1.link.sessionReady || !sid || !r || !r.name || !ctx_1.ctx.gameDate)
        throw Error((0, settings_ui_1.pick)('게임과 현재 통치자를 먼저 확인해 주세요.', 'Load a game and wait for the current ruler to be identified.'));
    return { sid, rulerId: 'p:' + r.lid, rulerName: r.name, date: ctx_1.ctx.gameDate };
}
function identity(a) { return JSON.stringify([a.sid, a.rulerId, game_link_1.link.epoch]); }
function sender(e) { if (!office_app_1.office.win || office_app_1.office.win.isDestroyed() || e.sender !== office_app_1.office.win.webContents || e.senderFrame !== e.sender.mainFrame)
    throw Error('UNAUTHORIZED_ROOM'); }
function session(e, token) { sender(e); const a = actor(); if (sessions.get(e.sender.id)?.token !== token || sessions.get(e.sender.id)?.identity !== identity(a))
    throw Error((0, settings_ui_1.pick)('세이브나 통치자가 바뀌었습니다. 방을 다시 열어 주세요.', 'The save or ruler changed. Reopen the room.')); return a; }
const errorText = (e) => {
    const code = e.message;
    const map = { IMPORT_SIZE: (0, settings_ui_1.pick)('4MB 이하 파일을 선택해 주세요.', 'Choose a file no larger than 4 MB.'), IMPORT_FORMAT: (0, settings_ui_1.pick)('이 목록에 맞는 SLLM JSON 또는 TXT·MD 파일을 선택해 주세요.', 'Choose a matching SLLM JSON export, TXT or MD file.'), TROPHY_STORE_BUSY: (0, settings_ui_1.pick)('다른 작업이 트로피를 저장 중입니다. 계속 발생하면 저장소 잠금 파일을 확인해 주세요.', 'Another operation is saving trophies. If this persists, check the store lock file.'), TROPHY_IN_TRANSIT: (0, settings_ui_1.pick)('서신으로 전달 중인 트로피입니다. 전달을 취소하거나 도착을 기다려 주세요.', 'This trophy is in transit by letter. Cancel the delivery or wait for it to arrive.'), INVALID_RECIPIENT: (0, settings_ui_1.pick)('현재 연락처에서 선물할 수 있는 제국을 찾지 못했습니다. 연락처를 갱신해 주세요.', 'That empire is not a giftable contact in the current save. Refresh contacts.'), PAYMENT_NOT_MISSING: (0, settings_ui_1.pick)('게임에서 결제 표시를 찾았거나 확인하지 못해 요청을 취소하지 않았습니다.', 'The request was not cancelled: the game found a payment marker or could not confirm.'), INVALID_TROPHY: (0, settings_ui_1.pick)('트로피 이름·설명·모양을 확인해 주세요.', 'Check the trophy name, description and design.'), INVALID_TROPHY_STORE: (0, settings_ui_1.pick)('트로피 기록을 읽지 못했습니다. 원본을 보존합니다.', 'Could not read trophy records. The original is preserved.'), PAYMENT_PENDING: (0, settings_ui_1.pick)('확인 중인 제작비가 있습니다. 결제 확인은 재차감하지 않습니다.', 'A payment is awaiting confirmation. Checking it will not charge again.'), UNKNOWN_TROPHY: (0, settings_ui_1.pick)('트로피를 찾을 수 없습니다.', 'Trophy not found.'), TROPHY_OWNERSHIP: (0, settings_ui_1.pick)('현재 소유자는 이 변경을 허용하지 않습니다.', 'The current ownership does not permit this change.'), TROPHY_SLOT: (0, settings_ui_1.pick)('이미 사용 중인 전시 칸입니다.', 'That display slot is occupied.'), SECRETARY_UNAVAILABLE: (0, settings_ui_1.pick)('비서가 준비되지 않았습니다.', 'Your secretary is not available.'), TROPHY_CAPACITY: (0, settings_ui_1.pick)('비서는 트로피를 최대 6개까지 보관합니다.', 'Your secretary can hold up to six trophies.'), INVALID_CHAT: (0, settings_ui_1.pick)('대화 요청을 확인해 주세요.', 'Check the conversation request.'), INVALID_PAGE: (0, settings_ui_1.pick)('선택한 페이지가 바뀌었습니다. 다시 열어 주세요.', 'The selected page changed. Reopen it.'), INVALID_ROOM: (0, settings_ui_1.pick)('이 기록은 해당 방에서 공유할 수 없습니다.', 'This record cannot be shared in this room.'), INVALID_ACTIVITY_STORE: (0, settings_ui_1.pick)('대화 기록을 읽지 못했습니다. 원본은 보존됩니다.', 'Conversation history could not be read. The original is preserved.'), INVALID_MUSIC_STORE: (0, settings_ui_1.pick)('음악 목록을 읽지 못했습니다. 원본은 보존됩니다.', 'The music list could not be read. The original is preserved.'), UNKNOWN_TRACK: (0, settings_ui_1.pick)('이 음악은 목록에 없습니다.', 'This track is no longer in the list.'), MUSIC_FULL: (0, settings_ui_1.pick)('음악은 최대 20곡까지 보관할 수 있습니다.', 'You can keep up to 20 tracks.'), INVALID_AUDIO: (0, settings_ui_1.pick)('50MB 이하의 지원되는 음악 파일을 선택해 주세요.', 'Choose a supported audio file no larger than 50 MB.'), CONFLICT: (0, settings_ui_1.pick)('다른 곳에서 수정된 기록입니다. 다시 열어 주세요.', 'This record changed elsewhere. Reopen it.'), INVALID_RECORD: (0, settings_ui_1.pick)('제목과 본문 길이를 확인해 주세요.', 'Check the title and text length.'), FULL: (0, settings_ui_1.pick)('보관 가능한 기록 수에 도달했습니다.', 'The record limit has been reached.'), INVALID_STORE: (0, settings_ui_1.pick)('기록 파일을 읽지 못했습니다. 원본은 보존됩니다.', 'The record file could not be read. The original is preserved.') };
    return map[code] || code;
};
let musicStore;
const music = () => musicStore ??= new room_music_1.RoomMusic(path.join(electron_1.app.getPath('userData'), 'private-room-music'));
let broadcastIdentity = '', broadcasts = [];
function currentBroadcasts() { const id = JSON.stringify([ctx_1.ctx.curSaveId, game_link_1.link.epoch]); if (id !== broadcastIdentity) {
    broadcastIdentity = id;
    broadcasts = [];
} return broadcasts; }
let trophyStore;
const trophies = () => trophyStore ??= new room_trophies_1.RoomTrophies(path.join(electron_1.app.getPath('userData'), 'private-room-trophies'));
const paying = new Set();
/** Gift letters go to regular contacts of the current save (no talk-only special empires, never the player) or to our own leaders (not the ruler). */
function empireTargets() { const v = (0, terminal_1.terminalView)(); if (!ctx_1.ctx.curSaveId || v.sid !== ctx_1.ctx.curSaveId)
    return []; return v.items.filter(c => !c.talkOnly && c.idx !== ctx_1.ctx.playerIdx).map(c => ({ kind: 'empire', idx: c.idx, name: c.name, ruler: ctx_1.ctx.profiles.get(c.idx)?.ruler || '' })); }
function ourPeople() { try {
    return ((0, office_app_2.officeView)().people || []).filter(p => p && typeof p.key === 'string' && p.role !== 'ruler' && p.name);
}
catch {
    return [];
} }
function personTargets() { return ourPeople().map(p => ({ kind: 'person', key: p.key, name: p.name, role: p.role })); }
const personPresent = (key) => ourPeople().some(p => p.key === key);
function deliveryCheck(to) {
    if (to.kind === 'person') {
        const people = ourPeople();
        if (!people.length)
            return 'unknown';
        return people.some(p => p.key === to.key) ? 'ok' : 'gone';
    }
    const v = (0, terminal_1.terminalView)();
    if (!ctx_1.ctx.curSaveId || v.sid !== ctx_1.ctx.curSaveId)
        return 'unknown';
    return v.items.some(c => c.idx === to.idx && !c.talkOnly) ? 'ok' : 'gone';
}
/** Deliver due letters for the current save and record each receipt in that empire's relationship chronicle (its leader remembers the gift). */
function settleTrophies(sid) {
    if (!sid || sid !== ctx_1.ctx.curSaveId || !ctx_1.ctx.gameDate || !game_link_1.link.sessionReady)
        return;
    const r = trophies().settle(sid, ctx_1.ctx.gameDate, deliveryCheck);
    for (const t of r.delivered) {
        if (t.recipient?.kind === 'person') {
            const title = t.details.title;
            try {
                (0, persona_app_1.personaNote)(sid, t.recipient.key, (0, settings_ui_1.pick)(`통치자에게서 트로피 「${title}」을(를) 서신으로 선물받았다`, `Received the trophy "${title}" from the ruler by letter`));
            }
            catch { /* Person memory is best effort; ownership is already recorded. */ }
            continue;
        }
        const to = t.recipient, title = t.details.title, who = to.ruler || (0, settings_ui_1.pick)('상대 지도자', 'their leader'), memo = t.details.event ? (0, settings_ui_1.pick)(` — 기념: ${t.details.event.slice(0, 120)}`, ` — commemorating: ${t.details.event.slice(0, 120)}`) : '';
        (0, chronicle_app_1.chronPut)(to.idx, to.date, (0, settings_ui_1.pick)(`외교 서신으로 트로피 「${title}」을(를) 선물했고 ${who}이(가) 받았다${memo}`, `Sent the trophy "${title}" as a gift by diplomatic letter; ${who} received it${memo}`), true, { ruler: to.ruler || undefined, name: to.name });
    }
}
function registerPrivateRooms(router) {
    (0, gamestate_app_1.onGameSnapshot)(snap => { try {
        if (snap.sid === ctx_1.ctx.curSaveId)
            settleTrophies(snap.sid);
    }
    catch { /* Busy or unreadable store: letters stay in transit and settle on the next look. */ } });
    router.on(log_router_1.SLOT.ROOM_TROPHIES, 'rooms:trophy-payment', m => { if (m.kind === 'TROPHYPAY')
        terminal_1.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); });
    electron_1.ipcMain.handle('roomsTrophies', async (e, token) => { try {
        const a = session(e, token);
        try {
            settleTrophies(a.sid);
        }
        catch { /* Reading must still work while another writer holds the store. */ }
        return { ok: true, state: trophies().read(a.sid) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsTrophyTargets', async (e, token, refresh) => {
        try {
            session(e, token);
            if (refresh === true) {
                if (!ctx_1.ctx.gameRunning)
                    throw Error((0, settings_ui_1.pick)('게임이 켜져 있어야 연락처를 갱신할 수 있습니다.', 'The game must be running to refresh contacts.'));
                const req = ++game_link_1.link.reqCounter;
                await (0, terminal_1.terminalRequest)('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
                session(e, token);
            }
            return { ok: true, targets: empireTargets(), people: personTargets(), contactsDate: (0, terminal_1.terminalView)().sid === ctx_1.ctx.curSaveId ? (0, terminal_1.terminalView)().date : '' };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    electron_1.ipcMain.handle('roomsTrophySend', async (e, token, revision, id, idx, note) => { try {
        const a = session(e, token);
        const to = typeof idx === 'string' && /^(p|adm|gov):/.test(idx) ? personTargets().find(x => x.key === idx) : empireTargets().find(x => x.idx === Number(idx));
        if (!to)
            throw Error('INVALID_RECIPIENT');
        return { ok: true, state: trophies().send(a, revision, id, to, note) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsTrophyCancelLetter', async (e, token, revision, id) => { try {
        const a = session(e, token);
        return { ok: true, state: trophies().cancelDelivery(a, revision, id) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsTrophyExport', async (e, token) => {
        try {
            const a = session(e, token), s = trophies().read(a.sid);
            const content = JSON.stringify({ format: 'sllm-trophy-ledger', version: 1, campaignId: a.sid, exportedAt: a.date, items: s.items, requests: s.requests, history: s.history }, null, 2);
            const result = await electron_1.dialog.showSaveDialog(office_app_1.office.win, { defaultPath: 'SLLM-trophies.json', filters: [{ name: (0, settings_ui_1.pick)('트로피 원장 JSON', 'Trophy ledger JSON'), extensions: ['json'] }] });
            session(e, token);
            if (result.canceled || !result.filePath)
                return { ok: true, cancelled: true };
            const temp = result.filePath + '.' + (0, crypto_1.randomUUID)() + '.tmp';
            try {
                fs.writeFileSync(temp, content, { encoding: 'utf8', flag: 'wx' });
                fs.renameSync(temp, result.filePath);
            }
            finally {
                if (fs.existsSync(temp))
                    fs.unlinkSync(temp);
            }
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    // recover modes for an unconfirmed request: 'check' (default) only reads the game flag; 'retry' re-sends the same request id (the game skips the charge if its flag already exists); 'cancel' re-checks and cancels only when the game confirms no payment happened.
    electron_1.ipcMain.handle('roomsTrophyCreate', async (e, token, revision, input, recoverId, mode) => {
        let sid = '', acquired = false;
        try {
            const a = session(e, token);
            sid = a.sid;
            if (paying.has(sid))
                throw Error('PAYMENT_PENDING');
            paying.add(sid);
            acquired = true;
            if (recoverId && mode !== undefined && !['check', 'retry', 'cancel'].includes(mode))
                throw Error('INVALID_TROPHY');
            const prepared = recoverId ? trophies().read(sid).requests.find(x => x.id === recoverId && x.status === 'pending') : trophies().prepare(a, revision, input).request;
            if (!prepared)
                throw Error('INVALID_TROPHY');
            const req = ++game_link_1.link.reqCounter, epoch = game_link_1.link.epoch, idx = ctx_1.ctx.playerIdx;
            const result = await (0, terminal_1.terminalRequest)((0, room_trophies_1.trophyPaymentCommand)(req, sid, idx, prepared.id, !recoverId || mode === 'retry'), 'TROPHYPAY', req);
            if (epoch !== game_link_1.link.epoch || sid !== ctx_1.ctx.curSaveId || result.kv.sid !== sid || result.kv.id !== prepared.id)
                throw Error('PAYMENT_PENDING');
            if (recoverId && mode === 'cancel') {
                if (result.kv.status !== 'missing')
                    throw Error('PAYMENT_NOT_MISSING');
                const state = trophies().cancelUnpaid(a, prepared.id);
                return { ok: true, state, pending: state.requests.some(x => x.status === 'pending'), status: 'cancelled' };
            }
            const state = trophies().receipt(sid, prepared.id, result.kv.status);
            return { ok: true, state, pending: state.requests.some(x => x.status === 'pending'), status: result.kv.status };
        }
        catch (e) {
            let state;
            try {
                if (sid)
                    state = trophies().read(sid);
            }
            catch { /* Preserve the original failure and never replace unreadable records. */ }
            return { ok: false, error: errorText(e), state };
        }
        finally {
            if (acquired)
                paying.delete(sid);
        }
    });
    electron_1.ipcMain.handle('roomsTrophyChange', async (e, token, revision, id, action, input) => {
        try {
            const a = session(e, token);
            const before = trophies().read(a.sid).items.find(x => x.id === id && !x.deleted);
            const state = trophies().change(a, revision, id, action, input, (0, secretary_app_1.secretaryRoomState)().ready, personPresent);
            if (action === 'reclaim' && before?.owner === 'person' && before.recipient?.key) {
                const title = before.details.title;
                try {
                    (0, persona_app_1.personaNote)(a.sid, before.recipient.key, (0, settings_ui_1.pick)(`통치자가 선물했던 트로피 「${title}」을(를) 회수했다`, `The ruler took back the trophy "${title}" they had given`));
                }
                catch { /* best effort */ }
            }
            return { ok: true, state };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    electron_1.ipcMain.handle('roomsCompanion', async (e, token, action) => {
        try {
            session(e, token);
            const sec = (0, secretary_app_1.secretaryRoomState)();
            if (!['call', 'sit', 'leave', 'get'].includes(action))
                throw Error('INVALID_ROOM');
            if (action === 'leave') {
                companions.delete(e.sender.id);
                return { ok: true, pose: 'alone' };
            }
            if (!sec.ready || !((sec.aff ?? -1) >= 20)) {
                companions.delete(e.sender.id);
                if (action === 'get')
                    return { ok: true, pose: 'alone' };
                throw Error((0, settings_ui_1.pick)('현재 통치자와의 호감도가 20 이상이어야 합니다.', 'The current ruler needs at least 20 affinity.'));
            }
            const prior = companions.get(e.sender.id);
            if (action === 'call')
                companions.set(e.sender.id, { token, pose: 'standing' });
            if (action === 'sit') {
                if (!prior || prior.token !== token || prior.pose !== 'standing')
                    throw Error((0, settings_ui_1.pick)('먼저 비서를 불러 주세요.', 'Call your secretary first.'));
                companions.set(e.sender.id, { token, pose: 'seated' });
            }
            const current = companions.get(e.sender.id);
            return { ok: true, pose: current && current.token === token ? current.pose : 'alone' };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    electron_1.ipcMain.handle('roomsRadioPublish', async (e, b) => {
        if (!radio_app_1.radio.win || radio_app_1.radio.win.isDestroyed() || e.sender !== radio_app_1.radio.win.webContents || e.senderFrame !== e.sender.mainFrame || !game_link_1.link.sessionReady || !radio_app_1.radio.on)
            return false;
        if (!b || !Array.isArray(b.lines) || b.lines.length > 40)
            return false;
        const lines = b.lines.filter((x) => x && typeof x.text === 'string').map((x) => String(b.names?.[x.who] || x.who || '') + ': ' + x.text.slice(0, 3000));
        if (!lines.length)
            return false;
        const list = currentBroadcasts();
        list.push({ id: (0, crypto_1.randomUUID)(), station: String(b.station || '').slice(0, 200), date: String(b.date || '').slice(0, 60), lines });
        if (list.length > 12)
            list.shift();
        return true;
    });
    electron_1.ipcMain.handle('roomsRadio', async (e, token, action) => { try {
        session(e, token);
        if (action !== undefined && !['play', 'stop'].includes(action))
            throw Error('INVALID_ROOM');
        if (action === 'play')
            (0, radio_app_1.setRadio)(true);
        if (action === 'stop')
            (0, radio_app_1.setRadio)(false);
        const list = currentBroadcasts();
        return { ok: true, state: (0, radio_app_1.radioState)(), broadcast: list.at(-1) || null };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsMusicConfigure', async (e, token, input) => { try {
        const a = session(e, token);
        return { ok: true, prefs: music().configure(a.sid, input), tracks: music().list(a.sid) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsShare', async (e, token, req) => {
        try {
            const a = session(e, token), sec = (0, secretary_app_1.secretaryRoomState)();
            if (!req || typeof req.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(req.requestId))
                throw Error('INVALID_CHAT');
            const r = records().read(a.sid).records.find(x => x.id === req.recordId && !x.deleted);
            if (!r || r.revision !== req.revision || !Number.isInteger(req.page) || req.page < 0 || req.page * 640 >= Array.from(r.text).length)
                throw Error('INVALID_PAGE');
            if ((r.kind === 'journal' && req.room !== 'private') || (r.kind === 'book' && req.room !== 'reading'))
                throw Error('INVALID_ROOM');
            if (!sec.ready || !((sec.aff ?? -1) >= (r.kind === 'journal' ? 20 : 10)))
                throw Error((0, settings_ui_1.pick)('현재 통치자와의 관계 조건을 충족해야 합니다.', 'The current ruler must meet the relationship requirement.'));
            const fingerprint = (0, crypto_1.createHash)('sha256').update(JSON.stringify(['shared-reading', a.rulerId, r.id, r.revision, req.page])).digest('hex');
            const prior = activities().read(a.sid).find(x => x.id === req.requestId);
            if (prior && prior.fingerprint !== fingerprint)
                throw Error('CONFLICT');
            activities().append({ id: req.requestId, fingerprint, kind: 'shared-reading', author: r.author, authorshipUnverified: !!r.imported, actor: a, secretaryId: 'primary', room: req.room, subjectId: r.id, subjectTitle: r.title, question: '', reply: '', pose: 'idle', name: sec.name });
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    electron_1.ipcMain.handle('roomsMusic', async (e, token) => { try {
        const a = session(e, token);
        return { ok: true, tracks: music().list(a.sid), prefs: music().prefs(a.sid) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsMusicAdd', async (e, token) => { try {
        const a = session(e, token), result = await electron_1.dialog.showOpenDialog(office_app_1.office.win, { properties: ['openFile'], filters: [{ name: (0, settings_ui_1.pick)('음악', 'Music'), extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'webm'] }] });
        session(e, token);
        if (result.canceled)
            return { ok: true, tracks: music().list(a.sid), prefs: music().prefs(a.sid) };
        return { ok: true, tracks: music().add(a.sid, result.filePaths[0]), prefs: music().prefs(a.sid) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsMusicDelete', async (e, token, id) => { try {
        const a = session(e, token);
        return { ok: true, tracks: music().remove(a.sid, id), prefs: music().prefs(a.sid) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsState', async (e) => { try {
        sender(e);
        const a = actor(), id = identity(a);
        let s = sessions.get(e.sender.id);
        if (!s || s.identity !== id) {
            s = { token: (0, crypto_1.randomUUID)(), identity: id };
            sessions.set(e.sender.id, s);
            e.sender.once('destroyed', () => { sessions.delete(e.sender.id); companions.delete(e.sender.id); });
        }
        return { ok: true, token: s.token, actor: a, secretary: (0, secretary_app_1.secretaryRoomState)(), records: records().read(a.sid).records.filter(r => !r.deleted) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsSave', async (e, token, input) => { try {
        const a = session(e, token);
        return { ok: true, record: records().save(a, input) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsImport', async (e, token, kind) => {
        try {
            const a = session(e, token);
            if (kind !== 'book' && kind !== 'journal')
                throw Error('INVALID_RECORD');
            const selected = await electron_1.dialog.showOpenDialog(office_app_1.office.win, { properties: ['openFile'], filters: [{ name: (0, settings_ui_1.pick)('기록 파일', 'Writing files'), extensions: ['json', 'txt', 'md'] }] });
            session(e, token);
            if (selected.canceled || !selected.filePaths[0])
                return { ok: true, cancelled: true };
            const file = selected.filePaths[0], fileName = path.basename(file), fd = fs.openSync(file, 'r');
            let content;
            try {
                if (!fs.fstatSync(fd).isFile() || fs.fstatSync(fd).size > 4 * 1024 * 1024)
                    throw Error('IMPORT_SIZE');
                const bytes = Buffer.alloc(4 * 1024 * 1024 + 1);
                const n = fs.readSync(fd, bytes, 0, bytes.length, 0);
                if (n > 4 * 1024 * 1024)
                    throw Error('IMPORT_SIZE');
                content = bytes.subarray(0, n).toString('utf8');
            }
            finally {
                fs.closeSync(fd);
            }
            const copies = (0, room_import_1.parseRoomImport)(content, fileName, kind), revision = records().read(a.sid).revision;
            const count = copies.length, archived = copies.filter(x => x.deleted).length;
            const confirm = await electron_1.dialog.showMessageBox(office_app_1.office.win, { type: 'question', buttons: [(0, settings_ui_1.pick)('취소', 'Cancel'), (0, settings_ui_1.pick)('사본 추가', 'Add copies')], defaultId: 0, cancelId: 0, message: (0, settings_ui_1.pick)(`${count}개 기록을 새 사본으로 추가할까요?`, `Add ${count} records as new copies?`), detail: (0, settings_ui_1.pick)(`삭제 보관 기록 ${archived}개 포함. 기존 기록은 유지됩니다. 파일 속 저자는 외부 자료에 적힌 정보로 보관하며, 가져온 통치자와 구분합니다.`, `Includes ${archived} archived records. Existing records are preserved. Authorship from the file is stored as external information, separately from the importing ruler.`) });
            session(e, token);
            if (confirm.response !== 1)
                return { ok: true, cancelled: true };
            const added = records().importCopies(a, revision, kind, content, fileName);
            return { ok: true, count: added.length };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    electron_1.ipcMain.handle('roomsArchive', async (e, token) => { try {
        const a = session(e, token);
        return { ok: true, records: records().read(a.sid).records };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsRestore', async (e, token, id, revision) => { try {
        const a = session(e, token);
        return { ok: true, record: records().restore(a, id, revision) };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsExport', async (e, token, kind, includeArchived) => {
        try {
            const a = session(e, token);
            if (typeof includeArchived !== 'boolean')
                throw Error('INVALID_RECORD');
            const content = records().export(a.sid, kind, includeArchived);
            const result = await electron_1.dialog.showSaveDialog(office_app_1.office.win, { defaultPath: `SLLM-${kind}.json`, filters: [{ name: (0, settings_ui_1.pick)('기록 JSON', 'Records JSON'), extensions: ['json'] }] });
            session(e, token);
            if (result.canceled || !result.filePath)
                return { ok: true, cancelled: true };
            const temp = result.filePath + '.' + (0, crypto_1.randomUUID)() + '.tmp';
            try {
                fs.writeFileSync(temp, content, { encoding: 'utf8', flag: 'wx' });
                fs.renameSync(temp, result.filePath);
            }
            finally {
                if (fs.existsSync(temp))
                    fs.unlinkSync(temp);
            }
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
    electron_1.ipcMain.handle('roomsDelete', async (e, token, id, revision) => { try {
        const a = session(e, token);
        records().remove(a.sid, id, revision);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: errorText(e) };
    } });
    electron_1.ipcMain.handle('roomsChat', async (e, token, req) => {
        try {
            const a = session(e, token);
            if (!req || !['private', 'reading', 'exhibition', 'secretary'].includes(req.room) || typeof req.text !== 'string' || !req.text.trim() || req.text.length > 1200)
                throw Error('INVALID_CHAT');
            if (typeof req.requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(req.requestId))
                throw Error('INVALID_CHAT');
            const fingerprint = (0, crypto_1.createHash)('sha256').update(JSON.stringify([a.rulerId, req.room, req.text, req.recordId, req.revision, req.page, req.broadcastId])).digest('hex');
            const cached = activities().read(a.sid).find(x => x.id === req.requestId);
            if (cached) {
                if (cached.fingerprint !== fingerprint)
                    throw Error('CONFLICT');
                return { ok: true, reply: cached.reply, pose: cached.pose, name: cached.name };
            }
            let reference = '', subjectTitle = '';
            if (req.recordId) {
                const r = records().read(a.sid).records.find(x => x.id === req.recordId && !x.deleted);
                if (!r || r.revision !== req.revision || !Number.isInteger(req.page) || req.page < 0)
                    throw Error('CONFLICT');
                if ((r.kind === 'journal' && req.room !== 'private') || (r.kind === 'book' && req.room !== 'reading'))
                    throw Error('INVALID_ROOM');
                const pages = Array.from(r.text);
                if (req.page * 640 >= pages.length)
                    throw Error('INVALID_PAGE');
                subjectTitle = r.title;
                reference = JSON.stringify({ title: r.title, author: r.author, authorship: r.imported ? "unverified external attribution" : "recorded in this campaign", currentReader: a, visiblePages: pages.slice(req.page * 640, req.page * 640 + 640).join('') });
            }
            if (req.broadcastId) {
                if (req.recordId || !['private', 'secretary'].includes(req.room))
                    throw Error('INVALID_ROOM');
                const b = currentBroadcasts().find(x => x.id === req.broadcastId);
                if (!b)
                    throw Error((0, settings_ui_1.pick)('이 방송은 현재 세션에 없습니다. TV에서 다시 선택해 주세요.', 'This broadcast is no longer available in this session. Select it again on the TV.'));
                reference = JSON.stringify({ type: 'quoted-radio-broadcast', broadcast: b });
                subjectTitle = b.station + ' ' + b.date;
            }
            const companion = companions.get(e.sender.id);
            if (req.room === 'private' && companion && companion.token === token) {
                reference += '\n' + JSON.stringify({ scene: 'watching TV together in the private room', secretaryPose: companion.pose });
            }
            const subjectId = req.recordId || (req.broadcastId ? 'radio:' + req.broadcastId : '');
            const memory = activities().relevant(a, req.room, subjectId);
            if (!subjectId) {
                for (const h of trophies().read(a.sid).history.filter(h => h.action === 'gift' || h.action === 'reclaim').slice(-4)) {
                    memory.push({ actor: h.actor, relation: h.actor.rulerId === a.rulerId ? 'current-ruler' : 'other-ruler', kind: 'trophy-' + h.action, creation: h.item?.creation, summary: JSON.stringify({ title: h.item?.details.title, description: h.item?.details.body, owner: h.item?.owner }).slice(0, 600) });
                }
                if (memory.length > 4)
                    memory.splice(0, memory.length - 4);
            }
            const reply = await (0, secretary_app_1.secretaryRoomReply)(a, req.room, req.text, reference, JSON.stringify(memory));
            session(e, token);
            let warning = '';
            try {
                activities().append({ id: req.requestId, fingerprint, actor: a, secretaryId: 'primary', room: req.room, subjectId, subjectTitle, question: req.text, reply: reply.reply, pose: reply.pose, name: reply.name });
            }
            catch {
                warning = (0, settings_ui_1.pick)('답변은 받았지만 대화 기록을 저장하지 못했습니다.', 'The reply arrived, but the conversation record could not be saved.');
            }
            return { ok: true, ...reply, warning };
        }
        catch (e) {
            return { ok: false, error: errorText(e) };
        }
    });
}
//# sourceMappingURL=private-rooms-app.js.map
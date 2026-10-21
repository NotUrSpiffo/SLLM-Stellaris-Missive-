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
exports.inboxStore = exports.mail = void 0;
exports.deferred = deferred;
exports.syncInbox = syncInbox;
exports.receiveLetter = receiveLetter;
exports.mailNote = mailNote;
exports.pickWriters = pickWriters;
exports.writeLetter = writeLetter;
exports.writeTreatyLetter = writeTreatyLetter;
exports.onMailSignal = onMailSignal;
exports.aiTick = aiTick;
exports.restartAiTimer = restartAiTimer;
exports.registerMail = registerMail;
// A-00b 6번: 외교 서신(앱 쪽) — 서신 후보 수집(MAILC·YEAR·YEAREND), 세계 사건(NEWS), AI가 먼저 보내는 편지, 조약 보류 서신,
// 서신함(inbox·openLetter), 서신·소문 자동 작업 타이머(aiTick). 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// onMailSignal 은 플레이어 이름·번호(IDX)와 게임 날짜(MONTH·YEAR)도 정한다 — 원래 한 함수였던 그대로 옮겼다(SLOT.MAIL).
// 답장(replyLetter)은 단말기를 옮길 때 같이 옮겼다(단말기 연결 dialTerminal 을 쓰고, 대화 상태는 ctx 로 바꾼다).
const electron_1 = require("electron");
const path = __importStar(require("path"));
const deferred_1 = require("../deferred");
const inbox_store_1 = require("../inbox-store");
const mail_1 = require("../mail");
const action_1 = require("../action");
const chronicle_1 = require("../chronicle");
const settings_1 = require("../app/settings");
const log_router_1 = require("../app/log-router");
const chronicle_app_1 = require("./chronicle-app");
const radio_app_1 = require("./radio-app");
const media_1 = require("./media");
const speech_app_1 = require("./speech-app");
const action_2 = require("../action");
const game_link_1 = require("../app/game-link");
const terminal_1 = require("./terminal");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
exports.mail = {
    /** 최근 사건(편지 재료). 2년이 지나면 버린다. */
    news: [],
    /** 올해 연락 중인 제국들(YEAR ~ YEAREND 사이에 모은다) */
    roll: [],
    rollDate: '',
    plan: new mail_1.MailPlan(),
    /** 서신 후보 제국(MAILC) */
    countries: new Map(),
    /** 지금 세이브·시간선의 서신함 */
    inbox: [],
    /** 답장 연결 중 */
    replyBusy: false,
};
let deferStore = null;
function deferred() { return (deferStore ??= new deferred_1.DeferredStore(path.join(electron_1.app.getPath('userData'), 'sllm_deferred.json'))); }
let inboxStoreInst = null;
const inboxStore = () => (inboxStoreInst ??= new inbox_store_1.InboxStore(path.join(electron_1.app.getPath('userData'), 'sllm_inbox.json')));
exports.inboxStore = inboxStore;
function syncInbox() {
    exports.mail.inbox = ctx_1.ctx.curSaveId ? ctx_1.ctx.govMem().split(ctx_1.ctx.curSaveId, (0, exports.inboxStore)().list(ctx_1.ctx.curSaveId)).own : [];
    ctx_1.ctx.toUi('inboxState', exports.mail.inbox);
    ctx_1.ctx.updateBadge();
    if ((0, exports.inboxStore)().error)
        mailNote((0, settings_ui_1.pick)('편지 저장 오류: ', 'Letter storage error: ') + (0, exports.inboxStore)().error);
}
function receiveLetter(sid, branch, letter) {
    const saved = (0, exports.inboxStore)().add(sid, branch, letter);
    if (sid !== ctx_1.ctx.curSaveId)
        return;
    syncInbox();
    ctx_1.ctx.toUi('mail', saved);
    ctx_1.ctx.notify({ kind: 'letter', title: (0, settings_ui_1.pick)('외교 서신 도착', 'Diplomatic letter received'), body: (0, settings_ui_1.pick)(saved.name + '에게서 편지가 왔습니다.', `A letter has arrived from ${saved.name}.`) });
}
const LEAN_EN = { positive: 'favorable', neutral: 'undecided', negative: 'unfavorable' };
function mailNote(text) { ctx_1.ctx.toUi('mailstatus', text); }
async function pickWriters() {
    if (!settings_1.settings.mailEnabled || !exports.mail.roll.length)
        return;
    const sid = ctx_1.ctx.curSaveId, date = exports.mail.rollDate, list = exports.mail.roll.slice();
    try {
        const raw = await ctx_1.ctx.ai.chat((0, mail_1.pickMessages)(ctx_1.ctx.playerName || (0, settings_ui_1.pick)('플레이어 제국', 'Player empire'), date, list, exports.mail.news, (0, media_1.currentPaper)()), { maxTokens: 600 });
        const writers = (0, mail_1.parsePick)(raw, list.map((c) => c.idx));
        if (sid !== ctx_1.ctx.curSaveId)
            return;
        exports.mail.plan.set(date, writers);
        mailNote((0, settings_ui_1.pick)(`${date}: 올해 편지를 보낼 제국 ${writers.length}곳을 정했습니다.`, `${date}: chose ${writers.length} empire(s) to write letters this year.`));
    }
    catch (e) {
        mailNote((0, settings_ui_1.pick)('편지 상대 고르기 실패: ', 'Failed to choose letter writers: ') + e.message);
    }
}
async function writeLetter(idx, why) {
    const c = exports.mail.countries.get(idx);
    if (!c || !settings_1.settings.mailEnabled || !ctx_1.ctx.curSaveId)
        return;
    const sid = ctx_1.ctx.curSaveId, branch = ctx_1.ctx.govMem().currentBranch(sid), date = ctx_1.ctx.gameDate;
    try {
        const raw = await ctx_1.ctx.ai.chat((0, mail_1.letterMessages)(ctx_1.ctx.playerName || (0, settings_ui_1.pick)('플레이어 제국', 'Player empire'), date, { ...c, profile: ctx_1.ctx.profileWithEthics(c.profile, idx) }, why, exports.mail.news, (0, media_1.currentPaper)()), { maxTokens: 1200 });
        const r = (0, action_1.parseReply)(raw);
        if (!r.say)
            return;
        const proposal = ctx_1.ctx.actionsAllowed(idx) && r.action && mail_1.LETTER_ACTIONS.has(r.action.type) ? r.action : null;
        receiveLetter(sid, branch, { idx, name: c.name, date, text: r.say, proposal, expires: (0, mail_1.addYears)(date, 2), read: false });
    }
    catch (e) {
        mailNote((0, settings_ui_1.pick)(`${c.name}의 편지 쓰기 실패: `, `Failed to write ${c.name}'s letter: `) + e.message);
    }
}
/** 조약 얼버무리기: 약속한 서신을 보낸다(편지 기능을 꺼 두어도 보낸다. 플레이어가 직접 청한 일에 대한 답이다). */
async function writeTreatyLetter(d) {
    if (!ctx_1.ctx.curSaveId)
        return;
    const sid = ctx_1.ctx.curSaveId, branch = ctx_1.ctx.govMem().currentBranch(sid);
    const known = exports.mail.countries.get(d.idx);
    const prof = d.profile ?? known?.profile ?? ctx_1.ctx.profiles.get(d.idx);
    if (!prof)
        return;
    const c = { idx: d.idx, name: d.name, op: d.op, profile: ctx_1.ctx.profileWithEthics(prof, d.idx) };
    try {
        const raw = await ctx_1.ctx.ai.chat((0, mail_1.treatyLetterMessages)(ctx_1.ctx.playerName || (0, settings_ui_1.pick)('플레이어 제국', 'Player empire'), d.due, c, d.topic, d.lean, exports.mail.news), { maxTokens: 1200 });
        const r = (0, action_1.parseReply)(raw);
        if (!r.say)
            return;
        receiveLetter(sid, branch, { idx: d.idx, name: d.name, date: d.due, text: r.say, proposal: null, expires: (0, mail_1.addYears)(d.due, 2), read: false });
        if (sid === ctx_1.ctx.curSaveId)
            (0, chronicle_app_1.chronNote)(d.idx, (0, settings_ui_1.pick)('"' + d.topic + '" 건을 서신으로 답했다(결론: ' + deferred_1.LEAN_KO[d.lean] + ')', 'Answered "' + d.topic + '" by letter (conclusion: ' + LEAN_EN[d.lean] + ')'));
    }
    catch (e) {
        mailNote((0, settings_ui_1.pick)(`${d.name}의 서신 쓰기 실패: `, `Failed to write ${d.name}'s letter: `) + e.message);
    }
}
function onMailSignal(m) {
    if (m.kind === 'IDX' && m.kv.name) {
        const ii = Number(m.kv.idx);
        if (Number.isFinite(ii) && ii > 0)
            chronicle_app_1.idxNames.set(ii, m.kv.name.slice(0, 60));
    }
    if (m.kind === 'IDX' && m.kv.rel === 'self' && m.kv.name) {
        ctx_1.ctx.playerName = m.kv.name;
        const pi = Number(m.kv.idx);
        if (Number.isFinite(pi) && pi > 0)
            ctx_1.ctx.playerIdx = pi;
    }
    if ((m.kind === 'MONTH' || m.kind === 'YEAR') && m.kv.date) {
        if (m.kind === 'MONTH')
            ctx_1.ctx.onMonthTick();
        ctx_1.ctx.gameDate = m.kv.date;
        if (ctx_1.ctx.curSaveId)
            ctx_1.ctx.govMem().track(ctx_1.ctx.curSaveId, ctx_1.ctx.gameDate);
        void (0, media_1.publishExtra)(m.kv.date);
    }
    const n = (0, mail_1.newsFrom)(m);
    if (n) {
        exports.mail.news.push(n);
        (0, media_1.noteExtra)(n.kind, n.date || ctx_1.ctx.gameDate, (0, mail_1.newsText)(n)); // 호외 후보(큰 사건)
        { // 성간 라디오: 세계 사건(NEWS)도 라디오 연대기와 대기열에 넣는다(F-03)
            const text = (0, mail_1.newsText)(n), date = n.date || ctx_1.ctx.gameDate, uid = ['news', n.kind, date, n.a ?? n.aname ?? '', n.b ?? n.bname ?? '', n.war ?? ''].join('|');
            (0, chronicle_app_1.chronPut)(chronicle_1.RADIO_IDX, date, text, false, { name: '성간라디오 전용 연대기', world: true, uid });
            if (radio_app_1.radio.on && !(0, radio_app_1.radioAired)().has(ctx_1.ctx.curSaveId, uid) && radio_app_1.radio.q.push({ kind: 'news_' + n.kind, date, text, n: 0, id: uid }))
                radio_app_1.radio.win?.webContents.send('radioQueue', radio_app_1.radio.q.size);
        }
        { // 연대기: 플레이어와 AI 사이의 일, 또는 그 AI 의 새 지도자
            const ev = (0, mail_1.newsText)(n);
            const other = (x) => x !== undefined && x > 0 && x !== ctx_1.ctx.playerIdx;
            if (ctx_1.ctx.playerIdx > 0 && (n.a === ctx_1.ctx.playerIdx || n.b === ctx_1.ctx.playerIdx)) {
                const o = n.a === ctx_1.ctx.playerIdx ? n.b : n.a;
                if (other(o))
                    (0, chronicle_app_1.chronNote)(o, ev);
            }
            else if (n.kind === 'ruler' && other(n.a))
                (0, chronicle_app_1.chronNote)(n.a, ev, false, true);
            else if (mail_1.MAJOR_WORLD.has(n.kind)) { // AI 끼리는 큰 사건(전쟁·연방·연합·협정·위기·멸망·조공국화)만 남긴다. 번호가 없으면 이름으로, 그것도 없으면 세계 소식으로
                let put = false;
                for (const [x, nm] of [[n.a, n.aname], [n.b, n.bname]]) {
                    if (x !== undefined && x > 0) {
                        (0, chronicle_app_1.chronNote)(x, ev, false, true);
                        put = true;
                    }
                    else if (nm && (0, chronicle_app_1.chronNoteByName)(nm, ev))
                        put = true;
                }
                if (!put)
                    (0, chronicle_app_1.chronNoteWorld)(ev);
            }
        }
        if (ctx_1.ctx.gameDate)
            exports.mail.news = exports.mail.news.filter((x) => !x.date || (0, mail_1.cmpDate)(x.date, (0, mail_1.addYears)(ctx_1.ctx.gameDate, -2)) >= 0);
    }
    if (m.kind === 'YEAR') {
        exports.mail.roll = [];
        exports.mail.rollDate = m.kv.date ?? '';
        if (m.kv.date)
            void (0, media_1.publishNews)(m.kv.date);
    }
    const c = (0, mail_1.mailCountryFrom)(m);
    if (c) {
        exports.mail.roll.push(c);
        exports.mail.countries.set(c.idx, c);
    }
    if (m.kind === 'YEAREND')
        void pickWriters();
    if (m.kind === 'MONTH' && m.kv.date && ctx_1.ctx.curSaveId) {
        for (const d of deferred().due(ctx_1.ctx.curSaveId, m.kv.date))
            void writeTreatyLetter(d);
    }
    if (m.kind === 'MONTH' && m.kv.date && ctx_1.ctx.curSaveId) {
        const sid = ctx_1.ctx.curSaveId, justReady = (0, speech_app_1.speechStore)().tick(sid, m.kv.date);
        // 10-15: 이미 준비가 끝난 채로 불러온 세이브도 앱을 켠 뒤 첫 월 신호에 한 번 알린다.
        if (justReady || ((0, speech_app_1.speechStore)().get(sid).phase === 'ready' && speechReadyNotified !== sid)) {
            speechReadyNotified = sid;
            ctx_1.ctx.notify({ kind: 'speech', title: (0, settings_ui_1.pick)('연설 준비 완료', 'Speech ready'), body: (0, settings_ui_1.pick)('연설 준비가 완료되었습니다. 연설 하시겠습니까?', 'Your speech is ready. Will you give it now?'), action: (0, settings_ui_1.pick)('연설하기', 'Give speech') });
            (0, speech_app_1.pushSpeech)();
        }
    }
}
let speechReadyNotified = '';
/** 실시간 타이머로 AI 가 먼저 하는 일(서신)을 하나씩 처리한다. 앱이 열려 있는 동안은 게임이 멈춘 것으로 보고 쉰다. */
let aiBusy = false;
async function aiTick() {
    if (aiBusy || ctx_1.ctx.appOpen || !ctx_1.ctx.gameRunning || !ctx_1.ctx.curSaveId)
        return;
    aiBusy = true;
    try {
        const w = settings_1.settings.mailEnabled ? exports.mail.plan.takeOne() : null;
        if (w)
            await writeLetter(w.idx, w.why);
        else if (settings_1.settings.gossipOn)
            await (0, media_1.makeGossip)();
    }
    catch (e) {
        mailNote((0, settings_ui_1.pick)('AI 자동 작업 실패: ', 'Automatic AI task failed: ') + e.message);
    }
    finally {
        aiBusy = false;
    }
}
let aiTimer = null;
function restartAiTimer() { if (aiTimer)
    clearInterval(aiTimer); aiTimer = setInterval(() => { void aiTick(); }, Math.min(30, Math.max(1, settings_1.settings.aiEveryMin)) * 60000); }
// Reading a letter is local; replying refreshes the game connection first.
function registerMail(router) {
    router.on(log_router_1.SLOT.MAIL, 'mail:mail', (m) => {
        onMailSignal(m);
    });
    router.on(log_router_1.SLOT.INBOX_SYNC, 'mail:inbox_sync', (m) => {
        if (m.kind === 'LOADED' || m.kind === 'MONTH')
            syncInbox();
    });
    electron_1.ipcMain.handle('inbox', async () => exports.mail.inbox);
    /** 외교 서신 모두 읽음 표시(2026-10-18). 편지를 열지 않고 읽음만 바꾼다(AI 호출 없음). */
    electron_1.ipcMain.handle('inboxReadAll', async () => {
        const sid = ctx_1.ctx.curSaveId;
        if (!sid)
            return exports.mail.inbox;
        const ids = exports.mail.inbox.filter((l) => l.sid === sid && !l.read).map((l) => l.id);
        for (const id of ids) {
            try {
                (0, exports.inboxStore)().markRead(sid, id);
            }
            catch { /* 다른 시간선 편지 */ }
        }
        if (ids.length)
            syncInbox();
        return exports.mail.inbox;
    });
    electron_1.ipcMain.handle('openLetter', async (_e, id) => {
        const l = exports.mail.inbox.find(x => x.id === id);
        if (!l || l.sid !== ctx_1.ctx.curSaveId)
            throw new Error((0, settings_ui_1.pick)('현재 세이브의 편지를 찾지 못했습니다.', 'Letter not found in the current save.'));
        (0, exports.inboxStore)().markRead(l.sid, id);
        syncInbox();
        return { letter: { ...l, read: true }, expired: !!l.proposal && !!ctx_1.ctx.gameDate && (0, mail_1.cmpDate)(ctx_1.ctx.gameDate, l.expires) > 0 };
    });
    electron_1.ipcMain.handle('replyLetter', async (_e, id) => {
        const l = exports.mail.inbox.find(x => x.id === id), sid = ctx_1.ctx.curSaveId;
        if (!l || l.sid !== sid)
            return { ok: false, error: (0, settings_ui_1.pick)('현재 세이브의 편지를 찾지 못했습니다.', 'Letter not found in the current save.') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: (0, settings_ui_1.pick)('편지는 읽을 수 있지만 답장 연결에는 실행 중인 게임이 필요합니다.', 'You can read the letter, but replying needs the game running.') };
        if (exports.mail.replyBusy || ctx_1.ctx.pend || ctx_1.ctx.pending)
            return { ok: false, error: (0, settings_ui_1.pick)('진행 중인 통신과 제안을 마친 뒤 답장해 주세요.', 'Finish the current call and proposal before replying.') };
        exports.mail.replyBusy = true;
        try {
            const req = ++game_link_1.link.reqCounter;
            await (0, terminal_1.terminalRequest)('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
            if (ctx_1.ctx.curSaveId !== sid || !exports.mail.inbox.some(x => x.id === id))
                return { ok: false, error: (0, settings_ui_1.pick)('세이브 또는 시간선이 바뀌었습니다.', 'The save or timeline changed.') };
            const linked = await (0, terminal_1.dialTerminal)({ sid, idx: l.idx });
            if (!linked.ok)
                return linked;
            if (ctx_1.ctx.curSaveId !== sid || !ctx_1.ctx.talk || ctx_1.ctx.talk.idx !== l.idx || !exports.mail.inbox.some(x => x.id === id))
                return { ok: false, error: (0, settings_ui_1.pick)('통신 상대 또는 세이브가 바뀌었습니다.', 'The contact or save changed.') };
            (0, exports.inboxStore)().markRead(sid, id);
            syncInbox();
            ctx_1.ctx.history.push({ role: 'assistant', content: JSON.stringify({ say: l.text, mood: 'none', action: { type: 'none' } }) });
            ctx_1.ctx.lastSay = l.text;
            let proposal = null;
            const expired = !!ctx_1.ctx.gameDate && (0, mail_1.cmpDate)(ctx_1.ctx.gameDate, l.expires) > 0;
            if (l.proposal && !l.proposalHandled && !expired) {
                ctx_1.ctx.pending = { id: ++ctx_1.ctx.pendingSeq, action: l.proposal, tid: l.idx, aiName: l.name, letterId: l.id, letterSid: sid };
                proposal = { id: ctx_1.ctx.pending.id, text: (0, action_2.describe)(l.proposal, l.name), confirm: false };
            }
            return { ok: true, letter: { ...l, read: true }, proposal, expired: !!l.proposal && expired };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
        finally {
            exports.mail.replyBusy = false;
        }
    });
}
//# sourceMappingURL=mail-app.js.map
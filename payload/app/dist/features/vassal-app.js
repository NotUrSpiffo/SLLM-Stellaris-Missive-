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
exports.vassalUnread = exports.vassal = void 0;
exports.decisionNote = decisionNote;
exports.vassalView = vassalView;
exports.openVassal = openVassal;
exports.closeVassal = closeVassal;
exports.onVassalSnapshot = onVassalSnapshot;
exports.registerVassal = registerVassal;
// 종속국 통신 채널(앱 쪽, 2026-10-17) — 별도 오버레이 아이콘 창. 순수 로직은 src/vassal.ts.
// 월간 상황(STATE)의 VASSAL·SUBJECT 줄로 채널을 갱신하고, 충성도가 크게 바뀌면 서신, 그 밖에는 실시간 타이머로 청원·요구.
const office_1 = require("../office");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const vassal_1 = require("../vassal");
const chronicle_1 = require("../chronicle");
const aiclient_1 = require("../aiclient");
const diagnostics_1 = require("../diagnostics");
const settings_1 = require("../app/settings");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const safe_send_1 = require("../safe-send");
const chronicle_app_1 = require("./chronicle-app");
const terminal_1 = require("./terminal");
const settings_ui_1 = require("./settings-ui");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-18)
/** 결재 결과 한 줄(시스템 기록) */
function decisionNote(role, name, status, ask) {
    const gave = ask ? (ask.type === 'resource' ? L(`${vassal_1.ASK_KO[ask.res]} ${ask.amt}을(를) 보냈습니다`, `sent ${ask.amt} ${vassal_1.ASK_EN[ask.res]}`) : L(`1년간 연구 지원(우리 −${vassal_1.RESEARCH_AID}%, ${name} +${vassal_1.RESEARCH_AID}%)`, `research aid for 1 year (us −${vassal_1.RESEARCH_AID}%, ${name} +${vassal_1.RESEARCH_AID}%)`)) : '';
    if (status === 'accepted')
        return role === 'vassal' ? L(`청원을 들어주었습니다${gave ? ' · ' + gave : ''} · ${name} 충성도 매달 +${vassal_1.VASSAL_MONTHLY} (1년)`, `Petition granted${gave ? ' · ' + gave : ''} · ${name} loyalty +${vassal_1.VASSAL_MONTHLY}/month (1 yr)`) : L(`요구를 이행했습니다 · ${gave}`, `Demand fulfilled · ${gave}`);
    if (status === 'refused')
        return role === 'vassal' ? L(`청원을 거절했습니다 · ${name} 충성도 매달 −${vassal_1.VASSAL_MONTHLY} (1년)`, `Petition refused · ${name} loyalty −${vassal_1.VASSAL_MONTHLY}/month (1 yr)`) : L(`요구를 거절했습니다 · ${name}의 우리 관계 −${vassal_1.DEFY_OPINION} (약 1년에 걸쳐 회복)`, `Demand refused · ${name}'s opinion of us −${vassal_1.DEFY_OPINION} (recovers over about a year)`);
    if (status === 'no_target')
        return role === 'vassal' ? L('게임에서 이 종속국을 찾지 못해 적용하지 않았습니다.', 'This subject was not found in game; nothing was applied.') : L('게임에서 종주국을 찾지 못해 적용하지 않았습니다.', 'No overlord was found in game; nothing was applied.');
    if (status === 'duplicate')
        return L('이미 적용한 결정입니다.', 'This decision was already applied.');
    return L('게임 적용을 확인하지 못했습니다. 자동으로 다시 보내지 않습니다.', 'Could not confirm the effect in game. It will not be resent automatically.');
}
exports.vassal = { win: null, busy: false, lastTimer: Date.now(), queue: [], running: false, snap: null };
let storeInst = null;
const store = () => (storeInst ??= new vassal_1.VassalStore(path.join(electron_1.app.getPath('userData'), 'sllm_vassal.json')));
const cur = () => store().get(ctx_1.ctx.curSaveId);
function profileOf(ch) {
    let idx = ch.idx;
    if (ch.role === 'overlord') {
        for (const [i, c] of ctx_1.ctx.mailCountries)
            if (c.name === ch.name) {
                idx = i;
                break;
            }
    }
    const p = idx > 0 ? ctx_1.ctx.profileWithEthics(ctx_1.ctx.profiles.get(idx) ?? ctx_1.ctx.mailCountries.get(idx)?.profile, idx) : undefined;
    return p ? { ruler: p.ruler || undefined, profile: [p.gov, p.species, p.ethicsText].filter(Boolean).join(' · ') } : {};
}
function letterCtx(ch, delta) {
    const s = exports.vassal.snap, situation = [];
    if (s) {
        for (const w of s.wars.slice(0, 4))
            situation.push(`Player empire war: ${w.name} (${w.side === 'att' ? 'attacker' : 'defender'} side)`);
    }
    let chronicle = [];
    if (ch.role === 'vassal' && ctx_1.ctx.curSaveId) {
        try {
            chronicle = (0, chronicle_1.chronLines)(ctx_1.ctx.govMem().split(ctx_1.ctx.curSaveId, (0, chronicle_app_1.chron)().list((0, chronicle_1.chronKey)(ctx_1.ctx.curSaveId, ch.idx))).own, 6);
        }
        catch { /* 연대기 없음 */ }
    }
    return { empire: ctx_1.ctx.playerName || 'the player empire', ...profileOf(ch), situation: [...situation, ...chronicle.map((c) => 'Relationship record: ' + c)], history: (0, vassal_1.historyLines)(ch), delta };
}
function vassalView() {
    const sv = ctx_1.ctx.curSaveId ? cur() : { channels: {} };
    const chans = Object.values(sv.channels).sort((a, b) => (a.role === b.role ? Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ko') : a.role === 'overlord' ? -1 : 1));
    return { sid: ctx_1.ctx.curSaveId, running: ctx_1.ctx.gameRunning, busy: exports.vassal.busy, empire: ctx_1.ctx.playerName, playerIdx: ctx_1.ctx.playerIdx, // 우리 깃발(2026-10-18)
        monthly: vassal_1.VASSAL_MONTHLY, days: vassal_1.VASSAL_DAYS, textMax: vassal_1.TEXT_MAX, channels: chans.map((c) => ({ ...c, unread: (0, vassal_1.unread)(c), msgs: c.msgs.slice(-80) })) };
}
const push = () => (0, safe_send_1.safeSend)(exports.vassal.win, 'vassalState', vassalView());
const vassalUnread = () => (ctx_1.ctx.curSaveId ? Object.values(cur().channels).reduce((n, c) => n + (0, vassal_1.unread)(c), 0) : 0);
exports.vassalUnread = vassalUnread;
function openVassal(glass = false) {
    if (exports.vassal.win && !exports.vassal.win.isDestroyed()) {
        exports.vassal.win.show();
        exports.vassal.win.focus();
        push();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1180, Math.round(area.width * 0.78)), height: Math.min(860, Math.round(area.height * 0.86)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.vassal.win = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 780, minHeight: 520, frame: false, show: false, backgroundColor: '#06141b', ...(0, office_1.glassWin)(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.vassal.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.vassal.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'vassal.html'));
    exports.vassal.win.once('ready-to-show', () => { exports.vassal.win?.show(); push(); });
    exports.vassal.win.on('closed', () => { exports.vassal.win = null; });
}
function closeVassal() { if (exports.vassal.win && !exports.vassal.win.isDestroyed())
    exports.vassal.win.close(); }
/** AI 호출은 하나씩(서신이 몰려도 순서대로). */
function enqueue(job) { exports.vassal.queue.push(job); void pump(); }
async function pump() { if (exports.vassal.running)
    return; exports.vassal.running = true; try {
    while (exports.vassal.queue.length) {
        const j = exports.vassal.queue.shift();
        try {
            await j();
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'vassal.job.failed', { error: String(e) });
        }
    }
}
finally {
    exports.vassal.running = false;
} }
async function writeLetter(sid, key, kind, delta) {
    const ch = store().get(sid).channels[key];
    if (!ch || !ch.active)
        return;
    let got = null;
    const ask = kind === 'petition' || kind === 'demand' ? (0, vassal_1.pickAsk)() : undefined; // 내용은 앱이 정한다(게임에서 이행되는 것만, 2026-10-18)
    for (let i = 0; i < 2 && !got; i++) {
        try {
            got = (0, vassal_1.parseLetter)(await ctx_1.ctx.ai.chat((0, vassal_1.letterMessages)(ch, kind, letterCtx(ch, delta), ask), { purpose: 'vassal-letter', json: true, maxTokens: 1000 * (i + 1) }), kind, !!ask);
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'vassal-letter', attempt: i + 1, error: String(e) });
        }
    }
    if (!got || sid !== ctx_1.ctx.curSaveId)
        return;
    const m = (0, vassal_1.addLetter)(ch, kind, ctx_1.ctx.gameDate, got, ask);
    store().save();
    push();
    const who = ch.role === 'overlord' ? L('종주국', 'Overlord') : L('종속국', 'Subject');
    ctx_1.ctx.notify({ kind: 'vassal', title: L(`${who} 서신 · ${ch.name}`, `${who} letter · ${ch.name}`), body: m.title ?? '', action: L('열기', 'Open') });
    (0, diagnostics_1.logDiagnostic)('info', 'vassal.letter', { role: ch.role, kind });
}
/** 월간 상황(gamestate-app 이 부른다): 채널 갱신 + 충성도 급변 서신 */
function onVassalSnapshot(snap) {
    if (!ctx_1.ctx.curSaveId || snap.sid !== ctx_1.ctx.curSaveId)
        return;
    exports.vassal.snap = snap;
    const sid = snap.sid;
    const triggers = (0, vassal_1.applySnapshot)(store().get(sid), snap.vassals ?? [], snap.subject);
    store().save();
    push();
    for (const t of triggers)
        enqueue(() => writeLetter(sid, t.key, t.kind, t.delta));
}
/** 실시간 타이머: 서신 간격(설정 aiEveryMin, 기본 10분)마다 조용한 채널 하나가 청원·요구를 보낸다. 본 창을 쓰는 중이거나 게임이 꺼져 있으면 쉰다. */
function timerTick() {
    if (!ctx_1.ctx.gameRunning || !ctx_1.ctx.curSaveId || ctx_1.ctx.appOpen || exports.vassal.running)
        return;
    if (Date.now() - exports.vassal.lastTimer < Math.min(30, Math.max(1, settings_1.settings.aiEveryMin)) * 60000)
        return;
    const sid = ctx_1.ctx.curSaveId, ch = (0, vassal_1.pickTimerChannel)(store().get(sid));
    exports.vassal.lastTimer = Date.now();
    if (!ch)
        return;
    enqueue(() => writeLetter(sid, ch.key, (0, vassal_1.timerKind)(ch)));
}
const guard = (e) => !!exports.vassal.win && e.sender === exports.vassal.win.webContents;
const chanOf = (key) => (typeof key === 'string' && ctx_1.ctx.curSaveId ? cur().channels[key] ?? null : null);
const say = async (m, purpose) => (await ctx_1.ctx.ai.chat((0, vassal_1.replyMessages)(...m), { purpose, maxTokens: 900 })).trim();
function registerVassal(router) {
    router.on(log_router_1.SLOT.VASSAL, 'vassal:apply', (m) => { if (m.kind === 'VASSALAPPLY')
        terminal_1.terminalReplies.get('VASSALAPPLY:' + m.kv.req)?.(m); });
    setInterval(timerTick, 60000);
    electron_1.ipcMain.handle('vassalState', async () => vassalView());
    electron_1.ipcMain.handle('vassalClose', async (e) => { if (!guard(e))
        return false; closeVassal(); return true; });
    electron_1.ipcMain.handle('vassalRead', async (e, key) => { if (!guard(e))
        return false; const ch = chanOf(key); if (!ch)
        return false; let ch2 = false; for (const m of ch.msgs)
        if (!m.read) {
            m.read = true;
            ch2 = true;
        } if (ch2) {
        store().save();
        push();
    } return true; });
    /** 플레이어가 채널에 통신을 보낸다 → 상대가 답한다(게임 수치는 바뀌지 않음). */
    electron_1.ipcMain.handle('vassalSay', async (e, key, text) => {
        if (!guard(e))
            return { ok: false, error: L('종속국 통신 창에서만 보낼 수 있습니다.', 'You can send only from the subject comms window.') };
        const ch = chanOf(key);
        if (!ch || !ch.active)
            return { ok: false, error: L('통신할 수 있는 채널이 아닙니다.', 'This channel cannot be contacted.') };
        if (typeof text !== 'string')
            return { ok: false, error: L('내용을 확인해 주세요.', 'Please check the content.') };
        const bad = (0, vassal_1.checkText)(text);
        if (bad)
            return { ok: false, error: bad };
        if (exports.vassal.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already processing.') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 통신할 수 있습니다.', 'The game must be running to communicate.') };
        exports.vassal.busy = true;
        const sid = ctx_1.ctx.curSaveId;
        push();
        try {
            const clean = text.replace(/\s+/g, ' ').trim(), c = letterCtx(ch);
            const reply = await say([ch, clean, c], 'vassal-reply');
            if (!reply)
                return { ok: false, error: L('상대의 답을 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read their reply. Please try again.') };
            if (sid !== ctx_1.ctx.curSaveId)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            ch.msgs.push({ id: (0, vassal_1.newId)(), who: 'me', kind: 'player', date: ctx_1.ctx.gameDate, text: clean, read: true }, { id: (0, vassal_1.newId)(), who: 'them', kind: 'reply', date: ctx_1.ctx.gameDate, text: reply.slice(0, 2000), read: true });
            (0, vassal_1.trim)(ch);
            store().save();
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: (0, aiclient_1.redactKey)(err.message) };
        }
        finally {
            exports.vassal.busy = false;
            push();
        }
    });
    /** 청원(종속국)·요구(종주국)에 답한다(2026-10-18 이행형). 내용(ask)이 있으면 수락 = 실제 이행(자원 보냄 / 연구 지원 1년),
     * 종속국 청원은 충성도 수정자(수락 +, 거절 −, 1년), 종주국 요구 거절은 종주국 관계 −60. ask 가 없는 옛 서신은 예전처럼(종속국 = 충성도만, 종주국 = 기록만). */
    electron_1.ipcMain.handle('vassalDecide', async (e, key, id, accept) => {
        if (!guard(e))
            return { ok: false, error: L('종속국 통신 창에서만 답할 수 있습니다.', 'You can reply only from the subject comms window.') };
        const ch = chanOf(key), m = ch?.msgs.find((x) => x.id === id);
        if (!ch || !m || m.status !== 'pending')
            return { ok: false, error: L('대답할 청원이 없습니다.', 'There is no petition to answer.') };
        if (exports.vassal.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already processing.') };
        const yes = accept === true, sid = ctx_1.ctx.curSaveId, ask = (0, vassal_1.sanitizeAsk)(m.ask) ?? undefined, inGame = ch.role === 'vassal' || !!ask;
        if (inGame && (!ctx_1.ctx.gameRunning || !/^\d+$/.test(sid)))
            return { ok: false, error: L('게임이 켜져 있어야 결정을 게임에 적용할 수 있습니다.', 'The game must be running to apply this decision.') };
        exports.vassal.busy = true;
        push();
        try {
            if (inGame) {
                const cid = (0, crypto_1.randomUUID)().replace(/-/g, ''), req = ++game_link_1.link.reqCounter;
                // 보내기 전에 기록한다: 응답이 없어도 같은 결정을 두 번 걸지 않는다.
                m.status = 'sending';
                m.cid = cid;
                if (!store().save()) {
                    m.status = 'pending';
                    delete m.cid;
                    push();
                    return { ok: false, error: L('기록을 저장하지 못해 게임에 보내지 않았습니다. 디스크 공간·권한을 확인해 주세요.', 'Could not save the record, so nothing was sent to the game. Check disk space and permissions.') };
                }
                push();
                let short = false;
                try {
                    const cmd = ch.role === 'vassal' ? (0, vassal_1.vassalApplyCommand)(req, sid, cid, ch.idx, yes, ask) : (0, vassal_1.overlordApplyCommand)(req, sid, cid, yes, ask);
                    const r = await (0, terminal_1.terminalRequest)(cmd, 'VASSALAPPLY', req);
                    if (r.kv.cid !== cid || r.kv.sid !== sid)
                        throw new Error(L('응답의 결정 번호가 다릅니다.', 'The reply\'s decision ID does not match.'));
                    short = r.kv.status === 'short';
                    m.status = r.kv.status === 'applied' ? (yes ? 'accepted' : 'refused') : r.kv.status === 'duplicate' ? 'duplicate' : r.kv.status === 'no_target' ? 'no_target' : r.kv.status === 'failed' ? 'failed' : short ? 'pending' : 'uncertain';
                }
                catch (err) {
                    m.status = 'uncertain';
                    (0, diagnostics_1.logDiagnostic)('warn', 'vassal.apply.failed', { error: String(err) });
                }
                if (short && ask && ask.type === 'resource') { // 창고 부족: 아무것도 바뀌지 않았으니 결재 대기로 되돌린다
                    delete m.cid;
                    store().save();
                    return { ok: false, error: L(`창고에 ${vassal_1.ASK_KO[ask.res]}이(가) 부족합니다(필요 ${ask.amt}). 모은 뒤 다시 결재하거나 거절하세요.`, `Not enough ${vassal_1.ASK_EN[ask.res]} in stock (need ${ask.amt}). Gather it and try again, or refuse.`) };
                }
                ch.msgs.push({ id: (0, vassal_1.newId)(), who: 'system', kind: 'note', date: ctx_1.ctx.gameDate, text: decisionNote(ch.role, ch.name, m.status, ask), read: true });
                if (m.status === 'accepted' || m.status === 'refused') {
                    const rq = m.request ?? '', yes = m.status === 'accepted';
                    (0, chronicle_app_1.chronNote)(ch.idx, ch.role === 'vassal' ? L(`종주국이 청원 "${rq}"을(를) ${yes ? '들어주었다' : '거절했다'}`, `The overlord ${yes ? 'granted' : 'refused'} the petition "${rq}"`) : L(`종속국이 요구 "${rq}"을(를) ${yes ? '이행했다' : '거절했다'}`, `The subject ${yes ? 'fulfilled' : 'refused'} the demand "${rq}"`));
                }
            }
            else {
                m.status = yes ? 'accepted' : 'refused';
                ch.msgs.push({ id: (0, vassal_1.newId)(), who: 'system', kind: 'note', date: ctx_1.ctx.gameDate, text: yes ? L('요구를 받아들이겠다고 답했습니다(기록만, 게임 수치 변화 없음).', 'You agreed to the demand (record only, no game change).') : L('요구를 거절했습니다(기록만, 게임 수치 변화 없음).', 'You refused the demand (record only, no game change).'), read: true });
            }
            store().save();
            push();
            if (m.status === 'accepted' || m.status === 'refused') {
                try {
                    const r = (await ctx_1.ctx.ai.chat((0, vassal_1.decisionMessages)(ch, m, m.status === 'accepted', letterCtx(ch)), { purpose: 'vassal-decision', maxTokens: 1500 })).trim();
                    if (r && sid === ctx_1.ctx.curSaveId) {
                        ch.msgs.push({ id: (0, vassal_1.newId)(), who: 'them', kind: 'reply', date: ctx_1.ctx.gameDate, text: r.slice(0, 1200), read: true });
                        (0, vassal_1.trim)(ch);
                        store().save();
                    }
                }
                catch { /* 반응 문장은 없어도 된다 */ }
            }
            return { ok: true, status: m.status };
        }
        catch (err) {
            return { ok: false, error: (0, aiclient_1.redactKey)(err.message) };
        }
        finally {
            exports.vassal.busy = false;
            push();
        }
    });
}
//# sourceMappingURL=vassal-app.js.map
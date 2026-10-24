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
exports.sampleCouncil = exports.ally = void 0;
exports.openAlly = openAlly;
exports.closeAlly = closeAlly;
exports.registerAllyLog = registerAllyLog;
exports.registerAlly = registerAlly;
// Allied council window. Reads defensive-pact and subject/overlord empires, then applies
// the same kinds of effects chat, vassal petitions and two-party peace already use.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const log_router_1 = require("../app/log-router");
const game_link_1 = require("../app/game-link");
const terminal_1 = require("./terminal");
const peace_app_1 = require("./peace-app");
const settings_1 = require("../app/settings");
const ctx_1 = require("../app/ctx");
const i18n_pick_1 = require("../i18n-pick");
const speciesClass_1 = require("../speciesClass");
const chronicle_app_1 = require("./chronicle-app");
const safe_send_1 = require("../safe-send");
const diagnostics_1 = require("../diagnostics");
const allied_council_1 = require("../allied-council");
Object.defineProperty(exports, "sampleCouncil", { enumerable: true, get: function () { return allied_council_1.sampleCouncil; } });
exports.ally = {
    win: null,
    info: null,
    seated: [],
    decision: null,
    heard: new Set(),
    turn: 0,
    busy: false,
    epoch: 0,
    applied: false,
    uncertain: false,
    aiDemo: false,
    log: [],
};
const rowsOf = new Map();
let allyWatch = 0;
let allyAck = null;
/** Read after the log slot may have filled allyAck. Kept outside the waiter so a null write is not treated as final. */
function ackStatus(req) {
    const a = allyAck;
    return a && a.req === req ? a.status : 0;
}
const sys = (text) => { exports.ally.log.push({ who: '', text, kind: 'sys' }); if (exports.ally.log.length > 200)
    exports.ally.log.splice(0, exports.ally.log.length - 200); };
const seats = () => (exports.ally.info ? exports.ally.info.candidates.filter((c) => exports.ally.seated.includes(c.idx)) : []);
const liveOk = () => !!exports.ally.info && (exports.ally.info.demo || (ctx_1.ctx.curSaveId === exports.ally.info.sid && game_link_1.link.epoch === exports.ally.epoch));
function card(s, withWill) {
    const family = exports.ally.decision ? (0, allied_council_1.decisionFamily)(exports.ally.decision) : null;
    const paying = exports.ally.decision?.kind === 'trade' && exports.ally.decision.dir === 'take';
    return {
        idx: s.idx, name: s.name, ruler: s.ruler, personality: s.personality, bond: s.bond, bondLabel: (0, allied_council_1.bondLabel)(s.bond),
        loyalty: s.loyalty, opinion: s.opinion, stance: s.stance, heard: exports.ally.heard.has(s.idx), cls: (0, speciesClass_1.classKey)(s.cls) || '',
        traits: s.traits.map(allied_council_1.traitLabel), atWar: s.atWar, truce: s.truce,
        will: withWill && family ? (0, allied_council_1.willingness)(s, family, paying) : null,
    };
}
const view = () => {
    const info = exports.ally.info;
    if (!info)
        return null;
    const sat = seats();
    const problem = sat.length && exports.ally.decision ? (0, allied_council_1.applyProblem)(sat, exports.ally.decision, exports.ally.heard, info.contacts, info.playerIdx) : '';
    return {
        phase: exports.ally.seated.length ? 'table' : 'pick',
        demo: info.demo, aiDemo: exports.ally.aiDemo, busy: exports.ally.busy, applied: exports.ally.applied, uncertain: exports.ally.uncertain,
        candidates: info.candidates.map((s) => card(s, false)),
        seats: sat.map((s) => card(s, true)),
        player: { name: info.playerName, idx: info.playerIdx, cls: (0, speciesClass_1.classKey)(info.playerCls) || '' },
        decision: exports.ally.decision,
        notice: exports.ally.decision ? (0, allied_council_1.decisionNotice)(sat.length ? sat : info.candidates, exports.ally.decision, info.contacts) : '',
        problem: problem || '',
        contacts: info.contacts.filter((c) => c.idx !== info.playerIdx && !exports.ally.seated.includes(c.idx)),
        limits: allied_council_1.RES_CAP, minAmt: allied_council_1.RES_MIN, maxSeats: allied_council_1.MAX_SEATS,
        log: exports.ally.log,
        flags: Object.fromEntries(info.candidates.map((s) => [s.idx, ctx_1.ctx.flagUrlFor(s.idx)])),
        playerFlag: ctx_1.ctx.flagUrlFor(info.playerIdx),
    };
};
const push = () => (0, safe_send_1.safeSend)(exports.ally.win, 'allyState', view());
function openAlly(info, aiDemo = false) {
    if (exports.ally.busy)
        return false;
    const shown = (0, allied_council_1.presentCouncil)(info);
    exports.ally.info = { ...shown, candidates: shown.candidates.map((s) => ({ ...s, traits: [...s.traits], stance: 0 })) };
    exports.ally.seated = [];
    exports.ally.decision = null;
    exports.ally.heard = new Set();
    exports.ally.turn = 0;
    exports.ally.log = [];
    exports.ally.epoch = game_link_1.link.epoch;
    exports.ally.applied = false;
    exports.ally.uncertain = false;
    exports.ally.aiDemo = aiDemo && info.demo;
    sys(`${info.demo ? (0, i18n_pick_1.L)('[시연] ', '[Demo] ') : ''}${(0, i18n_pick_1.L)(`평의회를 열었습니다. 부를 수 있는 나라 ${info.candidates.length}.`, `Council opened. ${info.candidates.length} empires can be summoned.`)}`);
    (0, diagnostics_1.logDiagnostic)('info', 'ally.open', { sid: info.sid, demo: info.demo, n: info.candidates.length });
    if (exports.ally.win && !exports.ally.win.isDestroyed()) {
        exports.ally.win.show();
        exports.ally.win.focus();
        push();
        return true;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1280, Math.round(area.width * 0.86)), height: Math.min(860, Math.round(area.height * 0.88)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    const w = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 860, minHeight: 640, frame: false, show: false, backgroundColor: '#10140f', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.ally.win = w;
    w.setAlwaysOnTop(true, 'screen-saver', 1);
    void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'allied-council.html'));
    w.once('ready-to-show', () => { w.show(); push(); });
    w.on('closed', () => { if (exports.ally.win === w) {
        exports.ally.win = null;
        exports.ally.info = null;
    } });
    return true;
}
function closeAlly() { if (exports.ally.win && !exports.ally.win.isDestroyed())
    exports.ally.win.close(); exports.ally.win = null; exports.ally.info = null; }
async function readAllies() {
    const req = ++game_link_1.link.reqCounter;
    const keyA = 'ALLY:' + req, keyT = 'ALLYTRAIT:' + req;
    rowsOf.set(keyA, []);
    rowsOf.set(keyT, []);
    try {
        const end = await (0, terminal_1.terminalRequest)((0, allied_council_1.allyReadEffect)(req), 'ALLYEND', req);
        if (end.kv.sid !== ctx_1.ctx.curSaveId)
            return null;
        const seats = (0, allied_council_1.mergeAllies)((rowsOf.get(keyA) ?? []).map((m) => (0, allied_council_1.allyFromLog)(m.kv)).filter((s) => !!s));
        for (const m of rowsOf.get(keyT) ?? [])
            (0, allied_council_1.addAllyTrait)(seats, Number(m.kv.idx), m.kv.t || '');
        return seats;
    }
    finally {
        rowsOf.delete(keyA);
        rowsOf.delete(keyT);
    }
}
function registerAllyLog(router) {
    router.on(log_router_1.SLOT.ALLY, 'ally', (m) => {
        if (m.kind === 'ACK' && m.fields.includes('ally') && Number(m.kv.req) === allyWatch) {
            allyAck = { req: Number(m.kv.req), status: Number(m.kv.status) };
            return;
        }
        if (m.kind === 'ALLY' || m.kind === 'ALLYTRAIT') {
            const list = rowsOf.get(m.kind + ':' + m.kv.req);
            if (list && list.length < 400)
                list.push(m);
        }
        else if (m.kind === 'ALLYEND')
            terminal_1.terminalReplies.get('ALLYEND:' + m.kv.req)?.(m);
    });
}
const whoOf = (step, sat, player) => {
    const id = step.actor > 0 ? step.actor : step.tid;
    return (id > 0 ? sat.find((s) => s.idx === id)?.name : player) || player;
};
async function runStep(step, sid) {
    return (0, game_link_1.enqueue)(async () => {
        const req = ++game_link_1.link.reqCounter;
        allyWatch = req;
        allyAck = null;
        const done = (0, game_link_1.expectAck)(req);
        await (0, game_link_1.sendConsole)((0, allied_council_1.allyActEffect)(req, sid, step));
        const outcome = await done;
        return { outcome, status: ackStatus(req) };
    });
}
function registerAlly() {
    electron_1.ipcMain.handle('allyOpen', async () => {
        try {
            if (exports.ally.busy)
                return { ok: false, error: (0, i18n_pick_1.L)('진행 중인 평의회 작업을 기다려 주세요.', 'Please wait for the current council task.') };
            if (!ctx_1.ctx.gameRunning || !/^\d+$/.test(ctx_1.ctx.curSaveId))
                return { ok: false, error: (0, i18n_pick_1.L)('게임이 켜져 있고 세이브를 불러온 뒤에 평의회를 열 수 있습니다.', 'Open a save with the game running before opening the council.') };
            try {
                await (0, peace_app_1.refreshContacts)();
            }
            catch { /* keep the previous contact list */ }
            const found = await readAllies();
            if (!found)
                return { ok: false, error: (0, i18n_pick_1.L)('동맹 목록을 읽지 못했습니다. 게임과 최신 모드 연결을 확인해 주세요.', 'Could not read the allies. Check the game and that the latest mod is connected.') };
            if (!found.length)
                return { ok: false, error: (0, i18n_pick_1.L)('부를 수 있는 나라가 없습니다. 방어 협정이나 종속·종주 관계가 필요합니다. 연방 회원과 독립 보장은 여기 나오지 않습니다.', 'No empire can be summoned. A defensive pact or a subject/overlord relation is required. Federation members and independence guarantees are not listed here.') };
            const contacts = terminal_1.terminal.sid === ctx_1.ctx.curSaveId ? terminal_1.terminal.items.filter((c) => c.type === 'default' && !!c.name.trim() && c.idx !== ctx_1.ctx.playerIdx).map((c) => ({ idx: c.idx, name: c.name, nameEn: c.name })) : [];
            const info = {
                sid: ctx_1.ctx.curSaveId, demo: false, candidates: found, contacts,
                playerName: ctx_1.ctx.playerName || (0, i18n_pick_1.L)('우리', 'Us'), playerNameEn: ctx_1.ctx.playerName || 'Us',
                playerIdx: ctx_1.ctx.playerIdx, playerCls: ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.cls ?? 0,
            };
            return { ok: openAlly(info) };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('devAllyAi', async () => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: (0, i18n_pick_1.L)('개발자 모드에서만 사용할 수 있습니다.', 'Available only in developer mode.') };
        return { ok: openAlly((0, allied_council_1.sampleCouncil)(), true), message: (0, i18n_pick_1.L)('시험 평의회에 실제 AI를 연결했습니다. API를 사용하지만 게임에는 적용하지 않습니다.', 'Connected real AI to the test council. Uses the API but is not applied to the game.') };
    });
    electron_1.ipcMain.handle('allyState', async () => view());
    electron_1.ipcMain.handle('allySummon', async (_e, idxs) => {
        const info = exports.ally.info;
        if (!info)
            return { ok: false, error: (0, i18n_pick_1.L)('열린 평의회가 없습니다.', 'No council is open.') };
        if (exports.ally.busy || exports.ally.uncertain)
            return { ok: false, error: (0, i18n_pick_1.L)('평의회 작업을 기다려 주세요.', 'Please wait for the council task.') };
        if (!Array.isArray(idxs) || !idxs.length || idxs.length > allied_council_1.MAX_SEATS || idxs.some((n) => typeof n !== 'number' || !info.candidates.some((c) => c.idx === n)))
            return { ok: false, error: (0, i18n_pick_1.L)('한 명에서 여섯 명까지, 목록에 있는 나라만 부릅니다.', 'Summon one to six empires from the list.') };
        exports.ally.seated = [...new Set(idxs)];
        exports.ally.decision = null;
        exports.ally.heard = new Set();
        exports.ally.turn = 0;
        exports.ally.applied = false;
        exports.ally.log = [];
        for (const s of info.candidates)
            s.stance = 0;
        sys((0, i18n_pick_1.L)(`자리에 ${exports.ally.seated.length}명이 앉았습니다.`, `${exports.ally.seated.length} leaders took their seats.`));
        push();
        return { ok: true };
    });
    electron_1.ipcMain.handle('allyBack', async () => {
        if (!exports.ally.info || exports.ally.busy || exports.ally.uncertain)
            return { ok: false, error: (0, i18n_pick_1.L)('평의회 작업을 기다려 주세요.', 'Please wait for the council task.') };
        exports.ally.seated = [];
        exports.ally.decision = null;
        exports.ally.heard = new Set();
        exports.ally.applied = false;
        push();
        return { ok: true };
    });
    electron_1.ipcMain.handle('allyAgenda', async (_e, raw) => {
        const info = exports.ally.info;
        if (!info || !exports.ally.seated.length)
            return { ok: false, error: (0, i18n_pick_1.L)('먼저 지도자를 부르세요.', 'Summon the leaders first.') };
        if (exports.ally.busy || exports.ally.uncertain || exports.ally.applied)
            return { ok: false, error: (0, i18n_pick_1.L)('결과를 확인한 뒤 평의회를 다시 열어 주세요.', 'Check the result, then reopen the council.') };
        const next = (0, allied_council_1.parseDecision)(raw);
        if (!next)
            return { ok: false, error: (0, i18n_pick_1.L)('안건을 아직 다 고르지 않았습니다.', 'The proposal is not complete yet.') };
        if (!(0, allied_council_1.sameDecision)(exports.ally.decision, next)) {
            exports.ally.heard.clear();
            for (const s of seats())
                s.stance = 0;
            exports.ally.turn = 0;
        }
        exports.ally.decision = next;
        const why = (0, allied_council_1.applyProblem)(seats(), next, exports.ally.heard, info.contacts, info.playerIdx);
        sys((0, allied_council_1.decisionNotice)(seats(), next, info.contacts) + (why ? ` — ${why}` : ''));
        push();
        return { ok: true, error: why || undefined };
    });
    electron_1.ipcMain.handle('allySay', async (_e, r) => {
        const info = exports.ally.info;
        if (!info || !exports.ally.seated.length)
            return { ok: false, error: (0, i18n_pick_1.L)('열린 평의회가 없습니다.', 'No council is open.') };
        if (exports.ally.busy || exports.ally.applied || exports.ally.uncertain)
            return { ok: false, error: (0, i18n_pick_1.L)('평의회 작업을 기다리거나 평의회를 다시 열어 주세요.', 'Wait for the council task, or reopen the council.') };
        if (!liveOk())
            return { ok: false, error: (0, i18n_pick_1.L)('게임 상태가 바뀌었습니다. 평의회를 다시 열어 주세요.', 'The game state changed. Please reopen the council.') };
        if (!exports.ally.decision)
            return { ok: false, error: (0, i18n_pick_1.L)('먼저 안건을 고르세요.', 'Choose a proposal first.') };
        const text = typeof r?.text === 'string' ? r.text.trim().slice(0, 600) : '';
        if (!text)
            return { ok: false, error: (0, i18n_pick_1.L)('할 말을 입력하세요.', 'Type what you want to say.') };
        const sat = seats();
        const to = typeof r?.to === 'number' && sat.some((s) => s.idx === r.to) ? r.to : null;
        exports.ally.log.push({ who: info.playerName + (to !== null ? ` → ${sat.find((s) => s.idx === to).name}` : (0, i18n_pick_1.L)(' → 전체', ' → all')), text, kind: 'me' });
        const family = (0, allied_council_1.decisionFamily)(exports.ally.decision);
        const paying = exports.ally.decision.kind === 'trade' && exports.ally.decision.dir === 'take';
        const speakers = sat.filter((s) => to === null || s.idx === to);
        if (!info.demo || exports.ally.aiDemo) {
            exports.ally.busy = true;
            push();
            const epoch = exports.ally.epoch, decision = exports.ally.decision;
            try {
                const replies = await ctx_1.ctx.ai.session(async (chat) => {
                    const raw = await chat((0, allied_council_1.allyMessages)(sat, speakers, decision, info.playerName, text, exports.ally.log.filter((l) => l.kind !== 'sys').map((l) => ({ who: l.who, text: l.text })), ctx_1.ctx.profiles.get(info.playerIdx)?.gest ?? 0, info.contacts), { purpose: 'allied-council', json: true, maxTokens: 2200 });
                    if (exports.ally.info !== info || !liveOk() || game_link_1.link.epoch !== epoch)
                        throw new Error((0, i18n_pick_1.L)('평의회 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The council or the game state changed, so the replies were not applied.'));
                    return (0, allied_council_1.parseAllyReplies)(raw, speakers.map((s) => s.idx));
                });
                if (exports.ally.info !== info || !liveOk() || game_link_1.link.epoch !== epoch)
                    throw new Error((0, i18n_pick_1.L)('평의회 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The council or the game state changed, so the replies were not applied.'));
                const got = new Set(replies.map((rp) => rp.idx));
                for (const rp of replies) {
                    const s = sat.find((x) => x.idx === rp.idx);
                    if (!s || !family)
                        continue;
                    const will = (0, allied_council_1.willingness)(s, family, paying);
                    s.stance = (0, allied_council_1.shapeStance)(rp.stance, will, exports.ally.heard.has(s.idx) ? s.stance : undefined);
                    exports.ally.heard.add(s.idx);
                    exports.ally.log.push({ who: s.ruler || s.name, idx: s.idx, text: rp.say, kind: 'ai' });
                }
                for (const s of speakers)
                    if (!got.has(s.idx) && family) {
                        const will = (0, allied_council_1.willingness)(s, family, paying);
                        s.stance = (0, allied_council_1.shapeStance)(will, will, exports.ally.heard.has(s.idx) ? s.stance : undefined);
                        exports.ally.heard.add(s.idx);
                        sys((0, i18n_pick_1.L)(`${s.name}: 응답이 없어 성향으로 입장을 정했습니다.`, `${s.name}: no reply, so their nature set the stance.`));
                    }
                exports.ally.turn++;
                return { ok: true };
            }
            catch (e) {
                const error = e.message;
                if (exports.ally.info === info)
                    sys(error);
                return { ok: false, error };
            }
            finally {
                exports.ally.busy = false;
                push();
            }
        }
        exports.ally.turn += 1;
        for (const s of speakers) {
            const rp = (0, allied_council_1.allyDemoReply)(s, exports.ally.decision, exports.ally.turn);
            s.stance = rp.stance;
            exports.ally.heard.add(s.idx);
            exports.ally.log.push({ who: s.ruler || s.name, idx: s.idx, text: rp.say, kind: 'ai' });
        }
        push();
        return { ok: true };
    });
    electron_1.ipcMain.handle('allyApply', async (_e, confirmed) => applyDecision(false, confirmed === true));
    electron_1.ipcMain.handle('allyBreak', async (_e, confirmed) => applyDecision(true, confirmed === true));
    electron_1.ipcMain.handle('allyClose', async () => { closeAlly(); return { ok: true }; });
}
async function applyDecision(snub, confirmed) {
    const info = exports.ally.info;
    if (!info || !seats().length)
        return { ok: false, error: (0, i18n_pick_1.L)('열린 평의회가 없습니다.', 'No council is open.') };
    if (info.demo)
        return { ok: false, error: (0, i18n_pick_1.L)('시연 평의회는 게임에 적용하지 않습니다.', 'The demo council is not applied to the game.') };
    if (!confirmed)
        return { ok: false, error: (0, i18n_pick_1.L)('적용 확인이 필요합니다.', 'Confirmation is required.') };
    if (exports.ally.busy || exports.ally.applied || exports.ally.uncertain)
        return { ok: false, error: (0, i18n_pick_1.L)('이미 처리 중이거나 요청한 결정입니다.', 'Already processing or already requested.') };
    if (!liveOk())
        return { ok: false, error: (0, i18n_pick_1.L)('게임 상태가 바뀌었습니다. 평의회를 다시 열어 주세요.', 'The game state changed. Please reopen the council.') };
    const decision = snub ? { kind: 'snub' } : exports.ally.decision;
    if (!decision)
        return { ok: false, error: (0, i18n_pick_1.L)('먼저 안건을 고르세요.', 'Choose a proposal first.') };
    const sat = seats();
    const why = (0, allied_council_1.applyProblem)(sat, decision, exports.ally.heard, info.contacts, info.playerIdx);
    if (why)
        return { ok: false, error: why };
    const plan = (0, allied_council_1.planCouncil)(sat, decision);
    if (!plan.steps.length && !plan.playerPeace)
        return { ok: false, error: plan.notes.join(' ') || (0, i18n_pick_1.L)('적용할 결정이 없습니다.', 'There is nothing to apply.') };
    exports.ally.busy = true;
    push();
    const lines = [...plan.notes];
    let anyOk = false;
    try {
        if (plan.playerPeace && decision.kind === 'peace') {
            const enemy = info.contacts.find((c) => c.idx === decision.target)?.name || `#${decision.target}`;
            const peace = await (0, peace_app_1.playerPeace)(decision.target, enemy);
            lines.push(peace.text);
            if (peace.outcome === 'timeout') {
                exports.ally.uncertain = true;
                lines.push((0, i18n_pick_1.L)('응답을 확인하지 못해 더 보내지 않습니다. 평의회를 다시 열어 주세요.', 'The reply was not confirmed, so nothing further was sent. Please reopen the council.'));
            }
            else if (peace.outcome === 'ok')
                anyOk = true;
        }
        if (!exports.ally.uncertain) {
            for (const step of plan.steps) {
                const r = await runStep(step, info.sid);
                if (r.outcome === 'timeout') {
                    exports.ally.uncertain = true;
                    lines.push((0, i18n_pick_1.L)('응답을 확인하지 못해 더 보내지 않습니다. 평의회를 다시 열어 주세요.', 'The reply was not confirmed, so nothing further was sent. Please reopen the council.'));
                    break;
                }
                const code = r.outcome === 'ok' ? 1 : r.status;
                lines.push((0, allied_council_1.statusLine)(code || 0, whoOf(step, sat, info.playerName)));
                if (code === 1)
                    anyOk = true;
                else if (step.halt || r.outcome === 'stale' || r.outcome === 'dup')
                    break;
            }
        }
        for (const line of lines)
            sys(line);
        if (anyOk) {
            exports.ally.applied = true;
            (0, chronicle_app_1.chronNoteWorld)(lines.filter(Boolean).slice(0, 4).join(' · ').slice(0, 400), true);
        }
        (0, diagnostics_1.logDiagnostic)('info', 'ally.apply', { kind: decision.kind, ok: anyOk, uncertain: exports.ally.uncertain });
        return { ok: anyOk, error: anyOk ? undefined : lines.join('\n') };
    }
    catch (e) {
        if (anyOk)
            exports.ally.uncertain = true;
        const error = e.message;
        sys(error);
        return { ok: false, error };
    }
    finally {
        exports.ally.busy = false;
        push();
    }
}
//# sourceMappingURL=allied-council-app.js.map
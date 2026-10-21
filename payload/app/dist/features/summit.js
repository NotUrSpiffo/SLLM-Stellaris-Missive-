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
exports.summit = void 0;
exports.openSummit = openSummit;
exports.closeSummit = closeSummit;
exports.registerSummitLog = registerSummitLog;
exports.readFederation = readFederation;
exports.registerSummit = registerSummit;
// Federation summit: live AI discussion, correlated reads and developer-only experimental effects.
// Engine law eligibility/cooldown verification remains an in-game task.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const federation_1 = require("../federation");
const peace_app_1 = require("./peace-app");
const protocol_1 = require("../protocol");
const speciesClass_1 = require("../speciesClass");
const game_link_1 = require("../app/game-link");
const settings_1 = require("../app/settings");
const summit_core_1 = require("../summit-core");
const chronicle_app_1 = require("./chronicle-app");
const log_router_1 = require("../app/log-router");
const dev_fake_1 = require("../dev-fake");
const safe_send_1 = require("../safe-send");
const ctx_1 = require("../app/ctx");
const i18n_pick_1 = require("../i18n-pick"); // 한/영 문구(2026-10-19 영어 화면 점검)
exports.summit = {
    win: null,
    info: null,
    agenda: { kind: 'cohesion' },
    playerVote: 'yes',
    turn: 0,
    busy: false,
    epoch: 0,
    heard: new Set(),
    applied: false,
    uncertain: false,
    aiDemo: false,
    log: [],
};
const view = () => (exports.summit.info ? { ...(0, federation_1.summitView)(exports.summit.info, exports.summit.agenda, exports.summit.playerVote), busy: exports.summit.busy, applied: exports.summit.applied, uncertain: exports.summit.uncertain, aiDemo: exports.summit.aiDemo, experimental: settings_1.settings.devMode, heard: [...exports.summit.heard], log: exports.summit.log, flags: Object.fromEntries(exports.summit.info.members.map((m) => [m.idx, ctx_1.ctx.flagUrlFor(m.idx)])) } : null);
const push = () => (0, safe_send_1.safeSend)(exports.summit.win, 'summitState', view());
const sys = (text) => { exports.summit.log.push({ who: '', text, kind: 'sys' }); if (exports.summit.log.length > 200)
    exports.summit.log.splice(0, exports.summit.log.length - 200); };
/** 회담 창을 연다(이미 열려 있으면 새 정보로 바꾼다). */
function openSummit(info, aiDemo = false) {
    if (exports.summit.busy)
        return false;
    exports.summit.info = { ...info, members: info.members.map((m) => ({ ...m })) };
    exports.summit.agenda = { kind: 'cohesion' };
    exports.summit.playerVote = 'yes';
    exports.summit.turn = 0;
    exports.summit.log = [];
    exports.summit.epoch = game_link_1.link.epoch;
    exports.summit.heard = new Set();
    exports.summit.applied = false;
    exports.summit.uncertain = false;
    exports.summit.aiDemo = aiDemo && !!info.demo;
    sys(`${info.demo ? (0, i18n_pick_1.L)('[시연판] ', '[Demo] ') : ''}${(0, i18n_pick_1.L)(`정상회담을 열었습니다. 참석 ${info.members.length}개국.`, `Summit opened. ${info.members.length} member(s) attending.`)}`);
    (0, diagnostics_1.logDiagnostic)('info', 'summit.open', { sid: info.sid, demo: !!info.demo, members: info.members.length });
    if (exports.summit.win && !exports.summit.win.isDestroyed()) {
        exports.summit.win.show();
        exports.summit.win.focus();
        push();
        return true;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    const w = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 900, minHeight: 680, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.summit.win = w;
    w.setAlwaysOnTop(true, 'screen-saver', 1);
    void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'summit.html'));
    w.once('ready-to-show', () => { w.show(); push(); });
    w.on('closed', () => { if (exports.summit.win === w) {
        exports.summit.win = null;
        exports.summit.info = null;
    } });
    return true;
}
function closeSummit() { if (exports.summit.win && !exports.summit.win.isDestroyed())
    exports.summit.win.close(); exports.summit.win = null; exports.summit.info = null; }
// ---- 2단계: 게임에서 플레이어 연방 읽기
const fedCol = new federation_1.FedCollector();
let fedReading = false, fedLast = 0;
let fedReq = 0, fedSid = '', fedEpoch = 0;
/** 전쟁 선포 적용 결과(SLLM:FEDWAR): 요청 번호·세이브가 맞는 줄만 받는다. null = 아직 못 받음 */
let warReq = 0, warSid = '', warAt = null;
function registerSummitLog(router) {
    router.on(log_router_1.SLOT.FEDERATION, 'summit:federation', (m) => {
        if (m.kind === 'FEDWAR') {
            if (Number(m.kv.req) === warReq && m.kv.sid === warSid)
                warAt = m.kv.at === '1';
            return;
        }
        if (!/^FED(MEMBER|LAW|END)?$/.test(m.kind))
            return;
        if (!fedReading)
            return; // 앱이 묻지 않은 줄(지난 로그 다시 읽기 등)은 무시
        if (Number(m.kv.req) !== fedReq || m.kv.sid !== fedSid || ctx_1.ctx.curSaveId !== fedSid || game_link_1.link.epoch !== fedEpoch)
            return;
        if (fedCol.feed(m))
            fedLast = Date.now();
    });
}
/** 게임에 플레이어 연방을 물어 회담 정보로 만든다. 연방이 없으면 'none', 응답이 없거나 불완전하면 null. */
async function readFederation() {
    if (fedReading)
        return null;
    fedReading = true;
    fedCol.cur = null;
    fedLast = 0;
    fedReq = ++game_link_1.link.reqCounter;
    fedSid = ctx_1.ctx.curSaveId;
    fedEpoch = game_link_1.link.epoch;
    try {
        if (!fedSid)
            return null;
        await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)((0, protocol_1.fedReadEffect)(fedReq)));
        const t0 = Date.now();
        while (Date.now() - t0 < 8000) {
            await new Promise((r) => setTimeout(r, 250));
            if (fedCol.cur?.done)
                break;
        }
        const r = fedCol.cur;
        (0, diagnostics_1.logDiagnostic)('info', 'summit.fed_read', { got: !!r, none: !!r?.none, done: !!r?.done, members: r?.members.length ?? 0, laws: r?.laws.length ?? 0, last: fedLast });
        if (!r || !r.done || ctx_1.ctx.curSaveId !== fedSid || game_link_1.link.epoch !== fedEpoch)
            return null;
        if (r.none)
            return 'none';
        const info = (0, federation_1.fedInfoFrom)(r, ctx_1.ctx.curSaveId, (idx) => (0, speciesClass_1.classKey)(ctx_1.ctx.profiles.get(idx)?.cls) ?? '');
        if (info)
            info.warTargets = (0, peace_app_1.fedWarTargets)(info.members.map((m) => m.idx));
        return info;
    }
    finally {
        fedReading = false;
    }
}
const isKind = (k) => typeof k === 'string' && Object.hasOwn(federation_1.FED_AGENDAS, k);
const isVote = (v) => v === 'yes' || v === 'no' || v === 'abstain';
function registerSummit() {
    electron_1.ipcMain.handle('summitOpen', async () => {
        try {
            if (exports.summit.busy)
                return { ok: false, error: (0, i18n_pick_1.L)('진행 중인 회담 작업을 기다려 주세요.', 'Please wait for the current summit task.') };
            try {
                await (0, peace_app_1.refreshContacts)();
            }
            catch { /* 연락처를 못 새로 읽어도 지난 목록으로 연다 */ }
            const info = await readFederation();
            if (!info || info === 'none')
                return { ok: false, error: info === 'none' ? (0, i18n_pick_1.L)('가입한 연방이 없습니다.', 'You are not in a federation.') : (0, i18n_pick_1.L)('연방 정보를 읽지 못했습니다. 게임과 최신 모드 연결을 확인해 주세요.', 'Could not read the federation. Check the game and that the latest mod is connected.') };
            return { ok: openSummit(info) };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('devSummitAi', async () => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: (0, i18n_pick_1.L)('개발자 모드에서만 사용할 수 있습니다.', 'Available only in developer mode.') };
        const { sampleFederation } = await Promise.resolve().then(() => __importStar(require('../dev-fake')));
        return { ok: openSummit(sampleFederation(), true), message: (0, i18n_pick_1.L)('시험 연방에 실제 AI를 연결했습니다. API를 사용하지만 게임에는 적용하지 않습니다.', 'Connected real AI to the test federation. Uses the API but is not applied to the game.') };
    });
    electron_1.ipcMain.handle('summitState', async () => view());
    electron_1.ipcMain.handle('summitAgenda', async (_e, a) => {
        if (!exports.summit.info)
            return { ok: false, error: (0, i18n_pick_1.L)('열린 정상회담이 없습니다.', 'No summit is open.') };
        if (exports.summit.busy || exports.summit.uncertain || exports.summit.applied)
            return { ok: false, error: (0, i18n_pick_1.L)('작업 결과를 확인한 뒤 회담을 다시 열어 주세요.', 'Check the result, then reopen the summit.') };
        if (!isKind(a?.kind))
            return { ok: false, error: (0, i18n_pick_1.L)('알 수 없는 안건입니다.', 'Unknown agenda.') };
        const next = { kind: a.kind, ...(a.kind === 'war' && typeof a.target === 'number' ? { target: a.target } : {}) };
        if (JSON.stringify(exports.summit.agenda) !== JSON.stringify(next)) {
            exports.summit.heard.clear();
            exports.summit.info.members.forEach(m => { m.stance = 0; });
            exports.summit.log = [];
            exports.summit.turn = 0;
        }
        exports.summit.agenda = next;
        const p = (0, federation_1.agendaProblem)(exports.summit.info, next);
        sys((0, i18n_pick_1.L)(`안건: ${federation_1.FED_AGENDAS[next.kind].name}${p ? ` — ${p}` : ''}`, `Agenda: ${federation_1.FED_AGENDAS[next.kind].nameEn}${p ? ` — ${p}` : ''}`));
        push();
        return { ok: true };
    });
    electron_1.ipcMain.handle('summitVote', async (_e, v) => {
        if (!exports.summit.info || !isVote(v))
            return { ok: false, error: (0, i18n_pick_1.L)('표를 고르지 못했습니다.', 'Could not set your vote.') };
        if (exports.summit.busy || exports.summit.applied || exports.summit.uncertain)
            return { ok: false, error: (0, i18n_pick_1.L)('회담 작업을 기다려 주세요.', 'Please wait for the summit task.') };
        exports.summit.playerVote = v;
        push();
        return { ok: true };
    });
    // Live and AI-demo rounds use the configured provider; fixed demo stays offline.
    electron_1.ipcMain.handle('summitSay', async (_e, r) => {
        const info = exports.summit.info;
        if (!info)
            return { ok: false, error: (0, i18n_pick_1.L)('열린 정상회담이 없습니다.', 'No summit is open.') };
        if (exports.summit.busy || exports.summit.applied || exports.summit.uncertain)
            return { ok: false, error: (0, i18n_pick_1.L)('회담 작업을 기다리거나 회담을 다시 열어 주세요.', 'Wait for the summit task, or reopen the summit.') };
        if (!info.demo && (ctx_1.ctx.curSaveId !== info.sid || game_link_1.link.epoch !== exports.summit.epoch))
            return { ok: false, error: (0, i18n_pick_1.L)('게임 상태가 바뀌었습니다. 회담을 다시 열어 주세요.', 'The game state changed. Please reopen the summit.') };
        const problem = (0, federation_1.agendaProblem)(info, exports.summit.agenda);
        if (problem)
            return { ok: false, error: problem };
        const text = typeof r?.text === 'string' ? r.text.trim().slice(0, 600) : '';
        if (!text)
            return { ok: false, error: (0, i18n_pick_1.L)('할 말을 입력하세요.', 'Type what you want to say.') };
        const to = typeof r?.to === 'number' && info.members.some((m) => m.idx === r.to && !m.player) ? r.to : null;
        const me = info.members.find((m) => m.player);
        exports.summit.log.push({ who: (me?.ruler || me?.name || (0, i18n_pick_1.L)('나', 'Me')) + // 「나」 대신 통치자 이름(2026-10-18)
                (to !== null ? ` → ${info.members.find((m) => m.idx === to).name}` : (0, i18n_pick_1.L)(' → 전체', ' → all')), text, kind: 'me' });
        if (!info.demo || exports.summit.aiDemo) {
            exports.summit.busy = true;
            push();
            const epoch = exports.summit.epoch;
            try {
                const speakers = info.members.filter(m => !m.player && (to === null || m.idx === to));
                if (!speakers.length)
                    throw new Error((0, i18n_pick_1.L)('답할 회원국이 없습니다.', 'No member can reply.'));
                const replies = await ctx_1.ctx.ai.session(async (chat) => {
                    const out = [];
                    for (let i = 0; i < speakers.length; i += 6) {
                        if (exports.summit.info !== info || (!info.demo && (ctx_1.ctx.curSaveId !== info.sid || game_link_1.link.epoch !== epoch)))
                            throw new Error((0, i18n_pick_1.L)('회담 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The summit or game state changed, so the replies were not applied.'));
                        const batch = speakers.slice(i, i + 6), ids = batch.map(m => m.idx);
                        const profiles = batch.map(m => { const p = ctx_1.ctx.profileWithEthics(ctx_1.ctx.profiles.get(m.idx), m.idx); return { idx: m.idx, personality: p?.personality, ethics: p?.ethicsText, government: p?.gov, relations: p?.flags }; });
                        const raw = await chat((0, summit_core_1.summitMessages)(info, exports.summit.agenda, ids, text, [...exports.summit.log, ...out], profiles), { purpose: 'federation-summit', json: true, maxTokens: 3000 });
                        out.push(...(0, summit_core_1.parseSummitReplies)(raw, ids));
                    }
                    return out;
                });
                if (exports.summit.info !== info || (!info.demo && (ctx_1.ctx.curSaveId !== info.sid || game_link_1.link.epoch !== epoch)))
                    throw new Error((0, i18n_pick_1.L)('회담 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The summit or game state changed, so the replies were not applied.'));
                for (const rp of replies) {
                    const m = info.members.find(m => m.idx === rp.idx);
                    m.stance = exports.summit.heard.has(m.idx) ? Math.max(m.stance - 25, Math.min(m.stance + 25, rp.stance)) : rp.stance;
                    exports.summit.heard.add(m.idx);
                    exports.summit.log.push({ who: m.name, idx: m.idx, text: rp.say, kind: 'ai' });
                }
                exports.summit.turn++;
                exports.summit.log = exports.summit.log.slice(-200);
                (0, diagnostics_1.logDiagnostic)('info', 'summit.debate', { sid: info.sid, turn: exports.summit.turn, speakers: replies.length });
                return { ok: true, replies };
            }
            catch (e) {
                const error = e.message;
                if (exports.summit.info === info)
                    sys(error);
                (0, diagnostics_1.logDiagnostic)('warn', 'summit.debate.failed', { error });
                return { ok: false, error };
            }
            finally {
                exports.summit.busy = false;
                push();
            }
        }
        exports.summit.turn += 1;
        const replies = (0, dev_fake_1.summitDemoReplies)(info, to, exports.summit.playerVote, exports.summit.turn);
        for (const rp of replies) {
            const m = info.members.find((x) => x.idx === rp.idx);
            if (!m)
                continue;
            const before = (0, federation_1.voteOf)(m.stance);
            m.stance = Math.max(-100, Math.min(100, m.stance + rp.delta));
            exports.summit.heard.add(m.idx);
            exports.summit.log.push({ who: m.name, idx: m.idx, text: rp.say + (before !== (0, federation_1.voteOf)(m.stance) ? (0, i18n_pick_1.L)(' (입장이 바뀌었습니다)', ' (changed position)') : ''), kind: 'ai' });
        }
        push();
        return { ok: true, replies };
    });
    // Reserve before sending once, then re-read game state. Never automatically retry uncertain effects.
    electron_1.ipcMain.handle('summitApply', async (_e, experimentalConfirmed) => {
        const info = exports.summit.info;
        if (!info)
            return { ok: false, state: 'refused', error: (0, i18n_pick_1.L)('열린 정상회담이 없습니다.', 'No summit is open.') };
        const why = exports.summit.busy || exports.summit.applied || exports.summit.uncertain ? (0, i18n_pick_1.L)('이미 처리 중이거나 요청한 결정입니다.', 'Already processing or decided.') : (0, summit_core_1.summitApplyProblem)(info, exports.summit.agenda, exports.summit.playerVote, exports.summit.heard);
        if (why || !settings_1.settings.devMode || experimentalConfirmed !== true)
            return { ok: false, state: 'refused', error: why || (0, i18n_pick_1.L)('게임 적용은 개발자 검수에서만 가능합니다. 법 해금·재사용 대기시간은 검증 전입니다.', 'Applying to the game is available only in developer review. Law unlocks and cooldowns are not verified yet.') };
        const epoch = exports.summit.epoch, agenda = { ...exports.summit.agenda };
        const current = () => exports.summit.info === info && ctx_1.ctx.curSaveId === info.sid && game_link_1.link.epoch === epoch;
        if (!current())
            return { ok: false, error: (0, i18n_pick_1.L)('게임 상태가 바뀌었습니다. 회담을 다시 열어 주세요.', 'The game state changed. Please reopen the summit.') };
        exports.summit.busy = true;
        push();
        let reserved = false;
        try {
            const fresh = await readFederation();
            if (!current())
                throw new Error((0, i18n_pick_1.L)('게임 상태가 바뀌어 적용을 중단했습니다.', 'The game state changed, so applying stopped.'));
            if (!fresh || fresh === 'none' || (0, summit_core_1.federationFingerprint)(info) !== (0, summit_core_1.federationFingerprint)(fresh))
                throw new Error((0, i18n_pick_1.L)('회원국·통치자·법·가중치가 바뀌었습니다. 회담을 다시 열어 주세요.', 'Members, rulers, laws or weights changed. Please reopen the summit.'));
            if (agenda.kind === 'cohesion' && fresh.cohesion >= 100)
                throw new Error((0, i18n_pick_1.L)('이미 최대 응집력입니다.', 'Cohesion is already at maximum.'));
            const journal = new summit_core_1.SummitJournal(path.join(electron_1.app.getPath('userData'), 'sllm_summit_apply.json'));
            const id = (0, summit_core_1.summitOperationId)(fresh, agenda, ctx_1.ctx.gameDate), req = ++game_link_1.link.reqCounter;
            const command = (0, summit_core_1.summitApplyEffect)(fresh, agenda, req);
            warReq = req;
            warSid = info.sid;
            warAt = null;
            journal.reserve(id, JSON.stringify({ sid: info.sid, federation: info.name, agenda, date: ctx_1.ctx.gameDate, req }));
            reserved = true;
            exports.summit.uncertain = true;
            await (0, game_link_1.enqueue)(async () => { if (!current())
                throw new Error((0, i18n_pick_1.L)('게임 상태가 바뀌어 적용을 중단했습니다.', 'The game state changed, so applying stopped.')); await (0, game_link_1.sendConsole)(command); });
            if (agenda.kind === 'war') {
                const t0 = Date.now();
                while (warAt === null && Date.now() - t0 < 8000)
                    await new Promise((r) => setTimeout(r, 250));
            }
            const after = agenda.kind === 'war' ? null : await readFederation();
            const confirmed = current() && (0, summit_core_1.summitResultConfirmed)(fresh, after, agenda, warAt === true);
            journal.finish(id, confirmed ? 'confirmed' : 'uncertain');
            (0, diagnostics_1.logDiagnostic)(confirmed ? 'info' : 'warn', 'summit.apply.result', { sid: info.sid, req, agenda, confirmed });
            if (!current())
                return { ok: false, state: 'uncertain', error: (0, i18n_pick_1.L)('게임 상태가 바뀌었습니다. 원래 세이브에서 적용 결과를 확인해 주세요.', 'The game state changed. Check the result in the original save.') };
            exports.summit.applied = confirmed;
            exports.summit.uncertain = !confirmed;
            if (confirmed && after && after !== 'none')
                exports.summit.info = { ...after, members: after.members.map(m => ({ ...m, stance: info.members.find(old => old.idx === m.idx)?.stance ?? 0 })) };
            const message = confirmed ? (0, i18n_pick_1.L)(`${federation_1.FED_AGENDAS[agenda.kind].name}: 게임에서 변경된 상태를 다시 읽어 확인했습니다.`, `${federation_1.FED_AGENDAS[agenda.kind].nameEn}: confirmed by re-reading the changed state from the game.`) : (0, i18n_pick_1.L)('적용 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다. 게임에서 직접 확인해 주세요.', 'Could not confirm the result. It will not be resent automatically. Please check in the game.');
            sys(message);
            if (confirmed) {
                const tgt = agenda.target ? ': ' + (info.warTargets?.find(t => t.idx === agenda.target)?.name ?? '') : '';
                (0, chronicle_app_1.chronNoteWorld)((0, i18n_pick_1.L)(`${info.name} 정상회담 — ${federation_1.FED_AGENDAS[agenda.kind].name}${tgt} 적용 확인.`, `${info.name} summit — ${federation_1.FED_AGENDAS[agenda.kind].nameEn}${tgt} confirmed.`));
            }
            return { ok: confirmed, state: confirmed ? 'confirmed' : 'uncertain', error: confirmed ? undefined : message };
        }
        catch (e) {
            const error = e.message;
            if (exports.summit.info === info) {
                exports.summit.uncertain = reserved;
                sys(error);
            }
            (0, diagnostics_1.logDiagnostic)('warn', 'summit.apply.failed', { error, reserved });
            return { ok: false, state: reserved ? 'uncertain' : 'refused', error };
        }
        finally {
            exports.summit.busy = false;
            push();
        }
    });
    electron_1.ipcMain.handle('summitClose', async () => { closeSummit(); return true; });
}
//# sourceMappingURL=summit.js.map
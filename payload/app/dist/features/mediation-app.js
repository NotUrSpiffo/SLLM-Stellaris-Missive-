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
exports.mediation = void 0;
exports.openMediation = openMediation;
exports.openGameMediation = openGameMediation;
exports.onMediationYear = onMediationYear;
exports.openPendingMediation = openPendingMediation;
exports.registerMediation = registerMediation;
// 시험 전쟁(가상)과 실제 게임 전쟁(2026-10-17 연결). 실제 전쟁은 합의 후 '결과 기록' 때 종전·휴전·영유권 안 점령지 이전을 게임에 적용한다.
const aiclient_1 = require("../aiclient");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const settings_1 = require("../app/settings");
const safe_send_1 = require("../safe-send");
const diagnostics_1 = require("../diagnostics");
const mediation_1 = require("../mediation");
const speciesClass_1 = require("../speciesClass");
const peace_app_1 = require("./peace-app");
const peace_core_1 = require("../peace-core");
const fs = __importStar(require("fs"));
const game_link_1 = require("../app/game-link");
const chronicle_app_1 = require("./chronicle-app");
const i18n_pick_1 = require("../i18n-pick"); // 한/영 문구(2026-10-19 영어 화면 점검)
exports.mediation = { win: null, state: null, busy: false };
const store = () => new mediation_1.MediationRecords(path.join(electron_1.app.getPath('userData'), 'sllm_mediation_records.json'));
const view = () => ({ state: exports.mediation.state, busy: exports.mediation.busy, preview: exports.mediation.state ? (0, mediation_1.offerSummary)(exports.mediation.state) : [], player: { name: ctx_1.ctx.playerName || (0, i18n_pick_1.L)('플레이어 제국', 'Player empire'), ruler: ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.ruler || (0, i18n_pick_1.L)('중재 대표', 'Mediator'), cls: (0, speciesClass_1.classKey)(ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.cls) || 'human' } });
const push = () => (0, safe_send_1.safeSend)(exports.mediation.win, 'mediationState', view());
const errorOf = (e) => e instanceof Error ? e.message : String(e);
function openMediation(mode, war = (0, mediation_1.mediationFixture)()) {
    if (exports.mediation.busy)
        throw new Error((0, i18n_pick_1.L)('진행 중인 중재 응답을 기다려 주세요.', 'Please wait for the current mediation reply.'));
    exports.mediation.state = (0, mediation_1.newMediation)(war, mode);
    if (exports.mediation.win && !exports.mediation.win.isDestroyed()) {
        exports.mediation.win.show();
        exports.mediation.win.focus();
        push();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const w = new electron_1.BrowserWindow({ width: Math.min(1440, area.width), height: Math.min(940, area.height), minWidth: 850, minHeight: 620, frame: false, show: false, backgroundColor: '#081921', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.mediation.win = w;
    void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'mediation.html'));
    w.once('ready-to-show', () => { w.show(); push(); });
    w.on('closed', () => { if (exports.mediation.win === w) {
        exports.mediation.win = null;
        exports.mediation.state = null;
    } });
}
async function openGameMediation(a, d, mode) {
    const sid = ctx_1.ctx.curSaveId, wars = await (0, peace_app_1.listGameWars)(), war = wars.find(w => w.a === a && w.d === d);
    if (!war)
        throw new Error((0, i18n_pick_1.L)('그 전쟁을 찾지 못했습니다. 이미 끝났거나 참전국이 바뀌었습니다.', 'Could not find that war. It has ended or its participants changed.'));
    const scan = await (0, peace_app_1.scanWar)({ kind: 'ai', a, d });
    if (!scan.found)
        throw new Error((0, i18n_pick_1.L)('전쟁 상황을 읽지 못했습니다. 이미 끝났을 수 있습니다.', 'Could not read the war status. It may have already ended.'));
    if (ctx_1.ctx.curSaveId !== sid)
        throw new Error((0, i18n_pick_1.L)('세이브가 바뀌었습니다.', 'The save changed.'));
    openMediation(mode, (0, peace_core_1.gameMediationWar)(sid, war, [gameParty(a, scan.rows, 1), gameParty(d, scan.rows, 2)], scan.rows, ctx_1.ctx.gameDate));
}
// ---- 해마다 중재 제안 알림: 게임 해가 바뀌면 AI 끼리 전쟁마다 피로도로 확률을 계산해 굴린다(LLM 없음). ----
let offer = null, offerBusy = false;
const yearFile = () => path.join(electron_1.app.getPath('userData'), 'sllm_mediation_offer_years.json');
function readYears() { try {
    const v = JSON.parse(fs.readFileSync(yearFile(), 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
catch {
    return {};
} }
function writeYears(v) { try {
    const tmp = yearFile() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(v), 'utf8');
    fs.renameSync(tmp, yearFile());
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('warn', 'mediation.offer.year_write', { error: errorOf(e) });
} }
function onMediationYear(snap) {
    if (!snap.sid || snap.sid !== ctx_1.ctx.curSaveId || !ctx_1.ctx.gameRunning || !game_link_1.link.sessionReady || offerBusy)
        return;
    const years = readYears(), due = (0, peace_core_1.mediationYearDue)(years[snap.sid], snap.date);
    if (due.year === null || (!due.due && years[snap.sid] !== undefined))
        return;
    years[snap.sid] = due.year;
    writeYears(years);
    if (!due.due || exports.mediation.state || exports.mediation.busy)
        return;
    offerBusy = true;
    void (async () => {
        try {
            const wars = await (0, peace_app_1.listGameWars)();
            const pick = (0, peace_core_1.pickMediationOffer)(wars, Math.random);
            (0, diagnostics_1.logDiagnostic)('info', 'mediation.offer.roll', { year: due.year, wars: wars.length, picked: pick ? { a: pick.a, d: pick.d, chance: Math.round(pick.chance * 100) } : null });
            if (!pick || ctx_1.ctx.curSaveId !== snap.sid)
                return;
            offer = { sid: snap.sid, a: pick.a, d: pick.d };
            ctx_1.ctx.notify({ kind: 'mediation', ...(0, peace_core_1.mediationOfferText)(pick.aName, pick.dName, pick.ax, pick.dx), action: (0, i18n_pick_1.L)('중재하기', 'Mediate') });
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'mediation.offer.failed', { error: errorOf(e) });
        }
        finally {
            offerBusy = false;
        }
    })();
}
/** 알림의 [중재하기]: 제안받은 전쟁으로 실제 중재 회담을 연다. */
function openPendingMediation() {
    const o = offer;
    offer = null;
    if (!o || o.sid !== ctx_1.ctx.curSaveId) {
        ctx_1.ctx.notify({ kind: 'info', title: (0, i18n_pick_1.L)('평화 중재', 'Peace mediation'), body: (0, i18n_pick_1.L)('제안이 만료되었습니다(세이브가 바뀜).', 'The offer expired (the save changed).') });
        return;
    }
    openGameMediation(o.a, o.d, 'ai').catch(e => ctx_1.ctx.notify({ kind: 'info', title: (0, i18n_pick_1.L)('평화 중재를 열지 못했습니다', 'Could not open peace mediation'), body: errorOf(e) }));
}
const allowed = () => settings_1.settings.devMode || exports.mediation.state?.war.source === 'game';
function gameParty(idx, rows, side) {
    const pf = ctx_1.ctx.profiles.get(idx), lost = rows.filter(r => r.side === side).length, taken = rows.filter(r => r.side !== side).length;
    return { id: idx, name: (0, peace_app_1.contactName)(idx), ruler: pf?.ruler || (0, i18n_pick_1.L)('통치자 미확인', 'Ruler unknown'), cls: (0, speciesClass_1.classKey)(pf?.cls) || undefined, personality: pf ? [pf.personality, pf.gov].filter(Boolean).join(' · ') || (0, i18n_pick_1.L)('성향 미확인', 'Disposition unknown') : (0, i18n_pick_1.L)('성향 미확인', 'Disposition unknown'), objective: null, situation: (0, i18n_pick_1.L)(`상대 성계 ${taken}곳 점령 · 자국 성계 ${lost}곳 피점령`, `Holds ${taken} enemy systems · ${lost} own systems occupied`) };
}
function registerMediation() {
    electron_1.ipcMain.handle('devMediation', async (_e, mode) => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: (0, i18n_pick_1.L)('개발자 모드에서 시험할 수 있습니다.', 'Available for testing in developer mode.') };
        if (mode !== 'scripted' && mode !== 'ai')
            return { ok: false, error: (0, i18n_pick_1.L)('알 수 없는 시험 모드입니다.', 'Unknown test mode.') };
        try {
            openMediation(mode);
            return { ok: true, message: mode === 'ai' ? (0, i18n_pick_1.L)('가상 교전국과 실제 AI로 중재를 시험합니다. API 사용량이 발생하며 게임에는 적용하지 않습니다.', 'Testing mediation with fictional belligerents and real AI. This uses the API but is not applied to the game.') : (0, i18n_pick_1.L)('가상 교전국과 정해진 대사로 중재를 시험합니다. AI 호출과 게임 변경은 없습니다.', 'Testing mediation with fictional belligerents and canned lines. No AI calls and no game changes.') };
        }
        catch (e) {
            return { ok: false, error: errorOf(e) };
        }
    });
    electron_1.ipcMain.handle('mediationState', async () => view());
    electron_1.ipcMain.handle('mediationOffer', async (_e, input) => {
        if (!allowed() || exports.mediation.busy || !exports.mediation.state)
            return { ok: false, error: (0, i18n_pick_1.L)('회담 응답을 기다려 주세요.', 'Please wait for the talks to reply.') };
        try {
            exports.mediation.state = (0, mediation_1.reviseMediationOffer)(exports.mediation.state, input);
            push();
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: errorOf(e) };
        }
    });
    electron_1.ipcMain.handle('mediationTurn', async (_e, input) => {
        const state = exports.mediation.state;
        if (!state || !allowed())
            return { ok: false, error: (0, i18n_pick_1.L)('중재 회담을 먼저 열어 주세요.', 'Open the mediation talks first.') };
        if (exports.mediation.busy)
            return { ok: false, error: (0, i18n_pick_1.L)('양측의 응답을 기다리고 있습니다.', 'Waiting for both sides to reply.') };
        if (!['invitation', 'negotiating'].includes(state.phase))
            return { ok: false, error: (0, i18n_pick_1.L)('이번 중재는 종료되었습니다. 결과를 기록할 수 있습니다.', 'This mediation has ended. You can record the result.') };
        const text = typeof input === 'string' ? input.trim() : '';
        if (!text || text.length > 1200)
            return { ok: false, error: (0, i18n_pick_1.L)('중재 발언을 1~1200자로 입력해 주세요.', 'Enter 1–1200 characters for your mediation statement.') };
        exports.mediation.busy = true;
        push();
        try {
            const replies = state.mode === 'scripted' ? (0, mediation_1.scriptedMediationReplies)(state) : (0, mediation_1.parseMediationReplies)(await ctx_1.ctx.ai.chat((0, mediation_1.mediationMessages)(state, text), { purpose: 'peace-mediation', json: true, maxTokens: 1800, conversationId: (0, aiclient_1.conversationOf)(state) }), state);
            if (exports.mediation.state !== state)
                throw new Error((0, i18n_pick_1.L)('회담이 닫히거나 변경되어 이전 응답을 반영하지 않았습니다.', 'The talks were closed or changed, so the earlier reply was not applied.'));
            exports.mediation.state = (0, mediation_1.advanceMediation)(state, state.revision, text, replies);
            (0, diagnostics_1.logDiagnostic)('info', 'mediation.turn', { id: state.id, mode: state.mode, phase: exports.mediation.state.phase, round: exports.mediation.state.round });
            return { ok: true };
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'mediation.turn.failed', { id: state.id, error: errorOf(e) });
            return { ok: false, error: errorOf(e) };
        }
        finally {
            exports.mediation.busy = false;
            push();
        }
    });
    electron_1.ipcMain.handle('mediationRecord', async () => {
        if (exports.mediation.busy || !exports.mediation.state)
            return { ok: false, error: (0, i18n_pick_1.L)('중재가 진행 중이거나 열려 있지 않습니다.', 'A mediation is in progress or none is open.') };
        const state = exports.mediation.state;
        try {
            if (state.recorded)
                return { ok: true, applied: state.applied?.lines ?? [] };
            if (state.war.source === 'game' && state.phase === 'agreed' && !state.gameApplied) {
                const g = state.war.game;
                if (!g || g.sid !== ctx_1.ctx.curSaveId)
                    throw new Error((0, i18n_pick_1.L)('다른 세이브의 전쟁입니다. 게임에 적용하지 않았습니다.', 'This war is from another save. Nothing was applied to the game.'));
                const o = state.offer ?? { basis: state.proposal, claims: [], goalFor: null };
                const plan = (0, peace_core_1.transfersForOffer)(state.war, o.basis, o.claims);
                exports.mediation.busy = true;
                push();
                // 적용 요청을 보내기 전에 '적용함'으로 고정한다: 응답이 없어도 같은 합의를 다시 보내지 않는다.
                state.gameApplied = true;
                state.applied = { at: ctx_1.ctx.gameDate, peace: 'pending', lines: [(0, i18n_pick_1.L)('게임 적용 요청을 보냈습니다. 결과를 기다리는 중입니다.', 'Sent the request to the game. Waiting for the result.')] };
                try {
                    const res = await (0, peace_app_1.applyPeace)({ kind: 'ai', a: g.a, d: g.d }, plan);
                    const lines = (0, peace_core_1.applySummary)(res, { p1: state.war.parties[0].name, p2: state.war.parties[1].name });
                    state.applied = { at: ctx_1.ctx.gameDate, peace: res.peace, lines };
                    state.log.push({ who: (0, i18n_pick_1.L)('게임 적용', 'Applied in game'), text: lines.join('\n'), kind: 'player', revision: state.revision });
                    if (res.peace === 'peace' || res.peace === 'still_war') {
                        const moved = res.gives.filter(x => x.status === 'transferred').map(x => x.name).join(', ');
                        (0, chronicle_app_1.chronNoteWorld)((0, i18n_pick_1.L)(`${state.war.parties[0].name}과(와) ${state.war.parties[1].name}이(가) 우리 제국의 중재로 전쟁을 끝냈다.${moved ? ' ' + moved + ' 성계가 넘어갔다.' : ''}`, `${state.war.parties[0].name} and ${state.war.parties[1].name} ended their war through our empire's mediation.${moved ? ' Systems transferred: ' + moved + '.' : ''}`), true);
                    }
                }
                catch (e) {
                    state.applied = { at: ctx_1.ctx.gameDate, peace: 'unknown', lines: [(0, i18n_pick_1.L)('게임 적용 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다. 게임에서 전쟁 상태를 확인해 주세요.', 'Could not confirm the result in the game. It will not be resent automatically. Please check the war status in the game.'), errorOf(e)] };
                }
                finally {
                    exports.mediation.busy = false;
                }
            }
            store().save(state);
            state.recorded = true;
            push();
            (0, diagnostics_1.logDiagnostic)('info', 'mediation.recorded', { id: state.id, source: state.war.source, phase: state.phase, applied: state.applied?.peace });
            return { ok: true, applied: state.applied?.lines ?? [] };
        }
        catch (e) {
            push();
            (0, diagnostics_1.logDiagnostic)('warn', 'mediation.record.failed', { error: errorOf(e) });
            return { ok: false, error: errorOf(e) };
        }
    });
    electron_1.ipcMain.handle('mediationGameWars', async () => {
        if (exports.mediation.busy)
            return { ok: false, error: (0, i18n_pick_1.L)('진행 중인 중재 응답을 기다려 주세요.', 'Please wait for the current mediation reply.'), wars: [] };
        try {
            return { ok: true, wars: await (0, peace_app_1.listGameWars)() };
        }
        catch (e) {
            return { ok: false, error: errorOf(e), wars: [] };
        }
    });
    electron_1.ipcMain.handle('mediationGameOpen', async (_e, input) => {
        const v = input;
        const a = Number(v?.a), d = Number(v?.d), mode = v?.mode === 'ai' ? 'ai' : v?.mode === 'scripted' ? 'scripted' : null;
        if (!Number.isSafeInteger(a) || !Number.isSafeInteger(d) || a < 1 || d < 1 || a === d || !mode)
            return { ok: false, error: (0, i18n_pick_1.L)('중재할 전쟁을 고르세요.', 'Choose a war to mediate.') };
        if (exports.mediation.busy)
            return { ok: false, error: (0, i18n_pick_1.L)('진행 중인 중재 응답을 기다려 주세요.', 'Please wait for the current mediation reply.') };
        try {
            await openGameMediation(a, d, mode);
            return { ok: true, message: mode === 'ai' ? (0, i18n_pick_1.L)('실제 전쟁을 실제 AI로 중재합니다. 합의 후 결과 기록 때 게임에 적용됩니다.', 'Mediating a real war with real AI. It is applied to the game when you record the result after an agreement.') : (0, i18n_pick_1.L)('실제 전쟁을 정해진 대사로 중재합니다(AI 없음). 합의 후 결과 기록 때 게임에 적용됩니다.', 'Mediating a real war with canned lines (no AI). It is applied to the game when you record the result after an agreement.') };
        }
        catch (e) {
            return { ok: false, error: errorOf(e) };
        }
    });
    electron_1.ipcMain.handle('mediationHistory', async () => { try {
        return { ok: true, records: store().list().slice(-20).reverse() };
    }
    catch (e) {
        return { ok: false, error: errorOf(e), records: [] };
    } });
    electron_1.ipcMain.handle('mediationClose', async () => { exports.mediation.win?.close(); exports.mediation.state = null; return true; });
}
//# sourceMappingURL=mediation-app.js.map
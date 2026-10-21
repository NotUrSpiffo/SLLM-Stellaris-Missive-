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
exports.speechReady = exports.speechStore = exports.speech = void 0;
exports.leaderPortrait = leaderPortrait;
exports.speechView = speechView;
exports.pushSpeech = pushSpeech;
exports.finishSpeech = finishSpeech;
exports.onSpeechApplied = onSpeechApplied;
exports.openSpeech = openSpeech;
exports.startSpeechPrep = startSpeechPrep;
exports.registerSpeech = registerSpeech;
// A-00b 5번: 연설(앱 쪽) — 연설 준비·진행·버프 적용, 연설 창, IPC 5개, 로그 분배 자리 SPEECH_PF·SPEECH.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 순수 로직은 src/speech.ts. speechCtx(군중 상황)는 ctx와 헷갈리지 않게 speech.crowdCtx로 이름만 바꿨다.
// ---- 연설: 결정을 누르면 3개월 뒤 준비 완료 알림 → 종류 선택 → 연설문 → AI 등급 → 고정 버프
const office_1 = require("../office");
const gamestate_1 = require("../gamestate");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const speech_1 = require("../speech");
const speciesClass_1 = require("../speciesClass");
const aiclient_1 = require("../aiclient");
const chronicle_1 = require("../chronicle");
const settings_1 = require("../app/settings");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const chronicle_app_1 = require("./chronicle-app");
const radio_app_1 = require("./radio-app");
const images_1 = require("./images");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
exports.speech = {
    /** 세이브 번호를 모를 때 들어온 연설 준비 시작(번호를 알면 시작한다) */
    prepPending: null,
    pfLast: null,
    /** 군중 상황(SPEECHCTX) */
    crowdCtx: null,
    busy: false,
    applyN: 0,
    win: null,
    /** 지금 진행 중인 연설(앱을 끄면 사라지고, 준비는 그대로 남는다) */
    sess: null,
    ackWaiter: null,
    /** 버프 명령을 이미 보낸 연설(확인 전이라도 다시 보내지 않는다, 2026-10-18) */
    sentFor: null,
    /** 확인 시간을 넘긴 버프 명령. 늦게 확인 줄이 오면 그때 연설을 마무리한다. */
    late: null,
};
let speechStoreInst = null;
const speechStore = () => (speechStoreInst ??= new speech_1.SpeechStore(path.join(electron_1.app.getPath('userData'), 'sllm_speech.json')));
exports.speechStore = speechStore;
const speechReady = () => !!ctx_1.ctx.curSaveId && (0, exports.speechStore)().get(ctx_1.ctx.curSaveId).phase === 'ready';
exports.speechReady = speechReady;
const outlookOf = (b) => (b >= 8 ? '호의적' : b <= -8 ? '냉담' : '반반'); // 화면이 이 값으로 색을 고른다(보이는 글은 outlookText)
const outlookText = (o) => (o === '호의적' ? L('호의적', 'Favorable') : o === '냉담' ? L('냉담', 'Cold') : L('반반', 'Mixed'));
function leaderPortrait(pf) {
    const k = pf?.cls ? (0, speciesClass_1.classKey)(pf.cls) : null;
    if (!k)
        return (0, images_1.imageState)().images['ruler:player'] ?? null; // 플레이어 통치자 그림은 계열을 몰라도 쓴다
    const st = (0, images_1.imageState)();
    return st.images['ruler:player'] ?? st.images[`leader:${k}`] ?? st.images[`class:${k}`] ?? st.defaults[k] ?? null;
}
function speechView() {
    const st = ctx_1.ctx.curSaveId ? (0, exports.speechStore)().get(ctx_1.ctx.curSaveId) : { phase: 'none', start: '', due: '', pf: null };
    const pf = ctx_1.ctx.speechWithEthics(st.pf ?? exports.speech.pfLast), cp = (0, speech_1.crowdProfile)(pf, exports.speech.crowdCtx, L), cur = exports.speech.sess && exports.speech.sess.sid === ctx_1.ctx.curSaveId ? exports.speech.sess.sess : null;
    return {
        phase: st.phase, start: st.start, due: st.due, date: ctx_1.ctx.gameDate, running: ctx_1.ctx.gameRunning, minChars: speech_1.TURN_MIN, maxChars: speech_1.TURN_MAX, turns: settings_1.settings.speechTurns,
        empire: ctx_1.ctx.playerName, leader: leaderPortrait(pf), crowd: { summary: cp.summary, lines: cp.lines, gestalt: cp.gestalt, kind: pf?.auth === 7 ? 'machine' : pf?.auth === 6 ? 'hive' : 'normal' }, stage: (0, speech_1.stageView)((0, speech_1.speechStage)(pf), L),
        types: speech_1.SPEECH_TYPES.map((t) => { const o = outlookOf((0, speech_1.baseMood)(pf, t.key, exports.speech.crowdCtx)); return { key: t.key, name: t.name, effects: L(t.effects, t.effectsEn), outlook: o, outlookText: outlookText(o) }; }),
        grades: speech_1.GRADES.map((g) => ({ grade: g.grade, name: g.name, days: g.days })),
        sess: cur ? { kind: cur.kind, turns: cur.turns, max: cur.max, mood: cur.mood, log: cur.log.slice(-400), done: cur.done } : null,
    };
}
function pushSpeech() { if (exports.speech.win && !exports.speech.win.isDestroyed())
    exports.speech.win.webContents.send('speechState', speechView()); }
const SPEECH_TURN_TOKENS = 1500; // 군중 반응 한 번의 토큰 한도(다시 부를 때는 두 배)
const SPEECH_ACK_MS = 15000; // 버프 명령을 보낸 뒤 게임의 확인(SPEECH phase=applied)을 기다리는 시간
/** 연설을 끝내고 기록을 남긴다(버프가 확인됐거나 등급 0 이라 보낼 것이 없을 때). */
function finishSpeech(cur, t, grade, gname, date) {
    const s = cur.sess;
    s.done = true;
    if (exports.speech.sess === cur)
        exports.speech.sess = null;
    (0, exports.speechStore)().finish(cur.sid);
    // 기록은 남기는 순간의 인터페이스 언어로(2026-10-19)
    const GEN = ['Failed', 'Acceptable', 'Good', 'Excellent'], gEn = GEN[grade] ?? gname;
    (0, chronicle_app_1.chronPut)(chronicle_1.RADIO_IDX, date, L(`연설: ${t.name}(${gname}) — 국민 분위기 ${s.mood >= 55 ? '열광' : s.mood >= 30 ? '호응' : s.mood >= 8 ? '무난' : '싸늘'}`, `Speech: ${t.nameEn} (${gEn}) — public mood ${s.mood >= 55 ? 'enthusiastic' : s.mood >= 30 ? 'responsive' : s.mood >= 8 ? 'fair' : 'chilly'}`), false, { name: '성간라디오 전용 연대기', world: true, uid: `speech|${date}|${exports.speech.applyN}` });
    if (radio_app_1.radio.on)
        radio_app_1.radio.q.push({ kind: 'speech', date, text: L(`연설: ${ctx_1.ctx.playerName || '플레이어 제국'}의 지도자가 ${t.name} 연설을 했다(국민 반응: ${gname})`, `Speech: the leader of ${ctx_1.ctx.playerName || 'the player empire'} gave a ${t.nameEn} speech (public reaction: ${gEn})`), n: exports.speech.applyN, id: `speech|${date}|${exports.speech.applyN}` });
    pushSpeech();
}
/** SPEECH phase=applied 줄: 기다리는 요청이 있으면 그쪽으로, 시간이 지난 요청이면 늦게라도 마무리한다. */
function onSpeechApplied(sid, key, n) {
    if (sid !== ctx_1.ctx.curSaveId)
        return;
    if (exports.speech.ackWaiter) {
        exports.speech.ackWaiter(sid, key, n);
        return;
    }
    if (exports.speech.late && (0, speech_1.speechAppliedMatches)(exports.speech.late, sid, key, n)) {
        const f = exports.speech.late.finish;
        exports.speech.late = null;
        f();
    }
}
function openSpeech(glass = false) {
    if (exports.speech.win && !exports.speech.win.isDestroyed()) {
        exports.speech.win.show();
        exports.speech.win.focus();
        pushSpeech();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1700, Math.round(area.width * 0.94)), height: Math.min(960, Math.round(area.height * 0.9)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.speech.win = new electron_1.BrowserWindow({ ...sz, x, y, resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', ...(0, office_1.glassWin)(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.speech.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.speech.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'speech.html'));
    exports.speech.win.once('ready-to-show', () => { exports.speech.win?.show(); pushSpeech(); });
    exports.speech.win.on('closed', () => { exports.speech.win = null; });
}
/** 결정을 눌렀다는 로그. 세이브 번호를 아직 모르면 번호를 알 때까지 기다린다. */
function startSpeechPrep(date, pf) {
    if (!ctx_1.ctx.curSaveId) {
        exports.speech.prepPending = { date, pf };
        return;
    }
    if ((0, exports.speechStore)().start(ctx_1.ctx.curSaveId, date, pf)) {
        const due = (0, exports.speechStore)().get(ctx_1.ctx.curSaveId).due;
        ctx_1.ctx.notify({ kind: 'info', title: (0, settings_ui_1.pick)('연설 준비 시작', 'Speech preparation started'), body: (0, settings_ui_1.pick)(`연설 준비를 시작했습니다. 게임 날짜로 3개월 뒤(${due})에 알려 드립니다.`, `Speech preparation has started. You will be notified in 3 game months (${due}).`) });
        pushSpeech();
    }
}
/** SPEECHWAR 줄을 모아 SPEECHCTX 원시값과 함께 군중 상황으로 바꾼다(2026-10-16, src/gamestate.ts). */
const crowdCtxCollector = new gamestate_1.SpeechCtxCollector();
function registerSpeech(router) {
    router.on(log_router_1.SLOT.SPEECH_PF, 'speech:pf', (m) => {
        {
            const spf = (0, speech_1.pfFrom)(m);
            if (spf)
                exports.speech.pfLast = spf;
            const sc = crowdCtxCollector.feed(m);
            if (sc)
                exports.speech.crowdCtx = sc;
        }
    });
    router.on(log_router_1.SLOT.SPEECH, 'speech:phase', (m) => {
        if (m.kind === 'SPEECH') {
            if (m.kv.phase === 'prep')
                startSpeechPrep(ctx_1.ctx.gameDate, exports.speech.pfLast);
            else if (m.kv.phase === 'applied')
                onSpeechApplied(m.kv.sid ?? '', m.kv.key ?? '', m.kv.n === undefined ? NaN : Number(m.kv.n));
        }
    });
    electron_1.ipcMain.handle('speechState', async () => speechView());
    electron_1.ipcMain.handle('speechClose', async () => { if (exports.speech.win && !exports.speech.win.isDestroyed())
        exports.speech.win.close(); return true; });
    electron_1.ipcMain.handle('speechStart', async (_e, kind) => {
        const t = (0, speech_1.speechType)(kind);
        if (!t)
            return { ok: false, error: (0, settings_ui_1.pick)('연설 종류를 확인해 주세요.', 'Please check the speech type.') };
        if (!(0, exports.speechReady)() || !ctx_1.ctx.curSaveId)
            return { ok: false, error: (0, settings_ui_1.pick)('아직 연설 준비가 끝나지 않았습니다.', 'The speech is not ready yet.') };
        if (exports.speech.sess && exports.speech.sess.sid === ctx_1.ctx.curSaveId && exports.speech.sess.sess.turns > 0)
            return { ok: false, error: (0, settings_ui_1.pick)('이미 연설이 진행 중입니다.', 'A speech is already in progress.') };
        const speechSid = ctx_1.ctx.curSaveId;
        await ctx_1.ctx.refreshEthics(ctx_1.ctx.playerIdx);
        if (speechSid !== ctx_1.ctx.curSaveId || !(0, exports.speechReady)())
            return { ok: false, error: (0, settings_ui_1.pick)('연설 상태가 바뀌었습니다.', 'The speech state changed.') };
        const pf = ctx_1.ctx.speechWithEthics((0, exports.speechStore)().get(ctx_1.ctx.curSaveId).pf ?? exports.speech.pfLast);
        exports.speech.sess = { sid: ctx_1.ctx.curSaveId, sess: (0, speech_1.newSession)(t.key, pf, settings_1.settings.speechTurns, exports.speech.crowdCtx) };
        pushSpeech();
        return { ok: true, state: speechView() };
    });
    electron_1.ipcMain.handle('speechSay', async (_e, text) => {
        if (typeof text !== 'string')
            return { ok: false, error: (0, settings_ui_1.pick)('발언을 확인해 주세요.', 'Please check what you said.') };
        const bad = (0, speech_1.checkTurnText)(text);
        if (bad)
            return { ok: false, error: bad };
        if (exports.speech.busy)
            return { ok: false, error: (0, settings_ui_1.pick)('이미 처리 중입니다.', 'Already in progress.') };
        if (!exports.speech.sess || exports.speech.sess.sid !== ctx_1.ctx.curSaveId || !(0, exports.speechReady)())
            return { ok: false, error: (0, settings_ui_1.pick)('진행 중인 연설이 없습니다.', 'No speech is in progress.') };
        if (exports.speech.sess.sess.done)
            return { ok: false, error: (0, settings_ui_1.pick)('발언 횟수를 모두 썼습니다. 결과를 확정해 주세요.', 'You have used all your turns. Please finalize the result.') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: (0, settings_ui_1.pick)('게임이 켜져 있어야 연설할 수 있습니다.', 'The game must be running to give a speech.') };
        exports.speech.busy = true;
        const cur = exports.speech.sess, s = cur.sess;
        try {
            const pf = ctx_1.ctx.speechWithEthics((0, exports.speechStore)().get(cur.sid).pf ?? exports.speech.pfLast), date = ctx_1.ctx.gameDate, clean = text.replace(/\s+/g, ' ').trim(), final = s.turns + 1 >= s.max;
            // 추론 모델은 추론 토큰도 한도에 들어가 700 으로는 자주 끊겼다. 1500 으로 부르고, 끊기면 한도를 두 배로 늘리고 짧게 쓰라고 다시 부른다.
            let r = null;
            for (let i = 0; i < 2; i++) {
                let cut = false;
                const p = (0, speech_1.parseTurn)(await ctx_1.ctx.ai.chat((0, speech_1.turnMessages)(ctx_1.ctx.playerName, pf, s, clean, date, final, exports.speech.crowdCtx, i > 0), { maxTokens: SPEECH_TURN_TOKENS * (i + 1), json: true, conversationId: (0, aiclient_1.conversationOf)(s), onTruncated: () => { cut = true; } }));
                if (p && !p.partial) {
                    r = p;
                    break;
                }
                if (p && !r)
                    r = p; // 끊긴 조각에서 되살린 반응은 다시 시도해도 안 될 때 쓴다
                (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'speech', attempt: i + 1, truncated: cut, partial: !!p });
            }
            if (!r)
                return { ok: false, error: (0, settings_ui_1.pick)('국민의 반응을 읽지 못했습니다. 다시 시도해 주세요(이번 발언은 횟수에 세지 않습니다).', 'Could not read the people\'s reaction. Please try again (this line does not count as a turn).') };
            if (exports.speech.sess !== cur)
                return { ok: false, error: (0, settings_ui_1.pick)('연설이 바뀌었습니다.', 'The speech changed.') }; // 도중에 세이브가 바뀌거나 취소됨
            const { delta } = (0, speech_1.applyTurn)(s, clean, r);
            pushSpeech();
            return { ok: true, delta, state: speechView() };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            exports.speech.busy = false;
        }
    });
    /** 연설을 마친다(횟수를 다 썼거나 플레이어가 마치기를 눌렀을 때). 최종 분위기로 등급을 정하고 버프를 건다. */
    electron_1.ipcMain.handle('speechEnd', async () => {
        if (exports.speech.busy)
            return { ok: false, error: (0, settings_ui_1.pick)('이미 처리 중입니다.', 'Already in progress.') };
        if (!exports.speech.sess || exports.speech.sess.sid !== ctx_1.ctx.curSaveId || !(0, exports.speechReady)())
            return { ok: false, error: (0, settings_ui_1.pick)('진행 중인 연설이 없습니다.', 'No speech is in progress.') };
        const cur = exports.speech.sess, s = cur.sess;
        if (s.turns < 1)
            return { ok: false, error: (0, settings_ui_1.pick)('한 번도 발언하지 않았습니다.', 'You have not spoken yet.') };
        if (exports.speech.sentFor && exports.speech.sentFor.cur === cur && exports.speech.sentFor.epoch === game_link_1.link.epoch)
            return { ok: false, error: (0, settings_ui_1.pick)('이 연설의 버프 명령은 이미 보냈습니다. 게임이 확인해 주면 자동으로 마무리됩니다(다시 보내지 않습니다).', 'This speech\'s buff command was already sent. It will finish automatically once the game confirms (it will not be resent).') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: (0, settings_ui_1.pick)('게임이 켜져 있어야 연설을 마칠 수 있습니다.', 'The game must be running to finish the speech.') };
        exports.speech.busy = true;
        try {
            const t = (0, speech_1.speechType)(s.kind), date = ctx_1.ctx.gameDate, grade = (0, speech_1.moodGrade)(s.mood), gname = speech_1.GRADES.find((g) => g.grade === grade)?.name ?? '';
            if (grade > 0) {
                const n = ++game_link_1.link.reqCounter, cmd = (0, speech_1.speechApplyEffect)(t.key, grade, n);
                exports.speech.applyN = n;
                const expected = { sid: cur.sid, n, key: `sllm_speech_${t.key}_${grade}` };
                exports.speech.late = null;
                // 대기는 명령을 큐에 넣기 전에 걸어 두되(빨리 온 확인도 받도록), 시간 재기는 명령이 실제로 나간 뒤에 시작한다.
                let acked = false, to = null, settle = () => { };
                const ack = new Promise((resolve) => { settle = resolve; });
                exports.speech.ackWaiter = (sid, key, number) => { if (exports.speech.sess !== cur || ctx_1.ctx.curSaveId !== cur.sid || !(0, speech_1.speechAppliedMatches)(expected, sid, key, number))
                    return; acked = true; if (to)
                    clearTimeout(to); exports.speech.ackWaiter = null; settle(true); };
                exports.speech.sentFor = { cur, epoch: game_link_1.link.epoch }; // 보내기 전에 표시(세이브를 다시 불러오면 epoch 가 바뀌어 다시 보낼 수 있다)(시간 초과 뒤 [마치기]를 다시 눌러도 같은 버프를 두 번 걸지 않게)
                try {
                    await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)(cmd));
                }
                catch (e) {
                    exports.speech.ackWaiter = null;
                    exports.speech.sentFor = null;
                    return { ok: false, error: (0, settings_ui_1.pick)('게임에 명령을 보내지 못했습니다: ', 'Could not send the command to the game: ') + e.message };
                }
                if (!acked)
                    to = setTimeout(() => { if (exports.speech.ackWaiter)
                        exports.speech.ackWaiter = null; settle(false); }, SPEECH_ACK_MS);
                if (!(await ack)) {
                    // 늦게라도 SPEECH phase=applied 가 오면 그때 마무리한다(자동 재전송은 하지 않는다).
                    exports.speech.late = { ...expected, finish: () => { if (exports.speech.sess !== cur || ctx_1.ctx.curSaveId !== cur.sid)
                            return; finishSpeech(cur, t, grade, gname, date); ctx_1.ctx.notify({ kind: 'speech', title: (0, settings_ui_1.pick)('연설 마무리', 'Speech concluded'), body: (0, settings_ui_1.pick)(`게임이 늦게 버프 적용을 확인했습니다: ${t.name}(${gname})`, `The game confirmed the buffs late: ${t.name} (${gname})`) }); } };
                    return { ok: false, error: (0, settings_ui_1.pick)('게임이 아직 버프 적용을 확인해 주지 않았습니다. 늦게라도 확인되면 자동으로 마무리됩니다. 게임이 켜져 있는지, 모드가 최신인지 확인해 주세요(연설 내용은 그대로 남아 있습니다).', 'The game has not confirmed the buffs yet. It will finish automatically if confirmed later. Check that the game is running and the mod is up to date (your speech is kept).') };
                }
            }
            if (ctx_1.ctx.curSaveId !== cur.sid || exports.speech.sess !== cur)
                return { ok: false, error: (0, settings_ui_1.pick)('세이브 또는 연설이 바뀌어 결과를 확정하지 않았습니다.', 'The save or speech changed, so the results were not finalized.') };
            finishSpeech(cur, t, grade, gname, date);
            return { ok: true, grade, gradeName: gname, mood: s.mood, days: speech_1.GRADES.find((g) => g.grade === grade)?.days ?? 0, type: t.key, turns: s.turns };
        }
        finally {
            exports.speech.busy = false;
        }
    });
}
//# sourceMappingURL=speech-app.js.map
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
exports.fallenBlocked = exports.fallenCalls = exports.chat = void 0;
exports.resetConversation = resetConversation;
exports.fallenConnect = fallenConnect;
exports.switchHistory = switchHistory;
exports.flushMoods = flushMoods;
exports.doChat = doChat;
exports.registerChat = registerChat;
// A-00b 6번: 외교 대화(앱 쪽) — AI 와의 대화(doChat), 수락 대기 제안(accept·reject), 대화 중 쌓인 호감(pend → flushMoods),
// 게임 안 키보드 창(KBP·KB → onGameInput, writeChatLoc), 대화 상대·성향 줄(TALK·PROFILE·OPSHIFT·END), 시험용 IPC(forcePeace·apply).
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 다른 모듈은 이 상태를 ctx.talk·ctx.pending 등으로 본다(서신 답장·단말기).
const peace_app_1 = require("./peace-app");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const settings_1 = require("../app/settings");
const action_1 = require("../action");
const prompt_1 = require("../prompt");
const hangul_1 = require("../hangul");
const transcript_1 = require("../transcript");
const protocol_1 = require("../protocol");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const chronicle_app_1 = require("./chronicle-app");
const mail_app_1 = require("./mail-app");
const ctx_1 = require("../app/ctx");
const crypto_1 = require("crypto");
const chat_history_1 = require("../chat-history");
const i18n_pick_1 = require("../i18n-pick"); // 한/영 문구(2026-10-19 영어 화면 점검)
const fallen_1 = require("../fallen");
/** 대화 상태(main.ts의 let 변수들을 모았다) */
exports.chat = {
    busy: false, session: (0, crypto_1.randomUUID)(),
    /** 지금 대화 중인 상대 */
    talk: null,
    history: [],
    /** 상대별 대화 기록(2026-10-17): 다른 상대로 옮겨 가도 지우지 않고, 돌아오면 이어서 쓴다. 세이브가 바뀌면 비운다 */
    histories: new Map(),
    /** 플레이어가 수락해야 실행되는 제안(한 번에 하나) */
    pending: null,
    pendingSeq: 0,
    /** 마지막 AI 대사(게임 안 창에 띄울 문장) */
    lastSay: '',
    /** 대화 중 쌓인 호감 변화. 대화가 끝날 때(상대 전환·종료 버튼·앱 닫기) 한 번에 게임에 보낸다 */
    pend: null,
    /** 게임이 알려 준 새 의견 값 */
    lastShift: null,
    /** 게임 안 키보드 창의 대화 상대 */
    kbTid: 0,
    /** 같은 입력을 두 번 처리하지 않도록 */
    lastKbN: -1,
    /** 입력 번호 → 조각(KBP p=1..8, 오래된 키부터) */
    kbParts: new Map(),
};
function currentShift() {
    return exports.chat.lastShift;
}
// 일반 통신은 횟수 제한·호의 지급 없음(2026-10-17 사용자 결정: 10회·호의는 만찬 대화에만). 세이브·상대가 바뀌면 늦은 응답만 막는다.
function resetConversation() { exports.chat.session = (0, crypto_1.randomUUID)(); }
// 몰락한 제국(잠든 상태) 통신(2026-10-19): 그들이 응할 때만 연결, 주고받을 때마다 끊을 확률 +20%. 끊거나 거절한 해(게임 연도)에는 다시 응하지 않는다.
exports.fallenCalls = new Map(); // 'sid:idx' → 이번 통신에서 주고받은 횟수
exports.fallenBlocked = new Map(); // 'sid:idx' → 거절·끊음이 있었던 해('YYYY')
const fkey = (idx) => (ctx_1.ctx.curSaveId || '') + ':' + idx;
/** 새 통신이 연결될 때: 몰락한 제국이면 응할지 정한다. 돌려준 talk 의 ended 가 true 면 응하지 않음. */
function fallenConnect(t, rnd = Math.random) {
    if ((0, fallen_1.fallenState)(t.ctype) !== 'dormant')
        return t.ended ? { ...t, ended: false } : t;
    const k = fkey(t.idx), mon = (0, fallen_1.yearKey)(ctx_1.ctx.gameDate || '');
    if (mon && exports.fallenBlocked.get(k) === mon) {
        ctx_1.ctx.toUi('event', fallen_1.fallenText.refusedYear(t.name));
        return { ...t, ended: true };
    }
    if (rnd() >= (0, fallen_1.answerChance)(t.score, (0, fallen_1.fallenKind)(t.ethicIds, t.profile?.personality), !!t.profile?.flags.war)) {
        if (mon)
            exports.fallenBlocked.set(k, mon);
        exports.fallenCalls.delete(k);
        ctx_1.ctx.toUi('event', fallen_1.fallenText.refused(t.name));
        return { ...t, ended: true };
    }
    exports.fallenCalls.set(k, 0);
    ctx_1.ctx.toUi('event', fallen_1.fallenText.accepted(t.name));
    return { ...t, ended: false };
}
function switchHistory(prev, next) { exports.chat.history = (0, chat_history_1.switchHistories)(exports.chat.histories, exports.chat.history, prev, next); }
function pendDelta() { return exports.chat.pend ? exports.chat.pend.steps.reduce((a, s) => a + (0, action_1.moodDelta)(s), 0) : 0; }
function flushMoods() {
    const p = exports.chat.pend;
    exports.chat.pend = null;
    if (!p || !ctx_1.ctx.actionsAllowed(p.idx))
        return Promise.resolve();
    const steps = (0, action_1.netSteps)(p.steps);
    {
        const dl = p.steps.reduce((a, s) => a + (0, action_1.moodDelta)(s), 0);
        if (dl)
            (0, chronicle_app_1.chronNote)(p.idx, (0, i18n_pick_1.L)(`대화 끝에 서로의 호감이 ${dl > 0 ? '올랐다' : '떨어졌다'}(${dl > 0 ? '+' : ''}${dl})`, `By the end of the talk our mutual favor ${dl > 0 ? 'rose' : 'fell'} (${dl > 0 ? '+' : ''}${dl})`));
    }
    if (!steps.length) {
        ctx_1.ctx.toUi('mood', (0, i18n_pick_1.L)(`${p.name}: 쌓인 호감 변화가 서로 상쇄되어 적용할 것이 없습니다.`, `${p.name}: the accumulated favor changes cancelled out, so there is nothing to apply.`));
        return Promise.resolve();
    }
    return (0, game_link_1.enqueue)(async () => {
        exports.chat.lastShift = null;
        const o = await (0, game_link_1.sendBatch)(steps.length, (reqs) => (0, protocol_1.opinionShiftEffects)(reqs, p.idx, steps));
        if (o === 'ok') {
            const ls = currentShift();
            ctx_1.ctx.toUi('mood', (0, i18n_pick_1.L)(`${p.name}의 호감을 게임에 반영했습니다`, `Applied ${p.name}'s favor to the game`) + (ls && ls.idx === p.idx ? ` (${p.base} → ${ls.op})` : ''));
        }
        else {
            ctx_1.ctx.toUi('mood', (0, i18n_pick_1.L)(`${p.name}의 호감 변화를 적용하지 못했습니다(${o}).`, `Could not apply ${p.name}'s favor change (${o}).`));
        }
    }).catch((e) => ctx_1.ctx.toUi('mood', (0, i18n_pick_1.L)('호감 변화 전송 실패: ', 'Failed to send the favor change: ') + e.message));
}
const WR_EN = { humiliation: 'Humiliation', tribute: 'Demand tribute', revenge: 'Revenge' };
const MOOD_EN = { 1: 'rose a little', 2: 'rose a lot', 3: 'fell a little', 4: 'fell a lot' };
async function doChat(text) {
    if (exports.chat.busy)
        throw new Error((0, i18n_pick_1.L)('상대의 답변을 기다려 주세요.', 'Please wait for their reply.'));
    if (typeof text !== 'string' || !text.trim() || text.length > 1600)
        throw new Error((0, i18n_pick_1.L)('발언을 1~1600자로 입력하세요.', 'Enter 1–1600 characters.'));
    ctx_1.ctx.needPaused();
    if (!exports.chat.talk)
        throw new Error((0, i18n_pick_1.L)('외교 단말기의 연락처에서 통신할 제국을 선택하세요.', 'Choose an empire to contact from the diplomatic terminal\'s contacts.'));
    if (exports.chat.talk.ended)
        throw new Error(fallen_1.fallenText.closed());
    const sid = ctx_1.ctx.curSaveId, epoch = game_link_1.link.epoch, idx = exports.chat.talk.idx, session = exports.chat.session;
    exports.chat.busy = true;
    try {
        exports.chat.talk = ctx_1.ctx.withLore(exports.chat.talk);
        const dormant = (0, fallen_1.fallenState)(exports.chat.talk.ctype) === 'dormant', fk = fkey(idx), turn = (exports.fallenCalls.get(fk) ?? 0) + 1;
        const final = dormant && Math.random() < (0, fallen_1.hangupChance)(turn); // 이번 답을 마지막으로 끊는지(미리 정해 AI 가 끊는 말을 하게)
        const messages = (0, prompt_1.buildMessages)(exports.chat.talk, exports.chat.history, text, Math.random, final);
        const raw = await ctx_1.ctx.ai.chat(messages, { maxTokens: 1800, conversationId: `diplomacy:${sid}:${idx}:${session}` });
        if (ctx_1.ctx.curSaveId !== sid || game_link_1.link.epoch !== epoch || exports.chat.session !== session || exports.chat.talk?.idx !== idx)
            throw new Error((0, i18n_pick_1.L)('통신 또는 세이브가 바뀌어 응답을 반영하지 않았습니다.', 'The channel or save changed, so the reply was not applied.'));
        exports.chat.history.push({ role: 'user', content: text }, { role: 'assistant', content: raw });
        // (아래 parseReply 후 lastSay 를 갱신한다)
        const r = (0, action_1.parseReply)(raw);
        if (!ctx_1.ctx.actionsAllowed(exports.chat.talk.idx)) {
            r.action = null;
            r.mood = 0;
        }
        if (dormant)
            r.action = null; // 몰락한 제국: 일방적 통신, 게임 행동 없음
        exports.chat.lastSay = r.say;
        exports.chat.pending = null;
        let proposal = null;
        let hint = null;
        if (r.action && r.action.type === 'defer') {
            const topic = r.action.topic ?? (0, i18n_pick_1.L)('조약 제안', 'Treaty proposal');
            if (ctx_1.ctx.curSaveId && exports.chat.talk.profile) {
                const lean = (0, prompt_1.treatyLean)(exports.chat.talk);
                const item = (0, mail_app_1.deferred)().add({ sid: ctx_1.ctx.curSaveId, idx: exports.chat.talk.idx, name: exports.chat.talk.name, topic, asked: ctx_1.ctx.gameDate, lean, op: exports.chat.talk.score, profile: exports.chat.talk.profile }, 1 + Math.floor(Math.random() * 3));
                if (item) {
                    (0, chronicle_app_1.chronNote)(exports.chat.talk.idx, (0, i18n_pick_1.L)(`"${topic}" 건은 의원들과 논의한 뒤 서신으로 답하겠다고 했다`, `Said they would discuss "${topic}" with their councilors and answer by letter`));
                    hint = (0, i18n_pick_1.L)(`"${topic}" 건은 ${item.due} 무렵 서신으로 답이 옵니다.`, `A letter about "${topic}" will arrive around ${item.due}.`);
                }
                else
                    hint = (0, i18n_pick_1.L)(`"${topic}" 건은 이미 논의 중입니다.`, `"${topic}" is already under discussion.`);
            }
            else
                hint = (0, i18n_pick_1.L)('세이브 정보를 몰라 서신 약속은 기록하지 못했습니다.', 'The save is unknown, so the letter promise was not recorded.');
            r.action = null;
        }
        if (r.action && r.action.type === 'declare_war' && (!exports.chat.talk.profile || ['war', 'truce', 'fed', 'nap', 'def'].some((k) => exports.chat.talk.profile.flags[k]))) {
            hint = (0, i18n_pick_1.L)('이미 전쟁·휴전·조약 중이라 선전포고 제안은 무시했습니다.', 'Already at war, in a truce or bound by a treaty, so the war declaration was ignored.');
        }
        else if (r.action && r.action.type === 'declare_war') {
            // 선전포고는 AI 의 결정이다. 제안 없이 바로 게임에 보낸다.
            const t = exports.chat.talk;
            const reasonKey = r.action.reason ?? 'humiliation';
            (0, game_link_1.enqueue)(async () => {
                const wr = action_1.WAR_REASONS[reasonKey] ?? action_1.WAR_REASONS.humiliation;
                const o = await (0, game_link_1.sendAndWait)((req) => (0, protocol_1.diploEffect)(req, t.idx, wr.kind));
                const text = o === 'ok' ? (0, i18n_pick_1.L)(`${t.name}이(가) 당신에게 선전포고했습니다! (사유: ${wr.ko})`, `${t.name} has declared war on you! (Reason: ${WR_EN[reasonKey] ?? WR_EN.humiliation})`) :
                    o === 'fail' ? (0, i18n_pick_1.L)(`${t.name}의 선전포고가 게임에서 받아들여지지 않았습니다(휴전·조약·전쟁 명분 문제일 수 있습니다).`, `${t.name}'s war declaration was not accepted by the game (possibly a truce, treaty or casus belli issue).`) :
                        o === 'timeout' ? (0, i18n_pick_1.L)('선전포고 처리에 게임이 응답하지 않았습니다.', 'The game did not respond to the war declaration.') : (0, i18n_pick_1.L)(`선전포고 요청이 거부되었습니다(${o}).`, `The war declaration request was refused (${o}).`);
                if (o === 'ok')
                    (0, chronicle_app_1.chronNote)(t.idx, (0, i18n_pick_1.L)(`상대가 우리에게 선전포고했다(사유: ${wr.ko})`, `They declared war on us (reason: ${WR_EN[reasonKey] ?? WR_EN.humiliation})`));
                exports.chat.history.push({ role: 'user', content: transcript_1.SYSTEM_PREFIX + text });
                ctx_1.ctx.toUi('event', text);
            }).catch((e) => ctx_1.ctx.toUi('event', (0, i18n_pick_1.L)('선전포고 전송 실패: ', 'Failed to send the war declaration: ') + e.message));
        }
        else if (r.action && r.action.type === 'make_peace' && !exports.chat.talk.profile?.flags.war) {
            hint = (0, i18n_pick_1.L)('전쟁 중이 아니라서 평화 제안은 무시했습니다.', 'Not at war, so the peace proposal was ignored.');
        }
        else if (r.action) {
            exports.chat.pending = { id: ++exports.chat.pendingSeq, action: r.action, tid: exports.chat.talk.idx, aiName: exports.chat.talk.name, epoch: game_link_1.link.epoch };
            proposal = { id: exports.chat.pending.id, text: (0, action_1.describe)(r.action, exports.chat.talk.name), confirm: false };
        }
        if (r.mood > 0) {
            if (!exports.chat.pend || exports.chat.pend.idx !== exports.chat.talk.idx)
                exports.chat.pend = { idx: exports.chat.talk.idx, name: exports.chat.talk.name, base: exports.chat.talk.score, steps: [] };
            exports.chat.pend.steps.push(r.mood);
            exports.chat.talk = { ...exports.chat.talk, score: exports.chat.pend.base + pendDelta() };
            ctx_1.ctx.toUi('talk', exports.chat.talk);
            ctx_1.ctx.toUi('mood', (0, i18n_pick_1.L)(`${exports.chat.talk.name}의 호감이 ${(0, action_1.moodText)(r.mood)} (대화가 끝나면 게임에 반영됩니다)`, `${exports.chat.talk.name}'s favor ${MOOD_EN[r.mood] ?? 'changed'} (applied to the game when the talk ends)`));
        }
        let ended = false;
        if (dormant) {
            exports.fallenCalls.set(fk, turn);
            if (final) {
                ended = true;
                exports.fallenCalls.delete(fk);
                {
                    const mon = (0, fallen_1.yearKey)(ctx_1.ctx.gameDate || '');
                    if (mon)
                        exports.fallenBlocked.set(fk, mon);
                }
                exports.chat.talk = { ...exports.chat.talk, ended: true };
                exports.chat.history.push({ role: 'user', content: transcript_1.SYSTEM_PREFIX + 'They closed the channel.' });
                hint = [hint, fallen_1.fallenText.hungUp(exports.chat.talk.name)].filter(Boolean).join(' ');
                if (exports.chat.pend)
                    void flushMoods();
            }
        }
        return { say: r.say, note: [r.note, hint].filter(Boolean).join(' ') || null, proposal, ...(ended ? { ended } : {}) };
    }
    finally {
        exports.chat.busy = false;
    }
}
// 게임 안 창(통신 창·키보드 창)에 띄울 글을 지역화 파일로 쓴다. 실패하면 오류 문장을 돌려준다.
function writeChatLoc() {
    if (electron_1.app.isPackaged || /[\\/]workshop[\\/]content[\\/]/i.test(ctx_1.ctx.MOD_DIR))
        return '배포판에서는 게임 내 키보드 시험 기능을 사용하지 않습니다. 외교 단말기를 이용하세요.';
    const bom = '\uFEFF';
    // 게임 안 창의 오른쪽 칸: 최근 대화 기록(가장 최근 말이 맨 아래). 기록이 없으면 마지막 대사나 안내문.
    const say = (0, transcript_1.transcriptText)(exports.chat.history, exports.chat.talk?.name ?? 'AI', exports.chat.lastSay || '(통신이 연결되었습니다. 아래 키보드로 할 말을 입력하세요.)');
    const body = (lang, close) => `${bom}l_${lang}:\n SLLM_CHAT_TITLE:0 "(실험모드) ${(0, action_1.locSafe)(exports.chat.talk?.name ?? '외교 통신')}"\n SLLM_CHAT_DESC:0 "${(0, action_1.locSafe)(say)}"\n SLLM_CHAT_CLOSE:0 "${close}"\n`;
    try {
        fs.writeFileSync(path.join(ctx_1.ctx.MOD_DIR, 'localisation', 'korean', 'sllm_probe_chat_l_korean.yml'), body('korean', '대화 종료'), 'utf8');
        fs.writeFileSync(path.join(ctx_1.ctx.MOD_DIR, 'localisation', 'english', 'sllm_probe_chat_l_english.yml'), body('english', 'End conversation'), 'utf8');
        return null;
    }
    catch (e) {
        return '지역화 파일을 쓰지 못했습니다: ' + e.message;
    }
}
function onKbPart(m) {
    const n = m.kv.n ?? '', p = Number(m.kv.p);
    if (!(p >= 1 && p <= 16))
        return;
    const parts = exports.chat.kbParts.get(n) ?? [];
    parts[p - 1] = m.kv.c ?? '';
    exports.chat.kbParts.set(n, parts);
}
// 게임 안 키보드로 받은 말을 AI 에게 보내고, 답을 게임 안 창에 다시 띄운다.
async function onGameInput(m) {
    const n = Number(m.kv.n);
    if (Number.isFinite(n) && n === exports.chat.lastKbN)
        return;
    exports.chat.lastKbN = n;
    const parts = exports.chat.kbParts.get(m.kv.n ?? '') ?? [];
    exports.chat.kbParts.clear();
    const text = (0, hangul_1.decodeKeys)((0, hangul_1.parseKeyList)(parts.filter((x) => x).join(',')));
    if (!text) {
        ctx_1.ctx.toUi('kbchat', { me: '', ai: '', note: (0, i18n_pick_1.L)('빈 입력이라 보내지 않았습니다.', 'Empty input, so nothing was sent.') });
        return;
    }
    ctx_1.ctx.toUi('kbchat', { me: text });
    try {
        const r = await doChat(text);
        ctx_1.ctx.toUi('kbchat', { ai: r.say, note: r.note, proposal: r.proposal });
    }
    catch (e) {
        exports.chat.lastSay = (0, i18n_pick_1.L)('(통신 오류: ', '(Comms error: ') + e.message + ')';
        ctx_1.ctx.toUi('kbchat', { note: (0, i18n_pick_1.L)('오류: ', 'Error: ') + e.message });
    }
    if (writeChatLoc())
        return;
    const tid = exports.chat.kbTid || exports.chat.talk?.idx || 0;
    try { // 게임 연결이 끊겼거나 세이브가 바뀌면 명령 큐가 거부한다. 처리 안 된 오류로 남기지 말고 화면에 알린다(2026-10-18).
        await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)('reload text'));
        await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)((0, protocol_1.openKbEffect)(tid, false)));
    }
    catch (e) {
        ctx_1.ctx.toUi('kbchat', { note: (0, i18n_pick_1.L)('게임 화면의 답장 갱신 실패: ', 'Failed to refresh the in-game reply: ') + e.message });
    }
}
function registerChat(router, noteSave) {
    router.on(log_router_1.SLOT.OPSHIFT, 'chat:opshift', (m) => {
        if (m.kind === 'OPSHIFT') {
            const idx = Number(m.kv.idx), op = Number(m.kv.op);
            if (Number.isFinite(idx) && Number.isFinite(op)) {
                exports.chat.lastShift = { idx, op };
                if (exports.chat.talk && exports.chat.talk.idx === idx) {
                    exports.chat.talk = { ...exports.chat.talk, score: op };
                    ctx_1.ctx.toUi('talk', exports.chat.talk);
                }
            }
        }
    });
    router.on(log_router_1.SLOT.KEYBOARD, 'chat:keyboard', (m) => {
        if (m.kind === 'KBP')
            onKbPart(m);
        if (m.kind === 'KB')
            void onGameInput(m);
    });
    router.on(log_router_1.SLOT.END, 'chat:end', (m) => {
        if (m.kind === 'END' && exports.chat.pend) {
            void flushMoods();
            ctx_1.ctx.toUi('event', (0, i18n_pick_1.L)('게임 안 창에서 대화를 마쳤습니다.', 'The conversation ended in the in-game window.'));
        }
    });
    router.on(log_router_1.SLOT.TALK, 'chat:talk', (m) => {
        const t = (0, prompt_1.talkFrom)(m);
        if (t) {
            if (t.sid)
                noteSave(t.sid);
            if (exports.chat.pend && exports.chat.pend.idx !== t.idx)
                void flushMoods(); // 이전 상대와의 대화가 끝났다
            if (!exports.chat.talk || exports.chat.talk.idx !== t.idx) {
                switchHistory(exports.chat.talk?.idx ?? 0, t.idx);
                resetConversation();
            } // 상대가 바뀌어도 이전 기록은 지우지 않고 상대별로 보관한다
            const known = ctx_1.ctx.profiles.get(t.idx);
            (0, chronicle_app_1.chronNote)(t.idx, (0, i18n_pick_1.L)('처음으로 통신이 연결되어 대화를 나눴다', 'First contact established; we talked for the first time'), true);
            exports.chat.talk = fallenConnect(ctx_1.ctx.withLore({ ...t, score: exports.chat.pend && exports.chat.pend.idx === t.idx ? t.score + pendDelta() : t.score, ...(known ? { profile: known } : {}) }));
            ctx_1.ctx.toUi('talk', exports.chat.talk);
            ctx_1.ctx.win?.webContents.send('pane', 'chat'); // 총독/설정 창이 열려 있었다면 닫고 대화 화면으로 돌아온다
            if (settings_1.settings.autoOpenOnTalk && !ctx_1.ctx.appOpen)
                ctx_1.ctx.setAppOpen(true); // 게임에서 대화 버튼을 눌렀으니 연다
        }
    });
    router.on(log_router_1.SLOT.PROFILE, 'chat:profile', (m) => {
        const pf = (0, prompt_1.profileFrom)(m);
        if (pf)
            ctx_1.ctx.profiles.set(pf.idx, ctx_1.ctx.profileWithEthics(pf.profile, pf.idx));
        if (pf && exports.chat.talk && exports.chat.talk.idx === pf.idx) {
            exports.chat.talk = ctx_1.ctx.withLore({ ...exports.chat.talk, profile: ctx_1.ctx.profileWithEthics(pf.profile, pf.idx) });
            ctx_1.ctx.toUi('talk', exports.chat.talk);
        }
    });
    electron_1.ipcMain.handle('chat', async (_e, text) => doChat(text));
    // 플레이어가 제안을 수락하면 게임에 보내고, 게임의 ACK 를 기다려 결과를 돌려준다.
    electron_1.ipcMain.handle('accept', async (_e, id) => {
        if (exports.chat.pending?.id === id && !ctx_1.ctx.actionsAllowed(exports.chat.pending.tid))
            return { outcome: 'fail', text: (0, i18n_pick_1.L)('이 국가 유형의 게임 행동은 호환 설정에서 비활성화되어 있습니다.', 'In-game actions for this empire type are disabled in the compatibility settings.') };
        if (!exports.chat.pending || exports.chat.pending.id !== id)
            throw new Error((0, i18n_pick_1.L)('이미 처리되었거나 만료된 제안입니다.', 'This proposal was already handled or has expired.'));
        if (exports.chat.pending.epoch !== undefined && exports.chat.pending.epoch !== game_link_1.link.epoch) {
            exports.chat.pending = null;
            throw new Error((0, i18n_pick_1.L)('세이브를 다시 불러와 이 제안은 만료되었습니다.', 'The save was reloaded, so this proposal has expired.'));
        }
        const p = exports.chat.pending;
        if (p.letterId && p.letterSid) {
            (0, mail_app_1.inboxStore)().handleProposal(p.letterSid, p.letterId);
            (0, mail_app_1.syncInbox)();
        }
        exports.chat.pending = null;
        const t = p.action.type;
        const amount = p.action.amount ?? 0;
        // 평화: 현상 유지 규칙으로 영유권 안 점령지를 넘기고 종전·휴전(2026-10-17, src/features/peace-app.ts). 다른 행동은 기존 경로.
        const peace = t === 'make_peace' ? await (0, peace_app_1.playerPeace)(p.tid, p.aiName) : null;
        const o = peace ? peace.outcome : await (0, game_link_1.enqueue)(() => (0, game_link_1.sendAndWait)((req) => t === 'give_energy' || t === 'take_energy'
            ? (0, protocol_1.transferEffect)(req, p.tid, amount, t === 'give_energy' ? 1 : 2)
            : (0, protocol_1.diploEffect)(req, p.tid, t === 'open_borders' ? 1 : 3)));
        const okText = {
            give_energy: (0, i18n_pick_1.L)(`전달 완료: 에너지 ${amount}`, `Transferred: ${amount} energy`),
            take_energy: (0, i18n_pick_1.L)(`전달 완료: 에너지 ${amount}`, `Transferred: ${amount} energy`),
            open_borders: (0, i18n_pick_1.L)('국경 제한이 해제되었습니다(게임 설정 확인 필요).', 'Border restrictions lifted (check in game).'),
            make_peace: peace?.text || (0, i18n_pick_1.L)('평화 처리를 마쳤습니다.', 'Peace processed.'),
            declare_war: (0, i18n_pick_1.L)('선전포고가 이루어졌습니다(실험 기능).', 'War has been declared (experimental).'),
        };
        const text = o === 'ok' ? (okText[t] ?? (0, i18n_pick_1.L)('완료', 'Done')) :
            peace ? peace.text :
                o === 'fail' ? (t === 'make_peace' ? (0, i18n_pick_1.L)('실패: 둘만의 전쟁이 아니거나 전쟁 중이 아닙니다.', 'Failed: not a two-party war, or not at war.') : t === 'declare_war' ? (0, i18n_pick_1.L)('실패: 선전포고를 하지 못했습니다(휴전·조약·전쟁 명분 문제일 수 있습니다).', 'Failed: could not declare war (possibly a truce, treaty or casus belli issue).') : (0, i18n_pick_1.L)('실패: 에너지가 부족하거나 대상을 찾지 못했습니다.', 'Failed: not enough energy or the target was not found.')) :
                    o === 'timeout' ? (0, i18n_pick_1.L)('게임에서 응답이 없습니다. 연결 상태를 확인해 주세요.', 'No response from the game. Check the connection.') :
                        (0, i18n_pick_1.L)(`거부됨(${o}): 요청 번호 문제입니다.`, `Refused (${o}): request number problem.`);
        if (o === 'ok') {
            const ko = { give_energy: (0, i18n_pick_1.L)(`상대가 에너지 ${amount}을(를) 건넸다`, `They handed over ${amount} energy`), take_energy: (0, i18n_pick_1.L)(`상대의 요청으로 우리가 에너지 ${amount}을(를) 건넸다`, `At their request we handed over ${amount} energy`), open_borders: (0, i18n_pick_1.L)('상대가 국경 제한을 풀었다', 'They lifted their border restrictions'), make_peace: (0, i18n_pick_1.L)('상대와 평화 협정을 맺었다', 'We made peace with them') + (() => { const moved = (peace?.lines ?? []).filter((l) => l.includes('이전 확인') || l.includes('Transfer confirmed')); return moved.length ? ` (${moved.map((l) => l.split(':')[0]).join(', ')})` : ''; })() };
            if (ko[t])
                (0, chronicle_app_1.chronNote)(p.tid, ko[t]);
        }
        else if (o === 'fail') {
            const kf = { give_energy: (0, i18n_pick_1.L)('에너지를 건네려 했으나 처리되지 않았다', 'Tried to hand over energy but it did not go through'), take_energy: (0, i18n_pick_1.L)('에너지를 요청했으나 처리되지 않았다', 'Asked for energy but it did not go through'), open_borders: (0, i18n_pick_1.L)('국경 개방이 처리되지 않았다', 'Opening borders did not go through'), make_peace: (0, i18n_pick_1.L)('평화 처리가 받아들여지지 않았다', 'The peace was not accepted') };
            if (kf[t])
                (0, chronicle_app_1.chronNote)(p.tid, kf[t]);
        }
        exports.chat.history.push({ role: 'user', content: transcript_1.SYSTEM_PREFIX + text });
        return { outcome: o, text };
    });
    // 대화 종료: 쌓인 호감 변화를 지금 게임에 보낸다.
    electron_1.ipcMain.handle('finish', async () => {
        if (exports.chat.busy)
            return (0, i18n_pick_1.L)('상대의 답변을 기다린 뒤 종료해 주세요.', 'Wait for their reply before ending.');
        if (!exports.chat.pend)
            return (0, i18n_pick_1.L)('반영할 호감 변화가 없습니다.', 'There is no favor change to apply.');
        await flushMoods();
        return (0, i18n_pick_1.L)('대화를 마쳤습니다.', 'The conversation has ended.');
    });
    electron_1.ipcMain.handle('reject', async (_e, id) => {
        if (exports.chat.pending?.id === id && exports.chat.pending.letterId && exports.chat.pending.letterSid) {
            (0, mail_app_1.inboxStore)().handleProposal(exports.chat.pending.letterSid, exports.chat.pending.letterId);
            (0, mail_app_1.syncInbox)();
        }
        if (exports.chat.pending && exports.chat.pending.id === id) {
            exports.chat.history.push({ role: 'user', content: transcript_1.SYSTEM_PREFIX + 'The player declined the proposal.' });
            exports.chat.pending = null;
        }
        return true;
    });
    // 시험용: AI 의 의사와 상관없이 평화 처리 효과만 시험한다(정식 기능이 아니다).
    electron_1.ipcMain.handle('forcePeace', async (_e, tid) => {
        const r = await (0, peace_app_1.playerPeace)(Number(tid), ctx_1.ctx.terminal.items.find((c) => c.idx === Number(tid))?.name || `제국 #${tid}`);
        return `${r.outcome}: ${r.text}`;
    });
    // 시험용: 플레이어에게 에너지 전송 효과를 콘솔로 보낸다(프로브 모드의 sllm_probe_apply).
    electron_1.ipcMain.handle('apply', async (_e, tid, amt) => {
        game_link_1.link.reqCounter += 1;
        try {
            await (0, game_link_1.sendConsole)((0, protocol_1.applyEffect)(game_link_1.link.reqCounter, tid, amt));
        }
        catch (e) {
            ctx_1.ctx.toUi('status', (0, i18n_pick_1.L)('게임 요청 전송 실패: ', 'Failed to send the game request: ') + e.message);
            throw e;
        }
        return game_link_1.link.reqCounter;
    });
}
//# sourceMappingURL=chat.js.map
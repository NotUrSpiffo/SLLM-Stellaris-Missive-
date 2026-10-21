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
exports.foreign = exports.stanceLabel = exports.condemn = void 0;
exports.warVerdicts = warVerdicts;
exports.stanceOfEmpire = stanceOfEmpire;
exports.resetCondemnSession = resetCondemnSession;
exports.condemnSetInfo = condemnSetInfo;
exports.condemnAfterDeclaration = condemnAfterDeclaration;
exports.registerCondemn = registerCondemn;
exports.openForeignStatement = openForeignStatement;
// 규탄 성명(2026-10-20 알파 10): 전쟁이 시작되면 모드가 보내는 WARVOICE(제국별 관계)를 모아, 선언문을 발표한 뒤(또는 2시간 안에 발표하지 않으면) 각 제국·은하 공동체의 입장을 정하고 AI 가 문장을 쓴다.
// 규칙: src/condemn.ts. 결과: 알림 카드 + 연대기(세계 소식·제국별) + 저장(sllm_condemn.json, 신문·대사관·대화 재료) + (켜져 있으면) 호감 적용(모드 opinion_shift STEP 1·3).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const log_router_1 = require("../app/log-router");
const settings_ui_1 = require("./settings-ui");
const game_link_1 = require("../app/game-link");
const protocol_1 = require("../protocol");
const chronicle_app_1 = require("./chronicle-app");
const mail_app_1 = require("./mail-app");
const debate_app_1 = require("./debate-app"); // 찬반 논평(2026-10-20 알파 10)
const music_1 = require("../music");
const warinfo_1 = require("../warinfo");
const warinfo_2 = require("../warinfo");
const music_2 = require("../music");
const gamestate_app_1 = require("./gamestate-app");
const electron_2 = require("electron");
const condemn_1 = require("../condemn");
const condemn_2 = require("../condemn");
const L = settings_ui_1.pick;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_condemn.json');
let store = null;
function all() { if (store)
    return store; try {
    store = (0, condemn_2.sanitizeCondemn)(JSON.parse(fs.readFileSync(file(), 'utf8')));
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'condemn', error: e });
    store = (0, condemn_2.sanitizeCondemn)({});
} return store; }
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'condemn', error: e });
} }
/** 이 세이브의 판정 기록(신문·대사관·대화가 재료로 쓴다). */
function warVerdicts(sid = ctx_1.ctx.curSaveId) { return all().saves[(0, music_1.safeKey)(sid)] ?? []; }
/** 특정 제국이 우리 전쟁에 냈던 입장(가장 최근). 대화 기억용. */
function stanceOfEmpire(idx, sid = ctx_1.ctx.curSaveId) {
    for (const v of warVerdicts(sid).slice().reverse()) {
        const r = v.reactions.find((x) => x.idx === idx);
        if (r)
            return { war: v.war, stance: r.stance, text: r.text };
    }
    return null;
}
const session = () => ({ sid: ctx_1.ctx.curSaveId, epoch: game_link_1.link.epoch });
const current = (s) => !!s?.sid && s.sid === ctx_1.ctx.curSaveId && s.epoch === game_link_1.link.epoch;
/** Cancel transient war work on a save switch, rewind or log reset. */
function resetCondemnSession() {
    for (const p of exports.condemn.pending.values())
        if (p.timer)
            clearTimeout(p.timer);
    exports.condemn.pending.clear();
    exports.condemn.cur = '';
    running = null;
    exports.foreign.cur = null;
    exports.foreign.session = null;
    exports.foreign.seen.clear();
    if (exports.foreign.win && !exports.foreign.win.isDestroyed())
        exports.foreign.win.close();
}
/** 전쟁마다 모은 목소리(WARVOICE)와 전쟁 정보. 판정이 끝나면 지운다. */
exports.condemn = { pending: new Map(), cur: '' };
const DELAY_MS = 2 * 60 * 60 * 1000; // 선언문을 쓰지 않아도 이 시간이 지나면 반응이 나온다(실시간 2시간 ≈ 게임에서 며칠)
function slot(war) { let p = exports.condemn.pending.get(war); if (p && !current(p.session)) {
    if (p.timer)
        clearTimeout(p.timer);
    exports.condemn.pending.delete(war);
    p = undefined;
} if (!p) {
    p = { session: session(), info: null, voices: [], collecting: '', timer: null, done: false };
    exports.condemn.pending.set(war, p);
    if (exports.condemn.pending.size > 10)
        exports.condemn.pending.delete(exports.condemn.pending.keys().next().value);
} return p; }
function condemnSetInfo(w) { const p = slot(w.war); p.info = w; exports.condemn.cur = w.war; if (!p.timer && !p.done)
    p.timer = setTimeout(() => { if (current(p.session) && exports.condemn.pending.get(w.war) === p)
        void runVerdict(w.war, ''); }, DELAY_MS); }
/** 선언문을 발표했을 때 부른다(선언문 본문을 AI 에게 보여 줌). */
function condemnAfterDeclaration(war, declText) { const p = exports.condemn.pending.get(war); if (!p || p.done || !current(p.session))
    return; if (p.timer) {
    clearTimeout(p.timer);
    p.timer = null;
} p.timer = setTimeout(() => { if (current(p.session) && exports.condemn.pending.get(war) === p)
    void runVerdict(war, declText); }, 4000); }
function fillVoice(v) {
    const c = mail_app_1.mail.countries.get(v.idx);
    let ethics = [];
    try {
        ethics = ctx_1.ctx.adoptedEthics(v.idx).names;
    }
    catch { /* 모름 */ }
    if (!ethics.length) {
        try {
            ethics = ctx_1.ctx.flagProv.ethicsFor(v.idx) ?? [];
        }
        catch { /* 모름 */ }
    }
    const past = (0, condemn_1.ourPastStanceOn)(all().ours[(0, music_1.safeKey)(ctx_1.ctx.curSaveId)], v.idx);
    return { ...v, opinion: c?.op ?? 0, ethics, flags: { ...v.flags, ...(past?.stance === 'condemn' ? { weCondemned: true } : past?.stance === 'support' ? { weSupported: true } : {}) } };
}
let running = null;
async function runVerdict(war, declText) {
    const p = exports.condemn.pending.get(war);
    if (!p || p.done || !current(p.session) || current(running) || !p.info)
        return;
    const owner = p.session;
    running = owner;
    p.done = true;
    if (p.timer) {
        clearTimeout(p.timer);
        p.timer = null;
    }
    try {
        const w = p.info, us = w.side === 'att';
        const voices = p.voices.map(fillVoice);
        if (!voices.length) {
            (0, diagnostics_1.logDiagnostic)('info', 'condemn.no_voices', { war });
            return;
        }
        const gc = (0, condemn_2.galcomStance)(voices, w, us), speakers = (0, condemn_2.pickSpeakers)(voices, w, us, 4), counts = (0, condemn_2.countStances)(voices, w, us);
        let texts = null;
        if (speakers.length || gc) {
            try {
                const raw = await ctx_1.ctx.ai.chat((0, condemn_2.reactionMessages)(ctx_1.ctx.playerName || 'the player empire', w, speakers.map((s) => { const past = (0, condemn_1.ourPastStanceOn)(all().ours[(0, music_1.safeKey)(ctx_1.ctx.curSaveId)], s.v.idx); return { name: s.v.name, stance: s.stance, ethics: s.v.ethics, ...(past ? { memory: `In ${past.date} the player's government issued a ${past.stance} statement about this empire's war "${past.war}"${past.text ? ': "' + past.text.slice(0, 140) + '"' : ''}` } : {}) }; }), gc && gc.stance !== 'silent' ? gc.stance : null, declText), { purpose: 'war-reactions', json: true, maxTokens: 1400 });
                texts = (0, condemn_2.parseReactions)(raw);
            }
            catch (e) {
                (0, diagnostics_1.logDiagnostic)('warn', 'condemn.ai_failed', { war, error: e });
            }
        }
        if (!current(owner) || exports.condemn.pending.get(war) !== p)
            return;
        const findText = (name) => texts?.items.find((x) => x.name === name || name.includes(x.name) || x.name.includes(name))?.text ?? '';
        const verdict = { war: w.war, date: w.date || ctx_1.ctx.gameDate || '', side: w.side, aggression: (0, warinfo_1.warAggression)(w), galcom: gc ? { stance: gc.stance, score: gc.score, text: texts?.galcom ?? '' } : null,
            reactions: speakers.map((s) => ({ idx: s.v.idx, name: s.v.name, stance: s.stance, score: s.score, text: findText(s.v.name) })), counts };
        const key = (0, music_1.safeKey)(owner.sid), list = (all().saves[key] ??= []);
        list.push(verdict);
        if (list.length > 30)
            list.splice(0, list.length - 30);
        save();
        // 알림·연대기
        const line = L((0, condemn_2.countsLine)(counts, true), (0, condemn_2.countsLine)(counts, false)); // 언어 팩 호환: 한/영 짝으로 고른다
        const head = gc && gc.stance !== 'silent' ? L(`은하 공동체: ${(0, exports.stanceLabel)(gc.stance)}`, `Galactic Community: ${(0, exports.stanceLabel)(gc.stance)}`) : L('은하가 반응했습니다', 'The galaxy reacts');
        ctx_1.ctx.notify({ kind: 'event', title: head + ' — ' + w.war, body: line + (verdict.reactions[0]?.text ? ` · ${verdict.reactions[0].name}: "${verdict.reactions[0].text.slice(0, 90)}"` : '') });
        (0, chronicle_app_1.chronNoteWorld)(`${verdict.date} ${w.war}: ${line}` + (gc && gc.stance !== 'silent' && verdict.galcom?.text ? ` — ${L('은하 공동체', 'Galactic Community')}: ${verdict.galcom.text}` : '') + (verdict.reactions[0]?.text ? ` — ${verdict.reactions[0].name}: ${verdict.reactions[0].text}` : ''), true); // 신문(연간 호)이 이 줄을 기사 재료로 쓴다
        if (gc && gc.stance === 'condemn' && w.side === 'att')
            void (0, debate_app_1.debateOn)('galcom_condemn', `${w.war}: ${verdict.galcom?.text || line}`, verdict.date); // 공동체 규탄에 대한 국내 찬반
        for (const r of verdict.reactions)
            (0, chronicle_app_1.chronNote)(r.idx, L(`우리의 전쟁(${w.war})에 ${(0, exports.stanceLabel)(r.stance)} 성명`, `${(0, exports.stanceLabel)(r.stance)} over our war (${w.war})`) + (r.text ? `: ${r.text}` : ''), true);
        (0, diagnostics_1.logDiagnostic)('info', 'condemn.verdict', { war, counts, galcom: gc?.stance, speakers: verdict.reactions.map((r) => `${r.name}:${r.stance}:${r.score}`) });
        // 호감 적용(켜져 있을 때): 규탄 → cold small, 지지 → warm small. 성명 낸 제국만.
        if (all().applyOpinion)
            for (const r of verdict.reactions) {
                const step = (0, condemn_2.stanceStep)(r.stance);
                if (!step || !ctx_1.ctx.actionsAllowed(r.idx))
                    continue;
                void (0, game_link_1.enqueue)(async () => { if (!current(owner))
                    return; const o = await (0, game_link_1.sendBatch)(1, (reqs) => (0, protocol_1.opinionShiftEffects)(reqs, r.idx, [step])); (0, diagnostics_1.logDiagnostic)('info', 'condemn.opinion', { idx: r.idx, stance: r.stance, outcome: o }); });
            }
    }
    finally {
        if (running === owner)
            running = null;
        if (exports.condemn.pending.get(war) === p)
            exports.condemn.pending.delete(war);
    }
}
function registerCondemn(router) {
    router.on(log_router_1.SLOT.CONDEMN, 'condemn', (m) => {
        if (m.kind === 'WARVOICE') {
            const war = exports.condemn.cur;
            if (!war)
                return;
            const p = slot(war);
            const w = p.info;
            const v = (0, condemn_2.voiceFromKv)(m.kv, !w || w.side === 'att');
            if (v) {
                const at = p.voices.findIndex((x) => x.idx === v.idx);
                if (at >= 0)
                    p.voices[at] = v;
                else
                    p.voices.push(v);
            }
        }
        else if (m.kind === 'FOREIGNWAR') {
            const f = (0, condemn_1.parseForeignWar)(m.kv, warinfo_2.parseWarInfo);
            if (f)
                onForeignWar(f);
        }
        else if (m.kind === 'WARVOICE_END') {
            const war = String(m.kv.war ?? '');
            if (war && exports.condemn.pending.has(war))
                (0, diagnostics_1.logDiagnostic)('info', 'condemn.voices', { war, n: exports.condemn.pending.get(war).voices.length });
        }
    });
    electron_1.ipcMain.handle('condemnState', async () => ({ applyOpinion: all().applyOpinion, recent: warVerdicts().slice(-5) }));
    /** 집무실 「은하 여론」: 이 세이브의 판정 기록(최근 것 먼저)과 입장 이름. */
    electron_1.ipcMain.handle('condemnList', async () => ({ sid: ctx_1.ctx.curSaveId || '', applyOpinion: all().applyOpinion, labels: { condemn: (0, exports.stanceLabel)('condemn'), concern: (0, exports.stanceLabel)('concern'), silent: (0, exports.stanceLabel)('silent'), support: (0, exports.stanceLabel)('support') }, verdicts: warVerdicts().slice().reverse(), ours: (all().ours[(0, music_1.safeKey)(ctx_1.ctx.curSaveId)] ?? []).slice().reverse(), foreignNotify: all().foreignNotify }));
    electron_1.ipcMain.handle('condemnApplyOpinion', async (_e, on) => { all().applyOpinion = !!on; save(); return all().applyOpinion; });
    electron_1.ipcMain.handle('foreignState', async () => {
        const f = current(exports.foreign.session) ? exports.foreign.cur : null;
        if (!f)
            return null;
        const adv = advisorFor(f);
        return { war: f.war, date: f.date, attacker: f.attacker, defender: f.defender, cause: L((0, warinfo_2.describeWar)(f, 'ko'), (0, warinfo_2.describeWar)(f, 'en')), advisor: adv.stance, advisorLabel: (0, exports.stanceLabel)(adv.stance), labels: { condemn: (0, exports.stanceLabel)('condemn'), concern: (0, exports.stanceLabel)('concern'), silent: (0, exports.stanceLabel)('silent'), support: (0, exports.stanceLabel)('support') }, applyOpinion: all().applyOpinion, empire: ctx_1.ctx.playerName || '' };
    });
    electron_1.ipcMain.handle('foreignIssue', async (_e, stIn, textIn) => issueOurStatement(stIn, textIn));
    electron_1.ipcMain.handle('foreignClose', async () => { if (exports.foreign.win && !exports.foreign.win.isDestroyed())
        exports.foreign.win.close(); return true; });
    electron_1.ipcMain.handle('foreignNotify', async (_e, on) => { all().foreignNotify = !!on; save(); return all().foreignNotify; });
    electron_1.ipcMain.handle('condemnNow', async (_e, warIn) => { const war = typeof warIn === 'string' && warIn ? warIn : exports.condemn.cur; if (!war || !exports.condemn.pending.has(war))
        return { ok: false, error: L('기다리는 전쟁이 없습니다.', 'No war is waiting for a verdict.') }; await runVerdict(war, ''); return { ok: true }; });
}
/** 화면 문구(선언문 창 등). */
const stanceLabel = (s) => L(condemn_2.STANCE_KO[s], condemn_2.STANCE_EN[s]);
exports.stanceLabel = stanceLabel;
// ── 남의 전쟁에 우리가 성명(방향 2, 2026-10-20) ─────────────────────────────────────────────────
exports.foreign = { cur: null, session: null, seen: new Set(), win: null };
function advisorFor(f) {
    let ethics = [];
    try {
        ethics = ctx_1.ctx.adoptedEthics(ctx_1.ctx.playerIdx).names;
    }
    catch { /* 모름 */ }
    if (!ethics.length)
        ethics = (0, music_2.creedEthics)(gamestate_app_1.gameState.last?.empireEth);
    return (0, condemn_1.advisorStance)(f, ethics, mail_app_1.mail.countries.get(f.ai)?.op ?? 0);
}
function onForeignWar(f) {
    const owner = session();
    if (!current(owner))
        return;
    const key = owner.sid + '|' + owner.epoch + '|' + f.war + '|' + f.date;
    if (exports.foreign.seen.has(key))
        return;
    exports.foreign.seen.add(key);
    if (exports.foreign.seen.size > 200)
        exports.foreign.seen.delete(exports.foreign.seen.values().next().value);
    (0, diagnostics_1.logDiagnostic)('info', 'condemn.foreign_war', { war: f.war, att: f.attacker, def: f.defender, goal: f.attGoal, notice: (0, condemn_1.foreignWorthNotice)(f) });
    (0, chronicle_app_1.chronNoteWorld)(`${f.date} ${L('전쟁 발발', 'War breaks out')}: ${f.attacker} → ${f.defender} (${f.war})`, true);
    if (!all().foreignNotify || !(0, condemn_1.foreignWorthNotice)(f))
        return; // 작은 전쟁은 조용히 연대기에만
    exports.foreign.cur = f;
    exports.foreign.session = owner;
    ctx_1.ctx.notify({ kind: 'statement', title: L(`${f.attacker}이(가) ${f.defender}을(를) 침공했습니다 — 입장을 밝히시겠습니까?`, `${f.attacker} has attacked ${f.defender} — will you issue a statement?`), body: L((0, warinfo_2.describeWar)(f, 'ko'), (0, warinfo_2.describeWar)(f, 'en')).slice(0, 160), action: L('성명 내기', 'Issue a statement') });
}
function openForeignStatement() {
    if (!exports.foreign.cur || !current(exports.foreign.session))
        return;
    if (exports.foreign.win && !exports.foreign.win.isDestroyed()) {
        exports.foreign.win.show();
        exports.foreign.win.focus();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_2.screen.getPrimaryDisplay().workArea, w = Math.min(820, Math.round(area.width * 0.7)), h = Math.min(640, Math.round(area.height * 0.8));
    exports.foreign.win = new electron_2.BrowserWindow({ width: w, height: h, x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + (area.height - h) / 2), resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.foreign.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.foreign.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'statement.html'));
    exports.foreign.win.once('ready-to-show', () => exports.foreign.win?.show());
    exports.foreign.win.on('closed', () => { exports.foreign.win = null; });
}
async function issueOurStatement(stIn, textIn) {
    const f = current(exports.foreign.session) ? exports.foreign.cur : null;
    if (!f)
        return { ok: false, error: L('기다리는 전쟁이 없습니다.', 'No war is waiting.') };
    const owner = exports.foreign.session;
    const stance = stIn === 'condemn' || stIn === 'concern' || stIn === 'support' ? stIn : 'silent';
    if (stance === 'silent') {
        exports.foreign.cur = null;
        return { ok: true };
    } // 침묵: 기록·효과 없음
    const text = typeof textIn === 'string' ? textIn.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    const rec = { war: f.war, date: f.date || ctx_1.ctx.gameDate || '', attacker: f.attacker, defender: f.defender, ai: f.ai, di: f.di, goal: f.attGoal, stance, text };
    const key = (0, music_1.safeKey)(owner.sid), list = (all().ours[key] ??= []);
    list.push(rec);
    if (list.length > 40)
        list.splice(0, list.length - 40);
    save();
    const me = ctx_1.ctx.playerName || L('우리 정부', 'our government');
    (0, chronicle_app_1.chronNoteWorld)(`${rec.date} ${me} — ${f.war}: ${(0, exports.stanceLabel)(stance)}${text ? ` — "${text}"` : ''}`, true); // 신문 재료
    void (0, debate_app_1.debateOn)(stance === 'condemn' ? 'our_condemn' : stance === 'support' ? 'our_support' : 'our_concern', `${f.war}: ${f.attacker} → ${f.defender}${text ? ' — ' + text : ''}`, rec.date); // 국내 찬반
    if (f.ai)
        (0, chronicle_app_1.chronNote)(f.ai, L(`${me}이(가) 우리의 전쟁(${f.war})을 두고 ${(0, exports.stanceLabel)(stance)} 성명을 냈다${text ? `: "${text.slice(0, 160)}"` : ''}`, `${me} issued a statement (${(0, exports.stanceLabel)(stance)}) about our war (${f.war})${text ? `: "${text.slice(0, 160)}"` : ''}`), true);
    if (f.di)
        (0, chronicle_app_1.chronNote)(f.di, L(`${me}이(가) ${f.attacker}의 침공(${f.war})을 두고 ${(0, exports.stanceLabel)(stance)} 성명을 냈다`, `${me} issued a statement (${(0, exports.stanceLabel)(stance)}) about ${f.attacker}'s attack on us (${f.war})`), true);
    if (all().applyOpinion) {
        const [sa, sd] = (0, condemn_1.ourStatementSteps)(stance);
        for (const [idx, step] of [[f.ai, sa], [f.di, sd]]) {
            if (!idx || !step || !ctx_1.ctx.actionsAllowed(idx))
                continue;
            void (0, game_link_1.enqueue)(async () => { if (!current(owner))
                return; const o = await (0, game_link_1.sendBatch)(1, (reqs) => (0, protocol_1.opinionShiftEffects)(reqs, idx, [step])); (0, diagnostics_1.logDiagnostic)('info', 'condemn.our_opinion', { idx, stance, outcome: o }); });
        }
    }
    (0, diagnostics_1.logDiagnostic)('info', 'condemn.our_statement', { war: f.war, stance, chars: text.length });
    exports.foreign.cur = null;
    return { ok: true };
}
//# sourceMappingURL=condemn-app.js.map
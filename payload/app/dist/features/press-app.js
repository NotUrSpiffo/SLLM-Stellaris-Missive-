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
exports.pressReady = exports.pressStore = exports.press = void 0;
exports.openScandalPress = openScandalPress;
exports.pressView = pressView;
exports.pushPress = pushPress;
exports.openPress = openPress;
exports.startPressPrep = startPressPrep;
exports.registerPress = registerPress;
// 언론사 인터뷰(앱 쪽, 2026-10-17) — 시행령 준비·3개월 뒤 알림·인터뷰 창·평가·행복도 버프 적용. 순수 로직은 src/press.ts.
// 흐름은 연설(speech-app.ts)과 같다: 시행령 → SLLM:PRESS phase=prep → 월 신호로 준비 완료 → 알림 → 창 → 끝나면 버프 1번.
const office_1 = require("../office");
const gestalt_app_1 = require("./gestalt-app");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const speech_1 = require("../speech");
const crypto_1 = require("crypto");
const policy_1 = require("../policy");
const press_1 = require("../press");
const namegen_app_1 = require("./namegen-app"); // 기자 이름(게임 이름 표)
const chronicle_1 = require("../chronicle");
const aiclient_1 = require("../aiclient");
const diagnostics_1 = require("../diagnostics");
const settings_1 = require("../app/settings");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const chronicle_app_1 = require("./chronicle-app");
const radio_app_1 = require("./radio-app");
const radio_1 = require("../radio");
const speech_app_1 = require("./speech-app");
const settings_ui_1 = require("./settings-ui");
const policy_app_1 = require("./policy-app");
const chronicle_app_2 = require("./chronicle-app");
const mail_app_1 = require("./mail-app");
const terminal_1 = require("./terminal");
const edict_store_1 = require("./edict-store");
const edict_1 = require("../edict");
/** 알림 문구: 숫자·날짜가 들어간 문장은 번역 사전으로 못 바꾸므로 여기서 고른다(고정 문구는 i18n-catalog). */
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-18)
exports.press = {
    /** 세이브 번호를 모를 때 들어온 준비 시작(번호를 알면 시작한다) */
    prepPending: null,
    busy: false,
    win: null,
    /** 진행 중인 인터뷰(앱을 끄면 사라지고, 준비 완료 상태는 그대로 남는다) */
    sess: null,
    /** 칙령 적용 중 반대 가치관 제국 번호(EDICTX, 요청 번호별) */
    edictFoes: new Map(),
    ackWaiter: null,
    late: null,
    readyNotified: '',
    /** 방금 끝난 인터뷰 결과(창에 결과를 보여 주려고 남겨 둔다) */
    last: null,
    /** 긴급 기자회견(2026-10-20): 준비 기간 없이 열리고 한 주제만. kind = scandal(추문, scandal-app) 또는 hearing(첩보 의혹 청문회의 국내 기자회견, espionage-app). 끝나면 done(호평?) */
    scandal: null,
};
const scandalNow = () => (exports.press.scandal && exports.press.scandal.sid === ctx_1.ctx.curSaveId ? exports.press.scandal : null);
/** 추문 기자회견 열기. 다른 인터뷰가 진행 중이면 오류 문구. */
function openScandalPress(s) {
    if (exports.press.sess && exports.press.sess.sid === ctx_1.ctx.curSaveId && !exports.press.sess.scandal)
        return L('다른 언론사 인터뷰가 진행 중입니다. 먼저 끝내 주세요.', 'Another press interview is in progress. Finish it first.');
    exports.press.scandal = s;
    exports.press.last = null;
    openPress();
    pushPress();
    return '';
}
let storeInst = null;
/** 준비 상태 저장소: 연설과 같은 규칙(세이브마다 하나, 3개월 뒤 ready, 되감기면 취소)이라 같은 클래스를 다른 파일로 쓴다. */
const pressStore = () => (storeInst ??= new speech_1.SpeechStore(path.join(electron_1.app.getPath('userData'), 'sllm_press.json')));
exports.pressStore = pressStore;
const pressReady = () => !!ctx_1.ctx.curSaveId && (0, exports.pressStore)().get(ctx_1.ctx.curSaveId).phase === 'ready';
exports.pressReady = pressReady;
const ACK_MS = 15000;
function situation() {
    const EN = (_ko, en) => en; // 프롬프트는 영어(2026-10-19), 답 언어는 AI 언어 설정을 따른다
    const pf = ctx_1.ctx.speechWithEthics(speech_app_1.speech.pfLast), cp = (0, speech_1.crowdProfile)(pf, speech_app_1.speech.crowdCtx, EN);
    return [`Public outlook: ${cp.summary}`, ...(0, speech_1.ctxLines)(speech_app_1.speech.crowdCtx, EN)].slice(0, 12);
}
/** 이 세이브의 연대기(현재 시간선) — 제국별 기록 + 성간라디오 전용 연대기 + 세계 소식 */
function material() {
    if (!ctx_1.ctx.curSaveId)
        return [];
    try {
        const groups = (0, chronicle_app_1.chron)().groups(ctx_1.ctx.curSaveId, (all) => ctx_1.ctx.govMem().split(ctx_1.ctx.curSaveId, all).own);
        const all = groups.flatMap((g) => g.items.map((e) => ({ date: e.date, who: g.idx === chronicle_1.RADIO_IDX ? '' : g.name, text: e.text })));
        // 라디오 연대기는 제국별 기록을 '○○ 관련: …'으로 옮겨 둔 사본을 가진다(알파 6). 같은 날 같은 사실은 한 줄만 자료로 넣는다(제국 이름이 붙은 원본 우선, 2026-10-18).
        // 키는 날짜|제국|문장: 라디오 사본 '○○ 관련: x'는 ○○ 제국의 x 와 같은 줄로 보고, 다른 제국의 같은 문장은 따로 둔다.
        const key = (l) => { const t = l.text.replace(/\s+/g, ' ').trim(), m = l.who ? null : (0, radio_1.splitAbout)(t); return l.date + '|' + (m ? m[0] + '|' + m[1] : l.who + '|' + t); }; // '○○ 관련: x' / 'About ○○: x' 둘 다
        const seen = new Set();
        const lines = [...all.filter((l) => l.who), ...all.filter((l) => !l.who)].filter((l) => { const k = key(l); if (seen.has(k))
            return false; seen.add(k); return true; });
        return (0, press_1.pressMaterial)(lines, 40);
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'press.material.failed', { error: String(e) });
        return [];
    }
}
function outletName() {
    const names = (settings_1.settings.mediaPrefs || []).map((m) => m.paperName).filter((n) => typeof n === 'string' && n.trim());
    return names.length ? names[Math.floor(Math.random() * names.length)] : L('은하 언론', 'Galactic Press');
}
function pressView() {
    const st = ctx_1.ctx.curSaveId ? (0, exports.pressStore)().get(ctx_1.ctx.curSaveId) : { phase: 'none', start: '', due: '' };
    const cur = exports.press.sess && exports.press.sess.sid === ctx_1.ctx.curSaveId ? exports.press.sess.sess : null;
    const sc = scandalNow();
    return {
        scandal: sc ? { suspect: sc.suspect, date: sc.date, kind: sc.kind ?? 'scandal', bribed: !!sc.bribed, bribeCost: press_1.PRESS_BRIBE_COST } : null,
        phase: st.phase, start: st.start, due: st.due, date: ctx_1.ctx.gameDate, running: ctx_1.ctx.gameRunning, busy: exports.press.busy,
        empire: ctx_1.ctx.playerName, leader: (0, speech_app_1.leaderPortrait)(speech_app_1.speech.pfLast), step: press_1.PRESS_STEP_PCT, days: press_1.PRESS_DAYS, maxTopics: press_1.PRESS_TOPICS,
        last: exports.press.last && exports.press.last.sid === ctx_1.ctx.curSaveId ? { outlet: exports.press.last.outlet, topics: exports.press.last.topics, good: exports.press.last.good, percent: exports.press.last.percent, date: exports.press.last.date, edict: exports.press.last.edict ?? '', scandal: exports.press.last.scandal ?? '' } : null,
        edictNow: (() => { const a = (0, edict_store_1.activeEdict)(ctx_1.ctx.curSaveId, ctx_1.ctx.gameDate); return a ? { title: a.title, end: a.end } : null; })(),
        sess: cur ? { scandal: exports.press.sess && exports.press.sess.scandal ? exports.press.sess.kind ?? 'scandal' : '', outlet: cur.outlet, reporter: cur.reporter, topics: cur.topics, current: cur.current, log: cur.log.slice(-300), done: cur.done, good: (0, press_1.pressGood)(cur), percent: (0, press_1.pressPercent)(cur), gov: govView() } : null,
    };
}
/** 확인 카드(언어 팩: pick). 효과 줄은 앱이 정한 묶음에서 만든다. */
function edictCard(p) {
    let pl;
    try {
        pl = (0, edict_1.edictPlan)(p, (0, policy_app_1.policyModsInUse)());
    }
    catch {
        return null;
    }
    const lines = [];
    for (const l of pl.pros)
        lines.push(l.dropped ? { t: L(`${l.ko} ${(0, edict_1.fmtValue)(l)} — ${l.dropped === 'policy' ? '집무실 정책과 겹쳐 빠짐' : '기자 반응이 나빠 빠짐'}`, `${l.en} ${(0, edict_1.fmtValue)(l)} — ${l.dropped === 'policy' ? 'dropped (same effect as an office policy)' : 'dropped (poor press reception)'}`), c: 'drop' } : { t: `${L(l.ko, l.en)} ${(0, edict_1.fmtValue)(l)}`, c: 'pro' });
    lines.push({ t: `${L(pl.con.ko, pl.con.en)} ${(0, edict_1.fmtValue)(pl.con)}`, c: 'con' });
    if (pl.def.foe)
        lines.push({ t: L(`${edict_1.ETHICS[pl.def.foe].ko} 제국들의 우리 관계 ${pl.opinionValue}`, `${edict_1.ETHICS[pl.def.foe].en} empires' opinion of us ${pl.opinionValue}`), c: 'foe' });
    const prev = (0, edict_store_1.activeEdict)(ctx_1.ctx.curSaveId, ctx_1.ctx.gameDate);
    return { title: p.title, name: L(pl.def.ko, pl.def.en), strength: L(edict_1.STRENGTH_KO[p.strength], edict_1.STRENGTH_EN[p.strength]), positive: p.positive, lines, years: edict_1.EDICT_YEARS, defYears: 2, replaces: prev ? prev.title : '' };
}
function govView() {
    const c = exports.press.sess && exports.press.sess.sid === ctx_1.ctx.curSaveId ? exports.press.sess : null;
    if (!c)
        return null;
    const g = c.gov;
    return { state: g.state, policy: g.policy ? g.policy.title : '', applied: g.applied ?? '', card: g.pick && g.state === 'pending' ? edictCard(g.pick) : null };
}
function pushPress() { if (exports.press.win && !exports.press.win.isDestroyed())
    exports.press.win.webContents.send('pressState', pressView()); }
function openPress(glass = false) {
    if ((0, gestalt_app_1.isGestalt)() && !(exports.press.win && !exports.press.win.isDestroyed())) {
        ctx_1.ctx.notify({ kind: 'info', title: L('언론사 인터뷰 없음', 'No press interviews'), body: L('단일 의식(기계 지성·군체) 제국에는 자유 언론이 없어 인터뷰를 열 수 없습니다.', 'A gestalt empire (machine intelligence or hive mind) has no free press, so interviews are unavailable.') });
        return;
    } // 2026-10-19 사용자 결정
    if (exports.press.win && !exports.press.win.isDestroyed()) {
        exports.press.win.show();
        exports.press.win.focus();
        pushPress();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.round(area.width), height: Math.round(area.height) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.press.win = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 900, minHeight: 600, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', ...(0, office_1.glassWin)(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.press.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.press.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'press.html'));
    exports.press.win.once('ready-to-show', () => { exports.press.win?.show(); pushPress(); });
    exports.press.win.on('closed', () => { exports.press.win = null; });
}
/** 시행령을 켰다는 로그. 세이브 번호를 아직 모르면 번호를 알 때까지 기다린다. */
function startPressPrep(date) {
    if (!ctx_1.ctx.curSaveId) {
        exports.press.prepPending = { date };
        return;
    }
    if ((0, exports.pressStore)().start(ctx_1.ctx.curSaveId, date, null)) {
        const due = (0, exports.pressStore)().get(ctx_1.ctx.curSaveId).due;
        ctx_1.ctx.notify({ kind: 'info', title: L('언론사 인터뷰 준비 시작', 'Press interview preparation started'), body: L(`인터뷰 준비를 시작했습니다. 게임 날짜로 3개월 뒤(${due})에 알려 드립니다.`, `Interview preparation has started. You will be notified in 3 months (game date ${due}).`) });
        pushPress();
    }
}
function onMonth(date) {
    if (exports.press.prepPending && ctx_1.ctx.curSaveId) {
        const q = exports.press.prepPending;
        exports.press.prepPending = null;
        startPressPrep(q.date);
    }
    const sid = ctx_1.ctx.curSaveId;
    if (!sid || !date)
        return;
    const justReady = (0, exports.pressStore)().tick(sid, date);
    // 이미 준비가 끝난 채로 불러온 세이브도 앱을 켠 뒤 첫 월 신호에 한 번 알린다(연설과 같음).
    if (justReady || ((0, exports.pressStore)().get(sid).phase === 'ready' && exports.press.readyNotified !== sid)) {
        exports.press.readyNotified = sid;
        ctx_1.ctx.notify({ kind: 'press', title: L('언론사 인터뷰 준비 완료', 'Press interview ready'), body: L('기자들이 인터뷰를 기다리고 있습니다. 인터뷰를 시작하시겠습니까?', 'The reporters are waiting. Start the interview?'), action: L('인터뷰하기', 'Start interview') });
        pushPress();
    }
}
function onApplied(sid, key, n) {
    if (sid !== ctx_1.ctx.curSaveId)
        return;
    if (exports.press.ackWaiter) {
        exports.press.ackWaiter(sid, key, n);
        return;
    }
    if (exports.press.late && (0, press_1.pressAppliedMatches)(exports.press.late, sid, key, n)) {
        const f = exports.press.late.finish;
        exports.press.late = null;
        f();
    }
}
/** 인터뷰를 끝내고 기록을 남긴다(버프가 확인됐거나 호평 0 이라 보낼 것이 없을 때). */
function finishPress(cur, date, n) {
    const s = cur.sess, good = (0, press_1.pressGood)(s), pct = (0, press_1.pressPercent)(s);
    if (exports.press.sess === cur)
        exports.press.sess = null;
    (0, exports.pressStore)().finish(cur.sid);
    exports.press.last = { sid: cur.sid, outlet: s.outlet, topics: s.topics, good, percent: pct, date, edict: cur.gov.applied ?? '' };
    // 기록은 남기는 순간의 인터페이스 언어로(2026-10-19)
    const topics = s.topics.map((t) => `${t.title}(${t.status === 'good' ? L('호평', 'well received') : t.status === 'bad' ? L('미지근', 'lukewarm') : L('다루지 않음', 'not covered')})`).join(', ');
    const text = L(`언론사 인터뷰(${s.outlet}): ${topics} — 국민 행복도 +${pct}%${cur.gov.applied ? ` · 칙령 「${cur.gov.applied}」 발표` : ''}`, `Press interview (${s.outlet}): ${topics} — public happiness +${pct}%${cur.gov.applied ? ` · edict "${cur.gov.applied}" announced` : ''}`);
    (0, chronicle_app_1.chronPut)(chronicle_1.RADIO_IDX, date, text, false, { name: '성간라디오 전용 연대기', world: true, uid: `press|${date}|${n}` });
    if (radio_app_1.radio.on)
        radio_app_1.radio.q.push({ kind: 'press', date, text: L(`${ctx_1.ctx.playerName || '플레이어 제국'}의 지도자가 ${s.outlet}과 인터뷰했다(호평 ${good}/${press_1.PRESS_TOPICS})${cur.gov.applied ? `. 이 자리에서 「${cur.gov.applied}」 칙령을 발표했다` : ''}`, `The leader of ${ctx_1.ctx.playerName || 'the player empire'} gave an interview to ${s.outlet} (well received ${good}/${press_1.PRESS_TOPICS})${cur.gov.applied ? `, announcing the edict "${cur.gov.applied}"` : ''}`), n, id: `press|${date}|${n}` });
    pushPress();
}
const guard = (event) => !!exports.press.win && event.sender === exports.press.win.webContents;
const current = () => (exports.press.sess && exports.press.sess.sid === ctx_1.ctx.curSaveId ? exports.press.sess : null);
const govLog = (s) => s.log.filter((l) => l.topic === (0, press_1.pressGovIndex)(s) && l.who !== 'desk').map((l) => ({ who: l.who, text: l.text }));
async function judge(cur) {
    const s = cur.sess, t = s.topics[s.current];
    if (!t || t.turns === 0)
        return (0, press_1.pressCloseTopic)(s);
    if (t.gov)
        return judgeGov(cur);
    let v = null;
    for (let i = 0; i < 2 && !v; i++) {
        try {
            v = (0, press_1.parsePressVerdict)(await ctx_1.ctx.ai.chat((() => { const m = (0, press_1.pressVerdictMessages)(ctx_1.ctx.playerName, s, situation()); if (cur.bribed)
                m.splice(1, 0, { role: 'system', content: press_1.BRIBED_DESK }); return m; })(), { purpose: 'press-verdict', json: true, maxTokens: 900 * (i + 1) }));
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'press-verdict', attempt: i + 1, error: String(e) });
        }
    }
    if (!v)
        throw new Error(L('편집국 평가를 읽지 못했습니다. 다시 눌러 주세요(주제는 그대로 남아 있습니다).', 'Could not read the editors\' verdict. Press again (the topic is kept).'));
    return (0, press_1.pressCloseTopic)(s, v);
}
/** 「정부 발표」 칸을 닫는다: 평가 + 칙령 분류(한 번에). 집무실 정책 발표면 그 정책에 반영, 칙령이면 확인 카드 대기. */
async function judgeGov(cur) {
    const s = cur.sess;
    let v = null;
    for (let i = 0; i < 2 && !v; i++) {
        try {
            v = (0, edict_1.parseGovVerdict)(await ctx_1.ctx.ai.chat((0, edict_1.govVerdictMessages)(ctx_1.ctx.playerName, s.outlet, govLog(s), situation(), cur.gov.policy?.title ?? ''), { purpose: 'press-gov-verdict', json: true, maxTokens: 900 * (i + 1) }), !!cur.gov.policy);
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'press-gov-verdict', attempt: i + 1, error: String(e) });
        }
    }
    if (!v)
        throw new Error(L('편집국 평가를 읽지 못했습니다. 다시 눌러 주세요(발표는 그대로 남아 있습니다).', 'Could not read the editorial verdict. Try again (your announcement is kept).'));
    if (v.edict === 'policy' && cur.gov.policy) {
        (0, policy_app_1.policyAnnounced)(cur.gov.policy.id, v.positive);
        cur.gov.state = 'none';
    }
    else if (v.edict && v.edict !== 'policy') {
        cur.gov.pick = { id: v.edict, title: v.title, strength: v.strength, positive: v.positive };
        cur.gov.state = 'pending';
    }
    return (0, press_1.pressCloseTopic)(s, { positive: v.positive, reason: v.reason });
}
/** 칙령 확정: 게임에 적용 → 기록·연대기 → 반대 가치관 제국 1~2곳 항의 서신. */
async function applyEdict(cur, years) {
    const p = cur.gov.pick;
    if (!p)
        return { ok: true };
    const pl = (0, edict_1.edictPlan)(p, (0, policy_app_1.policyModsInUse)()), add = (0, edict_1.planAdds)(pl), st = (0, edict_store_1.edictStore)().get(cur.sid), prev = (0, edict_store_1.activeEdict)(cur.sid, ctx_1.ctx.gameDate);
    const cid = (0, crypto_1.randomUUID)().replace(/-/g, ''), req = ++game_link_1.link.reqCounter, days = years * 360, date = ctx_1.ctx.gameDate;
    exports.press.edictFoes.set(req, []);
    let r;
    try {
        r = await (0, terminal_1.terminalRequest)((0, edict_1.edictCommand)(req, cur.sid, cid, add, prev ? prev.mods : [], days, pl.opinion, pl.def.foe), 'EDICTAPPLY', req);
    }
    catch (e) {
        exports.press.edictFoes.delete(req);
        return { ok: false, error: e.message };
    }
    const foes = exports.press.edictFoes.get(req) ?? [];
    exports.press.edictFoes.delete(req);
    if (r.kv.sid !== cur.sid || (r.kv.status !== 'applied' && r.kv.status !== 'duplicate'))
        return { ok: false, error: L('게임이 칙령 적용을 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm the edict. Check that the mod is up to date.') };
    const end = (0, policy_1.addDays)(date, days);
    if (prev)
        st.history.push(prev);
    st.history.splice(0, Math.max(0, st.history.length - 30));
    st.active = { cid, id: p.id, title: p.title, strength: p.strength, positive: p.positive, years, date, end, mods: add, outlet: cur.sess.outlet, foes: foes.length };
    (0, edict_store_1.edictStore)().save();
    cur.gov.state = 'applied';
    cur.gov.applied = p.title;
    if (ctx_1.ctx.playerIdx > 0)
        (0, chronicle_app_2.chronNote)(ctx_1.ctx.playerIdx, (0, edict_1.edictChronLine)(date, cur.sess.outlet, p.title, pl.def, p.strength, years, p.positive));
    const pickFoes = [...new Set(foes)].sort(() => Math.random() - 0.5).slice(0, edict_1.PROTEST_LETTERS);
    for (const idx of pickFoes)
        void (0, mail_app_1.writeLetter)(idx, (0, edict_1.protestWhy)(p.title, pl.def, p.strength)).catch(() => { });
    (0, diagnostics_1.logDiagnostic)('info', 'press.edict', { id: p.id, strength: p.strength, positive: p.positive, years, foes: foes.length });
    return { ok: true };
}
function registerPress(router) {
    router.on(log_router_1.SLOT.PRESS, 'press:phase', (m) => {
        if (m.kind === 'PRESS') {
            if (m.kv.phase === 'prep')
                startPressPrep(ctx_1.ctx.gameDate);
            else if (m.kv.phase === 'applied')
                onApplied(m.kv.sid ?? '', m.kv.key ?? '', m.kv.n === undefined ? NaN : Number(m.kv.n));
        }
        else if (m.kind === 'MONTH' && m.kv.date)
            onMonth(m.kv.date);
        else if (m.kind === 'EDICTX') {
            const l = exports.press.edictFoes.get(Number(m.kv.req)), i = Number(m.kv.idx);
            if (l && Number.isSafeInteger(i) && i > 0)
                l.push(i);
        }
        else if (m.kind === 'EDICTAPPLY')
            terminal_1.terminalReplies.get('EDICTAPPLY:' + m.kv.req)?.(m);
        else if (m.kind === 'PRESSBRIBE')
            terminal_1.terminalReplies.get('PRESSBRIBE:' + m.kv.req)?.(m); // 기자 매수 확인(2026-10-20)
    });
    electron_1.ipcMain.handle('pressState', async () => pressView());
    /** 긴급 기자회견 전에 기자 매수(에너지 크레딧 1000, 2026-10-20). 게임이 차감을 확인해야 매수된다. */
    electron_1.ipcMain.handle('pressBribe', async (event) => {
        if (!guard(event))
            return { ok: false, error: L('인터뷰 창에서만 할 수 있습니다.', 'Only from the interview window.') };
        const sc = scandalNow();
        if (!sc || current())
            return { ok: false, error: L('기자회견을 시작하기 전에만 매수할 수 있습니다.', 'You can only bribe before the press conference starts.') };
        if (sc.bribed)
            return { ok: true };
        if (!ctx_1.ctx.gameRunning || !ctx_1.ctx.curSaveId)
            return { ok: false, error: L('게임이 켜져 있어야 크레딧을 쓸 수 있습니다.', 'The game must be running to spend credits.') };
        if (exports.press.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        exports.press.busy = true;
        pushPress();
        try {
            const req = ++game_link_1.link.reqCounter, m = await (0, terminal_1.terminalRequest)((0, press_1.pressBribeCommand)(req, ctx_1.ctx.curSaveId), 'PRESSBRIBE', req);
            if (m.kv.status === 'short')
                return { ok: false, error: L(`에너지 크레딧이 모자랍니다(${press_1.PRESS_BRIBE_COST} 필요).`, `Not enough energy credits (${press_1.PRESS_BRIBE_COST} needed).`) };
            if (m.kv.status !== 'applied' || m.kv.sid !== ctx_1.ctx.curSaveId)
                return { ok: false, error: L('게임이 크레딧 차감을 확인해 주지 않았습니다.', 'The game did not confirm the payment.') };
            if (exports.press.scandal === sc)
                sc.bribed = true;
            (0, diagnostics_1.logDiagnostic)('info', 'press.bribe', { kind: sc.kind ?? 'scandal' });
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            exports.press.busy = false;
            pushPress();
        }
    });
    electron_1.ipcMain.handle('pressClose', async (event) => { if (!guard(event))
        return false; exports.press.win?.close(); return true; });
    /** 인터뷰 시작: 기자가 연대기에서 주제 3개를 골라 온다. */
    electron_1.ipcMain.handle('pressBegin', async (event) => {
        if (!guard(event))
            return { ok: false, error: L('인터뷰 창에서만 시작할 수 있습니다.', 'Can only be started from the interview window.') };
        if (exports.press.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        if (current())
            return { ok: false, error: L('이미 인터뷰가 진행 중입니다.', 'An interview is already in progress.') };
        const sc = scandalNow();
        if (sc) { // 추문 긴급 기자회견: 준비 기간·AI 주제 고르기 없이 추문 한 주제
            const outlet = outletName(), reporter = (0, namegen_app_1.gameName)(Math.random() < 0.5 ? 'm' : 'f') ?? '';
            exports.press.sess = { sid: sc.sid, scandal: true, kind: sc.kind ?? 'scandal', bribed: !!sc.bribed, gov: { policy: null, pick: null, state: 'none' }, sess: (0, press_1.newScandalSess)(outlet, reporter, sc.topic ?? {
                    title: L('정부 추문 의혹', 'The government scandal'),
                    question: L(`정부 관리들이 외국 정부를 모욕·기만했다는 문서가 돌고 있습니다. 정부는 위조라고 하지만, ${sc.suspect}의 첩보망이 퍼뜨렸다는 증거가 있습니까? 국민에게 어떻게 해명하시겠습니까?`, `Documents claim our officials insulted and deceived foreign governments. The government calls them forgeries — is there proof that ${sc.suspect}'s spy network planted them? How will you explain this to the public?`),
                    source: L(`${sc.date} 추문 보도`, `${sc.date} scandal report`)
                }) };
            exports.press.last = null;
            pushPress();
            return { ok: true };
        }
        if (!(0, exports.pressReady)() || !ctx_1.ctx.curSaveId)
            return { ok: false, error: L('아직 인터뷰 준비가 끝나지 않았습니다.', 'The interview is not ready yet.') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 인터뷰할 수 있습니다.', 'The game must be running to give an interview.') };
        exports.press.busy = true;
        pushPress();
        const sid = ctx_1.ctx.curSaveId;
        try {
            const outlet = outletName(), reporter = (0, namegen_app_1.gameName)(Math.random() < 0.5 ? 'm' : 'f') ?? '';
            let got = null; // 기자 이름: 게임 이름 표(우리 제국 종족 비율)
            for (let i = 0; i < 2 && !got; i++) {
                try {
                    got = (0, press_1.parsePressTopics)(await ctx_1.ctx.ai.chat((0, press_1.pressTopicMessages)(ctx_1.ctx.playerName, outlet, material(), situation(), reporter), { purpose: 'press-topics', json: true, maxTokens: 1400 * (i + 1) }));
                }
                catch (e) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'press-topics', attempt: i + 1, error: String(e) });
                }
            }
            if (!got)
                return { ok: false, error: L('기자가 주제를 준비하지 못했습니다. 다시 시도해 주세요.', 'The reporter could not prepare topics. Please try again.') };
            if (sid !== ctx_1.ctx.curSaveId || !(0, exports.pressReady)())
                return { ok: false, error: L('세이브 또는 인터뷰 상태가 바뀌었습니다.', 'The save or interview state changed.') };
            // 「정부 발표」 칸(2026-10-18): 기자 주제 3개 옆에 하나 더, 인터뷰 한 번에 하나. 아직 발표하지 않은 집무실 정책이 있으면 질문에 넣는다.
            const pp = (0, policy_app_1.policyForPress)();
            const gov = { title: L('정부 발표', 'Government announcement'), source: pp ? L(`집무실 정책 「${pp.title}」`, `Office policy "${pp.title}"`) : L('정부가 직접 발표', 'Announced by the government'),
                question: pp ? L(`정부 발표가 있다고 들었습니다. 집무실에서 선포하신 「${pp.title}」 정책을 설명하시겠습니까, 아니면 다른 발표가 있습니까?`, `We hear the government has an announcement. Will you explain the "${pp.title}" policy you declared, or is there something else?`)
                    : L('오늘 정부 발표가 있다고 들었습니다. 무엇을 발표하시겠습니까?', 'We hear the government has an announcement today. What would you like to announce?') };
            exports.press.sess = { sid, sess: (0, press_1.newPressSess)(outlet, reporter || got.reporter, got.topics, gov), gov: { policy: pp ? { id: pp.id, title: pp.title } : null, pick: null, state: 'none' } };
            exports.press.last = null;
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            exports.press.busy = false;
            pushPress();
        }
    });
    electron_1.ipcMain.handle('pressPick', async (event, i) => {
        if (!guard(event))
            return { ok: false, error: L('인터뷰 창에서만 고를 수 있습니다.', 'Can only be chosen from the interview window.') };
        const cur = current();
        if (!cur)
            return { ok: false, error: L('진행 중인 인터뷰가 없습니다.', 'No interview is in progress.') };
        if (exports.press.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        try {
            cur.sess = (0, press_1.pressPick)(cur.sess, Number(i));
            pushPress();
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('pressSay', async (event, text) => {
        if (!guard(event))
            return { ok: false, error: L('인터뷰 창에서만 답할 수 있습니다.', 'Can only be answered from the interview window.') };
        if (typeof text !== 'string')
            return { ok: false, error: L('답변을 확인해 주세요.', 'Please check your answer.') };
        const bad = (0, press_1.checkPressText)(text);
        if (bad)
            return { ok: false, error: bad };
        if (exports.press.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        const cur = current();
        if (!cur || cur.sess.done)
            return { ok: false, error: L('진행 중인 인터뷰가 없습니다.', 'No interview is in progress.') };
        if (cur.sess.current < 0)
            return { ok: false, error: L('먼저 이야기할 주제를 고르세요.', 'Choose a topic to talk about first.') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 인터뷰할 수 있습니다.', 'The game must be running to give an interview.') };
        exports.press.busy = true;
        pushPress();
        try {
            const s = cur.sess, clean = text.replace(/\s+/g, ' ').trim();
            const gt = s.topics[s.current]?.gov;
            const reply = (await ctx_1.ctx.ai.chat(gt ? (0, edict_1.govReplyMessages)(ctx_1.ctx.playerName, s.outlet, s.reporter, govLog(s), clean, situation(), cur.gov.policy?.title ?? '') : (() => { const m = (0, press_1.pressReplyMessages)(ctx_1.ctx.playerName, s, clean, situation()); if (cur.bribed)
                m.splice(1, 0, { role: 'system', content: press_1.BRIBED_REPORTER }); return m; })(), { purpose: gt ? 'press-gov-reply' : 'press-reply', maxTokens: 1200, conversationId: (0, aiclient_1.conversationOf)(s) })).trim();
            if (!reply)
                return { ok: false, error: L('기자의 반응을 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read the reporter\'s reaction. Please try again.') };
            if (exports.press.sess !== cur || cur.sess !== s)
                return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') };
            cur.sess = (0, press_1.pressAnswer)(s, clean, reply);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            exports.press.busy = false;
            pushPress();
        }
    });
    /** 다음 주제로: 지금 주제를 평가하고 닫는다(긍정이면 +3%). */
    electron_1.ipcMain.handle('pressNext', async (event) => {
        if (!guard(event))
            return { ok: false, error: L('인터뷰 창에서만 넘길 수 있습니다.', 'Can only move on from the interview window.') };
        if (exports.press.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        const cur = current();
        if (!cur || cur.sess.done || cur.sess.current < 0)
            return { ok: false, error: L('진행 중인 주제가 없습니다.', 'No topic is in progress.') };
        exports.press.busy = true;
        pushPress();
        try {
            const s = cur.sess, n = await judge(cur);
            if (exports.press.sess !== cur || cur.sess !== s)
                return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') };
            cur.sess = n;
            return { ok: true, allClosed: (0, press_1.pressAllClosed)(n) };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            exports.press.busy = false;
            pushPress();
        }
    });
    /** 인터뷰 종료: 진행 중 주제를 평가하고, 호평 수를 합산해 행복도 버프(1년)를 건다. */
    electron_1.ipcMain.handle('pressEnd', async (event, decision) => {
        if (!guard(event))
            return { ok: false, error: L('인터뷰 창에서만 끝낼 수 있습니다.', 'Can only be ended from the interview window.') };
        if (exports.press.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        const cur = current();
        if (!cur)
            return { ok: false, error: L('진행 중인 인터뷰가 없습니다.', 'No interview is in progress.') };
        if (cur.scandal) { // 추문 기자회견: 평가만 하고 민심으로(게임 버프·칙령·준비 소모 없음)
            exports.press.busy = true;
            pushPress();
            try {
                if (!cur.sess.done) {
                    if (cur.sess.current >= 0) {
                        const s = cur.sess, n = await judge(cur);
                        if (exports.press.sess !== cur || cur.sess !== s)
                            return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') };
                        cur.sess = n;
                    }
                    cur.sess = (0, press_1.pressFinish)(cur.sess);
                }
                const good = cur.sess.topics.some((t) => t.status === 'good'), sc = exports.press.scandal;
                exports.press.last = { sid: cur.sid, outlet: cur.sess.outlet, topics: cur.sess.topics, good: good ? 1 : 0, percent: 0, date: ctx_1.ctx.gameDate, scandal: cur.kind ?? 'scandal' };
                exports.press.sess = null;
                exports.press.scandal = null;
                if (sc)
                    sc.done(good);
                return { ok: true, good: good ? 1 : 0, percent: 0, scandal: true };
            }
            catch (e) {
                return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
            }
            finally {
                exports.press.busy = false;
                pushPress();
            }
        }
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 결과를 적용할 수 있습니다.', 'The game must be running to apply the results.') };
        exports.press.busy = true;
        pushPress();
        try {
            if (!cur.sess.done) {
                if (cur.sess.current >= 0) {
                    const s = cur.sess, n = await judge(cur);
                    if (exports.press.sess !== cur || cur.sess !== s)
                        return { ok: false, error: L('인터뷰가 바뀌었습니다.', 'The interview changed.') };
                    cur.sess = n;
                }
                cur.sess = (0, press_1.pressFinish)(cur.sess);
                pushPress();
            }
            // 칙령 확인 카드(2026-10-18): 플레이어가 확정해야 게임에 들어간다.
            if (cur.gov.state === 'pending' && cur.gov.pick) {
                const want = decision?.edict;
                if (want !== 'apply' && want !== 'skip')
                    return { ok: false, confirm: true };
                if (want === 'skip')
                    cur.gov.state = 'skipped';
                else {
                    const y = decision?.years === undefined ? 2 : Number(decision.years);
                    if (!(0, edict_1.isEdictYears)(y))
                        return { ok: false, error: L('칙령 기간은 1~3년 중에서 골라 주세요.', 'Pick an edict length of 1 to 3 years.') };
                    const r = await applyEdict(cur, y);
                    if (!r.ok)
                        return { ok: false, error: r.error };
                }
                pushPress();
            }
            const good = (0, press_1.pressGood)(cur.sess), date = ctx_1.ctx.gameDate, n = ++game_link_1.link.reqCounter;
            if (good > 0) {
                const key = (0, press_1.pressModifierKey)(good), cmd = (0, press_1.pressApplyEffect)(good, n), expected = { sid: cur.sid, n, key };
                exports.press.late = null;
                let acked = false, to = null, settle = () => { };
                const ack = new Promise((resolve) => { settle = resolve; });
                exports.press.ackWaiter = (sid, k, num) => { if (exports.press.sess !== cur || ctx_1.ctx.curSaveId !== cur.sid || !(0, press_1.pressAppliedMatches)(expected, sid, k, num))
                    return; acked = true; if (to)
                    clearTimeout(to); exports.press.ackWaiter = null; settle(true); };
                try {
                    await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)(cmd));
                }
                catch (e) {
                    exports.press.ackWaiter = null;
                    return { ok: false, error: L('게임에 명령을 보내지 못했습니다: ', 'Could not send the command to the game: ') + e.message };
                }
                if (!acked)
                    to = setTimeout(() => { if (exports.press.ackWaiter)
                        exports.press.ackWaiter = null; settle(false); }, ACK_MS);
                if (!(await ack)) {
                    // 늦게라도 PRESS phase=applied 가 오면 그때 마무리한다(자동 재전송은 하지 않는다).
                    exports.press.late = { ...expected, finish: () => { if (exports.press.sess !== cur || ctx_1.ctx.curSaveId !== cur.sid)
                            return; finishPress(cur, date, n); ctx_1.ctx.notify({ kind: 'press', title: L('언론사 인터뷰 마무리', 'Press interview concluded'), body: L(`게임이 늦게 버프 적용을 확인했습니다: 행복도 +${(0, press_1.pressPercent)(cur.sess)}%`, `The game confirmed the effect late: Happiness +${(0, press_1.pressPercent)(cur.sess)}%`) }); } };
                    return { ok: false, error: L('게임이 아직 버프 적용을 확인해 주지 않았습니다. 늦게라도 확인되면 자동으로 마무리됩니다. 게임이 켜져 있는지, 모드가 최신인지 확인해 주세요.', 'The game has not confirmed the buffs yet. It will finish automatically if confirmed later. Check that the game is running and the mod is up to date.') };
                }
            }
            if (ctx_1.ctx.curSaveId !== cur.sid || exports.press.sess !== cur)
                return { ok: false, error: L('세이브 또는 인터뷰가 바뀌어 결과를 확정하지 않았습니다.', 'The save or interview changed, so the results were not finalized.') };
            const pct = (0, press_1.pressPercent)(cur.sess);
            finishPress(cur, date, n);
            (0, diagnostics_1.logDiagnostic)('info', 'press.finished', { good, percent: pct });
            return { ok: true, good, percent: pct, days: press_1.PRESS_DAYS };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            exports.press.busy = false;
            pushPress();
        }
    });
}
//# sourceMappingURL=press-app.js.map
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
exports.paperHooks = exports.winBounds = exports.media = void 0;
exports.paperUnseen = paperUnseen;
exports.markPaperSeen = markPaperSeen;
exports.issues = issues;
exports.closePaper = closePaper;
exports.openPaper = openPaper;
exports.announceMedia = announceMedia;
exports.currentPaper = currentPaper;
exports.empireInfo = empireInfo;
exports.publishNews = publishNews;
exports.noteExtra = noteExtra;
exports.publishExtra = publishExtra;
exports.makeGossip = makeGossip;
exports.registerMedia = registerMedia;
exports.publishCrisisSpecial = publishCrisisSpecial;
// A-00b 5번: 언론(앱 쪽) — 은하 뉴스 저장소·새해 신문 만들기, 소문 만들기, 신문 창, 언론사 설정 IPC.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 서신·소문을 번갈아 돌리는 자동 작업 타이머(aiTick)는 main.ts에 남아 있다(서신과 함께 옮길 예정).
const office_1 = require("../office");
const crisis_app_1 = require("./crisis-app");
const settings_ui_1 = require("./settings-ui");
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const galnews_1 = require("../galnews");
const gossip_1 = require("../gossip");
const media_custom_1 = require("../media-custom");
const media_prefs_1 = require("../media-prefs");
const mail_1 = require("../mail");
const chronicle_1 = require("../chronicle");
const settings_1 = require("../app/settings");
const radio_app_1 = require("./radio-app");
const ctx_1 = require("../app/ctx");
const window_bounds_1 = require("../window-bounds");
const mood_app_1 = require("./mood-app"); // 민심이 신문 논조에(2026-10-20 알파 10)
exports.media = {
    paperWin: null,
    paperMode: 'paper', // display: 집무실 「크게 보기」로 따로 연 큰 디스플레이 지면(2026-10-18) // 2026-10-18: 오버레이 신문 아이콘 = 종이 지면만, 집무실 = 디스플레이 지면만(지면 바꾸기 단추 없음)
    /** 언론사 설정이 바뀔 때마다 올라간다(라디오 대화 기록을 버릴지 판단) */
    revision: 0,
    /** 최근 소문(최대 30) */
    gossips: [],
};
let issueStore = null;
/** 창 크기·위치 기억(집무실·큰 신문 창, 2026-10-18). office-app 도 같이 쓴다. */
exports.winBounds = new window_bounds_1.BoundsStore(() => path.join(electron_1.app.getPath('userData'), 'sllm_window_bounds.json'), (error) => (0, diagnostics_1.logDiagnostic)('warn', 'storage.write_failed', { store: 'window_bounds', error }));
/** 새 호 표시(집무실 책상 신문, 2026-10-18): 세이브별로 신문을 연 순간의 호 수를 기억하고, 그보다 많으면 새 호. */
exports.paperHooks = { changed: () => { } };
let seenData = null;
const seenFile = () => path.join(electron_1.app.getPath('userData'), 'sllm_paper_seen.json');
function seenAll() { if (seenData)
    return seenData; try {
    const j = JSON.parse(fs.readFileSync(seenFile(), 'utf8'));
    seenData = j && typeof j === 'object' ? j : {};
}
catch {
    seenData = {};
} return seenData; }
const ownIssueCount = (sid) => ctx_1.ctx.govMem().split(sid, issues().list(sid)).own.length;
function paperUnseen() { const sid = ctx_1.ctx.curSaveId; if (!sid)
    return false; try {
    return ownIssueCount(sid) > (seenAll()[sid] ?? 0);
}
catch {
    return false;
} }
function markPaperSeen() {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return;
    try {
        const n = ownIssueCount(sid);
        if (seenAll()[sid] === n)
            return;
        seenAll()[sid] = n;
        fs.writeFileSync(seenFile(), JSON.stringify(seenAll()), 'utf8');
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.write_failed', { store: 'paper_seen', error: e });
    }
    exports.paperHooks.changed();
}
function issues() { return (issueStore ??= new galnews_1.IssueStore(path.join(electron_1.app.getPath('userData'), 'sllm_galnews.json'), (sid) => ctx_1.ctx.govMem().currentBranch(sid))); }
function closePaper() { if (exports.media.paperWin && !exports.media.paperWin.isDestroyed())
    exports.media.paperWin.close(); exports.media.paperWin = null; }
/** 신문은 본 창과 따로, 게임 화면 대부분을 덮는 큰 창으로 연다. */
function openPaper(glass = false, opt = {}) {
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1320, area.width), height: Math.min(1000, Math.round(area.height * 0.92)) };
    let x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    // glass: 집무실 화면에 붙는 디스플레이 지면. display: 집무실 「크게 보기」로 따로 연 큰 디스플레이 지면. 그 밖: 종이 지면(오버레이 아이콘·집무실 책상 신문)
    const mode = glass ? 'office' : opt.display ? 'display' : 'paper';
    markPaperSeen();
    if (exports.media.paperWin && !exports.media.paperWin.isDestroyed()) {
        if (exports.media.paperMode === mode) {
            exports.media.paperWin.show();
            exports.media.paperWin.focus();
            exports.media.paperWin.webContents.send('paperInit');
            return;
        }
        exports.media.paperWin.close(); // 다른 지면으로 열려 있으면 닫고 새로(집무실에 붙어 있던 신문이면 집무실은 바탕화면으로 돌아간다)
    }
    exports.media.paperMode = mode;
    if (!glass) { // 큰 창은 지난번 높이·위치를 기억한다(폭은 지면 폭으로 고정)
        const saved = (0, window_bounds_1.restoreRect)(exports.winBounds.get('paper'), electron_1.screen.getAllDisplays().map((d) => d.workArea), { width: sz.width, height: 560 });
        if (saved) {
            x = saved.x;
            y = saved.y;
            sz.height = saved.height;
        }
    }
    const w = exports.media.paperWin = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: sz.width, maxWidth: sz.width, minHeight: 560, maximizable: false, frame: false, show: false, backgroundColor: '#0a0d12', ...(0, office_1.glassWin)(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.media.paperWin.setAlwaysOnTop(true, 'screen-saver', 1);
    exports.media.paperWin.loadFile(path.join(__dirname, '..', '..', 'ui', 'paper.html'), { query: { mode, ...(opt.unfold ? { unfold: '1' } : {}) } });
    if (!glass) {
        const keep = () => (w.isDestroyed() ? null : w.getBounds());
        w.on('move', () => exports.winBounds.later('paper', keep));
        w.on('resize', () => exports.winBounds.later('paper', keep));
        w.on('close', () => { const b = keep(); if (b)
            exports.winBounds.set('paper', b); });
    }
    exports.media.paperWin.once('ready-to-show', () => { if (!w.isDestroyed())
        w.show(); });
    exports.media.paperWin.on('closed', () => { if (exports.media.paperWin === w)
        exports.media.paperWin = null; }); // 닫히는 옛 창이 새 창을 지우지 않게
}
function announceMedia() {
    const state = (0, media_custom_1.mediaView)(settings_1.settings.mediaPrefs);
    for (const w of electron_1.BrowserWindow.getAllWindows())
        if (!w.isDestroyed())
            w.webContents.send('mediaChanged', state);
    (0, radio_app_1.pushRadioState)();
}
/** 가장 최근 은하 뉴스(2년 안)를 프롬프트 줄로. 이 제국들도 읽은 것으로 친다. */
function currentPaper() {
    if (!ctx_1.ctx.curSaveId)
        return [];
    const own = ctx_1.ctx.govMem().split(ctx_1.ctx.curSaveId, issues().list(ctx_1.ctx.curSaveId)).own;
    const last = own[own.length - 1];
    if (!last || (ctx_1.ctx.gameDate && (0, mail_1.cmpDate)(last.date, (0, mail_1.addYears)(ctx_1.ctx.gameDate, -2)) < 0))
        return [];
    return (0, galnews_1.paperLines)(last);
}
/** 사실에 나온 제국들의 종족·성향 한 줄 요약(신문사의 논조 판단 재료). 아는 제국만. */
/** 신문 프롬프트 자료: 등장 제국 정보 + 우리 제국 민심 한 줄(2026-10-20). */
function empireInfo(facts) { const mood = (0, mood_app_1.moodPromptNow)(); return [...empireInfoOnly(facts), ...(mood ? ['- ' + mood] : [])]; }
function empireInfoOnly(facts) {
    const out = [];
    const seen = new Set();
    for (const c of ctx_1.ctx.mailCountries.values()) {
        if (seen.has(c.name) || !c.name || !c.profile)
            continue;
        if (!facts.some((f) => f.who === c.name || f.text.includes(c.name)))
            continue;
        seen.add(c.name);
        out.push(`- ${c.name}: species ${c.profile.species || 'unknown'}, personality ${c.profile.personality || 'unknown'}, ${c.profile.gov || ''}`.trim()); // 프롬프트 자료(영어, 2026-10-19)
    }
    return out.slice(0, 12);
}
/** 새해가 되면 지난 한 해의 연대기로 은하 뉴스 한 호를 낸다. 사실이 MIN_FACTS 건보다 적으면 내지 않는다. */
const publishing = new Set(); // 같은 날짜 신호가 두 번 와도(재연결 때 로그 다시 읽기 등) 한 호만 만든다(2026-10-18)
async function publishNews(date) {
    if (!ctx_1.ctx.curSaveId || !date || issues().has(ctx_1.ctx.curSaveId, date))
        return;
    const sid = ctx_1.ctx.curSaveId, pk = sid + '|' + date;
    if (publishing.has(pk))
        return;
    publishing.add(pk);
    try {
        await publishNewsNow(sid, date);
    }
    finally {
        publishing.delete(pk);
    }
}
async function publishNewsNow(sid, date) {
    const groups = ctx_1.ctx.chron().groups(sid, (all) => ctx_1.ctx.govMem().split(sid, all).own).filter((g) => g.idx !== chronicle_1.RADIO_IDX).map((g) => ({ ...g, items: g.items.filter((e) => !e.text.startsWith('지도자 사망:') && !/(^|\s)NAME_[A-Za-z0-9_]+/.test(e.text)) })).filter((g) => g.items.length); // 라디오 전용 연대기는 신문 재료가 아니다. 알파5.1까지 제국 연대기에 들어간 일반 지도자 '사망' 줄(은퇴도 포함됨)은 뺀다
    const facts = (0, galnews_1.collectFacts)(groups, (0, mail_1.addYears)(date, -1), 40, date);
    if (facts.length < galnews_1.MIN_FACTS)
        return;
    try {
        const lastIssue = ctx_1.ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
        const pi = (0, galnews_1.pickPaper)(lastIssue?.paper, Math.random, settings_1.settings.papersOn);
        if (pi < 0)
            return; // 켜진 신문사가 없으면 신문을 내지 않는다
        const paper = (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, pi);
        const raw = await ctx_1.ctx.ai.chat((0, galnews_1.newsMessages)(ctx_1.ctx.playerName || 'the player empire', date, facts, paper, empireInfo(facts)), { purpose: 'newspaper', maxTokens: gossip_1.NEWS_MAX_TOKENS, json: true });
        const body = (0, galnews_1.parseIssue)(raw);
        if (!body) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'newspaper', chars: raw.length });
            return;
        }
        if (ctx_1.ctx.curSaveId !== sid) {
            (0, diagnostics_1.logDiagnostic)('info', 'ai.response.discarded', { feature: 'newspaper', reason: 'save_changed' });
            return;
        }
        const it = issues().add(sid, date, body, pi);
        ctx_1.ctx.toUi('galnews', { ...it, paperInfo: paper });
        if (exports.media.paperWin && !exports.media.paperWin.isDestroyed())
            exports.media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
        exports.paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
        ctx_1.ctx.notify({ kind: 'news', title: (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, pi).name, body: it.headline });
    }
    catch (e) {
        ctx_1.ctx.mailNote((0, settings_ui_1.pick)('은하 뉴스 만들기 실패: ', 'Failed to make the Galactic News: ') + e.message);
    }
}
/** 호외 후보: 세이브마다 이번 달 가장 큰 사건 하나. 달이 지나면(다음 월 신호) 낸다. 앱을 껐다 켜면 사라진다. */
const pendingExtra = new Map();
function noteExtra(kind, date, text) {
    const sid = ctx_1.ctx.curSaveId;
    const pri = galnews_1.EXTRA_KINDS[kind];
    if (!sid || !date || !pri || !settings_1.settings.extraOn)
        return;
    const cur = pendingExtra.get(sid);
    if (cur && cur.date.slice(0, 7) === date.slice(0, 7) && cur.pri >= pri)
        return;
    pendingExtra.set(sid, { date, kind, text, pri });
}
/** 달이 바뀌었을 때 지난 달의 큰 사건이 있고 그해 호외 상한 안이면 호외 한 장을 낸다. 사건이 없으면 AI 를 부르지 않는다. */
async function publishExtra(nowDate) {
    const sid = ctx_1.ctx.curSaveId;
    const p = sid ? pendingExtra.get(sid) : undefined;
    if (!sid || !p || !nowDate || p.date.slice(0, 7) === nowDate.slice(0, 7))
        return;
    pendingExtra.delete(sid);
    const specials = issues().list(sid).filter((i) => i.extra && i.date.slice(0, 4) === p.date.slice(0, 4) && (0, crisis_app_1.crisisIsSpecial)(i.id)).length; // 위기 특별판은 호외 연 상한에 넣지 않는다
    if (!settings_1.settings.extraOn || issues().extraCount(sid, p.date.slice(0, 4)) - specials >= settings_1.settings.extraMax)
        return;
    try {
        const lastIssue = ctx_1.ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
        const pi = (0, galnews_1.pickPaper)(lastIssue?.paper, Math.random, settings_1.settings.papersOn);
        if (pi < 0)
            return;
        const paper = (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, pi);
        const raw = await ctx_1.ctx.ai.chat((0, galnews_1.extraMessages)(ctx_1.ctx.playerName || 'the player empire', nowDate, p.text, paper, empireInfo([{ who: '', text: p.text }])), { purpose: 'newspaper', maxTokens: 2000, json: true });
        const body = (0, galnews_1.parseExtra)(raw);
        if (!body) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'newspaper_extra', chars: raw.length });
            return;
        }
        if (ctx_1.ctx.curSaveId !== sid) {
            (0, diagnostics_1.logDiagnostic)('info', 'ai.response.discarded', { feature: 'newspaper_extra', reason: 'save_changed' });
            return;
        }
        const it = issues().add(sid, nowDate, body, pi, true);
        ctx_1.ctx.toUi('galnews', { ...it, paperInfo: paper });
        if (exports.media.paperWin && !exports.media.paperWin.isDestroyed())
            exports.media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
        exports.paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
        ctx_1.ctx.notify({ kind: 'news', title: (0, settings_ui_1.pick)('[호외] ', '[Extra] ') + paper.name, body: it.headline });
    }
    catch (e) {
        ctx_1.ctx.mailNote((0, settings_ui_1.pick)('호외 만들기 실패: ', 'Failed to make the extra edition: ') + e.message);
    }
}
let gossipSeq = 0, lastPair = '', lastGossipKey = '';
async function makeGossip() {
    const sid = ctx_1.ctx.curSaveId, date = ctx_1.ctx.gameDate;
    if (!(0, gossip_1.gossipDue)(lastGossipKey, sid, date)) {
        (0, diagnostics_1.logDiagnostic)('info', 'gossip.skip', { reason: 'same_game_date', date });
        return;
    }
    const pr = (0, gossip_1.pickPair)([...ctx_1.ctx.mailCountries.values()], ctx_1.ctx.news, ctx_1.ctx.playerIdx, lastPair);
    if (!pr)
        return;
    lastGossipKey = sid + '|' + date; // 실패해도 같은 날짜에는 다시 부르지 않는다
    const [a, b] = pr;
    lastPair = (0, gossip_1.pairKey)(a, b);
    const raw = await ctx_1.ctx.ai.chat((0, gossip_1.gossipMessages)(ctx_1.ctx.playerName || 'the player empire', date, a, b, ctx_1.ctx.news, currentPaper()), { purpose: 'gossip', maxTokens: gossip_1.GOSSIP_MAX_TOKENS, json: true });
    const lines = (0, gossip_1.parseGossip)(raw, a.name, b.name);
    if (!lines) {
        (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'gossip', chars: raw.length });
        return;
    }
    const g = { id: ++gossipSeq, date: ctx_1.ctx.gameDate, a: a.name, b: b.name, lines };
    exports.media.gossips.push(g);
    while (exports.media.gossips.length > 30)
        exports.media.gossips.shift();
    ctx_1.ctx.toUi('gossip', g);
    ctx_1.ctx.notify({ kind: 'info', title: (0, settings_ui_1.pick)('엿들은 소문', 'Overheard rumor'), body: (0, settings_ui_1.pick)(`${a.name}와(과) ${b.name}의 비공개 대화를 엿들었습니다.`, `Overheard a private conversation between ${a.name} and ${b.name}.`) });
}
function registerMedia() {
    electron_1.ipcMain.handle('mediaGet', async () => (0, media_custom_1.mediaView)(settings_1.settings.mediaPrefs));
    electron_1.ipcMain.handle('mediaSave', async (_e, id, value) => {
        try {
            const index = media_custom_1.MEDIA_FAMILIES.findIndex((f) => f.id === id);
            if (index < 0)
                throw new Error((0, settings_ui_1.pick)('알 수 없는 언론사입니다.', 'Unknown media outlet.'));
            const v = value;
            if (v !== null && (typeof v?.persona !== 'string' || !v.persona.trim() || v.persona.length > 4000 || typeof v.comments !== 'boolean'))
                throw new Error((0, settings_ui_1.pick)('페르소나를 1~4000자로 입력하세요.', 'Enter a persona of 1–4000 characters.'));
            if (v !== null && [v.paperName, v.radioName].some((name) => typeof name !== 'string' || !name.trim() || name.trim().length > 40))
                throw new Error((0, settings_ui_1.pick)('신문사·방송사 이름을 각각 1~40자로 입력하세요.', 'Enter newspaper and station names of 1–40 characters each.'));
            const next = settings_1.settings.mediaPrefs.slice();
            next[index] = v === null ? { ...(0, media_custom_1.sanitizeMedia)(null)[index], paperName: next[index].paperName, radioName: next[index].radioName, font: next[index].font } : { paperName: v.paperName.trim(), radioName: v.radioName.trim(), persona: (0, media_prefs_1.isDefaultPersona)(index, v.persona) ? '' : v.persona.trim(), comments: v.comments, font: v.font === undefined ? next[index].font : (0, media_custom_1.cleanFont)(v.font) };
            fs.writeFileSync((0, settings_1.settingsPath)(), JSON.stringify({ ...settings_1.settings, mediaPrefs: next }, null, 2), 'utf8');
            settings_1.settings.mediaPrefs = next;
            exports.media.revision++;
            radio_app_1.radio.history.delete(media_custom_1.MEDIA_FAMILIES[index].id);
            radio_app_1.radio.history.delete(media_custom_1.MEDIA_FAMILIES[index].id + ':daily');
            announceMedia();
            return { ok: true, state: (0, media_custom_1.mediaView)(settings_1.settings.mediaPrefs) };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('mediaBrand', async (_e, id, kind, reset) => {
        try {
            if (!media_custom_1.MEDIA_FAMILIES.some((f) => f.id === id) || !['paper', 'radio'].includes(kind))
                throw new Error((0, settings_ui_1.pick)('알 수 없는 브랜드입니다.', 'Unknown brand.'));
            if (reset === true)
                (0, media_custom_1.resetBrand)(id, kind);
            else {
                const owner = ctx_1.ctx.setWin && !ctx_1.ctx.setWin.isDestroyed() ? ctx_1.ctx.setWin : ctx_1.ctx.win;
                const result = await electron_1.dialog.showOpenDialog(owner, { title: (0, settings_ui_1.pick)('브랜드 그림 고르기 (8MB 이하)', 'Choose a brand image (8 MB or less)'), properties: ['openFile'], filters: [{ name: (0, settings_ui_1.pick)('그림', 'Images'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
                if (result.canceled || !result.filePaths[0])
                    return { ok: true, cancelled: true };
                (0, media_custom_1.storeBrand)(id, kind, result.filePaths[0]);
            }
            announceMedia();
            return { ok: true, state: (0, media_custom_1.mediaView)(settings_1.settings.mediaPrefs) };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('newsList', async () => (ctx_1.ctx.curSaveId ? ctx_1.ctx.govMem().split(ctx_1.ctx.curSaveId, issues().list(ctx_1.ctx.curSaveId)).own.slice().reverse().map((i) => ({ ...i, paperInfo: (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, i.paper ?? 0) })) : []));
    electron_1.ipcMain.handle('gossipList', async () => exports.media.gossips.slice());
    electron_1.ipcMain.handle('paperOpen', async () => { openPaper(); return true; });
    electron_1.ipcMain.handle('paperDesk', async () => { openPaper(false, { unfold: true }); return true; }); // 집무실 책상 위 신문: 종이 지면 큰 창 + 펼치는 효과(2026-10-18)
    electron_1.ipcMain.handle('paperBig', async () => { openPaper(false, { display: true }); return true; }); // 집무실 신문 「크게 보기」: 디스플레이 지면 큰 창
    electron_1.ipcMain.handle('paperClose', async () => { closePaper(); return true; });
}
/** 은하 위기 특별판(2026-10-17): 위기가 새로 나타난 달에 바로 한 장. 호외 모양 + 특별판 지면, 호외 연 상한과 별개. 정기호·일반 호외는 평소대로. */
async function publishCrisisSpecial(date, fact, label) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid || !date)
        return;
    try {
        const lastIssue = ctx_1.ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
        const pi = (0, galnews_1.pickPaper)(lastIssue?.paper, Math.random, settings_1.settings.papersOn);
        if (pi < 0)
            return;
        const paper = (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, pi);
        const raw = await ctx_1.ctx.ai.chat((0, crisis_app_1.crisisNewsWrap)((0, galnews_1.extraMessages)(ctx_1.ctx.playerName || 'the player empire', date, fact, paper, empireInfo([{ who: '', text: fact }]))), { purpose: 'newspaper', maxTokens: 2000, json: true });
        const body = (0, galnews_1.parseExtra)(raw);
        if (!body) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'newspaper_crisis', chars: raw.length });
            return;
        }
        if (ctx_1.ctx.curSaveId !== sid) {
            (0, diagnostics_1.logDiagnostic)('info', 'ai.response.discarded', { feature: 'newspaper_crisis', reason: 'save_changed' });
            return;
        }
        const it = issues().add(sid, date, body, pi, true);
        (0, crisis_app_1.crisisMarkIssue)(it.id, label);
        ctx_1.ctx.toUi('galnews', { ...it, paperInfo: paper });
        if (exports.media.paperWin && !exports.media.paperWin.isDestroyed())
            exports.media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
        exports.paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
        ctx_1.ctx.notify({ kind: 'news', title: (0, settings_ui_1.pick)('[위기 특별판]', '[Crisis special edition]') + ' ' + paper.name, body: it.headline });
    }
    catch (e) {
        ctx_1.ctx.mailNote((0, settings_ui_1.pick)('위기 특별판 만들기 실패: ', 'Failed to make the crisis special edition: ') + e.message);
    }
}
(0, crisis_app_1.setCrisisExtra)(noteExtra); // 은하 위기가 끝날 때 일반 호외 예약 — 2026-10-17
(0, crisis_app_1.setCrisisSpecial)(publishCrisisSpecial); // 위기가 나타날 때 특별판 발행
//# sourceMappingURL=media.js.map
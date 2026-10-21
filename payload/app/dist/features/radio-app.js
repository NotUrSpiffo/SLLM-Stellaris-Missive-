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
exports.radioDev = exports.radio = void 0;
exports.radioResetForSave = radioResetForSave;
exports.radioAired = radioAired;
exports.radioChronOwn = radioChronOwn;
exports.fillRadioBacklog = fillRadioBacklog;
exports.scheduleRadio = scheduleRadio;
exports.configuredStations = configuredStations;
exports.configuredStation = configuredStation;
exports.radioState = radioState;
exports.pushRadioState = pushRadioState;
exports.radioTick = radioTick;
exports.setRadio = setRadio;
exports.placeRadio = placeRadio;
exports.openRadioWin = openRadioWin;
exports.registerRadio = registerRadio;
// A-00b 4번: 성간 라디오(앱 쪽). 2026-10-15 main.ts 709~834줄·IPC 4개(radioGet·radioSelect·radioOff·radioNow)에서 옮김(동작 변경 없음).
// 순수 로직(대본·대기열·방송 기록)은 src/radio.ts. 여기는 타이머·창·IPC. 다른 기능은 radio 객체(on·q·win…)로 상태를 본다.
// 성간 라디오: 플레이어가 켰을 때만. 2분(실제 시간)마다 쌓인 사건으로 아나운서와 기자가 방송한다.
const crisis_app_1 = require("./crisis-app");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const radio_1 = require("../radio");
const chronicle_app_1 = require("./chronicle-app");
const aiclient_1 = require("../aiclient");
const gameWindow_1 = require("../gameWindow");
const media_custom_1 = require("../media-custom");
const chronicle_1 = require("../chronicle");
const settings_1 = require("../app/settings");
const ctx_1 = require("../app/ctx");
const safe_send_1 = require("../safe-send");
const settings_ui_1 = require("./settings-ui");
const mood_app_1 = require("./mood-app"); // 민심이 라디오 논조에(2026-10-20 알파 10)
exports.radio = {
    win: null,
    on: false,
    timer: null,
    next: 0,
    busy: false,
    /** A-15 지금 듣기 쿨다운 기준 */
    lastEnd: 0,
    q: new radio_1.RadioQueue(),
    /** 세이브별 마지막 요약 재방송(같은 요약을 되풀이하지 않는다) */
    recapSig: new Map(),
    history: new Map(),
    session: 0,
    /** 게임이 꺼져 있어 쉰다는 알림(radioIdle)을 이번에 이미 보냈는가. 방송을 다시 시작하면 지운다. */
    idleSent: false,
    /** 세이브별 마지막 가상 일상 방송의 게임 날짜. 날짜가 그대로면(일시정지 등) 같은 일상 방송에 AI 를 다시 부르지 않는다(2026-10-18). */
    dailyDate: new Map(),
};
/** 세이브가 바뀌거나 게임 로그가 새로 시작되면 이전 세이브의 대기열·최근 방송 문맥을 버린다(2026-10-18). 다음 방송 때 새 세이브의 연대기로 다시 채운다. */
function radioResetForSave() {
    exports.radio.q.clear();
    exports.radio.history.clear();
    exports.radio.idleSent = false;
    (0, safe_send_1.safeSend)(exports.radio.win, 'radioQueue', 0);
}
/** 개발자 시험용 우회(게임 없이 방송). dev-tools 만 켜고, 개발자 모드가 꺼져 있으면 radioGameLive 가 무시한다. 저장하지 않는다. */
exports.radioDev = { bypass: false };
const gameLive = () => (0, radio_1.radioGameLive)(ctx_1.ctx.gameRunning, settings_1.settings.devMode, exports.radioDev.bypass);
let radioAiredStore = null;
function radioAired() { return (radioAiredStore ??= new radio_1.RadioAiredStore(path.join(electron_1.app.getPath('userData'), 'sllm_radio_aired.json'))); }
/** 이 시간선의 라디오 연대기(오래된 순). */
function radioChronOwn(sid) { return ctx_1.ctx.govMem().split(sid, ctx_1.ctx.chron().list((0, chronicle_1.chronKey)(sid, chronicle_1.RADIO_IDX))).own; }
/** 라디오 연대기의 최근 1년 중 아직 방송하지 않은 사건으로 대기열을 채운다. */
function fillRadioBacklog() {
    if (!ctx_1.ctx.curSaveId || !ctx_1.ctx.gameDate)
        return;
    const sid = ctx_1.ctx.curSaveId;
    for (const ev of (0, radio_1.backlogEvents)(radioChronOwn(sid), ctx_1.ctx.gameDate, (id) => radioAired().has(sid, id)))
        exports.radio.q.push(ev);
    (0, safe_send_1.safeSend)(exports.radio.win, 'radioQueue', exports.radio.q.size);
}
const RADIO_MS = 120000;
function scheduleRadio() {
    if (!exports.radio.on)
        return;
    if (exports.radio.timer)
        clearTimeout(exports.radio.timer); // 주기가 두 갈래로 겹치지 않게
    const session = exports.radio.session;
    exports.radio.next = Date.now() + RADIO_MS;
    pushRadioState();
    exports.radio.timer = setTimeout(() => { void radioTick().finally(() => { if (exports.radio.on && session === exports.radio.session)
        scheduleRadio(); }); }, RADIO_MS);
}
function configuredStations() {
    return (0, radio_1.radioStationViews)().map((s) => ({
        ...s,
        name: settings_1.settings.mediaPrefs[s.paper]?.radioName || s.name,
        parent: (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, s.paper).name,
        outlook: settings_1.settings.mediaPrefs[s.paper]?.persona
            ? (0, settings_ui_1.pick)('사용자 지정 · ', 'Custom · ') + settings_1.settings.mediaPrefs[s.paper].persona.replace(/\s+/g, ' ').slice(0, 90)
            : s.outlook,
    }));
}
function configuredStation(id) { return configuredStations().find((s) => s.id === id) ?? configuredStations()[0]; }
function radioState() {
    const station = configuredStation(settings_1.settings.radioStation);
    return { on: exports.radio.on, next: exports.radio.next, queued: exports.radio.q.size, working: exports.radio.busy, station: station.id, stations: configuredStations(), names: { announcer: station.announcer, reporter: station.reporter } };
}
function pushRadioState() { (0, safe_send_1.safeSend)(ctx_1.ctx.launcher, 'radioOn', exports.radio.on); (0, safe_send_1.safeSend)(exports.radio.win, 'radioState', radioState()); }
/** 방송 한 편. 실제로 방송을 내보냈으면 true(개발자 시험이 견본 대본으로 대신할지 판단). */
async function radioTick(manual = false) {
    if (!exports.radio.on || exports.radio.busy)
        return false;
    exports.radio.next = 0;
    (0, safe_send_1.safeSend)(exports.radio.win, 'radioState', radioState());
    if (!gameLive()) {
        if (!exports.radio.idleSent) {
            exports.radio.idleSent = true;
            (0, safe_send_1.safeSend)(exports.radio.win, 'radioIdle');
        }
        return false;
    } // 쉰다는 알림은 한 번만
    exports.radio.idleSent = false;
    if (!exports.radio.q.size) {
        (0, chronicle_app_1.syncRadioChron)();
        fillRadioBacklog();
    } // 신문 연대기에만 있던 기록도 라디오 연대기에 채운 뒤 미방송 사건으로 대기열을 만든다
    const sid = ctx_1.ctx.curSaveId;
    let facts = exports.radio.q.take();
    const taken = exports.radio.q.taken;
    let recap = false, recapSig = '';
    if (!facts.length && sid && ctx_1.ctx.gameDate) { // 새 사건이 없으면 창작 방송 전에 최근 1년 요약 재방송(같은 요약은 한 번만)
        const r = (0, radio_1.recapFacts)(radioChronOwn(sid), ctx_1.ctx.gameDate);
        recapSig = r.join('\n');
        if (r.length && exports.radio.recapSig.get(sid) !== recapSig) {
            facts = r;
            recap = true;
        }
    }
    const crisis = (0, crisis_app_1.crisisRadio)(); // 은하 위기 특집(2026-10-17): 위기 동안에는 가상 일상 코너 대신 위기 특보, 대본은 긴급 특별 방송 편성
    if (!facts.length && !recap && crisis.directive && crisis.facts.length)
        facts = crisis.facts;
    const fictional = facts.length === 0;
    // 새 사건·요약·위기가 없을 때의 가상 일상 방송은 게임 날짜가 바뀌었을 때만(일시정지한 채 자리를 비우면 2분마다 유료 호출이 쌓이던 문제). '지금 듣기'는 예외.
    if (fictional && !manual && sid && ctx_1.ctx.gameDate && exports.radio.dailyDate.get(sid) === ctx_1.ctx.gameDate)
        return false;
    const restore = () => { if (!recap && exports.radio.on && session === exports.radio.session && sid === ctx_1.ctx.curSaveId) {
        exports.radio.q.putBack();
        (0, safe_send_1.safeSend)(exports.radio.win, 'radioQueue', exports.radio.q.size);
    } };
    const station = configuredStation(settings_1.settings.radioStation), session = exports.radio.session, date = ctx_1.ctx.gameDate, revision = ctx_1.ctx.mediaRevision;
    const historyKey = station.id + (fictional ? ':daily' : recap ? ':recap' : '');
    const radioRecent = exports.radio.history.get(historyKey) ?? [];
    const format = Math.random() < 0.5 ? 'studio' : 'field';
    const names = { announcer: station.announcer, cohost: station.cohost, reporter: station.reporter };
    exports.radio.busy = true;
    (0, safe_send_1.safeSend)(exports.radio.win, 'radioWorking', true);
    try {
        const background = !recap && sid && ctx_1.ctx.gameDate ? (0, radio_1.followUpBackground)(taken, radioChronOwn(sid), ctx_1.ctx.gameDate, (id) => radioAired().has(sid, id)) : []; // 후속 보도: 이어지는 지난 소식을 같은 호출의 프롬프트에 넣는다(추가 AI 호출 없음)
        const messages = (0, radio_1.radioMessages)(ctx_1.ctx.playerName || 'the player empire', date, facts, radioRecent, station.id, (0, media_custom_1.effectivePaper)(settings_1.settings.mediaPrefs, station.paper), station.name, format, recap, background);
        if (crisis.directive)
            messages.splice(1, 0, { role: 'system', content: crisis.directive });
        {
            const md = (0, mood_app_1.moodPromptNow)();
            if (md)
                messages.splice(1, 0, { role: 'system', content: md });
        } // 민심 한 줄(진행자의 말투·화제 선택에만, 수치를 읽지는 않게)
        let raw = await ctx_1.ctx.ai.chat(messages, { maxTokens: 2200, json: true });
        if (!exports.radio.on || session !== exports.radio.session || sid !== ctx_1.ctx.curSaveId)
            return false; // 껐다 다시 켠 창·다른 세이브에 이전 방송을 내보내지 않는다
        let lines = (0, radio_1.parseRadio)(raw);
        if (!(0, radio_1.completeRadio)(lines, format)) {
            raw = await ctx_1.ctx.ai.chat([...messages, { role: 'user', content: 'Rewrite the script. I need complete JSON with exactly 8 lines alternating between announcer and ' + (format === 'studio' ? 'cohost' : 'reporter') + '. Keep each line short.' }], { maxTokens: 2200, json: true });
            if (!exports.radio.on || session !== exports.radio.session || sid !== ctx_1.ctx.curSaveId)
                return false;
            lines = (0, radio_1.parseRadio)(raw);
        }
        if (!(0, radio_1.completeRadio)(lines, format)) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'radio', format, lineCount: lines.length });
            restore();
            (0, safe_send_1.safeSend)(exports.radio.win, 'radioError', (0, settings_ui_1.pick)('4차례 대화 형식의 대본을 완성하지 못했습니다. 이번 방송은 쉽니다(사건은 다음 방송으로 넘깁니다).', 'Could not complete a four-exchange script. Skipping this broadcast (the events carry over to the next one).'));
            return false;
        }
        if (fictional && sid && date)
            exports.radio.dailyDate.set(sid, date);
        if (recap)
            exports.radio.recapSig.set(sid, recapSig);
        else if (sid)
            radioAired().mark(sid, taken.map((e) => e.id ?? '').filter(Boolean));
        for (const l of lines)
            radioRecent.push(`${names[l.who]}: ${l.text}`);
        if (radioRecent.length > 12)
            radioRecent.splice(0, radioRecent.length - 12);
        if (revision === ctx_1.ctx.mediaRevision)
            exports.radio.history.set(historyKey, radioRecent);
        (0, safe_send_1.safeSend)(exports.radio.win, 'radioBroadcast', { date, lines, station: station.name, parent: station.parent, format, names, fictional, crisis: !!crisis.directive });
        return true;
    }
    catch (e) {
        restore();
        if (exports.radio.on && session === exports.radio.session)
            (0, safe_send_1.safeSend)(exports.radio.win, 'radioError', (0, aiclient_1.redactKey)(e.message));
        return false;
    }
    finally {
        exports.radio.busy = false;
        exports.radio.lastEnd = Date.now();
        (0, safe_send_1.safeSend)(exports.radio.win, 'radioWorking', false);
    }
}
function setRadio(on) {
    if (on === exports.radio.on)
        return;
    exports.radio.on = on;
    exports.radio.session++;
    if (on) {
        exports.radio.q.clear();
        exports.radio.idleSent = false;
        (0, chronicle_app_1.syncRadioChron)();
        fillRadioBacklog();
        openRadioWin();
        scheduleRadio(); // 켤 때 비우기만 하던 것을 최근 1년의 미방송 사건으로 채운다(F-03)
    }
    else {
        if (exports.radio.timer) {
            clearTimeout(exports.radio.timer);
            exports.radio.timer = null;
        }
        exports.radio.q.clear();
        if (exports.radio.win && !exports.radio.win.isDestroyed())
            exports.radio.win.close();
        exports.radio.win = null;
    }
    pushRadioState();
}
let lastAutoMoveR = 0, userMoveR = 0, radioBorn = 0, lastRadioAuto = { x: -99999, y: -99999 };
/** 라디오 창 자리: 오버레이 아이콘 바로 옆(아이콘이 오른쪽이면 그 왼쪽). 대화창이 겹치면 그 위. 사용자가 옮긴 자리가 있으면 그 자리를 쓴다. */
function placeRadio() {
    if (!exports.radio.win || exports.radio.win.isDestroyed() || !exports.radio.win.isVisible() || !ctx_1.ctx.gameDip || Date.now() - userMoveR < 1500)
        return;
    const [w, h] = exports.radio.win.getSize(), sc = ctx_1.ctx.curScale || 1, gap = Math.round(8 * sc), g = ctx_1.ctx.gameDip;
    let x, y;
    if (settings_1.settings.radioDockPos) {
        x = g.x + settings_1.settings.radioDockPos.fx * g.width;
        y = g.y + settings_1.settings.radioDockPos.fy * g.height;
    }
    else {
        // 아이콘 창이 숨겨져 있어도(게임이 앞에 없을 때 등) 설정된 아이콘 자리를 기준으로 삼는다
        const L = ctx_1.ctx.launcher && !ctx_1.ctx.launcher.isDestroyed() ? ctx_1.ctx.launcher.getBounds() : (0, gameWindow_1.launcherRect)(g, { width: Math.round(ctx_1.ctx.BASE_ICON.width * sc), height: Math.round(ctx_1.ctx.iconBaseHeight() * sc) }, settings_1.settings.launcherCorner, settings_1.settings.launcherPos, sc), onRight = L.x + L.width / 2 > g.x + g.width / 2;
        x = onRight ? L.x - w - gap : L.x + L.width + gap;
        y = L.y + L.height - h;
        if (ctx_1.ctx.win && !ctx_1.ctx.win.isDestroyed() && ctx_1.ctx.win.isVisible()) {
            const C = ctx_1.ctx.win.getBounds();
            if (x < C.x + C.width && x + w > C.x && y < C.y + C.height && y + h > C.y)
                y = C.y - h - gap;
        }
    }
    x = Math.round(Math.min(Math.max(x, g.x), g.x + g.width - w));
    y = Math.round(Math.min(Math.max(y, g.y + Math.round(72 * sc)), g.y + g.height - h));
    const b = exports.radio.win.getBounds();
    if (Math.abs(b.x - x) > 1 || Math.abs(b.y - y) > 1) {
        lastAutoMoveR = Date.now();
        lastRadioAuto = { x, y };
        exports.radio.win.setPosition(x, y);
    }
}
function openRadioWin() {
    if (exports.radio.win && !exports.radio.win.isDestroyed()) {
        exports.radio.win.showInactive();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    // 기존 대화창과 같은 쪽(오른쪽)에 둔다. 왼쪽은 스텔라리스의 중요한 화면이 많아 가리지 않는다. 위쪽 자원 막대 아래에서 시작하고, 대화창이 열려 있으면 그 위까지만 쓴다.
    const sc = ctx_1.ctx.curScale || 1, top = area.y + Math.round(72 * sc), side = settings_1.settings.dock === 'left' ? 'left' : 'right';
    const chatTop = ctx_1.ctx.win && !ctx_1.ctx.win.isDestroyed() && ctx_1.ctx.win.isVisible() ? ctx_1.ctx.win.getBounds().y : area.y + area.height;
    const width = Math.round(680 * sc), height = Math.max(Math.round(230 * sc), Math.min(Math.round(260 * sc), chatTop - top - 8));
    const ix = side === 'right' ? area.x + area.width - width - Math.round(16 * sc) : area.x + Math.round(16 * sc);
    exports.radio.win = new electron_1.BrowserWindow({ width, height, x: ix, y: top, minWidth: 560, minHeight: 210, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, skipTaskbar: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    radioBorn = Date.now();
    lastRadioAuto = { x: -99999, y: -99999 };
    exports.radio.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.radio.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'radio.html'));
    exports.radio.win.once('ready-to-show', () => { exports.radio.win?.showInactive(); pushRadioState(); placeRadio(); });
    let saveR = null;
    exports.radio.win.on('move', () => {
        const nb = exports.radio.win ? exports.radio.win.getBounds() : null;
        // 창을 만들고 자리를 잡는 동안, 그리고 앱이 둔 자리(±3px)에서 일어난 이동은 사용자가 끈 것이 아니다
        if (!nb || Date.now() - lastAutoMoveR < 400 || Date.now() - radioBorn < 2500 || (Math.abs(nb.x - lastRadioAuto.x) <= 3 && Math.abs(nb.y - lastRadioAuto.y) <= 3))
            return;
        userMoveR = Date.now();
        if (saveR)
            clearTimeout(saveR);
        saveR = setTimeout(() => { if (!exports.radio.win || exports.radio.win.isDestroyed() || !ctx_1.ctx.gameDip)
            return; settings_1.settings.radioDockPos = (0, gameWindow_1.toFrac)(exports.radio.win.getBounds(), ctx_1.ctx.gameDip); (0, settings_1.saveSettings)(); }, 400);
    });
    exports.radio.win.on('closed', () => { exports.radio.win = null; if (exports.radio.on)
        setRadio(false); }); // 창을 닫으면 라디오도 꺼진다
}
function registerRadio() {
    electron_1.ipcMain.handle('radioGet', async () => radioState());
    electron_1.ipcMain.handle('radioSelect', async (_e, id) => {
        if (!(0, radio_1.radioStationViews)().some((s) => s.id === id))
            return { ok: false, error: (0, settings_ui_1.pick)('알 수 없는 방송사입니다.', 'Unknown station.'), state: radioState() };
        if (exports.radio.busy)
            return { ok: false, error: (0, settings_ui_1.pick)('방송 준비가 끝난 뒤 방송사를 바꿀 수 있습니다.', 'You can change stations after the broadcast is prepared.'), state: radioState() };
        settings_1.settings.radioStation = (0, radio_1.radioStation)(id).id;
        (0, settings_1.saveSettings)();
        pushRadioState();
        return { ok: true, state: radioState() };
    });
    electron_1.ipcMain.handle('radioOff', async () => { setRadio(false); return true; });
    electron_1.ipcMain.handle('radioNow', async () => {
        const why = (0, radio_1.radioNowBlock)({ on: exports.radio.on, busy: exports.radio.busy, gameRunning: gameLive(), lastEnd: exports.radio.lastEnd, now: Date.now() });
        if (why)
            return { ok: false, error: why, state: radioState() };
        const session = exports.radio.session;
        if (exports.radio.timer) {
            clearTimeout(exports.radio.timer);
            exports.radio.timer = null;
        }
        try {
            await radioTick(true);
        }
        finally {
            if (exports.radio.on && session === exports.radio.session)
                scheduleRadio();
        }
        return { ok: true, state: radioState() };
    });
}
//# sourceMappingURL=radio-app.js.map
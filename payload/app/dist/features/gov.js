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
exports.refreshPlanets = exports.gov = void 0;
exports.govRawLog = govRawLog;
exports.govMem = govMem;
exports.closeGov = closeGov;
exports.openGov = openGov;
exports.setGovBio = setGovBio;
exports.registerGov = registerGov;
// A-00b 5번: 행성 총독(앱 쪽) — 총독 창, 행성 목록 요청, 총독 대화, 총독 기억 저장소, IPC 8개.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 순수 로직은 src/planets.ts·src/govmemory.ts. 행성 목록 줄(PLANETS…)은 main.ts 로그 분배(SLOT.PLANETS)에서 gov.collector로 넣는다.
// 총독 대화(실험): 내 행성 목록과 지금 대화의 기록. 대화는 저장하지 않고, 행성을 바꾸거나 세이브가 바뀌면 비운다.
const office_1 = require("../office");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const planets_1 = require("../planets");
const govmemory_1 = require("../govmemory");
const planetart_1 = require("../planetart");
const protocol_1 = require("../protocol");
const game_link_1 = require("../app/game-link");
const ctx_1 = require("../app/ctx");
const single_flight_1 = require("../single-flight");
const persona_1 = require("../persona");
const settings_ui_1 = require("./settings-ui");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)
exports.gov = {
    win: null,
    collector: new planets_1.PlanetCollector(),
    planetList: null,
    history: [],
    waiters: [],
};
let govMemStore = null;
/** 총독 답 원문을 최근 30건만 파일에 남긴다(끊김·되풀이 원인을 볼 때 쓴다). */
function govRawLog(q, raw, retry) {
    (0, diagnostics_1.writeRawDiagnostic)('sllm_govraw.log', new Date().toISOString() + ' retry=' + retry + '\nQ: ' + q.slice(0, 200) + '\nlen=' + raw.length + '\n' + raw);
    return;
}
function govMem() { return (govMemStore ??= new govmemory_1.GovMemoryStore(path.join(electron_1.app.getPath('userData'), 'sllm_gov_memory.json'))); }
// ---- 행성 총독 창: 통신 단말기와 따로 큰 창으로 연다. focus 가 있으면 그 행성의 총독 대화로 바로 들어간다.
function closeGov() { if (exports.gov.win && !exports.gov.win.isDestroyed())
    exports.gov.win.close(); exports.gov.win = null; }
function openGov(focus, glass = false) {
    const send = () => { if (focus)
        exports.gov.win?.webContents.send('govFocus', focus);
    else
        exports.gov.win?.webContents.send('govInit'); };
    if (exports.gov.win && !exports.gov.win.isDestroyed()) {
        exports.gov.win.show();
        exports.gov.win.focus();
        send();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(980, Math.round(area.width * 0.7)), height: Math.min(900, Math.round(area.height * 0.88)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.gov.win = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 560, minHeight: 520, frame: false, show: false, backgroundColor: '#06141b', ...(0, office_1.glassWin)(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.gov.win.setAlwaysOnTop(true, 'screen-saver', 1);
    exports.gov.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'gov.html'));
    exports.gov.win.once('ready-to-show', () => { exports.gov.win?.show(); send(); });
    exports.gov.win.on('closed', () => { exports.gov.win = null; });
}
// 총독 기억: 이름이 있는 실제 총독만. 세이브를 되돌려도 남도록 앱 파일에 따로 저장한다.
/** 총독 인물 전기(2026-10-18). backstory-app 이 연결한다(가져오기 순환을 피하려고 여기서 persona-app 을 부르지 않음). */
let govBio = () => '';
function setGovBio(f) { govBio = f; }
const govTarget = (index) => {
    const i = Number(index);
    if (!exports.gov.planetList || !Number.isInteger(i) || !exports.gov.planetList.planets[i])
        throw new Error(L('먼저 행성 목록을 읽고 행성을 고르세요.', 'Load the planet list and choose a planet first.'));
    const p = exports.gov.planetList.planets[i];
    const name = (0, planets_1.governorName)(p);
    if (name === planets_1.DEFAULT_GOVERNOR)
        return { p, name, key: null };
    return { p, name, key: (0, govmemory_1.govKey)(exports.gov.planetList.sid || ctx_1.ctx.curSaveId || '', name) };
};
const memView = (key) => { const v = key ? govMem().view(key) : { own: [], other: [] }; const lv = (0, govmemory_1.levelOf)(v.own.length + v.other.length); return { enabled: !!key, level: lv, label: govmemory_1.LEVELS[lv], items: [...v.own, ...v.other] }; };
exports.refreshPlanets = (0, single_flight_1.singleFlight)(async () => {
    const sid = ctx_1.ctx.curSaveId;
    let waiter = null, timer = null;
    const wait = new Promise((res) => {
        waiter = (l) => { if (sid && l.sid !== sid)
            return; if (timer)
            clearTimeout(timer); res(l); };
        exports.gov.waiters.push(waiter);
        timer = setTimeout(() => { const i = waiter ? exports.gov.waiters.indexOf(waiter) : -1; if (i >= 0)
            exports.gov.waiters.splice(i, 1); res(null); }, 15000);
    });
    try {
        await (0, game_link_1.enqueue)(() => (0, game_link_1.sendConsole)((0, protocol_1.planetsEffect)()));
        const l = await wait;
        if (sid && ctx_1.ctx.curSaveId !== sid)
            return { error: L('세이브가 바뀌었습니다. 현재 세이브에서 다시 읽어 주세요.', 'The save has changed. Reload from the current save.') };
        return l ? { list: l } : { error: L('게임에서 행성 목록이 오지 않았습니다. 게임이 켜져 있고 게임 창이 앞에 있는지, 이 모드가 켜져 있는지 확인하세요.', 'No planet list came from the game. Check that the game is running and in front, and that this mod is enabled.') };
    }
    catch (e) {
        return { error: L('게임에 요청을 보내지 못했습니다: ', 'Could not send the request to the game: ') + e.message };
    }
    finally {
        if (timer)
            clearTimeout(timer);
        const i = waiter ? exports.gov.waiters.indexOf(waiter) : -1;
        if (i >= 0)
            exports.gov.waiters.splice(i, 1);
    }
});
function registerGov() {
    electron_1.ipcMain.handle('govRefresh', () => (0, exports.refreshPlanets)());
    electron_1.ipcMain.handle('govReset', async () => { exports.gov.history = []; return true; });
    electron_1.ipcMain.handle('govMemList', async (_e, a) => memView(govTarget(a?.index).key));
    electron_1.ipcMain.handle('govMemAdd', async (_e, a) => {
        const t = govTarget(a?.index);
        if (!t.key)
            throw new Error(L('일반 총독관은 기억을 갖지 않습니다.', 'A generic governor\'s office keeps no memories.'));
        govMem().add(t.key, (0, govmemory_1.cleanMemText)(a?.text), ctx_1.ctx.gameDate);
        return memView(t.key);
    });
    electron_1.ipcMain.handle('govMemDel', async (_e, a) => {
        const t = govTarget(a?.index);
        if (!t.key)
            return memView(null);
        govMem().remove(t.key, Number(a?.id));
        return memView(t.key);
    });
    electron_1.ipcMain.handle('govChat', async (_e, a) => {
        ctx_1.ctx.needPaused();
        const text = typeof a?.text === 'string' ? a.text.trim().slice(0, 600) : '';
        const t = govTarget(a?.index);
        if (!text)
            throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
        const mv = t.key ? govMem().view(t.key) : null;
        const msgs = (0, planets_1.govMessages)(exports.gov.planetList, t.p, '', exports.gov.history, text, mv ? mv.own : undefined, mv ? mv.other : undefined);
        {
            const bio = (0, persona_1.bioBlock)({ bio: govBio(t.p.name) });
            if (bio && msgs[0]?.role === 'system')
                msgs[0] = { ...msgs[0], content: msgs[0].content + '\n' + bio };
        } // 인물 전기(2026-10-18)
        let cut = false;
        let raw = await ctx_1.ctx.ai.session(async (chat) => {
            let raw = await chat(msgs, { maxTokens: 1500 });
            govRawLog(text, raw, false);
            cut = (0, planets_1.govLooksCut)(raw);
            if (cut) { // 중간에 끊긴 답은 한 번 더 받는다(더 넉넉한 한도로, 끝까지 쓰라고 일러서). 같은 연결로 받는다.
                raw = await chat([...msgs, { role: 'user', content: '[System notice] Your last reply was cut off. Say the same thing again in two or three sentences, finishing every sentence.' }], { maxTokens: 2500 });
                govRawLog(text, raw, true);
                cut = (0, planets_1.govLooksCut)(raw);
            }
            return raw;
        });
        const ex = (0, planets_1.extractGovSay)(raw);
        let say = ex.say;
        let memo = '';
        if (cut)
            say = say.replace(/\s*…\((?:잘림|cut off)\)\s*$/, '') + L(' …(끊김)', ' …(cut off)');
        if (t.key && ex.memo)
            memo = (0, govmemory_1.cleanMemText)(ex.memo);
        if (!cut)
            exports.gov.history.push({ role: 'user', content: text }, { role: 'assistant', content: say }); // 끊긴 답은 기록에 남기지 않는다(다음 답이 같은 앞머리를 되풀이하지 않도록)
        return { say, ...(memo ? { memo } : {}) };
    });
    electron_1.ipcMain.handle('planetArt', async (_e, pc) => (0, planetart_1.planetPicUrl)(ctx_1.ctx.flagProv.game(), Number(pc)));
    electron_1.ipcMain.handle('govClose', async () => { closeGov(); return true; });
}
//# sourceMappingURL=gov.js.map
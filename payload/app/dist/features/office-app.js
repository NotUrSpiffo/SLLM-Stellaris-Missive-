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
exports.terminalDocked = exports.pushOffice = exports.office = void 0;
exports.officeView = officeView;
exports.setOfficeCabinet = setOfficeCabinet;
exports.setOfficeLetters = setOfficeLetters;
exports.setOfficeMemorial = setOfficeMemorial;
exports.setTerminalHook = setTerminalHook;
exports.openOffice = openOffice;
exports.closeOffice = closeOffice;
exports.registerOffice = registerOffice;
// 집무실(2026-10-18 1단계): 오버레이 「집무실」 아이콘 → 통치자 집무실의 홀로그램 바탕화면.
// 바탕화면 아이콘으로 제국 안 사람들(연락처·개인 서신·추모관)과 내치 창(총독·함대 사령부·종속국·인터뷰·연설·신문)을 연다.
// 1단계: 연락처는 앱이 이미 아는 인물(행성 총독 목록·함대 사령부의 지휘관)만. 지도자 전원 읽기·기억·편지·추모는 2단계.
const paragons_1 = require("../paragons");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const gestalt_app_1 = require("./gestalt-app");
const safe_send_1 = require("../safe-send");
const gov_1 = require("./gov");
const fleet_app_1 = require("./fleet-app");
const vassal_app_1 = require("./vassal-app");
const press_app_1 = require("./press-app");
const speech_app_1 = require("./speech-app");
const media_1 = require("./media");
const window_bounds_1 = require("../window-bounds");
const chronicle_app_1 = require("./chronicle-app");
const crisis_app_1 = require("./crisis-app");
const people_app_1 = require("./people-app");
const leader_icons_1 = require("../leader-icons");
const trait_names_1 = require("../trait-names");
const settings_ui_1 = require("./settings-ui");
const office_1 = require("../office");
exports.office = { toastGo: 'letters', win: null, rect: null, docked: null };
/** 특성 키 → 게임 지역화 이름(화면용)과 "이름: 설명"(성격을 정할 때 참고). 게임 폴더를 모르면 키를 읽기 쉽게 바꾼 이름. */
function withTraitNames(list) {
    const loc = (0, trait_names_1.traitLoc)(ctx_1.ctx.flagProv.game(), (0, settings_ui_1.selectedLanguage)() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
    return list.map((p) => (p.traits && p.traits.length ? { ...p, traits: p.traits.map((k) => (0, trait_names_1.traitLabel)(loc.names, k)), traitNotes: p.traits.map((k) => (0, trait_names_1.traitLabel)(loc.names, k) + (loc.descs[k] ? ': ' + loc.descs[k] : '')) } : p));
}
/** 파라곤(고유 영웅)이면 게임 지역화의 배경·한마디를 붙인다(2026-10-19, src/paragons.ts). 1:1 통신·말투·편지가 이걸 쓴다. */
function withParagons(list) {
    const idx = (0, paragons_1.paragonIndex)(ctx_1.ctx.flagProv.game(), (0, settings_ui_1.selectedLanguage)() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
    if (!idx.size)
        return list;
    return list.map((p) => { const g = (0, paragons_1.paragonFor)(p.name, idx); return g ? { ...p, paragon: g } : p; });
}
function officeView() {
    const sid = ctx_1.ctx.curSaveId;
    const planets = gov_1.gov.planetList && gov_1.gov.planetList.sid === sid ? gov_1.gov.planetList.planets : null;
    const groups = sid ? (0, chronicle_app_1.chron)().groups(sid, (all) => ctx_1.ctx.govMem().split(sid, all).own) : [];
    const fv = sid ? (0, fleet_app_1.fleetView)() : null;
    return {
        sid, running: ctx_1.ctx.gameRunning, empire: ctx_1.ctx.playerName || '', date: ctx_1.ctx.gameDate || '',
        crisis: (0, crisis_app_1.crisisView)(),
        planetsLoaded: !!planets,
        people: withParagons(withTraitNames((0, office_1.officePeople)(planets, fv ? fv.admirals : [], sid ? (0, people_app_1.peopleOf)(sid) : []))),
        rosterLoaded: sid ? (0, people_app_1.peopleOf)(sid).some((p) => !p.gone) : false,
        icons: (0, leader_icons_1.roleIconMasks)(ctx_1.ctx.flagProv.game()), // 게임 폴더의 직업 아이콘(실행 중에만 읽음) → 테마 색으로 칠할 가림판
        feed: (0, office_1.officeFeed)(groups, ctx_1.ctx.playerIdx, 6).map((e) => ({ ...e, text: (0, settings_ui_1.localizeNote)(e.text) })),
        gestalt: (0, gestalt_app_1.playerGestalt)(), // 단일 의식(machine·hive·gestalt) 제국이면 언론사 인터뷰·시민 청원 아이콘을 숨긴다(2026-10-19)
        letters: letterHook.count(), memorial: letterHook.memorial(), // 안 읽은 개인 서신(letters-app)·새로 이름이 오른 추모관 비석(memorial-app)
        inbox: termHook.unread(), // 외교 단말기의 안 읽은 외교 서신
        paperNew: (0, media_1.paperUnseen)(), // 책상 위 신문의 「새 호」 표시(2026-10-18)
        cabinet: cabinetHook(), // 내각 회의 준비됨(책상 태블릿·알람, 2026-10-19). null = 없음
    };
}
const push = () => (0, safe_send_1.safeSend)(exports.office.win, 'officeState', officeView());
/** 개인 서신(letters-app)이 안 읽은 편지 수를 알려 준다(가져오기 고리를 만들지 않으려고 이 방식). */
const letterHook = { count: () => 0, memorial: () => 0 };
let cabinetHook = () => null;
/** 내각 회의 준비 상태(faction-app.cabinetReady)를 main.ts 가 꽂는다(2026-10-19). */
function setOfficeCabinet(fn) { cabinetHook = fn; }
function setOfficeLetters(count) { letterHook.count = count; }
function setOfficeMemorial(count) { letterHook.memorial = count; }
const pushOffice = () => { push(); };
exports.pushOffice = pushOffice;
/** 외교 통신 단말기(본 창, windows.ts)를 집무실에 붙이는 고리. windows.ts 가 office-app 을 가져오므로 거꾸로 가져오지 않고 이렇게 받는다. */
const termHook = { win: () => null, open: () => { }, close: () => { }, unread: () => 0, restore: () => { }, back: () => { } }; // back: 집무실을 닫을 때 게임을 다시 앞으로
function setTerminalHook(h) { Object.assign(termHook, h); }
const terminalDocked = () => exports.office.docked?.app === 'terminal';
exports.terminalDocked = terminalDocked;
let termCss = null;
/** 단말기를 집무실에서 뗀다. 본 창은 닫지 않고(대화가 사라진다) 숨기고, 덧입힌 껍데기를 지우고, 원래 크기·위 순서로 돌린다(restore). */
function undockTerminal(win) {
    if (win.isDestroyed())
        return;
    const key = termCss;
    termCss = null;
    if (key)
        void win.webContents.removeInsertedCSS(key).catch(() => { });
    termHook.close();
    termHook.restore();
}
/** 붙어 있던 창을 떼어 낸다: 단말기는 숨기고, 다른 창은 닫는다. */
function release(d) {
    if (!d || d.win.isDestroyed())
        return;
    if (d.app === 'terminal')
        undockTerminal(d.win);
    else
        d.win.close();
}
/** go: 열자마자 보여 줄 화면(알림 카드의 「개인 서신」 → 'letters'). */
function openOffice(go) {
    if (exports.office.win && !exports.office.win.isDestroyed()) {
        exports.office.win.show();
        exports.office.win.focus();
        push();
        if (go)
            (0, safe_send_1.safeSend)(exports.office.win, 'officeGo', go);
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1360, Math.round(area.width * 0.86)), height: Math.min(900, Math.round(area.height * 0.9)) };
    let x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    {
        const saved = (0, window_bounds_1.restoreRect)(media_1.winBounds.get('office'), electron_1.screen.getAllDisplays().map((d) => d.workArea), { width: 900, height: 600 });
        if (saved) {
            x = saved.x;
            y = saved.y;
            sz.width = saved.width;
            sz.height = saved.height;
        }
    } // 지난번 크기·위치(2026-10-18)
    exports.office.win = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#05090c', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.office.win.setAlwaysOnTop(true, 'screen-saver', 0); // 집무실에서 연 창(총독·함대 등)이 그 위에 뜨도록 한 단계 낮게
    void exports.office.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'office.html'));
    exports.office.win.once('ready-to-show', () => { exports.office.win?.show(); push(); if (go)
        (0, safe_send_1.safeSend)(exports.office.win, 'officeGo', go); });
    exports.office.win.on('closed', () => { exports.office.win = null; exports.office.rect = null; const d = exports.office.docked; exports.office.docked = null; release(d); });
    const follow = () => { const d = exports.office.docked; if (d && !d.win.isDestroyed())
        place(d.win); };
    exports.office.win.on('move', follow);
    exports.office.win.on('resize', follow);
    {
        const w = exports.office.win, keep = () => (w.isDestroyed() ? null : w.getBounds());
        w.on('move', () => media_1.winBounds.later('office', keep));
        w.on('resize', () => media_1.winBounds.later('office', keep));
        w.on('close', () => { const b = keep(); if (b)
            media_1.winBounds.set('office', b); });
    }
}
function closeOffice() { if (exports.office.win && !exports.office.win.isDestroyed()) {
    if (exports.office.win.isFocused() || exports.office.docked?.win.isFocused())
        termHook.back();
    exports.office.win.close();
} }
// ---- 집무실 컴퓨터 안에서 열기(2026-10-18): 집무실에서 연 창은 따로 뜨지 않고 홀로그램 화면의 본문 자리에 꼭 맞춰 붙는다.
// 기능 창의 html 은 고치지 않는다: 자리·크기를 맞추고, 홀로그램 껍데기 CSS(주사선·유리 배경·끌기 막기)를 덧입힌다.
// 홀로그램 머리줄(제국·날짜·「‹ 바탕화면」)은 집무실 쪽에 그대로 남는다. 붙은 창을 닫으면 바탕화면으로 돌아온다.
const appWin = (app) => ({ gov: gov_1.gov.win, fleet: fleet_app_1.fleet.win, vassal: vassal_app_1.vassal.win, press: press_app_1.press.win, speech: speech_app_1.speech.win, paper: media_1.media.paperWin, terminal: termHook.win() }[app] ?? null);
function place(win) {
    if (!exports.office.win || exports.office.win.isDestroyed() || !exports.office.rect)
        return;
    const b = (0, office_1.dockBounds)(exports.office.win.getContentBounds(), exports.office.rect);
    win.setMinimumSize(320, 240);
    win.setMaximumSize(10000, 10000); // 창마다 걸린 최소·최대 크기를 풀어야 홀로그램 자리에 맞출 수 있다
    win.setBounds(b);
}
function skin(app, win, glass) {
    // 집무실에서 새로 연 투명 창: 바탕·판 색만 반투명 유리로(글자는 선명), 신문은 종이를 비우고 글자를 밝게. 이미 열려 있던 불투명 창은 주사선·테두리만.
    const css = office_1.OFFICE_SKIN + (glass ? (app === 'paper' ? office_1.OFFICE_SKIN_PAPER : app === 'terminal' ? office_1.OFFICE_GLASS_TERM : office_1.OFFICE_GLASS) : '');
    // 단말기는 떼어 낸 뒤에도 계속 쓰는 창이라 덧입힌 CSS 열쇠를 기억했다가 지운다
    const put = () => { if (!win.isDestroyed())
        void win.webContents.insertCSS(css).then((k) => { if (app === 'terminal') {
            if ((0, exports.terminalDocked)())
                termCss = k;
            else
                void win.webContents.removeInsertedCSS(k).catch(() => { });
        } }).catch(() => { }); };
    if (win.webContents.isLoading())
        win.webContents.once('did-finish-load', put);
    else
        put();
}
function dock(app, glass) {
    const win = appWin(app);
    if (!win || win.isDestroyed() || !exports.office.win || exports.office.win.isDestroyed())
        return;
    const prev = exports.office.docked;
    if (prev && prev.win !== win)
        release(prev); // 한 번에 하나만
    if (prev && prev.win === win) {
        (0, safe_send_1.safeSend)(exports.office.win, 'officeDocked', app);
        place(win);
        return;
    } // 이미 붙어 있음
    exports.office.docked = { app, win };
    win.setAlwaysOnTop(true, 'screen-saver', 1);
    place(win);
    skin(app, win, glass);
    win.once('show', () => place(win)); // 창이 스스로 자리를 잡은 뒤에도 다시 맞춘다
    if (app === 'terminal') {
        // 단말기는 닫지 않고 숨긴다(✕·단축키·트레이) → 숨으면 집무실 바탕화면으로 돌아온다
        const off = () => { if (exports.office.docked?.win === win) {
            exports.office.docked = null;
            undockTerminal(win);
            (0, safe_send_1.safeSend)(exports.office.win, 'officeDocked', null);
        } };
        win.once('hide', off);
    }
    else
        win.once('closed', () => { if (exports.office.docked?.win === win) {
            exports.office.docked = null;
            (0, safe_send_1.safeSend)(exports.office.win, 'officeDocked', null);
        } });
    (0, safe_send_1.safeSend)(exports.office.win, 'officeDocked', app);
}
/** 바탕화면 아이콘이 여는 기존 창. 연락처·서신·추모는 집무실 안에서 열리므로 여기 없다. */
function launch(app, arg) {
    const was = appWin(app);
    const fresh = !was || was.isDestroyed(); // 이미 열려 있던 창은 불투명 그대로 붙인다(닫았다 열면 진행 중인 청문회 등이 끊긴다)
    switch (app) {
        case 'gov':
            (0, gov_1.openGov)(arg || undefined, true);
            break;
        case 'fleet':
            (0, fleet_app_1.openFleet)(true);
            break;
        case 'vassal':
            (0, vassal_app_1.openVassal)(true);
            break;
        case 'press':
            (0, press_app_1.openPress)(true);
            break;
        case 'speech':
            (0, speech_app_1.openSpeech)(true);
            break;
        case 'paper':
            (0, media_1.openPaper)(true);
            dock(app, true);
            return true; // 신문은 지면이 다르면 새로 만들므로 늘 유리 껍데기(디스플레이 지면)
        case 'terminal':
            termHook.open();
            dock(app, true);
            return true; // 단말기는 늘 떠 있는 본 창이라 언제나 유리 껍데기를 덧입힌다
        default: return false;
    }
    dock(app, fresh);
    return true;
}
function registerOffice() {
    (0, people_app_1.onPeopleChanged)(() => { if (exports.office.win && !exports.office.win.isDestroyed())
        push(); });
    media_1.paperHooks.changed = () => { if (exports.office.win && !exports.office.win.isDestroyed())
        push(); }; // 새 신문이 나오거나 읽으면 책상 신문 표시를 고친다
    electron_1.ipcMain.handle('officeState', async () => officeView());
    electron_1.ipcMain.handle('officeClose', async () => { closeOffice(); return true; });
    electron_1.ipcMain.handle('officeOpen', async (_e, app, arg) => (office_1.OFFICE_APPS.includes(app) ? launch(app, typeof arg === 'string' ? arg.slice(0, 80) : undefined) : false));
    electron_1.ipcMain.handle('officeRect', async (_e, r) => { const v = r; if (v && [v.x, v.y, v.w, v.h].every((n) => Number.isFinite(n)) && v.w > 50 && v.h > 50) {
        exports.office.rect = { x: v.x, y: v.y, w: v.w, h: v.h };
        const d = exports.office.docked;
        if (d && !d.win.isDestroyed())
            place(d.win);
    } return true; });
    electron_1.ipcMain.handle('officeBack', async () => { const d = exports.office.docked; exports.office.docked = null; release(d); (0, safe_send_1.safeSend)(exports.office.win, 'officeDocked', null); return true; });
    electron_1.ipcMain.handle('officePlanets', async () => { const r = await (0, gov_1.refreshPlanets)(); push(); return r && 'error' in r ? { ok: false, error: r.error } : { ok: true }; });
}
//# sourceMappingURL=office-app.js.map
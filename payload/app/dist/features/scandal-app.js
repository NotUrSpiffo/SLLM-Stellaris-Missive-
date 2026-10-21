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
exports.scandal = void 0;
exports.openScandal = openScandal;
exports.registerScandal = registerScandal;
// 비방 공작 → 신문 스캔들(2026-10-20 알파 9 ③) — 앱 쪽. 규칙: src/scandal.ts, 화면: ui/scandal.html.
// 모드 SPYOP(type=smear) → gamestate-app 의 onGameSpyOp → 여기.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const i18n_pick_1 = require("../i18n-pick");
const music_1 = require("../music");
const gamestate_app_1 = require("./gamestate-app");
const chronicle_app_1 = require("./chronicle-app");
const media_1 = require("./media");
const mood_app_1 = require("./mood-app");
const debate_app_1 = require("./debate-app");
const radio_app_1 = require("./radio-app");
const press_app_1 = require("./press-app"); // 추문 기자회견 = 실제 인터뷰(2026-10-20)
const espionage_app_1 = require("./espionage-app"); // 의혹 보도 → 상대 제국의 해명 요구(청문회)
const safe_send_1 = require("../safe-send");
const scandal_1 = require("../scandal");
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_scandal.json');
let store = null;
function all() { if (store)
    return store; try {
    store = (0, scandal_1.sanitizeScandal)(JSON.parse(fs.readFileSync(file(), 'utf8')));
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'scandal', error: e });
    store = (0, scandal_1.sanitizeScandal)({});
} return store; }
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'scandal', error: e });
} }
const listOf = () => (ctx_1.ctx.curSaveId ? (all().saves[(0, music_1.safeKey)(ctx_1.ctx.curSaveId)] ??= []) : []);
exports.scandal = { cur: null, win: null };
const me = () => ctx_1.ctx.playerName || (0, i18n_pick_1.L)('우리 정부', 'our government');
function onSmear(s) {
    const list = listOf();
    if (!ctx_1.ctx.curSaveId || list.some((x) => x.id === s.id))
        return;
    list.push(s);
    if (list.length > 30)
        list.splice(0, list.length - 30);
    save();
    const date = s.date || ctx_1.ctx.gameDate || '';
    if (s.side === 'against') {
        const line = (0, i18n_pick_1.L)(`${date} [추문] 출처를 알 수 없는 문서가 퍼지며 ${me()} 정부가 외국 정부를 모욕·기만했다는 의혹이 제기됐다. 문서는 위조로 보이지만 파문이 커지고 있다.`, `${date} [Scandal] Anonymous documents claim officials of ${me()} insulted and deceived foreign governments. The papers look forged, but the uproar is growing.`);
        (0, chronicle_app_1.chronNoteWorld)(line, true);
        (0, media_1.noteExtra)('scandal', date, line);
        (0, mood_app_1.moodNudge)(scandal_1.SCANDAL_MOOD.hit, (0, i18n_pick_1.L)('정부 추문 보도', 'Government scandal in the press'));
        exports.scandal.cur = s;
        ctx_1.ctx.notify({ kind: 'scandal', title: (0, i18n_pick_1.L)('우리 정부를 둘러싼 추문이 보도되고 있습니다 — 대응하시겠습니까?', 'A scandal about our government is in the press — how will you respond?'), body: (0, i18n_pick_1.L)('기자회견·라디오 반박·무시 중에서 고를 수 있습니다. 대응에 따라 민심이 달라집니다.', 'Hold a press conference, rebut it on the radio, or ignore it. Public mood depends on your answer.'), action: (0, i18n_pick_1.L)('대응하기', 'Respond') });
    }
    else {
        const line = (0, i18n_pick_1.L)(`${date} [추문] ${s.other} 정부가 외국 정부를 모욕·기만했다는 문서가 은하 언론에 퍼졌다. ${s.other} 정부는 위조라고 반발했다.`, `${date} [Scandal] Documents claiming the government of ${s.other} insulted and deceived foreign governments spread through the galactic press. ${s.other} calls them forgeries.`);
        (0, chronicle_app_1.chronNoteWorld)(line, true);
        (0, media_1.noteExtra)('scandal', date, line);
        if (s.exposed) {
            const ex = (0, i18n_pick_1.L)(`${date} [의혹] 일부 언론은 ${s.other} 추문 뒤에 ${me()} 첩보 기관이 있다는 의혹을 제기했다.`, `${date} [Allegation] Some outlets suggest the intelligence service of ${me()} was behind the ${s.other} scandal.`);
            (0, chronicle_app_1.chronNoteWorld)(ex, true);
            (0, mood_app_1.moodNudge)(scandal_1.SCANDAL_MOOD.exposed, (0, i18n_pick_1.L)('비방 공작 개입 의혹', 'Alleged smear campaign'));
            (0, debate_app_1.debateOn)('smear_ok', `${s.other}: ${ex}`, date);
            (0, espionage_app_1.openGameHearing)({ opponent: s.other, operation: (0, i18n_pick_1.L)('비방 공작', 'Smear campaign'), facts: [ex.replace(/^\S+\s/, ''), (0, i18n_pick_1.L)(`${s.other} 정부를 겨냥한 위조 문서가 은하 언론에 퍼졌다.`, `Forged documents targeting the government of ${s.other} spread through the galactic press.`)], key: 'smear|' + s.id });
        }
    }
    (0, diagnostics_1.logDiagnostic)('info', 'scandal.smear', { side: s.side, exposed: s.exposed });
}
/** 플레이어의 대응. 성명문은 기자회견·라디오 반박에만(비우면 짧은 기본 문구). */
async function respond(rIn, textIn) {
    const s = exports.scandal.cur;
    if (!s)
        return { ok: false, error: (0, i18n_pick_1.L)('대응할 추문이 없습니다.', 'There is no scandal to respond to.') };
    const r = rIn === 'press' || rIn === 'radio' ? rIn : 'ignore';
    if (r === 'press') { // 실제 인터뷰 화면: 추문 한 주제. 끝나면 pressDone 이 결과로 마무리한다.
        const err = (0, press_app_1.openScandalPress)({ sid: ctx_1.ctx.curSaveId || '', id: s.id, suspect: s.other, date: s.date, done: (good) => pressDone(s, good) });
        return err ? { ok: false, error: err } : { ok: true };
    }
    const text = r === 'ignore' ? '' : (typeof textIn === 'string' ? textIn.replace(/\s+/g, ' ').trim().slice(0, 600) : '') || (0, i18n_pick_1.L)('정부는 근거 없는 위조 문서에 흔들리지 않을 것입니다.', 'The government will not be shaken by baseless forged documents.');
    const rec = listOf().find((x) => x.id === s.id);
    if (rec) {
        rec.resp = r;
        rec.text = text;
        save();
    }
    const date = ctx_1.ctx.gameDate || s.date;
    const line = r === 'radio' ? (0, i18n_pick_1.L)(`${date} ${me()} 정부, 국영 라디오로 추문 반박: "${text}"`, `${date} ${me()} rebuts the scandal on state radio: "${text}"`)
        : (0, i18n_pick_1.L)(`${date} ${me()} 정부는 추문에 아무 대응도 하지 않았다. 소문은 가라앉지 않고 있다.`, `${date} ${me()} has not responded to the scandal. The rumors are not dying down.`);
    (0, chronicle_app_1.chronNoteWorld)(line, true);
    if (r === 'radio' && radio_app_1.radio.on) {
        radio_app_1.radio.q.push({ kind: 'scandal', date, text: line, n: Date.now() % 1e9, id: 'scandal|' + s.id });
        (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioQueue', radio_app_1.radio.q.size);
    } // 다음 방송의 화제로
    (0, mood_app_1.moodNudge)((0, scandal_1.respMood)(r), r === 'radio' ? (0, i18n_pick_1.L)('추문 라디오 반박', 'Scandal radio rebuttal') : (0, i18n_pick_1.L)('추문 무시', 'Scandal ignored'));
    (0, debate_app_1.debateOn)('smeared', line, date); // 라디오 찬반 논평 알림
    exports.scandal.cur = null;
    (0, diagnostics_1.logDiagnostic)('info', 'scandal.respond', { resp: r });
    return { ok: true };
}
/** 추문 기자회견이 끝났다(인터뷰 평가). 호평이면 +6, 아니면 −4. */
function pressDone(s, good) {
    const rec = listOf().find((x) => x.id === s.id);
    if (rec) {
        rec.resp = 'press';
        rec.text = good ? 'good' : 'bad';
        save();
    }
    const date = ctx_1.ctx.gameDate || s.date;
    const line = good ? (0, i18n_pick_1.L)(`${date} ${me()} 지도자가 긴급 기자회견에서 추문을 해명했다. 언론은 해명이 설득력 있다고 평가했다.`, `${date} The leader of ${me()} addressed the scandal at an emergency press conference. The press found the explanation convincing.`)
        : (0, i18n_pick_1.L)(`${date} ${me()} 지도자가 긴급 기자회견을 열었지만 해명은 설득력이 없었다는 평가가 나왔다.`, `${date} The leader of ${me()} held an emergency press conference, but the explanation was judged unconvincing.`);
    (0, chronicle_app_1.chronNoteWorld)(line, true);
    (0, mood_app_1.moodNudge)((0, scandal_1.respMood)('press', good), good ? (0, i18n_pick_1.L)('추문 기자회견 호평', 'Scandal press conference well received') : (0, i18n_pick_1.L)('추문 기자회견 실패', 'Scandal press conference fell flat'));
    (0, debate_app_1.debateOn)('smeared', line, date);
    if (exports.scandal.cur && exports.scandal.cur.id === s.id)
        exports.scandal.cur = null;
    (0, diagnostics_1.logDiagnostic)('info', 'scandal.press', { good });
}
function openScandal() {
    if (!exports.scandal.cur)
        return;
    if (exports.scandal.win && !exports.scandal.win.isDestroyed()) {
        exports.scandal.win.show();
        exports.scandal.win.focus();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea, w = Math.min(760, Math.round(area.width * 0.7)), h = Math.min(600, Math.round(area.height * 0.8));
    exports.scandal.win = new electron_1.BrowserWindow({ width: w, height: h, x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + (area.height - h) / 2), resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.scandal.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.scandal.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'scandal.html'));
    exports.scandal.win.once('ready-to-show', () => exports.scandal.win?.show());
    exports.scandal.win.on('closed', () => { exports.scandal.win = null; });
}
function registerScandal() {
    (0, gamestate_app_1.onGameSpyOp)((op) => { const s = (0, scandal_1.scandalFrom)(op, ctx_1.ctx.playerName, Math.random()); if (s)
        onSmear(s); });
    electron_1.ipcMain.handle('scandalState', async () => {
        const s = exports.scandal.cur;
        if (!s)
            return null;
        return { date: s.date, suspect: s.other, empire: me(), mood: { hit: scandal_1.SCANDAL_MOOD.hit, pressGood: scandal_1.SCANDAL_MOOD.pressGood, pressBad: scandal_1.SCANDAL_MOOD.pressBad, radio: scandal_1.SCANDAL_MOOD.radio, ignore: scandal_1.SCANDAL_MOOD.ignore }, radioOn: radio_app_1.radio.on };
    });
    electron_1.ipcMain.handle('scandalRespond', async (_e, r, t) => respond(r, t));
    electron_1.ipcMain.handle('scandalClose', async () => { if (exports.scandal.win && !exports.scandal.win.isDestroyed())
        exports.scandal.win.close(); return true; });
}
//# sourceMappingURL=scandal-app.js.map
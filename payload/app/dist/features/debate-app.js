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
exports.pendingDebates = pendingDebates;
exports.debateOn = debateOn;
exports.playDebate = playDebate;
exports.registerDebate = registerDebate;
// 라디오 찬반 논평(2026-10-20 알파 10 ②, 라디오 전용). 규칙: src/debate.ts.
// 부르는 곳: 전쟁 선언문 발표(declare-app), 남의 전쟁에 우리 성명(condemn-app), 은하 공동체의 규탄(condemn-app).
// 사건이 나면 "찬성파와 반대파의 논평이 진행중입니다" 알림만 띄운다(AI 호출 없음). 알림이나 라디오 창의 [듣기]를 누르면
// 라디오를 켜고(꺼져 있었으면) 그때 AI 를 한 번 불러 진행자·찬성 의원·반대 의원의 대담 8줄을 방송한다. 신문·집무실에는 싣지 않는다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const gamestate_app_1 = require("./gamestate-app");
const radio_app_1 = require("./radio-app");
const settings_1 = require("../app/settings");
const safe_send_1 = require("../safe-send");
const aiclient_1 = require("../aiclient");
const music_1 = require("../music");
const namegen_app_1 = require("./namegen-app"); // 의원 이름: 게임 이름 표(우리 제국 종족 비율)
const debate_1 = require("../debate");
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_debate.json');
let store = null;
function all() { if (store)
    return store; try {
    store = (0, debate_1.sanitizeDebate)(JSON.parse(fs.readFileSync(file(), 'utf8')));
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'debate', error: e });
    store = (0, debate_1.sanitizeDebate)({});
} return store; }
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'debate', error: e });
} }
const listOf = (sid = ctx_1.ctx.curSaveId) => (sid ? (all().saves[(0, music_1.safeKey)(sid)] ??= []) : []);
/** 아직 듣지 않은 논평(최근 것부터, 최대 3건). 라디오 창의 알림 줄에 보인다. */
function pendingDebates() {
    return listOf().filter((d) => !d.aired).slice(-3).reverse().map((d) => ({ id: d.id, date: d.date, topic: d.topic, pro: d.pro.faction, con: d.con.faction }));
}
const pushPending = () => (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioDebates', { list: pendingDebates(), alarm: all().alarm });
/** 큰 사건 하나에 찬반 논평 알림을 건다. 파벌이 없거나(군체·기계) 찬성·반대 어느 한쪽이 없으면 조용히 넘어간다. */
function debateOn(kind, topic, date = ctx_1.ctx.gameDate || '') {
    const snap = gamestate_app_1.gameState.last, sides = (0, debate_1.pickSides)(kind, snap?.factions, !!snap?.gestalt);
    if (!sides || !ctx_1.ctx.curSaveId)
        return;
    const list = listOf(), id = kind + '|' + date + '|' + topic.slice(0, 60);
    if (list.some((d) => d.id === id))
        return;
    const g = (0, debate_1.debateGenders)(Math.random()), nm = (x) => (0, namegen_app_1.gameName)(x) || (0, debate_1.randomName)();
    const d = { id, date, kind, topic: topic.slice(0, 300), lines: [], aired: false,
        pro: { faction: sides.pro.name, ethic: sides.pro.ethic, support: sides.pro.support, gender: g.pro, name: nm(g.pro) },
        con: { faction: sides.con.name, ethic: sides.con.ethic, support: sides.con.support, gender: g.con, name: nm(g.con) } };
    list.push(d);
    if (list.length > 20)
        list.splice(0, list.length - 20);
    save();
    pushPending();
    if (all().alarm)
        ctx_1.ctx.notify({ kind: 'debate', title: (0, settings_ui_1.pick)('찬성파와 반대파의 논평이 진행중입니다.', 'For and against: a debate is on the air.'), body: `${d.pro.faction} ↔ ${d.con.faction} — ${d.topic.slice(0, 120)}`, action: (0, settings_ui_1.pick)('라디오로 듣기', 'Listen on the radio') });
    (0, diagnostics_1.logDiagnostic)('info', 'debate.pending', { kind, pro: d.pro.ethic, con: d.con.ethic });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let playing = false;
/** 논평 한 편을 라디오로 내보낸다(id 가 없으면 가장 최근 미청취 논평). 라디오가 꺼져 있으면 켠다. */
async function playDebate(id) {
    const sid = ctx_1.ctx.curSaveId, list = listOf(sid), d = id ? list.find((x) => x.id === id) : list.filter((x) => !x.aired).pop();
    if (!d || !sid)
        return { ok: false, error: (0, settings_ui_1.pick)('들을 논평이 없습니다.', 'There is no debate to listen to.') };
    if (playing)
        return { ok: false, error: (0, settings_ui_1.pick)('논평을 준비하고 있습니다.', 'The debate is being prepared.') };
    playing = true;
    try {
        if (!radio_app_1.radio.on)
            (0, radio_app_1.setRadio)(true);
        for (let i = 0; i < 90 && radio_app_1.radio.busy; i++)
            await sleep(1000); // 정규 방송을 만드는 중이면 끝날 때까지
        if (!radio_app_1.radio.on || radio_app_1.radio.busy)
            return { ok: false, error: (0, settings_ui_1.pick)('라디오가 바쁩니다. 잠시 뒤 다시 눌러 주세요.', 'The radio is busy. Try again shortly.') };
        const station = (0, radio_app_1.configuredStation)(settings_1.settings.radioStation), session = radio_app_1.radio.session;
        radio_app_1.radio.busy = true;
        (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioWorking', true);
        try {
            if (!d.pro.name)
                d.pro.name = (0, namegen_app_1.gameName)(d.pro.gender) || (0, debate_1.randomName)();
            if (!d.con.name)
                d.con.name = (0, namegen_app_1.gameName)(d.con.gender) || (0, debate_1.randomName)(); // 옛 기록
            if (!d.lines.length) {
                const msgs = (0, debate_1.debateMessages)(ctx_1.ctx.playerName || 'the player empire', d, station.announcer, station.name);
                let p = (0, debate_1.parseDebate)(await ctx_1.ctx.ai.chat(msgs, { purpose: 'debate', json: true, maxTokens: 1600 }));
                if (!p)
                    p = (0, debate_1.parseDebate)(await ctx_1.ctx.ai.chat([...msgs, { role: 'user', content: 'Rewrite it. I need complete JSON with exactly 8 lines in the order announcer, pro, con, pro, con, pro, con, announcer.' }], { purpose: 'debate', json: true, maxTokens: 1600 }));
                if (!p) {
                    (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioError', (0, settings_ui_1.pick)('찬반 논평 대본을 완성하지 못했습니다. 다시 눌러 주세요.', 'Could not complete the debate script. Please try again.'));
                    return { ok: false };
                }
                d.lines = p.lines;
                d.station = station.name;
            }
            if (session !== radio_app_1.radio.session || sid !== ctx_1.ctx.curSaveId)
                return { ok: false };
            for (let i = 0; i < 20 && radio_app_1.radio.win && radio_app_1.radio.win.webContents.isLoading(); i++)
                await sleep(250); // 방금 켠 창이 다 뜰 때까지
            d.aired = true;
            save();
            const names = { announcer: station.announcer, pro: d.pro.name, con: d.con.name };
            (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioBroadcast', { debate: true, date: d.date, lines: d.lines, station: station.name, parent: station.parent, names, factions: { pro: d.pro.faction, con: d.con.faction }, voice: { pro: (0, debate_1.voiceOf)(d.pro.gender), con: (0, debate_1.voiceOf)(d.con.gender) }, topic: d.topic });
            pushPending();
            (0, diagnostics_1.logDiagnostic)('info', 'debate.aired', { kind: d.kind });
            return { ok: true };
        }
        catch (e) {
            (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioError', (0, aiclient_1.redactKey)(e.message));
            return { ok: false };
        }
        finally {
            radio_app_1.radio.busy = false;
            radio_app_1.radio.lastEnd = Date.now();
            (0, safe_send_1.safeSend)(radio_app_1.radio.win, 'radioWorking', false);
            (0, radio_app_1.pushRadioState)();
        }
    }
    finally {
        playing = false;
    }
}
function registerDebate() {
    electron_1.ipcMain.handle('radioDebates', async () => ({ list: pendingDebates(), alarm: all().alarm }));
    electron_1.ipcMain.handle('radioDebatePlay', async (_e, id) => playDebate(typeof id === 'string' ? id : undefined));
    electron_1.ipcMain.handle('radioDebateAlarm', async (_e, on) => { all().alarm = on !== false; save(); return { alarm: all().alarm }; });
}
//# sourceMappingURL=debate-app.js.map
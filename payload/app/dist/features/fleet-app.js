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
exports.fleet = void 0;
exports.fleetView = fleetView;
exports.openFleet = openFleet;
exports.closeFleet = closeFleet;
exports.registerFleet = registerFleet;
// 함대 사령부(앱 쪽, 2026-10-17) — 제독 전투 기록(최근 3건)과 청문회(기자회견·직접 대면). 순수 로직은 src/fleet.ts.
// 라디오와 겹치지 않게 전용 on_actions·이벤트(sllm_fleet)와 전용 로그 자리(FLEET 246)만 쓴다.
const office_1 = require("../office");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const fleet_1 = require("../fleet");
const aiclient_1 = require("../aiclient");
const diagnostics_1 = require("../diagnostics");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const safe_send_1 = require("../safe-send");
const chronicle_app_1 = require("./chronicle-app");
const terminal_1 = require("./terminal");
const settings_ui_1 = require("./settings-ui");
const speciesClass_1 = require("../speciesClass");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-18)
exports.fleet = { win: null, busy: false, hearing: null, collector: new fleet_1.BattleCollector() };
let storeInst = null;
const store = () => (storeInst ??= new fleet_1.FleetStore(path.join(electron_1.app.getPath('userData'), 'sllm_fleet.json')));
const admirals = () => (ctx_1.ctx.curSaveId ? store().get(ctx_1.ctx.curSaveId).admirals : {});
const curHearing = () => (exports.fleet.hearing && exports.fleet.hearing.sid === ctx_1.ctx.curSaveId ? exports.fleet.hearing : null);
function fleetView() {
    const list = Object.values(admirals()).sort((a, b) => (b.battles.at(-1)?.date ?? '').localeCompare(a.battles.at(-1)?.date ?? '') || a.name.localeCompare(b.name, 'ko'));
    const h = curHearing()?.h ?? null;
    return { sid: ctx_1.ctx.curSaveId, running: ctx_1.ctx.gameRunning, busy: exports.fleet.busy, empire: ctx_1.ctx.playerName, cls: (0, speciesClass_1.classKey)(ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.cls) ?? 'human', // 지휘관 초상화 = 플레이어 종족 계열(2026-10-18)
        keep: fleet_1.KEEP_BATTLES, faceTurns: fleet_1.FACE_TURNS, xp: fleet_1.ADM_XP, textMax: fleet_1.TEXT_MAX,
        admirals: list.map((a) => ({ ...a, canHear: (0, fleet_1.canHear)(a), battles: a.battles.map((b) => ({ ...b, text: (0, fleet_1.battleText)(b) })) })),
        hearing: h ? { ...h, good: (0, fleet_1.goodCount)(h), ready: (0, fleet_1.readyToJudge)(h), cases: h.cases.map((c) => ({ ...c, text: (0, fleet_1.battleText)(c.battle) })) } : null };
}
const push = () => (0, safe_send_1.safeSend)(exports.fleet.win, 'fleetState', fleetView());
function openFleet(glass = false) {
    if (exports.fleet.win && !exports.fleet.win.isDestroyed()) {
        exports.fleet.win.show();
        exports.fleet.win.focus();
        push();
        return;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1300, Math.round(area.width * 0.84)), height: Math.min(900, Math.round(area.height * 0.88)) };
    const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
    exports.fleet.win = new electron_1.BrowserWindow({ ...sz, x, y, minWidth: 860, minHeight: 560, frame: false, show: false, backgroundColor: '#06141b', ...(0, office_1.glassWin)(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.fleet.win.setAlwaysOnTop(true, 'screen-saver', 1);
    void exports.fleet.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'fleet.html'));
    exports.fleet.win.once('ready-to-show', () => { exports.fleet.win?.show(); push(); });
    // 청문회 도중 창을 닫으면 남은 전투는 나쁨으로 보고 결과를 확정한다(첩보 청문회와 같은 규칙).
    exports.fleet.win.on('close', () => { const c = curHearing(); if (c && !c.h.done) {
        c.h = (0, fleet_1.abandon)(c.h);
        void applyOutcome(c);
    } });
    exports.fleet.win.on('closed', () => { exports.fleet.win = null; });
}
function closeFleet() { if (exports.fleet.win && !exports.fleet.win.isDestroyed())
    exports.fleet.win.close(); }
function profile(name) { return name ? `${name}` : ''; }
/** 끝난 청문회 결과를 게임에 건다(무난이면 보낼 것 없음). 보내기 전에 기록, 응답이 없어도 다시 보내지 않는다. 끝나면 그 제독의 전투 기록을 비운다(다음 청문회는 새 전투 3건). */
async function applyOutcome(c) {
    const h = c.h;
    if (!h.done || h.applied)
        return;
    const a = store().get(c.sid).admirals[String(h.lid)], date = ctx_1.ctx.gameDate;
    const finish = (msg) => { h.applied = msg; if (a) {
        a.battles = [];
        a.hearings++;
        a.notified = false;
        if (h.outcome === 'acclaimed' || h.outcome === 'reprimanded') {
            a.status = h.outcome;
            a.statusDate = date;
        }
    } store().save(); push(); };
    if (h.outcome === 'neutral') {
        finish(L('무난: 좋음 2건 · 효과 없음', 'Neutral: 2 good · no effect'));
        return;
    }
    if (!/^\d+$/.test(c.sid) || c.sid !== ctx_1.ctx.curSaveId || !ctx_1.ctx.gameRunning) {
        finish(L('게임이 꺼져 있거나 세이브가 바뀌어 적용하지 않았습니다.', 'Not applied: game closed or save changed.'));
        return;
    }
    const cid = (0, crypto_1.randomUUID)().replace(/-/g, ''), req = ++game_link_1.link.reqCounter;
    h.applied = L('게임에 적용하는 중…', 'Applying in game…');
    if (a) {
        a.battles = [];
        store().save();
    } // 보내기 전에 이 전투 기록을 비워 둔다: 응답 전에 앱이 꺼져도 같은 전투로 청문회를 다시 열어 두 번 적용하지 않게(2026-10-18)
    push();
    let status = 'uncertain';
    try {
        const r = await (0, terminal_1.terminalRequest)((0, fleet_1.admiralApplyCommand)(req, c.sid, cid, h.lid, h.outcome), 'ADMAPPLY', req);
        if (r.kv.cid === cid && r.kv.sid === c.sid)
            status = r.kv.status ?? 'uncertain';
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'fleet.apply.failed', { error: String(e) });
    }
    const acc = h.outcome === 'acclaimed';
    const msg = status === 'applied' ? (acc ? L(`추앙: 함대 무기 피해·지상군 피해 +5% (1년) · 경험치 +${fleet_1.ADM_XP}`, `Acclaimed: fleet weapon & army damage +5% (1 yr) · XP +${fleet_1.ADM_XP}`) : L('질책: 함대·지상군 피해 −5% · 감봉(유지비 −25%) (1년)', 'Reprimanded: fleet & army damage −5% · pay cut (upkeep −25%) (1 yr)'))
        : status === 'no_target' ? L('게임에서 이 지휘관을 찾지 못해 적용하지 않았습니다.', 'This commander was not found in game; nothing applied.')
            : status === 'duplicate' ? L('이미 적용한 결정입니다.', 'Already applied.')
                : L('게임 적용을 확인하지 못했습니다(자동 재전송 없음).', 'Could not confirm in game (no automatic resend).');
    if (status === 'applied')
        (0, chronicle_app_1.chronNoteWorld)(L(`지휘관 ${h.name}이(가) ${h.mode === 'press' ? '기자회견' : '지도자 대면'} 청문회에서 ${acc ? '추앙받았다' : '질책받았다'} (${date})`, `Commander ${h.name} was ${acc ? 'honored' : 'reprimanded'} at a ${h.mode === 'press' ? 'press conference' : 'face-to-face'} hearing (${date})`), false);
    finish(msg);
    (0, diagnostics_1.logDiagnostic)('info', 'fleet.hearing', { outcome: h.outcome, status, mode: h.mode });
}
const guard = (e) => !!exports.fleet.win && e.sender === exports.fleet.win.webContents;
function registerFleet(router) {
    router.on(log_router_1.SLOT.FLEET, 'fleet:battle', (m) => {
        if (m.kind === 'ADMAPPLY') {
            terminal_1.terminalReplies.get('ADMAPPLY:' + m.kv.req)?.(m);
            return;
        }
        if (m.kind === 'ADMEXPIRE') {
            const a = Object.values(admirals()).find((x) => String(x.lid) === m.kv.lid);
            if (a) {
                a.status = 'none';
                store().save();
                push();
            }
            return;
        }
        const b = exports.fleet.collector.feed(m);
        if (!b || !ctx_1.ctx.curSaveId)
            return;
        const a = (0, fleet_1.addBattle)(store().get(ctx_1.ctx.curSaveId).admirals, b);
        if (!a)
            return;
        if ((0, fleet_1.canHear)(a) && !a.notified) {
            a.notified = true;
            ctx_1.ctx.notify({ kind: 'fleet', title: L(`지휘관 ${a.name}: 전투 기록 ${fleet_1.KEEP_BATTLES}건`, `Commander ${a.name}: ${fleet_1.KEEP_BATTLES} battles on record`), body: L('청문회를 열 수 있습니다.', 'A hearing can now be held.'), action: L('함대 사령부', 'Fleet Command') });
        }
        store().save();
        push();
    });
    electron_1.ipcMain.handle('fleetState', async () => fleetView());
    electron_1.ipcMain.handle('fleetClose', async (e) => { if (!guard(e))
        return false; closeFleet(); return true; });
    electron_1.ipcMain.handle('fleetHearing', async (e, lid, mode) => {
        if (!guard(e))
            return { ok: false, error: L('함대 사령부 창에서만 열 수 있습니다.', 'Can only be opened from the Fleet Command window.') };
        if (exports.fleet.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        const c = curHearing();
        if (c && !c.h.done)
            return { ok: false, error: L('진행 중인 청문회가 있습니다.', 'A hearing is already in progress.') };
        if (mode !== 'press' && mode !== 'face')
            return { ok: false, error: L('청문 방식을 고르세요.', 'Choose a hearing format.') };
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 청문회를 열 수 있습니다.', 'The game must be running to hold a hearing.') };
        const a = admirals()[String(lid)];
        try {
            exports.fleet.hearing = { sid: ctx_1.ctx.curSaveId, h: (0, fleet_1.newHearing)(a, mode) };
            push();
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
    /** 기자회견: 지금 전투의 공방 4줄을 만들고 바로 평가한다. */
    electron_1.ipcMain.handle('fleetPressNext', async (e) => {
        if (!guard(e))
            return { ok: false, error: L('함대 사령부 창에서만 진행할 수 있습니다.', 'Can only be done from the Fleet Command window.') };
        const c = curHearing();
        if (!c || c.h.done || c.h.mode !== 'press')
            return { ok: false, error: L('진행 중인 기자회견이 없습니다.', 'No press conference in progress.') };
        if (exports.fleet.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        exports.fleet.busy = true;
        push();
        try {
            const h0 = c.h;
            let h = h0, lines = null;
            for (let i = 0; i < 2 && !lines; i++) {
                try {
                    lines = (0, fleet_1.parsePressRound)(await ctx_1.ctx.ai.chat((0, fleet_1.pressRoundMessages)(ctx_1.ctx.playerName, h, profile(h.name)), { purpose: 'fleet-press', json: true, maxTokens: 1400 * (i + 1) }));
                }
                catch (err) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'fleet-press', attempt: i + 1, error: String(err) });
                }
            }
            if (!lines)
                return { ok: false, error: L('기자회견 공방을 만들지 못했습니다. 다시 눌러 주세요.', 'Could not generate the press exchange. Press again.') };
            // AI 를 기다리는 동안 창을 닫아 청문회가 끝났으면(abandon → 결과 적용) 이 응답으로 덮어쓰지 않는다. 덮어쓰면 같은 결과가 게임에 두 번 들어간다(2026-10-18).
            if (c.h !== h0 || h0.done)
                return { ok: false, error: L('청문회가 바뀌었습니다.', 'The hearing changed.') };
            h = (0, fleet_1.pressRound)(h, lines);
            c.h = h;
            push();
            return await judgeNow(c);
        }
        catch (err) {
            return { ok: false, error: (0, aiclient_1.redactKey)(err.message) };
        }
        finally {
            exports.fleet.busy = false;
            push();
        }
    });
    /** 직접 대면: 플레이어 심문 → 제독 답. 3번째 심문 뒤 평가. */
    electron_1.ipcMain.handle('fleetFaceSay', async (e, text) => {
        if (!guard(e))
            return { ok: false, error: L('함대 사령부 창에서만 심문할 수 있습니다.', 'Questioning is only possible from the Fleet Command window.') };
        const c = curHearing();
        if (!c || c.h.done || c.h.mode !== 'face')
            return { ok: false, error: L('진행 중인 대면이 없습니다.', 'No face-to-face hearing in progress.') };
        if (typeof text !== 'string')
            return { ok: false, error: L('내용을 확인해 주세요.', 'Check what you entered.') };
        const bad = (0, fleet_1.checkText)(text);
        if (bad)
            return { ok: false, error: bad };
        if (exports.fleet.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        exports.fleet.busy = true;
        push();
        try {
            const clean = text.replace(/\s+/g, ' ').trim(), h0 = c.h;
            const reply = (await ctx_1.ctx.ai.chat((0, fleet_1.faceMessages)(ctx_1.ctx.playerName, h0, clean, profile(h0.name)), { purpose: 'fleet-face', maxTokens: 1000, conversationId: (0, aiclient_1.conversationOf)(c) })).trim();
            if (!reply)
                return { ok: false, error: L('제독의 답을 읽지 못했습니다. 다시 시도해 주세요(이번 심문은 세지 않습니다).', 'Could not read the admiral\'s answer. Try again (this question is not counted).') };
            if (c.h !== h0)
                return { ok: false, error: L('청문회가 바뀌었습니다.', 'The hearing changed.') };
            c.h = (0, fleet_1.faceTurn)(h0, clean, reply);
            push();
            if ((0, fleet_1.readyToJudge)(c.h))
                return await judgeNow(c);
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: (0, aiclient_1.redactKey)(err.message) };
        }
        finally {
            exports.fleet.busy = false;
            push();
        }
    });
    /** 평가가 실패했을 때 다시 평가만 한다. */
    electron_1.ipcMain.handle('fleetJudge', async (e) => {
        if (!guard(e))
            return { ok: false, error: L('함대 사령부 창에서만 진행할 수 있습니다.', 'Can only be done from the Fleet Command window.') };
        const c = curHearing();
        if (!c || !(0, fleet_1.readyToJudge)(c.h))
            return { ok: false, error: L('평가할 전투가 없습니다.', 'No battle to assess.') };
        if (exports.fleet.busy)
            return { ok: false, error: L('이미 처리 중입니다.', 'Already in progress.') };
        exports.fleet.busy = true;
        push();
        try {
            return await judgeNow(c);
        }
        catch (err) {
            return { ok: false, error: (0, aiclient_1.redactKey)(err.message) };
        }
        finally {
            exports.fleet.busy = false;
            push();
        }
    });
    electron_1.ipcMain.handle('fleetHearingClose', async (e) => { if (!guard(e))
        return false; const c = curHearing(); if (c && c.h.done) {
        exports.fleet.hearing = null;
        push();
    } return true; });
}
async function judgeNow(c) {
    let v = null;
    for (let i = 0; i < 2 && !v; i++) {
        try {
            v = (0, fleet_1.parseVerdict)(await ctx_1.ctx.ai.chat((0, fleet_1.verdictMessages)(ctx_1.ctx.playerName, c.h), { purpose: 'fleet-verdict', json: true, maxTokens: 800 * (i + 1) }));
        }
        catch (err) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'fleet-verdict', attempt: i + 1, error: String(err) });
        }
    }
    if (!v)
        return { ok: false, error: L('감찰관 평가를 읽지 못했습니다. [평가 다시]를 눌러 주세요.', 'Could not read the inspector\'s assessment. Press [Rate again].') };
    if (c.h.done)
        return { ok: false, error: L('청문회가 이미 끝났습니다.', 'The hearing has already ended.') }; // 평가를 기다리는 동안 창을 닫아 확정된 경우
    c.h = (0, fleet_1.judgeCase)(c.h, v);
    push();
    if (c.h.done)
        await applyOutcome(c);
    return { ok: true };
}
//# sourceMappingURL=fleet-app.js.map
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
exports.expelAmbassador = expelAmbassador;
exports.embassyView = embassyView;
exports.registerEmbassy = registerEmbassy;
// 대사관 보고서(앱 쪽, 2026-10-19). 규칙·예측은 src/embassy.ts, 화면은 ui/office-embassy.js(집무실 「대사관」).
// 알파 9: 화면은 「대사관 보고」(공식 경로: 대사관이 있어야 열림)와 「첩보 보고」(비밀 경로: 첩보 수준에 따라, 소문 표시) 두 갈래. 같은 자료(EMBASSY·PROFILE)를 두 시선으로 본다.
// 흐름: 연락처(외교 단말기와 같은 목록)에서 제국을 고름 → 「최신 정보 받기」 = 모드 sllm_probe_embassy(EMBFAC 여러 줄 + PROFILE + 끝 줄 EMBASSY)
// → 세이브별 sllm_embassy.json 에 마지막 자료 저장 → 화면은 볼 때마다 화면 언어로 예측을 다시 계산. 「대사 보고 받기」 = AI 가 쓴 전문(선택).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const terminal_1 = require("./terminal");
const agents_app_1 = require("./agents-app");
const office_app_1 = require("./office-app"); // 첩보 공작원(2026-10-20 알파 9 ④)
const chronicle_app_1 = require("./chronicle-app");
const media_1 = require("./media");
const namegen_app_1 = require("./namegen-app");
const debate_1 = require("../debate");
const agents_1 = require("../agents");
const embassy_1 = require("../embassy");
const embassy_2 = require("../embassy");
const condemn_app_1 = require("./condemn-app"); // 우리 전쟁에 대한 이 나라의 성명(2026-10-20)
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
const T = (x) => L(x[0], x[1]);
let data = null;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_embassy.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = j && typeof j === 'object' ? j : {};
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'embassy', error: e });
        data = {};
    }
    return data;
}
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'embassy', error: e });
} }
const saveOf = (sid) => (all()[sid] ??= {});
let exData = null;
const exFile = () => path.join(electron_1.app.getPath('userData'), 'sllm_expel.json');
function exAll() { if (exData)
    return exData; try {
    const j = JSON.parse(fs.readFileSync(exFile(), 'utf8'));
    exData = j && typeof j === 'object' ? j : {};
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'expel', error: e });
    exData = {};
} return exData; }
function exSave() { try {
    fs.writeFileSync(exFile(), JSON.stringify(exAll()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'expel', error: e });
} }
const expelOf = (sid, idx) => exAll()[sid]?.[String(idx)];
const WHY_TEXT = { war: ['전쟁 발발', 'war broke out'], opinion: ['관계 붕괴', 'relations collapsed'], spy: ['대사관 무관(공작원) 발각', 'embassy attaché (our agent) exposed'] };
let regData = null;
const regFile = () => path.join(electron_1.app.getPath('userData'), 'sllm_embreg.json');
function regAll() { if (regData)
    return regData; try {
    const j = JSON.parse(fs.readFileSync(regFile(), 'utf8'));
    regData = j && typeof j === 'object' ? j : {};
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'embreg', error: e });
    regData = {};
} return regData; }
function regSave() { try {
    fs.writeFileSync(regFile(), JSON.stringify(regAll()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'embreg', error: e });
} }
const regOf = (sid) => { const r = (regAll()[sid] ??= { year: {}, due: [] }); r.year ??= {}; r.due = Array.isArray(r.due) ? r.due : []; return r; };
const isDue = (sid, idx) => regOf(sid).due.includes(idx);
let regTimer = null, regNew = 0;
function markRegular(sid, idx, date) {
    const r = regOf(sid), d = (0, embassy_1.regularDue)(r.year[String(idx)], date);
    if (!d)
        return;
    r.year[String(idx)] = d.year;
    if (d.due && !r.due.includes(idx)) {
        r.due.push(idx);
        regNew += 1;
        if (!regTimer)
            regTimer = setTimeout(() => { regTimer = null; const n = regNew; regNew = 0; if (!n)
                return; office_app_1.office.toastGo = 'embassy'; ctx_1.ctx.notify({ kind: 'office', title: L(`대사관 정기 보고 ${n}건이 도착했습니다`, `${n} annual embassy report(s) have arrived`), body: L('집무실 「대사관」에서 대사 전문을 받아 보세요(전문을 받을 때만 AI를 씁니다).', 'Request the cables in the office under Embassies (AI is used only when you request one).'), action: L('대사관', 'Embassies') }); }, 3000);
    }
    regSave();
}
const newAmb = () => { const mi = Math.floor(Math.random() * agents_1.MANNERS.length); return { name: (0, namegen_app_1.gameName)(Math.random() < 0.5 ? 'm' : 'f') || (0, debate_1.randomName)(), manner: agents_1.MANNERS[mi][1], mi }; };
/** 우리 대사가 추방된다: 기록·연대기·호외·알림, 그리고 대사의 마지막 전문(AI 한 번, 실패해도 추방은 그대로). */
function expelAmbassador(idx, host, why, date) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid || !idx)
        return;
    const cur = expelOf(sid, idx);
    if (cur?.active)
        return;
    const e = saveOf(sid)[String(idx)], amb = e?.amb ?? newAmb();
    const x = { host, date, why, amb, active: true };
    (exAll()[sid] ??= {})[String(idx)] = x;
    exSave();
    const line = L(`${date} [추방] ${host}이(가) 우리 대사 ${amb.name}을(를) 추방했다(${WHY_TEXT[why][0]}).`, `${date} [Expelled] ${host} expelled our ambassador ${amb.name} (${WHY_TEXT[why][1]}).`);
    (0, chronicle_app_1.chronNoteWorld)(line, true);
    (0, chronicle_app_1.chronNote)(idx, L(`우리는 ${ctx_1.ctx.playerName || '그들'}의 대사 ${amb.name}을(를) 추방했다(${WHY_TEXT[why][0]}).`, `We expelled ${ctx_1.ctx.playerName || 'their'} ambassador ${amb.name} (${WHY_TEXT[why][1]}).`), true);
    (0, media_1.noteExtra)('expel', date, line);
    ctx_1.ctx.notify({ kind: 'event', title: L(`${host}이(가) 우리 대사를 추방했습니다`, `${host} has expelled our ambassador`), body: L(`대사 ${amb.name}이(가) 귀국합니다(${WHY_TEXT[why][0]}). 관계가 회복될 때까지 대사관 전문은 끊깁니다. 첩보 보고는 그대로 받을 수 있습니다.`, `Ambassador ${amb.name} is coming home (${WHY_TEXT[why][1]}). Embassy cables stop until relations recover. Espionage reports still work.`) });
    (0, diagnostics_1.logDiagnostic)('info', 'embassy.expel', { why });
    void (async () => { try {
        const rep = (0, embassy_2.parseEmbassyReport)(await ctx_1.ctx.ai.chat((0, embassy_1.farewellMessages)(host, ctx_1.ctx.playerName || 'the player empire', amb, why, date), { purpose: 'embassy-farewell', json: true, maxTokens: 1200 }), date);
        if (rep && expelOf(sid, idx) === x) {
            x.cable = { ...rep, amb };
            exSave();
        }
    }
    catch (err) {
        (0, diagnostics_1.logDiagnostic)('warn', 'embassy.farewell_failed', { error: String(err) });
    } })();
}
/** 관계가 회복됐다: 대사관 재개, 다음 전문부터 새 대사. */
function reopenEmbassy(sid, idx, x, date) {
    x.active = false;
    x.back = date;
    exSave();
    const e = saveOf(sid)[String(idx)];
    if (e?.amb) {
        delete e.amb;
        save();
    }
    (0, chronicle_app_1.chronNoteWorld)(L(`${date} ${x.host}와(과)의 관계가 회복되어 우리 대사관이 다시 문을 열었다.`, `${date} Relations with ${x.host} have recovered and our embassy has reopened.`), true);
    (0, diagnostics_1.logDiagnostic)('info', 'embassy.reopen', {});
}
/** 지난 보고 이후 달라진 점(공식은 대사관이 있을 때, 비밀은 첩보망이 닿을 때만 보여 준다). */
function changesOf(e) {
    const all = (0, embassy_2.embChanges)(e.prev, e.raw), o = (0, embassy_2.assessOfficial)(e.raw).available, sc = (0, embassy_2.assessSecret)(e.raw).available;
    const pick2 = (ch) => all.filter((c) => c.ch === ch && (ch === 'official' ? o : sc)).map((c) => ({ text: T(c.text), worse: c.worse }));
    return { official: pick2('official'), secret: pick2('secret'), prevDate: e.prev?.date ?? '' };
}
/** 두 달 간격 감시 기록(모드 EMBMON): 세이브 → 제국 번호 → 점들. 따로 저장한다. */
let mon = null;
const monFile = () => path.join(electron_1.app.getPath('userData'), 'sllm_embmon.json');
function monAll() {
    if (mon)
        return mon;
    try {
        const j = JSON.parse(fs.readFileSync(monFile(), 'utf8'));
        mon = j && typeof j === 'object' ? j : {};
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'embmon', error: e });
        mon = {};
    }
    return mon;
}
let monTimer = null;
function monSave() { if (monTimer)
    return; monTimer = setTimeout(() => { monTimer = null; try {
    fs.writeFileSync(monFile(), JSON.stringify(monAll()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'embmon', error: e });
} }, 2000); }
const seriesOf = (sid, idx) => monAll()[sid]?.[String(idx)] ?? [];
/** 감시 기록에서 본 변화: 공식은 대사관이 있을 때, 비밀은 첩보망이 닿을 때만. */
function monChanges(sid, idx, e) {
    const ch = (0, embassy_2.seriesChanges)(seriesOf(sid, idx)), o = e ? (0, embassy_2.assessOfficial)(e.raw).available : true, sc = e ? (0, embassy_2.assessSecret)(e.raw).available : false;
    const pick3 = (c) => ch.filter((x) => x.ch === c && (c === 'official' ? o : sc)).map((x) => ({ text: T(x.text), worse: x.worse }));
    return { official: pick3('official'), secret: pick3('secret') };
}
const facBuf = new Map(); // 요청 번호 → 모은 파벌 줄
const busy = new Set();
function detail(sid, idx) {
    const e = saveOf(sid)[String(idx)];
    if (!e)
        return null;
    const a = (0, embassy_2.assessEmbassy)(e.raw), o = (0, embassy_2.assessOfficial)(e.raw), ag0 = (0, agents_app_1.agentFor)(e.raw.name), sc = ag0?.dip ? (0, embassy_1.diplomaticBoost)((0, embassy_2.assessSecret)(e.raw)) : (0, embassy_2.assessSecret)(e.raw), x = expelOf(sid, idx);
    return {
        official: { available: o.available, level: o.level, levelName: T(embassy_2.LEVEL_NAME[o.level]), threat: o.threat, signals: o.shown.map((s) => ({ text: T(s.text), weight: s.weight })), factions: (0, embassy_2.factionLines)(e.raw, L, false) },
        amb: e.amb ? { ...e.amb, manner: e.amb.mi !== undefined && agents_1.MANNERS[e.amb.mi] ? L(agents_1.MANNERS[e.amb.mi][0], agents_1.MANNERS[e.amb.mi][1]) : e.amb.manner } : null, changes: changesOf(e), monthly: monChanges(sid, idx, e), series: seriesOf(sid, idx).map((p) => ({ date: p.date, op: p.op })),
        secret: { available: sc.available, level: sc.level, levelName: T(embassy_2.LEVEL_NAME[sc.level]), threat: sc.threat, confidence: T(sc.confidence), signals: sc.shown.map((s) => ({ text: T(s.text), weight: s.weight, rumor: s.rumor })), hidden: sc.hidden, rumors: sc.rumors, factions: (0, embassy_2.factionLines)(e.raw, L, true), report: e.spy ?? null, amb: e.spyAmb ?? null, agent: ag0 ? { ...(0, agents_app_1.agentView)(ag0, e.raw.date || ctx_1.ctx.gameDate || ''), canDip: o.available && !x?.active } : null },
        talk: (e.talk ?? []).slice(-embassy_1.TALK_MAX), due: isDue(sid, idx), canTalk: o.available && !x?.active,
        expel: x ? { active: x.active, date: x.date, back: x.back ?? '', why: T(WHY_TEXT[x.why]), amb: x.amb.name, cable: x.cable ?? null } : null,
        idx, name: e.raw.name, date: e.raw.date, intel: e.raw.intel, intelName: T(embassy_2.INTEL_NAME[e.raw.intel]), level: a.level, levelName: T(embassy_2.LEVEL_NAME[a.level]), threat: a.threat,
        confidence: T(a.confidence), signals: a.shown.map((s) => ({ text: T(s.text), weight: s.weight })), hidden: a.hidden,
        factions: (0, embassy_2.factionLines)(e.raw, L), report: e.report ?? null,
        warStance: (() => { const w = (0, condemn_app_1.stanceOfEmpire)(idx); return w ? { ...w, label: (0, condemn_app_1.stanceLabel)(w.stance) } : null; })(), // 우리 전쟁에 대한 이 나라의 공개 성명
    };
}
function embassyView() {
    const sid = ctx_1.ctx.curSaveId, tv = (0, terminal_1.terminalView)(), mine = sid ? saveOf(sid) : {};
    const contacts = (tv.sid === sid ? tv.items : []).filter((c) => !c.talkOnly).map((c) => { const e = mine[String(c.idx)]; const a = e ? (0, embassy_2.assessEmbassy)(e.raw) : null; return { idx: c.idx, name: c.name, date: e?.raw.date ?? '', due: sid ? isDue(sid, c.idx) : false, mail: (0, agents_app_1.agentHasMail)(c.name), level: a?.level ?? '', levelName: a ? T(embassy_2.LEVEL_NAME[a.level]) : '', threat: a?.threat ?? null, alert: e ? (() => { const ch = changesOf(e), mc = monChanges(sid, c.idx, e); return ch.official.some((x) => x.worse) || ch.secret.some((x) => x.worse) || mc.official.some((x) => x.worse) || mc.secret.some((x) => x.worse); })() : (sid ? monChanges(sid, c.idx).official.some((x) => x.worse) : false) }; });
    return { sid, date: ctx_1.ctx.gameDate, running: ctx_1.ctx.gameRunning, contacts };
}
function registerEmbassy(router) {
    agents_app_1.agentHooks.dipLost = (idx, host, date) => expelAmbassador(idx, host, 'spy', date); // 외교관 위장 공작원 발각 → 대사 추방(2026-10-20)
    router.on(log_router_1.SLOT.EMBASSY, 'embassy', (m) => {
        if (m.kind === 'EMBFAC') {
            const req = Number(m.kv.req), f = (0, embassy_2.factionFromKv)(m.kv);
            if (Number.isSafeInteger(req) && f) {
                const a = facBuf.get(req) ?? [];
                if (a.length < 20)
                    a.push(f);
                facBuf.set(req, a);
            }
            return;
        }
        if (m.kind === 'EMBMON') { // 두 달 간격 감시 한 줄(초안): 지금 불러온 세이브에 기록
            const sid = ctx_1.ctx.curSaveId, r = (0, embassy_2.embPointFromKv)(m.kv);
            if (!sid || !r)
                return;
            const bySave = (monAll()[sid] ??= {});
            bySave[String(r.idx)] = (0, embassy_2.pushPoint)(bySave[String(r.idx)], r.pt);
            monSave();
            // 대사 추방·재개(2026-10-20 알파 9): 대사관이 (어느 방향이든) 있는 나라가 전쟁 중이거나 호감 −100 이하 → 추방, 전쟁이 끝나고 호감 0 이상 → 재개
            const x = expelOf(sid, r.idx), host = String(m.kv.name || '').trim().slice(0, 100) || x?.host || '';
            if (x?.active) {
                if ((0, embassy_1.canReturn)(r.pt))
                    reopenEmbassy(sid, r.idx, x, r.pt.date);
            }
            else {
                const emb = m.kv.pe === '1' || m.kv.ce === '1', why = (0, embassy_1.expelReason)(r.pt, emb);
                if (why && host)
                    expelAmbassador(r.idx, host, why, r.pt.date);
                else if (emb)
                    markRegular(sid, r.idx, r.pt.date);
            } // 정기 공식 보고(해마다 한 번)
            return;
        }
        if (m.kind === 'EMBASSY')
            terminal_1.terminalReplies.get('EMBASSY:' + m.kv.req)?.(m);
    });
    electron_1.ipcMain.handle('embassyState', async () => embassyView());
    /** 공작원을 외교관 위장(대사관 무관)으로 옮기거나 되돌린다(2026-10-20). 대사관이 있고 대사가 추방되지 않았을 때만. */
    electron_1.ipcMain.handle('agentCover', async (_e, idxIn, on) => {
        const sid = ctx_1.ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined;
        if (!sid || !e)
            return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
        if (on === true && (!(0, embassy_2.assessOfficial)(e.raw).available || expelOf(sid, idx)?.active))
            return { ok: false, error: L('그 나라에 우리 대사관이 있어야 외교관으로 위장시킬 수 있습니다.', 'We need an embassy there to give the agent diplomatic cover.') };
        if (!(0, agents_app_1.setAgentCover)(e.raw.name, on === true))
            return { ok: false, error: L('그 나라에 공작원이 없습니다.', 'We have no agent there.') };
        return { ok: true, detail: detail(sid, idx) };
    });
    electron_1.ipcMain.handle('embassyDetail', async (_e, idx) => (ctx_1.ctx.curSaveId ? detail(ctx_1.ctx.curSaveId, Number(idx)) : null));
    /** 상주 대사와 대화(2026-10-20 알파 9): 상대 원수가 응하지 않아도 대사와는 이야기한다. 게임에는 아무것도 하지 않는다. */
    electron_1.ipcMain.handle('embassyTalk', async (_e, idxIn, textIn) => {
        const sid = ctx_1.ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined, text = String(textIn ?? '').trim().slice(0, embassy_1.TALK_TEXT);
        if (!sid || !e)
            return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
        if (!text)
            return { ok: false, error: L('대사에게 할 말을 적어 주세요.', 'Write something to the ambassador.') };
        if (!(0, embassy_2.assessOfficial)(e.raw).available)
            return { ok: false, error: L('이 나라에는 대사관이 없어 대사가 없습니다.', 'We have no embassy there, so there is no ambassador.') };
        if (expelOf(sid, idx)?.active)
            return { ok: false, error: L('우리 대사가 추방되어 연락할 수 없습니다.', 'Our ambassador was expelled and cannot be reached.') };
        if (busy.has(-idx - 2000000))
            return { ok: false, error: L('대사가 답하는 중입니다.', 'The ambassador is replying.') };
        busy.add(-idx - 2000000);
        try {
            if (!e.amb) {
                e.amb = newAmb();
                save();
            }
            const reply = (0, embassy_1.cleanTalkReply)(await ctx_1.ctx.ai.chat((0, embassy_1.ambassadorTalkMessages)(e.raw, ctx_1.ctx.playerName || 'the player empire', e.amb, e.talk ?? [], text, e.report, (0, condemn_app_1.stanceOfEmpire)(idx)), { purpose: 'embassy-talk', maxTokens: 700, conversationId: `embassy:${ctx_1.ctx.curSaveId}:${idx}` }));
            if (!reply)
                return { ok: false, error: L('대사의 답을 받지 못했습니다. 다시 보내 주세요.', 'No reply from the ambassador. Please send again.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            (e.talk ??= []).push({ me: text, them: reply, date: ctx_1.ctx.gameDate || e.raw.date });
            if (e.talk.length > embassy_1.TALK_MAX)
                e.talk.splice(0, e.talk.length - embassy_1.TALK_MAX);
            save();
            (0, diagnostics_1.logDiagnostic)('info', 'embassy.talk', { n: e.talk.length });
            return { ok: true, detail: detail(sid, idx) };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
        finally {
            busy.delete(-idx - 2000000);
        }
    });
    /** 공작원 서신 열기(2026-10-20): 처음이면 AI 가 본문을 쓴다. */
    electron_1.ipcMain.handle('agentLetterOpen', async (_e, idxIn, idIn) => {
        const sid = ctx_1.ctx.curSaveId, idx = Number(idxIn), r = await (0, agents_app_1.openAgentLetter)(Number(idIn));
        return { ...r, ...(sid ? { detail: detail(sid, idx), state: embassyView() } : {}) };
    });
    electron_1.ipcMain.handle('embassyContacts', async () => {
        if (!ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 목록을 갱신할 수 있습니다.', 'The game must be running to refresh the list.') };
        const req = ++game_link_1.link.reqCounter;
        try {
            await (0, terminal_1.terminalRequest)('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req);
            return { ok: true, state: embassyView() };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('embassyProbe', async (_e, idxIn) => {
        const sid = ctx_1.ctx.curSaveId, idx = Number(idxIn);
        if (!ctx_1.ctx.gameRunning || !sid)
            return { ok: false, error: L('게임이 켜져 있어야 대사관 보고를 받을 수 있습니다.', 'The game must be running to get an embassy report.') };
        const c = terminal_1.terminal.items.find((x) => x.idx === idx);
        if (terminal_1.terminal.sid !== sid || !c || !(0, terminal_1.contactAllowed)(c.type))
            return { ok: false, error: L('현재 연락처에 없는 제국입니다. 목록을 갱신해 주세요.', 'This empire is not in the current contacts. Please refresh the list.') };
        if (busy.has(idx))
            return { ok: false, error: L('이미 정보를 받는 중입니다.', 'Already receiving information.') };
        busy.add(idx);
        const req = ++game_link_1.link.reqCounter;
        facBuf.set(req, []);
        try {
            const m = await (0, terminal_1.terminalRequest)((0, embassy_2.embassyCommand)(idx, req), 'EMBASSY', req);
            if (m.kv.sid !== ctx_1.ctx.curSaveId || sid !== ctx_1.ctx.curSaveId)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            const raw = (0, embassy_2.embFromKv)(m.kv, facBuf.get(req) ?? [], ctx_1.ctx.gameDate || '');
            if (!raw)
                return { ok: false, error: L('그 제국과 통신이 닿지 않아 정보를 받지 못했습니다.', 'No communications with that empire, so no information arrived.') };
            const pf = ctx_1.ctx.profiles.get(idx);
            if (pf) {
                raw.att = pf.att;
                raw.beh = pf.beh;
                raw.flags = { ...pf.flags };
            }
            if (!raw.name)
                raw.name = c.name;
            const prev = saveOf(sid)[String(idx)];
            const base = prev && prev.raw.date !== raw.date ? prev.raw : prev?.prev; // 같은 날짜에 다시 받아도 비교 기준이 사라지지 않게
            saveOf(sid)[String(idx)] = { raw, ...(prev?.report ? { report: prev.report } : {}), ...(prev?.spy ? { spy: prev.spy } : {}), ...(base ? { prev: base } : {}), ...(prev?.amb ? { amb: prev.amb } : {}), ...(prev?.spyAmb ? { spyAmb: prev.spyAmb } : {}) };
            save();
            (0, diagnostics_1.logDiagnostic)('info', 'embassy.probe', { idx, intel: raw.intel, factions: raw.factions.length, profile: !!pf });
            return { ok: true, detail: detail(sid, idx), state: embassyView() };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
        finally {
            busy.delete(idx);
            facBuf.delete(req);
        }
    });
    electron_1.ipcMain.handle('embassyReport', async (_e, idxIn) => {
        const sid = ctx_1.ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined;
        if (!sid || !e)
            return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
        if (busy.has(-idx))
            return { ok: false, error: L('대사가 보고서를 쓰는 중입니다.', 'The ambassador is writing the report.') };
        if (!(0, embassy_2.assessOfficial)(e.raw).available)
            return { ok: false, error: L('이 나라에는 대사관이 없어 대사의 전문을 받을 수 없습니다.', 'We have no embassy there, so there is no ambassador to write a cable.') };
        if (expelOf(sid, idx)?.active)
            return { ok: false, error: L('우리 대사가 추방되어 전문을 받을 수 없습니다. 관계가 회복되면 새 대사가 부임합니다.', 'Our ambassador was expelled, so there are no cables. A new ambassador will be posted once relations recover.') };
        busy.add(-idx);
        try {
            const a = (0, embassy_2.assessEmbassy)(e.raw);
            if (!e.amb) {
                const mi = Math.floor(Math.random() * agents_1.MANNERS.length);
                e.amb = { name: (0, namegen_app_1.gameName)(Math.random() < 0.5 ? 'm' : 'f') || (0, debate_1.randomName)(), manner: agents_1.MANNERS[mi][1], mi };
                save();
            } // 대사: 우리 제국 종족 이름 표(AI 가 짓지 않음)
            const raw = await ctx_1.ctx.ai.chat((0, embassy_2.embassyMessages)(e.raw, a, ctx_1.ctx.playerName || 'the player empire', e.amb, e.prev, (0, condemn_app_1.stanceOfEmpire)(idx)), { purpose: 'embassy-report', json: true, maxTokens: 2400 });
            const rep = (0, embassy_2.parseEmbassyReport)(raw, e.raw.date);
            if (!rep)
                return { ok: false, error: L('대사의 보고서를 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the ambassador\'s report. Please try again.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            e.report = rep;
            save();
            {
                const rg = regOf(sid);
                if (rg.due.includes(idx)) {
                    rg.due = rg.due.filter((x) => x !== idx);
                    regSave();
                }
            } // 정기 보고를 받았다
            return { ok: true, detail: detail(sid, idx), state: embassyView() };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
        finally {
            busy.delete(-idx);
        }
    });
    electron_1.ipcMain.handle('embassySpyReport', async (_e, idxIn) => {
        const sid = ctx_1.ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined;
        if (!sid || !e)
            return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
        const sc = (0, agents_app_1.agentFor)(e.raw.name)?.dip ? (0, embassy_1.diplomaticBoost)((0, embassy_2.assessSecret)(e.raw)) : (0, embassy_2.assessSecret)(e.raw); // 외교관 위장이면 소문이 확인된 정보로
        if (!sc.available)
            return { ok: false, error: L('첩보망이 그 나라에 닿지 않아 보고할 내용이 없습니다. 첩보망을 키워 주세요.', 'Our network does not reach that empire, so there is nothing to report. Grow your espionage network.') };
        if (busy.has(-idx - 1000000))
            return { ok: false, error: L('첩보부장이 보고서를 쓰는 중입니다.', 'The spymaster is writing the briefing.') };
        busy.add(-idx - 1000000);
        try {
            const raw = await ctx_1.ctx.ai.chat((0, embassy_2.spyReportMessages)(e.raw, sc, ctx_1.ctx.playerName || 'the player empire', e.spyAmb, (() => { const ag = (0, agents_app_1.agentFor)(e.raw.name); return ag ? (0, agents_1.agentPromptLine)(ag, e.raw.date || ctx_1.ctx.gameDate || '') : undefined; })()), { purpose: 'spy-report', json: true, maxTokens: 2400 });
            const rep = (0, embassy_2.parseEmbassyReport)(raw, e.raw.date);
            if (!rep)
                return { ok: false, error: L('첩보 보고서를 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the briefing. Please try again.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            e.spy = rep;
            save(); // 공작원·첩보부장 이름은 AI 가 짓지 않는다(옛 기록의 spyAmb 는 그대로 둔다)
            return { ok: true, detail: detail(sid, idx) };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
        finally {
            busy.delete(-idx - 1000000);
        }
    });
}
//# sourceMappingURL=embassy-app.js.map
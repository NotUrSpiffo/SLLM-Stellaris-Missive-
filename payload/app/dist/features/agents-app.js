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
exports.agentHooks = void 0;
exports.agentFor = agentFor;
exports.agentView = agentView;
exports.agentHasMail = agentHasMail;
exports.openAgentLetter = openAgentLetter;
exports.setAgentCover = setAgentCover;
exports.registerAgents = registerAgents;
// 첩보 자산 인물화(2026-10-20 알파 9 ④) — 앱 쪽. 규칙: src/agents.ts.
// 월간 상황(SPYNET 줄)으로 공작원 명부를 맞춘다: 새 첩보망 → 공작원 부임(이름은 상대 제국 종족 이름 표), 두 달 연속 사라지면 연락 두절 → 추모관 「떠난 사람들」.
// 집무실 대사관 화면의 첩보 보고서는 그 나라 공작원이 직접 쓴다(embassy-app).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const i18n_pick_1 = require("../i18n-pick");
const music_1 = require("../music");
const gamestate_app_1 = require("./gamestate-app");
const namegen_app_1 = require("./namegen-app");
const memorial_app_1 = require("./memorial-app");
const debate_1 = require("../debate");
const espionage_app_1 = require("./espionage-app"); // 연락 두절 → 그 나라가 해명 요구(청문회, 2026-10-20)
const agents_1 = require("../agents");
const office_app_1 = require("./office-app"); // 공작원 서신 알림 → 집무실 첩보 화면(2026-10-20)
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_agents.json');
let store = null;
function all() { if (store)
    return store; try {
    store = (0, agents_1.sanitizeAgents)(JSON.parse(fs.readFileSync(file(), 'utf8')));
}
catch (e) {
    if (e.code !== 'ENOENT')
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'agents', error: e });
    store = (0, agents_1.sanitizeAgents)({});
} return store; }
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'agents', error: e });
} }
const saveOf = (sid) => (all().saves[(0, music_1.safeKey)(sid)] ??= { seq: 0, agents: [] });
const idxOf = (name) => { for (const [i, c] of ctx_1.ctx.mailCountries)
    if (c.name === name)
        return i; return 0; };
/** 외교관 위장 공작원이 붙잡혔을 때 대사관 쪽이 할 일(대사 추방) — embassy-app 이 등록한다(가져오기 순환을 피하려고, 2026-10-20). */
exports.agentHooks = { dipLost: null };
/** 그 나라에서 활동 중인 공작원(없으면 null). */
function agentFor(target) { const sid = ctx_1.ctx.curSaveId; return sid ? saveOf(sid).agents.find((a) => a.status === 'active' && a.target === target) ?? null : null; }
/** 화면용(한/영 짝으로 — 화면이 L 로 고른다). */
function agentView(a, now) {
    const sv = ctx_1.ctx.curSaveId ? saveOf(ctx_1.ctx.curSaveId) : null;
    const letters = (sv?.letters ?? []).filter((l) => l.key === a.key).slice(-8).reverse().map((l) => ({ id: l.id, kind: [agents_1.LETTER_KIND_NAME[l.kind][0], agents_1.LETTER_KIND_NAME[l.kind][1]], date: l.date, read: l.read, title: l.title ?? '', body: l.body ?? '' }));
    const contacts = (0, agents_1.activeContacts)(a).map((c) => ({ name: c.name, role: [(0, agents_1.assetName)(c.a, true), (0, agents_1.assetName)(c.a, false)], since: c.since, person: !!agents_1.ASSETS[c.a]?.person }));
    return { name: a.name, code: [(0, agents_1.codename)(a, true), (0, agents_1.codename)(a, false)], cover: [(0, agents_1.coverName)(a, true), (0, agents_1.coverName)(a, false)], manner: [(0, agents_1.mannerName)(a, true), (0, agents_1.mannerName)(a, false)], since: a.since, years: (0, agents_1.yearsServed)(a.since, now), veteran: (0, agents_1.isVeteran)(a, now), dip: !!a.dip, contacts, letters };
}
/** 그 나라 공작원의 안 읽은 서신이 있는지(대상 목록 표시). */
function agentHasMail(target) { const a = agentFor(target), sv = ctx_1.ctx.curSaveId ? saveOf(ctx_1.ctx.curSaveId) : null; return !!a && !!sv?.letters?.some((l) => l.key === a.key && !l.read); }
const opening = new Set();
/** 서신 봉투를 연다: 처음이면 AI 가 본문을 한 번 쓴다(이야기만). */
async function openAgentLetter(id) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return { ok: false, error: (0, i18n_pick_1.L)('세이브를 불러와 주세요.', 'Load a save first.') };
    const sv = saveOf(sid), l = sv.letters?.find((x) => x.id === id), a = l ? sv.agents.find((x) => x.key === l.key) : undefined;
    if (!l || !a)
        return { ok: false, error: (0, i18n_pick_1.L)('서신을 찾지 못했습니다.', 'Letter not found.') };
    if (l.body) {
        if (!l.read) {
            l.read = true;
            save();
        }
        return { ok: true };
    }
    if (opening.has(id))
        return { ok: false, error: (0, i18n_pick_1.L)('서신을 해독하는 중입니다.', 'Decoding the letter.') };
    opening.add(id);
    try {
        const r = (0, agents_1.parseAgentLetter)(await ctx_1.ctx.ai.chat((0, agents_1.agentLetterMessages)(a, l, ctx_1.ctx.playerName || 'the player empire', ctx_1.ctx.gameDate || l.date), { purpose: 'agent-letter', json: true, maxTokens: 1400 }));
        if (!r)
            return { ok: false, error: (0, i18n_pick_1.L)('서신을 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the letter. Please try again.') };
        if (ctx_1.ctx.curSaveId !== sid)
            return { ok: false, error: (0, i18n_pick_1.L)('세이브가 바뀌었습니다.', 'The save changed.') };
        l.title = r.title;
        l.body = r.body;
        l.read = true;
        save();
        (0, diagnostics_1.logDiagnostic)('info', 'agents.letter_open', { kind: l.kind });
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
    finally {
        opening.delete(id);
    }
}
/** 외교관 위장으로 옮기기/되돌리기(대사관이 있을 때만 — 부른 쪽이 확인). */
function setAgentCover(target, on) {
    const a = agentFor(target);
    if (!a)
        return false;
    if (on)
        a.dip = true;
    else
        delete a.dip;
    save();
    (0, diagnostics_1.logDiagnostic)('info', 'agents.cover', { dip: on });
    return true;
}
function onSnap(snap) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid || (snap.sid && snap.sid !== sid))
        return;
    const s = saveOf(sid), { born, lost } = (0, agents_1.syncAgents)(s.agents, snap.spynets, snap.date);
    for (const t of born) {
        const idx = idxOf(t), g = Math.random() < 0.5 ? 'm' : 'f';
        const name = (idx ? (0, namegen_app_1.gameName)(g, idx) : null) || (0, debate_1.randomName)(); // 위장 신분: 상대 제국 종족 이름
        s.seq += 1;
        s.agents.push((0, agents_1.newAgent)(t, idx, snap.date, name, g, s.agents.map((a) => a.code), Math.random, s.seq));
    }
    const ko = (0, i18n_pick_1.L)('ko', 'en') === 'ko';
    for (const a of lost) {
        (0, memorial_app_1.memorialAgentLost)({ key: a.key, name: `${a.name} (${(0, i18n_pick_1.L)('암호명 ', 'codename ')}${(0, agents_1.codename)(a, ko)})`, first: a.since, date: a.gone || snap.date, code: (0, agents_1.codename)(a, ko) });
        if (a.dip)
            exports.agentHooks.dipLost?.(a.idx || idxOf(a.target), a.target, a.gone || snap.date); // 대사관 무관이 붙잡혔다 → 대사 추방(embassy-app)
        // 그 나라가 우리 공작원을 붙잡았다며 해명을 요구한다(공작원 이름이 증거로) — 청문회는 한 번에 하나
        (0, espionage_app_1.openGameHearing)({ opponent: a.target, idx: a.idx || undefined, key: a.key, operation: (0, i18n_pick_1.L)('첩보망 적발', 'Spy network exposed'), facts: [
                (0, i18n_pick_1.L)(`${a.target} 당국은 ${(0, agents_1.coverName)(a, true)}(으)로 위장해 ${a.since || '?'}부터 활동한 외국 공작원 ${a.name}을(를) 적발했다고 주장한다.`, `${a.target} authorities claim to have uncovered a foreign agent, ${a.name}, operating under cover as a ${(0, agents_1.coverName)(a, false)} since ${a.since || '?'}.`),
                (0, i18n_pick_1.L)(`우리 첩보망은 ${a.gone || snap.date}에 무너졌고 공작원과는 연락이 끊겼다.`, `Our spy network collapsed on ${a.gone || snap.date} and contact with the agent is lost.`)
            ] });
    }
    // 현지 협력자(게임 첩보 자산): 사람은 상대 제국 종족 이름, 드론·노드는 일련번호
    const nets = new Map(snap.spynets.map((n) => [n.target, n.assets]));
    for (const a of s.agents)
        if (a.status === 'active')
            (0, agents_1.syncContacts)(a, nets.get(a.target), snap.date, (x) => (agents_1.ASSETS[x]?.person ? (a.idx ? (0, namegen_app_1.gameName)(Math.random() < 0.5 ? 'm' : 'f', a.idx) : null) || (0, debate_1.randomName)() : (0, agents_1.unitName)(Math.random)));
    // 공작원 서신(2년마다, 이야기만)
    const mail = (0, agents_1.drawAgentLetters)(s, snap.date);
    if (mail.length) {
        office_app_1.office.toastGo = 'spy';
        const who = s.agents.find((a) => a.key === mail[0].key);
        ctx_1.ctx.notify({ kind: 'office', title: (0, i18n_pick_1.L)('공작원 서신이 도착했습니다', 'A dispatch from the field'), body: who ? (0, i18n_pick_1.L)(`암호명 ${(0, agents_1.codename)(who, true)}${mail.length > 1 ? ` 외 ${mail.length - 1}통` : ''} — 집무실 「첩보」에서 열어 보세요.`, `Codename ${(0, agents_1.codename)(who, false)}${mail.length > 1 ? ` and ${mail.length - 1} more` : ''} — open it in the office under Espionage.`) : (0, i18n_pick_1.L)('집무실 「첩보」에서 열어 보세요.', 'Open it in the office under Espionage.'), action: (0, i18n_pick_1.L)('열기', 'Open') });
        (0, diagnostics_1.logDiagnostic)('info', 'agents.letters', { n: mail.length });
    }
    if (s.agents.length > 200)
        s.agents.splice(0, s.agents.length - 200);
    save();
    if (born.length || lost.length)
        (0, diagnostics_1.logDiagnostic)('info', 'agents.sync', { born: born.length, lost: lost.length });
}
function registerAgents() { (0, gamestate_app_1.onGameSnapshot)((snap) => onSnap(snap)); }
//# sourceMappingURL=agents-app.js.map
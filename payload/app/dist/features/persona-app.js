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
exports._personaLimits = exports.personaPeek = exports.personaLast = exports.personBio = exports.memOf = void 0;
exports.personOf = personOf;
exports.personaJson = personaJson;
exports.ensurePersona = ensurePersona;
exports.registerPersona = registerPersona;
exports.setPersonBio = setPersonBio;
exports.governorBio = governorBio;
exports.personaNote = personaNote;
// 집무실 인물 대화 + 기억(앱 쪽, 2026-10-18). 순수 로직은 src/persona.ts.
// 연락처의 인물과 집무실 안에서 1:1로 이야기한다(총독은 행성 정보가 있는 기존 총독 창을 그대로 쓴다).
// 세이브별 sllm_persona.json 에 인물마다 말투 한 줄·신뢰·기억(최근 12개)을 둔다. 대화는 끝날 때 한 번 요약해 기억으로 남긴다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const aiclient_1 = require("../aiclient");
const office_app_1 = require("./office-app");
const gestalt_app_1 = require("./gestalt-app");
const fleet_app_1 = require("./fleet-app");
const settings_ui_1 = require("./settings-ui");
const policy_app_1 = require("./policy-app");
const persona_1 = require("../persona");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
let data = null;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_persona.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = j && typeof j === 'object' ? j : {};
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'persona', error: e });
        data = {};
    }
    return data;
}
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'persona', error: e });
} }
const memOf = (sid, key) => { const s = (all()[sid] ??= {}); const m = (s[key] ??= (0, persona_1.emptyMem)()); m.mems ??= []; return m; };
exports.memOf = memOf;
/** 지금 세이브의 연락처에서 이 인물 찾기. */
function personOf(key) {
    const p = (0, office_app_1.officeView)().people.find((x) => x.key === key);
    if (!p)
        return null;
    const g = (0, gestalt_app_1.gestaltCode)();
    return g ? { ...p, gestalt: g } : p; // 단일 의식 제국이면 인물 말투가 달라진다(2026-10-19)
}
/** 사건(기술 수준 상승·청문회 결과)을 신뢰와 기억에 반영. */
function syncPerson(sid, p) {
    const m = (0, exports.memOf)(sid, p.key);
    const date = ctx_1.ctx.gameDate || '';
    let ch = (0, persona_1.syncEvents)(m, p, date);
    const lid = Number(String(p.key).replace(/^(p|adm):/, ''));
    if (Number.isFinite(lid) && lid > 0) {
        const a = (0, fleet_app_1.fleetView)().admirals.find((x) => x.lid === lid);
        if (a && typeof a.hearings === 'number')
            ch = (0, persona_1.syncHearing)(m, a.hearings, a.status, date) || ch;
    }
    if (ch)
        save();
    return m;
}
const view = (m, p) => ({ traits: p?.traits ?? [], persona: m.persona ?? '', trust: m.trust, level: (() => { const t = (0, persona_1.trustLevel)(m.trust); return L(t.ko, t.en); })(), mems: m.mems.slice().reverse(), talks: m.talks, last: m.last ?? '' });
const talks = new Map(); // 진행 중인 대화(세이브|인물)
const busy = new Set();
/** 인물 AI 호출(JSON). 추론형 모델(Player2 등)은 생각에 토큰을 많이 써서 답이 잘릴 수 있다(2026-10-18 실기: 700 중 686 을 쓰고 본문 30자).
 *  넉넉한 한도로 부르고, 필요한 칸을 못 읽으면 한도를 두 배로 한 번 더. 못 읽으면 null. */
async function personaJson(msgs, maxTokens, need, conversationId) {
    let cut = null; // 끊긴 답(마지막 수단)
    for (const mt of [maxTokens, maxTokens * 2]) {
        const raw = await ctx_1.ctx.ai.chat(msgs, { purpose: 'persona', maxTokens: mt, json: true, ...(conversationId ? { conversationId } : {}) });
        const j = (0, persona_1.parseJson)(raw);
        const has = !!(j && String(j[need] ?? '').trim());
        if (has && !j.partial)
            return j; // 완성된 JSON 만 바로 쓴다. 한도에 걸려 끊긴 답은 한도를 늘려 다시
        if (has)
            cut = j;
        (0, diagnostics_1.logDiagnostic)('warn', 'ai.response.invalid', { feature: 'persona.' + need, chars: String(raw || '').length, maxTokens: mt, partial: has });
    }
    if (cut) {
        const { partial: _p, ...rest } = cut;
        return { ...rest, [need]: (0, persona_1.endSentence)(String(cut[need])) };
    } // 두 번 다 끊기면 마지막 완성 문장까지
    return null;
}
async function ensurePersona(sid, p, m) {
    if (!(0, persona_1.needsPersona)(m, p))
        return; // 처음이거나 특성이 새로 들어오거나 바뀌었을 때만
    try {
        const j = await personaJson((0, persona_1.personaMessages)(p, ctx_1.ctx.playerName || '', m.bio || ''), 1000, 'persona');
        const t = (0, persona_1.cleanLine)(j?.persona, 120);
        if (t && ctx_1.ctx.curSaveId === sid) {
            m.persona = t;
            m.traitSig = (0, persona_1.traitSig)(p);
            save();
        }
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'persona.init_failed', { error: String(e) });
    }
}
async function finishTalk(sid, key) {
    const tk = sid + '|' + key, talk = talks.get(tk);
    talks.delete(tk);
    if (!talk || !talk.lines.some((l) => l.who === 'me'))
        return { ok: true };
    const p = personOf(key);
    if (!p)
        return { ok: true };
    const m = (0, exports.memOf)(sid, key);
    m.talks++;
    m.last = ctx_1.ctx.gameDate || m.last;
    save();
    try {
        const memo = (0, persona_1.cleanLine)((await personaJson((0, persona_1.summaryMessages)(p, talk, ctx_1.ctx.playerName || ''), 1000, 'memory'))?.memory, 160);
        if (memo && ctx_1.ctx.curSaveId === sid && (0, persona_1.addMemory)(m, ctx_1.ctx.gameDate || '', memo))
            save();
        return { ok: true, ...(memo ? { memory: memo } : {}) };
    }
    catch (e) {
        return { ok: false, error: (0, aiclient_1.redactKey)(L('기억을 정리하지 못했습니다: ', 'Could not save the memory: ') + e.message) };
    }
}
function registerPersona() {
    /** 연락처 상세용: 말투·신뢰·기억(최근 것 먼저). 대화 기록은 없다. */
    electron_1.ipcMain.handle('personaInfo', async (_e, key) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? '');
        if (!sid || !k)
            return null;
        const p = personOf(k);
        if (!p)
            return null;
        return view(syncPerson(sid, p), p);
    });
    /** 통신 열기: 처음이면 말투를 정하고, 이 인물이 먼저 인사한다(기억이 있으면 지난 이야기로). */
    electron_1.ipcMain.handle('personaOpen', async (_e, key) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? '');
        if (!sid)
            return { ok: false, error: L('세이브를 불러온 뒤에 통신할 수 있습니다.', 'Load a save before opening a channel.') };
        const p = personOf(k);
        if (!p)
            return { ok: false, error: L('연락처에서 이 인물을 찾지 못했습니다.', 'This person is not in your contacts.') };
        const tk = sid + '|' + k;
        if (busy.has(tk))
            return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
        busy.add(tk);
        try {
            const m = syncPerson(sid, p);
            await ensurePersona(sid, p, m);
            const talk = { key: k, lines: [], moved: 0, opened: ctx_1.ctx.gameDate || '' };
            talks.set(tk, talk);
            let greet = '';
            try {
                greet = (0, persona_1.cleanLine)((await personaJson((0, policy_app_1.withPolicyContext)((0, persona_1.talkMessages)(p, m, talk, '[Channel open - the leader has opened the hologram link. Greet them briefly first.]', ctx_1.ctx.playerName || '', ctx_1.ctx.gameDate || '')), 1500, 'reply', (0, aiclient_1.conversationOf)(talk)))?.reply);
            }
            catch (e) {
                return { ok: true, person: p, ...view(m, p), lines: [], error: (0, aiclient_1.redactKey)(L('인사를 받지 못했습니다: ', 'No greeting: ') + e.message) };
            }
            if (greet)
                talk.lines.push({ who: 'them', text: greet });
            return { ok: true, person: p, ...view(m, p), lines: talk.lines.slice() };
        }
        finally {
            busy.delete(tk);
        }
    });
    /** 말하기: 인물의 답 + 이번 말로 움직인 신뢰(앱이 한도로 묶음). */
    electron_1.ipcMain.handle('personaSay', async (_e, key, text) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? ''), t = (0, persona_1.cleanLine)(text, 500);
        if (!sid || !t)
            return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.') };
        const tk = sid + '|' + k, talk = talks.get(tk), p = personOf(k);
        if (!talk || !p)
            return { ok: false, error: L('통신이 끊겼습니다. 다시 열어 주세요.', 'The channel was closed. Open it again.') };
        if (busy.has(tk))
            return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
        if (talk.lines.length >= persona_1.MAX_TURNS * 2)
            return { ok: false, error: L('대화가 길어졌습니다. 마치고 다시 열어 주세요.', 'This conversation is long. End it and open a new one.') };
        busy.add(tk);
        try {
            const m = (0, exports.memOf)(sid, k);
            const j = await personaJson((0, policy_app_1.withPolicyContext)((0, persona_1.talkMessages)(p, m, talk, t, ctx_1.ctx.playerName || '', ctx_1.ctx.gameDate || '')), 1500, 'reply', (0, aiclient_1.conversationOf)(talk));
            const reply = (0, persona_1.cleanLine)(j?.reply);
            if (!reply)
                return { ok: false, error: L('답을 읽지 못했습니다. 다시 말해 보세요.', 'Could not read the reply. Try again.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            talk.lines.push({ who: 'me', text: t }, { who: 'them', text: reply });
            const d = (0, persona_1.applyMove)(m, talk, j?.move);
            save();
            return { ok: true, reply, delta: d, trust: m.trust, level: (() => { const t = (0, persona_1.trustLevel)(m.trust); return L(t.ko, t.en); })() };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            busy.delete(tk);
        }
    });
    /** 대화 마치기: 1~2줄로 요약해 기억에 쌓는다. */
    electron_1.ipcMain.handle('personaEnd', async (_e, key) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? '');
        if (!sid || !k)
            return { ok: true };
        const r = await finishTalk(sid, k);
        const m = (0, exports.memOf)(sid, k);
        return { ...r, ...view(m, personOf(k) ?? undefined) };
    });
}
/** 인물 전기(2026-10-18, features/backstory-app.ts). 바꾸면 말투를 다시 정한다. */
const personBio = (sid, key) => all()[sid]?.[key]?.bio ?? '';
exports.personBio = personBio;
function setPersonBio(sid, key, text) {
    const m = (0, exports.memOf)(sid, key), t = text.trim();
    if ((m.bio ?? '') === t)
        return;
    if (t)
        m.bio = t;
    else
        delete m.bio;
    delete m.persona;
    delete m.traitSig;
    save();
}
/** 총독 창(gov.ts)에서: 이 행성 총독의 인물 전기. */
function governorBio(planet) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid || !planet)
        return '';
    try {
        const p = (0, office_app_1.officeView)().people.find((x) => x.role === 'governor' && x.planet === planet);
        return p ? (0, exports.personBio)(sid, p.key) : '';
    }
    catch {
        return '';
    }
}
/** 개인 서신(letters-app)에서: 마지막으로 이야기한 날짜, 기억 한 줄·신뢰 변화 남기기. */
const personaLast = (sid, key) => all()[sid]?.[key]?.last;
exports.personaLast = personaLast;
function personaNote(sid, key, text, delta = 0) {
    const m = (0, exports.memOf)(sid, key);
    let ch = false;
    if (text && (0, persona_1.addMemory)(m, ctx_1.ctx.gameDate || '', text))
        ch = true;
    if (delta) {
        m.trust = (0, persona_1.clampTrust)(m.trust + delta);
        ch = true;
    }
    if (ch)
        save();
}
/** 내각 회의(faction-app, 2026-10-19)에서: 이 인물의 말투·신뢰·기억 읽기만(없으면 null, 새로 만들지 않는다). */
const personaPeek = (sid, key) => all()[sid]?.[key] ?? null;
exports.personaPeek = personaPeek;
exports._personaLimits = { MAX_MEM: persona_1.MAX_MEM, MAX_TURNS: persona_1.MAX_TURNS };
//# sourceMappingURL=persona-app.js.map
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
exports.lettersFrom = void 0;
exports.addFarewell = addFarewell;
exports.registerLetters = registerLetters;
// 집무실 3단계: 개인 서신(앱 쪽, 2026-10-18). 순수 로직은 src/letters.ts.
// 매달 지도자 명단이 들어오면(people-app) 계기를 후보로 쌓고, 6개월마다 무작위로 골라 봉투를 만든다(AI 없음).
// 본문은 플레이어가 봉투를 열 때 한 번만 AI 로 쓴다. 부탁은 버튼(들어주기/거절)으로, 결과는 앱이 정하고 게임에 특성을 건다.
// 세이브별 sllm_letters.json(빈도 설정 포함). 새 편지: 집무실 아이콘·오버레이 집무실 버튼의 숫자 + 알림 카드.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const diagnostics_1 = require("../diagnostics");
const aiclient_1 = require("../aiclient");
const safe_send_1 = require("../safe-send");
const terminal_1 = require("./terminal");
const office_app_1 = require("./office-app");
const fleet_app_1 = require("./fleet-app");
const people_app_1 = require("./people-app");
const persona_app_1 = require("./persona-app");
const windows_1 = require("./windows");
const gestalt_app_1 = require("./gestalt-app");
const settings_ui_1 = require("./settings-ui");
const trait_names_1 = require("../trait-names");
const persona_1 = require("../persona");
const letters_1 = require("../letters");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
let data = null;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_letters.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = j && typeof j === 'object' && j.saves ? j : { freq: 'few', saves: {} };
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'letters', error: e });
        data = { freq: 'few', saves: {} };
    }
    if (!(data.freq in letters_1.DRAW_COUNT))
        data.freq = 'few'; // 기본: 적게(6개월에 1통)
    return data;
}
function save() { try {
    const tmp = file() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8');
    fs.renameSync(tmp, file());
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'letters', error: e });
} }
const saveOf = (sid) => { const s = (all().saves[sid] ??= (0, letters_1.emptyLetters)()); s.cands ??= []; s.sent ??= {}; s.letters ??= []; s.seen ??= {}; s.next ??= 1; return s; };
const unread = () => (ctx_1.ctx.curSaveId ? (0, letters_1.unreadCount)(saveOf(ctx_1.ctx.curSaveId)) : 0);
const loc = () => (0, trait_names_1.traitLoc)(ctx_1.ctx.flagProv.game(), (0, settings_ui_1.selectedLanguage)() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
const traitNote = (k) => { const l = loc(); return (0, trait_names_1.traitLabel)(l.names, k) + (l.descs[k] ? ` (${l.descs[k]})` : ''); };
function badge() { (0, safe_send_1.safeSend)(windows_1.wins.launcher, 'officeBadge', unread()); (0, office_app_1.pushOffice)(); }
/** 지금 살아 있는 내 지도자(명단 + 함대 사령부의 전투 수). */
function livePeople(sid) {
    const roles = new Map((0, office_app_1.officeView)().people.map((p) => [p.key, p.role]));
    const adm = new Map((0, fleet_app_1.fleetView)().admirals.map((a) => [a.lid, a]));
    return (0, people_app_1.peopleOf)(sid).filter((p) => !p.gone).map((p) => {
        const a = adm.get(p.lid);
        return { key: 'p:' + p.lid, lid: p.lid, name: p.name, role: roles.get('p:' + p.lid) ?? (p.ruler ? 'ruler' : p.cls), lv: p.lv, ...(p.traits ? { traits: p.traits } : {}), ...(a ? { battles: a.battles.length, battleSys: a.battles[a.battles.length - 1]?.sys ?? '' } : {}), first: p.first };
    });
}
/** 매달(명단이 들어온 뒤): 후보 쌓기 → 6개월이 지났으면 뽑기. */
function onMonth() {
    const sid = ctx_1.ctx.curSaveId, date = ctx_1.ctx.gameDate;
    if (!sid || !date)
        return;
    const s = saveOf(sid), people = livePeople(sid);
    if (!people.length)
        return;
    (0, letters_1.detect)(s, people, date);
    const label = (c) => (c.kind === 'trait' ? (0, trait_names_1.traitLabel)(loc().names, c.detail) : c.detail);
    const r = (0, letters_1.draw)(s, people, date, all().freq, (k) => (0, persona_app_1.personaLast)(sid, k), Math.random, label);
    if ((0, gestalt_app_1.gestaltCode)())
        for (const l of r.letters)
            delete l.favor; // 단일 의식 제국의 인물에게는 휴가·고향·동료 추천 같은 개인적인 부탁이 없다(2026-10-19)
    for (const m of r.memos)
        (0, persona_app_1.personaNote)(sid, m.key, m.text);
    save();
    if (r.letters.length) {
        (0, diagnostics_1.logDiagnostic)('info', 'letters.drawn', { n: r.letters.length, favors: r.letters.filter((l) => l.favor).length });
        const first = r.letters[0];
        office_app_1.office.toastGo = 'letters';
        ctx_1.ctx.notify({ kind: 'office', title: r.letters.length > 1 ? L(`개인 서신 ${r.letters.length}통이 도착했습니다`, `${r.letters.length} personal letters have arrived`) : subject(first), body: L('집무실의 개인 서신에서 읽을 수 있습니다.', 'Read them in Personal Letters in the office.'), action: L('개인 서신', 'Personal Letters') });
    }
    badge();
}
/** 봉투 제목(앱이 정함, AI 없음). */
function subject(l) {
    const k = l.kinds[0]?.kind, n = l.name;
    if (l.final)
        return l.final === 'fired' ? L(`떠나는 ${n}의 작별 편지`, `A farewell from ${n}`) : L(`${n}의 마지막 편지`, `The last letter of ${n}`);
    const t = k === 'levelup' ? L(`${n}의 승진 소식`, `News of a promotion from ${n}`)
        : k === 'trait' ? L(`${n}의 근황`, `News from ${n}`)
            : k === 'battle' ? L(`전투를 마친 ${n}의 편지`, `A letter from ${n} after battle`)
                : L(`오랜만에 온 ${n}의 안부`, `Greetings from ${n} after a long silence`);
    return t;
}
const view = (l) => ({ final: l.final ?? '', id: l.id, key: l.key, name: l.name, role: l.role, date: l.date, subject: subject(l), read: l.read, body: l.body ?? '', favor: l.favor ? { kind: l.favor.kind, state: l.favor.state, note: l.favor.note ?? '', energy: letters_1.FAVORS[l.favor.kind].energy } : null, reply: l.reply ?? null });
function listView() {
    const sid = ctx_1.ctx.curSaveId;
    const s = sid ? saveOf(sid) : (0, letters_1.emptyLetters)();
    return { sid, running: ctx_1.ctx.gameRunning, freq: all().freq, unread: (0, letters_1.unreadCount)(s), letters: s.letters.slice().reverse().map(view) };
}
/** 편지를 보낸 인물: 지금 연락처에 있으면 그 정보, 떠났으면 편지에 적힌 이름·직책만. */
const personFor = (l) => (0, persona_app_1.personOf)(l.key) ?? { key: l.key, name: l.name, role: l.role, ...(l.traits && l.traits.length ? { traits: l.traits } : {}), ...((0, gestalt_app_1.gestaltCode)() ? { gestalt: (0, gestalt_app_1.gestaltCode)() } : {}) };
const busy = new Set();
const FAVOR_MEMO = { leave: '휴가', colleague: '동료 추천', homeworld: '고향 행성 지원' };
const FAVOR_MEMO_EN = { leave: 'leave', colleague: 'colleague recommendation', homeworld: 'home planet aid' };
/** 이 인물에게서 받은 편지 수(추모관 비석의 "남긴 일"). */
const lettersFrom = (sid, key) => saveOf(sid).letters.filter((l) => l.key === key && !l.final).length;
exports.lettersFrom = lettersFrom;
/** 작별 편지(memorial-app 이 부른다): 6개월 뽑기·1년 한도와 상관없이 바로 봉투. 본문은 열 때. */
function addFarewell(sid, a) {
    const s = saveOf(sid);
    if (s.letters.some((l) => l.key === a.key && l.final))
        return; // 한 사람에게 한 통
    const l = { id: s.next++, key: a.key, lid: a.lid, name: a.name, role: a.role, date: a.date, kinds: [{ kind: 'farewell', detail: a.why }], read: false, final: a.why, ...(a.traits && a.traits.length ? { traits: a.traits.slice(0, 12) } : {}) };
    s.letters.push(l);
    save();
    office_app_1.office.toastGo = 'letters';
    ctx_1.ctx.notify({ kind: 'office', title: subject(l), body: L('집무실의 개인 서신에서 읽을 수 있습니다.', 'Read it in Personal Letters in the office.'), action: L('개인 서신', 'Personal Letters') });
    badge();
}
function registerLetters() {
    (0, office_app_1.setOfficeLetters)(unread);
    (0, people_app_1.onPeopleChanged)(onMonth);
    electron_1.ipcMain.handle('lettersList', async () => listView());
    electron_1.ipcMain.handle('officeLetterBadge', async () => unread());
    /** 모두 읽음 표시(2026-10-18): 봉투만 읽음으로 바꾼다. 본문(AI)은 쓰지 않고, 나중에 직접 열 때 처음 쓴다. */
    electron_1.ipcMain.handle('lettersReadAll', async () => {
        const sid = ctx_1.ctx.curSaveId;
        if (!sid)
            return listView();
        let n = 0;
        for (const l of saveOf(sid).letters)
            if (!l.read) {
                l.read = true;
                n++;
            }
        if (n) {
            save();
            badge();
        }
        return listView();
    });
    electron_1.ipcMain.handle('letterFreq', async (_e, f) => { if (typeof f === 'string' && f in letters_1.DRAW_COUNT) {
        all().freq = f;
        save();
    } return listView(); });
    /** 봉투 열기: 읽음 표시, 본문이 없으면 이때 한 번 AI 로 쓴다. */
    electron_1.ipcMain.handle('letterOpen', async (_e, id) => {
        const sid = ctx_1.ctx.curSaveId;
        if (!sid)
            return { ok: false, error: L('세이브를 불러온 뒤에 읽을 수 있습니다.', 'Load a save first.') };
        const s = saveOf(sid), l = s.letters.find((x) => x.id === Number(id));
        if (!l)
            return { ok: false, error: L('편지를 찾지 못했습니다.', 'Letter not found.') };
        if (!l.read) {
            l.read = true;
            save();
            badge();
        }
        if (l.body)
            return { ok: true, letter: view(l) };
        if (busy.has(l.id))
            return { ok: false, error: L('편지를 펼치는 중입니다.', 'Still opening the letter.') };
        busy.add(l.id);
        try {
            const p = personFor(l), m = (0, persona_app_1.memOf)(sid, l.key);
            if ((0, persona_app_1.personOf)(l.key))
                await (0, persona_app_1.ensurePersona)(sid, p, m); // 말투가 정해져 있어야 편지도 그 말투로
            const body = String((await (0, persona_app_1.personaJson)((0, letters_1.letterMessages)(p, m, l, ctx_1.ctx.playerName || '', ctx_1.ctx.gameDate || '', traitNote), 2400, 'body'))?.body ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
            if (!body)
                return { ok: false, letter: view(l), error: L('편지를 읽지 못했습니다. 다시 열어 보세요.', 'Could not read the letter. Try opening it again.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            l.body = body;
            save();
            return { ok: true, letter: view(l) };
        }
        catch (e) {
            return { ok: false, letter: view(l), error: (0, aiclient_1.redactKey)(L('편지를 펼치지 못했습니다: ', 'Could not open the letter: ') + e.message) };
        }
        finally {
            busy.delete(l.id);
        }
    });
    /** 부탁: 들어주기(게임에 「지도자의 신임」 특성, 고향 지원은 에너지) / 거절. AI 없음. */
    electron_1.ipcMain.handle('letterFavor', async (_e, id, yes) => {
        const sid = ctx_1.ctx.curSaveId;
        if (!sid)
            return { ok: false, error: L('세이브를 불러온 뒤에 할 수 있습니다.', 'Load a save first.') };
        const s = saveOf(sid), l = s.letters.find((x) => x.id === Number(id)), f = l?.favor;
        if (!l || !f || f.state !== 'open')
            return { ok: false, error: L('이미 답한 부탁입니다.', 'This request was already answered.') };
        const what = FAVOR_MEMO[f.kind], whatEn = FAVOR_MEMO_EN[f.kind];
        if (!yes) {
            f.state = 'declined';
            save();
            (0, persona_app_1.personaNote)(sid, l.key, L(`지도자가 ${what} 부탁을 거절했다`, `The leader declined my ${whatEn} request`), letters_1.FAVOR_TRUST.declined);
            return { ok: true, letter: view(l) };
        }
        if (!/^\d+$/.test(sid) || !ctx_1.ctx.gameRunning)
            return { ok: false, error: L('게임이 켜져 있어야 부탁을 들어줄 수 있습니다.', 'The game must be running to grant this.') };
        if (!(0, persona_app_1.personOf)(l.key))
            return { ok: false, error: L('이 인물은 이제 제국에 없습니다.', 'This person is no longer in your empire.') };
        const cid = (0, crypto_1.randomUUID)().replace(/-/g, ''), req = ++game_link_1.link.reqCounter;
        f.state = 'pending';
        save(); // 보내기 전에 기록: 응답 전에 앱이 꺼져도 두 번 보내지 않는다
        let status = 'uncertain';
        try {
            const r = await (0, terminal_1.terminalRequest)((0, letters_1.favorCommand)(req, sid, cid, l.lid, letters_1.FAVORS[f.kind].energy), 'LETTERAPPLY', req);
            if (r.kv.cid === cid && r.kv.sid === sid)
                status = r.kv.status ?? 'uncertain';
        }
        catch (e) {
            (0, diagnostics_1.logDiagnostic)('warn', 'letters.favor.failed', { error: String(e) });
        }
        if (status === 'applied') {
            f.state = 'granted';
            f.note = '';
            (0, persona_app_1.personaNote)(sid, l.key, L(`지도자가 ${what} 부탁을 들어주었다`, `The leader granted my ${whatEn} request`), letters_1.FAVOR_TRUST.granted);
        }
        else if (status === 'poor') {
            f.state = 'open';
            f.note = L('에너지가 모자라 들어주지 못했습니다.', 'Not enough energy.');
        }
        else if (status === 'no_target') {
            f.state = 'failed';
            f.note = L('게임에서 이 인물을 찾지 못했습니다.', 'This person was not found in game.');
        }
        else if (status === 'duplicate') {
            f.state = 'granted';
            f.note = '';
        }
        else {
            f.state = 'failed';
            f.note = L('게임 적용을 확인하지 못했습니다(자동 재전송 없음).', 'Could not confirm in game (no automatic resend).');
        }
        save();
        (0, diagnostics_1.logDiagnostic)('info', 'letters.favor', { kind: f.kind, status });
        return { ok: true, letter: view(l) };
    });
    /** 직접 답장(편지마다 한 번): 인물의 짧은 회신 + 관계 ±2 + 기억 한 줄. */
    electron_1.ipcMain.handle('letterReply', async (_e, id, text) => {
        const sid = ctx_1.ctx.curSaveId, t = (0, persona_1.cleanLine)(text, 800);
        if (!sid || !t)
            return { ok: false, error: L('답장을 입력하세요.', 'Write a reply first.') };
        const s = saveOf(sid), l = s.letters.find((x) => x.id === Number(id));
        if (!l || !l.body)
            return { ok: false, error: L('편지를 먼저 열어 주세요.', 'Open the letter first.') };
        if (l.reply)
            return { ok: false, error: L('이미 답장을 보냈습니다.', 'You already replied.') };
        if (l.final === 'death' || l.final === 'fallen')
            return { ok: false, error: L('세상을 떠난 인물에게는 답장을 보낼 수 없습니다.', 'You cannot reply to someone who has passed away.') };
        if (busy.has(l.id))
            return { ok: false, error: L('이미 답을 기다리는 중입니다.', 'Already waiting for a reply.') };
        busy.add(l.id);
        try {
            const p = personFor(l), m = (0, persona_app_1.memOf)(sid, l.key);
            const j = await (0, persona_app_1.personaJson)((0, letters_1.replyMessages)(p, m, l, t, ctx_1.ctx.playerName || ''), 1500, 'reply'), them = (0, persona_1.cleanLine)(j?.reply, 600);
            if (!them)
                return { ok: false, error: L('회신을 읽지 못했습니다. 다시 보내 보세요.', 'Could not read the response. Try again.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            let d = Math.round(Number(j?.move));
            if (!Number.isFinite(d))
                d = 0;
            d = Math.max(-persona_1.STEP_CAP, Math.min(persona_1.STEP_CAP, d));
            l.reply = { me: t, them };
            save();
            (0, persona_app_1.personaNote)(sid, l.key, (0, persona_1.cleanLine)(j?.memory, 160) || L('지도자가 편지에 답장을 보냈다', 'The leader replied to my letter'), d);
            return { ok: true, letter: view(l), delta: d };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message) };
        }
        finally {
            busy.delete(l.id);
        }
    });
}
//# sourceMappingURL=letters-app.js.map
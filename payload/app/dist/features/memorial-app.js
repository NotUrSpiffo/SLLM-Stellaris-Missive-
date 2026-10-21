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
exports.memorialAgentLost = memorialAgentLost;
exports.registerMemorial = registerMemorial;
// 집무실 4단계: 작별·추모관(앱 쪽, 2026-10-18). 순수 로직은 src/memorial.ts.
// 모드가 지도자 사망·해임 때 SLLM:LEADEROUT(lid·why·date·name)을 남기면(people-app 이 넘겨 줌) 그 순간의 자료로 비석을 세우거나(사망)
// 「떠난 사람들」에 올린다(해임). 명단에서 이유 없이 사라진 인물은 「행방 불명」, 다시 나타나면 지운다.
// 작별 편지는 매달 명단 뒤에 관계 깊은 순으로 FAREWELL_CAP 통(letters-app.addFarewell). 비문은 비석을 처음 볼 때 AI 한 번.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const aiclient_1 = require("../aiclient");
const office_app_1 = require("./office-app");
const fleet_app_1 = require("./fleet-app");
const people_app_1 = require("./people-app");
const persona_app_1 = require("./persona-app");
const letters_app_1 = require("./letters-app");
const gestalt_app_1 = require("./gestalt-app");
const chronicle_app_1 = require("./chronicle-app");
const settings_ui_1 = require("./settings-ui");
const trait_names_1 = require("../trait-names");
const persona_1 = require("../persona");
const memorial_1 = require("../memorial");
const L = settings_ui_1.pick;
const ROLE_EN = { ruler: 'Ruler', governor: 'Governor', admiral: 'Admiral', general: 'General', scientist: 'Scientist', commander: 'Commander', official: 'Official' };
const roleName = (r) => (r === 'agent' ? L('첩보 공작원', 'Field agent') : L(persona_1.ROLE_KO[r] ?? '인물', ROLE_EN[r] ?? 'Leader'));
let data = null;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_memorial.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = j && typeof j === 'object' ? j : {};
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'memorial', error: e });
        data = {};
    }
    return data;
}
function save() { try {
    const tmp = file() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8');
    fs.renameSync(tmp, file());
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'memorial', error: e });
} }
const saveOf = (sid) => { const s = (all()[sid] ??= (0, memorial_1.emptyMemorial)()); s.stones ??= []; s.departed ??= []; s.queue ??= []; return s; };
const unseen = () => (ctx_1.ctx.curSaveId ? saveOf(ctx_1.ctx.curSaveId).stones.filter((x) => !x.seen).length : 0);
const loc = () => (0, trait_names_1.traitLoc)(ctx_1.ctx.flagProv.game(), (0, settings_ui_1.selectedLanguage)() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
/** 모드 신호: 사망(death)·해임(fired). 그 순간 아직 명단에 있는 자료로 남긴다. */
function onOut(kv) {
    const sid = ctx_1.ctx.curSaveId, lid = Number(kv.lid), why0 = kv.why;
    if (!sid || !Number.isInteger(lid) || lid <= 0 || (why0 !== 'death' && why0 !== 'fired'))
        return;
    const s = saveOf(sid), key = 'p:' + lid, date = String(kv.date || ctx_1.ctx.gameDate || '').trim();
    if (s.stones.some((x) => x.key === key))
        return;
    s.departed = s.departed.filter((d) => !(d.key === key && d.why === 'lost')); // 명단이 먼저 와서 행방 불명으로 올렸던 경우
    if (s.departed.some((d) => d.key === key))
        return;
    const op = (0, office_app_1.officeView)().people.find((p) => p.key === key);
    const raw = (0, people_app_1.peopleOf)(sid).find((p) => p.lid === lid);
    const adm = (0, fleet_app_1.fleetView)().admirals.find((a) => a.lid === lid);
    const name = String(raw?.name || kv.name || '').trim().slice(0, 60);
    if (!name)
        return;
    const role = op?.role ?? (raw?.ruler ? 'ruler' : raw?.cls ?? 'official');
    const mem = (0, persona_app_1.memOf)(sid, key), letters = (0, letters_app_1.lettersFrom)(sid, key);
    let why = why0;
    if (why0 === 'death') {
        why = (0, memorial_1.deathKind)((adm?.battles ?? []).map((b) => b.date ?? ''), date);
        const st = { key, lid, name, role, why: why, first: raw?.first ?? '', gone: date, lv: raw?.lv, ...(raw?.traits?.length ? { traits: raw.traits.slice() } : {}),
            ...(op?.planet ? { planet: op.planet } : {}), ...(op?.fleet || raw?.fleet ? { fleet: op?.fleet ?? raw?.fleet } : {}), ...(raw?.council ? { council: true } : {}),
            ...(adm ? { battles: adm.battles.length, acclaimed: adm.status === 'acclaimed', reprimanded: adm.status === 'reprimanded' } : {}),
            letters, talks: mem.talks, trust: mem.trust, mems: mem.mems.slice(-3).map((m) => m.text), seen: false };
        s.stones.push(st);
        if (ctx_1.ctx.playerIdx > 0)
            (0, chronicle_app_1.chronNote)(ctx_1.ctx.playerIdx, (0, memorial_1.chronLine)(st), true);
        const living = (0, office_app_1.officeView)().people.filter((p) => p.key.startsWith('p:'));
        for (const k of (0, memorial_1.colleagues)({ key, role, council: !!raw?.council }, living, (k2) => (0, persona_app_1.memOf)(sid, k2).talks > 0))
            (0, persona_app_1.personaNote)(sid, k, (0, memorial_1.colleagueMemo)(name, st.why));
        office_app_1.office.toastGo = 'memorial';
        ctx_1.ctx.notify({ kind: 'office', title: st.why === 'fallen' ? L(`${roleName(role)} ${name} 전사`, `${roleName(role)} ${name} has fallen`) : L(`${roleName(role)} ${name} 서거`, `${roleName(role)} ${name} has passed away`), body: L('추모관에 이름이 올랐습니다.', 'Their name has been added to the Memorial.'), action: L('추모관', 'Memorial') });
    }
    else
        s.departed.push({ key, lid, name, role, why: 'fired', date, first: raw?.first ?? '' });
    if ((0, memorial_1.farewellWorthy)(mem, letters)) {
        const l = loc();
        s.queue.push({ key, why, score: (0, memorial_1.bondScore)(mem, letters), date, lid, name, role, traits: (raw?.traits ?? []).filter((t) => !/^subclass_/.test(t)).map((t) => (0, trait_names_1.traitLabel)(l.names, t)) });
    }
    save();
    (0, office_app_1.pushOffice)();
    (0, diagnostics_1.logDiagnostic)('info', 'memorial.out', { why, queued: s.queue.length });
}
/** 첩보 공작원 연락 두절(agents-app, 2026-10-20): 세상을 떠났는지 모르므로 추모관이 아니라 「떠난 사람들」(행방 불명). */
function memorialAgentLost(a) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return;
    const s = saveOf(sid);
    if (s.departed.some((d) => d.key === a.key))
        return;
    s.departed.push({ key: a.key, lid: 0, name: a.name.slice(0, 80), role: 'agent', why: 'lost', date: a.date, first: a.first });
    save();
    (0, office_app_1.pushOffice)();
    office_app_1.office.toastGo = 'memorial';
    ctx_1.ctx.notify({ kind: 'office', title: L(`공작원 「${a.code}」와(과) 연락이 끊겼습니다`, `Contact lost with agent "${a.code}"`), body: L('첩보망이 무너졌습니다. 「떠난 사람들」에 행방 불명으로 올랐습니다. 첩보망을 다시 세우면 새 공작원이 부임합니다.', 'The spy network has collapsed. They are listed as missing among the departed. Rebuild the network and a new agent will be posted.'), action: L('추모관', 'Memorial') });
    (0, diagnostics_1.logDiagnostic)('info', 'memorial.agent_lost', {});
}
/** 매달(명단 뒤): 작별 편지 보내기(관계 깊은 순으로 3통), 이유 없이 사라진 인물은 행방 불명, 돌아온 인물은 지우기. */
function onMonth() {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return;
    const s = saveOf(sid), people = (0, people_app_1.peopleOf)(sid);
    let ch = false;
    if (s.queue.length) {
        for (const q of (0, memorial_1.pickFarewells)(s.queue))
            if (q.why !== 'lost' && q.lid && q.name)
                (0, letters_app_1.addFarewell)(sid, { key: q.key, lid: q.lid, name: q.name, role: q.role ?? 'official', why: q.why, date: q.date, traits: q.traits });
        s.queue = [];
        ch = true;
    }
    const roster = people.filter((p) => !p.gone).map((p) => p.last).sort().pop();
    if (roster)
        for (const p of people) {
            const key = 'p:' + p.lid;
            if (p.gone && p.gone === roster && !s.stones.some((x) => x.key === key) && !s.departed.some((d) => d.key === key)) {
                s.departed.push({ key, lid: p.lid, name: p.name, role: p.ruler ? 'ruler' : p.cls, why: 'lost', date: p.gone, first: p.first });
                ch = true;
            }
            if (!p.gone && s.departed.some((d) => d.key === key)) {
                s.departed = s.departed.filter((d) => d.key !== key);
                ch = true;
            } // 돌아옴(포로 석방 등)
        }
    if (ch) {
        save();
        (0, office_app_1.pushOffice)();
    }
}
function stoneView(st) {
    const l = loc();
    return { ...st, roleName: roleName(st.role), traitNames: (st.traits ?? []).filter((t) => !/^subclass_/.test(t)).map((t) => (0, trait_names_1.traitLabel)(l.names, t)), deeds: (0, memorial_1.deeds)(st) };
}
function listView() {
    const sid = ctx_1.ctx.curSaveId, s = sid ? saveOf(sid) : (0, memorial_1.emptyMemorial)();
    return { sid, stones: s.stones.slice().reverse().map(stoneView), departed: s.departed.slice().reverse().map((d) => ({ ...d, roleName: roleName(d.role) })), unseen: s.stones.filter((x) => !x.seen).length };
}
const busy = new Set();
function registerMemorial() {
    (0, office_app_1.setOfficeMemorial)(unseen);
    (0, people_app_1.onLeaderOut)(onOut);
    (0, people_app_1.onPeopleChanged)(onMonth);
    electron_1.ipcMain.handle('memorialList', async () => listView());
    electron_1.ipcMain.handle('memorialSeen', async (_e, key) => { const sid = ctx_1.ctx.curSaveId; if (!sid)
        return null; const st = saveOf(sid).stones.find((x) => x.key === String(key)); if (st && !st.seen) {
        st.seen = true;
        save();
        (0, office_app_1.pushOffice)();
    } return st ? stoneView(st) : null; });
    /** 비문: 없으면 이때 한 번 AI. */
    electron_1.ipcMain.handle('memorialEpitaph', async (_e, key) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? '');
        if (!sid)
            return { ok: false, error: L('세이브를 불러온 뒤에 볼 수 있습니다.', 'Load a save first.') };
        const st = saveOf(sid).stones.find((x) => x.key === k);
        if (!st)
            return { ok: false, error: L('비석을 찾지 못했습니다.', 'Stone not found.') };
        if (st.epitaph)
            return { ok: true, stone: stoneView(st) };
        if (busy.has(k))
            return { ok: false, error: L('비문을 새기는 중입니다.', 'Still engraving.') };
        busy.add(k);
        try {
            const v = stoneView(st);
            const t = (0, memorial_1.cleanEpitaph)((await (0, persona_app_1.personaJson)((0, memorial_1.epitaphMessages)(st, (0, persona_app_1.memOf)(sid, k).persona ?? '', v.traitNames, ctx_1.ctx.playerName || '', (0, gestalt_app_1.gestaltCode)()), 800, 'epitaph'))?.epitaph);
            if (!t)
                return { ok: false, stone: v, error: L('비문을 읽지 못했습니다. 직접 새겨 보세요.', 'Could not read the epitaph. Try writing one yourself.') };
            if (ctx_1.ctx.curSaveId !== sid)
                return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
            st.epitaph = t;
            st.epitaphBy = 'ai';
            save();
            return { ok: true, stone: stoneView(st) };
        }
        catch (e) {
            return { ok: false, stone: stoneView(st), error: (0, aiclient_1.redactKey)(L('비문을 새기지 못했습니다: ', 'Could not engrave: ') + e.message) };
        }
        finally {
            busy.delete(k);
        }
    });
    electron_1.ipcMain.handle('memorialSetEpitaph', async (_e, key, text) => {
        const sid = ctx_1.ctx.curSaveId;
        if (!sid)
            return null;
        const st = saveOf(sid).stones.find((x) => x.key === String(key));
        const t = (0, memorial_1.cleanEpitaph)(text);
        if (!st || !t)
            return null;
        st.epitaph = t;
        st.epitaphBy = 'me';
        save();
        return stoneView(st);
    });
}
//# sourceMappingURL=memorial-app.js.map
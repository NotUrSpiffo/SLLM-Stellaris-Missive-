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
exports.CAB_MIN = exports.FEW_NONE = exports.fac = void 0;
exports.setCabinetPersona = setCabinetPersona;
exports.setCabinetOfficeNotify = setCabinetOfficeNotify;
exports.cabinetReady = cabinetReady;
exports.openFactionMeeting = openFactionMeeting;
exports.closeFactionMeeting = closeFactionMeeting;
exports.onFactionSnapshot = onFactionSnapshot;
exports.openPendingFactionMeeting = openPendingFactionMeeting;
exports.registerFactionLog = registerFactionLog;
exports.registerFaction = registerFaction;
// 내각(장관) 회의 창과 게임 연결(2026-10-19 사용자 결정: 파벌 회의를 버리고 평의회 장관들과 회의). 규칙은 src/cabinet-meeting.ts.
// 창·IPC 이름(facOpen·facState·facPick·facSay·facApply·facClose·devFacDemo, ui/faction.html)과 알림 종류('faction')는 예전 내정·파벌 회의 그대로 쓴다.
// 알림: 월간 상황에서 평의회 의제 칸이 새로 비면 "내각 회의를 소집할까요?". 게임에서 직접 의제를 고르면 열린 회의를 취소한다.
// 참석자: 인물 장부(people-app)의 평의원(통치자 제외). 직책은 모드가 매달 cpos 로 알려 준다(옛 모드면 지도자 계열로 짐작).
// 적용: 예약 기록 → 콘솔 한 줄(sllm_probe_fac_* 재사용) → 모드의 FACMEET 확인. 불확실하면 자동 재전송하지 않는다.
// 채택 뒤 장관들의 1:1 통신 기억·신뢰는 main.ts 가 setCabinetPersona 로 넘겨 준 함수로 남긴다(persona-app 을 직접 가져오면 가져오기 고리가 생긴다).
const electron_1 = require("electron");
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const cabinet_meeting_1 = require("../cabinet-meeting");
const faction_meeting_1 = require("../faction-meeting");
const summit_core_1 = require("../summit-core");
const game_link_1 = require("../app/game-link");
const settings_1 = require("../app/settings");
const log_router_1 = require("../app/log-router");
const safe_send_1 = require("../safe-send");
const ctx_1 = require("../app/ctx");
const chronicle_app_1 = require("./chronicle-app");
const speciesClass_1 = require("../speciesClass");
const policy_app_1 = require("./policy-app");
const people_app_1 = require("./people-app");
const settings_ui_1 = require("./settings-ui");
const trait_names_1 = require("../trait-names");
const paragons_1 = require("../paragons");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
const T = (x) => L(x[0], x[1]);
let persona = null;
function setCabinetPersona(p) { persona = p; }
/** 집무실(office-app)에 「내각 회의 준비됨」을 알리는 고리(가져오기 고리를 만들지 않으려고 main.ts 가 꽂는다, 2026-10-19). */
let officeNotify = () => { };
function setCabinetOfficeNotify(fn) { officeNotify = fn; }
/** 집무실 책상 태블릿·알람용: 지금 열 수 있는 내각 회의(없으면 null). key 는 같은 소집을 두 번 알리지 않으려고. */
function cabinetReady() {
    const s = exports.fac.pendingSnap;
    if (!s || s.sid !== ctx_1.ctx.curSaveId || (exports.fac.info && !exports.fac.info.demo && exports.fac.win))
        return null;
    const n = (0, cabinet_meeting_1.cabMembersFrom)((0, people_app_1.peopleOf)(s.sid)).length;
    return n >= exports.CAB_MIN ? { key: s.sid + ':' + s.date, n, date: s.date } : null;
}
exports.fac = {
    win: null,
    info: null,
    proposals: [],
    pick: 0, // 논의에 올린 발의 장관 lid(0 = 아직 고르지 않음)
    busy: false, applied: false, uncertain: false, aiDemo: false, cancelled: '',
    epoch: 0,
    heard: new Set(),
    log: [],
    /** 세이브마다 마지막으로 본 의제 칸 상태(새로 빈 순간에만 알린다) */
    lastFree: new Map(),
    /** 알림을 눌렀을 때 열 회의 자료 */
    pendingSnap: null,
    /** 의제 칸은 비었지만 평의원이 없어 회의를 열 수 없는 상태(안내 문구용) */
    few: null,
    ackWaiter: null,
};
const sys = (text) => { exports.fac.log.push({ who: '', text, kind: 'sys' }); if (exports.fac.log.length > 200)
    exports.fac.log.splice(0, exports.fac.log.length - 200); };
/** 게임 의제를 설정할 수 없는 이유('' = 채택 시 게임 의제도 설정). */
function gameNote(id, info) {
    if (info.demo)
        return L('시험 회의 — 게임 미적용', 'Test meeting — not applied to the game');
    const a = (0, cabinet_meeting_1.agendaOf)(id);
    if (!a)
        return '';
    if ((0, faction_meeting_1.agendaGameKey)(a, info.empireEth, info.agendaAvail))
        return '';
    if (info.empireEth === undefined)
        return L('제국 가치관 미확인 — 버프만', 'Empire ethics unknown — buffs only');
    if (a.avail)
        return info.agendaAvail === undefined ? L('의제 조건 미확인(모드 갱신 필요) — 버프만', 'Agenda conditions unknown (update the mod) — buffs only') : L('게임 조건(전통·DLC 등) 미충족 — 버프만', 'Game requirements (tradition, DLC) not met — buffs only');
    const need = a.ethics.map((e) => faction_meeting_1.ETHIC_NAMES[e]).join('·');
    return L(`제국이 ${need}가 아니라 게임 의제 불가 — 버프만`, `Empire lacks the required ethic — buffs only`);
}
function view() {
    const info = exports.fac.info;
    if (!info)
        return null;
    return {
        empire: info.empire, date: info.date, demo: !!info.demo, playerCls: info.playerCls ?? 'human', aiDemo: exports.fac.aiDemo, busy: exports.fac.busy, applied: exports.fac.applied, uncertain: exports.fac.uncertain, cancelled: exports.fac.cancelled,
        members: info.members.map((m) => ({ away: m.away ? (m.away === '1' ? L('임무 중', 'On assignment') : m.away) : '', lid: m.lid, name: m.name, cls: m.cls, lv: m.lv, domain: m.domain, title: T(m.title), domainName: T(cabinet_meeting_1.DOMAIN_KO[m.domain]), traits: m.traits.slice(0, 4), trust: m.trust ?? 0, stance: m.stance, vote: (0, cabinet_meeting_1.cabVoteOf)(m.stance), heard: exports.fac.heard.has(m.lid) })),
        proposals: exports.fac.proposals.map((x) => { const t = (0, cabinet_meeting_1.agendaText)(x.agenda), a = (0, cabinet_meeting_1.agendaOf)(x.agenda); return { lid: x.lid, co: x.co ?? [], agenda: T(t.name), desc: T(t.desc), verified: !!a && !!(0, faction_meeting_1.agendaGameKey)(a, info.empireEth, info.agendaAvail), gameNote: gameNote(x.agenda, info), rewards: x.rewards.map((r) => T(r.label)) }; }),
        pick: exports.fac.pick, log: exports.fac.log, days: cabinet_meeting_1.CAB_TUNE.buffDays,
        allHeard: (() => { const sp = exports.fac.proposals.find((x) => x.lid === exports.fac.pick); return info.members.every((m) => exports.fac.heard.has(m.lid) || (!!sp && (0, cabinet_meeting_1.sponsorsOf)(sp).includes(m.lid))); })(),
    };
}
const push = () => (0, safe_send_1.safeSend)(exports.fac.win, 'facState', view());
function openFactionMeeting(info, aiDemo = false) {
    if (exports.fac.busy)
        return false;
    if (info.members.length < exports.CAB_MIN)
        return false; // 평의원(통치자 제외) 2명 이상일 때만(2026-10-19 사용자 결정)
    exports.fac.info = { ...info, members: info.members.map((m) => ({ ...m, stance: 0 })) };
    exports.fac.proposals = (0, cabinet_meeting_1.cabProposals)(exports.fac.info);
    exports.fac.pick = 0;
    exports.fac.applied = false;
    exports.fac.uncertain = false;
    exports.fac.cancelled = '';
    exports.fac.aiDemo = aiDemo && !!info.demo;
    exports.fac.epoch = game_link_1.link.epoch;
    exports.fac.heard = new Set();
    exports.fac.log = [];
    sys(`${info.demo ? L('[시험] ', '[Test] ') : ''}${L(`내각 회의를 열었습니다. 참석 장관 ${info.members.length}명. 논의할 안건을 고르세요.`, `The cabinet meeting is open. ${info.members.length} minister(s) present. Choose an agenda to discuss.`)}`);
    (0, diagnostics_1.logDiagnostic)('info', 'cabinet.open', { sid: info.sid, demo: !!info.demo, members: info.members.length, known: info.members.filter((m) => m.cpos > 0).length });
    if (exports.fac.win && !exports.fac.win.isDestroyed()) {
        exports.fac.win.show();
        exports.fac.win.focus();
        push();
        return true;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea;
    const sz = { width: Math.min(1500, Math.round(area.width * 0.9)), height: Math.min(940, Math.round(area.height * 0.9)) };
    // 집무실이 열려 있으면 그 창과 같은 자리·크기로 연다(집무실의 연장, 2026-10-19). 아니면 화면 가운데.
    const ow = electron_1.BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL()));
    const ob = ow ? ow.getBounds() : null;
    const w = new electron_1.BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#0b1820', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
    exports.fac.win = w;
    w.setAlwaysOnTop(true, 'screen-saver', 1);
    void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'cabinet-room.html')); // 회의실(1인칭, 2026-10-19). 예전 표 화면 faction.html 은 남겨 둠
    w.once('ready-to-show', () => { w.show(); push(); });
    w.on('closed', () => { if (exports.fac.win === w) {
        exports.fac.win = null;
        exports.fac.info = null;
    } officeNotify(); if (ow && !ow.isDestroyed())
        ow.focus(); }); // 집무실로 돌아감
    return true;
}
function closeFactionMeeting() { if (exports.fac.win && !exports.fac.win.isDestroyed())
    exports.fac.win.close(); exports.fac.win = null; exports.fac.info = null; }
/** 지금 세이브의 평의원(장관) + 1:1 통신 기억·특성 이름. */
function membersNow(sid) {
    const people = (0, people_app_1.peopleOf)(sid);
    const loc = (0, trait_names_1.traitLoc)(ctx_1.ctx.flagProv.game(), (0, settings_ui_1.selectedLanguage)() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
    const pidx = (0, paragons_1.paragonIndex)(ctx_1.ctx.flagProv.game(), (0, settings_ui_1.selectedLanguage)() === 'ko' ? 'ko' : 'en'); // i18n-data: 파라곤 배경(게임 지역화)
    return (0, cabinet_meeting_1.cabMembersFrom)(people).map((m) => {
        const p = people.find((x) => x.lid === m.lid), mem = persona?.mem(sid, 'p:' + m.lid) ?? null;
        const pg = (0, paragons_1.paragonFor)(m.name, pidx);
        return { ...m, ...(pg ? { paragon: pg.desc.slice(0, 300) } : {}), traits: (p?.traits ?? []).map((k) => (0, trait_names_1.traitLabel)(loc.names, k)), ...(mem ? { persona: mem.persona, trust: mem.trust, mems: mem.mems.slice(-3).map((x) => x.text) } : {}) };
    });
}
function infoFromSnap(s) {
    const playerCls = (0, speciesClass_1.classKey)(ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.cls) ?? 'human';
    return { sid: s.sid, date: s.date, empire: ctx_1.ctx.playerName || L('우리 제국', 'Our empire'), playerCls, members: membersNow(s.sid), empireEth: s.empireEth, ...(s.agendaAvail !== undefined ? { agendaAvail: s.agendaAvail } : {}), gestalt: s.gestalt === true };
}
/** gamestate-app 이 월간 상황을 완성할 때 부른다: 의제 칸이 새로 비면 알림, 게임에서 의제를 고르면 열린 회의 취소. (이름은 예전 그대로) */
function onFactionSnapshot(s, agendaFinished = false) {
    if (s.agendaFree === undefined || !s.sid)
        return;
    if (s.gestalt === true) {
        exports.fac.pendingSnap = null;
        exports.fac.lastFree.set(s.sid, agendaFinished || s.agendaFree);
        return;
    } // 단일 의식(기계 지성·군체) 제국에는 내각(옛 파벌) 회의를 소집하지 않는다(2026-10-19 사용자 결정)
    const before = exports.fac.lastFree.get(s.sid);
    exports.fac.lastFree.set(s.sid, agendaFinished || s.agendaFree);
    const info = exports.fac.info;
    if (!s.agendaFree && !agendaFinished) {
        if (exports.fac.pendingSnap) {
            exports.fac.pendingSnap = null;
            officeNotify();
        }
        if (info && !info.demo && info.sid === s.sid && !exports.fac.applied && !exports.fac.uncertain && !exports.fac.busy) {
            exports.fac.cancelled = L('게임에서 평의회 의제를 직접 골라 회의가 취소되었습니다.', 'A council agenda was chosen in the game, so the meeting was cancelled.');
            sys(exports.fac.cancelled);
            push();
        }
        return;
    }
    const n = (0, cabinet_meeting_1.cabMembersFrom)((0, people_app_1.peopleOf)(s.sid)).length;
    exports.fac.few = n < exports.CAB_MIN ? { sid: s.sid, n } : null;
    if (n < exports.CAB_MIN) {
        exports.fac.pendingSnap = null;
        return;
    }
    if (!agendaFinished && before === true) {
        if (exports.fac.pendingSnap?.sid === s.sid)
            exports.fac.pendingSnap = s;
        return;
    }
    exports.fac.pendingSnap = s;
    officeNotify();
    ctx_1.ctx.notify({ kind: 'faction', title: L('내각 회의 소집', 'Cabinet meeting'), body: `${agendaFinished ? L('제국 평의회 의제가 완료되었습니다.', 'The council agenda is complete.') : L('제국 평의회가 새 의제를 정할 수 있습니다.', 'The council can choose a new agenda.')} ${L(`장관 ${n}명이 안건을 준비했습니다. 회의를 소집할까요?`, `${n} minister(s) have prepared proposals. Convene the meeting?`)}`, action: L('회의 소집', 'Convene') });
}
/** 알림 버튼: 마지막 상황으로 회의를 연다. */
function openPendingFactionMeeting() {
    const s = exports.fac.pendingSnap ?? null;
    if (!s || s.sid !== ctx_1.ctx.curSaveId)
        return false;
    return openFactionMeeting(infoFromSnap(s));
}
function registerFactionLog(router) {
    router.on(log_router_1.SLOT.FACTION_MEET, 'faction:meet', (m) => { if (m.kind === 'FACMEET' && exports.fac.ackWaiter)
        exports.fac.ackWaiter(m); });
}
const M = (lid, name, cls, lv, cpos, traits, trust) => ({ lid, name, cls, lv, cpos, traits, trust, stance: 0 });
const sample = () => {
    const raw = [M(1, '아이언 바르가스', 'commander', 5, 1, ['노련한 전략가'], 20), M(2, '엘라 쿠오', 'scientist', 4, 2, ['호기심 많음'], 45), M(3, '세렌 다브', 'official', 3, 3, ['협상가'], 0), M(4, '보르그 탈린', 'official', 2, 113, ['실용주의자'], -25)];
    const members = (0, cabinet_meeting_1.cabMembersFrom)(raw.map((r) => ({ ...r, council: true }))).map((m) => { const r = raw.find((x) => x.lid === m.lid); return { ...m, traits: r.traits, trust: r.trust }; });
    return { sid: '0', date: '2230.01.01', empire: L('[시험] 테란 공화국', '[Test] Terran Republic'), demo: true, playerCls: 'human', members, empireEth: faction_meeting_1.ETHIC_BITS.militarist | faction_meeting_1.ETHIC_BITS.materialist };
};
exports.FEW_NONE = '평의회에 장관이 없어 회의를 열 수 없습니다.';
/** 내각 회의를 열 수 있는 최소 평의원 수(통치자 제외, 2026-10-19 사용자 결정). */
exports.CAB_MIN = 2;
const fewText = (n) => n < 1 ? L(exports.FEW_NONE, 'There are no ministers on the council, so the meeting cannot be held.') : L(`내각 회의는 평의원(통치자 제외)이 ${exports.CAB_MIN}명 이상일 때 열 수 있습니다. 지금은 ${n}명입니다.`, `A cabinet meeting needs at least ${exports.CAB_MIN} councillors besides the ruler. There are ${n} now.`);
function registerFaction() {
    electron_1.ipcMain.handle('facOpen', async () => {
        const s = exports.fac.pendingSnap;
        if (!s && exports.fac.few && exports.fac.few.sid === ctx_1.ctx.curSaveId)
            return { ok: false, error: fewText(exports.fac.few.n) };
        if (!s || s.sid !== ctx_1.ctx.curSaveId)
            return { ok: false, error: L('지금 열 수 있는 내각 회의가 없습니다. 평의회 의제 칸이 비면 알림이 옵니다.', 'No cabinet meeting can be held right now. You will be notified when a council agenda slot opens.') };
        const info = infoFromSnap(s);
        if (info.members.length < exports.CAB_MIN)
            return { ok: false, error: fewText(info.members.length) };
        return { ok: openFactionMeeting(info) };
    });
    electron_1.ipcMain.handle('devFacDemo', async (_e, ai) => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: L('개발자 모드에서만 사용할 수 있습니다.', 'Available only in developer mode.') };
        return { ok: openFactionMeeting(sample(), ai === true), message: ai === true ? L('시험 장관들에게 실제 AI를 연결했습니다. API를 사용하지만 게임에는 적용하지 않습니다.', 'Connected real AI to the test ministers. Uses the API but is not applied to the game.') : L('시험 장관들로 회의를 열었습니다. AI·게임 없이 동작합니다.', 'Opened the meeting with test ministers. Works without AI or the game.') };
    });
    electron_1.ipcMain.handle('facState', async () => view());
    electron_1.ipcMain.handle('facPick', async (_e, lid) => {
        const info = exports.fac.info;
        if (!info)
            return { ok: false, error: L('열린 회의가 없습니다.', 'No meeting is open.') };
        if (exports.fac.busy || exports.fac.applied || exports.fac.uncertain || exports.fac.cancelled)
            return { ok: false, error: L('회의 작업을 기다리거나 회의를 다시 열어 주세요.', 'Wait for the meeting, or reopen it.') };
        const p = exports.fac.proposals.find((x) => x.lid === lid);
        if (!p)
            return { ok: false, error: L('알 수 없는 안건입니다.', 'Unknown proposal.') };
        if (exports.fac.pick !== p.lid) {
            const proposer = info.members.find((m) => m.lid === p.lid);
            exports.fac.pick = p.lid;
            exports.fac.heard = new Set();
            info.members.forEach((m) => { m.stance = (0, cabinet_meeting_1.cabInitialStance)(m, proposer, p.co); });
            const coN = (p.co ?? []).map((id) => info.members.find((m) => m.lid === id)?.name).filter(Boolean).join(', ');
            sys(L(`논의 안건: ${(0, cabinet_meeting_1.agendaText)(p.agenda).name[0]} (발의: ${proposer.name}, ${proposer.title[0]}${coN ? ` · 공동 발의: ${coN}` : ''}) — 채택 시 ${p.rewards.map((r) => r.label[0]).join(', ')}`, `Agenda under discussion: ${(0, cabinet_meeting_1.agendaText)(p.agenda).name[1]} (proposed by ${proposer.name}, ${proposer.title[1]}${coN ? ` · co-sponsors: ${coN}` : ''}) — if adopted: ${p.rewards.map((r) => r.label[1]).join(', ')}`));
        }
        push();
        return { ok: true };
    });
    electron_1.ipcMain.handle('facSay', async (_e, r) => {
        const info = exports.fac.info;
        if (!info)
            return { ok: false, error: L('열린 회의가 없습니다.', 'No meeting is open.') };
        if (exports.fac.busy || exports.fac.applied || exports.fac.uncertain || exports.fac.cancelled)
            return { ok: false, error: L('회의 작업을 기다리거나 회의를 다시 열어 주세요.', 'Wait for the meeting, or reopen it.') };
        const p = exports.fac.proposals.find((x) => x.lid === exports.fac.pick);
        if (!p)
            return { ok: false, error: L('먼저 논의할 안건을 고르세요.', 'Choose an agenda to discuss first.') };
        if (!info.demo && (ctx_1.ctx.curSaveId !== info.sid || game_link_1.link.epoch !== exports.fac.epoch))
            return { ok: false, error: L('게임 상태가 바뀌었습니다. 회의를 다시 열어 주세요.', 'The game state changed. Please reopen the meeting.') };
        const text = typeof r?.text === 'string' ? r.text.trim().slice(0, 600) : '';
        if (!text)
            return { ok: false, error: L('할 말을 입력하세요.', 'Type what you want to say.') };
        const to = typeof r?.to === 'number' && info.members.some((m) => m.lid === r.to) ? r.to : null;
        const toM = to !== null ? info.members.find((m) => m.lid === to) : null;
        exports.fac.log.push({ who: L('통치자', 'Ruler') + (toM ? ` → ${toM.name}` : L(' → 전체', ' → all')), text, kind: 'me' });
        const apply = (rs) => {
            for (const rp of rs) {
                const m = info.members.find((x) => x.lid === rp.lid);
                if (!m)
                    continue;
                const before = (0, cabinet_meeting_1.cabVoteOf)(m.stance);
                m.stance = exports.fac.heard.has(m.lid) ? Math.max(m.stance - 25, Math.min(m.stance + 25, rp.stance)) : rp.stance;
                exports.fac.heard.add(m.lid);
                exports.fac.log.push({ who: `${m.name} · ${T(m.title)}`, lid: m.lid, text: rp.say + (before !== (0, cabinet_meeting_1.cabVoteOf)(m.stance) ? L(' (입장이 바뀌었습니다)', ' (changed position)') : ''), kind: 'ai' });
            }
        };
        if (info.demo && !exports.fac.aiDemo) {
            const rs = (0, cabinet_meeting_1.cabDemoReplies)(info, p, to).map((x) => ({ lid: x.lid, say: T(x.say), stance: x.stance }));
            apply(rs);
            push();
            return { ok: true, replies: rs.map((x) => ({ lid: x.lid, say: x.say })) };
        }
        exports.fac.busy = true;
        push();
        const epoch = exports.fac.epoch;
        try {
            const speakers = info.members.filter((m) => to === null || m.lid === to);
            const replies = await ctx_1.ctx.ai.session(async (chat) => {
                const out = [];
                for (let i = 0; i < speakers.length; i += 6) {
                    if (exports.fac.info !== info || (!info.demo && (ctx_1.ctx.curSaveId !== info.sid || game_link_1.link.epoch !== epoch)))
                        throw new Error(L('회의 또는 게임 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The meeting or game state changed, so the replies were not applied.'));
                    const ids = speakers.slice(i, i + 6).map((m) => m.lid);
                    out.push(...(0, cabinet_meeting_1.parseCabReplies)(await chat((0, policy_app_1.withPolicyContext)((0, cabinet_meeting_1.cabMessages)(info, p, ids, text, [...exports.fac.log, ...out], (x) => x[1]) /* 프롬프트는 영어(2026-10-19) */), { purpose: 'cabinet-meeting', json: true, maxTokens: 3000 }), ids));
                }
                return out;
            });
            if (exports.fac.info !== info)
                throw new Error(L('회의가 바뀌어 응답을 반영하지 않았습니다.', 'The meeting changed, so the replies were not applied.'));
            apply(replies);
            (0, diagnostics_1.logDiagnostic)('info', 'cabinet.debate', { sid: info.sid, speakers: replies.length });
            return { ok: true, replies: replies.map((x) => ({ lid: x.lid, say: x.say })) };
        }
        catch (e) {
            const error = e.message;
            if (exports.fac.info === info)
                sys(error);
            (0, diagnostics_1.logDiagnostic)('warn', 'cabinet.debate.failed', { error });
            return { ok: false, error };
        }
        finally {
            exports.fac.busy = false;
            push();
        }
    });
    electron_1.ipcMain.handle('facApply', async () => {
        const info = exports.fac.info;
        if (!info)
            return { ok: false, state: 'refused', error: L('열린 회의가 없습니다.', 'No meeting is open.') };
        const p = exports.fac.proposals.find((x) => x.lid === exports.fac.pick);
        const why = exports.fac.busy || exports.fac.applied || exports.fac.uncertain ? L('이미 처리 중이거나 결정한 안건입니다.', 'Already processing or decided.') : exports.fac.cancelled || (!p ? L('채택할 안건을 고르세요.', 'Choose an agenda to adopt.') : '');
        if (why)
            return { ok: false, state: 'refused', error: why };
        const t = (0, cabinet_meeting_1.agendaText)(p.agenda), proposer = info.members.find((m) => m.lid === p.lid);
        const after = () => { if (persona && !info.demo)
            for (const a of (0, cabinet_meeting_1.cabAftermath)(info, p, exports.fac.proposals)) {
                try {
                    persona.note(info.sid, 'p:' + a.lid, a.text, a.delta);
                }
                catch (e) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'cabinet.persona_note_failed', { error: String(e) });
                }
            } };
        if (info.demo) {
            exports.fac.applied = true;
            sys(L(`[시험] 채택: ${t.name[0]} (${proposer.name}). ${p.rewards.map((r) => r.label[0]).join(', ')} — 게임에는 적용하지 않았습니다.`, `[Test] Adopted: ${t.name[1]} (${proposer.name}). ${p.rewards.map((r) => r.label[1]).join(', ')} — not applied to the game.`));
            push();
            return { ok: true, state: 'demo' };
        }
        const current = () => exports.fac.info === info && ctx_1.ctx.curSaveId === info.sid && game_link_1.link.epoch === exports.fac.epoch;
        if (!current())
            return { ok: false, state: 'refused', error: L('게임 상태가 바뀌었습니다. 회의를 다시 열어 주세요.', 'The game state changed. Please reopen the meeting.') };
        exports.fac.busy = true;
        push();
        let reserved = false;
        const jkey = `cab:${info.sid}:${info.date}:${p.lid}:${p.agenda}`;
        try {
            const req = ++game_link_1.link.reqCounter, built = (0, cabinet_meeting_1.cabApplyCommand)(info, p, req);
            const journal = new summit_core_1.SummitJournal(path.join(electron_1.app.getPath('userData'), 'sllm_faction_apply.json'));
            journal.reserve(jkey, JSON.stringify({ sid: info.sid, date: info.date, agenda: p.agenda, lid: p.lid, rewards: p.rewards.map((r) => r.id), req }));
            reserved = true;
            exports.fac.uncertain = true;
            const ack = new Promise((resolve) => { const tm = setTimeout(() => { exports.fac.ackWaiter = null; resolve(null); }, 10000); exports.fac.ackWaiter = (m) => { if (Number(m.kv.req) === req && m.kv.sid === info.sid) {
                clearTimeout(tm);
                exports.fac.ackWaiter = null;
                resolve(m);
            } }; });
            await (0, game_link_1.enqueue)(async () => { if (!current())
                throw new Error(L('게임 상태가 바뀌어 적용을 중단했습니다.', 'The game state changed, so applying stopped.')); await (0, game_link_1.sendConsole)(built.command); });
            const m = await ack, ok = Number(m?.kv.ok ?? NaN), confirmed = !!m && ok === built.expected;
            journal.finish(jkey, confirmed ? 'confirmed' : 'uncertain');
            (0, diagnostics_1.logDiagnostic)(confirmed ? 'info' : 'warn', 'cabinet.apply.result', { sid: info.sid, req, expected: built.expected, ok: m ? ok : null });
            exports.fac.applied = confirmed;
            exports.fac.uncertain = !confirmed;
            const message = confirmed
                ? L(`채택·적용 확인: ${t.name[0]} (발의 ${proposer.name}, ${proposer.title[0]}) — ${p.rewards.map((r) => r.label[0]).join(', ')} 1년.${built.agendaKey ? '' : ' 이 의제는 제국 가치관상 게임에 설정할 수 없어 버프만 걸었습니다. 평의회 의제는 게임에서 직접 골라 주세요.'}`, `Adopted and confirmed: ${t.name[1]} (proposed by ${proposer.name}, ${proposer.title[1]}) — ${p.rewards.map((r) => r.label[1]).join(', ')} for 1 year.${built.agendaKey ? '' : ' This agenda cannot be set in the game for your ethics, so only the buffs were applied. Choose the council agenda in the game yourself.'}`)
                : L(`적용 여부를 확인하지 못했습니다(확인 ${m ? ok : '응답 없음'}/${built.expected}). 자동 재전송하지 않습니다. 게임에서 직접 확인해 주세요.`, `Could not confirm the result (${m ? ok : 'no reply'}/${built.expected}). It will not be resent automatically. Please check in the game.`);
            sys(message);
            if (confirmed) {
                exports.fac.pendingSnap = null;
                after();
                (0, chronicle_app_1.chronNoteWorld)(L(`${info.empire} 내각 회의 — ${proposer.title[0]} ${proposer.name}의 「${t.name[0]}」 채택.`, `${info.empire} cabinet meeting — adopted "${t.name[1]}", proposed by ${proposer.title[1]} ${proposer.name}.`));
            }
            return { ok: confirmed, state: confirmed ? 'confirmed' : 'uncertain', error: confirmed ? undefined : message };
        }
        catch (e) {
            const error = e.message;
            exports.fac.ackWaiter = null;
            if (exports.fac.info === info) {
                exports.fac.uncertain = reserved;
                sys(error);
            }
            (0, diagnostics_1.logDiagnostic)('warn', 'cabinet.apply.failed', { error, reserved });
            return { ok: false, state: reserved ? 'uncertain' : 'refused', error };
        }
        finally {
            exports.fac.busy = false;
            push();
        }
    });
    electron_1.ipcMain.handle('facClose', async () => { closeFactionMeeting(); return true; });
}
//# sourceMappingURL=faction-app.js.map
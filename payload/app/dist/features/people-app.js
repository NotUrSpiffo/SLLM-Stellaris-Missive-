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
exports.onPeopleChanged = onPeopleChanged;
exports.onLeaderOut = onLeaderOut;
exports.peopleOf = peopleOf;
exports.onRoster = onRoster;
exports.playerRulerName = playerRulerName;
exports.registerPeople = registerPeople;
// 집무실 연락처 — 내 지도자 명단(앱 쪽, 2026-10-18). 순수 로직은 src/people.ts.
// 모드(sllm_people.1)가 매달 LEADER·LEADERAT·LEADER_END 를 남기면 세이브별 인물 장부(sllm_people.json)에 반영한다.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const log_router_1 = require("../app/log-router");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const terminal_1 = require("./terminal");
const people_1 = require("../people");
let storeInst = null;
const store = () => (storeInst ??= new people_1.PeopleStore(path.join(electron_1.app.getPath('userData'), 'sllm_people.json')));
const collector = new people_1.PeopleCollector();
const listeners = [];
/** 명단이 바뀌면 부를 함수(집무실이 화면을 새로 그린다). 가져오기 고리를 만들지 않으려고 이 방식으로 받는다. */
function onPeopleChanged(fn) { listeners.push(fn); }
const outHooks = []; // 작별·추모(memorial-app), 비서 국장·퇴임(secretary-app, 2026-10-19)
/** 지도자 사망·해임 신호(LEADEROUT)를 받을 함수(memorial-app). */
function onLeaderOut(fn) { outHooks.push(fn); }
/** 이 세이브의 인물 장부(떠난 인물 포함). */
function peopleOf(sid) { return sid ? Object.values(store().get(sid).persons) : []; }
function onRoster(list, date) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return;
    const r = (0, people_1.applyRoster)(store().get(sid), list, date || ctx_1.ctx.gameDate);
    if (!list.length)
        return;
    store().save();
    if (r.added.length || r.gone.length || r.renamed.length)
        (0, diagnostics_1.logDiagnostic)('info', 'people.changed', { added: r.added.length, gone: r.gone.length, renamed: r.renamed.length, total: list.length });
    for (const fn of listeners) {
        try {
            fn();
        }
        catch { /* 화면 갱신 실패는 무시 */ }
    }
}
/** 플레이어 통치자 이름(2026-10-18 사용자 규칙: 화면의 「나」는 늘 통치자 이름으로). 이번 달 명단 → 제국 정보 순, 모르면 ''. */
function playerRulerName() {
    const sid = ctx_1.ctx.curSaveId;
    const p = sid ? peopleOf(sid).find((x) => x.ruler && !x.gone) : undefined;
    return (p?.name || ctx_1.ctx.profiles.get(ctx_1.ctx.playerIdx)?.ruler || '').trim();
}
function registerPeople(router) {
    electron_1.ipcMain.handle('playerRuler', async () => playerRulerName());
    router.on(log_router_1.SLOT.PEOPLE, 'people:roster', (m) => {
        if (m.kind === 'LEADEROUT') {
            for (const f of outHooks) {
                try {
                    f(m.kv);
                }
                catch (e) {
                    (0, diagnostics_1.logDiagnostic)('warn', 'memorial.out_failed', { error: String(e) });
                }
            }
            return;
        } // 작별·추모(memorial-app)
        if (m.kind === 'LETTERAPPLY') {
            terminal_1.terminalReplies.get('LETTERAPPLY:' + m.kv.req)?.(m);
            return;
        } // 개인 서신 부탁 결과(letters-app)
        if (m.kind !== 'LEADER' && m.kind !== 'LTRAIT' && m.kind !== 'LEADERAT' && m.kind !== 'LEADER_END')
            return; // LTRAIT: 특성(빠뜨리면 특성이 안 들어온다)
        const r = collector.feed(m.kind, m.kv);
        if (r)
            onRoster(r.list, r.date);
    });
}
//# sourceMappingURL=people-app.js.map
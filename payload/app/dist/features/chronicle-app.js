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
exports.WORLD_IDX = exports.idxNames = void 0;
exports.chron = chron;
exports.chronCheckSave = chronCheckSave;
exports.chronPut = chronPut;
exports.flushChronPending = flushChronPending;
exports.chronNote = chronNote;
exports.chronNoteByName = chronNoteByName;
exports.chronNoteWorld = chronNoteWorld;
exports.syncRadioChron = syncRadioChron;
exports.registerChronicle = registerChronicle;
// A-00b 4번: 연대기(앱 쪽) — 저장소, 기록 함수(chronNote 등), 연대기 화면 IPC(chronList).
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 순수 저장 로직은 src/chronicle.ts.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const chronicle_1 = require("../chronicle");
const radio_1 = require("../radio");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
let chronStore = null;
function chron() {
    if (!chronStore) {
        chronStore = new chronicle_1.ChronicleStore(path.join(electron_1.app.getPath('userData'), 'sllm_chronicle.json'), (sid) => ctx_1.ctx.govMem().currentBranch(sid));
        // 새 기록이 들어가면 연대기 화면에 알린다(짧은 시간에 몰리면 한 번으로 합친다)
        chronStore.onAdd = () => { if (chronNotifyT)
            return; chronNotifyT = setTimeout(() => { chronNotifyT = null; ctx_1.ctx.toUi('chronChanged', null); }, 300); };
    }
    return chronStore;
}
/** 연대기 한 줄을 남긴다(대화 상대 번호와 세이브 번호가 있을 때만). */
exports.idxNames = new Map(); // IDX 신호로 알게 된 제국 이름
const chronPending = []; // 세이브 번호를 알기 전에 들어온 기록. 번호를 알게 되면 한꺼번에 넣는다
let chronWarned = '', chronNotifyT = null;
function chronCheckSave() { const e = chron().error; if (e && e !== chronWarned) {
    chronWarned = e;
    ctx_1.ctx.toUi('status', (0, settings_ui_1.pick)('연대기 저장 실패: ', 'Failed to save the chronicle: ') + e + (0, settings_ui_1.pick)(' (기록은 메모리에 있고 다음 기록 때 다시 저장을 시도합니다)', ' (records stay in memory; saving is retried with the next record)'));
}
else if (!e)
    chronWarned = ''; }
function chronPut(idx, date, text, once, meta) {
    if (!ctx_1.ctx.curSaveId) {
        chronPending.push({ idx, date, text, once, meta });
        while (chronPending.length > 800)
            chronPending.shift();
        return;
    }
    try {
        chron().add(ctx_1.ctx.curSaveId, idx, date, text, once, meta);
        chronCheckSave();
    }
    catch (e) {
        ctx_1.ctx.toUi('status', (0, settings_ui_1.pick)('연대기 기록 실패: ', 'Failed to write the chronicle: ') + (e instanceof Error ? e.message : String(e)));
    }
}
function flushChronPending() { if (!ctx_1.ctx.curSaveId || !chronPending.length)
    return; for (const q of chronPending.splice(0))
    chronPut(q.idx, q.date, q.text, q.once, q.meta); }
function chronNote(idx, text, once = false, world = false) {
    if (idx > 0)
        chronPut(idx, ctx_1.ctx.gameDate, text, once, {
            ruler: ctx_1.ctx.profiles.get(idx)?.ruler,
            name: exports.idxNames.get(idx) ?? ctx_1.ctx.mailCountries.get(idx)?.name ?? (ctx_1.ctx.talk && ctx_1.ctx.talk.idx === idx ? ctx_1.ctx.talk.name : undefined),
            world,
        });
}
/** 번호 없이 이름만 아는 제국의 기록: IDX 신호로 알게 된 이름과 같으면 그 제국 연대기에 넣고, 못 찾으면 넣지 않는다. */
function chronNoteByName(name, text, world = true) { const n = name.trim(); if (!n)
    return false; for (const [i, nm] of exports.idxNames)
    if (nm === n && i > 0 && i < 9000) {
        chronNote(i, text, false, world);
        return true;
    } return false; }
/** 번호를 모르는 세계 사건을 넣는 가상 제국(은하 위기 안건도 여기 들어간다). */
exports.WORLD_IDX = 9999;
function chronNoteWorld(text, once = false) { exports.idxNames.set(exports.WORLD_IDX, '세계 소식'); chronNote(exports.WORLD_IDX, text, once, true); }
/** 라디오 연대기 ⊇ 신문 연대기(알파 6): 제국별 기록 가운데 라디오 연대기에 없는 최근 1년 기록을 채운다. 같은 기록은 uid 로 한 번만. */
let radioSyncKey = '';
function syncRadioChron() {
    const sid = ctx_1.ctx.curSaveId, today = ctx_1.ctx.gameDate;
    if (!sid || !today)
        return 0;
    const key = `${sid}|${today}|${chron().rev}`;
    if (key === radioSyncKey)
        return 0; // 연대기·날짜가 그대로면 다시 훑지 않는다(라디오가 빌 때마다 2분 주기로 불림)
    try {
        const groups = chron().groups(sid, (all) => ctx_1.ctx.govMem().split(sid, all).own).filter((g) => g.idx !== chronicle_1.RADIO_IDX);
        const radioItems = ctx_1.ctx.govMem().split(sid, chron().list((0, chronicle_1.chronKey)(sid, chronicle_1.RADIO_IDX))).own;
        const plan = (0, radio_1.radioMirrorPlan)(groups, radioItems, today, chronicle_1.RADIO_IDX);
        const n = chron().batch(() => { let k = 0; for (const p of plan)
            if (chron().add(sid, chronicle_1.RADIO_IDX, p.date, p.text, false, { name: '성간라디오 전용 연대기', world: true, uid: p.uid }))
                k++; return k; });
        chronCheckSave();
        radioSyncKey = `${sid}|${today}|${chron().rev}`;
        return n;
    }
    catch (e) {
        ctx_1.ctx.toUi('status', (0, settings_ui_1.pick)('라디오 연대기 동기화 실패: ', 'Failed to sync the radio chronicle: ') + (e instanceof Error ? e.message : String(e)));
        return 0;
    }
}
function registerChronicle() {
    electron_1.ipcMain.handle('chronList', async () => {
        if (!ctx_1.ctx.curSaveId)
            return { sid: '', groups: [] };
        const groups = chron().groups(ctx_1.ctx.curSaveId, (all) => ctx_1.ctx.govMem().split(ctx_1.ctx.curSaveId, all).own);
        return { sid: ctx_1.ctx.curSaveId, groups: groups.map((g) => ({ idx: g.idx, name: g.name, items: g.items.map((e) => ({ date: e.date, ruler: e.ruler ?? '', text: (0, settings_ui_1.localizeNote)(e.text) })) })) };
    });
}
//# sourceMappingURL=chronicle-app.js.map
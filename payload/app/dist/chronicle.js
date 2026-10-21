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
exports.ChronicleStore = exports.chronKey = exports.RADIO_KEEP_DAYS = exports.MAX_CHRON = exports.MAX_RADIO = exports.RADIO_IDX = void 0;
exports.chronLines = chronLines;
const diagnostics_1 = require("./diagnostics");
// 관계 연대기: 플레이어와 각 AI 제국 사이에 있었던 일을 날짜와 함께 쌓아 두고, 대화 때 "우리 사이에 있었던 일"로 알려 준다.
// 되감기(시간선)를 따라가도록 항목마다 분기 번호를 둔다. 앱 파일에 따로 저장한다.
const fs = __importStar(require("fs"));
exports.RADIO_IDX = 9990; // 성간 라디오 전용 연대기(모든 on_action 사건을 날짜별로 쌓는 가상의 제국 번호)
exports.MAX_RADIO = 5000;
exports.MAX_CHRON = 60; // 제국 하나당 보관하는 최대 항목 수
/** 스텔라리스 달력: 한 달 30일, 한 해 360일. 'YYYY.MM.DD' → 일 수. */
const i18n_pick_1 = require("./i18n-pick");
const gamedate_1 = require("./gamedate"); // F-28: 스텔라리스 달력 일 수(한 달 30일, 한 해 360일)
exports.RADIO_KEEP_DAYS = 360; // 1년(한 해 360일). 라디오를 켤 때 이 기간의 미방송 사건으로 대기열을 채운다(F-03)
const chronKey = (sid, idx) => `${sid || 'nosave'}|${idx}`;
exports.chronKey = chronKey;
class ChronicleStore {
    file;
    branchOf;
    data = { next: 1, items: {} };
    /** 기록이 실제로 들어갈 때마다 1씩 오른다(바뀐 게 없으면 다시 계산하지 않게, 2026-10-18). */
    rev = 0;
    batchDepth = 0;
    dirty = false;
    /** 여러 개를 넣을 때 파일 저장·화면 알림을 끝에 한 번만 한다(항목마다 연대기 파일 전체를 다시 쓰던 문제). */
    batch(fn) {
        this.batchDepth++;
        try {
            return fn();
        }
        finally {
            if (--this.batchDepth === 0 && this.dirty) {
                this.dirty = false;
                this.save();
                try {
                    this.onAdd?.();
                }
                catch { /* 화면 알림 실패는 무시 */ }
            }
        }
    }
    constructor(file, branchOf) {
        this.file = file;
        this.branchOf = branchOf;
        try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (j && typeof j === 'object' && j.items)
                this.data = { next: Number(j.next) || 1, items: j.items, names: j.names && typeof j.names === 'object' ? j.names : {} };
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'chronicle', file, error });
        }
    }
    /** 마지막 저장이 실패했으면 그 이유(성공하면 null). 대화는 막지 않지만 화면에는 알린다. */
    error = null;
    /** 새 기록이 실제로 들어갔을 때 부른다(화면 자동 갱신용). */
    onAdd = null;
    save() {
        try {
            const tmp = this.file + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
            fs.renameSync(tmp, this.file);
            this.error = null;
        }
        catch (e) {
            this.error = e instanceof Error ? e.message : String(e);
            (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'chronicle', file: this.file, error: e });
        } // 기억 속 기록은 남아 있으니 다음 기록 때 다시 저장을 시도한다
    }
    list(key) { return (this.data.items[key] ?? []).slice(); }
    /** 이 세이브의 제국별 기록 묶음: [{ key, idx, name, items }]. 항목을 어느 시간선까지 보일지는 filter 가 정한다. */
    groups(sid, filter = (a) => a) {
        const pre = `${sid || 'nosave'}|`;
        const out = [];
        for (const [k, arr] of Object.entries(this.data.items)) {
            if (!k.startsWith(pre))
                continue;
            const items = filter(arr.slice());
            if (!items.length)
                continue;
            const idx = Number(k.slice(pre.length));
            out.push({ idx, name: this.data.names?.[k] || (0, i18n_pick_1.L)(`제국 ${idx}`, `Empire ${idx}`), items });
        }
        return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    /** 같은 날짜에 같은 문장은 한 번만 넣는다. */
    add(sid, idx, date, text, once = false, meta = {}) {
        const t = text.replace(/\s+/g, ' ').trim().slice(0, 140);
        if (!t)
            return false;
        const k = (0, exports.chronKey)(sid, idx);
        const arr = (this.data.items[k] ??= []);
        const br = this.branchOf(sid);
        if (meta.uid) {
            if (arr.some((e) => e.uid === meta.uid && (e.branch ?? 1) === br))
                return false;
        }
        else if (once && arr.some((e) => e.text === t && (e.branch ?? 1) === br))
            return false;
        if (!meta.uid && arr.some((e) => e.text === t && e.date === date && (e.branch ?? 1) === br))
            return false;
        arr.push({ id: this.data.next++, date: date || '', text: t, branch: br, ...(meta.ruler ? { ruler: meta.ruler.slice(0, 40) } : {}), ...(meta.world ? { world: true } : {}), ...(meta.uid ? { uid: meta.uid.slice(0, 200) } : {}) });
        if (meta.name)
            (this.data.names ??= {})[k] = meta.name.slice(0, 60);
        // 성간 라디오 전용 연대기는 게임 날짜로 최근 RADIO_KEEP_DAYS(360)일만 남긴다(라디오는 지금 일어난 일을 전하는 것이 목적이다). 연도가 넘어가도 최근 사건은 이어지고, 같은 시간선(branch)의 더 오래된 것만 지운다. 상한은 MAX_RADIO 건.
        if (idx === exports.RADIO_IDX) {
            const nd = (0, gamedate_1.dayNo)(date);
            if (nd !== null)
                for (let i = arr.length - 1; i >= 0; i--) {
                    const ed = (0, gamedate_1.dayNo)(arr[i].date);
                    if (ed !== null && ed < nd - exports.RADIO_KEEP_DAYS && (arr[i].branch ?? 1) === br)
                        arr.splice(i, 1);
                }
        }
        const cap = idx === exports.RADIO_IDX ? exports.MAX_RADIO : exports.MAX_CHRON;
        while (arr.length > cap)
            arr.shift();
        this.rev++;
        if (this.batchDepth) {
            this.dirty = true;
            return true;
        }
        this.save();
        try {
            this.onAdd?.();
        }
        catch { /* 화면 알림 실패는 무시 */ }
        return true;
    }
}
exports.ChronicleStore = ChronicleStore;
/** 프롬프트에 넣을 줄들(오래된 것부터, 최근 max 개). */
function chronLines(items, max = 8) {
    return items.slice(-max).map((e) => (e.date ? `[${e.date}] ` : '') + e.text);
}
//# sourceMappingURL=chronicle.js.map
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
exports.DeferredStore = exports.addMonths = exports.LEAN_KO = void 0;
const diagnostics_1 = require("./diagnostics");
// 조약 얼버무리기: 통상·연구·불가침 같은 조약은 앱이 맺을 수 없으므로, AI 가 "의원들과 논의한 뒤 서신으로 알리겠다"고 하고
// 몇 달 뒤 실제로 서신(편지)을 보낸다. 서신의 결론은 대화 당시 AI 의 속마음(호감과 태도)에서 정한다.
const fs = __importStar(require("fs"));
const gamedate_1 = require("./gamedate");
exports.LEAN_KO = { positive: '긍정적', neutral: '아직 정하지 못함', negative: '부정적' };
// F-28: 날짜 계산은 gamedate.ts 한 곳에(옛 이름은 그대로 내보냄)
var gamedate_2 = require("./gamedate");
Object.defineProperty(exports, "addMonths", { enumerable: true, get: function () { return gamedate_2.addMonths; } });
class DeferredStore {
    file;
    data = { next: 1, items: [] };
    constructor(file) {
        this.file = file;
        try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (j && Array.isArray(j.items))
                this.data = { next: Number(j.next) || 1, items: j.items };
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'deferred', file, error });
        }
    }
    save() { try {
        fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8');
    }
    catch (error) {
        (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'deferred', file: this.file, error });
    } }
    list(sid) { return this.data.items.filter((d) => d.sid === sid); }
    /** 같은 상대·같은 주제가 이미 기다리고 있으면 새로 만들지 않는다. */
    add(d, monthsLater) {
        if (this.data.items.some((x) => x.sid === d.sid && x.idx === d.idx && x.topic === d.topic))
            return null;
        const item = { ...d, id: this.data.next++, due: (0, gamedate_1.addMonths)(d.asked, Math.max(1, monthsLater)) };
        this.data.items.push(item);
        this.save();
        return item;
    }
    /** 날짜가 된 것을 꺼낸다. 세이브를 과거로 불러와 아직 묻지도 않은 일이 된 것은 버린다. */
    due(sid, date) {
        const now = (0, gamedate_1.dateNum)(date);
        if (!sid || Number.isNaN(now))
            return [];
        const out = [];
        const keep = [];
        for (const d of this.data.items) {
            if (d.sid !== sid) {
                keep.push(d);
                continue;
            }
            const asked = (0, gamedate_1.dateNum)(d.asked);
            if (!Number.isNaN(asked) && asked > now)
                continue; // 되감기로 없던 일이 됨
            if ((0, gamedate_1.dateNum)(d.due) <= now)
                out.push(d);
            else
                keep.push(d);
        }
        if (out.length || keep.length !== this.data.items.length) {
            this.data.items = keep;
            this.save();
        }
        return out;
    }
}
exports.DeferredStore = DeferredStore;
//# sourceMappingURL=deferred.js.map
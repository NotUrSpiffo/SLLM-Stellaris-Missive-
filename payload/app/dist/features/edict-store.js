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
exports.edictModsInUse = exports.edictStore = void 0;
exports.activeEdict = activeEdict;
// 언론 인터뷰 칙령 기록(세이브별 sllm_edicts.json, 2026-10-18). 정책 퀘스트와 같은 수정자를 겹쳐 쓰지 않게 서로 확인한다.
// press-app·policy-app 둘 다 쓰므로 고리 없이 따로 둔다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const policy_1 = require("../policy");
class EdictStore {
    file;
    data = {};
    constructor(file) {
        this.file = file;
        try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (j && typeof j === 'object')
                this.data = j;
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'edicts', file, error });
        }
    }
    get(sid) { const s = (this.data[sid || 'nosave'] ??= { active: null, history: [] }); s.history ??= []; if (s.active === undefined)
        s.active = null; return s; }
    save() { try {
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
        fs.renameSync(tmp, this.file);
        return true;
    }
    catch (error) {
        (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'edicts', file: this.file, error });
        return false;
    } }
}
let inst = null;
const edictStore = () => (inst ??= new EdictStore(path.join(electron_1.app.getPath('userData'), 'sllm_edicts.json')));
exports.edictStore = edictStore;
/** 지금 시행 중인 칙령(끝난 것은 null). */
function activeEdict(sid, date) {
    if (!sid)
        return null;
    const a = (0, exports.edictStore)().get(sid).active;
    if (!a)
        return null;
    return date && (0, policy_1.daysBetween)(date, a.end) <= 0 ? null : a;
}
/** 시행 중인 칙령이 쓰는 수정자(정책 선포 때 겹침 확인). */
const edictModsInUse = (sid, date) => new Set(activeEdict(sid, date)?.mods ?? []);
exports.edictModsInUse = edictModsInUse;
//# sourceMappingURL=edict-store.js.map
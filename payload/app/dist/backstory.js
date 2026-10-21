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
exports.BackstoryStore = exports.cleanBackstory = exports.BACKSTORY_MAX = void 0;
// 사용자가 직접 쓰는 배경 이야기(2026-10-18 테스터 요청: 모드의 특수 제국·영웅 설정을 AI 가 알게).
//  - 제국: 이름으로 저장(세이브와 상관없이 같은 이름이면 같이 씀). 있으면 게임·모드 전기보다 먼저 쓴다.
//  - 인물(내 제국 연락처): 세이브별 인물 기억(sllm_persona.json 의 bio)에 둔다 → features/persona-app.ts.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.BACKSTORY_MAX = 2000;
/** 줄바꿈은 두고 제어 문자·앞뒤 공백을 지운 뒤 길이를 자른다. */
const cleanBackstory = (s, max = exports.BACKSTORY_MAX) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
exports.cleanBackstory = cleanBackstory;
const nameKey = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
class BackstoryStore {
    file;
    onError;
    data = null;
    constructor(file, onError = () => { }) {
        this.file = file;
        this.onError = onError;
    }
    load() {
        if (this.data)
            return this.data;
        try {
            const j = JSON.parse(fs.readFileSync(this.file(), 'utf8'));
            this.data = { empires: j && typeof j.empires === 'object' && j.empires ? j.empires : {} };
        }
        catch (e) {
            if (e.code !== 'ENOENT')
                this.onError('read', e);
            this.data = { empires: {} };
        }
        return this.data;
    }
    empire(name) { const k = nameKey(name); return k ? (0, exports.cleanBackstory)(this.load().empires[k]) : ''; }
    /** 빈 글이면 지운다(게임·모드 전기로 돌아감). 저장했으면 true. */
    setEmpire(name, text) {
        const k = nameKey(name);
        if (!k)
            return false;
        const d = this.load(), t = (0, exports.cleanBackstory)(text);
        if (t)
            d.empires[k] = t;
        else
            delete d.empires[k];
        try {
            fs.mkdirSync(path.dirname(this.file()), { recursive: true });
            fs.writeFileSync(this.file() + '.tmp', JSON.stringify(d), 'utf8');
            fs.renameSync(this.file() + '.tmp', this.file());
            return true;
        }
        catch (e) {
            this.onError('write', e);
            return false;
        }
    }
}
exports.BackstoryStore = BackstoryStore;
//# sourceMappingURL=backstory.js.map
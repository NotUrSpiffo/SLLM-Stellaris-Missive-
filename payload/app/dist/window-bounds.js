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
exports.BoundsStore = void 0;
exports.restoreRect = restoreRect;
// 창 크기·위치 기억(2026-10-18 사용자 제보: 집무실·신문 창을 키워도 닫았다 열면 기본 크기로 돌아감, 21:9 모니터).
// 저장한 자리가 지금 모니터 안에 충분히 들어올 때만 되살린다(모니터가 바뀌면 기본 자리). electron 에 의존하지 않는 순수 모듈.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const isRect = (r) => !!r && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k]));
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
/** 저장한 창 자리를 지금 화면들(작업 영역)에 맞춘다. 70% 이상 보이는 화면이 없으면 null(기본 자리를 쓴다).
 *  크기는 최소 크기 이상, 그 화면보다 크지 않게. 위치는 그 화면 안으로 당긴다. */
function restoreRect(saved, areas, min) {
    if (!isRect(saved) || saved.width < 50 || saved.height < 50)
        return null;
    const area = areas.filter(isRect).map((a) => ({ a, v: overlap(saved, a) })).sort((x, y) => y.v - x.v)[0];
    if (!area || area.v < saved.width * saved.height * 0.7)
        return null;
    const a = area.a;
    const width = Math.round(Math.min(a.width, Math.max(min.width, saved.width))), height = Math.round(Math.min(a.height, Math.max(min.height, saved.height)));
    const x = Math.round(Math.min(Math.max(saved.x, a.x), a.x + a.width - width)), y = Math.round(Math.min(Math.max(saved.y, a.y), a.y + a.height - height));
    return { x, y, width, height };
}
class BoundsStore {
    file;
    onError;
    data = null;
    timers = new Map();
    constructor(file, onError = () => { }) {
        this.file = file;
        this.onError = onError;
    }
    load() {
        if (this.data)
            return this.data;
        try {
            const j = JSON.parse(fs.readFileSync(this.file(), 'utf8'));
            this.data = j && typeof j === 'object' ? j : {};
        }
        catch {
            this.data = {};
        }
        return this.data;
    }
    get(key) { const r = this.load()[key]; return isRect(r) ? r : undefined; }
    /** 바로 저장(창을 닫을 때). */
    set(key, r) {
        if (!isRect(r))
            return;
        const t = this.timers.get(key);
        if (t) {
            clearTimeout(t);
            this.timers.delete(key);
        }
        this.load()[key] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
        try {
            fs.mkdirSync(path.dirname(this.file()), { recursive: true });
            fs.writeFileSync(this.file(), JSON.stringify(this.data), 'utf8');
        }
        catch (e) {
            this.onError(e);
        }
    }
    /** 끄는 중(움직이거나 크기를 바꾸는 동안)에는 0.6초 모아서 저장. */
    later(key, get) {
        const t = this.timers.get(key);
        if (t)
            clearTimeout(t);
        this.timers.set(key, setTimeout(() => { this.timers.delete(key); const r = get(); if (r)
            this.set(key, r); }, 600));
    }
}
exports.BoundsStore = BoundsStore;
//# sourceMappingURL=window-bounds.js.map
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
exports.ROLE_ICON = void 0;
exports.iconMask = iconMask;
exports.roleIconMasks = roleIconMasks;
// 집무실 연락처 직업 아이콘(2026-10-18): 게임 폴더의 지도자 하위 직업 아이콘(gfx/interface/icons/leaders/subclasses/*.dds)을
// 실행 중에만 읽어(복사·배포하지 않음) 밝은 그림 부분만 남긴 가림판(마스크) PNG 로 바꾼다. 화면은 이 가림판에 테마 색을 칠해 쓴다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const flagrender_1 = require("./flagrender");
/** 연락처 역할 → 게임 아이콘 파일(없으면 화면이 이름 첫 글자로 대신한다). 통치자는 게임에 하위 직업 아이콘이 없어 넣지 않는다. */
exports.ROLE_ICON = {
    admiral: 'subclass_commander_admiral_large.dds',
    general: 'subclass_commander_general_large.dds',
    commander: 'subclass_commander_councilor_large.dds',
    governor: 'subclass_official_governor_large.dds',
    official: 'subclass_official_delegate_large.dds',
    scientist: 'subclass_scientist_explorer_large.dds',
    scholar: 'subclass_scientist_scholar_large.dds',
};
/** 원판(어두운 원 위의 밝은 그림)에서 밝은 그림만 가림판으로: 알파 = 밝기가 원판보다 밝은 만큼 × 원래 알파. */
function iconMask(img) {
    const px = new Uint8Array(img.w * img.h * 4);
    for (let i = 0; i < img.w * img.h; i++) {
        const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2], a = img.px[i * 4 + 3];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const k = Math.max(0, Math.min(1, (lum - 120) / (200 - 120)));
        px[i * 4] = 255;
        px[i * 4 + 1] = 255;
        px[i * 4 + 2] = 255;
        px[i * 4 + 3] = Math.round(k * a);
    }
    return { w: img.w, h: img.h, px };
}
const cache = new Map();
/** 역할별 가림판 data URL. 게임 폴더를 모르거나 파일이 없으면 그 역할은 빠진다. */
function roleIconMasks(gameDir) {
    if (!gameDir)
        return {};
    const hit = cache.get(gameDir);
    if (hit)
        return hit;
    const out = {};
    for (const [role, file] of Object.entries(exports.ROLE_ICON)) {
        try {
            const img = (0, flagrender_1.decodeDds)(fs.readFileSync(path.join(gameDir, 'gfx', 'interface', 'icons', 'leaders', 'subclasses', file)));
            if (img)
                out[role] = 'data:image/png;base64,' + (0, flagrender_1.encodePng)(iconMask(img)).toString('base64');
        }
        catch { /* 없으면 글자로 */ }
    }
    cache.set(gameDir, out);
    return out;
}
//# sourceMappingURL=leader-icons.js.map
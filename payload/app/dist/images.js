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
exports.resolveLeader = exports.VARIANT_MAX = exports.resolvePlayerRuler = exports.RULER_KEY = exports.SCENE_KEY = exports.MAX_IMAGE_BYTES = exports.IMAGE_EXTS = void 0;
exports.safeImageName = safeImageName;
exports.isSafeStoredName = isSafeStoredName;
exports.pickVariant = pickVariant;
exports.isImageKey = isImageKey;
exports.sanitizeImageMap = sanitizeImageMap;
exports.imageKey = imageKey;
exports.resolvePortrait = resolvePortrait;
exports.resolveDelegate = resolveDelegate;
exports.clampOpacity = clampOpacity;
exports.cleanSaveId = cleanSaveId;
exports.countryImageKey = countryImageKey;
exports.speciesImageKey = speciesImageKey;
exports.findPortrait = findPortrait;
// 사용자가 고르는 그림(배경, 초상화). 파일은 앱 데이터 폴더의 sllm_images 안으로 복사해 두고, 설정에는 파일 이름만 적는다.
const path = __importStar(require("path"));
exports.IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
exports.MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** 폴더 안에 둘 안전한 파일 이름. 확장자가 그림이 아니면 null. */
function safeImageName(original, stamp) {
    const ext = path.extname(original).toLowerCase();
    if (!exports.IMAGE_EXTS.includes(ext))
        return null;
    const base = path.basename(original, path.extname(original)).replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'image';
    return `${base}_${stamp.toString(36)}${ext}`;
}
/** 설정에 저장돼 있던 파일 이름이 우리 규칙을 지키는지(폴더 밖으로 나가는 이름 방지). */
function isSafeStoredName(n) {
    return typeof n === 'string' && n.length > 0 && n.length < 120 && n === path.basename(n) && exports.IMAGE_EXTS.includes(path.extname(n).toLowerCase()) && !/[\\/:*?"<>|]/.test(n);
}
/** 설정에 쓸 수 있는 그림 키: country:이름, species:이름, class:계열(소문자 3~12자), save:세이브번호:country|species:이름(제국은 제국 번호),
 * scene:자리(A-22 연출 슬롯·창 배경, 소문자·밑줄 3~24자). */
exports.SCENE_KEY = /^scene:[a-z][a-z_]{2,23}$/;
/** 플레이어 통치자 초상화(사용자가 넣는 자기 캐릭터) — 플레이어 통치자가 나오는 모든 장면에서 먼저 쓴다(2026-10-16). */
exports.RULER_KEY = 'ruler:player';
/** 플레이어 통치자: 직접 넣은 그림 → 이 계열의 연설 지도자 그림 → 계열 초상화 → 없음(모드 기본 그림은 부르는 쪽에서). */
const resolvePlayerRuler = (images, classKey) => images[exports.RULER_KEY] ?? (0, exports.resolveLeader)(images, classKey);
exports.resolvePlayerRuler = resolvePlayerRuler;
/** 초상화 변형(2026-10-16): class:/delegate: 는 기본 + #2..#8 을 둘 수 있다. 인물(seed)마다 늘 같은 한 장(ui/portrait-variants.js 와 같은 규칙). 통치자·연설 지도자는 변형 없음. */
exports.VARIANT_MAX = 8;
const vhash = (s) => { let h = 2166136261; for (const c of String(s ?? '')) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
} return h >>> 0; };
function pickVariant(images, keys, seed, def = null) {
    for (let n = 0; n < keys.length; n++) {
        const key = keys[n], vars = [];
        for (let i = 2; i <= exports.VARIANT_MAX; i++)
            if (images[`${key}#${i}`])
                vars.push(images[`${key}#${i}`]);
        const base = images[key] ?? (n === keys.length - 1 && vars.length ? def : null);
        const pool = [base, ...vars].filter((x) => !!x);
        if (pool.length)
            return pool[vhash(seed) % pool.length];
    }
    return def;
}
function isImageKey(k) {
    return typeof k === 'string' && (exports.SCENE_KEY.test(k) || /^(country|species):.{1,80}$/.test(k) || /^(class|delegate|leader):[a-z]{3,12}$/.test(k) || /^(class|delegate):[a-z]{3,12}#[2-8]$/.test(k) || k === exports.RULER_KEY || /^save:\d{1,9}:(country|species):.{1,80}$/.test(k));
}
function sanitizeImageMap(v) {
    const out = {};
    if (!v || typeof v !== 'object')
        return out;
    for (const [k, f] of Object.entries(v)) {
        if (isImageKey(k) && isSafeStoredName(f))
            out[k] = f;
    }
    return out;
}
function imageKey(scope, countryName, species, classKey = '') {
    const n = (scope === 'class' ? classKey : scope === 'species' ? species : countryName).trim().slice(0, 80);
    return n ? `${scope}:${n}` : null;
}
/** 초상화 찾기: 제국에 지정한 것 → 종족에 지정한 것 → 종족 계열에 지정한 것 → 없음(모드 기본 그림). */
function resolvePortrait(images, countryName, species, classKey = '') {
    return images[`country:${countryName}`] ?? (species ? images[`species:${species}`] : undefined) ?? (classKey ? pickVariant(images, [`class:${classKey}`], countryName) : undefined) ?? null;
}
/** 연설 무대의 지도자 초상화: 이 계열에 올린 지도자 그림 → 계열 초상화에 올린 그림 → 없음(모드 기본 그림은 호출한 쪽에서 붙인다). */
const resolveLeader = (images, classKey) => (classKey ? images[`leader:${classKey}`] ?? images[`class:${classKey}`] ?? null : null);
exports.resolveLeader = resolveLeader;
/** 의회 의석에 쓰는 의원 초상화: 이 계열에 올린 의원 그림 → 계열 초상화에 올린 그림 → 없음(모드 기본 그림은 화면에서 붙인다). */
function resolveDelegate(images, classKey, seed = '') {
    return pickVariant(images, [`delegate:${classKey}`, `class:${classKey}`], seed);
}
function clampOpacity(v, fallback = 0.3) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}
/** 모드가 세이브에 새겨 둔 세이브 번호(숫자 1~9자리). 아니면 빈 문자열. */
function cleanSaveId(v) {
    const t = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
    return /^\d{1,9}$/.test(t) ? t : '';
}
/** 이 세이브의 제국 그림 키. 제국 이름은 게임 중 자주 바뀌므로 제국 번호(idx)로 구분한다. 세이브 번호가 없으면 예전 방식(이름). */
function countryImageKey(sid, idx, name) {
    if (sid)
        return Number.isInteger(idx) && idx >= 0 ? `save:${sid}:country:${idx}` : null;
    const n = (name || '').trim().slice(0, 80);
    return n ? `country:${n}` : null;
}
function speciesImageKey(sid, species) {
    const n = (species || '').trim().slice(0, 80);
    if (!n)
        return null;
    return sid ? `save:${sid}:species:${n}` : `species:${n}`;
}
/** 대화 상대의 초상화 찾기(저장된 그림 파일 이름). 이 세이브의 제국 → 이 세이브의 종족 → 계열 → 없음. 세이브 번호가 없을 때만 예전 이름 키를 쓴다. */
function findPortrait(images, sid, idx, name, species, classKey = '') {
    const c = countryImageKey(sid, idx, name), sp = speciesImageKey(sid, species);
    return (c ? images[c] : undefined) ?? (sp ? images[sp] : undefined) ?? (classKey ? pickVariant(images, [`class:${classKey}`], name || String(idx)) : undefined) ?? null;
}
//# sourceMappingURL=images.js.map
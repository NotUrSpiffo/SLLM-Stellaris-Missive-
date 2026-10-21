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
exports.LIB_ROLES = void 0;
exports.parseLibrary = parseLibrary;
exports.extractPak = extractPak;
exports.loadLibrary = loadLibrary;
exports.libraryFile = libraryFile;
exports.itemGender = itemGender;
exports.matchLibrary = matchLibrary;
exports.pickRulerItem = pickRulerItem;
// 포트레이트 라이브러리: 앱 폴더 portrait-library 의 library.json 과 그림 파일(WebP)을 읽는다.
// 게임 파일을 읽어 미리 그려 둔 초상화이며, 앱은 목록을 보여 주고 고른 그림을 평소 사용자 그림과 같은 방식으로 적용한다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.LIB_ROLES = ['default', 'ruler', 'governor', 'admiral', 'general', 'scientist'];
const FILE_RE = /^[A-Za-z0-9_]{1,80}\.webp$/;
const ID_RE = /^[A-Za-z0-9_]{1,80}$/;
const CLS_RE = /^[a-z]{3,12}$/;
const ROLE_RE = /^[a-z]{3,12}$/;
/** library.json 내용을 검증해 안전한 항목만 남긴다(파일 이름이 폴더 밖을 가리키지 못하게). */
function parseLibrary(raw) {
    const out = { version: 1, items: [], groups: {} };
    const o = raw;
    if (!o || !Array.isArray(o.items))
        return out;
    // 포트레이트 그룹: human 처럼 여러 초상화를 묶은 이름 -> 초상화 ID들(게임의 portrait_groups)
    if (o.groups && typeof o.groups === 'object')
        for (const [g, ms] of Object.entries(o.groups))
            if (/^[A-Za-z0-9_.]{1,60}$/.test(g) && Array.isArray(ms))
                out.groups[g] = ms.filter((m) => typeof m === 'string' && /^[A-Za-z0-9_.]{1,60}$/.test(m)).slice(0, 400);
    for (const it of o.items) {
        if (!it || typeof it.id !== 'string' || !ID_RE.test(it.id) || typeof it.cls !== 'string' || !CLS_RE.test(it.cls))
            continue;
        const roles = {};
        if (it.roles && typeof it.roles === 'object')
            for (const [r, f] of Object.entries(it.roles))
                if (ROLE_RE.test(r) && typeof f === 'string' && FILE_RE.test(f))
                    roles[r] = f;
        if (!Object.keys(roles).length)
            continue;
        const dr = typeof it.defaultRole === 'string' && roles[it.defaultRole] ? it.defaultRole : Object.keys(roles)[0];
        const ports = Array.isArray(it.portraits) ? it.portraits.filter((p) => typeof p === 'string' && p.length < 60).slice(0, 40) : [];
        out.items.push({ id: it.id, cls: it.cls, species: typeof it.species === 'string' ? it.species.slice(0, 40) : '', defaultRole: dr, roles, portraits: ports });
    }
    return out;
}
/** portrait-library.pak(SLPK1) 를 out 폴더에 푼다. 구조: "SLPK1\n" + 길이(uint32 LE) + JSON {v, files:[{n 이름, o 위치, l 길이}]} + 데이터.
 * 이름은 library.json 또는 안전한 .webp 만 허용(폴더 밖으로 못 나감). 이미 같은 pak 으로 풀었으면(.pak-stamp 같음) 다시 풀지 않는다. 풀었거나 이미 있으면 true. */
function extractPak(pak, out) {
    try {
        const st = fs.statSync(pak), stamp = `${st.size}:${Math.floor(st.mtimeMs)}`, sf = path.join(out, '.pak-stamp');
        try {
            if (fs.readFileSync(sf, 'utf8') === stamp && fs.existsSync(path.join(out, 'library.json')))
                return true;
        }
        catch { /* 처음 풀기 */ }
        const buf = fs.readFileSync(pak);
        if (buf.length < 10 || buf.toString('latin1', 0, 6) !== 'SLPK1\n')
            return false;
        const hl = buf.readUInt32LE(6), base = 10 + hl;
        if (hl <= 0 || base > buf.length)
            return false;
        const head = JSON.parse(buf.toString('utf8', 10, base));
        if (!Array.isArray(head.files))
            return false;
        fs.mkdirSync(out, { recursive: true });
        for (const f of head.files) {
            if (typeof f.n !== 'string' || !(f.n === 'library.json' || FILE_RE.test(f.n)))
                continue;
            if (!Number.isInteger(f.o) || !Number.isInteger(f.l) || f.o < 0 || f.l < 0 || base + f.o + f.l > buf.length)
                continue;
            fs.writeFileSync(path.join(out, f.n), buf.subarray(base + f.o, base + f.o + f.l));
        }
        fs.writeFileSync(sf, stamp);
        return fs.existsSync(path.join(out, 'library.json'));
    }
    catch {
        return false;
    }
}
function loadLibrary(dir) {
    try {
        return parseLibrary(JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf8')));
    }
    catch {
        return { version: 1, items: [], groups: {} };
    }
}
/** 항목 id 와 역할로 실제 그림 파일 경로를 찾는다. 역할 그림이 없으면 기본 옷 그림. 없거나 이상하면 null. */
function libraryFile(lib, dir, id, role) {
    if (typeof id !== 'string')
        return null;
    const it = lib.items.find((x) => x.id === id);
    if (!it)
        return null;
    const f = (typeof role === 'string' && it.roles[role]) || it.roles[it.defaultRole];
    if (!f || !FILE_RE.test(f))
        return null;
    const p = path.join(dir, f);
    return fs.existsSync(p) ? p : null;
}
const FEM_RE = /(^|_)female(_|$)|_f(_|$)/, MAL_RE = /(^|_)male(_|$)|_m(_|$)/;
/** 라이브러리 항목 이름에서 성별을 짐작한다(female/male, _f/_m). 모르면 빈 문자열. ui/delegate-pick.js 의 genderOf 와 같아야 한다. */
function itemGender(id) { return FEM_RE.test(id) ? 'f' : MAL_RE.test(id) ? 'm' : ''; }
const hashOf = (s) => { let h = 2166136261; for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
} return h >>> 0; };
/** 통치자 초상화 ID(또는 그룹 이름)에 맞는 라이브러리 항목들. 성별을 알면 같은 성별을 우선한다. */
function matchLibrary(lib, portraitId, gender) {
    if (!portraitId)
        return [];
    const ids = new Set([portraitId, ...(lib.groups[portraitId] ?? [])]);
    const hit = lib.items.filter((it) => it.portraits.some((p) => ids.has(p)));
    if (gender) {
        const same = hit.filter((it) => itemGender(it.id) === gender);
        if (same.length)
            return same;
    }
    return hit;
}
/** 통치자에게 맞는 라이브러리 항목 하나(시드로 고정). 맞는 게 없으면 null. */
function pickRulerItem(lib, portraitId, gender, seed) {
    const m = matchLibrary(lib, portraitId, gender);
    return m.length ? m[hashOf(seed) % m.length] : null;
}
//# sourceMappingURL=portraitlib.js.map
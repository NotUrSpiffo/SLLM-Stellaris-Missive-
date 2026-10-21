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
exports.LoreStore = exports.LORE_MAX = void 0;
exports.parsePdx = parsePdx;
exports.child = child;
exports.parseUserDesigns = parseUserDesigns;
exports.parseEmpireLoc = parseEmpireLoc;
exports.pairLore = pairLore;
exports.clipLore = clipLore;
exports.stellarisUserDir = stellarisUserDir;
exports.userDesignFiles = userDesignFiles;
exports.parseDescriptor = parseDescriptor;
exports.enabledModDirs = enabledModDirs;
exports.prescriptedNameKeys = prescriptedNameKeys;
exports.scanLoc = scanLoc;
exports.buildDefaultLore = buildDefaultLore;
// 제국 설명(전기) 읽기. 읽기 전용.
//  - 기본 제국: 게임 번역 파일의 EMPIRE_DESIGN_<이름> / EMPIRE_DESIGN_<이름>_desc
//  - 커스텀 제국: 문서 폴더의 user_empire_designs_*.txt 안 species_bio
// 게임 안에서는 전기를 볼 수 없으므로 앱이 미리 들고 있다가 AI 의 대화에 쓴다.
const fs = __importStar(require("fs"));
const environment_paths_1 = require("./environment-paths");
const path = __importStar(require("path"));
exports.LORE_MAX = 600; // 프롬프트에 넣는 최대 글자 수
/** 스텔라리스 스크립트(key = value / key = { ... })를 [키, 값] 목록으로 읽는다. 같은 키가 여러 번 나와도 순서대로 보존. */
function parsePdx(text) {
    const toks = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
        const c = text[i];
        if (c === '#') {
            while (i < n && text[i] !== '\n')
                i++;
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿') {
            i++;
            continue;
        }
        if (c === '{' || c === '}' || c === '=') {
            toks.push(c);
            i++;
            continue;
        }
        if (c === '"') {
            let j = i + 1;
            let s = '';
            while (j < n && text[j] !== '"') {
                if (text[j] === '\\' && j + 1 < n) {
                    s += text[j + 1] === 'n' ? '\n' : text[j + 1];
                    j += 2;
                }
                else
                    s += text[j++];
            }
            toks.push('"' + s);
            i = j + 1;
            continue;
        }
        let j = i;
        while (j < n && !' \t\r\n{}="#'.includes(text[j]))
            j++;
        if (j === i) {
            i++;
            continue;
        }
        toks.push(text.slice(i, j));
        i = j;
    }
    let p = 0;
    const unq = (t) => (t.startsWith('"') ? t.slice(1) : t);
    const block = () => {
        const out = [];
        while (p < toks.length && toks[p] !== '}') {
            const k = toks[p++];
            if (k === '{') {
                out.push(['', block()]);
                if (toks[p] === '}')
                    p++;
                continue;
            } // 키 없는 블록
            if (toks[p] === '=') {
                p++;
                if (toks[p] === '{') {
                    p++;
                    out.push([unq(k), block()]);
                    if (toks[p] === '}')
                        p++;
                }
                else if (p < toks.length)
                    out.push([unq(k), unq(toks[p++])]);
            }
            else
                out.push([unq(k), '']); // 값 없이 놓인 단어("a" "b" 목록)
        }
        return out;
    };
    const top = block();
    return top;
}
function child(e, key) {
    if (!Array.isArray(e))
        return undefined;
    for (const [k, v] of e)
        if (k === key)
            return v;
    return undefined;
}
/** user_empire_designs 파일에서 설계별 전기를 모은다. 키는 설계 이름. */
function parseUserDesigns(text) {
    const out = [];
    for (const [k, v] of parsePdx(text)) {
        if (!Array.isArray(v))
            continue;
        const species = child(v, 'species');
        const bio = child(species, 'species_bio');
        const key = (typeof child(v, 'key') === 'string' ? child(v, 'key') : '') || k;
        if (typeof bio === 'string' && bio.trim())
            out.push({ key: key.trim(), bio: bio.trim() });
    }
    return out;
}
/** 번역 파일에서 EMPIRE_DESIGN_ 키만 뽑는다. */
function parseEmpireLoc(yml) {
    const out = {};
    for (const line of yml.split('\n')) {
        const m = /^\s+(EMPIRE_DESIGN_[A-Za-z0-9_]+):\d*\s+"(.*)"\s*$/.exec(line.replace(/\r$/, ''));
        if (m)
            out[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return out;
}
/** 이름(EMPIRE_DESIGN_x) 과 설명(EMPIRE_DESIGN_x_desc) 쌍을 이름 -> 설명 표로 만든다. */
function pairLore(loc) {
    const out = {};
    for (const [k, v] of Object.entries(loc)) {
        if (k.endsWith('_desc'))
            continue;
        const d = loc[k + '_desc'];
        if (d && v)
            out[v.trim()] = d.trim();
    }
    return out;
}
function clipLore(s, max = exports.LORE_MAX) {
    const t = s.replace(/\s*\n+\s*/g, ' ').trim();
    return t.length <= max ? t : t.slice(0, max - 1) + '…';
}
function stellarisUserDir() {
    return (0, environment_paths_1.runtimeUserDir)();
}
function userDesignFiles() {
    const dir = stellarisUserDir();
    try {
        return fs.readdirSync(dir).filter((f) => /^user_empire_designs.*\.txt$/i.test(f)).map((f) => path.join(dir, f));
    }
    catch {
        return [];
    }
}
/** .mod 설명 파일에서 설치 폴더(path=)를 읽는다. archive=(압축 모드)만 있으면 폴더가 없으므로 null. */
function parseDescriptor(text) {
    for (const [k, v] of parsePdx(text))
        if (k === 'path' && typeof v === 'string' && v)
            return v;
    return null;
}
/** 지금 켜진 모드들의 설치 폴더를 로드 순서대로(아래에 있을수록 우선). 읽지 못하는 모드는 건너뛴다. */
function enabledModDirs(userDir = stellarisUserDir()) {
    let list = [];
    try {
        const j = JSON.parse(fs.readFileSync(path.join(userDir, 'dlc_load.json'), 'utf8'));
        if (Array.isArray(j.enabled_mods))
            list = j.enabled_mods.filter((x) => typeof x === 'string');
    }
    catch {
        return [];
    }
    const out = [];
    for (const rel of list) {
        try {
            const p = parseDescriptor(fs.readFileSync(path.join(userDir, rel), 'utf8'));
            if (!p)
                continue;
            const dir = path.normalize(path.isAbsolute(p) ? p : path.join(userDir, p));
            if (fs.existsSync(dir))
                out.push(dir);
        }
        catch { /* 건너뜀 */ }
    }
    return out;
}
/** prescripted_countries 폴더의 파일들에서 제국 이름 키(name = "KEY")를 모은다. */
function prescriptedNameKeys(text) {
    const out = [];
    for (const [, v] of parsePdx(text)) {
        const n = child(v, 'name');
        if (typeof n === 'string' && n)
            out.push(n);
    }
    return out;
}
function listFiles(dir, ext, deep) {
    const out = [];
    let ents = [];
    try {
        ents = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const e of ents) {
        const fp = path.join(dir, e.name);
        if (e.isFile() && e.name.toLowerCase().endsWith(ext))
            out.push(fp);
        else if (e.isDirectory() && deep)
            out.push(...listFiles(fp, ext, deep));
    }
    return out;
}
/** 번역 파일에서 필요한 키만 뽑는다. 언어는 첫 줄의 l_korean: / l_english: 로 안다. */
function scanLoc(yml, keep) {
    const map = {};
    let lang = '';
    for (const raw of yml.split('\n')) {
        const line = raw.replace(/\r$/, '');
        if (!lang) {
            const h = /^﻿?\s*l_([a-z_]+)\s*:/.exec(line);
            if (h) {
                lang = h[1];
                continue;
            }
        }
        const m = /^\s+([A-Za-z0-9_.\-']+):\d*\s+"(.*)"\s*(#.*)?$/.exec(line);
        if (m && keep(m[1]))
            map[m[1]] = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return { lang, map };
}
/** 게임 폴더와 켜진 모드 폴더들에서 기본형(미리 정의된) 제국의 이름 -> 설명 표를 만든다. 뒤에 오는 모드가 앞을 덮어쓴다. */
function buildDefaultLore(gameDir, modDirs, lang = 'korean') {
    const roots = [...(gameDir ? [gameDir] : []), ...modDirs];
    // 1) 제국 이름 키 모으기
    const needed = new Set();
    for (const r of roots) {
        for (const f of listFiles(path.join(r, 'prescripted_countries'), '.txt', false)) {
            try {
                for (const k of prescriptedNameKeys(fs.readFileSync(f, 'utf8')))
                    needed.add(k);
            }
            catch { /* 건너뜀 */ }
        }
    }
    const keep = (k) => needed.has(k) || (k.endsWith('_desc') && needed.has(k.slice(0, -5))) || k.startsWith('EMPIRE_DESIGN_');
    // 2) 번역 모으기: 선택 언어 우선, 없으면 영어. 뒤의 루트가 앞을 덮어쓴다.
    const pref = {}, fall = {};
    for (const r of roots) {
        for (const f of listFiles(path.join(r, 'localisation'), '.yml', true)) {
            let t = '';
            try {
                t = fs.readFileSync(f, 'utf8');
            }
            catch {
                continue;
            }
            if (!t.includes('_desc') && !t.includes('EMPIRE_DESIGN_'))
                continue; // 설명 키가 없는 파일은 건너뛰어 빠르게
            const { lang: l, map } = scanLoc(t, keep);
            if (l === lang)
                Object.assign(pref, map);
            else if (l === 'english')
                Object.assign(fall, map);
        }
    }
    const get = (k) => pref[k] ?? fall[k];
    // 3) 이름 -> 설명
    const out = {};
    const keys = new Set([...Object.keys(pref), ...Object.keys(fall)]);
    for (const k of keys) {
        if (k.endsWith('_desc'))
            continue;
        if (!needed.has(k) && !k.startsWith('EMPIRE_DESIGN_'))
            continue;
        const d = get(k + '_desc');
        const n = get(k);
        if (d && n)
            out[n.trim()] = d.trim();
    }
    return out;
}
class LoreStore {
    designFiles;
    modDirs;
    def = null;
    defSig = '';
    custom = null;
    constructor(designFiles = userDesignFiles, modDirs = () => enabledModDirs()) {
        this.designFiles = designFiles;
        this.modDirs = modDirs;
    }
    /** 기본형 제국 설명표(게임 + 켜진 모드). 게임 폴더나 켜진 모드가 바뀌면 다시 만든다. */
    loadDefault(gameDir, lang = 'korean') {
        const mods = this.modDirs();
        let sig = (gameDir ?? '') + '|' + lang + '|' + mods.join(';');
        try {
            sig += '|' + fs.statSync(path.join(stellarisUserDir(), 'dlc_load.json')).mtimeMs;
        }
        catch { /* 없음 */ }
        if (this.def && this.defSig === sig)
            return this.def;
        this.def = buildDefaultLore(gameDir, mods, lang);
        this.defSig = sig;
        return this.def;
    }
    /** 커스텀 제국 전기표(설계 이름 -> 전기). 파일이 바뀌면 다시 읽는다. */
    loadCustom() {
        const files = this.designFiles();
        let sig = '';
        for (const f of files) {
            try {
                sig += f + ':' + fs.statSync(f).mtimeMs + ';';
            }
            catch { /* 건너뜀 */ }
        }
        if (this.custom && this.custom.sig === sig)
            return this.custom.map;
        const map = {};
        for (const f of files) {
            try {
                for (const c of parseUserDesigns(fs.readFileSync(f, 'utf8')))
                    map[c.key] = c.bio;
            }
            catch { /* 건너뜀 */ }
        }
        this.custom = { sig, map };
        return map;
    }
    /** 제국 이름으로 설명을 찾는다. 커스텀 설계가 우선(같은 이름이면 사용자가 만든 쪽). 없으면 null. */
    lookup(name, gameDir) {
        const n = (name || '').trim();
        if (!n)
            return null;
        const c = this.loadCustom()[n];
        if (c)
            return { text: clipLore(c), source: 'custom' };
        const d = this.loadDefault(gameDir)[n];
        if (d)
            return { text: clipLore(d), source: 'default' };
        return null;
    }
}
exports.LoreStore = LoreStore;
//# sourceMappingURL=lore.js.map
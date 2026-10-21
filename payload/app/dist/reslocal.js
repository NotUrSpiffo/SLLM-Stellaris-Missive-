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
exports.cleanLoc = cleanLoc;
exports.resolutionText = resolutionText;
exports.resetResolutionCache = resetResolutionCache;
exports.fedLawName = fedLawName;
// 은하 공동체 안건 코드(resolution_xxx)의 한국어 이름·설명을 게임 번역 파일에서 읽는다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lore_1 = require("./lore");
let cache = null;
/** lang: 화면 언어의 게임 번역 폴더(korean·english·simp_chinese …). 영어를 깔고 그 언어로 덮는다(2026-10-19: 영어 화면에 한국어 안건 이름이 나오던 문제). */
function load(gameDir, lang = 'korean') {
    const sig = (gameDir ?? '') + '|' + lang;
    if (cache && cache.sig === sig)
        return cache.map;
    const map = {};
    if (gameDir) {
        for (const lc of lang === 'english' ? ['english'] : ['english', lang]) { // 영어를 먼저 깔고 화면 언어로 덮는다
            const dir = path.join(gameDir, 'localisation', lc);
            let files = [];
            try {
                files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.yml'));
            }
            catch {
                continue;
            }
            for (const f of files) {
                let t = '';
                try {
                    t = fs.readFileSync(path.join(dir, f), 'utf8');
                }
                catch {
                    continue;
                }
                if (!t.includes('resolution_'))
                    continue;
                Object.assign(map, (0, lore_1.scanLoc)(t, (k) => k.startsWith('resolution_')).map);
            }
        }
    }
    cache = { sig, map };
    return map;
}
/** 게임 문구의 색 표시(§Y …§!)와 $참조$를 걷어 읽기 좋게. */
function cleanLoc(s, map = {}, depth = 0) {
    let t = s.replace(/§./g, '').replace(/§!/g, '');
    t = t.replace(/\$([A-Za-z0-9_.\-]+)(\|[^$]*)?\$/g, (_m, k) => (depth < 3 && map[k] ? cleanLoc(map[k], map, depth + 1) : ''));
    return t.replace(/£[A-Za-z0-9_]+£/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function resolutionText(key, gameDir, lang = 'korean') {
    if (!key)
        return null;
    const map = load(gameDir, lang);
    const n = map[key];
    if (!n)
        return null;
    const d = map[key + '_desc'];
    return { title: cleanLoc(n, map), desc: d ? cleanLoc(d, map) : '' };
}
function resetResolutionCache() { cache = null; }
// A-01 2단계: 연방 법 이름(게임 번역 파일, 법 키 그대로가 번역 키). 영어를 깔고 한국어로 덮는다.
let fedCache = null;
function fedLawName(key, gameDir, keys, lang = 'korean') {
    const sig = (gameDir ?? '') + '|' + lang;
    if (!fedCache || fedCache.sig !== sig) {
        const map = {}, want = new Set(keys);
        if (gameDir)
            for (const lc of lang === 'english' ? ['english'] : ['english', lang]) {
                const dir = path.join(gameDir, 'localisation', lc);
                let files = [];
                try {
                    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.yml'));
                }
                catch {
                    continue;
                }
                for (const f of files) {
                    let t = '';
                    try {
                        t = fs.readFileSync(path.join(dir, f), 'utf8');
                    }
                    catch {
                        continue;
                    }
                    if (!/ (centralization|vote_weight|succession_type|kick_members|fleet_contribution|free_migration)_[a-z_]+:/.test(t))
                        continue;
                    Object.assign(map, (0, lore_1.scanLoc)(t, (k) => want.has(k)).map);
                }
            }
        fedCache = { sig, map };
    }
    const n = fedCache.map[key];
    return n ? cleanLoc(n, fedCache.map) : key;
}
//# sourceMappingURL=reslocal.js.map
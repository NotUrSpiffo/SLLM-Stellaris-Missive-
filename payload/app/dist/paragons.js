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
exports.PARAGONS = void 0;
exports.parseParagonLoc = parseParagonLoc;
exports.buildParagonIndex = buildParagonIndex;
exports.paragonIndex = paragonIndex;
exports.paragonFor = paragonFor;
exports.paragonBlock = paragonBlock;
// 파라곤(Galactic Paragons 고유 영웅) 배경(2026-10-19 집 PC: 게임 4.x events/paragon_events*.txt 에서 확인).
// 게임은 파라곤을 만들 때 이름(NAME_…)·설명(custom_description)·한마디(custom_catch_phrase) 지역화 키를 준다.
// 글은 앱·모드에 복사하지 않고(패러독스 글), 사용자 PC 의 게임 지역화에서 실행 중에만 읽는다. 앱에는 「이름 키 → 설명·한마디 키」 대응표만 둔다.
// 지도자 명단의 이름이 그 파라곤의 게임 속 이름(한국어·영어 어느 쪽이든)과 같으면 파라곤으로 본다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const trait_names_1 = require("./trait-names");
/** 이름 키, 설명 키, 한마디 키(게임 원본 그대로). */
exports.PARAGONS = [
    ['NAME_xenophile1', 'xenophile1', 'xenophile1_catch_phrase'],
    ['NAME_xenophile2', 'xenophile2', 'xenophile2_catch_phrase'],
    ['NAME_militarist1', 'militarist1', 'militarist1_catch_phrase'],
    ['NAME_militarist2', 'militarist2', 'militarist2_catch_phrase'],
    ['NAME_xenophobe1', 'xenophobe1', 'xenophobe1_catch_phrase'],
    ['NAME_xenophobe2', 'xenophobe2', 'xenophobe2_catch_phrase'],
    ['NAME_egalitarian1', 'egalitarian1', 'egalitarian1_catch_phrase'],
    ['NAME_egalitarian2', 'egalitarian2', 'egalitarian2_catch_phrase'],
    ['NAME_materialist1', 'materialist1', 'materialist1_catch_phrase'],
    ['NAME_materialist2', 'materialist2', 'materialist2_catch_phrase'],
    ['NAME_pacifist1', 'pacifist1', 'pacifist1_catch_phrase'],
    ['NAME_pacifist2', 'pacifist2', 'pacifist2_catch_phrase'],
    ['NAME_authoritarian1', 'authoritarian1', 'authoritarian1_catch_phrase'],
    ['NAME_authoritarian2', 'authoritarian2', 'authoritarian2_catch_phrase'],
    ['NAME_spiritualist1', 'spiritualist1', 'spiritualist1_catch_phrase'],
    ['NAME_spiritualist2', 'spiritualist2', 'spiritualist2_catch_phrase'],
    ['NAME_Skrand_Sharpbeak', 'skrand_desc', 'skrand_catch_phrase'],
    ['NAME_Exakeides', 'desc_exakeides', 'keides_catch_phrase'],
    ['NAME_The_Beholder', 'beholder_backstory', 'beholder_catch_phrase'],
    ['NAME_Astrocreator_Azaryn', 'astrocreator_azaryn_backstory', 'sadtoid_catch_phrase'],
];
const WANT = new Set(exports.PARAGONS.flat());
const LINE = /^\s+([A-Za-z0-9_]+):\d*\s+"(.*)"\s*$/;
/** yml 본문에서 대응표의 키만 뽑는다(먼저 읽은 값 우선). $다른 키$ 참조는 한 번 풀어 준다. */
function parseParagonLoc(text, into) {
    for (const line of text.split(/\r?\n/)) {
        const m = LINE.exec(line);
        if (m && WANT.has(m[1]) && into[m[1]] === undefined)
            into[m[1]] = m[2];
    }
}
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
/** 키 값들 → 이름(정규화) → 설명·한마디. names 는 이름을 찾을 때 쓰는 값들(한국어·영어), text 는 보여 줄 언어의 값. */
function buildParagonIndex(names, text) {
    const out = new Map();
    for (const [n, d, c] of exports.PARAGONS) {
        const lore = { desc: (0, trait_names_1.cleanLoc)(text[d] ?? '').slice(0, 600), catch: (0, trait_names_1.cleanLoc)((text[c] ?? '').replace(/\\"/g, '"')).replace(/^"|"$/g, '').slice(0, 200) };
        if (!lore.desc && !lore.catch)
            continue;
        for (const src of names) {
            const v = (0, trait_names_1.cleanLoc)(src[n] ?? '');
            if (v)
                out.set(norm(v), lore);
        }
    }
    return out;
}
const cache = new Map();
function readLang(gameDir, folder) {
    const o = {}, dir = path.join(gameDir, 'localisation', folder);
    let files = [];
    try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml') && /paragon/i.test(f));
    }
    catch {
        return o;
    }
    for (const f of files) {
        try {
            parseParagonLoc(fs.readFileSync(path.join(dir, f), 'utf8'), o);
        }
        catch { /* 못 읽으면 건너뜀 */ }
    }
    return o;
}
/** 게임 폴더의 파라곤 이름 → 배경(lang 언어). 게임 폴더를 모르면 빈 표. */
function paragonIndex(gameDir, lang) {
    if (!gameDir)
        return new Map();
    const key = gameDir + '|' + lang;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const ko = readLang(gameDir, 'korean'), en = readLang(gameDir, 'english');
    const idx = buildParagonIndex([ko, en], lang === 'ko' ? { ...en, ...ko } : { ...ko, ...en });
    cache.set(key, idx);
    return idx;
}
/** 지도자 이름으로 파라곤 배경 찾기. 아니면 null. */
function paragonFor(name, idx) { return idx.get(norm(name)) ?? null; }
/** AI 지시문용(영어 지시, 배경 글은 게임 언어 그대로). */
function paragonBlock(p) {
    if (!p.paragon)
        return '';
    return `[Paragon] You are one of the galaxy's renowned Paragons (a unique hero). Your canonical background from the game: ${p.paragon.desc}` + (p.paragon.catch ? ` Your signature line: "${p.paragon.catch}" (you may echo its spirit, do not repeat it word for word every time).` : '') + ' Stay consistent with this background.';
}
//# sourceMappingURL=paragons.js.map
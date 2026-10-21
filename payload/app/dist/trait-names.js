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
exports.OWN_TRAITS = void 0;
exports.cleanLoc = cleanLoc;
exports.prettyTrait = prettyTrait;
exports.parseTraitLoc = parseTraitLoc;
exports.traitNames = traitNames;
exports.traitLoc = traitLoc;
exports.traitLabel = traitLabel;
// 지도자 특성 이름(2026-10-18): 게임 폴더의 지역화 파일(localisation/<언어>/*.yml)에서 특성 키의 이름을 실행 중에만 읽는다(복사하지 않음).
// 한국어 화면이면 korean, 그 밖에는 english. 이름을 못 찾으면 키를 사람이 읽을 수 있게 바꿔 쓴다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const KEY = /^\s+((?:leader_trait|trait_ruler|subclass|gestalt_trait|trait)_[A-Za-z0-9_]+):\d*\s+"(.*)"\s*$/;
/** 지역화 값에서 게임 서식(§색, £아이콘£, $변수$, [함수])을 걷어 낸다. */
function cleanLoc(v) {
    return String(v || '').replace(/§[A-Za-z!]/g, '').replace(/£[^£]*£/g, '').replace(/\$[^$]*\$/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}
/** 키 → 읽을 수 있는 이름(지역화가 없을 때): leader_trait_cautious_2 → cautious 2 */
function prettyTrait(k) { return k.replace(/^(leader_trait|trait_ruler|subclass|gestalt_trait|trait)_/, '').replace(/_/g, ' ').trim(); }
/** yml 본문에서 특성 이름(키)과 설명(키_desc)을 뽑는다. 설명은 성격을 정할 때 참고한다. */
function parseTraitLoc(text, into, descs = {}) {
    for (const line of text.split(/\r?\n/)) {
        const m = KEY.exec(line);
        if (!m || /_tooltip$|_effect$|_tt$/.test(m[1]))
            continue;
        const v = cleanLoc(m[2]);
        if (!v)
            continue;
        if (m[1].endsWith('_desc')) {
            const k = m[1].slice(0, -5);
            if (!descs[k])
                descs[k] = v.slice(0, 120);
        }
        else if (!into[m[1]])
            into[m[1]] = v.slice(0, 40);
    }
}
const cache = new Map();
function traitNames(gameDir, lang) { return traitLoc(gameDir, lang).names; }
function traitLoc(gameDir, lang) {
    if (!gameDir) {
        const names = {}, descs = {};
        for (const [k, v] of Object.entries(exports.OWN_TRAITS)) {
            names[k] = lang === 'ko' ? v.ko : v.en;
            descs[k] = lang === 'ko' ? v.descKo : v.descEn;
        }
        return { names, descs };
    }
    const key = gameDir + '|' + lang;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const out = {}, descs = {};
    const read = (folder) => {
        const dir = path.join(gameDir, 'localisation', folder);
        let files = [];
        try {
            files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml'));
        }
        catch {
            return;
        }
        for (const f of files) {
            try {
                parseTraitLoc(fs.readFileSync(path.join(dir, f), 'utf8'), out, descs);
            }
            catch { /* 못 읽으면 건너뜀 */ }
        }
    };
    if (lang === 'ko')
        read('korean');
    read('english'); // 한국어에 없는 이름은 영어로
    for (const [k, v] of Object.entries(exports.OWN_TRAITS)) {
        out[k] = lang === 'ko' ? v.ko : v.en;
        descs[k] = lang === 'ko' ? v.descKo : v.descEn;
    }
    const r = { names: out, descs };
    cache.set(key, r);
    return r;
}
/** SLLM 이 붙이는 특성(게임 폴더가 아니라 연결 모드의 지역화에 있다). 모드 yml 과 같은 이름. i18n-data: 한/영 두 가지 */
exports.OWN_TRAITS = {
    sllm_trait_admiral_acclaimed: { ko: '추앙받는 제독', en: 'Acclaimed Admiral', descKo: '청문회에서 지도자에게 추앙받았다', descEn: 'Acclaimed by the ruler at a hearing' },
    sllm_trait_admiral_reprimanded: { ko: '질책받은 제독', en: 'Reprimanded Admiral', descKo: '청문회에서 지도자에게 질책받았다', descEn: 'Reprimanded by the ruler at a hearing' },
    sllm_trait_letter_trusted: { ko: '지도자의 신임', en: "Leader's Confidence", descKo: '개인 서신으로 청한 부탁을 지도자가 들어주었다', descEn: 'The ruler granted a request from a personal letter' },
};
function traitLabel(names, k) { return names[k] || prettyTrait(k); }
//# sourceMappingURL=trait-names.js.map
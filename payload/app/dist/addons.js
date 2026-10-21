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
exports.AddonRegistry = exports.MAX_LYRICS = exports.MAX_AUDIO = exports.AUDIO_EXT = exports.MUSIC_KINDS = exports.relOk = exports.MOD_ADDON_DIR = exports.ADDON_MANIFEST = void 0;
exports.parseMusic = parseMusic;
exports.mergeMusic = mergeMusic;
exports.listMusic = listMusic;
exports.sanitizeStrings = sanitizeStrings;
exports.sanitizePatterns = sanitizePatterns;
exports.parseLanguage = parseLanguage;
exports.loadLanguagePack = loadLanguagePack;
exports.parseManifest = parseManifest;
exports.sanitizeAddonPrefs = sanitizeAddonPrefs;
exports.orderAddons = orderAddons;
exports.mergeImages = mergeImages;
// 애드온(2026-10-16). 테마·그림·호환 해석(가치관·국가 종류·제국·사건)을 한 꾸러미로 묶어 켜고 끄고 순서를 정한다.
// 찾는 곳: (1) 게임에서 켠 모드 안의 sllm/addon/addon.json (창작마당 배포), (2) 앱 데이터의 addons/<폴더>/addon.json (직접 넣기).
// 데이터(JSON·그림)만 읽고 코드나 명령은 실행하지 않는다. 프롬프트 문구 바꾸기는 다음 업데이트(사용자 결정 2026-10-16).
// 우선순위: 목록 위쪽 애드온이 이긴다. 사용자가 설정에서 직접 넣은 그림·색은 항상 애드온보다 앞선다.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const images_1 = require("./images");
const theme_1 = require("./theme");
const language_1 = require("./language");
const i18n_pick_1 = require("./i18n-pick");
exports.ADDON_MANIFEST = 'addon.json';
exports.MOD_ADDON_DIR = 'sllm/addon';
const MAX_IMAGE = 8 * 1024 * 1024, MAX_MANIFEST = 512 * 1024, MAX_IMAGES = 200;
const IMG_EXT = /\.(png|jpe?g|webp)$/i;
const idOk = (s) => typeof s === 'string' && /^[a-zA-Z0-9_.-]{1,64}$/.test(s);
const text = (s, max) => (typeof s === 'string' ? s.replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
/** 애드온 안 상대 경로만(.. 나 절대 경로 금지). */
const relOk = (s) => typeof s === 'string' && s.length <= 200 && !/^[\\/]|^[a-z]:/i.test(s) && !s.replace(/\\/g, '/').split('/').some((x) => x === '..' || x === '' || x === '.');
exports.relOk = relOk;
exports.MUSIC_KINDS = ['anthem', 'march', 'creed']; // creed(복무신조)는 본문(가사) 파일만 있어도 되고 곡 파일은 선택
exports.AUDIO_EXT = /\.(mp3|ogg|oga|opus|wav|m4a|aac|flac)$/i;
const LYRICS_EXT = /\.(txt|md)$/i;
exports.MAX_AUDIO = 24 * 1024 * 1024, exports.MAX_LYRICS = 64 * 1024;
/** "music" 항목 검사. 곡은 "경로" 한 줄이나 {file, title, lyrics} 객체. 틀린 곡은 버리고 이유를 남긴다. */
function parseMusic(v, warnings) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
        warnings.push('music 은 {"anthem": …, "march": …} 객체여야 합니다.');
        return null;
    }
    const m = v, out = { anthem: null, march: null, creed: null };
    for (const k of Object.keys(m))
        if (!exports.MUSIC_KINDS.includes(k))
            warnings.push('알 수 없는 music 항목: ' + text(k, 40) + ' (anthem·march·creed 만 쓸 수 있습니다)');
    for (const kind of exports.MUSIC_KINDS) {
        const t = m[kind];
        if (t === undefined)
            continue;
        const o = typeof t === 'string' ? (kind === 'creed' && LYRICS_EXT.test(t) ? { lyrics: t } : { file: t }) : t && typeof t === 'object' && !Array.isArray(t) ? t : null;
        if (!o) {
            warnings.push(`music.${kind} 는 파일 경로이거나 {"file": …} 객체여야 합니다.`);
            continue;
        }
        let file = '';
        if (o.file !== undefined || kind !== 'creed') {
            if (!(0, exports.relOk)(o.file) || !exports.AUDIO_EXT.test(o.file)) {
                warnings.push(`music.${kind}.file 은 애드온 안의 mp3·ogg·wav·m4a·aac·flac 파일 경로여야 합니다.`);
                continue;
            }
            file = o.file.replace(/\\/g, '/');
        }
        let lyrics = '';
        if (o.lyrics !== undefined) {
            if ((0, exports.relOk)(o.lyrics) && LYRICS_EXT.test(o.lyrics))
                lyrics = o.lyrics.replace(/\\/g, '/');
            else
                warnings.push(`music.${kind}.lyrics 는 애드온 안의 .txt·.md 파일 경로여야 합니다.`);
        }
        if (kind === 'creed' && !file && !lyrics) {
            warnings.push('music.creed 에는 본문 파일(.txt·.md)이나 곡 파일이 있어야 합니다.');
            continue;
        }
        out[kind] = { file, title: text(o.title, 80), lyrics };
    }
    if (!out.anthem && !out.march && !out.creed) {
        warnings.push('music 에 쓸 수 있는 곡이 없습니다.');
        return null;
    }
    return out;
}
/** 켜진 애드온의 곡 합치기: 종류마다 위쪽 애드온 하나(목록 순서). */
const trackName = (file) => text(path.basename(file).replace(exports.AUDIO_EXT, '').replace(/[_]+/g, ' '), 80);
const lyricsText = (b) => b.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, 8000);
function mergeMusic(list, prefs) {
    const out = { anthem: null, march: null, creed: null };
    for (const a of list) {
        if (prefs.disabled.includes(a.id) || !a.music)
            continue;
        for (const k of exports.MUSIC_KINDS)
            if (!out[k] && a.music[k])
                out[k] = a.music[k];
    }
    return out;
}
/** 켜진 애드온마다 한 곡씩, 목록 순서대로(애드온 복무신조 찾기 등, 2026-10-20). 없으면 빈 목록. */
function listMusic(list, prefs, kind) {
    const out = [];
    for (const a of list) {
        if (prefs.disabled.includes(a.id) || !a.music)
            continue;
        const t = a.music[kind];
        if (t)
            out.push(t);
    }
    return out;
}
const MAX_LANG_FILE = 4 * 1024 * 1024, MAX_STRINGS = 20000, MAX_PATTERNS = 1000;
/** 번역 표 검사: 문자열 → 문자열만, 길이 제한, 제어 문자 제거(줄바꿈·탭은 둠). */
function sanitizeStrings(v, warnings) {
    const out = {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
        warnings.push((0, i18n_pick_1.L)('language.strings 는 {"원문": "번역"} 형식이어야 합니다.', 'language.strings must be in the form {"source": "translation"}.'));
        return out;
    }
    let n = 0, bad = 0;
    for (const [k, val] of Object.entries(v)) {
        if (n >= MAX_STRINGS) {
            warnings.push((0, i18n_pick_1.L)(`번역 문구는 ${MAX_STRINGS}개까지만 읽습니다.`, `Only the first ${MAX_STRINGS} strings are read.`));
            break;
        }
        if (typeof val !== 'string' || !k.trim() || k.length > 4000 || val.length > 4000) {
            bad++;
            continue;
        }
        const key = k.trim().replace(/\s+/g, ' '), t = val.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
        if (!t.trim()) {
            bad++;
            continue;
        }
        out[key] = t;
        n++;
    }
    if (bad)
        warnings.push((0, i18n_pick_1.L)(`번역 문구 ${bad}개는 형식이 틀려 건너뛰었습니다.`, `Skipped ${bad} malformed strings.`));
    return out;
}
/** 패턴 검사: [정규식, 바꿀 글] 쌍, ^…$ 로 감싼 것만, 실제로 만들어지는 정규식만. */
function sanitizePatterns(v, warnings) {
    const out = [];
    if (!Array.isArray(v)) {
        warnings.push((0, i18n_pick_1.L)('language.patterns 는 [["^정규식$", "바꿀 글"], …] 형식이어야 합니다.', 'language.patterns must be in the form [["^regex$", "replacement"], …].'));
        return out;
    }
    let bad = 0;
    for (const p of v) {
        if (out.length >= MAX_PATTERNS) {
            warnings.push((0, i18n_pick_1.L)(`패턴은 ${MAX_PATTERNS}개까지만 읽습니다.`, `Only the first ${MAX_PATTERNS} patterns are read.`));
            break;
        }
        if (!Array.isArray(p) || typeof p[0] !== 'string' || typeof p[1] !== 'string' || p[0].length > 400 || p[1].length > 1000 || !p[0].startsWith('^') || !p[0].endsWith('$')) {
            bad++;
            continue;
        }
        try {
            new RegExp(p[0]);
        }
        catch {
            bad++;
            continue;
        }
        out.push([p[0], p[1].replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')]);
    }
    if (bad)
        warnings.push((0, i18n_pick_1.L)(`패턴 ${bad}개는 형식이 틀려 건너뛰었습니다(^…$ 로 감싼 정규식만).`, `Skipped ${bad} malformed patterns (only regexes wrapped in ^…$).`));
    return out;
}
/** "language" 항목 검사(파일은 아직 읽지 않음). 틀리면 null + 경고. */
function parseLanguage(v, warnings) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
        warnings.push((0, i18n_pick_1.L)('language 는 객체여야 합니다.', 'language must be an object.'));
        return null;
    }
    const l = v;
    if (!(0, language_1.packCodeOk)(l.code)) {
        warnings.push((0, i18n_pick_1.L)('language.code 는 "zh-CN"·"ja" 같은 언어 코드여야 합니다(ko·en 은 기본 언어라 쓸 수 없음).', 'language.code must be a language code such as "zh-CN" or "ja" (ko and en are built in and cannot be used).'));
        return null;
    }
    const name = text(l.name, 40);
    if (!name) {
        warnings.push((0, i18n_pick_1.L)('language.name(선택지에 보일 이름)이 없습니다.', 'language.name (the name shown in the list) is missing.'));
        return null;
    }
    const game = typeof l.gameLanguage === 'string' && /^l_[a-z_]{2,30}$/.test(l.gameLanguage) ? l.gameLanguage : null;
    if (l.gameLanguage !== undefined && !game)
        warnings.push((0, i18n_pick_1.L)('language.gameLanguage 는 "l_simp_chinese" 같은 스텔라리스 언어 이름이어야 합니다.', 'language.gameLanguage must be a Stellaris language name such as "l_simp_chinese".'));
    const system = (Array.isArray(l.system) ? l.system : typeof l.system === 'string' ? [l.system] : []).filter((x) => typeof x === 'string' && /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8}){0,2}$/.test(x)).slice(0, 8);
    const strings = typeof l.strings === 'string' ? ((0, exports.relOk)(l.strings) && /\.json$/i.test(l.strings) ? l.strings.replace(/\\/g, '/') : null) : (l.strings && typeof l.strings === 'object' && !Array.isArray(l.strings) ? l.strings : null);
    if (l.strings !== undefined && !strings)
        warnings.push((0, i18n_pick_1.L)('language.strings 는 번역 표 객체이거나 애드온 안 .json 파일 경로여야 합니다.', 'language.strings must be a translation table object or the path of a .json file inside the add-on.'));
    const patterns = typeof l.patterns === 'string' ? ((0, exports.relOk)(l.patterns) && /\.json$/i.test(l.patterns) ? l.patterns.replace(/\\/g, '/') : null) : (Array.isArray(l.patterns) ? l.patterns : null);
    if (l.patterns !== undefined && !patterns)
        warnings.push((0, i18n_pick_1.L)('language.patterns 는 패턴 배열이거나 애드온 안 .json 파일 경로여야 합니다.', 'language.patterns must be a pattern array or the path of a .json file inside the add-on.'));
    return { code: l.code, name, gameLanguage: game, system, aiLanguage: text(l.aiLanguage, 60) || name, strings, patterns };
}
/** 파일 경로로 된 strings·patterns 를 읽어 언어 팩을 만든다. read(rel) 는 애드온 안 파일 내용(없으면 null). */
function loadLanguagePack(m, addonId, read, warnings) {
    const json = (rel) => {
        const b = read(rel);
        if (!b) {
            warnings.push((0, i18n_pick_1.L)('언어 파일 없음: ', 'Language file missing: ') + rel);
            return null;
        }
        if (b.length > MAX_LANG_FILE) {
            warnings.push((0, i18n_pick_1.L)(`${rel}: 4MB 초과`, `${rel}: larger than 4MB`));
            return null;
        }
        try {
            return JSON.parse(b.toString('utf8').replace(/^\uFEFF/, ''));
        }
        catch (e) {
            warnings.push((0, i18n_pick_1.L)(`${rel}: JSON 을 읽지 못했습니다 (${e.message})`, `${rel}: could not read the JSON (${e.message})`));
            return null;
        }
    };
    const sRaw = typeof m.strings === 'string' ? json(m.strings) : m.strings, pRaw = typeof m.patterns === 'string' ? json(m.patterns) : m.patterns;
    const strings = sRaw == null ? {} : sanitizeStrings(sRaw, warnings), patterns = pRaw == null ? [] : sanitizePatterns(pRaw, warnings);
    if (!Object.keys(strings).length && !patterns.length)
        warnings.push((0, i18n_pick_1.L)('언어 팩에 번역 문구가 없습니다. 빠진 문구는 영어로 보입니다.', 'The language pack has no strings. Missing strings are shown in English.'));
    return { code: m.code, name: m.name, gameLanguage: m.gameLanguage, system: m.system, aiLanguage: m.aiLanguage, strings, patterns, addonId };
}
/** addon.json 검사. 틀린 항목은 버리고 이유를 warnings 에 남긴다. 필수(version·id·name)가 없으면 null. */
function parseManifest(raw, warnings) {
    let j;
    try {
        const v = JSON.parse(raw);
        if (!v || typeof v !== 'object' || Array.isArray(v))
            throw Error((0, i18n_pick_1.L)('객체가 아닙니다', 'not an object'));
        j = v;
    }
    catch (e) {
        warnings.push((0, i18n_pick_1.L)('addon.json 을 읽지 못했습니다: ', 'Could not read addon.json: ') + e.message);
        return null;
    }
    if (j.version !== 1) {
        warnings.push((0, i18n_pick_1.L)('version 은 1 이어야 합니다.', 'version must be 1.'));
        return null;
    }
    if (!idOk(j.id)) {
        warnings.push((0, i18n_pick_1.L)('id 는 영문·숫자·_.- 1~64자여야 합니다.', 'id must be 1–64 characters of letters, digits and _.-'));
        return null;
    }
    const name = text(j.name, 80);
    if (!name) {
        warnings.push((0, i18n_pick_1.L)('name 이 없습니다.', 'name is missing.'));
        return null;
    }
    let theme = null;
    if (j.theme !== undefined) {
        const t = j.theme, custom = (0, theme_1.sanitizeCustom)(t?.colors ?? t?.custom);
        if (Object.keys(custom).length)
            theme = { name: text(t?.name, 60) || name, custom };
        else
            warnings.push((0, i18n_pick_1.L)('theme.colors 에 쓸 수 있는 색(#rrggbb)이 없습니다.', 'theme.colors has no usable colors (#rrggbb).'));
    }
    const images = {};
    if (j.images !== undefined) {
        if (!j.images || typeof j.images !== 'object' || Array.isArray(j.images))
            warnings.push((0, i18n_pick_1.L)('images 는 {"그림 키": "경로"} 형식이어야 합니다.', 'images must be in the form {"image key": "path"}.'));
        else
            for (const [k, v] of Object.entries(j.images)) {
                if (Object.keys(images).length >= MAX_IMAGES) {
                    warnings.push((0, i18n_pick_1.L)(`그림은 ${MAX_IMAGES}개까지만 읽습니다.`, `Only the first ${MAX_IMAGES} images are read.`));
                    break;
                }
                if (!(0, images_1.isImageKey)(k) || k.startsWith('save:')) {
                    warnings.push((0, i18n_pick_1.L)('알 수 없는 그림 키: ', 'Unknown image key: ') + text(k, 60));
                    continue;
                }
                if (!(0, exports.relOk)(v) || !IMG_EXT.test(v)) {
                    warnings.push((0, i18n_pick_1.L)(`${k}: 그림 경로는 애드온 안의 png/jpg/webp 여야 합니다.`, `${k}: the image path must be a png/jpg/webp inside the add-on.`));
                    continue;
                }
                images[k] = v.replace(/\\/g, '/');
            }
    }
    let compatibility = null;
    if (j.compatibility !== undefined) {
        if (j.compatibility && typeof j.compatibility === 'object' && !Array.isArray(j.compatibility))
            compatibility = { ...j.compatibility, version: 1, id: 'addon_' + j.id, name: name };
        else
            warnings.push((0, i18n_pick_1.L)('compatibility 는 호환 파일과 같은 객체여야 합니다.', 'compatibility must be an object like a compatibility file.'));
    }
    const language = j.language !== undefined ? parseLanguage(j.language, warnings) : null;
    const music = j.music !== undefined ? parseMusic(j.music, warnings) : null;
    return { version: 1, id: j.id, name, author: text(j.author, 60), description: text(j.description, 300), addonVersion: text(j.addonVersion ?? j.version_name, 20), theme, images, compatibility, language, music };
}
function sanitizeAddonPrefs(v) {
    const o = (v ?? {}), list = (x) => (Array.isArray(x) ? [...new Set(x.filter(idOk))].slice(0, 200) : []);
    return { order: list(o.order), disabled: list(o.disabled) };
}
/** 목록 순서: 사용자가 정한 순서 → 새로 발견된 것(모드 로드 순서, 그다음 직접 넣은 것). 같은 id 는 먼저 찾은 것 하나만. */
function orderAddons(found, prefs) {
    const byId = new Map();
    for (const a of found)
        if (!byId.has(a.id))
            byId.set(a.id, a);
    const out = prefs.order.filter((id) => byId.has(id)).map((id) => byId.get(id));
    for (const a of byId.values())
        if (!out.includes(a))
            out.push(a);
    return out;
}
/** 켜진 애드온의 그림을 합친다(위쪽 우선). */
function mergeImages(list, prefs) {
    const out = {};
    for (const a of [...list].reverse())
        if (!prefs.disabled.includes(a.id))
            Object.assign(out, a.images);
    return out;
}
class AddonRegistry {
    resources;
    userDir;
    cacheDir;
    prefs;
    found = [];
    sig = '';
    revision = 0;
    constructor(resources, userDir, cacheDir, prefs) {
        this.resources = resources;
        this.userDir = userDir;
        this.cacheDir = cacheDir;
        this.prefs = prefs;
    }
    invalidate() { this.sig = ''; }
    fromRoot(r) {
        const mf = this.resources.fileIn(r, `${exports.MOD_ADDON_DIR}/${exports.ADDON_MANIFEST}`);
        if (!mf)
            return null;
        const warnings = [];
        let raw = '';
        try {
            const b = this.resources.read(mf);
            if (b.length > MAX_MANIFEST)
                throw Error((0, i18n_pick_1.L)('addon.json 이 너무 큽니다', 'addon.json is too large'));
            raw = b.toString('utf8');
        }
        catch (e) {
            warnings.push(e.message);
        }
        const m = raw ? parseManifest(raw, warnings) : null;
        if (!m)
            return { id: 'invalid_' + (r.id || r.name).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 40), name: r.name, author: '', description: '', addonVersion: '', source: 'mod', origin: r.name, theme: null, images: {}, compatibility: null, base: '', language: null, music: null, warnings };
        const images = {};
        for (const [k, rel] of Object.entries(m.images)) {
            const f = this.resources.fileIn(r, `${exports.MOD_ADDON_DIR}/${rel}`);
            if (!f) {
                warnings.push((0, i18n_pick_1.L)(`${k}: 그림 파일 없음 (${rel})`, `${k}: image file missing (${rel})`));
                continue;
            }
            try {
                if (r.dir) {
                    if (fs.statSync(f.source).size > MAX_IMAGE)
                        throw Error((0, i18n_pick_1.L)('8MB 초과', 'larger than 8MB'));
                    images[k] = (0, url_1.pathToFileURL)(f.source).href;
                }
                else { // 압축 모드: 앱 데이터의 캐시에 풀어 둔다
                    const b = this.resources.read(f);
                    if (b.length > MAX_IMAGE)
                        throw Error((0, i18n_pick_1.L)('8MB 초과', 'larger than 8MB'));
                    const out = path.join(this.cacheDir(), m.id, rel);
                    fs.mkdirSync(path.dirname(out), { recursive: true });
                    if (!fs.existsSync(out) || fs.statSync(out).size !== b.length)
                        fs.writeFileSync(out, b);
                    images[k] = (0, url_1.pathToFileURL)(out).href;
                }
            }
            catch (e) {
                warnings.push(`${k}: ${e.message}`);
            }
        }
        const language = m.language ? loadLanguagePack(m.language, m.id, (rel) => { const f = this.resources.fileIn(r, `${exports.MOD_ADDON_DIR}/${rel}`); return f ? this.resources.read(f) : null; }, warnings) : null;
        const music = m.music ? this.loadMusicRoot(r, m, warnings) : null;
        return { ...m, source: 'mod', origin: r.name, images, base: r.dir ? path.join(r.dir, exports.MOD_ADDON_DIR) : '', language, music, warnings };
    }
    /** 모드 안 곡 읽기: 폴더형은 그대로 file URL, 압축형은 앱 데이터 캐시에 풀어 둔다. */
    loadMusicRoot(r, m, warnings) {
        const out = {};
        for (const kind of exports.MUSIC_KINDS) {
            const t = m.music?.[kind];
            if (!t)
                continue;
            const f = t.file ? this.resources.fileIn(r, `${exports.MOD_ADDON_DIR}/${t.file}`) : null;
            if (t.file && !f) {
                warnings.push(`${kind}: 곡 파일 없음 (${t.file})`);
                continue;
            }
            try {
                let url = '';
                if (!f) { /* 복무신조: 본문만 있고 곡 파일은 없음 */ }
                else if (r.dir) {
                    if (fs.statSync(f.source).size > exports.MAX_AUDIO)
                        throw Error('24MB 초과');
                    url = (0, url_1.pathToFileURL)(f.source).href;
                }
                else {
                    const b = this.resources.read(f);
                    if (b.length > exports.MAX_AUDIO)
                        throw Error('24MB 초과');
                    const o = path.join(this.cacheDir(), m.id, t.file);
                    fs.mkdirSync(path.dirname(o), { recursive: true });
                    if (!fs.existsSync(o) || fs.statSync(o).size !== b.length)
                        fs.writeFileSync(o, b);
                    url = (0, url_1.pathToFileURL)(o).href;
                }
                let lyrics = '';
                if (t.lyrics) {
                    const lf = this.resources.fileIn(r, `${exports.MOD_ADDON_DIR}/${t.lyrics}`);
                    if (!lf)
                        warnings.push(`${kind}: 가사 파일 없음 (${t.lyrics})`);
                    else {
                        const b = this.resources.read(lf);
                        if (b.length > exports.MAX_LYRICS)
                            warnings.push(`${kind}: 가사 파일이 64KB 를 넘어 건너뜁니다`);
                        else
                            lyrics = lyricsText(b);
                    }
                }
                out[kind] = { url, title: t.title || (t.file ? trackName(t.file) : ''), lyrics, addonId: m.id, addonName: m.name };
            }
            catch (e) {
                warnings.push(`${kind}: ${e.message}`);
            }
        }
        return out;
    }
    loadMusicFolder(dir, m, warnings) {
        const out = {};
        const inside = (rel) => { const f = path.resolve(dir, rel), back = path.relative(dir, f); return back.startsWith('..') || path.isAbsolute(back) ? null : f; };
        for (const kind of exports.MUSIC_KINDS) {
            const t = m.music?.[kind];
            if (!t)
                continue;
            const f = t.file ? inside(t.file) : '';
            if (f === null) {
                warnings.push(`${kind}: 애드온 밖 경로`);
                continue;
            }
            try {
                if (f) {
                    const st = fs.statSync(f);
                    if (!st.isFile())
                        throw Error('파일 아님');
                    if (st.size > exports.MAX_AUDIO)
                        throw Error('24MB 초과');
                }
                let lyrics = '';
                if (t.lyrics) {
                    const lf = inside(t.lyrics);
                    if (!lf)
                        warnings.push(`${kind}: 가사가 애드온 밖 경로`);
                    else {
                        try {
                            const ls = fs.statSync(lf);
                            if (!ls.isFile())
                                throw Error('x');
                            if (ls.size > exports.MAX_LYRICS)
                                warnings.push(`${kind}: 가사 파일이 64KB 를 넘어 건너뜁니다`);
                            else
                                lyrics = lyricsText(fs.readFileSync(lf));
                        }
                        catch {
                            warnings.push(`${kind}: 가사 파일 없음 (${t.lyrics})`);
                        }
                    }
                }
                out[kind] = { url: f ? (0, url_1.pathToFileURL)(f).href : '', title: t.title || (t.file ? trackName(t.file) : ''), lyrics, addonId: m.id, addonName: m.name };
            }
            catch (e) {
                const msg = e.message;
                warnings.push(`${kind}: ${/^(파일 아님|24MB 초과)$/.test(msg) ? msg : '곡 파일 없음 (' + t.file + ')'}`);
            }
        }
        return out;
    }
    fromFolder(dir) {
        const mfp = path.join(dir, exports.ADDON_MANIFEST);
        if (!fs.existsSync(mfp))
            return null;
        const warnings = [];
        let raw = '';
        try {
            if (fs.statSync(mfp).size > MAX_MANIFEST)
                throw Error((0, i18n_pick_1.L)('addon.json 이 너무 큽니다', 'addon.json is too large'));
            raw = fs.readFileSync(mfp, 'utf8');
        }
        catch (e) {
            warnings.push(e.message);
        }
        const m = raw ? parseManifest(raw, warnings) : null, origin = path.basename(dir);
        if (!m)
            return { id: 'invalid_' + origin.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 40), name: origin, author: '', description: '', addonVersion: '', source: 'user', origin, theme: null, images: {}, compatibility: null, base: '', language: null, music: null, warnings };
        const images = {};
        for (const [k, rel] of Object.entries(m.images)) {
            const f = path.resolve(dir, rel), back = path.relative(dir, f);
            if (back.startsWith('..') || path.isAbsolute(back)) {
                warnings.push((0, i18n_pick_1.L)(`${k}: 애드온 밖 경로`, `${k}: path outside the add-on`));
                continue;
            }
            try {
                const st = fs.statSync(f);
                if (!st.isFile())
                    throw Error((0, i18n_pick_1.L)('파일 아님', 'not a file'));
                if (st.size > MAX_IMAGE)
                    throw Error((0, i18n_pick_1.L)('8MB 초과', 'larger than 8MB'));
                images[k] = (0, url_1.pathToFileURL)(f).href;
            }
            catch (e) {
                warnings.push((0, i18n_pick_1.L)(`${k}: 그림 파일 없음 (${rel})`, `${k}: image file missing (${rel})`));
            }
        }
        const language = m.language ? loadLanguagePack(m.language, m.id, (rel) => {
            const f = path.resolve(dir, rel), back = path.relative(dir, f);
            if (back.startsWith('..') || path.isAbsolute(back))
                return null;
            try {
                const st = fs.statSync(f);
                if (!st.isFile())
                    return null;
                return st.size > MAX_LANG_FILE ? Buffer.alloc(MAX_LANG_FILE + 1) : fs.readFileSync(f);
            }
            catch {
                return null;
            }
        }, warnings) : null;
        const music = m.music ? this.loadMusicFolder(dir, m, warnings) : null;
        return { ...m, source: 'user', origin, images, base: dir, language, music, warnings };
    }
    refresh(force = false) {
        this.resources.refresh();
        const ud = this.userDir();
        let dirs = [];
        try {
            dirs = fs.readdirSync(ud, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(ud, d.name)).sort();
        }
        catch { /* 아직 폴더 없음 */ }
        const stamp = (p) => { try {
            return fs.statSync(p).mtimeMs;
        }
        catch {
            return 0;
        } };
        const sig = this.resources.revision + '|' + dirs.map((d) => d + ':' + stamp(path.join(d, exports.ADDON_MANIFEST))).join(';');
        if (!force && sig === this.sig)
            return;
        this.sig = sig;
        this.revision++;
        const found = [];
        for (const r of this.resources.roots)
            if (r.id !== 'base') {
                try {
                    const a = this.fromRoot(r);
                    if (a)
                        found.push(a);
                }
                catch { /* 한 모드 실패는 건너뜀 */ }
            }
        for (const d of dirs) {
            try {
                const a = this.fromFolder(d);
                if (a)
                    found.push(a);
            }
            catch { /* 건너뜀 */ }
        }
        this.found = found;
    }
    /** 설정 순서를 반영한 전체 목록 */
    list() { this.refresh(); return orderAddons(this.found, this.prefs()); }
    enabled() { const p = this.prefs(); return this.list().filter((a) => !p.disabled.includes(a.id) && !a.id.startsWith('invalid_')); }
    /** 켜진 애드온 그림(위쪽 우선) */
    images() { const p = this.prefs(); return mergeImages(this.list().filter((a) => !a.id.startsWith('invalid_')), p); }
    /** 켜진 애드온의 국가·군가(종류마다 위쪽 하나). */
    music() { return mergeMusic(this.list().filter((a) => !a.id.startsWith('invalid_')), this.prefs()); }
    musicList(kind) { return listMusic(this.list().filter((a) => !a.id.startsWith('invalid_')), this.prefs(), kind); }
    /** 호환 해석: 아래쪽부터 넣어 위쪽이 덮어쓰게 한다. */
    compatPacks() {
        return this.enabled().filter((a) => a.compatibility).reverse().map((a) => ({ pack: a.compatibility, source: `애드온 ${a.name} (${a.origin})`, base: a.base }));
    }
    /** 켜진 애드온의 언어 팩(위쪽 우선, 같은 코드는 위쪽 하나만). */
    languagePacks() {
        const out = [];
        for (const a of this.enabled())
            if (a.language && !out.some((p) => p.code === a.language.code))
                out.push(a.language);
        return out;
    }
    signature() { this.refresh(); const p = this.prefs(); return this.revision + '|' + p.order.join(',') + '|' + p.disabled.join(','); }
}
exports.AddonRegistry = AddonRegistry;
//# sourceMappingURL=addons.js.map
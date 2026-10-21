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
exports.addonsDir = void 0;
exports.initAddons = initAddons;
exports.addonImages = addonImages;
exports.addonMusic = addonMusic;
exports.addonMusicList = addonMusicList;
exports.addonCompat = addonCompat;
exports.addonLanguagePacks = addonLanguagePacks;
exports.onAddonsChanged = onAddonsChanged;
exports.writeLanguageTemplate = writeLanguageTemplate;
exports.registerAddons = registerAddons;
// 애드온 목록·켜기·순서 IPC(2026-10-16). 규칙과 읽기는 src/addons.ts.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const addons_1 = require("../addons");
const settings_1 = require("../app/settings");
const diagnostics_1 = require("../diagnostics");
const i18n_pairs_1 = require("../i18n-pairs");
let registry = null;
const addonsDir = () => path.join(electron_1.app.getPath('userData'), 'addons');
exports.addonsDir = addonsDir;
function initAddons(resources) {
    registry = new addons_1.AddonRegistry(resources, exports.addonsDir, () => path.join(electron_1.app.getPath('userData'), 'addon_cache'), () => settings_1.settings.addons);
    return registry;
}
/** 켜진 애드온의 그림(위쪽 우선). 사용자 그림은 imageState 가 그 위에 덮는다. */
function addonImages() { try {
    return registry?.images() ?? {};
}
catch {
    return {};
} }
/** 켜진 애드온의 국가·군가(종류마다 위쪽 팩 하나, 2026-10-20). 앱 화면에서만 쓴다. */
function addonMusic() { try {
    return registry?.music() ?? { anthem: null, march: null, creed: null };
}
catch {
    return { anthem: null, march: null, creed: null };
} }
/** 켜진 애드온들이 주는 곡 목록(종류별, 애드온 순서). 복무신조 찾기에 쓴다. */
function addonMusicList(kind) { try {
    return registry?.musicList(kind) ?? [];
}
catch {
    return [];
} }
/** 호환 해석에 넣을 애드온 자료 */
function addonCompat() {
    if (!registry)
        return { sig: '', packs: [] };
    try {
        return { sig: registry.signature(), packs: registry.compatPacks() };
    }
    catch {
        return { sig: 'error', packs: [] };
    }
}
/** 켜진 애드온의 언어 팩. 화면 문구마다 불리므로 3초 동안 기억한다(애드온을 바꾸면 바로 비움). */
let packCache = { at: 0, list: [] };
function addonLanguagePacks() {
    const now = Date.now();
    if (now - packCache.at < 3000)
        return packCache.list;
    let list = [];
    try {
        list = registry?.languagePacks() ?? [];
    }
    catch { /* 애드온 읽기 실패 → 기본 언어만 */ }
    packCache = { at: now, list };
    return list;
}
/** 애드온 목록·켜기가 바뀌면 부른다(화면 언어가 바뀌었을 수 있으니 모든 창에 알림). settings-ui 가 등록. */
const changed = [];
function onAddonsChanged(fn) { changed.push(fn); }
function fireChanged() { packCache.at = 0; for (const f of changed) {
    try {
        f();
    }
    catch { /* 알림 실패는 무시 */ }
} }
/** 언어 팩 뼈대: 앱의 한국어 원문 → 영어 번역 표와 패턴을 그대로 담은 애드온 폴더를 만든다(번역자가 값만 바꾸면 됨). */
function writeLanguageTemplate(outDir) {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'i18n-catalog.js'), 'utf8');
    const [catalog, catPatterns] = new Function(src + ';return [SLLMCatalog, SLLMPatterns];')();
    // 카탈로그 밖의 한/영 쌍(L('한국어', 'English'))도 배포된 창·메인 코드에서 모은다(2026-10-18).
    const texts = [];
    const scan = (dir, depth = 0) => {
        let list = [];
        try {
            list = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const d of list) {
            const p = path.join(dir, d.name);
            if (d.isDirectory() && depth < 3 && d.name !== 'node_modules')
                scan(p, depth + 1);
            else if (/\.(html|js)$/.test(d.name) && !/i18n-catalog|selftest/.test(d.name)) {
                try {
                    texts.push(fs.readFileSync(p, 'utf8'));
                }
                catch { /* 건너뜀 */ }
            }
        }
    };
    scan(path.join(__dirname, '..', '..', 'ui'));
    scan(path.join(__dirname, '..'));
    const pairs = (0, i18n_pairs_1.extractPairs)(texts), catalog2 = { ...catalog };
    for (const [k, v] of Object.entries(pairs.strings))
        if (!(k in catalog2))
            catalog2[k] = v;
    const patterns = [...catPatterns, ...pairs.patterns.filter((p) => !catPatterns.some((c) => c[0] === p[0]))];
    fs.mkdirSync(outDir, { recursive: true });
    const manifest = {
        version: 1, id: 'language_xx', name: 'Language pack (template)', author: '', addonVersion: '1',
        description: 'Copy this folder into the SLLM addons folder (or a Stellaris mod at sllm/addon/) and translate the values in strings.json.',
        language: { code: 'xx', name: 'My language', gameLanguage: 'l_simp_chinese', system: ['zh'], aiLanguage: 'Simplified Chinese', strings: 'strings.json', patterns: 'patterns.json' },
    };
    fs.writeFileSync(path.join(outDir, addons_1.ADDON_MANIFEST), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(outDir, 'strings.json'), JSON.stringify(catalog2, null, 1) + '\n', 'utf8');
    fs.writeFileSync(path.join(outDir, 'patterns.json'), JSON.stringify(patterns, null, 1) + '\n', 'utf8');
    for (const n of ['LANGUAGE_PACK_KO.md', 'LANGUAGE_PACK_EN.md']) {
        try {
            fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', n), path.join(outDir, n));
        }
        catch { /* 안내 문서가 없으면 건너뜀 */ }
    }
    return { files: 5, strings: Object.keys(catalog2).length, patterns: patterns.length };
}
function view() {
    const list = registry?.list() ?? [];
    return {
        folder: (0, exports.addonsDir)(), modPath: `${addons_1.MOD_ADDON_DIR}/${addons_1.ADDON_MANIFEST}`,
        items: list.map((a, i) => ({
            id: a.id, name: a.name, author: a.author, description: a.description, version: a.addonVersion, source: a.source, origin: a.origin, rank: i + 1,
            enabled: !settings_1.settings.addons.disabled.includes(a.id) && !a.id.startsWith('invalid_'), invalid: a.id.startsWith('invalid_'),
            theme: a.theme, images: Object.keys(a.images).length,
            ethics: Object.keys(a.compatibility?.ethics ?? {}).length, events: Object.keys(a.compatibility?.events ?? {}).length,
            empires: Object.keys(a.compatibility?.empires ?? {}).length, countryTypes: Object.keys(a.compatibility?.countryTypes ?? {}).length,
            language: a.language ? { code: a.language.code, name: a.language.name, strings: Object.keys(a.language.strings).length } : null,
            warnings: a.warnings.slice(0, 12),
        })),
    };
}
function registerAddons() {
    electron_1.ipcMain.handle('addonsList', async () => view());
    electron_1.ipcMain.handle('addonsSet', async (_e, v) => {
        const next = (0, addons_1.sanitizeAddonPrefs)(v);
        settings_1.settings.addons = next;
        (0, settings_1.saveSettings)();
        (0, diagnostics_1.logDiagnostic)('info', 'addons.set', { order: next.order.length, disabled: next.disabled.length });
        fireChanged();
        return view();
    });
    electron_1.ipcMain.handle('addonsReload', async () => { registry?.invalidate(); registry?.refresh(true); fireChanged(); return view(); });
    electron_1.ipcMain.handle('addonsLanguageTemplate', async () => {
        const out = path.join(electron_1.app.getPath('documents'), 'SLLM_language_pack_template');
        try {
            const r = writeLanguageTemplate(out);
            void electron_1.shell.openPath(out);
            return { ok: true, folder: out, ...r };
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    electron_1.ipcMain.handle('addonsOpenFolder', async () => {
        try {
            fs.mkdirSync((0, exports.addonsDir)(), { recursive: true });
        }
        catch { /* 열기에서 알림 */ }
        const err = await electron_1.shell.openPath((0, exports.addonsDir)());
        return err || (0, exports.addonsDir)();
    });
}
//# sourceMappingURL=addons-app.js.map
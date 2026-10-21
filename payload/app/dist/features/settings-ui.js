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
exports.languageView = exports.CLIENT_ID = void 0;
exports.customCssPath = customCssPath;
exports.gameLanguage = gameLanguage;
exports.selectedLanguage = selectedLanguage;
exports.activePack = activePack;
exports.selectedBase = selectedBase;
exports.uiText = uiText;
exports.pick = pick;
exports.aiLanguage = aiLanguage;
exports.locFolder = locFolder;
exports.registerSettingsUi = registerSettingsUi;
// A-00b 7번: 설정 화면 IPC(창과 관계없는 것) — 설정 읽기, Game Client ID, 응답 언어·화면 언어, 서신 켜기, 사용자 CSS.
// 화면 언어 도우미(selectedLanguage·uiText·languageView)와 배포 설정(release-config.json의 CLIENT_ID)도 여기. 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// 창 설정(setKeepOnTop·setWindowPrefs·setTheme)은 창 상태를 직접 만져서 features/windows.ts 에 둠.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const settings_1 = require("../app/settings");
const language_1 = require("../language");
const addons_app_1 = require("./addons-app");
const environment_paths_1 = require("../environment-paths");
const theme_1 = require("../theme");
const safe_send_1 = require("../safe-send");
const ctx_1 = require("../app/ctx");
// 설정: 나중에 설정 파일/화면으로 옮긴다. Game Client ID 는 대시보드 카드의 값으로 바꿀 것.
const releaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'release-config.json'), 'utf8'));
exports.CLIENT_ID = process.env.SLLM_CLIENT_ID ?? releaseConfig.player2ClientId ?? '';
function customCssPath() { return path.join(electron_1.app.getPath('userData'), 'sllm_custom.css'); }
const uiCatalog = require(path.join(__dirname, '..', '..', 'ui', 'i18n-catalog.js'));
/** 스텔라리스 게임 언어(settings.txt). 화면 문구마다 불리므로 5초 동안 기억한다. */
let gameLangCache = { at: 0, dir: '', code: null };
function gameLanguage() {
    const now = Date.now();
    if (now - gameLangCache.at < 5000 && (!settings_1.settings.userDir || gameLangCache.dir === settings_1.settings.userDir))
        return gameLangCache.code;
    let dir = '', code = null;
    try {
        dir = settings_1.settings.userDir || (0, environment_paths_1.findUserDir)();
        code = (0, language_1.gameLanguageCode)(fs.readFileSync(path.join(dir, 'settings.txt'), 'utf8'));
    }
    catch { /* 게임 설정 파일이 없으면 시스템 언어를 쓴다 */ }
    gameLangCache = { at: now, dir, code };
    return code;
}
/** 지금 화면 언어: 'ko'·'en' 또는 켜진 언어 팩 코드. 직접 고른 팩이 꺼졌으면 자동처럼 정한다. */
function selectedLanguage() {
    const packs = (0, addons_app_1.addonLanguagePacks)(), pref = settings_1.settings.language;
    const needGame = pref === 'auto' || (pref !== 'ko' && pref !== 'en' && !packs.some((p) => p.code === pref));
    return (0, language_1.resolveLanguage)(pref, electron_1.app.getLocale(), needGame ? gameLanguage() : null, packs);
}
/** 지금 언어가 언어 팩이면 그 팩 */
function activePack() { const l = selectedLanguage(); return l === 'ko' || l === 'en' ? null : (0, addons_app_1.addonLanguagePacks)().find((p) => p.code === l) ?? null; }
/** 번역이 없을 때 쓰는 기본 언어(한국어 아니면 영어). 'ko' | 'en' 만 받는 모듈에 넘긴다. */
function selectedBase() { return (0, language_1.baseLanguage)(selectedLanguage()); }
const patCache = new WeakMap();
function packPattern(pack, key) {
    let list = patCache.get(pack);
    if (!list) {
        list = pack.patterns.map(([a, b]) => [new RegExp(a), b]);
        patCache.set(pack, list);
    }
    for (const [re, to] of list)
        if (re.test(key))
            return key.replace(re, to);
    return null;
}
/** 화면 문구 번역: 한국어 → 그대로, 영어 → 카탈로그, 언어 팩 → 팩 표(한국어·영어 원문 모두 열쇠로) → 팩 패턴 → 영어. */
/** 카탈로그 패턴(SLLMPatterns)으로 영어 문구를 만든다. 없으면 undefined(2026-10-18: 숫자·원인 코드가 든 오류 문구도 번역되게). */
function catalogPattern(key) {
    const pats = uiCatalog.__patterns || [];
    for (const [a, b] of pats) {
        try {
            const re = new RegExp(a);
            if (re.test(key))
                return key.replace(re, b);
        }
        catch { /* 잘못된 패턴은 건너뜀 */ }
    }
    return undefined;
}
function uiText(text) {
    const l = selectedLanguage();
    if (l === 'ko')
        return text;
    const key = String(text).trim().replace(/\s+/g, ' '), en = uiCatalog[key] || uiCatalog[text] || catalogPattern(key);
    if (l === 'en')
        return en || text;
    const pack = activePack();
    if (!pack)
        return en || text;
    return pack.strings[key] ?? (en ? pack.strings[en] : undefined) ?? packPattern(pack, key) ?? en ?? text;
}
/** 메인 프로세스에서 한/영 두 문장을 고를 때: 한국어 → ko, 영어 → en, 언어 팩 → 팩 표의 ko 또는 en 번역, 없으면 en. */
function pick(ko, en) {
    const l = selectedLanguage();
    if (l === 'ko')
        return ko;
    if (l === 'en')
        return en;
    const pack = activePack();
    if (!pack)
        return en;
    const k = ko.trim().replace(/\s+/g, ' '), e = en.trim().replace(/\s+/g, ' ');
    return pack.strings[k] ?? pack.strings[e] ?? packPattern(pack, k) ?? en; // 숫자·이름이 든 문장은 팩 패턴으로(2026-10-18)
}
/** AI 답장 언어: 따로 정한 것 → 언어 팩이 알려 준 이름 → 화면 언어 */
function aiLanguage() { if (settings_1.settings.aiLanguage)
    return settings_1.settings.aiLanguage; const pack = activePack(); return pack ? pack.aiLanguage : selectedLanguage(); }
/** 스텔라리스 번역 폴더 이름(모드 이름 읽기용) */
function locFolder() { return (0, language_1.locFolderOf)(selectedLanguage(), (0, addons_app_1.addonLanguagePacks)()); }
const languageView = () => {
    const packs = (0, addons_app_1.addonLanguagePacks)(), eff = selectedLanguage(), pack = packs.find((p) => p.code === eff) ?? null;
    return {
        language: settings_1.settings.language, effectiveLanguage: eff, baseLanguage: (0, language_1.baseLanguage)(eff), gameLanguage: gameLanguage(), aiLanguage: settings_1.settings.aiLanguage, effectiveAiLanguage: aiLanguage(),
        languages: packs.map((p) => ({ code: p.code, name: p.name })),
        languagePack: pack ? { code: pack.code, name: pack.name, strings: pack.strings, patterns: pack.patterns } : null,
    };
};
exports.languageView = languageView;
function registerSettingsUi() {
    (0, addons_app_1.onAddonsChanged)(() => { const v = (0, exports.languageView)(); for (const w of electron_1.BrowserWindow.getAllWindows())
        (0, safe_send_1.safeSend)(w, 'languageChanged', v); });
    electron_1.ipcMain.handle('getSettings', async () => ({ ...settings_1.settings, ...(0, exports.languageView)() }));
    electron_1.ipcMain.handle('setPlayer2ClientId', async (_e, value) => {
        if (!settings_1.settings.devMode)
            return { ok: false, error: pick('개발자 모드에서만 프로젝트 ID를 설정할 수 있습니다.', 'The project ID can be set only in developer mode.') };
        const id = String(value || '').trim();
        if (id && !/^[a-zA-Z0-9._:-]{1,128}$/.test(id))
            return { ok: false, error: pick('올바른 Game Client ID를 입력하세요.', 'Enter a valid Game Client ID.') };
        settings_1.settings.player2ClientId = id;
        (0, settings_1.saveSettings)();
        ctx_1.ctx.p2.configureClientId(process.env.SLLM_CLIENT_ID || id || exports.CLIENT_ID);
        return { ok: true };
    });
    electron_1.ipcMain.handle('setAiLanguage', async (_e, value) => {
        const name = (0, language_1.normalizeAiLanguage)(value);
        if (name === null)
            return { ok: false, error: pick('언어 이름은 줄바꿈 없이 80자 이내로 입력해 주세요.', 'Enter a language name of up to 80 characters without line breaks.') };
        settings_1.settings.aiLanguage = name;
        (0, settings_1.saveSettings)();
        for (const w of electron_1.BrowserWindow.getAllWindows())
            (0, safe_send_1.safeSend)(w, 'languageChanged', (0, exports.languageView)());
        return { ok: true, ...(0, exports.languageView)() };
    });
    electron_1.ipcMain.handle('setLanguage', async (_e, preference) => {
        settings_1.settings.language = (0, language_1.languagePreference)(preference);
        (0, settings_1.saveSettings)();
        for (const w of electron_1.BrowserWindow.getAllWindows())
            (0, safe_send_1.safeSend)(w, 'languageChanged', (0, exports.languageView)());
        try {
            ctx_1.ctx.refreshTray();
        }
        catch { /* 트레이 메뉴도 새 언어로(2026-10-19) */ }
        return (0, exports.languageView)();
    });
    electron_1.ipcMain.handle('setMailEnabled', async (_e, on) => { settings_1.settings.mailEnabled = !!on; (0, settings_1.saveSettings)(); return settings_1.settings; });
    electron_1.ipcMain.handle('getCustomCss', async () => { try {
        return fs.readFileSync(customCssPath(), 'utf8');
    }
    catch {
        return '';
    } });
    electron_1.ipcMain.handle('openCustomCss', async () => {
        try {
            if (!fs.existsSync(customCssPath()))
                fs.writeFileSync(customCssPath(), theme_1.CUSTOM_CSS_TEMPLATE, 'utf8');
            const err = await electron_1.shell.openPath(customCssPath());
            return err ? pick('파일을 열지 못했습니다: ', 'Could not open the file: ') + err : pick('내 CSS 파일을 열었습니다. 저장한 뒤 "CSS 다시 불러오기"를 누르세요.', 'Opened your CSS file. Save it, then press "Reload CSS".');
        }
        catch (e) {
            return pick('파일을 만들지 못했습니다: ', 'Could not create the file: ') + e.message;
        }
    });
}
//# sourceMappingURL=settings-ui.js.map
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
exports.lastKeyError = exports.memKeys = exports.settings = exports.devVotePercent = exports.devVoteMode = exports.clampSlots = exports.COUNCIL_MAX_SPEAKERS = exports.clampTurns = void 0;
exports.settingsPath = settingsPath;
exports.loadSettingsFile = loadSettingsFile;
exports.keysPath = keysPath;
exports.readKeyFile = readKeyFile;
exports.getKey = getKey;
exports.putKey = putKey;
exports.dropKey = dropKey;
exports.activeCustom = activeCustom;
exports.saveSettings = saveSettings;
// A-00b 2번: 설정(앱 폴더의 sllm_settings.json)과 개인 API 키. 2026-10-15 main.ts 234~385줄에서 옮김(동작 변경 없음).
// 바뀐 점 두 가지: settings 객체를 통째로 바꿔 끼우지 않고 내용만 채운다(Object.assign, 다른 모듈이 같은 객체를 보게),
// Player2 ID 적용·깃발 경로 설정은 main.ts loadSettings()에 남겼다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const key_file_1 = require("../key-file");
const language_1 = require("../language");
const media_custom_1 = require("../media-custom");
const radio_1 = require("../radio");
const aiclient_1 = require("../aiclient");
const speech_1 = require("../speech");
const galnews_1 = require("../galnews");
const images_1 = require("../images");
const overlayPrefs_1 = require("../overlayPrefs");
const theme_1 = require("../theme");
const addons_1 = require("../addons");
const gameWindow_1 = require("../gameWindow");
const ctx_1 = require("./ctx");
// ---- 설정(앱 폴더의 sllm_settings.json). 실험 기능은 기본으로 꺼 둔다.
/** 의회 발언권 횟수: 0 이면 자동(참석 제국 수), 아니면 1~200. */
const clampTurns = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(100, n) : 20; };
exports.clampTurns = clampTurns;
exports.COUNCIL_MAX_SPEAKERS = 8; // 한 번의 발언에 답하는 최대 제국 수(ui/council.html MAX_SPEAKERS 와 같게)
const clampSlots = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(40, n) : 0; }; // 발언권 추첨 횟수. 같은 나라가 여러 번 뽑힐 수 있어 답하는 나라 수(8)보다 크게 둔다
exports.clampSlots = clampSlots;
const devVoteMode = (v) => v === 'for' || v === 'against' ? v : 'normal';
exports.devVoteMode = devVoteMode;
const devVotePercent = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(80, Math.min(100, Math.round(n))) : 85; };
exports.devVotePercent = devVotePercent;
exports.settings = {
    devCouncilVote: 'normal',
    devCouncilPercent: 85,
    devCouncilNoAi: false,
    aiLanguage: '',
    player2ClientId: '',
    language: 'auto',
    userDir: null,
    modDir: null,
    setupDone: false,
    mediaPrefs: (0, media_custom_1.sanitizeMedia)(null),
    councilMode: 'weighted',
    councilSlots: 0,
    councilTurns: 20,
    speechTurns: 20,
    radioStation: 'stn',
    devMode: false,
    mailEnabled: false,
    keepOnTop: true,
    autoHide: true,
    dock: 'right',
    dockPos: null,
    uiScale: 1,
    autoScale: true,
    theme: 'stellaris',
    custom: {},
    bgImage: null,
    bgOpacity: 0.3,
    images: {},
    imageLabels: {},
    addons: { order: [], disabled: [] },
    imageScope: 'country',
    fx: true,
    launcherCorner: 'br',
    launcherPos: null,
    notify: true,
    autoOpenOnTalk: true,
    hotkey: 'Alt+F8',
    fadeEnabled: true,
    fadeOpacity: 0.6,
    saveDir: null,
    gameDir: null,
    pauseGate: true,
    aiEveryMin: 10,
    gossipOn: true,
    extraOn: true,
    extraMax: 1,
    papersOn: [true, true, true],
    aiMode: 'player2',
    aiActive: '',
    aiConns: [],
    forceOverlay: false,
    radioDockPos: null,
    dockLock: true,
    freePos: null,
};
function settingsPath() { return path.join(electron_1.app.getPath('userData'), 'sllm_settings.json'); }
function loadSettingsFile() {
    { // F-33 A: 파일이 없으면 처음 실행. 깨졌으면 .bad 로 남기고 기본값(다음 저장이 깨진 파일을 덮어써도 원본은 남음). 일시적 읽기 오류면 이번 실행 동안 저장하지 않음
        const r = (0, key_file_1.readJsonObject)(settingsPath());
        if (!r.ok) {
            settingsReadOnly = r.error;
            (0, diagnostics_1.logDiagnostic)('error', 'storage.read_failed', { store: 'settings', error: r.error });
            warnLater('설정 파일을 읽지 못해 기본 설정으로 시작합니다. 이번 실행 동안 설정은 저장되지 않습니다(기존 파일 보호). 이유: ' + r.error);
        }
        else {
            if (r.value)
                Object.assign(exports.settings, r.value);
            if (r.recovered) {
                (0, diagnostics_1.logDiagnostic)('error', 'storage.corrupt', { store: 'settings', backup: r.recovered });
                warnLater('설정 파일이 깨져 있어 기본 설정으로 시작합니다. 깨진 파일은 sllm_settings.json.bad 로 남겨 두었습니다.');
            }
        }
    }
    exports.settings.player2ClientId = typeof exports.settings.player2ClientId === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(exports.settings.player2ClientId) ? exports.settings.player2ClientId : '';
    exports.settings.language = (0, language_1.languagePreference)(exports.settings.language);
    exports.settings.aiLanguage = (0, language_1.normalizeAiLanguage)(exports.settings.aiLanguage) ?? '';
    exports.settings.theme = (0, theme_1.sanitizeTheme)(exports.settings.theme);
    exports.settings.custom = (0, theme_1.sanitizeCustom)(exports.settings.custom);
    exports.settings.images = (0, images_1.sanitizeImageMap)(exports.settings.images);
    {
        const lb = {};
        if (exports.settings.imageLabels && typeof exports.settings.imageLabels === 'object')
            for (const [k, v] of Object.entries(exports.settings.imageLabels))
                if ((0, images_1.isImageKey)(k) && typeof v === 'string')
                    lb[k] = v.slice(0, 60);
        exports.settings.imageLabels = lb;
    }
    exports.settings.addons = (0, addons_1.sanitizeAddonPrefs)(exports.settings.addons);
    exports.settings.bgOpacity = (0, images_1.clampOpacity)(exports.settings.bgOpacity);
    exports.settings.imageScope = exports.settings.imageScope === 'species' || exports.settings.imageScope === 'class' ? exports.settings.imageScope : 'country';
    exports.settings.fx = exports.settings.fx !== false;
    if (!['tr', 'tl', 'br', 'bl'].includes(exports.settings.launcherCorner))
        exports.settings.launcherCorner = 'br';
    const okFrac = (f) => f && Number.isFinite(f.fx) && Number.isFinite(f.fy);
    exports.settings.mediaPrefs = (0, media_custom_1.sanitizeMedia)(exports.settings.mediaPrefs);
    exports.settings.devCouncilVote = exports.settings.devMode === true ? (0, exports.devVoteMode)(exports.settings.devCouncilVote) : 'normal';
    exports.settings.devCouncilPercent = (0, exports.devVotePercent)(exports.settings.devCouncilPercent ?? 85);
    exports.settings.devCouncilNoAi = exports.settings.devMode === true && exports.settings.devCouncilNoAi === true;
    exports.settings.radioStation = (0, radio_1.radioStation)(exports.settings.radioStation).id;
    exports.settings.devMode = exports.settings.devMode === true;
    exports.settings.councilSlots = (0, exports.clampSlots)(exports.settings.councilSlots);
    exports.settings.speechTurns = (0, speech_1.clampSpeechTurns)(exports.settings.speechTurns);
    exports.settings.councilTurns = (0, exports.clampTurns)(exports.settings.councilTurns);
    exports.settings.councilMode = exports.settings.councilMode === 'equal' ? 'equal' : 'weighted';
    if (!okFrac(exports.settings.dockPos))
        exports.settings.dockPos = null;
    exports.settings.dockLock = exports.settings.dockLock !== false;
    exports.settings.forceOverlay = exports.settings.forceOverlay === true || exports.settings.devOverlayPreview === true;
    delete exports.settings.devOverlayPreview;
    if (!exports.settings.freePos || !Number.isFinite(exports.settings.freePos.x) || !Number.isFinite(exports.settings.freePos.y))
        exports.settings.freePos = null;
    if (!okFrac(exports.settings.launcherPos))
        exports.settings.launcherPos = null;
    exports.settings.uiScale = (0, gameWindow_1.layoutScale)(null, exports.settings.uiScale, false);
    exports.settings.autoScale = exports.settings.autoScale !== false;
    exports.settings.notify = exports.settings.notify !== false;
    exports.settings.autoOpenOnTalk = exports.settings.autoOpenOnTalk !== false;
    exports.settings.hotkey = (0, overlayPrefs_1.sanitizeHotkey)(exports.settings.hotkey);
    exports.settings.fadeEnabled = exports.settings.fadeEnabled !== false;
    exports.settings.fadeOpacity = (0, overlayPrefs_1.clampFade)(exports.settings.fadeOpacity);
    delete exports.settings.dockOffset;
    delete exports.settings.launcherOffset; // 이전 버전의 픽셀 위치는 버린다
    if (!(0, images_1.isSafeStoredName)(exports.settings.bgImage))
        exports.settings.bgImage = null;
    exports.settings.saveDir = typeof exports.settings.saveDir === 'string' && exports.settings.saveDir ? exports.settings.saveDir.slice(0, 500) : null;
    exports.settings.gameDir = typeof exports.settings.gameDir === 'string' && exports.settings.gameDir ? exports.settings.gameDir.slice(0, 500) : null;
    exports.settings.userDir = typeof exports.settings.userDir === 'string' && exports.settings.userDir ? exports.settings.userDir : null;
    exports.settings.modDir = typeof exports.settings.modDir === 'string' && exports.settings.modDir ? exports.settings.modDir : null;
    exports.settings.setupDone = exports.settings.setupDone === true;
    exports.settings.pauseGate = exports.settings.pauseGate !== false;
    exports.settings.aiEveryMin = (typeof exports.settings.aiEveryMin === 'number' && exports.settings.aiEveryMin >= 1 && exports.settings.aiEveryMin <= 30) ? Math.round(exports.settings.aiEveryMin) : 10;
    exports.settings.gossipOn = exports.settings.gossipOn !== false;
    exports.settings.extraOn = exports.settings.extraOn !== false;
    exports.settings.extraMax = (typeof exports.settings.extraMax === 'number' && exports.settings.extraMax >= 1 && exports.settings.extraMax <= 12) ? Math.round(exports.settings.extraMax) : 1;
    exports.settings.papersOn = galnews_1.PAPERS.map((_, i) => !Array.isArray(exports.settings.papersOn) || exports.settings.papersOn[i] !== false);
    exports.settings.aiMode = exports.settings.aiMode === 'custom' ? 'custom' : 'player2';
    exports.settings.aiConns = (Array.isArray(exports.settings.aiConns) ? exports.settings.aiConns : [])
        .filter((c) => c && typeof c.id === 'string' && c.id)
        .map((c) => ({
        id: String(c.id),
        name: String(c.name || '').slice(0, 40),
        provider: (c.provider in aiclient_1.PRESETS ? c.provider : 'custom'),
        baseUrl: (0, aiclient_1.normalizeBase)(c.baseUrl),
        model: String(c.model || '').slice(0, 120),
        saveKey: c.saveKey === true,
    }));
    if (!exports.settings.aiConns.some((c) => c.id === exports.settings.aiActive))
        exports.settings.aiActive = exports.settings.aiConns[0]?.id ?? '';
    delete exports.settings.aiEverySec;
    for (const k of ['autoPause', 'speedGate', 'speedNormal', 'speedFast'])
        delete exports.settings[k];
}
// ---- 개인 API 키: 저장을 고른 연결만 OS 암호화(safeStorage)로 디스크에 둔다. 설정 파일·로그에는 키를 쓰지 않는다.
exports.memKeys = new Map();
function keysPath() { return path.join(electron_1.app.getPath('userData'), 'sllm_keys.json'); }
/** 키 파일 읽기(F-33 A). 예전에는 어떤 오류든 빈 목록을 돌려줘서, 다음 저장이 다른 연결의 키를 모두 지웠다. 이제 일시적 읽기 오류면 null(쓰지 말 것). */
function readKeyFile() {
    const r = (0, key_file_1.readJsonObject)(keysPath());
    if (!r.ok) {
        exports.lastKeyError = '키 파일을 읽지 못했습니다: ' + r.error;
        (0, diagnostics_1.logDiagnostic)('error', 'storage.read_failed', { store: 'keys', error: r.error });
        return null;
    }
    if (r.recovered) {
        (0, diagnostics_1.logDiagnostic)('error', 'storage.corrupt', { store: 'keys', backup: r.recovered });
        warnLater('API 키 파일이 깨져 있어 sllm_keys.json.bad 로 옮겨 두었습니다. 저장했던 키를 다시 입력해 주세요.');
        try {
            fs.unlinkSync(keysPath());
        }
        catch { /* 이미 없음 */ }
    }
    return (0, key_file_1.cleanKeyMap)(r.value);
}
/** 마지막 키 파일 오류(설정 화면 메시지용). */
exports.lastKeyError = '';
function writeKeys(f) {
    const err = (0, key_file_1.writeJsonAtomic)(keysPath(), f);
    if (err) {
        exports.lastKeyError = '키 파일에 쓰지 못했습니다: ' + err;
        (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'keys', error: err });
        return false;
    }
    return true;
}
const decryptWarned = new Set();
function getKey(id) {
    if (exports.memKeys.has(id)) {
        const key = exports.memKeys.get(id) || null;
        (0, diagnostics_1.registerDiagnosticSecret)(key);
        return key;
    }
    const c = exports.settings.aiConns.find((x) => x.id === id);
    if (!c || !c.saveKey)
        return null;
    const b = readKeyFile()?.[id];
    if (b && electron_1.safeStorage.isEncryptionAvailable()) {
        try {
            const k = electron_1.safeStorage.decryptString(Buffer.from(b, 'base64'));
            exports.memKeys.set(id, k);
            (0, diagnostics_1.registerDiagnosticSecret)(k);
            return k;
        }
        catch (error) {
            (0, diagnostics_1.logDiagnostic)('warn', 'ai.key.decrypt_failed', { id, error });
            if (!decryptWarned.has(id)) {
                decryptWarned.add(id);
                ctx_1.ctx.toUi('status', `저장된 API 키(${c.name || id})를 이 컴퓨터·계정에서 풀 수 없습니다. 키를 다시 입력해 주세요.`);
            }
        } // F-33 A: "키 없음"과 구분해 알림
    }
    return null;
}
function putKey(id, key, persist) {
    (0, diagnostics_1.registerDiagnosticSecret)(key);
    exports.memKeys.set(id, key);
    exports.lastKeyError = '';
    const f = readKeyFile();
    if (!f)
        return false; // 키 파일을 못 읽었으면 덮어쓰지 않는다(다른 키 보호)
    if (persist && electron_1.safeStorage.isEncryptionAvailable()) {
        f[id] = electron_1.safeStorage.encryptString(key).toString('base64');
        return writeKeys(f);
    }
    if (f[id]) {
        delete f[id];
        if (!writeKeys(f))
            return false;
    } // 저장 안 함으로 바꿨는데 디스크에 남으면 알린다
    return !persist;
}
/** 디스크에서 키를 지운다. 실패하면 false 와 상태 표시(화면에는 지워진 것처럼 보이지만 파일에 남는 일을 막음). */
function dropKey(id) {
    exports.memKeys.delete(id);
    exports.lastKeyError = '';
    const f = readKeyFile();
    const ok = !!f && (!f[id] || (delete f[id], writeKeys(f)));
    if (!ok)
        ctx_1.ctx.toUi('status', 'API 키를 키 파일에서 지우지 못했습니다. ' + exports.lastKeyError);
    return ok;
}
function activeCustom() {
    const c = exports.settings.aiConns.find((x) => x.id === exports.settings.aiActive);
    if (!c)
        return null;
    const key = getKey(c.id);
    if (aiclient_1.PRESETS[c.provider].needsKey && !key)
        return null;
    return { conn: c, key };
}
/** 설정 파일을 못 읽은 이유. 있으면 이번 실행 동안 저장하지 않는다(F-33 A). */
let settingsReadOnly = '';
function saveSettings() {
    if (settingsReadOnly) {
        ctx_1.ctx.toUi('status', '설정 파일을 읽지 못해 이번 실행 동안은 설정을 저장하지 않습니다(기존 파일 보호).');
        return;
    }
    const err = (0, key_file_1.writeJsonAtomic)(settingsPath(), exports.settings, true);
    if (err) {
        (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'settings', error: err });
        ctx_1.ctx.toUi('status', '설정 저장 실패: ' + err);
    }
}
/** 앱 창이 뜨기 전에 생긴 경고를 잠시 뒤 상태 표시줄에 띄운다. */
function warnLater(msg) { setTimeout(() => { try {
    ctx_1.ctx.toUi('status', msg);
}
catch { /* 창이 없으면 진단 기록만 남는다 */ } }, 4000); }
//# sourceMappingURL=settings.js.map
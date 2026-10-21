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
exports.applyImageFile = void 0;
exports.imagesDir = imagesDir;
exports.imageUrl = imageUrl;
exports.imageState = imageState;
exports.registerImages = registerImages;
// A-00b 4번: 사용자 그림(배경·초상화)과 깃발 IPC(getImageState·pickImage·dropImage·clearImage·setImageOpts·openImagesFolder·flagFor).
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). imageState()는 다른 기능도 화면 갱신에 쓴다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const images_1 = require("../images");
const speciesClass_1 = require("../speciesClass");
const settings_1 = require("../app/settings");
const ctx_1 = require("../app/ctx");
const addons_app_1 = require("./addons-app");
const settings_ui_1 = require("./settings-ui");
function imagesDir() { return path.join(electron_1.app.getPath('userData'), 'sllm_images'); }
function imageUrl(f) { return (0, url_1.pathToFileURL)(path.join(imagesDir(), f)).href; }
function imageState() {
    const ok = (f) => (f && (0, images_1.isSafeStoredName)(f) && fs.existsSync(path.join(imagesDir(), f)) ? f : null);
    // 켜진 애드온 그림을 먼저 깔고, 사용자가 설정에서 넣은 그림이 그 위를 덮는다(사용자 우선, 2026-10-16).
    const images = { ...(0, addons_app_1.addonImages)() };
    const own = {};
    for (const [k, f] of Object.entries(settings_1.settings.images))
        if (ok(f)) {
            images[k] = imageUrl(f);
            own[k] = images[k];
        }
    const bg = ok(settings_1.settings.bgImage);
    // 모드 폴더(gfx/sllm_portraits)에 들어 있는 종족 계열별 기본 초상화
    const defaults = {};
    for (const k of speciesClass_1.CLASS_KEYS) {
        const n = k && (0, speciesClass_1.defaultPortraitName)(k);
        if (n) {
            const f = path.join(ctx_1.ctx.MOD_DIR, 'gfx', 'sllm_portraits', n);
            if (fs.existsSync(f))
                defaults[k] = (0, url_1.pathToFileURL)(f).href;
        }
    }
    // 모드 폴더(gfx/sllm_planetbg)의 행성 종류별 배경 사진: pc<번호>.jpg
    const planetBgs = {};
    for (let n = 1; n <= 40; n++) {
        const f = path.join(ctx_1.ctx.MOD_DIR, 'gfx', 'sllm_planetbg', `pc${n}.jpg`);
        if (fs.existsSync(f))
            planetBgs[n] = (0, url_1.pathToFileURL)(f).href;
    }
    const labels = {};
    for (const k of Object.keys(images))
        if (settings_1.settings.imageLabels[k])
            labels[k] = settings_1.settings.imageLabels[k];
    return { bg: bg ? imageUrl(bg) : null, bgOpacity: settings_1.settings.bgOpacity, images, own: Object.keys(own), labels, scope: settings_1.settings.imageScope, defaults, planetBgs, save: ctx_1.ctx.curSaveId };
}
// 사용자가 고르는 그림(배경·초상화)
// 고른 그림 파일을 앱 폴더로 복사해 배경이나 초상화로 적용한다. 고르기와 끌어놓기가 함께 쓴다.
const applyImageFile = (src, target) => {
    try {
        if (!target || (target.kind !== 'bg' && !(target.kind === 'portrait' && (0, images_1.isImageKey)(target.key))))
            return { ...imageState(), note: (0, settings_ui_1.pick)('적용할 대상을 알 수 없습니다.', 'Unknown target to apply to.') };
        if (typeof src !== 'string' || !fs.existsSync(src) || !fs.statSync(src).isFile())
            return { ...imageState(), note: (0, settings_ui_1.pick)('그림 파일을 찾지 못했습니다.', 'Image file not found.') };
        if (fs.statSync(src).size > images_1.MAX_IMAGE_BYTES)
            return { ...imageState(), note: (0, settings_ui_1.pick)('그림이 너무 큽니다(최대 8MB).', 'The image is too large (max 8 MB).') };
        const name = (0, images_1.safeImageName)(path.basename(src), Date.now());
        if (!name)
            return { ...imageState(), note: (0, settings_ui_1.pick)('png, jpg, webp, gif 그림만 쓸 수 있습니다.', 'Only png, jpg, webp and gif images can be used.') };
        fs.mkdirSync(imagesDir(), { recursive: true });
        fs.copyFileSync(src, path.join(imagesDir(), name));
        if (target.kind === 'bg')
            settings_1.settings.bgImage = name;
        else {
            settings_1.settings.images[target.key] = name;
            if (typeof target.label === 'string' && target.label.trim())
                settings_1.settings.imageLabels[target.key] = target.label.trim().slice(0, 60);
        }
        (0, settings_1.saveSettings)();
        return { ...imageState(), note: null };
    }
    catch (e) {
        return { ...imageState(), note: (0, settings_ui_1.pick)('그림을 복사하지 못했습니다: ', 'Could not copy the image: ') + e.message };
    }
};
exports.applyImageFile = applyImageFile;
function registerImages() {
    electron_1.ipcMain.handle('getImageState', async () => imageState());
    electron_1.ipcMain.handle('pickImage', async (e, target) => {
        const parent = electron_1.BrowserWindow.fromWebContents(e.sender) ?? ctx_1.ctx.win; // 항상 위 창(총독 보고 등)에서 고를 때 대화 상자가 창 뒤로 숨지 않게
        const r = await electron_1.dialog.showOpenDialog(parent, { title: '그림 고르기', properties: ['openFile'], filters: [{ name: '그림', extensions: images_1.IMAGE_EXTS.map((x) => x.slice(1)) }] });
        if (r.canceled || !r.filePaths[0])
            return { ...imageState(), note: null };
        return (0, exports.applyImageFile)(r.filePaths[0], target);
    });
    electron_1.ipcMain.handle('dropImage', async (_e, target, filePath) => (0, exports.applyImageFile)(filePath, target));
    electron_1.ipcMain.handle('clearImage', async (_e, target) => {
        if (target && target.kind === 'bg')
            settings_1.settings.bgImage = null;
        else if (target && target.kind === 'portrait' && (0, images_1.isImageKey)(target.key)) {
            delete settings_1.settings.images[target.key];
            delete settings_1.settings.imageLabels[target.key];
        }
        (0, settings_1.saveSettings)();
        return imageState();
    });
    electron_1.ipcMain.handle('setImageOpts', async (_e, o) => {
        if (o.bgOpacity !== undefined)
            settings_1.settings.bgOpacity = (0, images_1.clampOpacity)(o.bgOpacity);
        if (o.scope === 'country' || o.scope === 'species' || o.scope === 'class')
            settings_1.settings.imageScope = o.scope;
        (0, settings_1.saveSettings)();
        return imageState();
    });
    // A-22 연출 슬롯 규격 견본(앱 폴더 example/backgrounds: 자리별 규격 그림 + README_KO.md)
    electron_1.ipcMain.handle('openSceneExamples', async () => { const d = path.join(electron_1.app.getAppPath(), 'example', 'backgrounds'); if (!fs.existsSync(d))
        return '규격 견본 폴더(example/backgrounds)를 찾지 못했습니다.'; const e = await electron_1.shell.openPath(d); return e || ''; });
    electron_1.ipcMain.handle('openImagesFolder', async () => { fs.mkdirSync(imagesDir(), { recursive: true }); const e = await electron_1.shell.openPath(imagesDir()); return e || '그림 폴더를 열었습니다.'; });
    electron_1.ipcMain.handle('flagFor', async (_e, idx) => ctx_1.ctx.flagUrlFor(typeof idx === 'number' ? idx : Number(idx)));
}
//# sourceMappingURL=images.js.map
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
exports.libDir = libDir;
exports.library = library;
exports.rulerLibraryItem = rulerLibraryItem;
exports.autoPortraitUrl = autoPortraitUrl;
exports.isXenophobe = isXenophobe;
exports.registerPortraitLib = registerPortraitLib;
// 포트레이트 라이브러리(앱 쪽): 앱 폴더 portrait-library 의 미리 그려 둔 초상화를 읽어 화면에 알려 준다.
// - 대화 상대: 세이브에서 읽은 통치자의 초상화·성별로 맞는 그림을 자동으로 고른다(사용자가 올린 그림이 있으면 그것이 먼저).
// - 의회 의원: 종족 계열별로 성별이 섞인 여러 얼굴을 쓰되, 외계인 혐오 제국은 통치자 종족 모델 하나만 쓴다(ui/delegate-pick.js).
// - 설정 > 초상화: 라이브러리에서 골라 계열·의원 칸에 적용(평소 사용자 그림과 같은 방식으로 저장).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const ctx_1 = require("../app/ctx");
const portraitlib_1 = require("../portraitlib");
const images_1 = require("./images");
/** 라이브러리는 앱과 함께 설치되는 portrait-library.pak(앱 폴더)에 들어 있고, 처음 쓸 때 앱 데이터 폴더(portrait_library)에 풀린다.
 * 창작마당 모드 폴더를 거치지 않으므로 모드를 다시 올리지 않아도 된다. 낱개 파일이 든 앱 폴더/portrait-library 가 있으면 그것을, SLLM_PORTRAIT_LIB 가 있으면 그 폴더를 먼저 쓴다. */
function libDir() {
    if (process.env.SLLM_PORTRAIT_LIB)
        return process.env.SLLM_PORTRAIT_LIB;
    const loose = path.join(electron_1.app.getAppPath(), 'portrait-library');
    if (fs.existsSync(path.join(loose, 'library.json')))
        return loose;
    const out = path.join(electron_1.app.getPath('userData'), 'portrait_library');
    (0, portraitlib_1.extractPak)(path.join(electron_1.app.getAppPath(), 'portrait-library.pak'), out);
    return out;
}
let cache = null;
function library() {
    const d = libDir();
    let m = 0;
    try {
        m = fs.statSync(path.join(d, 'library.json')).mtimeMs;
    }
    catch { /* 없음 */ }
    if (!cache || cache.dir !== d || cache.mtime !== m)
        cache = { dir: d, mtime: m, lib: (0, portraitlib_1.loadLibrary)(d) };
    return cache.lib;
}
/** 이 제국 통치자에게 맞는 라이브러리 항목. 같은 세이브·제국이면 늘 같은 항목(시드 고정). 못 찾으면 null. */
function rulerLibraryItem(idx) {
    const r = ctx_1.ctx.flagProv.rulerFor(idx);
    return r ? (0, portraitlib_1.pickRulerItem)(library(), r.portrait, r.gender, ctx_1.ctx.curSaveId + '|' + idx) : null;
}
/** 대화 상대 화면에 쓸 자동 초상화(통치자 옷). 없으면 undefined. */
function autoPortraitUrl(idx) {
    const it = rulerLibraryItem(idx);
    if (!it)
        return undefined;
    const f = (0, portraitlib_1.libraryFile)(library(), libDir(), it.id, 'ruler');
    return f ? (0, url_1.pathToFileURL)(f).href : undefined;
}
/** 이 제국이 외계인 혐오(일반·광신) 가치관을 가졌는가. 모드가 실시간으로 알려 준 값을 먼저, 없으면 세이브 값. */
function isXenophobe(idx) {
    const ids = ctx_1.ctx.modCompatibility.liveFor(ctx_1.ctx.curSaveId, idx)?.ids ?? ctx_1.ctx.flagProv.ethicsFor(idx);
    return !!ids?.some((i) => /xenophob/i.test(String(i)));
}
function registerPortraitLib() {
    electron_1.ipcMain.handle('getPortraitLibrary', async () => {
        const lib = library(), d = libDir();
        return { available: lib.items.length > 0, folder: d, items: lib.items.map((it) => ({ id: it.id, cls: it.cls, defaultRole: it.defaultRole, count: it.portraits.length, portraits: it.portraits, roles: Object.fromEntries(Object.entries(it.roles).map(([r, f]) => [r, (0, url_1.pathToFileURL)(path.join(d, f)).href])) })) };
    });
    electron_1.ipcMain.handle('applyLibraryPortrait', async (_e, target, id, role) => {
        const f = (0, portraitlib_1.libraryFile)(library(), libDir(), id, role);
        if (!f)
            return { ...(0, images_1.imageState)(), note: '라이브러리 그림을 찾지 못했습니다.' };
        return (0, images_1.applyImageFile)(f, target);
    });
}
//# sourceMappingURL=portrait-lib-app.js.map
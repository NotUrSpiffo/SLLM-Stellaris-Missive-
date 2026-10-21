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
exports.musicCeremonyFx = musicCeremonyFx;
exports.musicView = musicView;
exports.registerMusic = registerMusic;
// 국가·군가 IPC(2026-10-20 알파 10 앞당김). 규칙은 src/music.ts, 애드온 곡은 features/addons-app.ts, 화면은 ui/office-music.js(집무실 「국가·군가」).
// 사용자가 세이브마다 고른 곡은 앱 데이터의 music/<세이브>/ 로 복사해 두고 쓴다(원본을 옮겨도 끊기지 않음).
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const addons_app_1 = require("./addons-app");
const addons_1 = require("../addons");
const music_1 = require("../music");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩
const root = () => path.join(electron_1.app.getPath('userData'), 'music');
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_music.json');
let store = null;
function all() {
    if (store)
        return store;
    try {
        store = (0, music_1.sanitizeStore)(JSON.parse(fs.readFileSync(file(), 'utf8')));
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'music', error: e });
        store = (0, music_1.sanitizeStore)({});
    }
    return store;
}
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'music', error: e });
} }
const keyNow = () => (0, music_1.safeKey)(ctx_1.ctx.curSaveId);
/** 앱 데이터 music 폴더 안의 파일만 믿는다. */
const inRoot = (f) => { const back = path.relative(root(), path.resolve(f)); return !!back && !back.startsWith('..') && !path.isAbsolute(back); };
function userUrl(u) { if (!u || !u.file || !inRoot(u.file))
    return null; try {
    return fs.statSync(u.file).isFile() ? (0, url_1.pathToFileURL)(u.file).href : null;
}
catch {
    return null;
} }
/** 출정 의식 연출 설정(ceremony-app 이 읽음). */
function musicCeremonyFx() { return all().ceremony; }
function musicView() {
    const key = keyNow(), mine = all().saves[key] ?? {}, picks = all().picks[key] ?? {};
    const tracks = {}, addonCount = {};
    for (const k of ['anthem', 'march']) {
        const list = (0, addons_app_1.addonMusicList)(k);
        addonCount[k] = list.length;
        // 우선순위: 내 커스텀 > 내가 고른 애드온 곡 > 맨 위 애드온 곡. 애드온에 없으면 인식하지 않는다.
        tracks[k] = (0, music_1.effectiveTrack)(mine[k], userUrl(mine[k]), (0, music_1.chooseAddon)(list, picks[k]), L('직접 고른 파일', 'Your own file'));
    }
    return { sid: ctx_1.ctx.curSaveId || '', volume: all().volume, tracks, addonCount, ceremony: all().ceremony };
}
function registerMusic() {
    electron_1.ipcMain.handle('musicState', async () => musicView());
    /** 애드온 곡 찾기: 켜진 애드온들이 주는 곡 목록(지금 고른 것 표시). */
    electron_1.ipcMain.handle('musicAddonList', async (_e, kindIn) => {
        if (!(0, music_1.isMusicKind)(kindIn) || kindIn === 'creed')
            return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
        const list = (0, addons_app_1.addonMusicList)(kindIn), cur = (0, music_1.chooseAddon)(list, all().picks[keyNow()]?.[kindIn]);
        return { ok: true, items: list.map((t) => ({ addonId: t.addonId, addonName: t.addonName, title: t.title, hasAudio: !!t.url, firstLine: (t.lyrics.split('\n').find((x) => x.trim()) ?? '').slice(0, 80), chosen: !!cur && cur.addonId === t.addonId })) };
    });
    /** 애드온 곡 고르기(이 세이브만). 빈 id 면 고른 것을 지우고 맨 위 애드온으로. */
    electron_1.ipcMain.handle('musicAddonPick', async (_e, kindIn, idIn) => {
        if (!(0, music_1.isMusicKind)(kindIn) || kindIn === 'creed')
            return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
        const key = keyNow(), id = typeof idIn === 'string' ? idIn : '';
        if (id && !(0, addons_app_1.addonMusicList)(kindIn).some((t) => t.addonId === id))
            return { ok: false, error: L('그 애드온이 꺼졌거나 이 곡이 없습니다.', 'That addon is off or no longer has this track.') };
        const p = (all().picks[key] ??= {});
        if (id)
            p[kindIn] = id;
        else {
            delete p[kindIn];
            if (!Object.keys(p).length)
                delete all().picks[key];
        }
        save();
        return { ok: true, view: musicView() };
    });
    electron_1.ipcMain.handle('musicCeremonyFx', async (_e, v) => { all().ceremony = (0, music_1.sanitizeCeremony)({ ...all().ceremony, ...(v && typeof v === 'object' ? v : {}) }); save(); return musicView(); });
    electron_1.ipcMain.handle('musicVolume', async (_e, v) => { all().volume = (0, music_1.clampVolume)(v); save(); return musicView(); });
    electron_1.ipcMain.handle('musicPick', async (e, kindIn) => {
        if (!(0, music_1.isMusicKind)(kindIn) || kindIn === 'creed')
            return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
        const win = electron_1.BrowserWindow.fromWebContents(e.sender) ?? ctx_1.ctx.win ?? undefined;
        const exts = ['mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'flac'];
        const r = await electron_1.dialog.showOpenDialog(win, { title: kindIn === 'anthem' ? L('국가 곡 고르기', 'Choose the anthem') : kindIn === 'march' ? L('군가 곡 고르기', 'Choose the march') : L('복무신조 음성 고르기', 'Choose the service creed recording'), properties: ['openFile'], filters: [{ name: L('음악', 'Music'), extensions: exts }] });
        if (r.canceled || !r.filePaths[0])
            return { ok: true, view: musicView() };
        const src = r.filePaths[0];
        try {
            if (!addons_1.AUDIO_EXT.test(src))
                return { ok: false, error: L('mp3·ogg·wav·m4a·aac·flac 파일만 쓸 수 있습니다.', 'Only mp3, ogg, wav, m4a, aac or flac files can be used.') };
            const st = fs.statSync(src);
            if (!st.isFile())
                return { ok: false, error: L('파일이 아닙니다.', 'Not a file.') };
            if (st.size > addons_1.MAX_AUDIO)
                return { ok: false, error: L('곡 파일은 24MB 까지 쓸 수 있습니다.', 'Track files can be up to 24 MB.') };
            const key = keyNow(), dir = path.join(root(), key);
            fs.mkdirSync(dir, { recursive: true });
            const old = all().saves[key]?.[kindIn];
            const out = path.join(dir, `${kindIn}-${Date.now()}${path.extname(src).toLowerCase()}`);
            fs.copyFileSync(src, out);
            if (old?.file && inRoot(old.file)) {
                try {
                    fs.unlinkSync(old.file);
                }
                catch { /* 이미 없음 */ }
            }
            const fname = (0, music_1.cleanTitle)(path.basename(src, path.extname(src)).replace(/_+/g, ' '));
            const mine = (all().saves[key] ??= {});
            mine[kindIn] = { file: out, title: fname, lyrics: old?.lyrics ?? '' };
            save();
            return { ok: true, view: musicView() };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('musicClear', async (_e, kindIn) => {
        if (!(0, music_1.isMusicKind)(kindIn) || kindIn === 'creed')
            return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
        const key = keyNow(), mine = all().saves[key], old = mine?.[kindIn];
        if (old) {
            if (old.file && inRoot(old.file)) {
                try {
                    fs.unlinkSync(old.file);
                }
                catch { /* 이미 없음 */ }
            }
            delete mine[kindIn];
            if (!Object.keys(mine).length)
                delete all().saves[key];
            save();
        }
        return { ok: true, view: musicView() };
    });
    /** 사용자 곡의 제목·가사 고치기(사용자 곡이 있을 때만) */
    electron_1.ipcMain.handle('musicEdit', async (_e, kindIn, title, lyrics) => {
        if (!(0, music_1.isMusicKind)(kindIn) || kindIn === 'creed')
            return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
        const key = keyNow();
        let u = all().saves[key]?.[kindIn];
        if (!u)
            return { ok: false, error: L('직접 고른 곡이 있어야 제목·가사를 고칠 수 있습니다.', 'Choose your own file first to edit its title and lyrics.') };
        u.title = (0, music_1.cleanTitle)(title) || u.title;
        u.lyrics = (0, music_1.cleanLyrics)(lyrics);
        save();
        return { ok: true, view: musicView() };
    });
}
//# sourceMappingURL=music-app.js.map
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
exports.CONNECTION_WORKSHOP_ID = exports.isConnectionMod = void 0;
exports.setRuntimeUserDir = setRuntimeUserDir;
exports.runtimeUserDir = runtimeUserDir;
exports.initializeEnvironment = initializeEnvironment;
exports.windowsDrives = windowsDrives;
exports.steamRoots = steamRoots;
exports.steamLibraries = steamLibraries;
exports.storeGameCandidates = storeGameCandidates;
exports.gameCandidates = gameCandidates;
exports.userCandidates = userCandidates;
exports.findUserDir = findUserDir;
exports.environmentSaveRoots = environmentSaveRoots;
exports.connectionWorkshopCandidates = connectionWorkshopCandidates;
exports.defaultConnectionMod = defaultConnectionMod;
exports.findConnectionMod = findConnectionMod;
exports.resolveEnvironment = resolveEnvironment;
exports.normalizeUserDir = normalizeUserDir;
exports.normalizeModDir = normalizeModDir;
exports.normalizeGameDir = normalizeGameDir;
exports.normalizeSaveDir = normalizeSaveDir;
exports.environmentHints = environmentHints;
exports.environmentTried = environmentTried;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const unique = (items) => [...new Set(items.filter((x) => !!x).map(x => path.resolve(x)))];
const isDir = (p) => { try {
    return fs.statSync(p).isDirectory();
}
catch {
    return false;
} };
const isConnectionMod = (p) => fs.existsSync(path.join(p, 'common', 'scripted_effects', 'sllm_probe_effects.txt'));
exports.isConnectionMod = isConnectionMod;
let selectedUserDir = null;
function setRuntimeUserDir(dir) { selectedUserDir = dir; }
function runtimeUserDir() { return selectedUserDir || findUserDir(); }
let roots = { documents: path.join(os.homedir(), 'Documents'), home: os.homedir(), steam: [], extraLibraries: [], drives: [] };
/** Electron supplies the OS known Documents folder, including OneDrive redirection. */
function initializeEnvironment(documents, steamOverride) {
    const steam = steamOverride ?? [];
    if (!steamOverride && process.platform === 'win32') {
        for (const key of ['HKCU\\Software\\Valve\\Steam', 'HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam']) {
            try {
                const output = (0, child_process_1.execFileSync)('reg.exe', ['query', key], { encoding: 'utf8', windowsHide: true, timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] });
                for (const m of output.matchAll(/(?:SteamPath|InstallPath)\s+REG_SZ\s+([^\r\n]+)/g))
                    steam.push(m[1].trim());
            }
            catch { /* Steam may be absent or installed by another store. */ }
        }
    }
    steam.push(process.env.SLLM_STEAM_DIR || '', path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'), path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam'));
    // 레지스트리·libraryfolders.vdf 에 없는 곳(다른 드라이브에 직접 만든 라이브러리, 옮긴 Steam 폴더)은 드라이브 문자를 훑어 찾는다.
    const drives = steamOverride || process.platform !== 'win32' ? [] : windowsDrives();
    const extra = [];
    for (const d of drives)
        for (const sub of ['SteamLibrary', 'Steam', 'Games\\Steam', 'Games\\SteamLibrary', 'Program Files (x86)\\Steam', 'Program Files\\Steam', 'Program Files (x86)\\SteamLibrary', 'Game\\Steam', 'Game\\SteamLibrary']) {
            const c = path.join(d, sub);
            if (isDir(path.join(c, 'steamapps')))
                extra.push(c);
        }
    roots = { documents, home: os.homedir(), steam: unique(steam), extraLibraries: unique(extra), drives };
}
function windowsDrives() {
    const out = [];
    for (let c = 67; c <= 90; c++) {
        const d = String.fromCharCode(c) + ':\\';
        try {
            if (fs.existsSync(d))
                out.push(d);
        }
        catch { /* 연결 안 된 드라이브 */ }
    }
    return out;
}
function steamRoots() { return roots.steam.slice(); }
function steamLibraries() {
    const libraries = steamRoots();
    for (const root of steamRoots()) {
        try {
            const text = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
            for (const m of text.matchAll(/"path"\s+"([^"]+)"/g))
                libraries.push(m[1].replace(/\\\\/g, '\\'));
        }
        catch { /* Not a Steam installation. */ }
    }
    libraries.push(...roots.extraLibraries);
    return unique(libraries);
}
/** 스팀이 아닌 설치(Xbox/Game Pass, Epic, GOG, 직접 복사)가 흔히 있는 위치. */
function storeGameCandidates() {
    const out = [];
    const pf = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
    for (const d of roots.drives)
        for (const sub of ['XboxGames\\Stellaris\\Content', 'Epic Games\\Stellaris', 'Program Files\\Epic Games\\Stellaris', 'GOG Games\\Stellaris', 'Games\\Stellaris', 'Games\\GOG Games\\Stellaris', 'Paradox Interactive\\Stellaris'])
            out.push(path.join(d, sub));
    for (const p of pf)
        out.push(path.join(p, 'Epic Games', 'Stellaris'), path.join(p, 'GOG Galaxy', 'Games', 'Stellaris'), path.join(p, 'Paradox Interactive', 'Stellaris'));
    return out;
}
function gameCandidates() { return unique([process.env.SLLM_GAME_DIR, ...steamLibraries().map(p => path.join(p, 'steamapps', 'common', 'Stellaris')), ...storeGameCandidates()]); }
function userCandidates() {
    return unique([process.env.SLLM_USER_DIR, path.join(roots.documents, 'Paradox Interactive', 'Stellaris'),
        ...[process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean).map(p => path.join(p, 'Documents', 'Paradox Interactive', 'Stellaris')),
        path.join(roots.home, 'Documents', 'Paradox Interactive', 'Stellaris')]);
}
function findUserDir() {
    const candidates = userCandidates();
    return candidates.find(p => fs.existsSync(path.join(p, 'logs', 'game.log'))) ?? candidates.find(p => fs.existsSync(path.join(p, 'settings.txt'))) ?? candidates.find(isDir) ?? candidates[0];
}
function environmentSaveRoots(userDir) {
    const out = [process.env.SLLM_SAVE_DIR || '', ...unique([userDir, ...userCandidates()]).map(p => path.join(p, 'save games'))];
    for (const root of steamRoots()) {
        const userdata = path.join(root, 'userdata');
        try {
            for (const id of fs.readdirSync(userdata))
                if (/^\d+$/.test(id))
                    out.push(path.join(userdata, id, '281990', 'remote', 'save games'));
        }
        catch { /* No cloud data. */ }
    }
    return unique(out);
}
exports.CONNECTION_WORKSHOP_ID = '3819625112';
function connectionWorkshopCandidates() {
    return steamLibraries().map(library => path.join(library, 'steamapps', 'workshop', 'content', '281990', exports.CONNECTION_WORKSHOP_ID));
}
function defaultConnectionMod() {
    return connectionWorkshopCandidates()[0] || path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam', 'steamapps', 'workshop', 'content', '281990', exports.CONNECTION_WORKSHOP_ID);
}
function findConnectionMod(userDir) {
    if (process.env.SLLM_MOD_DIR && (0, exports.isConnectionMod)(process.env.SLLM_MOD_DIR))
        return process.env.SLLM_MOD_DIR;
    // 10-15 22:0x: the official Workshop item (steamapps/workshop/content/281990/3819625112) is the default path.
    // If it is subscribed and downloaded it wins over the local Tester copies (same content, app only reads assets from it).
    const official = connectionWorkshopCandidates().find(exports.isConnectionMod);
    if (official)
        return official;
    // Otherwise the Tester mod in the normal Stellaris mod folder: follow its registered .mod path.
    try {
        const reg = fs.readFileSync(path.join(userDir, 'mod', 'sllm_missive_tester.mod'), 'utf8');
        const m = /^\s*path\s*=\s*"([^"\r\n]+)"/m.exec(reg);
        if (m) {
            const target = path.isAbsolute(m[1]) ? m[1] : path.resolve(userDir, m[1]);
            if ((0, exports.isConnectionMod)(target))
                return target;
        }
    }
    catch { /* Tester mod not registered. */ }
    const testerMod = path.join(__dirname, '..', 'tester-mod');
    if ((0, exports.isConnectionMod)(testerMod))
        return testerMod;
    const local = path.join(userDir, 'mod');
    try {
        for (const name of fs.readdirSync(local)) {
            const candidate = path.join(local, name);
            if (isDir(candidate) && (0, exports.isConnectionMod)(candidate))
                return candidate;
            if (name.endsWith('.mod')) {
                const text = fs.readFileSync(candidate, 'utf8');
                const m = /^\s*path\s*=\s*"([^"\r\n]+)"/m.exec(text);
                if (m) {
                    const target = path.isAbsolute(m[1]) ? m[1] : path.resolve(userDir, m[1]);
                    if ((0, exports.isConnectionMod)(target))
                        return target;
                }
            }
        }
    }
    catch { /* No local mods yet. */ }
    for (const library of steamLibraries()) {
        const content = path.join(library, 'steamapps', 'workshop', 'content', '281990');
        try {
            for (const id of fs.readdirSync(content)) {
                const candidate = path.join(content, id);
                if ((0, exports.isConnectionMod)(candidate))
                    return candidate;
            }
        }
        catch { /* No subscribed content. */ }
    }
    return null;
}
function resolveEnvironment(prefs) {
    const userDir = prefs.userDir || findUserDir();
    const log = process.env.SLLM_GAME_LOG || path.join(userDir, 'logs', 'game.log');
    const mod = prefs.modDir || findConnectionMod(userDir) || defaultConnectionMod();
    const game = prefs.gameDir || gameCandidates().find(p => fs.existsSync(path.join(p, 'flags', 'colors.txt'))) || null;
    return { userDir, log, mod, game, saveRoots: prefs.saveDir ? [prefs.saveDir] : environmentSaveRoots(userDir),
        logExists: fs.existsSync(log), userExists: isDir(userDir), modExists: !!mod && (0, exports.isConnectionMod)(mod),
        gameExists: !!game && fs.existsSync(path.join(game, 'flags', 'colors.txt')) };
}
// ---------- 폴더를 잘못 골라도 바로잡기 (2026-10-17 창작마당 문의: "어느 위치에 놔야 하나요?") ----------
const exists = (p) => { try {
    return fs.existsSync(p);
}
catch {
    return false;
} };
// 고른 폴더 이름이 "알려진 안쪽 폴더"일 때만 위로 올라간다(엉뚱한 폴더의 이웃을 잘못 집지 않도록).
const INNER = /^(logs|save games|mod|stellaris|paradox interactive|documents|문서|내 문서|content|281990|workshop|steamapps|common|flags|3819625112|sllm_missive|sllm_missive_tester|common|events|localisation|interface|gfx)$/i;
const ancestors = (p, n) => { const out = []; let c = path.resolve(p); for (let i = 0; i <= n; i++) {
    out.push(c);
    const up = path.dirname(c);
    if (up === c || !INNER.test(path.basename(c)))
        break;
    c = up;
} return out; };
const looksUserDir = (p) => ['logs', 'settings.txt', 'save games', 'dlc_load.json', 'launcher-v2.sqlite'].some(n => exists(path.join(p, n)));
const hasGameFiles = (p) => exists(path.join(p, 'flags', 'colors.txt'));
const countSaves = (root) => {
    let n = 0;
    let ents = [];
    try {
        ents = fs.readdirSync(root, { withFileTypes: true });
    }
    catch {
        return 0;
    }
    for (const e of ents) {
        if (e.isFile() && e.name.toLowerCase().endsWith('.sav'))
            n++;
        else if (e.isDirectory()) {
            try {
                n += fs.readdirSync(path.join(root, e.name)).filter(f => f.toLowerCase().endsWith('.sav')).length;
            }
            catch { /* 건너뜀 */ }
        }
    }
    return n;
};
const firstMatch = (bases, subs, test) => {
    for (const b of bases)
        for (const s of subs) {
            const c = s ? path.join(b, ...s.split('/')) : b;
            if (test(c))
                return path.resolve(c);
        }
    return null;
};
/** 사용자 폴더: 문서·Paradox Interactive·logs·save games·mod 어디를 골라도 …\Stellaris 로 보정. */
function normalizeUserDir(picked) {
    return firstMatch(ancestors(picked, 3), ['', 'Stellaris', 'Paradox Interactive/Stellaris', 'Documents/Paradox Interactive/Stellaris', '문서/Paradox Interactive/Stellaris'], looksUserDir);
}
/** 연결 모드 폴더: 모드 폴더 자체, 그 위(창작마당 281990·mod 폴더), 압축을 풀며 한 겹 더 들어간 폴더 모두 인정. */
function normalizeModDir(picked) {
    const bases = ancestors(picked, 2);
    const direct = firstMatch(bases, ['', '3819625112', '281990/3819625112', 'content/281990/3819625112', 'workshop/content/281990/3819625112', 'steamapps/workshop/content/281990/3819625112', 'sllm_missive', 'sllm_missive_tester', 'mod/sllm_missive', 'mod/sllm_missive_tester'], exports.isConnectionMod);
    if (direct)
        return direct;
    for (const b of [bases[0]]) { // 한두 겹 아래까지 훑기(압축 해제로 폴더가 겹친 경우, 고른 폴더 아래만)
        let l1 = [];
        try {
            l1 = fs.readdirSync(b);
        }
        catch {
            continue;
        }
        for (const n1 of l1.slice(0, 300)) {
            const c1 = path.join(b, n1);
            if (!isDir(c1))
                continue;
            if ((0, exports.isConnectionMod)(c1))
                return path.resolve(c1);
            let l2 = [];
            try {
                l2 = fs.readdirSync(c1);
            }
            catch {
                continue;
            }
            for (const n2 of l2.slice(0, 300)) {
                const c2 = path.join(c1, n2);
                if (isDir(c2) && (0, exports.isConnectionMod)(c2))
                    return path.resolve(c2);
            }
        }
    }
    return null;
}
/** 게임 설치 폴더: Steam 라이브러리·steamapps·common 을 골라도 …\Stellaris 로 보정. */
function normalizeGameDir(picked) {
    return firstMatch(ancestors(picked, 3), ['', 'Stellaris', 'common/Stellaris', 'steamapps/common/Stellaris', 'Content'], hasGameFiles);
}
/** 세이브 폴더: save games·제국 폴더·사용자 폴더·문서 어디를 골라도 .sav 가 있는 곳으로 보정. */
function normalizeSaveDir(picked) {
    return firstMatch(ancestors(picked, 3), ['', 'save games', 'Stellaris/save games', 'Paradox Interactive/Stellaris/save games'], p => countSaves(p) > 0);
}
/** 찾지 못했을 때 사용자가 바로 할 일을 알려 주는 문구. 경로 문자열은 넣지 않는다(공개 로그 안전). */
function environmentHints(env) {
    const out = [];
    if (!env.userExists)
        out.push({ level: 'warn', text: '게임 사용자 폴더를 찾지 못했습니다. 이 폴더는 Stellaris를 한 번 실행하면 만들어지는 "문서\\Paradox Interactive\\Stellaris"입니다. 게임을 한 번 실행했다면 [게임 사용자 폴더 선택]에서 "문서"나 "Paradox Interactive" 폴더를 골라도 자동으로 찾아 줍니다.' });
    else if (!env.logExists)
        out.push({ level: 'info', text: '게임 로그(logs\\game.log)가 아직 없습니다. Stellaris를 실행해 세이브를 한 번 불러오면 생깁니다. 그 전에는 정상입니다.' });
    if (!env.modExists)
        out.push({ level: 'warn', text: '연결 모드를 찾지 못했습니다. 스팀 창작마당에서 "SLLM · SteLLaris Missive"를 구독하고 다운로드가 끝나면 자동으로 찾습니다(옮기거나 복사할 필요 없음). 다른 방법으로 받았다면 [연결 모드 폴더 선택]에서 모드 폴더나 그 상위 폴더를 고르세요.' });
    else if (env.userExists) {
        try {
            const dlc = fs.readFileSync(path.join(env.userDir, 'dlc_load.json'), 'utf8');
            if (!/3819625112|sllm_missive/i.test(dlc))
                out.push({ level: 'info', text: '스텔라리스 런처의 플레이셋에서 SLLM 연결 모드가 켜져 있지 않은 것 같습니다. 런처 → 플레이셋에서 체크하고, 새 게임이 아니라 기존 세이브라면 불러온 뒤 한 달 지나 확인하세요.' });
        }
        catch { /* dlc_load.json 은 런처를 쓴 적이 없으면 없다 */ }
    }
    if (!env.gameExists)
        out.push({ level: 'info', text: '게임 설치 폴더를 찾지 못해도 연결은 됩니다(국기·이미지 일부만 기본 모양). 필요하면 [게임 설치 폴더 선택]에서 Stellaris 폴더나 Steam 라이브러리 폴더를 고르세요.' });
    return out;
}
/** 지원 번들용: 어디를 찾아봤는지(사용자 이름이 들어간 경로는 sanitize 쪽에서 가려진다). */
function environmentTried() {
    return { user: userCandidates(), game: gameCandidates(), modWorkshop: connectionWorkshopCandidates(), libraries: steamLibraries(), drives: roots.drives };
}
//# sourceMappingURL=environment-paths.js.map
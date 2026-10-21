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
exports.FULL_APP_MARKER = exports.DLL_FILE = exports.UPDATE_TOP = exports.PUBLIC_KEY_FILE = exports.UPDATE_DIR = void 0;
exports.sha256File = sha256File;
exports.safeUpdatePath = safeUpdatePath;
exports.readSignedManifest = readSignedManifest;
exports.checkForUpdate = checkForUpdate;
exports.applyUpdate = applyUpdate;
exports.findInstallBundle = findInstallBundle;
// 창작마당 모드로 받는 앱 업데이트(2026-10-18 사용자 요청: 설치기를 매번 다시 받지 않게).
// 모드 폴더의 sllm_app_update/ 에 앱 파일 + manifest.json + manifest.sig(Ed25519) 가 들어 있다.
// 묶음은 개발 PC 의 tools/make-app-update.js 가 만든다(설치기_만들기.bat 마지막 단계). electron 에 의존하지 않는 순수 모듈.
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const version_check_1 = require("./version-check");
exports.UPDATE_DIR = 'sllm_app_update';
exports.PUBLIC_KEY_FILE = 'update-public-key.pem';
/** 묶음에 들어갈 수 있는 앱 최상위 항목(tools/make-app-update.js 의 TOP 과 같아야 함). 공개 키·설치 기록·runtime 은 절대 바꾸지 않는다. */
exports.UPDATE_TOP = ['dist', 'ui', 'native', 'example', 'package.json', 'start_app.bat', 'portrait-library.pak',
    'README_KO.md', 'ALPHA_SETUP_KO.md', 'ALPHA_SETUP_EN.md', 'RELEASE_NOTES_KO.md', 'RELEASE_NOTES_EN.md'];
/** 이 파일이 바뀌면 게임 폴더 DLL 도 바꿔야 하므로 설치기로만 업데이트한다(설치기의 DLL 백업·제거 규칙 유지). */
exports.DLL_FILE = 'native/command-bridge.dll';
function sha256File(file) { return (0, crypto_1.createHash)('sha256').update(fs.readFileSync(file)).digest('hex'); }
/** 묶음 안 경로가 안전한지: 상대 경로, '/' 구분, .. 없음, 허용한 최상위만. */
function safeUpdatePath(p) {
    if (typeof p !== 'string' || !p || p.length > 260 || /[\\:\0]/.test(p) || p.startsWith('/'))
        return false;
    const parts = p.split('/');
    if (parts.some((x) => !x || x === '.' || x === '..'))
        return false;
    return exports.UPDATE_TOP.includes(parts[0]) && (parts.length > 1 || !['dist', 'ui', 'native', 'example'].includes(parts[0]));
}
/** manifest.json 원문과 서명(base64)을 공개 키로 확인하고 내용을 읽는다. 틀리면 null. */
function readSignedManifest(manifestRaw, sigB64, publicKeyPem) {
    try {
        const sig = Buffer.from(String(sigB64).trim(), 'base64');
        if (!sig.length || !(0, crypto_1.verify)(null, manifestRaw, publicKeyPem, sig))
            return null;
        const m = JSON.parse(manifestRaw.toString('utf8'));
        if (m.format !== 1 || m.app !== 'sllm' || typeof m.version !== 'string' || !Array.isArray(m.files))
            return null;
        if (!m.files.every((f) => f && safeUpdatePath(f.path) && /^[0-9a-f]{64}$/.test(f.sha256) && Number.isInteger(f.size) && f.size >= 0))
            return null;
        return m;
    }
    catch {
        return null;
    }
}
/** 후보 모드 폴더들에서 지금 앱보다 새 버전 묶음을 찾는다(가장 높은 버전). 스팀이 받는 중이라 파일이 덜 맞으면 'none'. */
function checkForUpdate(appDir, appVersion, modDirs, publicKeyPem) {
    let best = null, reason = 'no bundle';
    for (const mod of [...new Set(modDirs.filter(Boolean))]) {
        const dir = path.join(mod, exports.UPDATE_DIR);
        let raw, sig;
        try {
            raw = fs.readFileSync(path.join(dir, 'manifest.json'));
            sig = fs.readFileSync(path.join(dir, 'manifest.sig'), 'utf8');
        }
        catch {
            continue;
        }
        const m = readSignedManifest(raw, sig, publicKeyPem);
        if (!m) {
            reason = 'bad signature';
            continue;
        }
        if (((0, version_check_1.compareVersions)(m.version, appVersion) ?? 0) <= 0) {
            if (reason !== 'bad signature')
                reason = 'not newer';
            continue;
        }
        if (!best || ((0, version_check_1.compareVersions)(m.version, best.m.version) ?? 0) > 0)
            best = { m, dir };
    }
    if (!best)
        return { kind: 'none', reason };
    const { m, dir } = best;
    for (const f of m.files) { // 묶음이 온전한지(스팀 다운로드가 덜 끝났거나 바뀐 파일)
        const src = path.join(dir, ...f.path.split('/'));
        try {
            if (fs.statSync(src).size !== f.size || sha256File(src) !== f.sha256)
                return { kind: 'none', reason: 'incomplete ' + f.path };
        }
        catch {
            return { kind: 'none', reason: 'missing ' + f.path };
        }
    }
    const changed = m.files.filter((f) => { const dst = path.join(appDir, ...f.path.split('/')); try {
        return sha256File(dst) !== f.sha256;
    }
    catch {
        return true;
    } });
    if (changed.some((f) => f.path === exports.DLL_FILE))
        return { kind: 'needs_installer', version: m.version, bundleDir: dir };
    return { kind: 'available', version: m.version, bundleDir: dir, manifest: m, changed };
}
/** 바뀐 파일만 교체한다. 기존 파일은 backupDir 에 두고, 하나라도 실패하면 모두 되돌린 뒤 오류를 던진다. */
function applyUpdate(appDir, bundleDir, changed, backupDir) {
    fs.rmSync(backupDir, { recursive: true, force: true });
    fs.mkdirSync(backupDir, { recursive: true });
    const done = [];
    try {
        for (const f of changed) {
            if (!safeUpdatePath(f.path))
                throw new Error('bad path ' + f.path);
            const parts = f.path.split('/'), src = path.join(bundleDir, ...parts), dst = path.join(appDir, ...parts), tmp = dst + '.sllm-new';
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(src, tmp);
            if (sha256File(tmp) !== f.sha256) {
                fs.rmSync(tmp, { force: true });
                throw new Error('hash mismatch ' + f.path);
            }
            let bak = null;
            if (fs.existsSync(dst)) {
                bak = path.join(backupDir, ...parts);
                fs.mkdirSync(path.dirname(bak), { recursive: true });
                fs.copyFileSync(dst, bak);
            }
            done.push({ dst, bak });
            fs.renameSync(tmp, dst);
        }
    }
    catch (e) {
        for (const d of done.reverse()) {
            try {
                if (d.bak)
                    fs.copyFileSync(d.bak, d.dst);
                else
                    fs.rmSync(d.dst, { force: true });
            }
            catch { /* 되돌리기 실패는 아래 오류로 알린다 */ }
        }
        for (const f of changed) {
            try {
                fs.rmSync(path.join(appDir, ...f.path.split('/')) + '.sllm-new', { force: true });
            }
            catch { /* 없음 */ }
        }
        throw e;
    }
}
// ---- 첫 설치(2026-10-21 사용자 결정 A안): 설치기에는 runtime·DLL·이 도우미만 넣고, 앱 파일은 처음 켤 때 창작마당 묶음에서 채운다. ----
/** 처음 채우기가 끝났는지: 전체 앱의 시작 파일이 있으면 끝난 것(설치기는 덮어쓰기 설치 때 이 파일을 지워 다시 채우게 한다). */
exports.FULL_APP_MARKER = 'dist/main.js';
/** 처음 채울 묶음 찾기: 서명이 맞고 설치기 버전(minVersion) 이상인 것 중 가장 높은 버전. 업데이트와 달리 같은 버전도 받는다. */
function findInstallBundle(appDir, minVersion, modDirs, publicKeyPem) {
    let best = null, sawBad = false, older = null;
    for (const mod of [...new Set(modDirs.filter(Boolean))]) {
        const dir = path.join(mod, exports.UPDATE_DIR);
        let raw, sig;
        try {
            raw = fs.readFileSync(path.join(dir, 'manifest.json'));
            sig = fs.readFileSync(path.join(dir, 'manifest.sig'), 'utf8');
        }
        catch {
            continue;
        }
        const m = readSignedManifest(raw, sig, publicKeyPem);
        if (!m) {
            sawBad = true;
            continue;
        }
        if (!m.files.some((f) => f.path === exports.FULL_APP_MARKER)) {
            sawBad = true;
            continue;
        }
        const cmp = (0, version_check_1.compareVersions)(m.version, minVersion);
        if (cmp === null || cmp < 0) {
            older = m.version;
            continue;
        }
        if (!best || ((0, version_check_1.compareVersions)(m.version, best.m.version) ?? 0) > 0)
            best = { m, dir };
    }
    if (!best)
        return older ? { kind: 'too_old', version: older } : sawBad ? { kind: 'bad_signature' } : { kind: 'missing' };
    const { m, dir } = best;
    for (const f of m.files) {
        const src = path.join(dir, ...f.path.split('/'));
        try {
            if (fs.statSync(src).size !== f.size || sha256File(src) !== f.sha256)
                return { kind: 'downloading', detail: f.path };
        }
        catch {
            return { kind: 'downloading', detail: f.path };
        }
    }
    const changed = m.files.filter((f) => { const dst = path.join(appDir, ...f.path.split('/')); try {
        return sha256File(dst) !== f.sha256;
    }
    catch {
        return true;
    } });
    // 첫 설치에서도 DLL 은 설치기가 게임 폴더에 넣은 것과 같아야 한다(앱 안에서 DLL 을 바꾸지 않는 규칙).
    if (changed.some((f) => f.path === exports.DLL_FILE))
        return { kind: 'needs_installer', version: m.version };
    return { kind: 'ready', version: m.version, bundleDir: dir, changed };
}
//# sourceMappingURL=app-update-core.js.map
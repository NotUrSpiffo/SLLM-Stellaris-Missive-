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
exports.ELEVATION_MISMATCH_MESSAGE = void 0;
exports.classifyDelivery = classifyDelivery;
exports.parseElevation = parseElevation;
exports.checkGameElevation = checkGameElevation;
exports.readGamePathFile = readGamePathFile;
exports.bridgeDllCandidates = bridgeDllCandidates;
exports.runNativeCommand = runNativeCommand;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const environment_paths_1 = require("./environment-paths");
const diagnostics_1 = require("./diagnostics");
const i18n_pick_1 = require("./i18n-pick"); // 한/영 문구(2026-10-19 영어 화면 점검)
/**
 * bridge-client.exe 의 결과를 해석한다(F-12). exit 2~7 은 JSON 을 찍기 전에 끝나므로 요청이 게임에 닿지 않은 것이 확실하다.
 * state: 1 READY(전달 전) 2 RUNNING(처리 중) 3 COMPLETE 4 CANCELLED. result: 0 OK 1 대상 다름 2 지원 안 되는 빌드 3 파일 오류 4 명령 실패.
 * 'uncertain' 일 때만 요청 파일을 남긴다(게임이 나중에 읽을 수 있으므로 자동 재시도하지 않는다).
 */
function classifyDelivery(exitCode, delivery, killed = false) {
    const fail = (message) => ({ kind: 'fail', message, safeToRemove: true });
    if (delivery) {
        if (delivery.state === 3) {
            if (delivery.result === 0 && delivery.gameStatus === 1)
                return { kind: 'ok', message: '', safeToRemove: true }; // exit 11(훅 해제 실패)이어도 명령은 실행됐다
            if (delivery.result === 2)
                return fail('현재 게임 버전은 DLL 연결이 지원하지 않습니다. 연결 파일을 업데이트해 주세요.');
            if (delivery.result === 1)
                return fail('연결 대상 게임 창이 바뀌어 요청을 실행하지 않았습니다. 다시 시도해 주세요.');
            if (delivery.result === 3)
                return fail('게임이 요청 파일을 읽지 못했습니다. 게임 사용자 폴더 경로를 확인해 주세요.');
            if (delivery.result === 0 && delivery.gameStatus !== 1)
                return { kind: 'uncertain', message: (0, i18n_pick_1.L)('게임이 요청을 받았지만 실행 결과를 알려 주지 않았습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'The game received the request but did not report the result. It was not retried automatically, so please check the result in the game.'), safeToRemove: true };
            return fail('게임이 명령을 실행하지 못했습니다(결과 코드 ' + delivery.result + ').');
        }
        if (delivery.state === 1)
            return fail('연결 DLL을 불러오거나 게임 창에 연결하지 못했습니다. 게임 실행 상태와 연결 파일을 확인해 주세요.');
        if (delivery.state === 4)
            return fail('게임이 10초 안에 요청을 받지 않아 취소했습니다(로딩 중이거나 창이 멈춰 있을 수 있습니다). 게임에는 아무것도 적용되지 않았습니다.');
        return { kind: 'uncertain', message: (0, i18n_pick_1.L)('게임 요청의 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'Could not confirm the game request finished. It was not retried automatically, so please check the result in the game.'), safeToRemove: false };
    }
    if (killed)
        return { kind: 'uncertain', message: (0, i18n_pick_1.L)('연결 프로그램이 시간 안에 끝나지 않았습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'The bridge program did not finish in time. It was not retried automatically, so please check the result in the game.'), safeToRemove: false };
    switch (Number(exitCode)) {
        case 4: return fail('실행 중인 스텔라리스 창을 찾지 못했습니다. 게임이 꺼져 있거나 두 개 이상 실행 중입니다.');
        case 2:
        case 3: return fail('게임 요청 형식이 올바르지 않습니다(내부 오류 ' + exitCode + ').');
        case 5:
        case 6:
        case 7: return fail('게임 연결을 준비하지 못했습니다(코드 ' + exitCode + '). 잠시 뒤 다시 시도해 주세요.');
    }
    if (exitCode === 'ENOENT' || exitCode === 'EACCES')
        return fail('게임 연결 프로그램을 실행하지 못했습니다(' + exitCode + '). 앱의 native 폴더와 백신 차단 여부를 확인해 주세요.');
    return { kind: 'uncertain', message: (0, i18n_pick_1.L)('게임 요청의 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았으니 게임 결과를 확인해 주세요.', 'Could not confirm the game request finished. It was not retried automatically, so please check the result in the game.'), safeToRemove: false };
}
/** 2026-10-18 트러블슈팅: 스텔라리스만 관리자 권한이면 윈도우(UIPI/무결성 수준)가 일반 권한 SLLM 의 DLL 연결을 막는다(state 1).
 * 연결 실패 때만 게임 프로세스 토큰을 확인해 이 경우를 따로 안내한다. 둘 다 같은 권한이면 정상. */
exports.ELEVATION_MISMATCH_MESSAGE = '스텔라리스가 관리자 권한으로 실행 중이라 SLLM이 게임에 연결하지 못했습니다. 윈도우는 일반 권한 프로그램이 관리자 권한 프로그램에 접근하지 못하게 막습니다. 스텔라리스와 SLLM을 둘 다 일반 권한으로(권장) 또는 둘 다 관리자 권한으로 다시 실행해 주세요. 게임 실행 파일·스팀의 「관리자 권한으로 이 프로그램 실행」 설정도 확인해 주세요.';
const PS_ELEVATION = `$ErrorActionPreference='SilentlyContinue'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class SllmElev {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a, bool i, int pid);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr h, uint a, out IntPtr t);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr t, int c, out int v, int l, out int r);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  public static string Check(int pid) {
    IntPtr h = OpenProcess(0x1000, false, pid); if (h == IntPtr.Zero) return "denied";
    IntPtr t; if (!OpenProcessToken(h, 8, out t)) { int e = Marshal.GetLastWin32Error(); CloseHandle(h); return e == 5 ? "denied" : "unknown"; }
    int v = 0, r; bool ok = GetTokenInformation(t, 20, out v, 4, out r); CloseHandle(t); CloseHandle(h);
    return ok ? (v != 0 ? "elevated" : "normal") : "unknown";
  }
}
'@
$self = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$g = @(Get-Process -Name stellaris | ForEach-Object { [SllmElev]::Check($_.Id) })
'SELF=' + $(if ($self) { '1' } else { '0' }) + ' GAME=' + $(if ($g.Count) { $g -join ',' } else { 'none' })`;
/** PS_ELEVATION 출력 해석. 'mismatch' = 게임만 관리자 권한(또는 일반 권한인 앱이 게임 토큰을 열 수 없음). */
function parseElevation(stdout) {
    const m = /SELF=([01])\s+GAME=([a-z,]+)/.exec(stdout || '');
    if (!m)
        return 'unknown';
    const game = m[2].split(',').filter(Boolean);
    if (m[1] === '1' || !game.length || game[0] === 'none')
        return game[0] === 'none' ? 'unknown' : 'ok';
    if (game.some((g) => g === 'elevated' || g === 'denied'))
        return 'mismatch';
    return game.every((g) => g === 'normal') ? 'ok' : 'unknown';
}
/** 게임만 관리자 권한인지 확인한다(윈도우 전용, 실패하면 'unknown'). 연결 실패 때만 부른다. */
function checkGameElevation() {
    if (process.platform !== 'win32')
        return Promise.resolve('unknown');
    return new Promise((resolve) => {
        try {
            (0, child_process_1.execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(PS_ELEVATION, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000, maxBuffer: 64 * 1024, encoding: 'utf8' }, (_e, stdout) => resolve(parseElevation(String(stdout || ''))));
        }
        catch {
            resolve('unknown');
        }
    });
}
let pending = Promise.resolve();
function nativeDirectory() {
    const local = path.join(__dirname, '..', 'native');
    const resources = process.resourcesPath;
    const candidates = [resources ? path.join(resources, 'native') : '', local];
    const found = candidates.find(p => p && fs.existsSync(path.join(p, 'bridge-client.exe')) && fs.existsSync(path.join(p, 'command-bridge.dll')));
    if (!found)
        throw new Error((0, i18n_pick_1.L)('게임 연결 파일이 없습니다. 앱의 native 폴더를 확인해 주세요.', 'The game bridge file is missing. Check the app\'s native folder.'));
    return found;
}
/** 설치기가 남긴 game-install-path.txt(UTF-16LE) 의 게임 폴더. 비었거나 읽을 수 없으면 ''. */
function readGamePathFile(file) {
    try {
        return fs.readFileSync(file).toString('utf16le').replace(/^\uFEFF/, '').replace(/\0/g, '').trim();
    }
    catch {
        return '';
    }
}
/** 게임 DLL 위치를 정한다(2026-10-17 트러블슈팅: game-install-path.txt 가 0바이트인 설치에서 DLL 이 게임 폴더에 있는데도 실패).
 * 순서: 설치기가 적은 게임 폴더 → 자동으로 찾은 게임 폴더들. 설치 기록 파일이 아예 없으면(개발 폴더) 앱 native 의 DLL.
 * 못 찾으면 확인한 경로를 오류에 적는다. */
function bridgeDllCandidates(gamePathFile, detected) {
    const fromFile = readGamePathFile(gamePathFile);
    const candidates = [...new Set([fromFile, ...detected].filter(Boolean).map((d) => path.join(d, 'sllm-tester-command-bridge.dll')))];
    return { fromFile, candidates };
}
function findBridgeDll(native) {
    const gamePathFile = path.join(__dirname, '..', 'game-install-path.txt');
    if (!fs.existsSync(gamePathFile))
        return path.join(native, 'command-bridge.dll');
    const { fromFile, candidates } = bridgeDllCandidates(gamePathFile, (0, environment_paths_1.gameCandidates)());
    const hit = candidates.find((p) => fs.existsSync(p));
    if (hit) {
        if (!fromFile || path.dirname(hit) !== path.normalize(fromFile))
            (0, diagnostics_1.logDiagnostic)('warn', 'bridge.dll_fallback', { fromFile, used: hit });
        return hit;
    }
    (0, diagnostics_1.logDiagnostic)('error', 'bridge.dll_missing', { fromFile, checked: candidates });
    throw new Error((0, i18n_pick_1.L)('게임 연결 DLL을 찾지 못했습니다. 확인한 위치: ', 'Could not find the game bridge DLL. Checked: ') + (candidates.join(' / ') || (0, i18n_pick_1.L)('(게임 폴더를 모름)', '(game folder unknown)')) + (0, i18n_pick_1.L)('. 설치 프로그램을 다시 실행해 게임 폴더를 지정해 주세요.', '. Run the installer again and choose the game folder.'));
}
async function deliver(cmd) {
    if (!cmd.trim() || cmd.includes('\0') || Buffer.byteLength(cmd, 'utf8') > 1024 * 1024) {
        throw new Error((0, i18n_pick_1.L)('게임 요청이 비어 있거나 너무 큽니다.', 'The game request is empty or too large.'));
    }
    const native = nativeDirectory();
    const bridgeDll = findBridgeDll(native);
    const filename = 'sx' + (0, crypto_1.randomBytes)(4).toString('hex') + '.ini';
    const requestPath = path.join((0, environment_paths_1.runtimeUserDir)(), filename);
    await fs.promises.writeFile(requestPath, cmd.trim() + '\n', { encoding: 'utf8', flag: 'wx' });
    let safeToRemove = false;
    try {
        await new Promise((resolve, reject) => {
            (0, child_process_1.execFile)(path.join(native, 'bridge-client.exe'), [bridgeDll, filename], { windowsHide: true, timeout: 20000, maxBuffer: 64 * 1024, encoding: 'utf8' }, (error, stdout) => {
                let delivery;
                try {
                    delivery = JSON.parse(stdout.trim());
                }
                catch { /* Failure before native delivery. */ }
                const e = error;
                const out = classifyDelivery(e ? e.code : 0, delivery, !!e?.killed);
                safeToRemove = out.safeToRemove;
                if (out.kind === 'ok') {
                    resolve();
                    return;
                }
                if (delivery?.state !== 1) {
                    reject(new Error(out.message));
                    return;
                }
                // DLL 을 붙이지 못함: 관리자 권한 차이인지 확인해 맞으면 그 안내로 바꾼다.
                checkGameElevation().then((r) => {
                    if (r === 'mismatch') {
                        (0, diagnostics_1.logDiagnostic)('warn', 'bridge.elevation_mismatch', {});
                        reject(new Error(exports.ELEVATION_MISMATCH_MESSAGE));
                    }
                    else
                        reject(new Error(out.message));
                }, () => reject(new Error(out.message)));
            });
        });
    }
    finally {
        // An uncertain in-flight request stays available for the game; never retry it here.
        if (safeToRemove)
            await fs.promises.unlink(requestPath).catch((error) => { (0, diagnostics_1.logDiagnostic)('warn', 'bridge.request_cleanup_failed', { file: path.basename(requestPath), error }); }); // 남은 sx*.ini 가 쌓이면 원인을 찾을 수 있게(F-33 B)
    }
}
/** Serializes requests without clipboard, focus changes, console keys, or automatic retry. */
function runNativeCommand(cmd) {
    const next = pending.then(() => deliver(cmd));
    pending = next.catch(() => undefined);
    return next;
}
//# sourceMappingURL=native-bridge.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameWindowWatcher = exports.ICON_RESERVE = exports.toFrac = void 0;
exports.parseGameLine = parseGameLine;
exports.focusGame = focusGame;
exports.layoutScale = layoutScale;
exports.fitSize = fitSize;
exports.dockRect = dockRect;
exports.launcherRect = launcherRect;
// Stellaris 창의 위치·크기와 앞에 있는지를 계속 알려 준다(OP.GG 처럼 앱 창을 게임 창에 붙이기 위해).
// PowerShell 하나를 띄워 두고 0.4초마다 한 줄씩 받는다. 좌표는 물리 픽셀(DPI 인식 켬)이고,
// 앱(Electron)에서 screen.screenToDipRect 로 바꿔 쓴다.
const child_process_1 = require("child_process");
const events_1 = require("events");
const PS_WATCH = `
$ProgressPreference = 'SilentlyContinue'
Add-Type @"
using System; using System.Runtime.InteropServices;
public class SllmWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[void][SllmWin]::SetProcessDPIAware()
$h = [IntPtr]::Zero; $n = 0
while ($true) {
  if ($h -eq [IntPtr]::Zero -or -not [SllmWin]::IsWindow($h) -or ($n % 10) -eq 0) {
    $p = Get-Process -Name stellaris -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($p) { $h = $p.MainWindowHandle } else { $h = [IntPtr]::Zero }
  }
  $n++
  $fgw = [SllmWin]::GetForegroundWindow(); $fpid = [uint32]0; [void][SllmWin]::GetWindowThreadProcessId($fgw, [ref]$fpid)
  if ($h -ne [IntPtr]::Zero) {
    $r = New-Object SllmWin+RECT; [void][SllmWin]::GetWindowRect($h, [ref]$r)
    $fg = [int]($fgw -eq $h); $min = [int][SllmWin]::IsIconic($h)
    [Console]::Out.WriteLine("G $fg $min $($r.L) $($r.T) $($r.R - $r.L) $($r.B - $r.T) $fpid $([int64]$h)")
  } else {
    [Console]::Out.WriteLine("N 0 0 0 0 0 0 $fpid")
  }
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 400
}
`;
/** PowerShell 이 내보낸 한 줄을 해석한다. 형식: "G fg min x y w h fgPid" 또는 "N 0 0 0 0 0 0 fgPid". */
function parseGameLine(line) {
    const p = line.trim().split(/\s+/);
    if (p.length < 8 || (p[0] !== 'G' && p[0] !== 'N'))
        return null;
    const n = p.slice(1).map(Number);
    if (n.some((v) => !Number.isFinite(v)))
        return null;
    return { running: p[0] === 'G', foreground: n[0] === 1, minimized: n[1] === 1, x: n[2], y: n[3], w: n[4], h: n[5], fgPid: n[6], ...(n.length > 7 && n[7] > 0 ? { hwnd: n[7] } : {}) };
}
/** 게임 창을 다시 앞으로(2026-10-18): 앱 창을 닫을 때 부른다. 독점 전체화면에서 우리 창 때문에 내려간 게임을 되살리고, 테두리 없음에서는 포커스를 돌려준다.
 *  우리 앱이 지금 앞에 있을 때만 윈도우가 SetForegroundWindow 를 허락하므로, 창을 숨기기 전에 부른다. */
function focusGame(hwnd) {
    if (process.platform !== 'win32' || !hwnd)
        return;
    const ps = `Add-Type 'using System;using System.Runtime.InteropServices;public class SllmFg{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern bool IsIconic(IntPtr h);[DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c);}'
$h=[IntPtr]${hwnd}; if([SllmFg]::IsIconic($h)){[void][SllmFg]::ShowWindow($h,9)}; [void][SllmFg]::SetForegroundWindow($h)`;
    try {
        (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
    }
    catch { /* 없어도 동작에는 지장 없음 */ }
}
const toFrac = (pos, game) => ({ fx: (pos.x - game.x) / Math.max(1, game.width), fy: (pos.y - game.y) / Math.max(1, game.height) });
exports.toFrac = toFrac;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/**
 * 창 크기 배율. 사용자가 고른 값(0.7~1.6)에, 자동 조절이 켜져 있으면 게임 창 높이/1080(0.8~1.5)을 곱한다.
 * 스텔라리스 HUD 가 해상도에 따라 얼마나 커지는지는 아직 모르므로 사용자가 마지막으로 맞추게 한다.
 */
function layoutScale(gameHeight, user, auto) {
    const u = clamp(Number.isFinite(user) ? user : 1, 0.7, 1.6);
    const a = auto && gameHeight && gameHeight > 0 ? clamp(gameHeight / 1080, 0.8, 1.5) : 1;
    return Math.round(u * a * 100) / 100;
}
/** 게임 창이 작아도 앱 창이 화면을 다 가리지 않도록 크기를 자른다(너비 55%, 높이 92% 안). */
function fitSize(size, game) {
    return { width: Math.round(Math.min(size.width, Math.max(300, game.width * 0.55))), height: Math.round(Math.min(size.height, Math.max(360, game.height * 0.92))) };
}
/**
 * 앱 창을 둘 자리. offset(끌어서 옮긴 자리, 비율)이 있으면 그 자리를, 없으면 dock 쪽 가장자리에서
 * 아래 HUD 를 피한 높이에 붙인다. 여백은 scale 배율을 따르고, 게임 창 밖으로 나가지 않게 자른다.
 */
/** 아이콘 창(런처)이 가장자리에 붙어 있을 때 대화창이 그 바로 안쪽(옆)에 서도록 비켜 주는 폭(기본 배율 기준: 아이콘 46 + 바깥 여백 10 + 틈 8). */
exports.ICON_RESERVE = 64;
function dockRect(game, app, dock, offset, scale = 1, iconSide = null) {
    const margin = 16 * scale, bottomHud = 140 * scale;
    let x, y;
    if (offset) {
        x = game.x + offset.fx * game.width;
        y = game.y + offset.fy * game.height;
    }
    else {
        const gapL = dock === 'left' && iconSide === 'left' ? exports.ICON_RESERVE * scale : margin, gapR = dock === 'right' && iconSide === 'right' ? exports.ICON_RESERVE * scale : margin;
        x = dock === 'left' ? game.x + gapL : game.x + game.width - app.width - gapR;
        y = game.y + game.height - app.height - bottomHud;
    }
    x = clamp(x, game.x, game.x + Math.max(0, game.width - app.width));
    y = clamp(y, game.y, game.y + Math.max(0, game.height - app.height));
    return { x: Math.round(x), y: Math.round(y), width: app.width, height: app.height };
}
/**
 * 작은 아이콘 창(런처)을 둘 자리. 구석에 붙이되, 위쪽은 자원 막대를, 아래쪽은 HUD 를 피한다.
 * offset 이 있으면(끌어서 옮긴 자리) 게임 창 왼쪽 위 기준으로 지키고, 게임 창 밖으로는 나가지 않게 자른다.
 */
function launcherRect(game, size, corner, offset, scale = 1) {
    const margin = 10 * scale, topInset = 72 * scale, bottomInset = 150 * scale;
    let x, y;
    if (offset) {
        x = game.x + offset.fx * game.width;
        y = game.y + offset.fy * game.height;
    }
    else {
        x = corner === 'tl' || corner === 'bl' ? game.x + margin : game.x + game.width - size.width - margin;
        y = corner === 'tl' || corner === 'tr' ? game.y + topInset : game.y + game.height - size.height - bottomInset;
    }
    x = clamp(x, game.x, game.x + Math.max(0, game.width - size.width));
    y = clamp(y, game.y, game.y + Math.max(0, game.height - size.height));
    return { x: Math.round(x), y: Math.round(y), width: size.width, height: size.height };
}
class GameWindowWatcher extends events_1.EventEmitter {
    proc = null;
    buf = '';
    stopped = false;
    start() {
        if (process.platform !== 'win32' || this.proc)
            return;
        this.stopped = false;
        const enc = Buffer.from(PS_WATCH, 'utf16le').toString('base64');
        const p = (0, child_process_1.spawn)('powershell.exe', ['-NoProfile', '-EncodedCommand', enc], { windowsHide: true });
        this.proc = p;
        p.stdout?.on('data', (d) => {
            this.buf += d.toString('utf8');
            let i;
            while ((i = this.buf.indexOf('\n')) >= 0) {
                const line = this.buf.slice(0, i);
                this.buf = this.buf.slice(i + 1);
                const g = parseGameLine(line);
                if (g)
                    this.emit('state', g);
            }
        });
        p.on('exit', () => {
            this.proc = null;
            if (!this.stopped)
                setTimeout(() => this.start(), 3000); // 죽으면 다시 띄운다
        });
        p.on('error', (e) => this.emit('error', e));
    }
    stop() {
        this.stopped = true;
        this.proc?.kill();
        this.proc = null;
    }
}
exports.GameWindowWatcher = GameWindowWatcher;
//# sourceMappingURL=gameWindow.js.map
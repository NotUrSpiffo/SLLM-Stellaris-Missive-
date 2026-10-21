import { runNativeCommand } from './native-bridge';
import { diagnosticSpan } from './diagnostics';
import { spawn } from 'child_process';
import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

// 게임 콘솔에 명령 한 줄을 넣는다: 클립보드에 쓰고 ` → Ctrl+V → Enter 를 보낸다.
// 클립보드 쓰기는 호출자(Electron clipboard)가 주입한다.
/** 키보드를 실제로 쓰는 동안(게임 창을 앞으로 가져오고 키를 보내는 구간) 알리는 훅. 앱이 '입력 중' 표시를 띄우는 데 쓴다. */
export const inputHook: { start?: () => void; end?: () => void } = {};
async function withInput<T>(fn: () => Promise<T>): Promise<T> {
  inputHook.start?.();
  try { return await fn(); } finally { inputHook.end?.(); }
}
export type ClipboardWrite = (text: string) => void;

// ---- 상주 입력 프로그램: 명령마다 PowerShell 을 새로 띄우지 않고(두 번 × 0.5초 안팎), 한 번 띄워 두고 줄 단위로 일을 시킨다.
// 게임이 이미 맨 앞이면 창 전환과 400ms 대기도 건너뛴다. 클립보드는 호출자가 미리 써 둔다.
class WorkerDown extends Error {}
const PS_WORKER = `
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
Add-Type @"
using System; using System.Runtime.InteropServices;
public class SllmW {
  [StructLayout(LayoutKind.Explicit, Size=40)]
  public struct INPUT {
    [FieldOffset(0)] public uint type;
    [FieldOffset(8)] public ushort wVk;
    [FieldOffset(10)] public ushort wScan;
    [FieldOffset(12)] public uint dwFlags;
    [FieldOffset(16)] public uint time;
    [FieldOffset(24)] public IntPtr extra;
  }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static void Key(ushort scan, bool up) { INPUT[] a = new INPUT[1]; a[0].type = 1; a[0].wScan = scan; a[0].dwFlags = (uint)(8 | (up ? 2 : 0)); SendInput(1, a, 40); }
  public static void Tap(ushort scan) { Key(scan, false); System.Threading.Thread.Sleep(40); Key(scan, true); }
}
"@
$sh = New-Object -ComObject WScript.Shell
function Ensure {
  $p = Get-Process stellaris -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if (-not $p) { return 'noproc' }
  $fp = [uint32]0; [void][SllmW]::GetWindowThreadProcessId([SllmW]::GetForegroundWindow(), [ref]$fp)
  if ($fp -eq $p.Id) { return 'ok' }
  if ($sh.AppActivate($p.Id)) { Start-Sleep -Milliseconds 400; return 'ok' }
  return 'fail'
}
[Console]::Out.WriteLine('READY'); [Console]::Out.Flush()
while (($line = [Console]::In.ReadLine()) -ne $null) {
  try {
    $r = Ensure
    if ($r -eq 'noproc') { [Console]::Out.WriteLine('ERR:stellaris 프로세스를 찾지 못했습니다(게임이 켜져 있고 창이 떠 있어야 합니다).') }
    elseif ($r -ne 'ok') { [Console]::Out.WriteLine('ERR:게임 창을 앞으로 가져오지 못했습니다.') }
    elseif ($line -eq 'CONSOLE') {
      [SllmW]::Tap(0x29); Start-Sleep -Milliseconds 350
      [SllmW]::Key(0x1D, $false); Start-Sleep -Milliseconds 40; [SllmW]::Tap(0x2F); Start-Sleep -Milliseconds 40; [SllmW]::Key(0x1D, $true)
      Start-Sleep -Milliseconds 200
      [SllmW]::Tap(0x1C); Start-Sleep -Milliseconds 300
      [SllmW]::Tap(0x29)
      [Console]::Out.WriteLine('DONE')
    }
    elseif ($line -eq 'SPACE') { [SllmW]::Tap(0x39); [Console]::Out.WriteLine('DONE') }
    else { [Console]::Out.WriteLine('ERR:알 수 없는 작업') }
  } catch { [Console]::Out.WriteLine('ERR:' + $_.Exception.Message) }
  [Console]::Out.Flush()
}
`;
const worker = {
  proc: null as ReturnType<typeof spawn> | null,
  buf: '',
  waiter: null as { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null,
  ready: null as Promise<void> | null,
  chain: Promise.resolve() as Promise<unknown>,
  start(): Promise<void> {
    if (this.proc && this.ready) return this.ready;
    const enc = Buffer.from(PS_WORKER, 'utf16le').toString('base64');
    const p = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', enc], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc = p; this.buf = '';
    let onReady: () => void = () => {}, onFail: (e: Error) => void = () => {};
    this.ready = new Promise<void>((res, rej) => { onReady = res; onFail = rej; });
    this.ready.catch(() => {});
    const down = (why: string) => { if (this.proc !== p) return; this.proc = null; this.ready = null; onFail(new WorkerDown(why)); const w = this.waiter; if (w) { this.waiter = null; clearTimeout(w.timer); w.reject(new Error(why + L(': 키 전송 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았습니다.', ': could not confirm the keys were sent. Not retried automatically.'))); } };
    p.stdout!.setEncoding('utf8');
    p.stdout!.on('data', (d: string) => {
      this.buf += d; let i: number;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const ln = this.buf.slice(0, i).replace(/\r$/, ''); this.buf = this.buf.slice(i + 1);
        if (ln === 'READY') onReady();
        else if (this.waiter) { const w = this.waiter; this.waiter = null; clearTimeout(w.timer); if (ln === 'DONE') w.resolve(); else w.reject(new Error(ln.replace(/^ERR:/, '') || '키 전송 실패')); }
      }
    });
    p.stdin!.on('error', () => down('입력 연결 끊김'));
    p.stderr!.on('data', () => { /* 진행 표시 등은 무시 */ });
    p.on('error', () => down('시작 실패')); p.on('exit', () => down('종료됨'));
    const startupTimer = setTimeout(() => { if (this.proc === p) { down('시작 시간 초과'); p.kill(); } }, 15000);
    this.ready.then(() => clearTimeout(startupTimer), () => clearTimeout(startupTimer));
    return this.ready;
  },
  /** 작업 하나를 시키고 끝날 때까지 기다린다. 한 번에 하나씩. */
  run(job: 'CONSOLE' | 'SPACE'): Promise<void> {
    const go = async () => {
      await this.start();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { this.waiter = null; try { this.proc?.kill(); } catch { /* 이미 끝남 */ } reject(new Error(L('응답 시간 초과: 키 전송 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았습니다.', 'Timed out: could not confirm the keys were sent. Not retried automatically.'))); }, 15000);
        this.waiter = { resolve, reject, timer };
        this.proc!.stdin!.write(job + '\n');
      });
    };
    const r = this.chain.then(go, go); this.chain = r.catch(() => undefined); return r;
  },
};
/** 앱을 켤 때 미리 띄워 두면 첫 명령도 빠르다. */
export function warmUpInput(): void { if (process.env.SLLM_LEGACY_CONSOLE === '1') void worker.start().catch(() => {}); }

export function runConsoleCommand(cmd: string, writeClipboard: ClipboardWrite): Promise<void> {
  const span=diagnosticSpan('game.console',{commandChars:cmd.length,requests:[...cmd.matchAll(/\bREQ\s*=\s*(\d+)/g)].map(m=>Number(m[1])),targets:[...cmd.matchAll(/\bTID\s*=\s*(\d+)/g)].map(m=>Number(m[1])),effects:[...new Set(cmd.match(/sllm_[a-zA-Z0-9_]+/g)||[])].slice(0,25)});
  if (process.env.SLLM_LEGACY_CONSOLE !== '1') {
    return withInput(() => runNativeCommand(cmd)).then(() => { span.end(); }, e => { span.fail(e); throw e; });
  }
  return withInput(async () => {
    writeClipboard(cmd);
    try { await worker.run('CONSOLE'); }
    catch (e) { if (e instanceof WorkerDown) await runConsoleCommandLegacy(cmd, writeClipboard); else throw e; } // 상주 프로세스를 못 쓰면 예전 방식으로
  }).then(()=>{span.end();},(e)=>{span.fail(e);throw e;});
}
async function runConsoleCommandLegacy(_cmd: string, _writeClipboard: ClipboardWrite): Promise<void> {
  await runInputOnce('CONSOLE');
}

// 게임 창에 스페이스 키 한 번(일시정지/재개). 게임 창을 앞으로 가져온 뒤 보낸다.
export function sendSpaceToGame(): Promise<void> {
  return withInput(async () => {
    try { await worker.run('SPACE'); }
    catch (e) { if (e instanceof WorkerDown) await sendSpaceRaw(); else throw e; }
  });
}
async function sendSpaceRaw(): Promise<void> { await runInputOnce('SPACE'); }

/** A startup fallback only. Never retry a job that may already have sent keys. */
function runInputOnce(job: 'CONSOLE' | 'SPACE'): Promise<void> {
  const enc = Buffer.from(PS_WORKER, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', enc], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => { p.kill(); finish(new Error(L('키 전송 완료 여부를 확인하지 못했습니다. 자동 재시도하지 않았습니다.', 'Could not confirm the keys were sent. Not retried automatically.'))); }, 15000);
    p.stdout!.setEncoding('utf8');
    p.stdout!.on('data', (data: string) => {
      output += data; let end: number;
      while ((end = output.indexOf('\n')) >= 0) {
        const line = output.slice(0, end).replace(/\r$/, ''); output = output.slice(end + 1);
        if (line === 'DONE') finish();
        else if (line.startsWith('ERR:')) finish(new Error(line.slice(4)));
      }
    });
    p.stderr!.on('data', () => {});
    p.stdin!.on('error', (error: Error) => finish(error));
    p.on('error', (error: Error) => finish(error));
    p.on('exit', () => { if (!settled) finish(new Error(L('키 입력 프로그램이 완료 전에 종료되었습니다. 자동 재시도하지 않았습니다.', 'The key input program exited before finishing. Not retried automatically.'))); });
    p.stdin!.end(job + '\n');
  });
}

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
exports.waiters = exports.NOT_IN_SESSION = exports.link = exports.CONNECTION_PROTOCOL = void 0;
exports.noteGameProcess = noteGameProcess;
exports.busyText = busyText;
exports.holdBusy = holdBusy;
exports.setBusyMsg = setBusyMsg;
exports.showBusy = showBusy;
exports.enqueue = enqueue;
exports.expectAck = expectAck;
exports.consoleLog = consoleLog;
exports.sendConsole = sendConsole;
exports.sendAndWait = sendAndWait;
exports.sendBatch = sendBatch;
exports.registerGameLink = registerGameLink;
// A-00b 3번: 게임으로 명령 보내기(콘솔/DLL 연결 큐, '게임에 입력 중' 표시, 요청 번호, ACK 대기).
// 2026-10-15 main.ts 84~156·303~304·434~435줄에서 옮김(동작 변경 없음). 여러 곳에서 바꾸는 값은 link 객체에 둔다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const diagnostics_1 = require("../diagnostics");
const keyboard_1 = require("../keyboard");
const action_1 = require("../action");
const protocol_1 = require("../protocol");
const ctx_1 = require("./ctx");
const log_router_1 = require("./log-router");
const session_queue_1 = require("../session-queue");
exports.CONNECTION_PROTOCOL = protocol_1.MOD_PROTOCOL; // 연결 규격은 protocol.ts 의 MOD_PROTOCOL 한 곳에서만 정한다(2026-10-17, 4→5 때 두 상수가 어긋났던 사고).
exports.link = {
    /** 줄 서 있거나 실행 중인 콘솔 작업 수 */
    queued: 0,
    /** 게임 로그의 req/last 보다 항상 커야 한다(작으면 게임이 stale 로 거부) */
    reqCounter: 0,
    /** HELLO 로 알게 된 연결 모드 정보 */
    runtimeMod: null,
    /** 게임 프로그램이 켜져 있는가(창 감시가 알려 줌). null = 앱이 켜진 뒤 아직 모름 */
    processRunning: null,
    /** 마지막으로 모드 줄을 받은 때(ms) */
    lastModLineAt: 0,
    /** 이번 게임 실행에서 모드 줄(SLLM:…)을 한 번이라도 받았는가 = 세이브를 불러와 게임 안에 들어가 있음.
     *  2026-10-15 21:22 튕김: 게임이 세이브를 불러오는 중(메인 메뉴·로딩)에 총독 창이 행성 목록 명령을 보냈고, 연결 DLL 이 그때 콘솔을 열다 게임이 접근 위반으로 꺼졌다.
     *  그래서 이 값이 거짓이면 어떤 명령도 보내지 않는다. 게임이 꺼지면(또는 다시 켜지면) 거짓으로 돌아간다. */
    sessionReady: false,
    epoch: 0,
};
/** 창 감시가 게임 실행 여부를 알려 준다. 꺼짐 → 켜짐이면 새 실행이라 세션 준비를 다시 기다린다. */
function noteGameProcess(running) {
    const before = exports.link.processRunning;
    if (running === before)
        return;
    exports.link.epoch++;
    // 앱이 켜질 때 게임이 이미 실행 중이면(null → 켜짐) 지금 game.log 의 줄은 이번 실행의 것(게임은 켤 때 로그를 비운다) → 받은 줄이 있으면 준비됨
    exports.link.sessionReady = running && before === null && exports.link.lastModLineAt > 0;
    exports.link.processRunning = running;
    (0, diagnostics_1.logDiagnostic)('info', 'game.process', { running, ready: exports.link.sessionReady });
}
exports.NOT_IN_SESSION = '게임이 아직 세이브를 불러오지 않았습니다(메인 메뉴·불러오는 중). 게임 안에 들어간 뒤 한 달쯤 지나고 다시 시도해 주세요. (불러오는 중에 명령을 넣으면 게임이 꺼질 수 있어 막았습니다)';
exports.waiters = new Map(); // 요청 번호 → ACK 대기
// 콘솔로 보내는 명령은 키 입력이 겹치면 안 되므로 한 번에 하나씩 순서대로 처리한다.
const queue = new session_queue_1.SessionCommandQueue(() => ({ epoch: exports.link.epoch, sid: ctx_1.ctx.curSaveId }));
// ---- '게임에 입력 중' 표시: 키보드·마우스를 만지면 명령이 어긋나므로, 입력하는 동안 화면 위에 눈에 띄게 알린다.
let busyWin = null, busyDepth = 0, busyHideTimer = null;
let busyMsg = '';
function busyText() { return busyMsg || `게임에 요청을 전달하는 중입니다${exports.link.queued > 1 ? ` (대기 ${exports.link.queued - 1}건)` : ''}`; }
/** 입력이 끝난 뒤에도 기다리는 작업(게임이 답을 로그로 쓰는 시간)을 위해 표시를 붙잡아 둔다. 돌려받은 함수를 부르면 놓는다. */
function holdBusy(msg) { busyMsg = msg; keyboard_1.inputHook.start?.(); return () => { busyMsg = ''; keyboard_1.inputHook.end?.(); }; }
function setBusyMsg(t) { busyMsg = t; if (busyDepth > 0)
    showBusy(); }
function showBusy() {
    if (busyHideTimer) {
        clearTimeout(busyHideTimer);
        busyHideTimer = null;
    }
    const area = ctx_1.ctx.gameDip ?? electron_1.screen.getPrimaryDisplay().workArea, w = 560, h = 44;
    const b = { x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + 14), width: w, height: h };
    if (!busyWin || busyWin.isDestroyed()) {
        busyWin = new electron_1.BrowserWindow({ ...b, frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, focusable: false, alwaysOnTop: true, show: false });
        busyWin.setIgnoreMouseEvents(true);
        busyWin.setAlwaysOnTop(true, 'screen-saver', 3);
        busyWin.on('closed', () => { busyWin = null; });
        void busyWin.loadURL('data:text/html;charset=utf-8,' +
            encodeURIComponent('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#t{box-sizing:border-box;height:100%;display:flex;align-items:center;justify-content:center;gap:12px;background:#06141bf2;border:1px solid #e8c872;color:#f3e3b0;font:700 14px "Malgun Gothic",sans-serif;box-shadow:0 0 18px #000a}i{width:16px;height:16px;border:3px solid #e8c87255;border-top-color:#e8c872;border-radius:50%;animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style><div id="t"><i></i><span id="m"></span></div>'));
    }
    const bw = busyWin;
    bw.setBounds(b);
    const apply = () => { bw.webContents.executeJavaScript(`document.getElementById('m').textContent=${JSON.stringify(busyText())}`).then(() => { if (!bw.isDestroyed() && busyDepth > 0)
        bw.showInactive(); }).catch(() => { }); };
    if (bw.webContents.isLoading())
        bw.webContents.once('did-finish-load', apply);
    else
        apply();
}
keyboard_1.inputHook.start = () => { busyDepth++; showBusy(); };
keyboard_1.inputHook.end = () => {
    busyDepth = Math.max(0, busyDepth - 1);
    if (busyDepth === 0 && !busyHideTimer)
        busyHideTimer = setTimeout(() => {
            busyHideTimer = null;
            if (busyDepth === 0 && exports.link.queued <= 0 && busyWin && !busyWin.isDestroyed())
                busyWin.hide();
            else if (busyDepth === 0 && exports.link.queued > 0)
                busyHideTimer = setTimeout(() => {
                    busyHideTimer = null;
                    if (busyDepth === 0 && busyWin && !busyWin.isDestroyed())
                        busyWin.hide();
                }, 1500);
        }, 600);
};
function enqueue(fn) {
    exports.link.queued++;
    const r = queue.run(fn);
    const release = () => { exports.link.queued = Math.max(0, exports.link.queued - 1); };
    void r.then(release, release);
    return r;
}
// 명령을 보내고 같은 요청 번호의 ACK 를 기다린다.
function expectAck(req) {
    return new Promise((resolve) => {
        exports.waiters.set(req, resolve);
        setTimeout(() => { if (exports.waiters.delete(req)) {
            (0, diagnostics_1.logDiagnostic)('warn', 'game.ack.timeout', { req, timeoutMs: 8000 });
            resolve('timeout');
        } }, 8000);
    });
}
/** 콘솔로 보낸 명령을 userData 의 sllm_console.log 에 남긴다(마지막 60줄). 게임이 ACK 를 안 줄 때 원인을 보려는 기록. */
function consoleLog(line) {
    (0, diagnostics_1.logDiagnostic)(/ 실패|timeout|fail/i.test(line) ? 'warn' : 'info', 'game.console.trace', { message: line });
    line = (0, diagnostics_1.sanitizeDiagnosticText)(line);
    try {
        const f = path.join(electron_1.app.getPath('userData'), 'sllm_console.log');
        let old = [];
        try {
            old = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
        }
        catch { /* 처음 */ }
        old.push(`${new Date().toISOString()} [${ctx_1.ctx.gameDate || '?'}] ${line}`.slice(0, 400));
        fs.writeFileSync(f, old.slice(-60).join('\n') + '\n', 'utf8');
    }
    catch (error) {
        (0, diagnostics_1.logDiagnostic)('warn', 'storage.write_failed', { store: 'console_log', error });
    } // 같은 줄은 위에서 진단 기록에도 남았으니 앱은 그대로 진행(F-33 B)
}
async function sendConsole(cmd) {
    if (!exports.link.sessionReady) {
        consoleLog('보내지 않음(게임 안에 들어가기 전) ' + cmd);
        throw new Error(exports.NOT_IN_SESSION);
    }
    if (exports.link.runtimeMod && exports.link.runtimeMod.protocol !== exports.CONNECTION_PROTOCOL && !cmd.includes('sllm_probe_hello'))
        throw new Error('앱과 연결 모드의 규격이 다릅니다. 양쪽을 함께 업데이트해 주세요.');
    try {
        await (0, keyboard_1.runConsoleCommand)(cmd, (t) => electron_1.clipboard.writeText(t));
        consoleLog('보냄 ' + cmd);
    }
    catch (e) {
        consoleLog('보내기 실패(' + e.message + ') ' + cmd);
        throw e;
    }
}
async function sendAndWait(build) {
    exports.link.reqCounter += 1;
    const req = exports.link.reqCounter;
    const done = expectAck(req);
    await sendConsole(build(req));
    const r = await done;
    consoleLog('응답 req=' + req + ' ' + r);
    return r;
}
// 요청 번호 n 개를 받아 한 번의 콘솔 입력으로 보내고, 모든 ACK 를 기다린다.
async function sendBatch(n, build) {
    const reqs = Array.from({ length: n }, () => ++exports.link.reqCounter);
    const dones = reqs.map(expectAck);
    await sendConsole(build(reqs));
    const rs = await Promise.all(dones);
    consoleLog('응답 req=' + reqs.join(',') + ' ' + rs.join(','));
    return rs.find((r) => r !== 'ok') ?? 'ok';
}
/** 로그 분배기에 요청 번호 학습(REQSEEN)과 ACK 처리(ACK)를 건다. 원래 main.ts watcher 안의 같은 자리였다. */
function registerGameLink(router) {
    router.on(log_router_1.SLOT.REQSEEN, 'game-link:reqSeen', (m) => {
        exports.link.reqCounter = Math.max(exports.link.reqCounter, (0, protocol_1.reqSeenIn)(m));
        exports.link.lastModLineAt = Date.now();
        if (exports.link.processRunning !== false && !exports.link.sessionReady) {
            exports.link.sessionReady = true;
            (0, diagnostics_1.logDiagnostic)('info', 'game.session_ready', { kind: m.kind });
        } // 게임이 켜진 뒤 받은 모드 줄 = 게임 안
    });
    router.on(log_router_1.SLOT.ACK, 'game-link:ack', (m) => {
        if (m.kind === 'ACK') {
            const w = exports.waiters.get(Number(m.kv.req));
            if (w) {
                exports.waiters.delete(Number(m.kv.req));
                w((0, action_1.outcomeOf)(m.fields, m.kv));
            }
        }
    });
}
//# sourceMappingURL=game-link.js.map
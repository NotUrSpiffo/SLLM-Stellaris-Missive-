"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestArchive = latestArchive;
exports.dropArchiveItem = dropArchiveItem;
exports.scanArchive = scanArchive;
exports.registerArchive = registerArchive;
// 대보관소 표본 읽기(앱 쪽, 알파 6 수집품 1단계): 로그 자리 ARCHIVE 에서 줄을 모으고, 화면이 요청하면 게임에 읽기 명령을 보낸다.
const electron_1 = require("electron");
const settings_ui_1 = require("./settings-ui");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const terminal_1 = require("./terminal");
const archive_1 = require("../archive");
const diagnostics_1 = require("../diagnostics");
const collector = new archive_1.ArchiveCollector();
const done = new Map();
let latest = null;
/** 지금 세이브의 마지막 표본 목록(없으면 null). 2단계(만찬 선물)에서 쓴다. */
function latestArchive() { return latest && latest.sid === ctx_1.ctx.curSaveId ? latest : null; }
/** 표본을 선물로 보낸 뒤 목록에서 뺀다(다시 읽기 전까지 화면이 맞도록). */
function dropArchiveItem(key) { if (latest)
    latest = { ...latest, items: latest.items.filter((i) => i.key !== key), count: Math.max(0, latest.count - 1) }; }
let busy = null;
async function scanArchive() {
    if (!ctx_1.ctx.curSaveId)
        return { ok: false, error: '게임에서 세이브를 불러온 뒤에 읽을 수 있습니다.' };
    if (busy)
        await busy.catch(() => { });
    const run = (async () => {
        const req = ++game_link_1.link.reqCounter;
        const m = await (0, terminal_1.terminalRequest)((0, archive_1.archiveCommand)(req), 'ARCHIVE_END', req);
        const snap = done.get(req);
        done.delete(req);
        if (!snap || m.kv.sid !== ctx_1.ctx.curSaveId)
            throw new Error('표본 목록의 세이브가 현재 게임과 다릅니다.');
        latest = snap;
        (0, diagnostics_1.logDiagnostic)('info', 'archive.scan', { sid: snap.sid, count: snap.count, items: snap.items.length, unknown: snap.unknown.length, exhibits: snap.exhibits });
        return snap;
    })();
    busy = run;
    try {
        return { ok: true, snapshot: await run };
    }
    catch (e) {
        const msg = String(e.message || e);
        (0, diagnostics_1.logDiagnostic)('warn', 'archive.scan_failed', { error: msg });
        return { ok: false, error: (msg.includes('게임 응답이 없습니다') || /no response from the game/i.test(msg)) ? (0, settings_ui_1.pick)('게임이 응답하지 않았습니다. 최신 SLLM 연결 모드(표본 읽기 포함)를 쓰고 있는지 확인해 주세요.', 'The game did not respond. Check that you are using the latest SLLM link mod (with specimen reading).') : msg };
    }
    finally {
        if (busy === run)
            busy = null;
    }
}
function registerArchive(router) {
    router.on(log_router_1.SLOT.ARCHIVE, 'archive:scan', (m) => {
        if (!m.kind.startsWith('ARCHIVE'))
            return;
        const snap = collector.feed(m);
        if (snap) {
            done.set(snap.req, snap);
            if (done.size > 8)
                done.delete(done.keys().next().value);
            terminal_1.terminalReplies.get('ARCHIVE_END:' + snap.req)?.(m);
        }
    });
    electron_1.ipcMain.handle('archiveState', async () => ({ snapshot: latestArchive() }));
    electron_1.ipcMain.handle('archiveScan', async () => scanArchive());
}
//# sourceMappingURL=archive-app.js.map
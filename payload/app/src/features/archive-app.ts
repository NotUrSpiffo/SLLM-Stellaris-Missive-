// 대보관소 표본 읽기(앱 쪽, 알파 6 수집품 1단계): 로그 자리 ARCHIVE 에서 줄을 모으고, 화면이 요청하면 게임에 읽기 명령을 보낸다.
import { ipcMain } from 'electron';
import { pick } from './settings-ui';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { terminalRequest, terminalReplies } from './terminal';
import { ArchiveCollector, archiveCommand, type ArchiveSnapshot } from '../archive';
import { logDiagnostic } from '../diagnostics';

const collector = new ArchiveCollector();
const done = new Map<number, ArchiveSnapshot>();
let latest: ArchiveSnapshot | null = null;
/** 지금 세이브의 마지막 표본 목록(없으면 null). 2단계(만찬 선물)에서 쓴다. */
export function latestArchive(): ArchiveSnapshot | null { return latest && latest.sid === ctx.curSaveId ? latest : null; }
/** 표본을 선물로 보낸 뒤 목록에서 뺀다(다시 읽기 전까지 화면이 맞도록). */
export function dropArchiveItem(key: string): void { if (latest) latest = { ...latest, items: latest.items.filter((i) => i.key !== key), count: Math.max(0, latest.count - 1) }; }
let busy: Promise<unknown> | null = null;

export async function scanArchive(): Promise<{ ok: boolean; error?: string; snapshot?: ArchiveSnapshot }> {
  if (!ctx.curSaveId) return { ok: false, error: '게임에서 세이브를 불러온 뒤에 읽을 수 있습니다.' };
  if (busy) await busy.catch(() => {});
  const run = (async () => {
    const req = ++link.reqCounter;
    const m = await terminalRequest(archiveCommand(req), 'ARCHIVE_END', req);
    const snap = done.get(req); done.delete(req);
    if (!snap || m.kv.sid !== ctx.curSaveId) throw new Error('표본 목록의 세이브가 현재 게임과 다릅니다.');
    latest = snap;
    logDiagnostic('info', 'archive.scan', { sid: snap.sid, count: snap.count, items: snap.items.length, unknown: snap.unknown.length, exhibits: snap.exhibits });
    return snap;
  })();
  busy = run;
  try { return { ok: true, snapshot: await run }; }
  catch (e) { const msg = String((e as Error).message || e); logDiagnostic('warn', 'archive.scan_failed', { error: msg }); return { ok: false, error: (msg.includes('게임 응답이 없습니다') || /no response from the game/i.test(msg)) ? pick('게임이 응답하지 않았습니다. 최신 SLLM 연결 모드(표본 읽기 포함)를 쓰고 있는지 확인해 주세요.', 'The game did not respond. Check that you are using the latest SLLM link mod (with specimen reading).') : msg }; }
  finally { if (busy === run) busy = null; }
}

export function registerArchive(router: LogRouter): void {
  router.on(SLOT.ARCHIVE, 'archive:scan', (m) => {
    if (!m.kind.startsWith('ARCHIVE')) return;
    const snap = collector.feed(m);
    if (snap) { done.set(snap.req, snap); if (done.size > 8) done.delete(done.keys().next().value as number); terminalReplies.get('ARCHIVE_END:' + snap.req)?.(m); }
  });
  ipcMain.handle('archiveState', async () => ({ snapshot: latestArchive() }));
  ipcMain.handle('archiveScan', async () => scanArchive());
}

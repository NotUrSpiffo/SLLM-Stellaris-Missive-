// A-00b 6번: 통신 단말기(앱 쪽) — 연락처 목록(CONTACT_*), 단말기 명령을 보내고 끝 줄(KIND:req)을 기다리는 terminalRequest,
// 상대 연결(dialTerminal: 게임에 대화 창을 열게 함), IPC 3개. 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// HELLO·ETHIC_END 줄도 terminalReplies 로 응답을 받는다(그 처리는 main.ts 로그 자리에 남아 있음).
import { ipcMain } from 'electron';
import { logDiagnostic } from '../diagnostics';
import { TerminalContacts } from '../terminal-contacts';
import type { SllmMessage } from '../protocol';
import { enqueue, sendConsole, link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { pick } from './settings-ui';

export const terminal = new TerminalContacts();
export const terminalReplies = new Map<string, (m: SllmMessage) => void>();
export const terminalView = () => ({ sid: terminal.sid, date: terminal.date, items: terminal.items.filter(c=>contactAllowed(c.type)).map(c=>({ ...c, talkOnly: !ctx.modCompatibility.policy(c.type).actions })) }); // talkOnly: 대화 전용(게임 행동 없음, 알파 8)
export async function terminalRequest(effect: string, end: string, req: number): Promise<SllmMessage> {
  const key = end + ':' + req;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectResponse!: (e: Error) => void;
  const response = new Promise<SllmMessage>((resolve, reject) => {
    terminalReplies.set(key, resolve);
    rejectResponse = reject;
  });
  // Observe a possible timeout even while another console command is still queued.
  void response.catch(() => {});
  try { await enqueue(async () => {
    timer = setTimeout(() => { logDiagnostic('warn','game.response.timeout',{req,end,timeoutMs:12000});terminalReplies.delete(key); rejectResponse(new Error(pick('게임 응답이 없습니다. 게임과 최신 SLLM 연결 모드를 확인해 주세요.', 'No response from the game. Check the game and the latest SLLM link mod.'))); }, 12000);
    await sendConsole(effect);
  }); return await response; }
  finally { if (timer) clearTimeout(timer); terminalReplies.delete(key); }
}
export function contactAllowed(type: string): boolean { return ctx.modCompatibility.policy(type).contact; }

export const dialTerminal = async (a: { sid?: unknown; idx?: unknown }) => {
  const idx = Number(a?.idx);
  if (!ctx.gameRunning) return { ok: false, error: pick('게임이 켜져 있어야 통신할 수 있습니다.', 'The game must be running to communicate.') };
  if (a?.sid !== ctx.curSaveId || terminal.sid !== ctx.curSaveId || !Number.isSafeInteger(idx) || !terminal.items.some(c => c.idx === idx && contactAllowed(c.type))) return { ok: false, error: pick('현재 세이브의 연락처를 다시 갱신해 주세요.', 'Please refresh the current save\'s contacts.') };
  if (ctx.pend || ctx.pending) return { ok: false, error: pick('진행 중인 통신과 제안을 마친 뒤 연결해 주세요.', 'Finish the ongoing call and proposals before connecting.') };
  const req = ++link.reqCounter;
  try {
    const m = await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_terminal_dial = { TID = ' + idx + ' REQ = ' + req + ' } }', 'DIAL_END', req);
    if (m.kv.sid !== ctx.curSaveId || Number(m.kv.ok) !== 1) return { ok: false, error: pick('상대와 통신할 수 없습니다. 연락처를 다시 갱신해 주세요.', 'Cannot reach them. Please refresh the contacts.') };
    if(a?.sid!==ctx.curSaveId)return {ok:false,error:pick('세이브가 바뀌었습니다.', 'The save changed.')};
    await ctx.refreshEthics(idx); if(a?.sid!==ctx.curSaveId)return {ok:false,error:pick('세이브가 바뀌었습니다.', 'The save changed.')};
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
};

export function registerTerminal(router: LogRouter): void {
  router.on(SLOT.TERMINAL, 'terminal:feed', (m: SllmMessage) => {
    const contactsDone = terminal.feed(m);
    if (contactsDone) ctx.toUi('contacts', terminalView());
    if ((m.kind === 'CONTACT_END' && contactsDone) || m.kind === 'DIAL_END') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
  ipcMain.handle('contactsList', async () => terminalView());
  ipcMain.handle('contactsRefresh', async () => {
    if (!ctx.gameRunning) return { ok: false, error: pick('게임이 켜져 있어야 목록을 갱신할 수 있습니다.', 'The game must be running to refresh the list.') };
    const req = ++link.reqCounter;
    try { await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req); return { ok: true, state: terminalView() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('contactDial', async (_e, a: { sid?: unknown; idx?: unknown }) => {
    if (ctx.mailReplyBusy) return { ok: false, error: pick('편지 답장을 연결 중입니다.', 'Connecting the letter reply.') };
    return dialTerminal(a);
  });
}

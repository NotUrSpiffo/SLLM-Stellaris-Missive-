// 은하 연대기 책 내보내기(2026-10-17): 연대기 칸의 「책으로 내보내기」 버튼. HTML 또는 PDF 로 저장한다.
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { buildBook, bookTitle, type BookInput } from '../chronbook';
import { chron } from './chronicle-app';
import { issues } from './media';
import { pick } from './settings-ui';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const safeName = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'chronicle';

export function bookInput(lang: 'ko' | 'en'): BookInput | null {
  const sid = ctx.curSaveId; if (!sid) return null;
  const gm = ctx.govMem();
  const groups = chron().groups(sid, (all) => gm.split(sid, all).own).map((g) => ({ idx: g.idx, name: g.name, items: g.items.map((e) => ({ date: e.date, text: e.text, ...(e.ruler ? { ruler: e.ruler } : {}) })) }));
  const iss = gm.split(sid, issues().list(sid)).own.map((i) => ({ date: i.date, headline: i.headline, articles: i.articles, briefs: i.briefs ?? [], ...(i.extra ? { extra: true } : {}) }));
  return { lang, playerIdx: ctx.playerIdx, groups, issues: iss, made: ctx.gameDate || '' };
}

/** 숨은 창에 HTML 을 띄워 PDF 로 찍는다. */
async function toPdf(html: string): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `sllm-book-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
  try {
    await w.loadFile(tmp);
    return await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
  } finally { try { w.destroy(); } catch { /* 이미 닫힘 */ } try { fs.unlinkSync(tmp); } catch { /* 지우지 못해도 무방 */ } }
}

export function registerChronBook(): void {
  ipcMain.handle('chronBookExport', async (event, langArg: unknown) => {
    try {
      const lang = langArg === 'en' ? 'en' : 'ko';
      const inp = bookInput(lang);
      if (!inp) return { ok: false, error: pick('아직 불러온 세이브가 없습니다.', 'No save is loaded yet.') };
      const html = buildBook(inp);
      if (!html) return { ok: false, error: pick('아직 연대기에 기록이 없습니다.', 'There is nothing in the chronicle yet.') };
      const owner = BrowserWindow.fromWebContents(event.sender);
      const opts = { title: pick('연대기를 책으로 내보내기', 'Export chronicle as a book'), defaultPath: path.join(app.getPath('documents'), safeName(bookTitle(inp)) + '.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }, { name: 'HTML', extensions: ['html'] }] };
      const r = owner ? await dialog.showSaveDialog(owner, opts) : await dialog.showSaveDialog(opts);
      if (r.canceled || !r.filePath) return { ok: false, canceled: true };
      let file = r.filePath; const ext = path.extname(file).toLowerCase();
      if (ext !== '.pdf' && ext !== '.html' && ext !== '.htm') file += '.pdf';
      if (/\.html?$/i.test(file)) fs.writeFileSync(file, html, 'utf8');
      else fs.writeFileSync(file, await toPdf(html));
      return { ok: true, path: file };
    } catch (e) { return { ok: false, error: msg(e) }; }
  });
}

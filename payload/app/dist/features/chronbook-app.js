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
exports.bookInput = bookInput;
exports.registerChronBook = registerChronBook;
// 은하 연대기 책 내보내기(2026-10-17): 연대기 칸의 「책으로 내보내기」 버튼. HTML 또는 PDF 로 저장한다.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const chronbook_1 = require("../chronbook");
const chronicle_app_1 = require("./chronicle-app");
const media_1 = require("./media");
const settings_ui_1 = require("./settings-ui");
const msg = (e) => (e instanceof Error ? e.message : String(e));
const safeName = (s) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'chronicle';
function bookInput(lang) {
    const sid = ctx_1.ctx.curSaveId;
    if (!sid)
        return null;
    const gm = ctx_1.ctx.govMem();
    const groups = (0, chronicle_app_1.chron)().groups(sid, (all) => gm.split(sid, all).own).map((g) => ({ idx: g.idx, name: g.name, items: g.items.map((e) => ({ date: e.date, text: e.text, ...(e.ruler ? { ruler: e.ruler } : {}) })) }));
    const iss = gm.split(sid, (0, media_1.issues)().list(sid)).own.map((i) => ({ date: i.date, headline: i.headline, articles: i.articles, briefs: i.briefs ?? [], ...(i.extra ? { extra: true } : {}) }));
    return { lang, playerIdx: ctx_1.ctx.playerIdx, groups, issues: iss, made: ctx_1.ctx.gameDate || '' };
}
/** 숨은 창에 HTML 을 띄워 PDF 로 찍는다. */
async function toPdf(html) {
    const tmp = path.join(os.tmpdir(), `sllm-book-${process.pid}-${Date.now()}.html`);
    fs.writeFileSync(tmp, html, 'utf8');
    const w = new electron_1.BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
    try {
        await w.loadFile(tmp);
        return await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    }
    finally {
        try {
            w.destroy();
        }
        catch { /* 이미 닫힘 */ }
        try {
            fs.unlinkSync(tmp);
        }
        catch { /* 지우지 못해도 무방 */ }
    }
}
function registerChronBook() {
    electron_1.ipcMain.handle('chronBookExport', async (event, langArg) => {
        try {
            const lang = langArg === 'en' ? 'en' : 'ko';
            const inp = bookInput(lang);
            if (!inp)
                return { ok: false, error: (0, settings_ui_1.pick)('아직 불러온 세이브가 없습니다.', 'No save is loaded yet.') };
            const html = (0, chronbook_1.buildBook)(inp);
            if (!html)
                return { ok: false, error: (0, settings_ui_1.pick)('아직 연대기에 기록이 없습니다.', 'There is nothing in the chronicle yet.') };
            const owner = electron_1.BrowserWindow.fromWebContents(event.sender);
            const opts = { title: (0, settings_ui_1.pick)('연대기를 책으로 내보내기', 'Export chronicle as a book'), defaultPath: path.join(electron_1.app.getPath('documents'), safeName((0, chronbook_1.bookTitle)(inp)) + '.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }, { name: 'HTML', extensions: ['html'] }] };
            const r = owner ? await electron_1.dialog.showSaveDialog(owner, opts) : await electron_1.dialog.showSaveDialog(opts);
            if (r.canceled || !r.filePath)
                return { ok: false, canceled: true };
            let file = r.filePath;
            const ext = path.extname(file).toLowerCase();
            if (ext !== '.pdf' && ext !== '.html' && ext !== '.htm')
                file += '.pdf';
            if (/\.html?$/i.test(file))
                fs.writeFileSync(file, html, 'utf8');
            else
                fs.writeFileSync(file, await toPdf(html));
            return { ok: true, path: file };
        }
        catch (e) {
            return { ok: false, error: msg(e) };
        }
    });
}
//# sourceMappingURL=chronbook-app.js.map
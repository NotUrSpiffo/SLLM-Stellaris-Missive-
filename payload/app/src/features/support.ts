// A-00b 4번: 버그 신고 로그 묶음(supportPrepare·supportPreview·supportExport·supportReveal).
// 2026-10-15 main.ts whenReady 안에서 옮김(동작 변경 없음). 빌드 지문은 dist 최상위 파일(main.js 등)이라 '..'을 붙였다.
import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SupportBundles } from '../support-bundle';
import { logDiagnostic, sanitizeDiagnosticText } from '../diagnostics';
import { resolveEnvironment, environmentTried, environmentHints } from '../environment-paths';
import { settings, getKey } from '../app/settings';
import { link, CONNECTION_PROTOCOL } from '../app/game-link';
import { radio } from './radio-app';
import { ctx } from '../app/ctx';
import { pick as L } from './settings-ui';

const supportBundles=new SupportBundles(()=>app.getPath('userData'),()=>ctx.GAME_LOG,()=>{
  const active=settings.aiConns.find(c=>c.id===settings.aiActive);let endpoint='';try{endpoint=active?new URL(active.baseUrl).origin:'';}catch{}
  const buildHashes=Object.fromEntries(['main.js','aiclient.js','diagnostics.js','support-bundle.js','mod-compat.js'].map(file=>{try{return [file,createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')];}catch{return [file,'unavailable'];}}));
  const modHashes = Object.fromEntries(
    [
      'descriptor.mod',
      'common/scripted_effects/sllm_probe_terminal.txt',
      'common/scripted_effects/sllm_probe_speech.txt',
      'common/scripted_effects/sllm_probe_compat.txt',
      'common/on_actions/sllm_probe_radio_on_actions.txt',
    ].map((file) => {
      try {
        return [
          file,
          ctx.MOD_DIR
            ? createHash('sha256')
                .update(fs.readFileSync(path.join(ctx.MOD_DIR, file)))
                .digest('hex')
            : 'unavailable',
        ];
      } catch {
        return [file, 'unavailable'];
      }
    }),
  );
  return {
    buildHashes,
    modHashes,
    displays: screen
      .getAllDisplays()
      .map((d) => ({ id: d.id, scale: d.scaleFactor, bounds: d.bounds, workArea: d.workArea, rotation: d.rotation })),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      packaged: app.isPackaged,
      locale: app.getLocale(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    connection: { protocol: CONNECTION_PROTOCOL, runtime: link.runtimeMod },
    environment: (() => { const e = resolveEnvironment(settings); return { ...e, hints: environmentHints(e), tried: environmentTried() }; })(),
    watcher: ctx.watcher.status(),
    game: {
      running: ctx.gameRunning,
      front: ctx.gameFront,
      date: ctx.gameDate,
      sid: ctx.curSaveId,
      queuedConsole: link.queued,
      contacts: ctx.terminal.items.length,
      lastSignal: ctx.lastGameSignal,
      signalCounts: ctx.gameSignalCounts,
    },
    ai: { mode: settings.aiMode, provider: active?.provider, model: active?.model, endpoint },
    preferences: {
      language: settings.language,
      aiLanguage: settings.aiLanguage,
      devMode: settings.devMode,
      forceOverlay: settings.forceOverlay,
      councilMode: settings.councilMode,
      councilTurns: settings.councilTurns,
      speechTurns: settings.speechTurns,
      devCouncilVote: settings.devCouncilVote,
      devCouncilPercent: settings.devCouncilPercent,
      devCouncilNoAi: settings.devCouncilNoAi,
      mailEnabled: settings.mailEnabled,
      radioOn: radio.on,
      uiScale: settings.uiScale,
      autoScale: settings.autoScale,
      dock: settings.dock,
    },
    compatibility: ctx.modCompatibility.diagnostics(),
    save: ctx.flagProv.diagnostics(),
  };
});

export function registerSupport(): void {
  ipcMain.handle('supportPrepare', async (_event, input: unknown) => {
    try {
      for (const c of settings.aiConns) getKey(c.id);
      const report = supportBundles.prepare(input && typeof input === 'object' ? input : {});
      logDiagnostic('info', 'support.prepared', {
        reportId: report.id,
        files: report.files.map((f) => ({ name: f.name, bytes: f.bytes })),
        warnings: report.warnings,
      });
      return { ok: true, report };
    } catch (error) {
      logDiagnostic('error', 'support.prepare_failed', { error });
      return { ok: false, error: sanitizeDiagnosticText((error as Error).message) };
    }
  });
  ipcMain.handle('supportPreview',async(_event,id:unknown,name:unknown)=>{try{return {ok:true,text:supportBundles.preview(String(id),String(name))};}catch(error){return {ok:false,error:sanitizeDiagnosticText((error as Error).message)};}});
  ipcMain.handle('supportExport',async(event,id:unknown)=>{
    const report=supportBundles.get(String(id));if(!report)return {ok:false,error:L('미리보기가 만료됐습니다. 로그 묶음을 다시 만들어 주세요.','The preview expired. Create the log bundle again.')};
    const options={title:L('버그 신고 로그 ZIP 저장','Save bug-report log ZIP'),defaultPath:path.join(app.getPath('downloads'),'SLLM-Logs-'+report.created.replace(/[:.]/g,'-')+'-'+report.id.slice(0,8)+'.zip'),filters:[{name:'ZIP',extensions:['zip']}]},owner=BrowserWindow.fromWebContents(event.sender);
    const result=owner?await dialog.showSaveDialog(owner,options):await dialog.showSaveDialog(options);if(result.canceled||!result.filePath)return {ok:false,canceled:true};
    try {
      supportBundles.export(report.id, result.filePath);
      logDiagnostic('info', 'support.exported', { reportId: report.id, path: result.filePath });
      return { ok: true, path: result.filePath };
    } catch (error) {
      logDiagnostic('error', 'support.export_failed', { error });
      return { ok: false, error: sanitizeDiagnosticText((error as Error).message) };
    }
  });
  ipcMain.handle('supportReveal',async(_event,id:unknown)=>{const file=supportBundles.exported(String(id));if(!file)return false;shell.showItemInFolder(file);return true;});
}

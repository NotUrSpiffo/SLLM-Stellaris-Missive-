// A-00b 4번: 경로 설정(게임 사용자 폴더·연결 모드 폴더·세이브 폴더·게임 설치 폴더)과 모드 호환 팩 화면의 IPC 12개.
// 2026-10-15 main.ts whenReady 안에서 옮김(동작 변경 없음). environmentInfo()는 HELLO 처리에서도 쓴다.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { resolveEnvironment, environmentSaveRoots, normalizeUserDir, normalizeModDir, normalizeGameDir, normalizeSaveDir, environmentHints } from '../environment-paths';
import { findGameDir } from '../flags';
import { redactKey } from '../aiclient';
import { settings, saveSettings } from '../app/settings';
import { link, CONNECTION_PROTOCOL } from '../app/game-link';
import { ctx } from '../app/ctx';
import { versionCheck, descriptorVersion } from '../version-check';
import { readDisplayMode, fixDisplayMode, DISPLAY_HINT_KO } from '../game-display';
import { pick as L } from './settings-ui';

// ---- 경로(세이브 폴더 / 게임 폴더) ----
export const environmentInfo = () => {
  const env = resolveEnvironment(settings);
  let latestSave: string | null = null; try { latestSave = ctx.flagProv.latestSave(); } catch { /* no saves */ }
  let fileVer: string | null = null; try { if (env.mod) fileVer = descriptorVersion(fs.readFileSync(path.join(env.mod, 'descriptor.mod'), 'utf8')); } catch { /* descriptor.mod 없음 */ }
  const versionInfo = versionCheck(app.getVersion(), link.runtimeMod?.version, fileVer);
  const display = env.userExists ? readDisplayMode(env.userDir) : null; // 게임 화면 모드(독점 전체화면이면 경고)
  const hints = environmentHints(env); if (display === 'exclusive') hints.push({ level: 'warn', text: DISPLAY_HINT_KO });
  return { ...env, hints, display, versionCheck: versionInfo, setupDone: settings.setupDone, latestSave, appVersion: app.getVersion(), protocol: CONNECTION_PROTOCOL, runtime: link.runtimeMod, note: null as string | null };
};
export const pathsInfo = () => {
  let latest: string | null = null;
  try { latest = ctx.flagProv.latestSave(); } catch { /* 없음 */ }
  return { saveDir: settings.saveDir, gameDir: settings.gameDir, latestSave: latest, gameFound: ctx.flagProv.game(), autoGame: findGameDir() };
};

export function registerEnvironment(): void {
  ipcMain.handle('compatibilityInfo', async () => {
    if (!settings.devMode) return { ok: false, error: L('개발자 모드에서 확인할 수 있습니다.', 'Available in developer mode.') };
    return {
      ok: true,
      ...ctx.modCompatibility.diagnostics(),
      save: ctx.flagProv.diagnostics(),
      contacts: ctx.terminal.items.map((c) => ({
        ...c,
        ...ctx.modCompatibility.policy(c.type),
        ethics: ctx.adoptedEthics(c.idx),
        lore: ctx.modCompatibility.empire(c.name)?.lore
          ? 'compatibility override'
          : ctx.flagProv.bioFor(c.idx)
            ? 'save species biography'
            : ctx.modCompatibility.lore(c.name)?.source || 'unknown',
        flag: ctx.flagUrlFor(c.idx) ? 'available' : 'missing',
      })),
      player: { idx: ctx.playerIdx, ethics: ctx.adoptedEthics(ctx.playerIdx) },
    };
  });
  ipcMain.handle('compatibilityReload', async () => {
    if (!settings.devMode) return { ok: false };
    ctx.modCompatibility.invalidate();
    ctx.modCompatibility.clearLive();
    ctx.flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: environmentSaveRoots(settings.userDir) });
    ctx.toUi('contacts', ctx.terminalView());
    if (ctx.talk) {
      ctx.talk = ctx.withLore(ctx.talk);
      ctx.toUi('talk', ctx.talk);
    }
    return { ok: true };
  });
  ipcMain.handle('compatibilityOpen', async () => {
    if (!settings.devMode) return { ok: false };
    const folder = path.join(app.getPath('userData'), 'compatibility');
    fs.mkdirSync(folder, { recursive: true });
    const example = path.join(folder, 'example.json.disabled');
    if (!fs.existsSync(example)) fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', 'compatibility-example.json'), example);
    const readme = path.join(folder, 'README_KO.md');
    if (!fs.existsSync(readme)) fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', 'compatibility-readme-ko.md'), readme);
    const giga = path.join(folder, 'gigastructures.json.disabled');
    if (!fs.existsSync(giga)) fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', 'compatibility-gigastructures.json'), giga);
    const err = await shell.openPath(folder);
    return { ok: !err, error: err };
  });
  ipcMain.handle('environmentInfo', async () => environmentInfo());
  // 게임 화면 모드를 테두리 없는 전체화면으로(2026-10-18). 게임이 켜져 있으면 끌 때 설정을 덮어쓰므로 꺼져 있을 때만.
  ipcMain.handle('displayFix', async () => {
    if (ctx.gameRunning) return { ...environmentInfo(), note: L('게임이 켜져 있습니다. 스텔라리스를 끈 뒤 다시 눌러 주세요(켜진 채로 바꾸면 게임이 종료할 때 원래대로 덮어씁니다).', 'The game is running. Close Stellaris and press again (if changed while running, the game overwrites it on exit).') };
    const env = resolveEnvironment(settings);
    try { const n = fixDisplayMode(env.userDir); return { ...environmentInfo(), note: n ? L('게임 화면 모드를 테두리 없는 전체화면으로 바꿨습니다. 다음에 게임을 켜면 적용됩니다(원본은 settings.txt.sllm-bak).', 'Switched the game display mode to borderless fullscreen. It applies the next time you start the game (original saved as settings.txt.sllm-bak).') : L('이미 테두리 없는 전체화면입니다.', 'Already in borderless fullscreen.') }; }
    catch (e) { return { ...environmentInfo(), note: L('게임 설정 파일을 고치지 못했습니다: ', 'Could not edit the game settings file: ') + (e as Error).message }; }
  });
  ipcMain.handle('environmentPick', async (_e, kind: unknown) => {
    if (ctx.pend || ctx.pending) return { ...environmentInfo(), note: L('진행 중인 통신과 제안을 마친 뒤 경로를 바꿔 주세요.', 'Finish the ongoing comms and proposals before changing paths.') };
    if (kind !== 'user' && kind !== 'mod') return { ...environmentInfo(), note: L('잘못된 경로 종류입니다.', 'Invalid path type.') };
    const r = await dialog.showOpenDialog(ctx.win!, { title: kind === 'user' ? L('Stellaris 게임 사용자 폴더 선택 (logs / save games)', 'Choose the Stellaris user folder (logs / save games)') : L('SLLM 연결 모드 폴더 선택', 'Choose the SLLM link mod folder'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return environmentInfo();
    const picked = r.filePaths[0];
    const dir = kind === 'mod' ? normalizeModDir(picked) : normalizeUserDir(picked);
    if (!dir) return { ...environmentInfo(), note: kind === 'mod' ? L('고른 폴더와 그 위·아래 폴더에서 SLLM 연결 모드 파일(common\\scripted_effects\\sllm_probe_effects.txt)을 찾지 못했습니다. 스팀 창작마당 구독을 마쳤다면 자동으로 찾으니 [자동 찾기]를 눌러 보세요.', 'Could not find the SLLM link mod file (common\\scripted_effects\\sllm_probe_effects.txt) in the chosen folder or above/below it. If you subscribed on the Steam Workshop it is found automatically — try [Auto-detect].') : L('고른 폴더 근처에서 Stellaris 사용자 폴더(logs·save games·settings.txt가 있는 곳)를 찾지 못했습니다. 보통 "문서\\Paradox Interactive\\Stellaris"입니다. 게임을 한 번도 실행하지 않았다면 먼저 실행해 주세요.', 'Could not find the Stellaris user folder (with logs, save games and settings.txt) near the chosen folder. It is usually "Documents\\Paradox Interactive\\Stellaris". If you have never run the game, run it first.') };
    const moved = path.resolve(picked) !== dir;
    if (kind === 'user') settings.userDir = dir; else settings.modDir = dir;
    saveSettings(); ctx.applyEnvironment(); ctx.toUi('images', ctx.imageState()); return moved ? { ...environmentInfo(), note: L('고른 폴더 대신 올바른 폴더를 찾아 사용합니다: ', 'Using the correct folder found instead of the chosen one: ') + path.basename(dir) } : environmentInfo();
  });
  ipcMain.handle('environmentReset', async () => { if (ctx.pend || ctx.pending) return { ...environmentInfo(), note: L('진행 중인 통신과 제안을 마친 뒤 경로를 바꿔 주세요.', 'Finish the ongoing comms and proposals before changing paths.') }; settings.userDir = null; settings.modDir = null; saveSettings(); ctx.applyEnvironment(); return environmentInfo(); });
  ipcMain.handle('environmentDone', async () => { settings.setupDone = true; saveSettings(); for(const w of BrowserWindow.getAllWindows())w.webContents.send('environment',environmentInfo()); return true; });
  ipcMain.handle('environmentCheck', async () => {
    const notes: string[] = [];
    if (!ctx.gameRunning) notes.push(L('게임을 실행하고 세이브를 불러온 뒤 다시 확인하세요.', 'Start the game, load a save, then check again.'));
    else {
      const req = ++link.reqCounter;
      try { await ctx.terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_hello = { REQ = ' + req + ' } }', 'HELLO', req); notes.push(link.runtimeMod?.protocol === CONNECTION_PROTOCOL ? L('게임 연결 규격 일치', 'Game link protocol matches') : L('연결 모드 업데이트 필요', 'Link mod needs an update')); }
      catch (e) { notes.push((e as Error).message); }
    }
    if (settings.aiMode === 'player2') { try { await ctx.p2.health(); notes.push(L('Player2 앱 응답 확인', 'Player2 app responded')); } catch (e) { notes.push(redactKey((e as Error).message)); } }
    else notes.push(L('개인 API 연결 선택됨. AI 연결 탭에서 응답 시험을 실행하세요.', 'Personal API connection selected. Run the response test in the AI connection tab.'));
    return { ...environmentInfo(), note: notes.join(' · ') };
  });
  ipcMain.handle('pathsInfo', async () => pathsInfo());
  ipcMain.handle('pickSaveDir', async () => {
    const r = await dialog.showOpenDialog(ctx.win!, { title: L('스텔라리스 세이브 폴더 고르기 (save games)', 'Choose the Stellaris save folder (save games)'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ...pathsInfo(), note: null };
    const dir = normalizeSaveDir(r.filePaths[0]);
    if (!dir) return { ...pathsInfo(), note: L('이 폴더 근처에서 .sav 파일을 찾지 못했습니다. 세이브를 한 번 저장한 뒤 "save games" 폴더(또는 그 안의 제국 폴더)를 골라 주세요.', 'No .sav files near this folder. Save once, then choose the "save games" folder (or an empire folder inside it).') };
    settings.saveDir = dir; saveSettings(); ctx.flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: environmentSaveRoots(settings.userDir) });
    return { ...pathsInfo(), note: null };
  });
  ipcMain.handle('pickGameDir', async () => {
    const r = await dialog.showOpenDialog(ctx.win!, { title: L('스텔라리스 설치 폴더 고르기 (Stellaris)', 'Choose the Stellaris install folder (Stellaris)'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ...pathsInfo(), note: null };
    const dir = normalizeGameDir(r.filePaths[0]);
    if (!dir) return { ...pathsInfo(), note: L('이 폴더 근처에서 flags\\colors.txt 를 찾지 못했습니다. 게임이 설치된 "Stellaris" 폴더(또는 Steam 라이브러리 폴더)를 골라 주세요.', 'Could not find flags\\colors.txt near this folder. Choose the "Stellaris" folder where the game is installed (or the Steam library folder).') };
    settings.gameDir = dir; saveSettings(); ctx.flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: environmentSaveRoots(settings.userDir) });
    return { ...pathsInfo(), note: null };
  });
  ipcMain.handle('clearPaths', async (_e, which: unknown) => {
    if (which === 'save' || which === 'all') settings.saveDir = null;
    if (which === 'game' || which === 'all') settings.gameDir = null;
    saveSettings(); ctx.flagProv.configure({ saveDir: settings.saveDir, gameDir: settings.gameDir, roots: environmentSaveRoots(settings.userDir) });
    return { ...pathsInfo(), note: null };
  });
}

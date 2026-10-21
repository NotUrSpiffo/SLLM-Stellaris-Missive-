// 창작마당 모드로 받은 앱 업데이트 알림(2026-10-18). 스팀이 구독 모드를 새로 받으면 그 안의 sllm_app_update/ 를 확인해
// "새 버전 … 업데이트할까요?" 를 묻고, 누르면 바뀐 파일만 교체한 뒤 앱을 다시 시작한다. 판정·교체는 ../app-update-core.ts.
import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { checkForUpdate, applyUpdate, PUBLIC_KEY_FILE, UpdateCheck } from '../app-update-core';
import { connectionWorkshopCandidates, userCandidates } from '../environment-paths';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { wins } from './windows';

const FIRST_CHECK_MS = 8000, RECHECK_MS = 20 * 60 * 1000;
let asked = '', busy = false; // 한 번 "나중에" 를 누른 버전은 앱을 다시 켤 때까지 묻지 않는다

/** 설치기로 설치한 앱에서만 켠다(개발 폴더는 bat 가 빌드·동기화한다). SLLM_UPDATE_DEV=1 이면 개발 폴더에서도 시험 가능. */
function enabled(appDir: string): boolean {
  if (!fs.existsSync(path.join(appDir, PUBLIC_KEY_FILE))) return false;
  return process.env.SLLM_UPDATE_DEV === '1' || fs.existsSync(path.join(appDir, 'game-install-path.txt')) || fs.existsSync(path.join(appDir, 'SLLM-tester-installed.txt'));
}
/** 창작마당 구독본 + 문서 mod 폴더의 업로드 원본(sllm_missive). */
export function updateModDirs(): string[] {
  return [...connectionWorkshopCandidates(), ...userCandidates().filter(Boolean).map((u) => path.join(u, 'mod', 'sllm_missive'))];
}

async function ask(r: Extract<UpdateCheck, { kind: 'available' | 'needs_installer' }>): Promise<void> {
  const cur = app.getVersion(), ver = r.version, parent = wins.win && !wins.win.isDestroyed() ? wins.win : undefined;
  const opts = (o: Electron.MessageBoxOptions) => parent ? dialog.showMessageBox(parent, o) : dialog.showMessageBox(o);
  if (r.kind === 'needs_installer') {
    await opts({ type: 'info', title: pick('SLLM 업데이트', 'SLLM update'), buttons: [pick('확인', 'OK')],
      message: pick(`새 버전 ${ver}이(가) 나왔습니다(지금 ${cur}).`, `A new version ${ver} is available (current ${cur}).`),
      detail: pick('이번 업데이트는 게임 연결 DLL이 바뀌어 앱 안에서 업데이트할 수 없습니다. 새 설치 프로그램을 받아 설치해 주세요. 대화 기록과 설정은 그대로 남습니다.',
        'This update changes the game connection DLL, so it cannot be applied inside the app. Please download and run the new installer. Your chat history and settings are kept.') });
    return;
  }
  const res = await opts({ type: 'question', title: pick('SLLM 업데이트', 'SLLM update'), buttons: [pick('업데이트', 'Update'), pick('나중에', 'Later')], defaultId: 0, cancelId: 1,
    message: pick(`새 버전 ${ver}을(를) 설치할 수 있습니다(지금 ${cur}).`, `A new version ${ver} can be installed (current ${cur}).`),
    detail: pick('창작마당 모드와 함께 받은 앱 업데이트입니다. 업데이트하면 앱이 다시 시작됩니다. 대화 기록과 설정은 그대로 남습니다.',
      'This app update came with the Workshop mod. The app restarts after updating. Your chat history and settings are kept.') });
  if (res.response !== 0) return;
  const appDir = app.getAppPath();
  try {
    applyUpdate(appDir, r.bundleDir, r.changed, path.join(app.getPath('userData'), 'update-backup'));
    logDiagnostic('info', 'app_update.applied', { from: cur, to: ver, files: r.changed.length });
  } catch (e) {
    logDiagnostic('error', 'app_update.failed', { from: cur, to: ver, error: String((e as Error)?.message || e) });
    await opts({ type: 'error', title: pick('SLLM 업데이트', 'SLLM update'), buttons: [pick('확인', 'OK')],
      message: pick('업데이트하지 못해 원래 파일로 되돌렸습니다.', 'The update failed, so the original files were restored.'),
      detail: pick('앱을 다시 켜면 다시 물어봅니다. 계속 실패하면 새 설치 프로그램을 받아 설치해 주세요.', 'You will be asked again next time the app starts. If it keeps failing, please install the new installer.') + '\n\n' + String((e as Error)?.message || e) });
    return;
  }
  await opts({ type: 'info', title: pick('SLLM 업데이트', 'SLLM update'), buttons: [pick('다시 시작', 'Restart')],
    message: pick(`${ver}(으)로 업데이트했습니다. 앱을 다시 시작합니다.`, `Updated to ${ver}. The app will restart.`) });
  app.relaunch();
  app.exit(0);
}

export async function checkAppUpdate(): Promise<void> {
  if (busy) return;
  const appDir = app.getAppPath();
  if (!enabled(appDir)) return;
  busy = true;
  try {
    const key = fs.readFileSync(path.join(appDir, PUBLIC_KEY_FILE), 'utf8');
    const r = checkForUpdate(appDir, app.getVersion(), updateModDirs(), key);
    if (r.kind === 'none') { if (r.reason !== 'no bundle' && r.reason !== 'not newer') logDiagnostic('warn', 'app_update.skip', { reason: r.reason }); return; }
    if (asked === r.version) return;
    asked = r.version;
    await ask(r);
  } catch (e) { logDiagnostic('warn', 'app_update.check_failed', { error: String((e as Error)?.message || e) }); }
  finally { busy = false; }
}

export function registerAppUpdate(): void {
  setTimeout(() => { void checkAppUpdate(); }, FIRST_CHECK_MS);
  setInterval(() => { void checkAppUpdate(); }, RECHECK_MS).unref?.();
}

// 포트레이트 라이브러리(앱 쪽): 앱 폴더 portrait-library 의 미리 그려 둔 초상화를 읽어 화면에 알려 준다.
// - 대화 상대: 세이브에서 읽은 통치자의 초상화·성별로 맞는 그림을 자동으로 고른다(사용자가 올린 그림이 있으면 그것이 먼저).
// - 의회 의원: 종족 계열별로 성별이 섞인 여러 얼굴을 쓰되, 외계인 혐오 제국은 통치자 종족 모델 하나만 쓴다(ui/delegate-pick.js).
// - 설정 > 초상화: 라이브러리에서 골라 계열·의원 칸에 적용(평소 사용자 그림과 같은 방식으로 저장).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { loadLibrary, extractPak, libraryFile, pickRulerItem, type LibFile, type LibItem } from '../portraitlib';
import { applyImageFile, imageState } from './images';

/** 라이브러리는 앱과 함께 설치되는 portrait-library.pak(앱 폴더)에 들어 있고, 처음 쓸 때 앱 데이터 폴더(portrait_library)에 풀린다.
 * 창작마당 모드 폴더를 거치지 않으므로 모드를 다시 올리지 않아도 된다. 낱개 파일이 든 앱 폴더/portrait-library 가 있으면 그것을, SLLM_PORTRAIT_LIB 가 있으면 그 폴더를 먼저 쓴다. */
export function libDir(): string {
  if (process.env.SLLM_PORTRAIT_LIB) return process.env.SLLM_PORTRAIT_LIB;
  const loose = path.join(app.getAppPath(), 'portrait-library');
  if (fs.existsSync(path.join(loose, 'library.json'))) return loose;
  const out = path.join(app.getPath('userData'), 'portrait_library');
  extractPak(path.join(app.getAppPath(), 'portrait-library.pak'), out);
  return out;
}
let cache: { dir: string; mtime: number; lib: LibFile } | null = null;
export function library(): LibFile {
  const d = libDir(); let m = 0;
  try { m = fs.statSync(path.join(d, 'library.json')).mtimeMs; } catch { /* 없음 */ }
  if (!cache || cache.dir !== d || cache.mtime !== m) cache = { dir: d, mtime: m, lib: loadLibrary(d) };
  return cache.lib;
}

/** 이 제국 통치자에게 맞는 라이브러리 항목. 같은 세이브·제국이면 늘 같은 항목(시드 고정). 못 찾으면 null. */
export function rulerLibraryItem(idx: number): LibItem | null {
  const r = ctx.flagProv.rulerFor(idx);
  return r ? pickRulerItem(library(), r.portrait, r.gender, ctx.curSaveId + '|' + idx) : null;
}
/** 대화 상대 화면에 쓸 자동 초상화(통치자 옷). 없으면 undefined. */
export function autoPortraitUrl(idx: number): string | undefined {
  const it = rulerLibraryItem(idx); if (!it) return undefined;
  const f = libraryFile(library(), libDir(), it.id, 'ruler');
  return f ? pathToFileURL(f).href : undefined;
}
/** 이 제국이 외계인 혐오(일반·광신) 가치관을 가졌는가. 모드가 실시간으로 알려 준 값을 먼저, 없으면 세이브 값. */
export function isXenophobe(idx: number): boolean {
  const ids = ctx.modCompatibility.liveFor(ctx.curSaveId, idx)?.ids ?? ctx.flagProv.ethicsFor(idx);
  return !!ids?.some((i) => /xenophob/i.test(String(i)));
}

export function registerPortraitLib(): void {
  ipcMain.handle('getPortraitLibrary', async () => {
    const lib = library(), d = libDir();
    return { available: lib.items.length > 0, folder: d, items: lib.items.map((it) => ({ id: it.id, cls: it.cls, defaultRole: it.defaultRole, count: it.portraits.length, portraits: it.portraits, roles: Object.fromEntries(Object.entries(it.roles).map(([r, f]) => [r, pathToFileURL(path.join(d, f)).href])) })) };
  });
  ipcMain.handle('applyLibraryPortrait', async (_e, target: { kind: 'portrait'; key: string; label?: string }, id: unknown, role: unknown) => {
    const f = libraryFile(library(), libDir(), id, role);
    if (!f) return { ...imageState(), note: '라이브러리 그림을 찾지 못했습니다.' };
    return applyImageFile(f, target);
  });
}

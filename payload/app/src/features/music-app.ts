// 국가·군가 IPC(2026-10-20 알파 10 앞당김). 규칙은 src/music.ts, 애드온 곡은 features/addons-app.ts, 화면은 ui/office-music.js(집무실 「국가·군가」).
// 사용자가 세이브마다 고른 곡은 앱 데이터의 music/<세이브>/ 로 복사해 두고 쓴다(원본을 옮겨도 끊기지 않음).
import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { addonMusicList } from './addons-app';
import { AUDIO_EXT, MAX_AUDIO } from '../addons';
import { type MusicStore, type UserTrack, sanitizeStore, safeKey, clampVolume, cleanLyrics, cleanTitle, effectiveTrack, isMusicKind, MUSIC_KINDS_ALL, chooseAddon, sanitizeCeremony, cleanCues, cuesFromSilence, creedLineCount, type CeremonyFx, creedMessages, creedEthics, parseCreed } from '../music';

const L = pick; // 한국어·영어·언어 팩
const root = () => path.join(app.getPath('userData'), 'music');
const file = () => path.join(app.getPath('userData'), 'sllm_music.json');
let store: MusicStore | null = null;
function all(): MusicStore {
  if (store) return store;
  try { store = sanitizeStore(JSON.parse(fs.readFileSync(file(), 'utf8'))); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'music', error: e }); store = sanitizeStore({}); }
  return store;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'music', error: e }); } }
const keyNow = () => safeKey(ctx.curSaveId);
/** 앱 데이터 music 폴더 안의 파일만 믿는다. */
const inRoot = (f: string): boolean => { const back = path.relative(root(), path.resolve(f)); return !!back && !back.startsWith('..') && !path.isAbsolute(back); };
function userUrl(u: UserTrack | undefined): string | null { if (!u || !u.file || !inRoot(u.file)) return null; try { return fs.statSync(u.file).isFile() ? pathToFileURL(u.file).href : null; } catch { return null; } }

/** 출정 의식 연출 설정(ceremony-app 이 읽음). */
export function musicCeremonyFx(): CeremonyFx { return all().ceremony; }
export function musicView() {
  const key = keyNow(), mine = all().saves[key] ?? {}, picks = all().picks[key] ?? {};
  const tracks: Record<string, ReturnType<typeof effectiveTrack>> = {}, addonCount: Record<string, number> = {};
  for (const k of ['anthem', 'march'] as const) {
    const list = addonMusicList(k); addonCount[k] = list.length;
    // 우선순위: 내 커스텀 > 내가 고른 애드온 곡 > 맨 위 애드온 곡. 애드온에 없으면 인식하지 않는다.
    tracks[k] = effectiveTrack(mine[k], userUrl(mine[k]), chooseAddon(list, picks[k]), L('직접 고른 파일', 'Your own file'));
  }
  return { sid: ctx.curSaveId || '', volume: all().volume, tracks, addonCount, ceremony: all().ceremony };
}

export function registerMusic(): void {
  ipcMain.handle('musicState', async () => musicView());
  /** 애드온 곡 찾기: 켜진 애드온들이 주는 곡 목록(지금 고른 것 표시). */
  ipcMain.handle('musicAddonList', async (_e, kindIn: unknown) => {
    if (!isMusicKind(kindIn) || kindIn === 'creed') return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
    const list = addonMusicList(kindIn), cur = chooseAddon(list, all().picks[keyNow()]?.[kindIn]);
    return { ok: true, items: list.map((t) => ({ addonId: t.addonId, addonName: t.addonName, title: t.title, hasAudio: !!t.url, firstLine: (t.lyrics.split('\n').find((x) => x.trim()) ?? '').slice(0, 80), chosen: !!cur && cur.addonId === t.addonId })) };
  });
  /** 애드온 곡 고르기(이 세이브만). 빈 id 면 고른 것을 지우고 맨 위 애드온으로. */
  ipcMain.handle('musicAddonPick', async (_e, kindIn: unknown, idIn: unknown) => {
    if (!isMusicKind(kindIn) || kindIn === 'creed') return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
    const key = keyNow(), id = typeof idIn === 'string' ? idIn : '';
    if (id && !addonMusicList(kindIn).some((t) => t.addonId === id)) return { ok: false, error: L('그 애드온이 꺼졌거나 이 곡이 없습니다.', 'That addon is off or no longer has this track.') };
    const p = (all().picks[key] ??= {}); if (id) p[kindIn] = id; else { delete p[kindIn]; if (!Object.keys(p).length) delete all().picks[key]; }
    save(); return { ok: true, view: musicView() };
  });
  ipcMain.handle('musicCeremonyFx', async (_e, v: unknown) => { all().ceremony = sanitizeCeremony({ ...all().ceremony, ...(v && typeof v === 'object' ? v as object : {}) }); save(); return musicView(); });
  ipcMain.handle('musicVolume', async (_e, v: unknown) => { all().volume = clampVolume(v); save(); return musicView(); });
  ipcMain.handle('musicPick', async (e, kindIn: unknown) => {
    if (!isMusicKind(kindIn) || kindIn === 'creed') return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
    const win = BrowserWindow.fromWebContents(e.sender) ?? ctx.win ?? undefined;
    const exts = ['mp3', 'ogg', 'oga', 'opus', 'wav', 'm4a', 'aac', 'flac'];
    const r = await dialog.showOpenDialog(win!, { title: kindIn === 'anthem' ? L('국가 곡 고르기', 'Choose the anthem') : kindIn === 'march' ? L('군가 곡 고르기', 'Choose the march') : L('복무신조 음성 고르기', 'Choose the service creed recording'), properties: ['openFile'], filters: [{ name: L('음악', 'Music'), extensions: exts }] });
    if (r.canceled || !r.filePaths[0]) return { ok: true, view: musicView() };
    const src = r.filePaths[0];
    try {
      if (!AUDIO_EXT.test(src)) return { ok: false, error: L('mp3·ogg·wav·m4a·aac·flac 파일만 쓸 수 있습니다.', 'Only mp3, ogg, wav, m4a, aac or flac files can be used.') };
      const st = fs.statSync(src); if (!st.isFile()) return { ok: false, error: L('파일이 아닙니다.', 'Not a file.') };
      if (st.size > MAX_AUDIO) return { ok: false, error: L('곡 파일은 24MB 까지 쓸 수 있습니다.', 'Track files can be up to 24 MB.') };
      const key = keyNow(), dir = path.join(root(), key); fs.mkdirSync(dir, { recursive: true });
      const old = all().saves[key]?.[kindIn];
      const out = path.join(dir, `${kindIn}-${Date.now()}${path.extname(src).toLowerCase()}`); fs.copyFileSync(src, out);
      if (old?.file && inRoot(old.file)) { try { fs.unlinkSync(old.file); } catch { /* 이미 없음 */ } }
      const fname = cleanTitle(path.basename(src, path.extname(src)).replace(/_+/g, ' '));
      const mine = (all().saves[key] ??= {}); mine[kindIn] = { file: out, title: fname, lyrics: old?.lyrics ?? '' }; save();
      return { ok: true, view: musicView() };
    } catch (err) { return { ok: false, error: (err as Error).message }; }
  });
  ipcMain.handle('musicClear', async (_e, kindIn: unknown) => {
    if (!isMusicKind(kindIn) || kindIn === 'creed') return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
    const key = keyNow(), mine = all().saves[key], old = mine?.[kindIn];
    if (old) { if (old.file && inRoot(old.file)) { try { fs.unlinkSync(old.file); } catch { /* 이미 없음 */ } } delete mine![kindIn]; if (!Object.keys(mine!).length) delete all().saves[key]; save(); }
    return { ok: true, view: musicView() };
  });
  /** 사용자 곡의 제목·가사 고치기(사용자 곡이 있을 때만) */
  ipcMain.handle('musicEdit', async (_e, kindIn: unknown, title: unknown, lyrics: unknown) => {
    if (!isMusicKind(kindIn) || kindIn === 'creed') return { ok: false, error: L('알 수 없는 곡 종류입니다.', 'Unknown track type.') };
    const key = keyNow(); let u = all().saves[key]?.[kindIn];
    if (!u) return { ok: false, error: L('직접 고른 곡이 있어야 제목·가사를 고칠 수 있습니다.', 'Choose your own file first to edit its title and lyrics.') };
    u.title = cleanTitle(title) || u.title; u.lyrics = cleanLyrics(lyrics);
    save(); return { ok: true, view: musicView() };
  });
}

// A-00b 7번: 설정 화면 IPC(창과 관계없는 것) — 설정 읽기, Game Client ID, 응답 언어·화면 언어, 서신 켜기, 사용자 CSS.
// 화면 언어 도우미(selectedLanguage·uiText·languageView)와 배포 설정(release-config.json의 CLIENT_ID)도 여기. 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// 창 설정(setKeepOnTop·setWindowPrefs·setTheme)은 창 상태를 직접 만져서 features/windows.ts 에 둠.
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { settings, saveSettings } from '../app/settings';
import { languagePreference, resolveLanguage, normalizeAiLanguage, gameLanguageCode, baseLanguage, locFolderOf, BaseLanguage } from '../language';
import { addonLanguagePacks, onAddonsChanged } from './addons-app';
import type { LanguagePack } from '../addons';
import { findUserDir } from '../environment-paths';
import { CUSTOM_CSS_TEMPLATE } from '../theme';
import { safeSend } from '../safe-send';
import { ctx } from '../app/ctx';

// 설정: 나중에 설정 파일/화면으로 옮긴다. Game Client ID 는 대시보드 카드의 값으로 바꿀 것.
const releaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'release-config.json'), 'utf8'));
export const CLIENT_ID = process.env.SLLM_CLIENT_ID ?? releaseConfig.player2ClientId ?? '';
export function customCssPath(): string { return path.join(app.getPath('userData'), 'sllm_custom.css'); }
const uiCatalog: Record<string, string> = require(path.join(__dirname, '..', '..', 'ui', 'i18n-catalog.js'));
/** 스텔라리스 게임 언어(settings.txt). 화면 문구마다 불리므로 5초 동안 기억한다. */
let gameLangCache: { at: number; dir: string; code: string | null } = { at: 0, dir: '', code: null };
export function gameLanguage(): string | null {
  const now = Date.now();
  if (now - gameLangCache.at < 5000 && (!settings.userDir || gameLangCache.dir === settings.userDir)) return gameLangCache.code;
  let dir = '', code: string | null = null;
  try { dir = settings.userDir || findUserDir(); code = gameLanguageCode(fs.readFileSync(path.join(dir, 'settings.txt'), 'utf8')); } catch { /* 게임 설정 파일이 없으면 시스템 언어를 쓴다 */ }
  gameLangCache = { at: now, dir, code }; return code;
}
/** 지금 화면 언어: 'ko'·'en' 또는 켜진 언어 팩 코드. 직접 고른 팩이 꺼졌으면 자동처럼 정한다. */
export function selectedLanguage(): string {
  const packs = addonLanguagePacks(), pref = settings.language;
  const needGame = pref === 'auto' || (pref !== 'ko' && pref !== 'en' && !packs.some((p) => p.code === pref));
  return resolveLanguage(pref, app.getLocale(), needGame ? gameLanguage() : null, packs);
}
/** 지금 언어가 언어 팩이면 그 팩 */
export function activePack(): LanguagePack | null { const l = selectedLanguage(); return l === 'ko' || l === 'en' ? null : addonLanguagePacks().find((p) => p.code === l) ?? null; }
/** 번역이 없을 때 쓰는 기본 언어(한국어 아니면 영어). 'ko' | 'en' 만 받는 모듈에 넘긴다. */
export function selectedBase(): BaseLanguage { return baseLanguage(selectedLanguage()); }
const patCache = new WeakMap<LanguagePack, Array<[RegExp, string]>>();
function packPattern(pack: LanguagePack, key: string): string | null {
  let list = patCache.get(pack); if (!list) { list = pack.patterns.map(([a, b]) => [new RegExp(a), b] as [RegExp, string]); patCache.set(pack, list); }
  for (const [re, to] of list) if (re.test(key)) return key.replace(re, to);
  return null;
}
/** 화면 문구 번역: 한국어 → 그대로, 영어 → 카탈로그, 언어 팩 → 팩 표(한국어·영어 원문 모두 열쇠로) → 팩 패턴 → 영어. */
/** 카탈로그 패턴(SLLMPatterns)으로 영어 문구를 만든다. 없으면 undefined(2026-10-18: 숫자·원인 코드가 든 오류 문구도 번역되게). */
function catalogPattern(key: string): string | undefined {
  const pats: Array<[string, string]> = (uiCatalog as any).__patterns || [];
  for (const [a, b] of pats) { try { const re = new RegExp(a); if (re.test(key)) return key.replace(re, b); } catch { /* 잘못된 패턴은 건너뜀 */ } }
  return undefined;
}
export function uiText(text: string): string {
  const l = selectedLanguage(); if (l === 'ko') return text;
  const key = String(text).trim().replace(/\s+/g, ' '), en = uiCatalog[key] || uiCatalog[text] || catalogPattern(key);
  if (l === 'en') return en || text;
  const pack = activePack(); if (!pack) return en || text;
  return pack.strings[key] ?? (en ? pack.strings[en] : undefined) ?? packPattern(pack, key) ?? en ?? text;
}
/** 메인 프로세스에서 한/영 두 문장을 고를 때: 한국어 → ko, 영어 → en, 언어 팩 → 팩 표의 ko 또는 en 번역, 없으면 en. */
export function pick(ko: string, en: string): string {
  const l = selectedLanguage(); if (l === 'ko') return ko; if (l === 'en') return en;
  const pack = activePack(); if (!pack) return en;
  const k = ko.trim().replace(/\s+/g, ' '), e = en.trim().replace(/\s+/g, ' ');
  return pack.strings[k] ?? pack.strings[e] ?? packPattern(pack, k) ?? en; // 숫자·이름이 든 문장은 팩 패턴으로(2026-10-18)
}
/** AI 답장 언어: 따로 정한 것 → 언어 팩이 알려 준 이름 → 화면 언어 */
export function aiLanguage(): string { if (settings.aiLanguage) return settings.aiLanguage; const pack = activePack(); return pack ? pack.aiLanguage : selectedLanguage(); }
/** 스텔라리스 번역 폴더 이름(모드 이름 읽기용) */
export function locFolder(): string { return locFolderOf(selectedLanguage(), addonLanguagePacks()); }
export const languageView = () => {
  const packs = addonLanguagePacks(), eff = selectedLanguage(), pack = packs.find((p) => p.code === eff) ?? null;
  return {
    language: settings.language, effectiveLanguage: eff, baseLanguage: baseLanguage(eff), gameLanguage: gameLanguage(), aiLanguage: settings.aiLanguage, effectiveAiLanguage: aiLanguage(),
    languages: packs.map((p) => ({ code: p.code, name: p.name })),
    languagePack: pack ? { code: pack.code, name: pack.name, strings: pack.strings, patterns: pack.patterns } : null,
  };
};

export function registerSettingsUi(): void {
  onAddonsChanged(() => { const v = languageView(); for (const w of BrowserWindow.getAllWindows()) safeSend(w, 'languageChanged', v); });
  ipcMain.handle('getSettings', async () => ({ ...settings, ...languageView() }));
  ipcMain.handle('setPlayer2ClientId', async (_e, value: unknown) => {
    if (!settings.devMode) return { ok: false, error: pick('개발자 모드에서만 프로젝트 ID를 설정할 수 있습니다.', 'The project ID can be set only in developer mode.') };
    const id = String(value || '').trim();
    if (id && !/^[a-zA-Z0-9._:-]{1,128}$/.test(id)) return { ok: false, error: pick('올바른 Game Client ID를 입력하세요.', 'Enter a valid Game Client ID.') };
    settings.player2ClientId = id; saveSettings(); ctx.p2.configureClientId(process.env.SLLM_CLIENT_ID || id || CLIENT_ID);
    return { ok: true };
  });
  ipcMain.handle('setAiLanguage', async (_e, value: unknown) => {
    const name = normalizeAiLanguage(value);
    if (name === null) return { ok: false, error: pick('언어 이름은 줄바꿈 없이 80자 이내로 입력해 주세요.', 'Enter a language name of up to 80 characters without line breaks.') };
    settings.aiLanguage = name; saveSettings();
    for (const w of BrowserWindow.getAllWindows()) safeSend(w, 'languageChanged', languageView());
    return { ok: true, ...languageView() };
  });
  ipcMain.handle('setLanguage', async (_e, preference: unknown) => {
    settings.language = languagePreference(preference); saveSettings();
    for (const w of BrowserWindow.getAllWindows()) safeSend(w, 'languageChanged', languageView());
    try { ctx.refreshTray(); } catch { /* 트레이 메뉴도 새 언어로(2026-10-19) */ }
    return languageView();
  });
  ipcMain.handle('setMailEnabled', async (_e, on: boolean) => { settings.mailEnabled = !!on; saveSettings(); return settings; });
  ipcMain.handle('getCustomCss', async () => { try { return fs.readFileSync(customCssPath(), 'utf8'); } catch { return ''; } });
  ipcMain.handle('openCustomCss', async () => {
    try {
      if (!fs.existsSync(customCssPath())) fs.writeFileSync(customCssPath(), CUSTOM_CSS_TEMPLATE, 'utf8');
      const err = await shell.openPath(customCssPath());
      return err ? pick('파일을 열지 못했습니다: ', 'Could not open the file: ') + err : pick('내 CSS 파일을 열었습니다. 저장한 뒤 "CSS 다시 불러오기"를 누르세요.', 'Opened your CSS file. Save it, then press "Reload CSS".');
    } catch (e) { return pick('파일을 만들지 못했습니다: ', 'Could not create the file: ') + (e as Error).message; }
  });
}

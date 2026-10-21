// 은하 공동체 안건 코드(resolution_xxx)의 한국어 이름·설명을 게임 번역 파일에서 읽는다.
import * as fs from 'fs';
import * as path from 'path';
import { scanLoc } from './lore';

let cache: { sig: string; map: Record<string, string> } | null = null;

/** lang: 화면 언어의 게임 번역 폴더(korean·english·simp_chinese …). 영어를 깔고 그 언어로 덮는다(2026-10-19: 영어 화면에 한국어 안건 이름이 나오던 문제). */
function load(gameDir: string | null, lang = 'korean'): Record<string, string> {
  const sig = (gameDir ?? '') + '|' + lang;
  if (cache && cache.sig === sig) return cache.map;
  const map: Record<string, string> = {};
  if (gameDir) {
    for (const lc of lang === 'english' ? ['english'] : ['english', lang]) { // 영어를 먼저 깔고 화면 언어로 덮는다
      const dir = path.join(gameDir, 'localisation', lc);
      let files: string[] = [];
      try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.yml')); } catch { continue; }
      for (const f of files) {
        let t = '';
        try { t = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
        if (!t.includes('resolution_')) continue;
        Object.assign(map, scanLoc(t, (k) => k.startsWith('resolution_')).map);
      }
    }
  }
  cache = { sig, map };
  return map;
}

/** 게임 문구의 색 표시(§Y …§!)와 $참조$를 걷어 읽기 좋게. */
export function cleanLoc(s: string, map: Record<string, string> = {}, depth = 0): string {
  let t = s.replace(/§./g, '').replace(/§!/g, '');
  t = t.replace(/\$([A-Za-z0-9_.\-]+)(\|[^$]*)?\$/g, (_m, k: string) => (depth < 3 && map[k] ? cleanLoc(map[k], map, depth + 1) : ''));
  return t.replace(/£[A-Za-z0-9_]+£/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function resolutionText(key: string, gameDir: string | null, lang = 'korean'): { title: string; desc: string } | null {
  if (!key) return null;
  const map = load(gameDir, lang);
  const n = map[key];
  if (!n) return null;
  const d = map[key + '_desc'];
  return { title: cleanLoc(n, map), desc: d ? cleanLoc(d, map) : '' };
}
export function resetResolutionCache() { cache = null; }

// A-01 2단계: 연방 법 이름(게임 번역 파일, 법 키 그대로가 번역 키). 영어를 깔고 한국어로 덮는다.
let fedCache: { sig: string; map: Record<string, string> } | null = null;
export function fedLawName(key: string, gameDir: string | null, keys: readonly string[], lang = 'korean'): string {
  const sig = (gameDir ?? '') + '|' + lang;
  if (!fedCache || fedCache.sig !== sig) {
    const map: Record<string, string> = {}, want = new Set(keys);
    if (gameDir) for (const lc of lang === 'english' ? ['english'] : ['english', lang]) {
      const dir = path.join(gameDir, 'localisation', lc);
      let files: string[] = []; try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.yml')); } catch { continue; }
      for (const f of files) { let t = ''; try { t = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; } if (!/ (centralization|vote_weight|succession_type|kick_members|fleet_contribution|free_migration)_[a-z_]+:/.test(t)) continue; Object.assign(map, scanLoc(t, (k) => want.has(k)).map); }
    }
    fedCache = { sig, map };
  }
  const n = fedCache.map[key];
  return n ? cleanLoc(n, fedCache.map) : key;
}

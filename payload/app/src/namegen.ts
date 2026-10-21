// 게임 이름 표로 인물 이름 짓기(2026-10-20). AI 에게 이름을 짓게 하지 않고, 스텔라리스 common/name_lists 의 character_names 를 쓴다.
// 규칙(사용자 결정): 우리 제국에 사는 종족을 모두 넣고, 인구 비율만큼 그 종족의 이름 표가 뽑힐 확률을 준다.
// 이름 표 → 문화(weight) 고르기 → 성별 목록(비었으면 공용 목록) → 전체 이름 또는 이름+성(둘 다 되면 반반). 이름은 번역 키라 지역화 파일에서 글자를 찾는다.
// 앱 쪽(파일 읽기·캐시): features/namegen-app.ts. 쓰는 곳: 라디오 찬반 논평 의원, 언론사 인터뷰 기자.
import { parsePdx, type PdxEntry, type PdxValue } from './lore';

export type NameGender = 'm' | 'f';
type Pools = { n: string[]; m: string[]; f: string[] };
export interface NameCulture { weight: number; full: Pools; first: Pools; second: Pools }
const pools = (): Pools => ({ n: [], m: [], f: [] });
const words = (v: PdxValue | undefined): string[] => (Array.isArray(v) ? v.filter(([k, x]) => k && x === '').map(([k]) => k) : []);

/** name_lists 파일 하나 → { 이름표 키: 문화들 }. character_names 가 없는 표(함대 이름 등만 있는 표)는 뺀다. */
export function parseNameLists(text: string): Map<string, NameCulture[]> {
  const out = new Map<string, NameCulture[]>();
  let top: PdxEntry[] = []; try { top = parsePdx(text); } catch { return out; }
  for (const [key, body] of top) {
    if (!key || !Array.isArray(body)) continue;
    const ch = body.find(([k]) => k === 'character_names')?.[1]; if (!Array.isArray(ch)) continue;
    const cultures: NameCulture[] = [];
    for (const [, cb] of ch) {
      if (!Array.isArray(cb)) continue;
      const c: NameCulture = { weight: 1, full: pools(), first: pools(), second: pools() };
      for (const [k, v] of cb) {
        if (k === 'weight' && typeof v === 'string') { const w = Number(v); if (Number.isFinite(w) && w > 0) c.weight = w; continue; }
        const m = /^(full|first|second)_names(?:_(male|female))?$/.exec(k); if (!m) continue; // regnal_* 은 통치자용이라 쓰지 않는다
        c[m[1] as 'full' | 'first' | 'second'][m[2] === 'male' ? 'm' : m[2] === 'female' ? 'f' : 'n'].push(...words(v));
      }
      const any = (p: Pools) => p.n.length + p.m.length + p.f.length > 0;
      if (any(c.full) || (any(c.first) && any(c.second))) cultures.push(c);
    }
    if (cultures.length) out.set(key, cultures);
  }
  return out;
}
/** 지역화 yml → { 키: 글자 }. 첫 줄의 l_<언어>: 를 lang 으로 돌려준다. */
export function parseLocNames(text: string): { lang: string; map: Record<string, string> } {
  const map: Record<string, string> = {}; let lang = '';
  for (const raw of text.replace(/^﻿/, '').split('\n')) {
    const l = raw.replace(/\r$/, '');
    if (!lang) { const h = /^\s*l_([a-z_]+):\s*$/.exec(l); if (h) { lang = h[1]; continue; } }
    const m = /^\s*([A-Za-z0-9_.\-']+):\d*\s+"(.*)"\s*(?:#.*)?$/.exec(l); if (m) map[m[1]] = m[2].replace(/\\"/g, '"');
  }
  return { lang, map };
}
/** 세이브의 종족 계열(class) → 그 계열의 기본 이름 표들(세이브에 name_list 가 없을 때). */
const CLASS_PREFIX: Record<string, string> = { HUM: 'HUM', MAM: 'MAM', REP: 'REP', AVI: 'AVI', ART: 'ART', MOL: 'MOL', FUN: 'FUN', PLANT: 'PLANT', INF: 'INF', LITHOID: 'LITH', NECROID: 'NEC', AQUATIC: 'AQU', TOX: 'TOX', ROBOT: 'MACHINE', MACHINE: 'MACHINE', CYB: 'HUM' };
export function listsForClass(cls: string, available: Iterable<string>): string[] {
  const p = CLASS_PREFIX[(cls || '').toUpperCase()]; if (!p) return [];
  return [...available].filter((k) => k === p || (k.startsWith(p) && /^\d+$/.test(k.slice(p.length))));
}
/** 인구 비율대로 종족 하나 고르기. */
export function pickWeighted<T extends { share: number }>(items: T[], r: number): T | null {
  const tot = items.reduce((a, b) => a + (b.share > 0 ? b.share : 0), 0); if (!(tot > 0)) return null;
  let x = r * tot; for (const it of items) { if (it.share <= 0) continue; x -= it.share; if (x < 0) return it; }
  return items.filter((i) => i.share > 0).pop() ?? null;
}
/** 번역 키 → 글자. 지역화에 없고 키처럼 생긴 것(…_CHR_…)은 못 쓴다(null). 따옴표로 바로 적힌 이름은 그대로. */
export function locName(key: string, loc: Record<string, string>): string | null {
  const v = loc[key]; if (v !== undefined) { const s = v.replace(/§./g, '').replace(/\$[^$]*\$/g, '').trim(); return s || null; }
  return /_CHR_|^[A-Z0-9]+_[A-Z]/.test(key) ? null : key;
}
/** 문화 → 성별에 맞는 이름 하나. rand 는 0..1. 못 지으면 null. */
export function composeName(cultures: NameCulture[], g: NameGender, rand: () => number, loc: Record<string, string>): string | null {
  const c = pickWeighted(cultures.map((x) => ({ ...x, share: x.weight })), rand()); if (!c) return null;
  const pool = (p: Pools) => (p[g].length ? p[g] : p.n);
  const one = (a: string[]) => (a.length ? locName(a[Math.floor(rand() * a.length) % a.length], loc) : null);
  const full = pool(c.full), first = pool(c.first), second = pool(c.second), canCombo = first.length > 0 && second.length > 0;
  for (let t = 0; t < 6; t++) {
    const useFull = full.length && (!canCombo || rand() < 0.5);
    const n = useFull ? one(full) : (() => { const a = one(first), b = one(second); return a && b ? `${a} ${b}` : null; })();
    if (n) return n.slice(0, 40);
  }
  return null;
}
/** 제국 종족 구성 + 이름 표 + 지역화 → 이름과 고른 종족 계열. 재료가 없으면 null(부른 쪽이 대신 이름을 쓴다). */
export function empireName(mix: Array<{ share: number; cls: string; list?: string }>, lists: Map<string, NameCulture[]>, loc: Record<string, string>, g: NameGender, rand: () => number = Math.random): { name: string; cls: string; list: string } | null {
  const usable = mix.map((m) => { const cand = m.list && lists.has(m.list) ? [m.list] : listsForClass(m.cls, lists.keys()); return { ...m, cand }; }).filter((m) => m.cand.length);
  const sp = pickWeighted(usable, rand()); if (!sp) return null;
  const list = sp.cand[Math.floor(rand() * sp.cand.length) % sp.cand.length], name = composeName(lists.get(list)!, g, rand, loc);
  return name ? { name, cls: sp.cls, list } : null;
}

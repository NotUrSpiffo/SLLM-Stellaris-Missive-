// 대보관소(Grand Archive) 표본 읽기 — 알파 6 수집품 1단계(2026-10-17).
// 모드 sllm_probe_archive(REQ) 가 ARCHIVE_BEGIN → ARCHIVE(k=키)* → ARCHIVE_EXH(cat,n)×3 → ARCHIVE_END(count) 를 남긴다.
// 앱은 같은 req 의 줄을 모아 보유 표본 목록(이름·분류·희귀도는 게임 파일에서 만든 표)과 분류별 전시 수를 만든다.
// 개별 표본의 전시 여부는 바닐라 트리거가 없어 알 수 없다(분류별 개수만).
import { SPECIMENS, type SpecimenRow } from './specimens-data';
import { wrapForPlayer, type SllmMessage } from './protocol';
import { L } from './i18n-pick';

export const SPEC_CATS = ['xeno_geology', 'aesthetic_wonder', 'historical_item'] as const;
export type SpecCat = typeof SPEC_CATS[number];
export const SPEC_RARITIES = ['exceptional', 'epic', 'rare', 'common'] as const;
export type SpecRarity = typeof SPEC_RARITIES[number];
export const SPEC_BY_KEY: ReadonlyMap<string, SpecimenRow> = new Map(SPECIMENS.map((r) => [r[0], r]));
export interface ArchiveItem { key: string; cat: SpecCat; rarity: SpecRarity; ko: string; en: string }
export interface ArchiveSnapshot { sid: string; date: string; req: number; items: ArchiveItem[]; exhibits: Record<SpecCat, number>; count: number; unknown: string[] }

export function archiveCommand(req: number): string {
  if (!Number.isSafeInteger(req) || req < 1) throw new Error(L('요청 번호가 올바르지 않습니다.', 'Invalid request number.'));
  return wrapForPlayer(`sllm_probe_archive = { REQ = ${req} }`);
}
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };

/** 같은 req 의 ARCHIVE_* 줄을 모은다. END 를 받으면 완성된 스냅숏을 돌려준다. */
export class ArchiveCollector {
  private open = new Map<number, { sid: string; date: string; keys: string[]; ex: Partial<Record<SpecCat, number>> }>();
  feed(m: SllmMessage): ArchiveSnapshot | null {
    if (!m.kind.startsWith('ARCHIVE')) return null;
    const req = num(m.kv.req);
    if (req === null || req < 1) return null;
    if (m.kind === 'ARCHIVE_BEGIN') { this.open.set(req, { sid: m.kv.sid || '', date: m.kv.date || '', keys: [], ex: {} }); if (this.open.size > 8) this.open.delete(this.open.keys().next().value as number); return null; }
    const cur = this.open.get(req);
    if (!cur) return null;
    if (m.kind === 'ARCHIVE') { const k = m.kv.k || ''; if (/^[a-z0-9_]{1,80}$/.test(k) && !cur.keys.includes(k)) cur.keys.push(k); return null; }
    if (m.kind === 'ARCHIVE_EXH') { const c = m.kv.cat as SpecCat, n = num(m.kv.n); if (SPEC_CATS.includes(c) && n !== null && n >= 0) cur.ex[c] = n; return null; }
    if (m.kind !== 'ARCHIVE_END') return null;
    this.open.delete(req);
    const items: ArchiveItem[] = [], unknown: string[] = [];
    for (const k of cur.keys) { const r = SPEC_BY_KEY.get(k); if (r) items.push({ key: k, cat: r[1], rarity: r[2], ko: r[3], en: r[4] }); else unknown.push(k); }
    const rank = (r: SpecRarity) => SPEC_RARITIES.indexOf(r);
    items.sort((a, b) => SPEC_CATS.indexOf(a.cat) - SPEC_CATS.indexOf(b.cat) || rank(a.rarity) - rank(b.rarity) || a.ko.localeCompare(b.ko, 'ko'));
    const count = num(m.kv.count);
    return { sid: cur.sid || m.kv.sid || '', date: cur.date, req, items, unknown, exhibits: { xeno_geology: cur.ex.xeno_geology ?? 0, aesthetic_wonder: cur.ex.aesthetic_wonder ?? 0, historical_item: cur.ex.historical_item ?? 0 }, count: count !== null && count >= 0 ? count : cur.keys.length };
  }
}

/** AI 프롬프트용 짧은 요약(2단계 선물·역요구에서 쓴다). 희귀도 높은 것부터 최대 n개. */
export function archiveSummary(s: ArchiveSnapshot | null, n = 12): string {
  if (!s || !s.items.length) return '';
  const top = [...s.items].sort((a, b) => SPEC_RARITIES.indexOf(a.rarity) - SPEC_RARITIES.indexOf(b.rarity)).slice(0, n);
  return `보유 표본 ${s.items.length}종: ` + top.map((i) => `${i.ko}(${i.rarity})`).join(', ');
}

// 종족 계열 번호(모드가 SLLM:PROFILE의 cls로 기록)와 기본 초상화 파일 이름.
// 번호 순서는 모드 sllm_probe_talk_profile의 if 체인과 같아야 한다. 0 = 알 수 없음.
export const CLASS_KEYS = ['', 'human', 'mammalian', 'reptilian', 'avian', 'arthropoid', 'molluscoid', 'fungoid', 'plantoid', 'infernal', 'lithoid', 'necroid', 'aquatic', 'toxoid', 'robot', 'machine', 'cybernetic'] as const;
export function classKey(cls: unknown): string | null {
  const n = Number(cls);
  return Number.isInteger(n) && n > 0 && n < CLASS_KEYS.length ? CLASS_KEYS[n] : null;
}
/** 모드 폴더 gfx/sllm_portraits 안의 파일 이름. */
export function defaultPortraitName(key: string): string | null {
  return /^[a-z]{3,12}$/.test(key) ? `${key}.png` : null;
}
/** 세이브 species_db 의 class 값(MAM, LITHOID 등) → 우리 계열 키. 모르는 값은 null. */
const GAME_CLASS: Record<string, string> = { HUM: 'human', MAM: 'mammalian', REP: 'reptilian', AVI: 'avian', ART: 'arthropoid', MOL: 'molluscoid', FUN: 'fungoid', PLANT: 'plantoid', INF: 'infernal', LITHOID: 'lithoid', NECROID: 'necroid', AQUATIC: 'aquatic', TOX: 'toxoid', ROBOT: 'robot', MACHINE: 'machine', CYB: 'cybernetic' };
export function gameClassKey(cls: unknown): string | null { return typeof cls === 'string' ? GAME_CLASS[cls.toUpperCase()] ?? null : null; }
/** A-09: 세이브의 종족 비율 → 의석 나눔 재료 [{k 계열, s 비율}]. 같은 계열은 합친다. 읽은 게 없으면 계열 하나 100%.
 * (게임 초상화 텍스처를 잘라 쓰는 방식은 2026-10-15 사용자 결정으로 뺌. 의석 그림은 계열 그림) */
export function seatMix(info: { founder: { portrait: string; cls: string } | null; mix: { portrait: string; cls: string; share: number }[] } | null | undefined, fallback: string): { k: string; s: number }[] {
  const fb = fallback || 'human', sum = new Map<string, number>();
  for (const x of info?.mix ?? []) if (x.share > 0) { const k = gameClassKey(x.cls) || fb; sum.set(k, (sum.get(k) ?? 0) + x.share); }
  if (!sum.size) return [{ k: (info?.founder && gameClassKey(info.founder.cls)) || fb, s: 1 }];
  const t = [...sum.values()].reduce((a, b) => a + b, 0);
  return [...sum].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, s: n / t }));
}

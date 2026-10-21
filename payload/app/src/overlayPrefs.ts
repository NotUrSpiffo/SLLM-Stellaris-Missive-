// 오버레이 편의 기능의 순수 계산: 단축키 검사, 자동 흐려짐.
export const HOTKEY_CHOICES = ['', 'Alt+F8', 'F8', 'F9', 'F10', 'Ctrl+Alt+T', 'Ctrl+Shift+Space'] as const;
/** 허용한 단축키 목록에 있는 값만 받는다. 빈 문자열은 "사용 안 함". */
export function sanitizeHotkey(v: unknown, fallback = 'Alt+F8'): string {
  return typeof v === 'string' && (HOTKEY_CHOICES as readonly string[]).includes(v) ? v : fallback;
}
export function clampFade(v: unknown, fallback = 0.6): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0.3, n)) * 100) / 100 : fallback;
}
export function pointInRect(p: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }): boolean {
  return p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height;
}
/** 지금 있어야 할 투명도. 흐려짐이 꺼져 있거나, 마우스가 위에 있거나, 창이 포커스를 가졌거나, 방금 활동이 있었으면 1. */
export function fadeTarget(o: { enabled: boolean; inside: boolean; focused: boolean; recent: boolean; base: number }): number {
  return !o.enabled || o.inside || o.focused || o.recent ? 1 : o.base;
}
/** 목표를 향해 한 걸음(깜박이지 않게 부드럽게). */
export function stepOpacity(cur: number, target: number, step: number): number {
  if (Math.abs(target - cur) <= step) return target;
  return Math.round((cur + Math.sign(target - cur) * step) * 100) / 100;
}

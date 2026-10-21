// 게임 속도 재기: 스크립트로는 속도를 읽을 수 없어서, 게임이 한 달을 넘기는 데 걸린 실제 시간으로 짐작한다.
// 일시정지·불러오기가 끼면 그 간격은 버린다. "보통"/"빠름"의 기준 시간은 사용자가 설정에서 한 번 맞춘다.

/** 최근 몇 번의 달 간격(초)의 가운데 값. */
export class SpeedMeter {
  private prev: { idx: number; t: number } | null = null;
  private samples: number[] = [];
  private taint = true;
  /** 달이 바뀔 때마다 부른다(date 는 "2200.03.01" 꼴). */
  feed(date: string, nowMs: number): void {
    const m = /^(\d+)\.(\d+)/.exec((date || '').trim()); if (!m) return;
    const idx = Number(m[1]) * 12 + Number(m[2]);
    const p = this.prev; this.prev = { idx, t: nowMs };
    if (p && idx === p.idx + 1) {
      const s = (nowMs - p.t) / 1000;
      if (!this.taint && s > 0.2 && s < 900) { this.samples.push(s); if (this.samples.length > 5) this.samples.shift(); }
    } else if (p) this.samples = []; // 불러오기·날짜 점프
    this.taint = false;
  }
  /** 일시정지·재개처럼 다음 간격이 믿을 수 없게 되는 일이 있을 때 부른다. */
  mark(): void { this.taint = true; }
  reset(): void { this.prev = null; this.samples = []; this.taint = true; }
  /** 한 달에 걸리는 실제 초. 아직 모르면 null. */
  get secPerMonth(): number | null {
    const s = this.samples.slice(-3).sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : null;
  }
  get count(): number { return this.samples.length; }
}

export type SpeedClass = 'unknown' | 'ok' | 'slow' | 'fast';
/** normal/fast = 사용자가 맞춘 "보통"/"빠름"의 한 달 시간(초). 둘 중 하나라도 없으면 판단하지 않는다(unknown). */
export function classifySpeed(sec: number | null, normal: number | null, fast: number | null): SpeedClass {
  if (sec === null || !normal || !fast || !(normal > 0) || !(fast > 0)) return 'unknown';
  const slowest = Math.max(normal, fast), quickest = Math.min(normal, fast);
  if (sec > slowest * 1.5) return 'slow';
  if (sec < quickest * 0.6) return 'fast';
  return 'ok';
}

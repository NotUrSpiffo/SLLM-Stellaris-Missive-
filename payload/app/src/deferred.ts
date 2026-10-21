import { logDiagnostic } from './diagnostics';
// 조약 얼버무리기: 통상·연구·불가침 같은 조약은 앱이 맺을 수 없으므로, AI 가 "의원들과 논의한 뒤 서신으로 알리겠다"고 하고
// 몇 달 뒤 실제로 서신(편지)을 보낸다. 서신의 결론은 대화 당시 AI 의 속마음(호감과 태도)에서 정한다.
import * as fs from 'fs';
import type { Profile } from './prompt';
import { dateNum, addMonths } from './gamedate';

export type Lean = 'positive' | 'neutral' | 'negative';
export const LEAN_KO: Record<Lean, string> = { positive: '긍정적', neutral: '아직 정하지 못함', negative: '부정적' };
export interface Deferred { id: number; sid: string; idx: number; name: string; topic: string; asked: string; due: string; lean: Lean; op: number; profile?: Profile }
export interface DeferredFile { next: number; items: Deferred[] }

// F-28: 날짜 계산은 gamedate.ts 한 곳에(옛 이름은 그대로 내보냄)
export { addMonths } from './gamedate';

export class DeferredStore {
  private data: DeferredFile = { next: 1, items: [] };
  constructor(private file: string) {
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && Array.isArray(j.items)) this.data = { next: Number(j.next) || 1, items: j.items }; } catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')logDiagnostic('warn','storage.read_failed',{store:'deferred',file,error}); }
  }
  private save(): void { try { fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8'); } catch(error) { logDiagnostic('error','storage.write_failed',{store:'deferred',file:this.file,error}); } }
  list(sid: string): Deferred[] { return this.data.items.filter((d) => d.sid === sid); }
  /** 같은 상대·같은 주제가 이미 기다리고 있으면 새로 만들지 않는다. */
  add(d: Omit<Deferred, 'id' | 'due'>, monthsLater: number): Deferred | null {
    if (this.data.items.some((x) => x.sid === d.sid && x.idx === d.idx && x.topic === d.topic)) return null;
    const item: Deferred = { ...d, id: this.data.next++, due: addMonths(d.asked, Math.max(1, monthsLater)) };
    this.data.items.push(item); this.save(); return item;
  }
  /** 날짜가 된 것을 꺼낸다. 세이브를 과거로 불러와 아직 묻지도 않은 일이 된 것은 버린다. */
  due(sid: string, date: string): Deferred[] {
    const now = dateNum(date); if (!sid || Number.isNaN(now)) return [];
    const out: Deferred[] = []; const keep: Deferred[] = [];
    for (const d of this.data.items) {
      if (d.sid !== sid) { keep.push(d); continue; }
      const asked = dateNum(d.asked);
      if (!Number.isNaN(asked) && asked > now) continue; // 되감기로 없던 일이 됨
      if (dateNum(d.due) <= now) out.push(d); else keep.push(d);
    }
    if (out.length || keep.length !== this.data.items.length) { this.data.items = keep; this.save(); }
    return out;
  }
}

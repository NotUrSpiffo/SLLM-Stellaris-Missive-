// 비방 공작 → 신문 스캔들(2026-10-20 알파 9 ③). 게임의 「비방 공작」(operation_smear_campaign) 작전이 끝나면 모드가 SPYOP type=smear 를 남긴다.
//  - 남이 우리에게: 우리 정부를 둘러싼 추문이 퍼진다(민심 −5, 다음 달 호외 후보). 플레이어가 대응을 고른다(성명은 플레이어가 직접 쓴다 — AI 초안 없음, 2026-10-20 사용자 결정):
//      기자회견 = 실제 언론사 인터뷰 화면(추문 한 주제, 2026-10-20 연계): 해명 호평 +6 · 실패 −4 · 라디오 반박 +3 · 무시 −2(소문이 굳는다). 대응 뒤 라디오 찬반 논평(smeared) 알림.
//  - 우리 개입 의혹이 보도되면 상대 제국이 해명을 요구한다 → 청문회(espionage-app openGameHearing).
//  - 우리가 남에게: 상대 정부의 추문 기사가 은하 신문 재료가 된다. 20% 확률로 우리 첩보 개입 의혹이 함께 보도된다(민심 −4, 찬반 논평 smear_ok).
// 앱: features/scandal-app.ts, 화면: ui/scandal.html.
export type ScandalResp = 'press' | 'radio' | 'ignore';
export interface Scandal { id: string; date: string; side: 'against' | 'ours'; other: string; resp: ScandalResp | ''; text: string; exposed: boolean }
/** 민심 조정(사건 조정은 mood.ts 에서 ±15 로 묶이고 1년에 걸쳐 사라진다). */
export const SCANDAL_MOOD = { hit: -5, pressGood: 6, pressBad: -4, radio: 3, ignore: -2, exposed: -4 } as const;
export const EXPOSE_CHANCE = 0.2;
/** 대응별 민심. 기자회견은 인터뷰 평가(good)에 따라. */
export const respMood = (r: ScandalResp, good = false): number => (r === 'press' ? (good ? SCANDAL_MOOD.pressGood : SCANDAL_MOOD.pressBad) : SCANDAL_MOOD[r]);
/** 비방 공작 기록 하나를 스캔들로(플레이어와 관계없는 작전·비방이 아닌 작전은 null). */
export function scandalFrom(op: { phase: string; type?: string; owner: string; target: string; date: string }, player: string, rand: number): Scandal | null {
  if (op.phase !== 'finished' || op.type !== 'smear' || !player) return null;
  if (op.target === player && op.owner !== player) return { id: 'smear|' + op.owner + '|' + op.date, date: op.date, side: 'against', other: op.owner, resp: '', text: '', exposed: false };
  if (op.owner === player && op.target !== player) return { id: 'smear|' + op.target + '|' + op.date, date: op.date, side: 'ours', other: op.target, resp: '', text: '', exposed: rand < EXPOSE_CHANCE };
  return null;
}
export interface ScandalStore { saves: Record<string, Scandal[]> }
export function sanitizeScandal(v: unknown): ScandalStore {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, saves: ScandalStore['saves'] = {};
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) for (const [sid, list] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
    if (!Array.isArray(list)) continue;
    const out: Scandal[] = [];
    for (const d of list.slice(-30)) {
      const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      if (typeof x.id !== 'string' || (x.side !== 'against' && x.side !== 'ours') || typeof x.other !== 'string') continue;
      out.push({ id: x.id.slice(0, 160), date: typeof x.date === 'string' ? x.date.slice(0, 20) : '', side: x.side, other: x.other.slice(0, 80), resp: x.resp === 'press' || x.resp === 'radio' || x.resp === 'ignore' ? x.resp : '', text: typeof x.text === 'string' ? x.text.slice(0, 600) : '', exposed: x.exposed === true });
    }
    if (out.length) saves[sid.slice(0, 60)] = out;
  }
  return { saves };
}

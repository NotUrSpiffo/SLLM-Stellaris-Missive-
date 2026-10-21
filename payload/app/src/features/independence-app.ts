// 독립 선언 서신(앱 쪽, 2026-10-19). 순수 로직은 src/independence.ts.
// 모드 SLLM:ORIGIN(반란군 행성 장악·평화 협상 독립) → 새 나라를 세이브마다 기록 → 그 나라의 통신 번호(IDX)를 알면
// 연대기(새 나라·부모 나라 쪽)에 남기고 「독립 선언문」 외교 서신을 플레이어 서신함에 넣는다. 번호를 모르면 매달 다시 보고 24개월까지 기다린다.
// 저장: sllm_independence.json { saves: { [세이브]: IndepRecord[] } }.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { addYears } from '../mail';
import type { OriginRecord } from '../gamestate';
import { onGameOrigin, onGameSnapshot } from './gamestate-app';
import { chronNote, chronNoteByName, idxNames } from './chronicle-app';
import { receiveLetter, mail } from './mail-app';
import { type IndepRecord, noteIndependence, indepExpired, indepChronLines, declarationMessages, cleanDeclaration } from '../independence';

let data: { saves: Record<string, IndepRecord[]> } | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_independence.json');
function all(): { saves: Record<string, IndepRecord[]> } {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'independence', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'independence', error: e }); } }
const listOf = (sid: string): IndepRecord[] => (all().saves[sid] ??= []);
/** 이름 → 통신 번호(IDX 신호로 알게 된 것만). */
function idxOf(name: string): number { for (const [i, n] of idxNames) if (n === name && i > 0 && i < 9000) return i; return 0; }
const busy = new Set<string>();

/** 기다리는 선언문을 보낼 수 있으면 보낸다(번호를 알게 됐을 때). */
async function deliver(sid: string, r: IndepRecord): Promise<void> {
  if (r.state !== 'wait' || busy.has(sid + ':' + r.country)) return;
  const date = ctx.gameDate || r.date;
  if (indepExpired(r, date)) { r.state = 'expired'; save(); logDiagnostic('info', 'independence.expired', { country: r.country }); return; }
  const idx = idxOf(r.country); if (!idx) return; // 아직 연락이 닿지 않음 → 다음 달에 다시
  busy.add(sid + ':' + r.country);
  try {
    const lines = indepChronLines(r);
    chronNote(idx, lines.child, true); chronNoteByName(r.from, lines.parent, false); // 대화에서 "어디서 갈라져 나왔는지"를 기억(연대기 → withLore)
    const profile = ctx.profileWithEthics(ctx.profiles.get(idx) ?? mail.countries.get(idx)?.profile, idx);
    const raw = await ctx.ai.chat(declarationMessages({ player: ctx.playerName, date, r, profile }), { maxTokens: 1400 });
    const text = cleanDeclaration(raw);
    if (!text || sid !== ctx.curSaveId) return;
    receiveLetter(sid, ctx.govMem().currentBranch(sid), { idx, name: r.country, date, text, proposal: null, expires: addYears(date, 2), read: false, sourceId: 'independence:' + r.country });
    r.state = 'sent'; save();
    logDiagnostic('info', 'independence.sent', { country: r.country, from: r.from, kind: r.kind });
  } catch (e) { logDiagnostic('warn', 'independence.letter_failed', { country: r.country, error: String(e) }); } // 다음 달에 다시
  finally { busy.delete(sid + ':' + r.country); }
}
function onOrigin(o: OriginRecord): void {
  const sid = ctx.curSaveId; if (!sid) return;
  const r = noteIndependence(listOf(sid), o, ctx.playerName, ctx.gameDate || o.date); if (!r) return;
  save(); logDiagnostic('info', 'independence.noted', { country: r.country, from: r.from, kind: r.kind, state: r.state });
  void deliver(sid, r);
}
export function registerIndependence(): void {
  onGameOrigin(onOrigin);
  onGameSnapshot((snap) => { if (snap.sid !== ctx.curSaveId) return; for (const r of listOf(snap.sid)) if (r.state === 'wait') void deliver(snap.sid, r); }); // 매달: 연락이 닿았는지 다시 본다
}

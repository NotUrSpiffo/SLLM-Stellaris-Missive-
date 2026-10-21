// 언론 인터뷰 칙령 기록(세이브별 sllm_edicts.json, 2026-10-18). 정책 퀘스트와 같은 수정자를 겹쳐 쓰지 않게 서로 확인한다.
// press-app·policy-app 둘 다 쓰므로 고리 없이 따로 둔다.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { daysBetween } from '../policy';

export interface EdictRecord { cid: string; id: string; title: string; strength: 1 | 2 | 3; positive: boolean; years: number; date: string; end: string; mods: string[]; outlet: string; foes: number }
interface EdictSave { active: EdictRecord | null; history: EdictRecord[] }
class EdictStore {
  private data: Record<string, EdictSave> = {};
  constructor(private file: string) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object') this.data = j; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'edicts', file, error }); } }
  get(sid: string): EdictSave { const s = (this.data[sid || 'nosave'] ??= { active: null, history: [] }); s.history ??= []; if (s.active === undefined) s.active = null; return s; }
  save(): boolean { try { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8'); fs.renameSync(tmp, this.file); return true; } catch (error) { logDiagnostic('error', 'storage.write_failed', { store: 'edicts', file: this.file, error }); return false; } }
}
let inst: EdictStore | null = null;
export const edictStore = () => (inst ??= new EdictStore(path.join(app.getPath('userData'), 'sllm_edicts.json')));
/** 지금 시행 중인 칙령(끝난 것은 null). */
export function activeEdict(sid: string, date: string): EdictRecord | null {
  if (!sid) return null; const a = edictStore().get(sid).active; if (!a) return null;
  return date && daysBetween(date, a.end) <= 0 ? null : a;
}
/** 시행 중인 칙령이 쓰는 수정자(정책 선포 때 겹침 확인). */
export const edictModsInUse = (sid: string, date: string): Set<string> => new Set(activeEdict(sid, date)?.mods ?? []);

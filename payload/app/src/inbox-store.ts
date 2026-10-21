import { logDiagnostic } from './diagnostics';
import * as fs from 'fs';
import * as path from 'path';
import type { Letter } from './mail';
import { L } from './i18n-pick';
export interface SavedLetter extends Letter { sid: string; branch: number; proposalHandled?: boolean }
export class InboxStore {
  private data: { next: number; letters: SavedLetter[] } = { next: 1, letters: [] };
  error: string | null = null;
  private loadError: string | null = null;
  constructor(private file: string) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!j || !Array.isArray(j.letters)) throw new Error(L('잘못된 편지 저장 형식', 'Invalid letter storage format'));
      this.data.letters = j.letters.filter((l: any) => l && /^\d{1,9}$/.test(l.sid) && Number.isSafeInteger(l.id) && l.id > 0 && Number.isSafeInteger(l.idx) && l.idx > 0 && typeof l.text === 'string' && typeof l.name === 'string' && typeof l.date === 'string' && typeof l.expires === 'string');
      this.data.next = Math.max(Number(j.next) || 1, 1, ...this.data.letters.map(l => l.id + 1));
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {this.error = (e as Error).message;this.loadError=this.error;logDiagnostic('warn','storage.read_failed',{store:'inbox',file,error:e});} }
  }
  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data), 'utf8');
      fs.renameSync(this.file + '.tmp', this.file); this.error = null;
    } catch (e) { this.error = (e as Error).message;logDiagnostic('error','storage.write_failed',{store:'inbox',file:this.file,error:e}); }
  }
  list(sid: string): SavedLetter[] { return this.data.letters.filter(l => l.sid === sid).map(l => ({ ...l, proposal: l.proposal ? { ...l.proposal } : null })); }
  add(sid: string, branch: number, letter: Omit<Letter, 'id'>): SavedLetter {
    if (!/^\d{1,9}$/.test(sid)) throw new Error(L('세이브 번호가 없습니다.', 'No save number.'));
    if(letter.sourceId&&this.loadError)throw new Error(this.loadError);
    if (letter.sourceId) { const old = this.data.letters.find(x=>x.sid===sid && x.branch===branch && x.sourceId===letter.sourceId); if(old) { this.save(); return { ...old }; } }
    const l: SavedLetter = { ...letter, sid, branch, id: this.data.next++ };
    this.data.letters.push(l); this.save(); return { ...l };
  }
  markRead(sid: string, id: number): void { this.change(sid, id, l => { l.read = true; }); }
  handleProposal(sid: string, id: number): void { this.change(sid, id, l => { l.proposalHandled = true; }); }
  private change(sid: string, id: number, mutate: (l: SavedLetter) => void): void {
    const l = this.data.letters.find(l => l.sid === sid && l.id === id);
    if (!l) throw new Error(L('이 세이브의 편지가 아닙니다.', 'This letter is not from this save.'));
    mutate(l); this.save();
  }
}

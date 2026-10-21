import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { parsePdx } from './lore';
import { runtimeUserDir } from './environment-paths';
import { L } from './i18n-pick';

export interface ResourceRoot { name: string; id: string; dir: string; archive?: string; replace: string[] }
export interface ResourceFile { relative: string; source: string; root: ResourceRoot }
const relPath = (s: string): string | null => { const n = s.replace(/\\/g, '/'); return !n || n.startsWith('/') || /^[a-z]:/i.test(n) || n.split('/').some(x => x === '..' || x === '') ? null : n; };
const under = (file: string, dir: string) => file === dir || file.startsWith(dir.replace(/\/$/, '') + '/');
const scalar = (entries: ReturnType<typeof parsePdx>, key: string) => { const v = entries.find(x => x[0] === key)?.[1]; return typeof v === 'string' ? v : ''; };
function zipIndex(buf: Buffer): Map<string, { offset: number; size: number; output: number; method: number }> {
  const out = new Map<string, { offset: number; size: number; output: number; method: number }>();
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw Error('Unsupported archive (ZIP required)');
  let p = buf.readUInt32LE(e + 16); const count = buf.readUInt16LE(e + 10);
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw Error('Invalid ZIP directory');
    const size = buf.readUInt32LE(p + 20), output = buf.readUInt32LE(p + 24), method = buf.readUInt16LE(p + 10), len = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    if (p + 46 + len + extra + comment > buf.length || local + 30 > buf.length) throw Error('Invalid ZIP entry');
    const name = relPath(buf.toString('utf8', p + 46, p + 46 + len));
    const offset = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (name && offset + size <= buf.length && output <= 32 * 1024 * 1024 && !(buf.readUInt16LE(p + 8) & 1)) out.set(name, { offset, size, output, method });
    p += 46 + len + extra + comment;
  }
  return out;
}

/** Read-only view of the selected playset. Later roots override earlier files, including replace_path. */
export class ModResources {
  roots: ResourceRoot[] = [];
  warnings: string[] = [];
  revision = 0;
  private signature = '$unloaded';
  private checked = 0;
  private archives = new Map<string, { buf: Buffer; entries: ReturnType<typeof zipIndex> }>();
  constructor(private game: () => string | null, private user: () => string = runtimeUserDir) {}
  invalidate(): void { this.checked = 0; this.signature = '$invalid'; this.archives.clear(); }
  refresh(force = false): void {
    if (!force && this.checked && Date.now() - this.checked < 5000) return;
    this.checked = Date.now();
    const user = this.user(), game = this.game(), roots: ResourceRoot[] = [], warnings: string[] = [];
    if (game) roots.push({ name: 'Stellaris', id: 'base', dir: game, replace: [] });
    let descriptors: string[] = [], sig = game || '';
    try { const raw = fs.readFileSync(path.join(user, 'dlc_load.json'), 'utf8'); sig += raw; const j = JSON.parse(raw); if (Array.isArray(j.enabled_mods)) descriptors = j.enabled_mods.filter((s: unknown) => typeof s === 'string'); }
    catch { warnings.push(L('활성 모드 목록(dlc_load.json)을 읽지 못했습니다.', 'Could not read the active mod list (dlc_load.json).')); }
    for (const relative of descriptors) {
      try {
        const descriptor = path.isAbsolute(relative) ? relative : path.resolve(user, relative), raw = fs.readFileSync(descriptor, 'utf8'), values = parsePdx(raw);
        sig += descriptor + raw;
        const loc = scalar(values, 'path'), archive = scalar(values, 'archive');
        if (!loc && !archive) { warnings.push(relative + L(': path/archive 없음', ': no path/archive')); continue; }
        const resolve = (s: string) => path.isAbsolute(s) ? path.normalize(s) : path.resolve(user, s);
        const r: ResourceRoot = {
          name: scalar(values, 'name') || relative,
          id: scalar(values, 'remote_file_id') || relative,
          dir: loc ? resolve(loc) : '',
          ...(archive ? { archive: resolve(archive) } : {}),
          replace: values
            .filter((x) => x[0] === 'replace_path' && typeof x[1] === 'string')
            .map((x) => String(x[1]).replace(/\\/g, '/').replace(/\/$/, '')),
        };
        if (r.dir && !fs.existsSync(r.dir)) { warnings.push(r.name + L(': 모드 폴더 없음', ': mod folder missing')); continue; }
        if (r.archive && !r.dir) {
          const stat = fs.statSync(r.archive); sig += stat.mtimeMs + ':' + stat.size;
          if (stat.size > 512 * 1024 * 1024) { warnings.push(r.name + L(': 512MB 초과 압축 모드, 폴더로 풀어 지정 필요', ': zipped mod over 512MB — unpack it into a folder and point to that')); continue; }
        }
        roots.push(r);
      } catch (e) { warnings.push(relative + ': ' + (e as Error).message); }
    }
    if (!force && sig === this.signature) return;
    this.signature = sig; this.roots = roots; this.warnings = warnings; this.archives.clear(); this.revision++;
  }
  private archive(r: ResourceRoot) {
    let a = this.archives.get(r.archive!);
    if (!a) { const buf = fs.readFileSync(r.archive!); a = { buf, entries: zipIndex(buf) }; this.archives.set(r.archive!, a); }
    return a;
  }
  private present(r: ResourceRoot, relative: string): boolean {
    if (r.dir) { try { return fs.statSync(path.join(r.dir, relative)).isFile(); } catch { return false; } }
    try { return this.archive(r).entries.has(relative); } catch (e) { const w = r.name + ': ' + (e as Error).message; if (!this.warnings.includes(w)) this.warnings.push(w); return false; }
  }
  /** 특정 모드 안의 파일(다른 모드가 같은 경로를 써도 섞이지 않게). 애드온 읽기용. */
  fileIn(r: ResourceRoot, relative: string): ResourceFile | null {
    const n = relPath(relative); if (!n || !this.present(r, n)) return null;
    return { relative: n, root: r, source: r.dir ? path.join(r.dir, n) : r.archive + '::' + n };
  }
  resolve(relative: string): ResourceFile | null {
    this.refresh(); const n = relPath(relative); if (!n) return null;
    for (const r of [...this.roots].reverse()) {
      if (this.present(r, n)) return { relative: n, root: r, source: r.dir ? path.join(r.dir, n) : r.archive + '::' + n };
      if (r.replace.some(p => under(n, p))) return null;
    }
    return null;
  }
  read(f: ResourceFile): Buffer {
    if (f.root.dir) { const p = path.join(f.root.dir, f.relative); if (fs.statSync(p).size > 32 * 1024 * 1024) throw Error('Resource exceeds 32MB'); return fs.readFileSync(p); }
    const a = this.archive(f.root), e = a.entries.get(f.relative); if (!e) throw Error('Archive resource missing');
    const input = a.buf.subarray(e.offset, e.offset + e.size);
    const b = e.method === 0 ? Buffer.from(input) : e.method === 8 ? zlib.inflateRawSync(input, { maxOutputLength: 32 * 1024 * 1024 }) : null;
    if (!b || b.length !== e.output) throw Error('Unsupported or damaged ZIP entry'); return b;
  }
  files(folder: string, extension: string): ResourceFile[] {
    this.refresh(); const n = relPath(folder); if (!n) return [];
    const found = new Map<string, ResourceFile>();
    for (const r of this.roots) {
      for (const p of r.replace) for (const name of found.keys()) if (under(name, p)) found.delete(name);
      const names: string[] = [];
      if (r.dir) {
        const walk = (dir: string) => {
          let entries: fs.Dirent[];
          try {
            entries = fs.readdirSync(path.join(r.dir, dir), { withFileTypes: true });
          } catch {
            return;
          }
          for (const e of entries) {
            const v = dir + '/' + e.name;
            if (e.isDirectory()) walk(v);
            else if (e.isFile() && v.toLowerCase().endsWith(extension)) names.push(v);
          }
        };
        walk(n);
      } else try { for (const name of this.archive(r).entries.keys()) if (under(name, n) && name.toLowerCase().endsWith(extension)) names.push(name); } catch (e) { const w = r.name + ': ' + (e as Error).message; if (!this.warnings.includes(w)) this.warnings.push(w); }
      for (const name of names.sort()) found.set(name, { relative: name, root: r, source: r.dir ? path.join(r.dir, name) : r.archive + '::' + name });
    }
    return [...found.values()].sort((a,b) => this.roots.indexOf(a.root)-this.roots.indexOf(b.root) || a.relative.localeCompare(b.relative));
  }
}

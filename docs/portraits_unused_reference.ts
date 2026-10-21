// A-04 실제 초상화(2026-10-15): 세이브의 종족 초상화 키(species_db portrait=) → gfx/portraits/portraits/*.txt 정의
// → 첫 번째 character_textures DDS → 가장 큰 몸통 덩어리만 잘라 PNG. 게임 초상화는 3D 모델에 입히는 텍스처라
// 귀·눈 같은 부속은 따로 떨어져 있다. 몸통(가장 큰 불투명 덩어리)만 쓰면 알아볼 수 있는 흉상이 된다. 읽기 전용.
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { parsePdx, type PdxEntry } from './lore';
import { decodeDds, encodePng, shrink, type Img } from './flagrender';

export interface PortraitDefs { tex: Record<string, string>; groups: Record<string, string> }
const vals = (e: PdxEntry[] | string, key: string): PdxEntry[] => (Array.isArray(e) ? e.filter((x) => x[0] === key) : []);
const firstStr = (e: PdxEntry[] | string): string => { if (!Array.isArray(e)) return ''; for (const x of e) { if (/\.dds$/i.test(x[0])) return x[0]; if (typeof x[1] === 'string' && /\.dds$/i.test(x[1])) return x[1]; } return ''; };
/** portraits = { 이름 = { character_textures = { "a.dds" ... } 또는 texturefile = "a.dds" } } 와 portrait_groups = { 이름 = { default = 초상화 } } 를 모은다. */
export function parsePortraitDefs(text: string, into: PortraitDefs = { tex: {}, groups: {} }): PortraitDefs {
  let top: PdxEntry[]; try { top = parsePdx(text); } catch { return into; }
  for (const [k, v] of top) {
    if (!Array.isArray(v)) continue;
    if (k === 'portraits') for (const [name, body] of v) {
      if (!name || !Array.isArray(body)) continue;
      const ct = vals(body, 'character_textures')[0]?.[1];
      const t = (ct ? firstStr(ct) : '') || (vals(body, 'texturefile')[0]?.[1] as string) || '';
      if (typeof t === 'string' && /\.dds$/i.test(t)) into.tex[name] = t.replace(/\\/g, '/');
    }
    if (k === 'portrait_groups') for (const [name, body] of v) {
      const d = Array.isArray(body) ? vals(body, 'default')[0]?.[1] : '';
      if (name && typeof d === 'string' && d) into.groups[name] = d;
    }
  }
  return into;
}
/** 초상화 키(또는 그룹 키) → 텍스처 경로. 모르면 null. */
export function textureFor(defs: PortraitDefs, key: string): string | null {
  if (defs.tex[key]) return defs.tex[key];
  const d = defs.groups[key]; if (d && defs.tex[d]) return defs.tex[d];
  return null;
}
/** 사람형(human_*)은 몸·옷·머리가 따로라 텍스처만으로는 대머리 맨몸이 된다 → 쓰지 않는다(모드 기본 그림으로). */
export const skipPortrait = (key: string, tex: string): boolean => /^human|\/human\/|\/humanoid\//i.test(key + ' ' + tex); // humanoid 도 머리·몸이 따로

/** 가장 큰 불투명 덩어리(8방향 연결, 알파 > 40)의 테두리 상자로 자르고, 아래를 맞춰 4:5 액자에 넣는다. */
export function figureCrop(img: Img, maxW = 256): Img | null {
  const s = Math.max(1, Math.floor(Math.max(img.w, img.h) / 256)); // 큰 텍스처는 격자를 성기게 봐서 빠르게
  const gw = Math.ceil(img.w / s), gh = Math.ceil(img.h / s), on = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) on[y * gw + x] = img.px[((y * s) * img.w + x * s) * 4 + 3] > 40 ? 1 : 0;
  const lab = new Int32Array(gw * gh); let best = { n: 0, id: 0, x0: 0, y0: 0, x1: 0, y1: 0 }, id = 0; const st: number[] = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || lab[i]) continue; id++; let n = 0, x0 = gw, y0 = gh, x1 = 0, y1 = 0; st.push(i); lab[i] = id;
    while (st.length) {
      const c = st.pop()!, cx = c % gw, cy = (c - cx) / gw; n++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const j = ny * gw + nx; if (on[j] && !lab[j]) { lab[j] = id; st.push(j); } }
    }
    if (n > best.n) best = { n, id, x0, y0, x1, y1 };
  }
  // 너무 작은 덩어리(부속만 있는 텍스처)는 쓰지 않는다: 몸통이 텍스처 높이의 40% 미만이거나 칸 수가 적으면 실패
  if (best.n < 400 || (best.y1 - best.y0 + 1) < gh * 0.4) return null;
  const X0 = best.x0 * s, Y0 = best.y0 * s, X1 = Math.min(img.w, (best.x1 + 1) * s), Y1 = Math.min(img.h, (best.y1 + 1) * s);
  const bw = X1 - X0, bh = Y1 - Y0; const W = Math.max(bw, Math.ceil(bh * 0.8)), H = Math.max(bh, Math.ceil(W * 1.25));
  const px = new Uint8Array(W * H * 4), ox = Math.floor((W - bw) / 2), oy = H - bh;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const gx = Math.min(gw - 1, Math.floor((X0 + x) / s)), gy = Math.min(gh - 1, Math.floor((Y0 + y) / s));
    if (lab[gy * gw + gx] !== best.id) continue; // 가장 큰 덩어리(몸통)에 속한 칸만 옮긴다(옆에 떨어진 귀·눈·날개 조각은 뺀다)
    const si = ((Y0 + y) * img.w + X0 + x) * 4, di = ((oy + y) * W + ox + x) * 4;
    px[di] = img.px[si]; px[di + 1] = img.px[si + 1]; px[di + 2] = img.px[si + 2]; px[di + 3] = img.px[si + 3];
  }
  return shrink({ w: W, h: H, px }, maxW);
}

/** zip 안 파일 하나만 읽는다(중앙 디렉터리만 읽고 그 파일만 풀어서, 큰 DLC zip 을 통째로 메모리에 올리지 않는다). */
export class ZipLite {
  private dir: Map<string, { off: number; csize: number; method: number }> | null = null;
  constructor(readonly file: string) {}
  private index(): Map<string, { off: number; csize: number; method: number }> {
    if (this.dir) return this.dir;
    const m = new Map<string, { off: number; csize: number; method: number }>(); this.dir = m;
    let fd = -1;
    try {
      fd = fs.openSync(this.file, 'r'); const size = fs.fstatSync(fd).size, tail = Math.min(size, 65557), tb = Buffer.alloc(tail);
      fs.readSync(fd, tb, 0, tail, size - tail);
      let e = -1; for (let i = tail - 22; i >= 0; i--) if (tb.readUInt32LE(i) === 0x06054b50) { e = i; break; }
      if (e < 0) return m;
      const cdSize = tb.readUInt32LE(e + 12), cdOff = tb.readUInt32LE(e + 16), count = tb.readUInt16LE(e + 10);
      const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
      let p = 0;
      for (let k = 0; k < count && p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50; k++) {
        const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20), nl = cd.readUInt16LE(p + 28), xl = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32), loc = cd.readUInt32LE(p + 42);
        m.set(cd.toString('utf8', p + 46, p + 46 + nl).replace(/\\/g, '/').toLowerCase(), { off: loc, csize, method }); p += 46 + nl + xl + cl;
      }
    } catch { /* 읽지 못하면 빈 목록 */ } finally { if (fd >= 0) try { fs.closeSync(fd); } catch { /* 무시 */ } }
    return m;
  }
  names(prefix: string): string[] { const p = prefix.toLowerCase(); return [...this.index().keys()].filter((n) => n.startsWith(p)); }
  read(name: string): Buffer | null {
    const ent = this.index().get(name.toLowerCase()); if (!ent || ent.csize > 64 * 1024 * 1024) return null;
    let fd = -1;
    try {
      fd = fs.openSync(this.file, 'r'); const lh = Buffer.alloc(30); fs.readSync(fd, lh, 0, 30, ent.off);
      if (lh.readUInt32LE(0) !== 0x04034b50) return null;
      const start = ent.off + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28), buf = Buffer.alloc(ent.csize); fs.readSync(fd, buf, 0, ent.csize, start);
      return ent.method === 0 ? buf : ent.method === 8 ? zlib.inflateRawSync(buf) : null;
    } catch { return null; } finally { if (fd >= 0) try { fs.closeSync(fd); } catch { /* 무시 */ } }
  }
}

/** 게임 폴더 + DLC zip(+ 선택: 켜진 모드 파일 찾기)에서 초상화를 만들어 주는 공급자. 결과는 메모리와 캐시 폴더에 남긴다. */
export class PortraitProvider {
  private defs: PortraitDefs | null = null;
  private zips: ZipLite[] = [];
  private cache = new Map<string, string | null>();
  private loadedFor = '';
  constructor(private game: () => string | null, private cacheDir: () => string, private modFile?: (rel: string) => Buffer | null, private modDefs?: () => string[]) {}
  private load(): void {
    const g = this.game() || ''; if (this.defs && this.loadedFor === g) return;
    this.loadedFor = g; const defs: PortraitDefs = { tex: {}, groups: {} }; this.zips = []; this.cache.clear();
    if (g) {
      const dir = path.join(g, 'gfx', 'portraits', 'portraits');
      try { for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.txt')) parsePortraitDefs(fs.readFileSync(path.join(dir, f), 'utf8'), defs); } catch { /* 폴더 없음 */ }
      try {
        for (const d of fs.readdirSync(path.join(g, 'dlc')).sort()) {
          let zs: string[] = []; try { zs = fs.readdirSync(path.join(g, 'dlc', d)).filter((f) => f.toLowerCase().endsWith('.zip')); } catch { continue; }
          for (const z of zs) { const zl = new ZipLite(path.join(g, 'dlc', d, z)); this.zips.push(zl); for (const n of zl.names('gfx/portraits/portraits/')) if (n.endsWith('.txt')) { const b = zl.read(n); if (b) parsePortraitDefs(b.toString('utf8'), defs); } }
        }
      } catch { /* DLC 없음 */ }
    }
    for (const t of this.modDefs?.() ?? []) parsePortraitDefs(t, defs);
    this.defs = defs;
  }
  private file(rel: string): Buffer | null {
    const m = this.modFile?.(rel); if (m) return m;
    const g = this.game(); if (g) { try { return fs.readFileSync(path.join(g, ...rel.split('/'))); } catch { /* 다음 */ } }
    for (const z of this.zips) { const b = z.read(rel); if (b) return b; }
    return null;
  }
  /** 초상화 키 → PNG 데이터 주소. 만들 수 없으면 null(부르는 쪽이 종족 계열 그림으로 대신한다). */
  urlFor(key: string): string | null {
    if (!key || !/^[\w.-]{1,80}$/.test(key)) return null;
    this.load(); if (this.cache.has(key)) return this.cache.get(key)!;
    let url: string | null = null;
    const cf = path.join(this.cacheDir(), key + '.png');
    try { url = 'data:image/png;base64,' + fs.readFileSync(cf).toString('base64'); } catch {
      const tex = textureFor(this.defs!, key);
      if (tex && !skipPortrait(key, tex)) {
        const b = this.file(tex), img = b ? decodeDds(b) : null, fig = img ? figureCrop(img) : null;
        if (fig) { const png = encodePng(fig); url = 'data:image/png;base64,' + png.toString('base64'); try { fs.mkdirSync(path.dirname(cf), { recursive: true }); fs.writeFileSync(cf, png); } catch { /* 캐시 실패는 무시 */ } }
      }
    }
    this.cache.set(key, url); return url;
  }
}

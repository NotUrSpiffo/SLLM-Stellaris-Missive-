// 깃발 그리기: 게임 폴더의 flags/*.dds(압축 없는 24/32비트) + colors.txt 로 PNG 를 만든다. 읽기 전용.
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import type { FlagSpec } from './savereader';

export interface Img { w: number; h: number; px: Uint8Array } // RGBA

/** 압축 없는 DDS(24/32비트 BGR(A))만 읽는다. 다른 형식이면 null. */
export function decodeDds(buf: Buffer): Img | null {
  if (buf.length < 128 || buf.toString('latin1', 0, 4) !== 'DDS ') return null;
  const h = buf.readUInt32LE(12), w = buf.readUInt32LE(16);
  const pfFlags = buf.readUInt32LE(80);
  const bits = buf.readUInt32LE(88);
  if (pfFlags & 0x4) return decodeDxt(buf, w, h, buf.toString('latin1', 84, 88));
  if (!(pfFlags & 0x40) || (bits !== 24 && bits !== 32)) return null; // RGB 가 아니거나 모르는 압축 형식
  const rm = buf.readUInt32LE(92), gm = buf.readUInt32LE(96), bm = buf.readUInt32LE(100), am = buf.readUInt32LE(104);
  const bpp = bits / 8;
  if (w <= 0 || h <= 0 || w > 4096 || h > 4096 || buf.length < 128 + w * h * bpp) return null;
  const sh = (m: number) => (m === 0 ? -1 : Math.log2(m & -m));
  const rs = sh(rm), gs = sh(gm), bs = sh(bm), as = sh(am);
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let v = 0;
    for (let k = 0; k < bpp; k++) v += buf[128 + i * bpp + k] * 2 ** (8 * k);
    px[i * 4] = rs < 0 ? 0 : Math.floor(v / 2 ** rs) & 255;
    px[i * 4 + 1] = gs < 0 ? 0 : Math.floor(v / 2 ** gs) & 255;
    px[i * 4 + 2] = bs < 0 ? 0 : Math.floor(v / 2 ** bs) & 255;
    px[i * 4 + 3] = as < 0 ? 255 : Math.floor(v / 2 ** as) & 255;
  }
  return { w, h, px };
}

/** DXT1/DXT3/DXT5 (첫 번째 밉맵만). 다른 형식이면 null. */
function decodeDxt(buf: Buffer, w: number, h: number, cc: string): Img | null {
  const kind = cc === 'DXT1' ? 1 : cc === 'DXT3' ? 3 : cc === 'DXT5' ? 5 : 0;
  if (!kind || w <= 0 || h <= 0 || w > 4096 || h > 4096) return null;
  const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4), bs = kind === 1 ? 8 : 16;
  if (buf.length < 128 + bw * bh * bs) return null;
  const px = new Uint8Array(w * h * 4);
  const c565 = (v: number): [number, number, number] => [((v >> 11) & 31) * 255 / 31, ((v >> 5) & 63) * 255 / 63, (v & 31) * 255 / 31].map(Math.round) as [number, number, number];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const o = 128 + (by * bw + bx) * bs;
      const co = kind === 1 ? o : o + 8;
      const c0v = buf.readUInt16LE(co), c1v = buf.readUInt16LE(co + 2);
      const c0 = c565(c0v), c1 = c565(c1v);
      const pal: [number, number, number, number][] = [[...c0, 255], [...c1, 255], [0, 0, 0, 255], [0, 0, 0, 255]];
      if (kind === 1 && c0v <= c1v) { pal[2] = [Math.round((c0[0] + c1[0]) / 2), Math.round((c0[1] + c1[1]) / 2), Math.round((c0[2] + c1[2]) / 2), 255]; pal[3] = [0, 0, 0, 0]; }
      else { pal[2] = [Math.round((2 * c0[0] + c1[0]) / 3), Math.round((2 * c0[1] + c1[1]) / 3), Math.round((2 * c0[2] + c1[2]) / 3), 255]; pal[3] = [Math.round((c0[0] + 2 * c1[0]) / 3), Math.round((c0[1] + 2 * c1[1]) / 3), Math.round((c0[2] + 2 * c1[2]) / 3), 255]; }
      const idx = buf.readUInt32LE(co + 4);
      const alpha: number[] = new Array(16).fill(255);
      if (kind === 3) { for (let i = 0; i < 16; i++) alpha[i] = ((buf[o + (i >> 1)] >> ((i & 1) * 4)) & 15) * 17; }
      else if (kind === 5) {
        const a0 = buf[o], a1 = buf[o + 1];
        const tab = [a0, a1]; if (a0 > a1) for (let i = 1; i <= 6; i++) tab.push(Math.round(((7 - i) * a0 + i * a1) / 7)); else { for (let i = 1; i <= 4; i++) tab.push(Math.round(((5 - i) * a0 + i * a1) / 5)); tab.push(0, 255); }
        let bits = 0n; for (let i = 0; i < 6; i++) bits |= BigInt(buf[o + 2 + i]) << BigInt(8 * i);
        for (let i = 0; i < 16; i++) alpha[i] = tab[Number((bits >> BigInt(3 * i)) & 7n)];
      }
      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3), y = by * 4 + (i >> 2);
        if (x >= w || y >= h) continue;
        const c = pal[(idx >>> (2 * i)) & 3];
        const q = (y * w + x) * 4;
        px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2]; px[q + 3] = kind === 1 ? c[3] : alpha[i];
      }
    }
  }
  return { w, h, px };
}

/** colors.txt 에서 swatch 이름 -> flag 색(RGB). */
export function parseColors(text: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  const re = /^\s*([a-z0-9_]+)\s*=\s*\{\s*flag\s*=\s*rgb\s*\{\s*(\d+)\s+(\d+)\s+(\d+)\s*\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
}

type RGB = [number, number, number];

/** 채널 가중치로 색을 섞는다: R→c0, G→c1, B→c2. */
function tint(px: Uint8Array, i: number, c: RGB[]): RGB {
  const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
  return [0, 1, 2].map((k) => Math.min(255, r * c[0][k] + g * c[1][k] + b * c[2][k])) as RGB;
}

export interface RenderOpts { load?: (category: string, file: string) => Img | null; size?: number; iconSlots?: [number, number, number]; bgSlots?: [number, number, number] }

/** 배경 + 문양을 합쳐 size x size RGBA 로 돌려준다. 파일을 못 읽으면 null. */
export function composeFlag(spec: FlagSpec, gameDir: string, colorTable: Record<string, RGB>, opt: RenderOpts = {}): Img | null {
  const size = opt.size ?? 128;
  const bgS = opt.bgSlots ?? [0, 1, 2], icS = opt.iconSlots ?? [0, 1, 2];
  const pick = (slots: [number, number, number]): RGB[] =>
    slots.map((s) => colorTable[spec.colors[s]] ?? colorTable[spec.colors[0]] ?? [128, 128, 128]);
  const load = (cat: string, file: string): Img | null => {
    if (opt.load) return opt.load(cat, file);
    try { return decodeDds(fs.readFileSync(path.join(gameDir, 'flags', cat, file))); } catch { return null; }
  };
  const bg = load(spec.bgCat || 'backgrounds', spec.bgFile);
  const ic = load(spec.iconCat, spec.iconFile);
  if (!bg && !ic) return null;
  const out = new Uint8Array(size * size * 4);
  const bgc = pick(bgS), icc = pick(icS);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (bg) {
        const i = (Math.floor((y * bg.h) / size) * bg.w + Math.floor((x * bg.w) / size)) * 4;
        const [cr, cg, cb] = tint(bg.px, i, bgc);
        r = cr; g = cg; b = cb; a = bg.px[i + 3] / 255;
      }
      if (ic) {
        const i = (Math.floor((y * ic.h) / size) * ic.w + Math.floor((x * ic.w) / size)) * 4;
        const [cr, cg, cb] = tint(ic.px, i, icc);
        const ia = ic.px[i + 3] / 255;
        r = cr * ia + r * (1 - ia); g = cg * ia + g * (1 - ia); b = cb * ia + b * (1 - ia);
        a = ia + a * (1 - ia);
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(a * 255);
    }
  }
  return { w: size, h: size, px: out };
}

/** RGBA -> PNG 바이트. */
export function encodePng(img: Img): Buffer {
  const crcT = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    Buffer.from(img.px.buffer, img.px.byteOffset + y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** 가로를 maxW 로 줄인다(작으면 그대로). 가장 가까운 점 방식. */
export function shrink(img: Img, maxW: number): Img {
  if (img.w <= maxW) return img;
  const w = maxW, h = Math.max(1, Math.round((img.h * maxW) / img.w));
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (Math.floor((y * img.h) / h) * img.w + Math.floor((x * img.w) / w)) * 4, di = (y * w + x) * 4;
    px[di] = img.px[si]; px[di + 1] = img.px[si + 1]; px[di + 2] = img.px[si + 2]; px[di + 3] = img.px[si + 3];
  }
  return { w, h, px };
}

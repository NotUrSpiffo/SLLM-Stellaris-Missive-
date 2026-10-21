// 집무실 연락처 직업 아이콘(2026-10-18): 게임 폴더의 지도자 하위 직업 아이콘(gfx/interface/icons/leaders/subclasses/*.dds)을
// 실행 중에만 읽어(복사·배포하지 않음) 밝은 그림 부분만 남긴 가림판(마스크) PNG 로 바꾼다. 화면은 이 가림판에 테마 색을 칠해 쓴다.
import * as fs from 'fs';
import * as path from 'path';
import { decodeDds, encodePng, type Img } from './flagrender';

/** 연락처 역할 → 게임 아이콘 파일(없으면 화면이 이름 첫 글자로 대신한다). 통치자는 게임에 하위 직업 아이콘이 없어 넣지 않는다. */
export const ROLE_ICON: Record<string, string> = {
  admiral: 'subclass_commander_admiral_large.dds',
  general: 'subclass_commander_general_large.dds',
  commander: 'subclass_commander_councilor_large.dds',
  governor: 'subclass_official_governor_large.dds',
  official: 'subclass_official_delegate_large.dds',
  scientist: 'subclass_scientist_explorer_large.dds',
  scholar: 'subclass_scientist_scholar_large.dds',
};

/** 원판(어두운 원 위의 밝은 그림)에서 밝은 그림만 가림판으로: 알파 = 밝기가 원판보다 밝은 만큼 × 원래 알파. */
export function iconMask(img: Img): Img {
  const px = new Uint8Array(img.w * img.h * 4);
  for (let i = 0; i < img.w * img.h; i++) {
    const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2], a = img.px[i * 4 + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const k = Math.max(0, Math.min(1, (lum - 120) / (200 - 120)));
    px[i * 4] = 255; px[i * 4 + 1] = 255; px[i * 4 + 2] = 255; px[i * 4 + 3] = Math.round(k * a);
  }
  return { w: img.w, h: img.h, px };
}

const cache = new Map<string, Record<string, string>>();
/** 역할별 가림판 data URL. 게임 폴더를 모르거나 파일이 없으면 그 역할은 빠진다. */
export function roleIconMasks(gameDir: string | null): Record<string, string> {
  if (!gameDir) return {};
  const hit = cache.get(gameDir); if (hit) return hit;
  const out: Record<string, string> = {};
  for (const [role, file] of Object.entries(ROLE_ICON)) {
    try {
      const img = decodeDds(fs.readFileSync(path.join(gameDir, 'gfx', 'interface', 'icons', 'leaders', 'subclasses', file)));
      if (img) out[role] = 'data:image/png;base64,' + encodePng(iconMask(img)).toString('base64');
    } catch { /* 없으면 글자로 */ }
  }
  cache.set(gameDir, out);
  return out;
}

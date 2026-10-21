// 설정·API 키 파일을 안전하게 읽고 쓴다(F-33 A). Electron 없이 시험할 수 있게 settings.ts 에서 떼어 둠.
// - 파일이 없으면(ENOENT) 처음 실행으로 보고 빈 값.
// - 내용이 깨졌으면 원본을 `<파일>.bad` 로 남기고 빈 값으로 이어 간다(깨진 내용은 어차피 쓸 수 없다).
// - 그 밖의 읽기 오류(잠김·권한 등 일시적일 수 있는 것)는 실패로 돌려준다. 이때는 덮어쓰면 안 된다(멀쩡한 파일을 잃을 수 있음).
import * as fs from 'fs';
import { L } from './i18n-pick';

export type JsonRead<T> = { ok: true; value: T | null; recovered?: string } | { ok: false; error: string };

/** JSON 객체 파일 읽기. value=null 은 "파일 없음". recovered 는 깨진 파일을 옮겨 둔 경로. */
export function readJsonObject<T extends object>(file: string): JsonRead<T> {
  let text: string;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { ok: true, value: null };
    return { ok: false, error: `${code || 'read'}: ${(e as Error).message}` };
  }
  try {
    const j = JSON.parse(text.replace(/^﻿/, ''));
    if (j && typeof j === 'object' && !Array.isArray(j)) return { ok: true, value: j as T };
  } catch { /* 아래에서 깨진 파일로 처리 */ }
  const bad = file + '.bad';
  try { fs.copyFileSync(file, bad); } catch (e) { return { ok: false, error: L('깨진 파일을 옮겨 두지 못함: ', 'Could not move the broken file aside: ') + (e as Error).message }; }
  return { ok: true, value: null, recovered: bad };
}

/** 임시 파일에 쓴 뒤 바꿔 끼운다(쓰다 끊겨도 원래 파일이 반쯤 깨지지 않게). 실패하면 오류 문장, 성공하면 null. */
export function writeJsonAtomic(file: string, value: unknown, pretty = false): string | null {
  const tmp = file + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify(value, null, pretty ? 2 : undefined), 'utf8'); fs.renameSync(tmp, file); return null; }
  catch (e) { try { fs.unlinkSync(tmp); } catch { /* 임시 파일이 없으면 그만 */ } return (e as Error).message; }
}

/** 키 파일: 문자열 값만 남긴다. */
export function cleanKeyMap(v: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (v) for (const [k, s] of Object.entries(v)) if (typeof s === 'string' && s) out[k] = s;
  return out;
}

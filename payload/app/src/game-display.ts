// 게임 화면 모드(2026-10-18): 스텔라리스가 「독점 전체화면(fullScreen=yes)」이면 윈도우 규칙상 다른 창(우리 앱)이 앞에 서는 순간
// 게임 화면이 내려간다. OP.GG 같은 겹침 앱도 이 모드에서는 똑같고, 그들이 게임 안에 그리는 방식(DirectX 끼워 넣기)은 우리가 쓰지 않는다.
// 대신 「테두리 없는 전체화면(borderless)」이면 전체화면과 똑같아 보이면서 앱 창이 위에 떠도 게임이 내려가지 않는다.
// 여기서는 게임 설정 파일(settings.txt·pdx_settings.txt)을 읽어 모드를 알아내고, 사용자가 원하면 테두리 없음으로 고쳐 준다(게임이 꺼져 있을 때만).
import * as fs from 'fs';
import * as path from 'path';

export type DisplayMode = 'exclusive' | 'borderless' | 'windowed';

/** settings.txt 의 graphics 블록에서 모드를 읽는다. 없으면 null. */
export function parseDisplayMode(settingsTxt: string): DisplayMode | null {
  const full = /^\s*fullScreen\s*=\s*(yes|no)/m.exec(settingsTxt), border = /^\s*borderless\s*=\s*(yes|no)/m.exec(settingsTxt);
  if (!full && !border) return null;
  if (full?.[1] === 'yes' && border?.[1] !== 'yes') return 'exclusive';
  return border?.[1] === 'yes' ? 'borderless' : 'windowed';
}
/** settings.txt 를 테두리 없는 전체화면으로. 바뀐 것이 없으면 null. */
export function toBorderless(settingsTxt: string): string | null {
  const out = settingsTxt.replace(/^(\s*fullScreen\s*=\s*)yes/m, '$1no').replace(/^(\s*borderless\s*=\s*)no/m, '$1yes');
  return out === settingsTxt ? null : out;
}
/** pdx_settings.txt(런처가 보는 쪽)의 display_mode 를 borderless_fullscreen 으로. 바뀐 것이 없으면 null. */
export function pdxToBorderless(pdxTxt: string): string | null {
  const out = pdxTxt.replace(/("display_mode"\s*=\s*\{\s*value=)"(fullscreen|windowed)"/, '$1"borderless_fullscreen"');
  return out === pdxTxt ? null : out;
}

/** 사용자 폴더의 설정 파일에서 현재 모드. 파일이 없으면 null. */
export function readDisplayMode(userDir: string): DisplayMode | null {
  try { return parseDisplayMode(fs.readFileSync(path.join(userDir, 'settings.txt'), 'utf8')); } catch { return null; }
}
/** 두 설정 파일을 테두리 없는 전체화면으로 고친다. 고친 파일 수를 돌려준다(0 = 이미 그 모드). */
export function fixDisplayMode(userDir: string): number {
  let n = 0;
  for (const [file, fn] of [['settings.txt', toBorderless], ['pdx_settings.txt', pdxToBorderless]] as const) {
    const p = path.join(userDir, file); let txt: string;
    try { txt = fs.readFileSync(p, 'utf8'); } catch { continue; }
    const out = fn(txt); if (!out) continue;
    fs.writeFileSync(p + '.sllm-bak', txt); fs.writeFileSync(p, out); n++; // 원본은 .sllm-bak 로 한 부 남긴다
  }
  return n;
}

export const DISPLAY_HINT_KO = '스텔라리스가 「전체화면(독점)」 모드입니다. 이 모드에서는 앱 창이 뜨는 순간 게임 화면이 내려갑니다(윈도우 규칙이라 다른 겹침 앱도 같습니다). 게임을 끈 뒤 아래 [테두리 없는 전체화면으로 바꾸기]를 누르거나, 게임 설정 → 그래픽 → 디스플레이 모드를 「테두리 없음」으로 바꿔 주세요. 보기에는 전체화면과 똑같고 앱 창이 위에 떠도 게임이 내려가지 않습니다.';

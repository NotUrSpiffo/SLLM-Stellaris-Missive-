// 게임 안 키보드가 보낸 키 번호를 글자로 바꾸고, 한글 자모를 음절로 조합한다.
// 키 번호(모드 sllm_probe_kb 와 같은 약속):
//   1..26   영문 소문자 a..z        101..126 영문 대문자 A..Z
//   201..226 한글(두벌식) 자리 a..z   301..326 한글 + Shift (ㅃㅉㄸㄲㅆㅒㅖ, 나머지는 같음)
//   401..410 숫자 1..9, 0            420 띄어쓰기      421.. 문장 부호(PUNCT 순서)

const QWERTY = 'abcdefghijklmnopqrstuvwxyz';
// 두벌식: a..z 자리의 자모
const KO = ['ㅁ', 'ㅠ', 'ㅊ', 'ㅇ', 'ㄷ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅑ', 'ㅓ', 'ㅏ', 'ㅣ', 'ㅡ', 'ㅜ', 'ㅐ', 'ㅔ', 'ㅂ', 'ㄱ', 'ㄴ', 'ㅅ', 'ㅕ', 'ㅍ', 'ㅈ', 'ㅌ', 'ㅛ', 'ㅋ'];
const KO_SHIFT: Record<string, string> = { q: 'ㅃ', w: 'ㅉ', e: 'ㄸ', r: 'ㄲ', t: 'ㅆ', o: 'ㅒ', p: 'ㅖ' };
export const DIGITS = '1234567890';
export const PUNCT = ['.', ',', '?', '!', "'", '-', '~'];

/** 키 번호 하나를 글자(또는 자모)로. 모르는 번호는 빈 문자열. */
export function keyChar(code: number): string {
  if (code >= 1 && code <= 26) return QWERTY[code - 1];
  if (code >= 101 && code <= 126) return QWERTY[code - 101].toUpperCase();
  if (code >= 201 && code <= 226) return KO[code - 201];
  if (code >= 301 && code <= 326) return KO_SHIFT[QWERTY[code - 301]] ?? KO[code - 301];
  if (code >= 401 && code <= 410) return DIGITS[code - 401];
  if (code === 420) return ' ';
  if (code >= 421 && code < 421 + PUNCT.length) return PUNCT[code - 421];
  return '';
}

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const V2: Record<string, string> = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
const F2: Record<string, string> = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
const F2_SPLIT: Record<string, [string, string]> = Object.fromEntries(Object.entries(F2).map(([k, v]) => [v, [k[0], k[1]]]));

const isCons = (c: string) => CHO.includes(c);
const isVowel = (c: string) => JUNG.includes(c);

/** 자모가 섞인 문자열을 완성형 한글로 조합한다(두벌식 오토마타). 자모가 아닌 글자는 그대로 둔다. */
export function compose(input: string): string {
  let out = '';
  let cho = '', jung = '', jong = '';
  const flush = () => {
    if (cho && jung) out += String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong));
    else out += cho + jung + jong;
    cho = jung = jong = '';
  };
  for (const c of input) {
    if (isCons(c)) {
      if (cho && jung && !jong && JONG.includes(c)) jong = c;
      else if (cho && jung && jong && F2[jong + c]) jong = F2[jong + c];
      else { flush(); cho = c; }
    } else if (isVowel(c)) {
      if (cho && !jung) jung = c;
      else if (jung && !jong && V2[jung + c]) jung = V2[jung + c];
      else if (cho && jung && jong) {
        // 받침의 마지막 자음이 다음 음절의 첫소리로 넘어간다 (예: 안+ㅕ → 아녀)
        let moved: string;
        if (F2_SPLIT[jong]) { const [a, b] = F2_SPLIT[jong]; jong = a; moved = b; } else { moved = jong; jong = ''; }
        flush();
        cho = moved;
        jung = c;
      } else { flush(); jung = c; flush(); }
    } else {
      flush();
      out += c;
    }
  }
  flush();
  return out;
}

/** 게임이 보낸 키 번호 목록(오래된 것부터)을 문장으로. */
export function decodeKeys(codes: number[]): string {
  return compose(codes.map(keyChar).join('')).trim();
}

/** 로그의 c= 값("0,0,12,203,...", 가장 오래된 것이 앞)을 키 번호 목록으로. 0 은 빈 칸. */
export function parseKeyList(s: string | undefined): number[] {
  if (!s) return [];
  return s.split(',').map((x) => Math.round(Number(x.trim()))).filter((n) => Number.isFinite(n) && n > 0);
}

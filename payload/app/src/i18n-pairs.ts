// 코드 안의 한/영 문구 쌍 모으기(2026-10-18, 언어 팩 뼈대용). 창·메인 코드는 번역 카탈로그 말고도 L('한국어', 'English') 꼴로
// 두 언어를 바로 적는다. 언어 팩이 이것도 번역할 수 있게, 뼈대를 만들 때 배포된 ui·dist 파일을 훑어 쌍을 뽑는다.
// - 글자 그대로인 쌍 → strings(열쇠 = 한국어)
// - ${…} 가 들어간 쌍 → patterns(한국어 쪽을 ^…$ 정규식으로, 영어 쪽 ${…} 를 $1.. 로). 영어 쪽 식이 한국어 쪽에 없으면 건너뜀.
// - ['한국어', 'English'] 꼴 배열 쌍(종류 이름표 등) → strings
const PAIR = /\b(?:L|TL|bi|ui|pick)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3\s*\)/g;
const HANGUL = /[가-힣]/;
const ARR = /\[\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(['"])((?:\\.|(?!\3)[^\\])*)\3\s*\]/g;
/** 따옴표 안 글자의 \' \" \\ 같은 이스케이프를 푼다(정확한 화면 글자와 맞추려고). */
function unescape(s: string): string { return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, c: string) => c[0] === 'u' || c[0] === 'x' ? String.fromCharCode(parseInt(c.slice(1), 16)) : c === 'n' ? '\n' : c === 't' ? '\t' : c); }
/** `${식}` 조각으로 나눈다. 식 안 중괄호 짝을 맞춘다. 실패하면 null. */
function splitTemplate(s: string): Array<{ text: string } | { expr: string }> | null {
  const out: Array<{ text: string } | { expr: string }> = []; let i = 0, buf = '';
  while (i < s.length) {
    if (s[i] === '$' && s[i + 1] === '{') {
      let depth = 1, j = i + 2; while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
      if (depth) return null;
      if (buf) out.push({ text: buf }); buf = ''; out.push({ expr: s.slice(i + 2, j - 1).trim() }); i = j;
    } else buf += s[i++];
  }
  if (buf) out.push({ text: buf });
  return out;
}
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 템플릿 쌍 → [정규식, 바꿀 글]. 만들 수 없으면 null. */
export function templatePattern(ko: string, en: string): [string, string] | null {
  const sp = (x: string) => unescape(x).trim().replace(/\s+/g, ' '); // 화면 번역은 앞뒤 공백을 정리한 글로 찾는다
  const k = splitTemplate(sp(ko)), e = splitTemplate(sp(en));
  if (!k || !e) return null;
  const exprs = k.filter((p): p is { expr: string } => 'expr' in p).map((p) => p.expr);
  if (!exprs.length) return null;
  for (let n = 1; n < k.length; n++) if ('expr' in k[n] && 'expr' in k[n - 1]) return null; // 식이 붙어 있으면 경계를 알 수 없음
  const src = '^' + k.map((p) => ('expr' in p ? '(.+?)' : reEsc(p.text))).join('') + '$';
  let ok = true;
  const rep = e.map((p) => { if (!('expr' in p)) return p.text.replace(/\$/g, '$$$$'); const i = exprs.indexOf(p.expr); if (i < 0) ok = false; return '$' + (i + 1); }).join('');
  if (!ok) return null;
  try { new RegExp(src); } catch { return null; }
  return [src, rep];
}
/** 여러 파일 내용에서 쌍을 모은다. 같은 한국어는 처음 것 하나. */
export function extractPairs(texts: string[]): { strings: Record<string, string>; patterns: Array<[string, string]> } {
  const strings: Record<string, string> = {}, patterns: Array<[string, string]> = [], seen = new Set<string>();
  for (const t of texts) {
    PAIR.lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = PAIR.exec(t))) {
      const ko = m[2], en = m[4];
      if (!HANGUL.test(ko) || seen.has(ko)) continue; seen.add(ko);
      const tmpl = m[1] === '`' && ko.includes('${');
      if (!tmpl) { const k = unescape(ko).trim().replace(/\s+/g, ' '); if (k && !k.includes('${')) strings[k] = unescape(en); continue; }
      const p = templatePattern(ko, en); if (p && !patterns.some((q) => q[0] === p[0])) patterns.push(p);
    }
    ARR.lastIndex = 0;
    while ((m = ARR.exec(t))) { const k = unescape(m[2]).trim().replace(/\s+/g, ' '), e = unescape(m[4]); if (HANGUL.test(k) && !HANGUL.test(e) && /[A-Za-z]/.test(e) && !seen.has(k)) { seen.add(k); strings[k] = e; } }
  }
  return { strings, patterns };
}

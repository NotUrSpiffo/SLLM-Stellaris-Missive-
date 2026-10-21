// 국가·군가 재생의 순수 규칙(2026-10-20 알파 10 앞당김). 애드온 곡 읽기는 addons.ts, 파일·IPC 는 features/music-app.ts, 화면은 ui/office-music.js.
// 곡은 앱 화면에서만 재생한다(게임 모드는 건드리지 않음). 우선순위: 사용자가 세이브에 직접 고른 파일 > 켜진 애드온 팩의 곡.
import type { MusicKind, PlayTrack } from './addons';
export const MUSIC_KINDS_ALL: readonly MusicKind[] = ['anthem', 'march', 'creed'];
/** 사용자가 직접 고른 곡: file 은 앱 데이터 music 폴더 안에 복사해 둔 파일(복무신조는 본문만 쓰면 빈 글). */
export interface UserTrack { file: string; title: string; lyrics: string; /** 복무신조 낭독의 줄별 시작 시각(초) */ cues?: number[]; /** 시각의 출처: ai(단체 낭독 합성)·silence(쉼 찾기)·manual(손으로 맞춤) */ cueSrc?: CueSrc }
export type CueSrc = 'ai' | 'silence' | 'manual';
export const cueSrcOk = (v: unknown): v is CueSrc => v === 'ai' || v === 'silence' || v === 'manual';
export interface MusicStore { volume: number; saves: Record<string, Partial<Record<MusicKind, UserTrack>>>; /** 세이브마다 고른 애드온 곡(애드온 id). 없으면 맨 위 애드온 */ picks: Record<string, Partial<Record<MusicKind, string>>>; /** 출정 의식 연출(2026-10-20) */ ceremony: CeremonyFx }
export const DEFAULT_VOLUME = 0.6;
/** 출정 의식 연출: 어두움(0.35~0.85)·불씨·저음 화음·원근 자막·시작 전 안내. */
export interface CeremonyFx { darkness: number; embers: boolean; drone: boolean; persp: boolean; askPause: boolean }
export const DEFAULT_CEREMONY: CeremonyFx = { darkness: 0.62, embers: true, drone: true, persp: false, askPause: true };
export function sanitizeCeremony(v: unknown): CeremonyFx {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, b = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
  const dk = typeof o.darkness === 'number' && Number.isFinite(o.darkness) ? Math.min(0.85, Math.max(0.35, Math.round(o.darkness * 100) / 100)) : DEFAULT_CEREMONY.darkness;
  return { darkness: dk, embers: b(o.embers, true), drone: b(o.drone, true), persp: b(o.persp, false), askPause: b(o.askPause, true) };
}
/** 줄별 시작 시각 검사: 0 이상, 오름차순, 600초 이내, 최대 40줄. 아니면 undefined. */
export function cleanCues(v: unknown): number[] | undefined {
  if (!Array.isArray(v) || !v.length || v.length > 40) return undefined;
  const out: number[] = []; let prev = -1;
  for (const x of v) { if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 600 || x < prev) return undefined; out.push(Math.round(x * 100) / 100); prev = x; }
  return out;
}
export const clampVolume = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 100) / 100)) : DEFAULT_VOLUME);
/** 세이브 번호를 폴더 이름으로 쓸 수 있게(없으면 '_'). */
export const safeKey = (sid: unknown): string => (typeof sid === 'string' ? sid : '').replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '').slice(0, 60) || '_';
export const cleanLyrics = (s: unknown): string => (typeof s === 'string' ? s.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, 8000) : '');
export const cleanTitle = (s: unknown): string => (typeof s === 'string' ? s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '');
const kindOk = (k: unknown): k is MusicKind => k === 'anthem' || k === 'march' || k === 'creed';
export { kindOk as isMusicKind };
export function sanitizeStore(v: unknown): MusicStore {
  const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>, saves: MusicStore['saves'] = {};
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) {
    for (const [sid, tracks] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
      if (!tracks || typeof tracks !== 'object' || Array.isArray(tracks)) continue;
      const mine: Partial<Record<MusicKind, UserTrack>> = {};
      for (const [k, t] of Object.entries(tracks as Record<string, unknown>)) {
        if (!kindOk(k) || !t || typeof t !== 'object') continue;
        const x = t as Record<string, unknown>; if (typeof x.file !== 'string' || x.file.length > 600) continue;
        if (!x.file && !(k === 'creed' && cleanLyrics(x.lyrics))) continue; // 곡 파일이 없으면 복무신조 본문이 있어야 한다
        const cues = k === 'creed' ? cleanCues(x.cues) : undefined; mine[k] = { file: x.file, title: cleanTitle(x.title), lyrics: cleanLyrics(x.lyrics), ...(cues ? { cues, cueSrc: cueSrcOk(x.cueSrc) ? x.cueSrc : 'manual' } : {}) };
      }
      if (Object.keys(mine).length) saves[safeKey(sid)] = mine;
    }
  }
  const picks: MusicStore['picks'] = {};
  if (o.picks && typeof o.picks === 'object' && !Array.isArray(o.picks)) {
    for (const [sid, m] of Object.entries(o.picks as Record<string, unknown>).slice(0, 500)) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) continue; const one: Partial<Record<MusicKind, string>> = {};
      for (const [k, id] of Object.entries(m as Record<string, unknown>)) if (kindOk(k) && typeof id === 'string' && /^[a-zA-Z0-9_.-]{1,64}$/.test(id)) one[k] = id;
      if (Object.keys(one).length) picks[safeKey(sid)] = one;
    }
  }
  return { volume: clampVolume(o.volume), saves, picks, ceremony: sanitizeCeremony(o.ceremony) };
}
/** 애드온 곡 고르기: 고른 애드온이 아직 켜져 있으면 그것, 아니면 맨 위 애드온, 하나도 없으면 null(인식 안 함). */
export function chooseAddon(list: PlayTrack[], pickId: string | undefined): PlayTrack | null {
  return (pickId ? list.find((t) => t.addonId === pickId) : undefined) ?? list[0] ?? null;
}
/** 화면에 보낼 곡: 사용자 곡(재생할 file URL 이 있을 때)이 먼저, 없으면 애드온 곡. */
export interface EffectiveTrack { url: string; title: string; lyrics: string; source: 'user' | 'addon'; origin: string; cues?: number[]; cueSrc?: CueSrc }
export function effectiveTrack(user: UserTrack | undefined, userUrl: string | null, addon: PlayTrack | null, userLabel = ''): EffectiveTrack | null {
  if (user && (userUrl || (!user.file && user.lyrics))) return { url: userUrl ?? '', title: user.title, lyrics: user.lyrics, source: 'user', origin: userLabel, ...(user.cues && userUrl ? { cues: user.cues, cueSrc: user.cueSrc ?? 'manual' } : {}) };
  if (addon) return { url: addon.url, title: addon.title, lyrics: addon.lyrics, source: 'addon', origin: addon.addonName };
  return null;
}

// ── 복무신조 AI 작성·낭독(2026-10-20) ────────────────────────────────────────────
import type { ChatMessage } from './player2';
import { ETHIC_BITS, NOMADIC_BIT } from './faction-meeting';
export const CREED_MAX = 1500;
/** 제국 가치관 비트 → 영어 이름들(프롬프트용). 모르면 빈 배열. */
export function creedEthics(bits: number | undefined): string[] {
  if (bits === undefined || !Number.isSafeInteger(bits) || bits < 0) return [];
  const out = (Object.keys(ETHIC_BITS) as Array<keyof typeof ETHIC_BITS>).filter((e) => (bits & ETHIC_BITS[e]) !== 0) as string[];
  if (bits & NOMADIC_BIT) out.push('nomadic');
  return out;
}
/** AI 에게 복무신조를 쓰게 하는 요청. 언어는 AiRouter 가 응답 언어 지시를 붙인다. 실제 군대·기관의 신조를 베끼지 않게 한다. */
export function creedMessages(empire: string, ethics: string[], gestalt: boolean, date: string): ChatMessage[] {
  const sys = 'You write the service creed (oath of duty) recited by the armed forces of a fictional space empire in the game Stellaris. '
    + 'Write ORIGINAL text only: never copy or closely paraphrase any real-world military, police or organization creed, oath or anthem. '
    + 'Length: 6 to 10 short lines, one sentence per line, each easy to recite aloud, no numbering, no markdown. '
    + 'Reflect the empire\'s character. Output ONLY JSON: {"title":"short creed title","text":"line1\\nline2\\n..."}.';
  const traits = [ethics.length ? 'ethics: ' + ethics.join(', ') : '', gestalt ? 'a gestalt consciousness (hive mind or machine intelligence); speak as one collective' : ''].filter(Boolean).join('; ');
  const usr = `Empire: ${String(empire || 'the empire').slice(0, 80)}${traits ? '\nCharacter — ' + traits : ''}${date ? '\nGame date: ' + date : ''}\nWrite the service creed.`;
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
/** AI 응답 → {title,text}. JSON(text 가 문자열이거나 줄 배열)이거나 그냥 글이어도 받는다. 너무 짧으면 null. */
export function parseCreed(raw: unknown): { title: string; text: string } | null {
  const s = typeof raw === 'string' ? raw : ''; let title = '', text = '';
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { const j = JSON.parse(s.slice(a, b + 1)) as Record<string, unknown>; title = cleanTitle(j.title); const t = j.text ?? j.creed ?? j.lines; text = Array.isArray(t) ? t.filter((x) => typeof x === 'string').join('\n') : typeof t === 'string' ? t : ''; } catch { /* 아래 평문으로 */ }
  }
  if (!text && a < 0 && !/^\s*(?:```|\[)/.test(s)) text = s;
  text = cleanLyrics(text).split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).join('\n').slice(0, CREED_MAX).trim();
  return text.length >= 20 ? { title, text } : null;
}
/** 음성 합성은 한 번에 600자까지: 줄 경계로 묶어 나눈다(긴 줄은 문장·글자 단위로 자른다). */
export function speechChunks(text: string, max = 580): string[] {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean), out: string[] = []; let cur = '';
  const flush = () => { if (cur) out.push(cur); cur = ''; };
  for (const l0 of lines) {
    let l = l0;
    while (l.length > max) { const cut = Math.max(l.lastIndexOf('. ', max), l.lastIndexOf('。', max), l.lastIndexOf(' ', max)); const at = cut > max / 2 ? cut + 1 : max; flush(); out.push(l.slice(0, at).trim()); l = l.slice(at).trim(); }
    if (!l) continue;
    if (cur && cur.length + 1 + l.length > max) flush();
    cur = cur ? cur + '\n' + l : l;
  }
  flush(); return out.slice(0, 4);
}
export const CREED_VOICE_INSTRUCT = 'Recite slowly in a firm, solemn, resolute voice, like soldiers swearing an oath. Pause briefly between lines.';

// ── 복무신조 낭독 설정(2026-10-20): 목소리 성별·혼자/선창+제창/단체·인원·효과·엔진 ─────────────────────────
export type CreedGender = 'male' | 'female' | 'mixed';
export type CreedHow = 'solo' | 'lead' | 'group';
export type CreedFx = 'none' | 'radio' | 'megaphone' | 'hall';
export type CreedEngine = 'auto' | 'openai' | 'p2';
export interface CreedOpts { gender: CreedGender; how: CreedHow; n: number; fx: CreedFx; engine: CreedEngine }
export const DEFAULT_CREED_OPTS: CreedOpts = { gender: 'male', how: 'solo', n: 3, fx: 'none', engine: 'auto' };
export const CREED_MAX_VOICES = 4, CREED_MAX_SEGS = 12;
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
/** 화면에서 온 설정을 안전한 값으로(모르는 값은 기본값, 인원은 2~4, 혼자면 1명). */
export function creedOpts(v: unknown): CreedOpts {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const how = oneOf(o.how, ['solo', 'lead', 'group'] as const, 'solo');
  const n = how === 'solo' ? 1 : Math.min(CREED_MAX_VOICES, Math.max(2, Math.round(Number(o.n)) || DEFAULT_CREED_OPTS.n));
  return { gender: oneOf(o.gender, ['male', 'female', 'mixed'] as const, 'male'), how, n, fx: oneOf(o.fx, ['none', 'radio', 'megaphone', 'hall'] as const, 'none'), engine: oneOf(o.engine, ['auto', 'openai', 'p2'] as const, 'auto') };
}
/** 줄마다 따로 합성해 시작을 맞춘다. 줄이 12개를 넘으면 이웃한 줄끼리 묶는다. */
export function creedSegments(text: string, max = CREED_MAX_SEGS): string[] {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean); if (lines.length <= max) return lines;
  const out: string[] = []; const per = lines.length / max;
  for (let i = 0; i < max; i++) out.push(lines.slice(Math.round(i * per), Math.round((i + 1) * per)).join(' '));
  return out.filter(Boolean);
}
/** 성별에 맞게 n명 고르기: 혼성은 남·여 번갈아(남성 먼저), 목소리가 모자라면 돌려 쓴다. 목소리가 하나도 없으면 빈 목록. */
export function castPick<T>(male: T[], female: T[], gender: CreedGender, n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const wantMale = gender === 'male' ? true : gender === 'female' ? false : i % 2 === 0;
    const pool = wantMale ? (male.length ? male : female) : (female.length ? female : male); if (!pool.length) return [];
    out.push(pool[Math.floor(i / (gender === 'mixed' ? 2 : 1)) % pool.length]);
  }
  return out;
}
export const OPENAI_CAST = { male: ['onyx', 'echo', 'ash', 'fable'], female: ['nova', 'shimmer', 'coral', 'sage'] };
export const CREED_GROUP_INSTRUCT = 'Shout this line loudly in unison, as a crowd of soldiers reciting an oath together: crisp, forceful, short and punchy. No pause at the end.';
/** 목소리 합성 호출 횟수(경고·상한 점검용): 혼자 1, 선창+제창 = 첫 줄 1 + 나머지×인원, 단체 = 줄×인원. */
export function creedCalls(o: CreedOpts, segs: number): number {
  if (o.how === 'solo') return 1; if (segs <= 0) return 0;
  return o.how === 'lead' ? 1 + (segs - 1) * o.n : segs * o.n;
}

/** 복무신조 줄 수(의식 창과 같은 규칙: 빈 줄 제외, 40줄까지). */
export const creedLineCount = (text: string): number => String(text || '').split('\n').filter((l) => l.trim()).length && Math.min(40, String(text || '').split('\n').filter((l) => l.trim()).length);
/** 쉼 찾기: 소리 크기 봉투(frameSec 간격 RMS)에서 조용한 구간을 찾아 줄 시작 시각으로. lines-1 개 이상 쉼이 있어야 성공, 아니면 null.
 *  조용함 = 봉투 상위 수준(90퍼센타일)의 8% 아래가 minGap 초 이상 이어짐. 쉼이 많으면 긴 것부터 lines-1 개를 고른다. */
export function cuesFromSilence(env: number[], frameSec: number, lines: number, minGap = 0.22): { cues: number[]; gaps: number } | null {
  if (!Array.isArray(env) || env.length < 10 || !(frameSec > 0) || lines < 2 || lines > 40) return null;
  const sorted = env.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b); if (sorted.length < 10) return null;
  const hi = sorted[Math.floor(sorted.length * 0.9)], th = hi * 0.08; if (!(hi > 0)) return null;
  // 앞뒤 무음은 제외: 첫 소리·마지막 소리 사이에서만 쉼을 찾는다
  let first = env.findIndex((x) => x >= th), last = env.length - 1; while (last > first && env[last] < th) last--;
  if (first < 0 || last - first < 10) return null;
  const gaps: Array<{ s: number; e: number }> = []; let gs = -1;
  for (let i = first; i <= last; i++) { const quiet = env[i] < th; if (quiet && gs < 0) gs = i; else if (!quiet && gs >= 0) { if ((i - gs) * frameSec >= minGap) gaps.push({ s: gs, e: i }); gs = -1; } }
  if (gaps.length < lines - 1) return null;
  const pickd = gaps.slice().sort((a, b) => (b.e - b.s) - (a.e - a.s)).slice(0, lines - 1).sort((a, b) => a.s - b.s);
  const cues = [Math.round(first * frameSec * 100) / 100, ...pickd.map((g) => Math.round(g.e * frameSec * 100) / 100)];
  return { cues, gaps: gaps.length };
}

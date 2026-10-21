// 라디오 AI 음성(2026-10-17) 순수 도우미: 쓸 수 있는지 판단·요청 본문. 실제 호출은 features/tts-app.ts.
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TTS_VOICES = ['nova', 'shimmer', 'onyx', 'alloy', 'echo', 'ash', 'coral', 'sage', 'fable'];
export const TTS_INSTRUCT = 'Speak like a calm, professional radio news broadcaster.';

/** AI 음성을 쓸 수 있는가: 개인 연결 모드 + OpenAI 연결 + 키. 안 되면 이유(한/영). */
export function ttsAiReady(mode: string, provider: string | undefined, hasKey: boolean): { ok: boolean; ko: string; en: string } {
  if (mode !== 'custom') return { ok: false, ko: 'AI 음성은 설정 → AI 연결에서 개인 OpenAI 연결을 쓸 때만 됩니다. 윈도우 음성으로 읽습니다.', en: 'AI voice needs a personal OpenAI connection (Settings → AI). Using the Windows voice instead.' };
  if (provider !== 'openai') return { ok: false, ko: 'AI 음성은 OpenAI 연결에서만 됩니다(지금 연결은 음성 기능이 없음). 윈도우 음성으로 읽습니다.', en: 'AI voice only works with an OpenAI connection. Using the Windows voice instead.' };
  if (!hasKey) return { ok: false, ko: 'OpenAI API 키가 없습니다. 윈도우 음성으로 읽습니다.', en: 'No OpenAI API key. Using the Windows voice instead.' };
  return { ok: true, ko: '', en: '' };
}
export function ttsBody(text: string, voice: string, instructions: string = TTS_INSTRUCT): { model: string; voice: string; input: string; response_format: 'mp3'; instructions: string } {
  return { model: TTS_MODEL, voice: TTS_VOICES.includes(voice) ? voice : 'alloy', input: String(text || '').slice(0, 600), response_format: 'mp3', instructions };
}

// ── Player2 음성(2026-10-20): 앱이 켜져 있으면 키 없이 쓴다. 목소리 목록은 Player2 가 준다(성별·언어 포함, 한국어 목소리는 없음).
export interface P2Voice { id: string; name: string; language: string; gender: 'male' | 'female' }
/** Player2 목록을 믿을 수 있는 모양으로 거른다. */
export function p2Voices(v: unknown): P2Voice[] {
  if (!Array.isArray(v)) return [];
  const out: P2Voice[] = [];
  for (const x of v.slice(0, 200)) {
    if (!x || typeof x !== 'object') continue; const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(o.id) || typeof o.name !== 'string' || typeof o.language !== 'string') continue;
    if (o.gender !== 'male' && o.gender !== 'female') continue;
    out.push({ id: o.id, name: o.name.slice(0, 40), language: o.language.slice(0, 40), gender: o.gender });
  }
  return out;
}
/** 글자로 언어 판단(ui/tts.js 의 langOf 와 같은 규칙). */
export function p2LangOf(text: string): string { const t = String(text || ''); return /[가-힣]/.test(t) ? 'ko' : /[\u3040-\u30ff]/.test(t) ? 'ja' : /[\u4e00-\u9fff]/.test(t) ? 'zh' : /[\u0400-\u04ff]/.test(t) ? 'ru' : 'en'; }
/** 글의 언어 → Player2 목소리 언어. 한국어·러시아어 목소리는 없어서 미국 영어로 대신한다(발음이 어색할 수 있음). */
export const P2_LANG: Record<string, string> = { ko: 'american_english', en: 'american_english', ja: 'japanese', zh: 'mandarin_chinese', ru: 'american_english' };
export function p2Pool(list: P2Voice[], lang: string): P2Voice[] {
  const want = P2_LANG[lang] ?? 'american_english'; const a = list.filter((x) => x.language === want);
  return a.length ? a : list.filter((x) => x.language === 'american_english');
}
/** 라디오 화자 → 목소리: 앵커=여성 첫째, 공동 진행=여성 둘째, 리포터=남성 첫째(없으면 있는 것으로 돌려 씀). */
export function p2VoiceFor(list: P2Voice[], lang: string, who: string): string | null {
  const pool = p2Pool(list, lang); if (!pool.length) return null;
  const f = pool.filter((x) => x.gender === 'female'), m = pool.filter((x) => x.gender === 'male'), any = pool;
  const pick = who === 'reporter' ? (m[0] ?? any[0]) : who === 'cohost' ? (f[1] ?? f[0] ?? any[1 % any.length]) : (f[0] ?? any[0]);
  return pick.id;
}

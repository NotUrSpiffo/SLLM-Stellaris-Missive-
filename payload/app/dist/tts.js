"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2_LANG = exports.TTS_INSTRUCT = exports.TTS_VOICES = exports.TTS_MODEL = void 0;
exports.ttsAiReady = ttsAiReady;
exports.ttsBody = ttsBody;
exports.p2Voices = p2Voices;
exports.p2LangOf = p2LangOf;
exports.p2Pool = p2Pool;
exports.p2VoiceFor = p2VoiceFor;
// 라디오 AI 음성(2026-10-17) 순수 도우미: 쓸 수 있는지 판단·요청 본문. 실제 호출은 features/tts-app.ts.
exports.TTS_MODEL = 'gpt-4o-mini-tts';
exports.TTS_VOICES = ['nova', 'shimmer', 'onyx', 'alloy', 'echo', 'ash', 'coral', 'sage', 'fable'];
exports.TTS_INSTRUCT = 'Speak like a calm, professional radio news broadcaster.';
/** AI 음성을 쓸 수 있는가: 개인 연결 모드 + OpenAI 연결 + 키. 안 되면 이유(한/영). */
function ttsAiReady(mode, provider, hasKey) {
    if (mode !== 'custom')
        return { ok: false, ko: 'AI 음성은 설정 → AI 연결에서 개인 OpenAI 연결을 쓸 때만 됩니다. 윈도우 음성으로 읽습니다.', en: 'AI voice needs a personal OpenAI connection (Settings → AI). Using the Windows voice instead.' };
    if (provider !== 'openai')
        return { ok: false, ko: 'AI 음성은 OpenAI 연결에서만 됩니다(지금 연결은 음성 기능이 없음). 윈도우 음성으로 읽습니다.', en: 'AI voice only works with an OpenAI connection. Using the Windows voice instead.' };
    if (!hasKey)
        return { ok: false, ko: 'OpenAI API 키가 없습니다. 윈도우 음성으로 읽습니다.', en: 'No OpenAI API key. Using the Windows voice instead.' };
    return { ok: true, ko: '', en: '' };
}
function ttsBody(text, voice, instructions = exports.TTS_INSTRUCT) {
    return { model: exports.TTS_MODEL, voice: exports.TTS_VOICES.includes(voice) ? voice : 'alloy', input: String(text || '').slice(0, 600), response_format: 'mp3', instructions };
}
/** Player2 목록을 믿을 수 있는 모양으로 거른다. */
function p2Voices(v) {
    if (!Array.isArray(v))
        return [];
    const out = [];
    for (const x of v.slice(0, 200)) {
        if (!x || typeof x !== 'object')
            continue;
        const o = x;
        if (typeof o.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(o.id) || typeof o.name !== 'string' || typeof o.language !== 'string')
            continue;
        if (o.gender !== 'male' && o.gender !== 'female')
            continue;
        out.push({ id: o.id, name: o.name.slice(0, 40), language: o.language.slice(0, 40), gender: o.gender });
    }
    return out;
}
/** 글자로 언어 판단(ui/tts.js 의 langOf 와 같은 규칙). */
function p2LangOf(text) { const t = String(text || ''); return /[가-힣]/.test(t) ? 'ko' : /[\u3040-\u30ff]/.test(t) ? 'ja' : /[\u4e00-\u9fff]/.test(t) ? 'zh' : /[\u0400-\u04ff]/.test(t) ? 'ru' : 'en'; }
/** 글의 언어 → Player2 목소리 언어. 한국어·러시아어 목소리는 없어서 미국 영어로 대신한다(발음이 어색할 수 있음). */
exports.P2_LANG = { ko: 'american_english', en: 'american_english', ja: 'japanese', zh: 'mandarin_chinese', ru: 'american_english' };
function p2Pool(list, lang) {
    const want = exports.P2_LANG[lang] ?? 'american_english';
    const a = list.filter((x) => x.language === want);
    return a.length ? a : list.filter((x) => x.language === 'american_english');
}
/** 라디오 화자 → 목소리: 앵커=여성 첫째, 공동 진행=여성 둘째, 리포터=남성 첫째(없으면 있는 것으로 돌려 씀). */
function p2VoiceFor(list, lang, who) {
    const pool = p2Pool(list, lang);
    if (!pool.length)
        return null;
    const f = pool.filter((x) => x.gender === 'female'), m = pool.filter((x) => x.gender === 'male'), any = pool;
    const pick = who === 'reporter' ? (m[0] ?? any[0]) : who === 'cohost' ? (f[1] ?? f[0] ?? any[1 % any.length]) : (f[0] ?? any[0]);
    return pick.id;
}
//# sourceMappingURL=tts.js.map
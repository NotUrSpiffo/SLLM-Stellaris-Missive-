// 라디오 음성으로 듣기(2026-10-17). 기본은 윈도우 내장 음성(speechSynthesis, 무료·오프라인),
// 고르면 AI 음성(OpenAI 개인 연결일 때만, 앱 본체가 /audio/speech 를 불러 mp3 를 돌려줌)에 라디오 필터(WebAudio)를 씌운다.
// 순수 도우미(langOf·cleanText·pickVoices·aiVoiceOf)는 selftest 가 이 파일을 그대로 읽어 검사한다.
(function (root) {
  // 글자로 언어 판단: 한글 → ko, 가나 → ja, 한자 → zh, 키릴 → ru, 그 밖 → en (언어 팩 대본도 맞는 목소리로, 2026-10-18)
  const langOf = (text) => { const t = String(text || ''); return /[가-힣]/.test(t) ? 'ko' : /[\u3040-\u30ff]/.test(t) ? 'ja' : /[\u4e00-\u9fff]/.test(t) ? 'zh' : /[\u0400-\u04ff]/.test(t) ? 'ru' : 'en'; };
  const LOCALE = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU' };
  // 읽어 줄 문장만 남긴다: 괄호 속 지문·이모지·URL 은 소리 내지 않는다
  const cleanText = (text) => String(text || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\(\[（][^\)\]）]{0,40}[\)\]）]/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️]/gu, ' ')
    .replace(/[*_#>`~]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 600);
  // 화자마다 다른 목소리. 언어에 맞는 목소리가 하나뿐이면 높낮이·빠르기로 구분한다.
  const SHAPE = { announcer: { pitch: 1.0, rate: 1.05 }, cohost: { pitch: 1.18, rate: 1.0 }, reporter: { pitch: 0.86, rate: 1.1 } };
  function pickVoices(voices, lang) {
    const want = new RegExp('^' + (LOCALE[lang] ? lang : 'en'), 'i');
    const list = (voices || []).filter((v) => want.test(String(v.lang || '')));
    const rank = (v) => (/natural|neural|online/i.test(v.name) ? 0 : 1) + (v.localService === false ? 0 : 0.5);
    list.sort((a, b) => rank(a) - rank(b));
    const out = {};
    ['announcer', 'reporter', 'cohost'].forEach((who, i) => { const v = list.length ? list[i % list.length] : null; out[who] = { voice: v, pitch: SHAPE[who].pitch, rate: SHAPE[who].rate }; });
    return list.length ? out : null;
  }
  const AI_VOICE = { announcer: 'nova', cohost: 'shimmer', reporter: 'onyx' };
  const aiVoiceOf = (who) => AI_VOICE[who] || 'alloy';

  let token = 0, ctx = null, curSrc = null;
  function stop() {
    token++;
    try { root.speechSynthesis && root.speechSynthesis.cancel(); } catch (e) { /* 없음 */ }
    try { if (curSrc) curSrc.stop(); } catch (e) { /* 이미 멈춤 */ }
    curSrc = null;
  }
  function voicesReady() {
    return new Promise((res) => {
      const s = root.speechSynthesis; if (!s) return res([]);
      const v = s.getVoices(); if (v.length) return res(v);
      let done = false; const fin = () => { if (!done) { done = true; res(s.getVoices()); } };
      s.addEventListener && s.addEventListener('voiceschanged', fin, { once: true }); setTimeout(fin, 1500);
    });
  }
  function sayOne(text, shape, lang) {
    return new Promise((res) => {
      const u = new root.SpeechSynthesisUtterance(text);
      if (shape.voice) u.voice = shape.voice; u.lang = LOCALE[lang] || 'en-US'; u.pitch = shape.pitch; u.rate = shape.rate;
      u.onend = () => res(); u.onerror = () => res(); root.speechSynthesis.speak(u);
    });
  }
  async function speakSystem(lines, onLine) {
    const my = ++token; if (!root.speechSynthesis) return { ok: false, reason: 'nosynth' };
    const all = await voicesReady(); if (my !== token) return { ok: true };
    const lang = langOf(lines.map((l) => l.text).join(' '));
    const vs = pickVoices(all, lang); if (!vs) return { ok: false, reason: 'novoice', lang };
    for (let i = 0; i < lines.length; i++) {
      if (my !== token) return { ok: true };
      const t = cleanText(lines[i].text); if (!t) continue;
      onLine && onLine(i); await sayOne(t, vs[lines[i].who] || vs.announcer, lang);
    }
    return { ok: true };
  }
  // 라디오 느낌: 전화 대역(300~3400Hz) + 살짝 찌그러짐 + 아주 작은 잡음
  function radioChain(ac) {
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3300;
    const ws = ac.createWaveShaper(); const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); } ws.curve = c;
    const g = ac.createGain(); g.gain.value = 0.9; hp.connect(lp); lp.connect(ws); ws.connect(g); g.connect(ac.destination);
    return hp;
  }
  function noise(ac, sec) {
    const len = Math.max(1, Math.floor(ac.sampleRate * sec)), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
    const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); return s;
  }
  const b64ToBuf = (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  async function speakAi(lines, fetchAudio, onLine, voiceOf) {
    const vOf = voiceOf || aiVoiceOf;
    const my = ++token;
    ctx = ctx || new (root.AudioContext || root.webkitAudioContext)(); if (ctx.state === 'suspended') await ctx.resume();
    const items = lines.map((l) => ({ who: l.who, text: cleanText(l.text) })).filter((x) => x.text);
    let nextP = items.length ? fetchAudio(items[0].text, vOf(items[0].who)) : null;
    for (let i = 0; i < items.length; i++) {
      const r = await nextP; if (my !== token) return { ok: true };
      nextP = i + 1 < items.length ? fetchAudio(items[i + 1].text, vOf(items[i + 1].who)) : null; // 읽는 동안 다음 줄을 미리 받는다
      if (!r || !r.ok) return { ok: false, reason: 'ai', error: r && r.error };
      const buf = await ctx.decodeAudioData(b64ToBuf(r.b64)); if (my !== token) return { ok: true };
      onLine && onLine(lines.findIndex((l) => cleanText(l.text) === items[i].text));
      await new Promise((res) => { const s = ctx.createBufferSource(); s.buffer = buf; s.connect(radioChain(ctx)); const nz = noise(ctx, buf.duration + 0.2); s.onended = () => { try { nz.stop(); } catch (e) { /* 없음 */ } res(); }; curSrc = s; nz.start(); s.start(); });
    }
    return { ok: true };
  }
  root.SLLMTts = { langOf, cleanText, pickVoices, aiVoiceOf, speakSystem, speakAi, stop };
})(typeof window !== 'undefined' ? window : globalThis);

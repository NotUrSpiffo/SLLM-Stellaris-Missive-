"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creedLineCount = exports.CREED_GROUP_INSTRUCT = exports.OPENAI_CAST = exports.CREED_MAX_SEGS = exports.CREED_MAX_VOICES = exports.DEFAULT_CREED_OPTS = exports.CREED_VOICE_INSTRUCT = exports.CREED_MAX = exports.isMusicKind = exports.cleanTitle = exports.cleanLyrics = exports.safeKey = exports.clampVolume = exports.DEFAULT_CEREMONY = exports.DEFAULT_VOLUME = exports.cueSrcOk = exports.MUSIC_KINDS_ALL = void 0;
exports.sanitizeCeremony = sanitizeCeremony;
exports.cleanCues = cleanCues;
exports.sanitizeStore = sanitizeStore;
exports.chooseAddon = chooseAddon;
exports.effectiveTrack = effectiveTrack;
exports.creedEthics = creedEthics;
exports.creedMessages = creedMessages;
exports.parseCreed = parseCreed;
exports.speechChunks = speechChunks;
exports.creedOpts = creedOpts;
exports.creedSegments = creedSegments;
exports.castPick = castPick;
exports.creedCalls = creedCalls;
exports.cuesFromSilence = cuesFromSilence;
exports.MUSIC_KINDS_ALL = ['anthem', 'march', 'creed'];
const cueSrcOk = (v) => v === 'ai' || v === 'silence' || v === 'manual';
exports.cueSrcOk = cueSrcOk;
exports.DEFAULT_VOLUME = 0.6;
exports.DEFAULT_CEREMONY = { darkness: 0.62, embers: true, drone: true, persp: false, askPause: true };
function sanitizeCeremony(v) {
    const o = (v && typeof v === 'object' ? v : {}), b = (x, d) => (typeof x === 'boolean' ? x : d);
    const dk = typeof o.darkness === 'number' && Number.isFinite(o.darkness) ? Math.min(0.85, Math.max(0.35, Math.round(o.darkness * 100) / 100)) : exports.DEFAULT_CEREMONY.darkness;
    return { darkness: dk, embers: b(o.embers, true), drone: b(o.drone, true), persp: b(o.persp, false), askPause: b(o.askPause, true) };
}
/** 줄별 시작 시각 검사: 0 이상, 오름차순, 600초 이내, 최대 40줄. 아니면 undefined. */
function cleanCues(v) {
    if (!Array.isArray(v) || !v.length || v.length > 40)
        return undefined;
    const out = [];
    let prev = -1;
    for (const x of v) {
        if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 600 || x < prev)
            return undefined;
        out.push(Math.round(x * 100) / 100);
        prev = x;
    }
    return out;
}
const clampVolume = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 100) / 100)) : exports.DEFAULT_VOLUME);
exports.clampVolume = clampVolume;
/** 세이브 번호를 폴더 이름으로 쓸 수 있게(없으면 '_'). */
const safeKey = (sid) => (typeof sid === 'string' ? sid : '').replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '').slice(0, 60) || '_';
exports.safeKey = safeKey;
const cleanLyrics = (s) => (typeof s === 'string' ? s.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, 8000) : '');
exports.cleanLyrics = cleanLyrics;
const cleanTitle = (s) => (typeof s === 'string' ? s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '');
exports.cleanTitle = cleanTitle;
const kindOk = (k) => k === 'anthem' || k === 'march' || k === 'creed';
exports.isMusicKind = kindOk;
function sanitizeStore(v) {
    const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), saves = {};
    if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) {
        for (const [sid, tracks] of Object.entries(o.saves).slice(0, 500)) {
            if (!tracks || typeof tracks !== 'object' || Array.isArray(tracks))
                continue;
            const mine = {};
            for (const [k, t] of Object.entries(tracks)) {
                if (!kindOk(k) || !t || typeof t !== 'object')
                    continue;
                const x = t;
                if (typeof x.file !== 'string' || x.file.length > 600)
                    continue;
                if (!x.file && !(k === 'creed' && (0, exports.cleanLyrics)(x.lyrics)))
                    continue; // 곡 파일이 없으면 복무신조 본문이 있어야 한다
                const cues = k === 'creed' ? cleanCues(x.cues) : undefined;
                mine[k] = { file: x.file, title: (0, exports.cleanTitle)(x.title), lyrics: (0, exports.cleanLyrics)(x.lyrics), ...(cues ? { cues, cueSrc: (0, exports.cueSrcOk)(x.cueSrc) ? x.cueSrc : 'manual' } : {}) };
            }
            if (Object.keys(mine).length)
                saves[(0, exports.safeKey)(sid)] = mine;
        }
    }
    const picks = {};
    if (o.picks && typeof o.picks === 'object' && !Array.isArray(o.picks)) {
        for (const [sid, m] of Object.entries(o.picks).slice(0, 500)) {
            if (!m || typeof m !== 'object' || Array.isArray(m))
                continue;
            const one = {};
            for (const [k, id] of Object.entries(m))
                if (kindOk(k) && typeof id === 'string' && /^[a-zA-Z0-9_.-]{1,64}$/.test(id))
                    one[k] = id;
            if (Object.keys(one).length)
                picks[(0, exports.safeKey)(sid)] = one;
        }
    }
    return { volume: (0, exports.clampVolume)(o.volume), saves, picks, ceremony: sanitizeCeremony(o.ceremony) };
}
/** 애드온 곡 고르기: 고른 애드온이 아직 켜져 있으면 그것, 아니면 맨 위 애드온, 하나도 없으면 null(인식 안 함). */
function chooseAddon(list, pickId) {
    return (pickId ? list.find((t) => t.addonId === pickId) : undefined) ?? list[0] ?? null;
}
function effectiveTrack(user, userUrl, addon, userLabel = '') {
    if (user && (userUrl || (!user.file && user.lyrics)))
        return { url: userUrl ?? '', title: user.title, lyrics: user.lyrics, source: 'user', origin: userLabel, ...(user.cues && userUrl ? { cues: user.cues, cueSrc: user.cueSrc ?? 'manual' } : {}) };
    if (addon)
        return { url: addon.url, title: addon.title, lyrics: addon.lyrics, source: 'addon', origin: addon.addonName };
    return null;
}
const faction_meeting_1 = require("./faction-meeting");
exports.CREED_MAX = 1500;
/** 제국 가치관 비트 → 영어 이름들(프롬프트용). 모르면 빈 배열. */
function creedEthics(bits) {
    if (bits === undefined || !Number.isSafeInteger(bits) || bits < 0)
        return [];
    const out = Object.keys(faction_meeting_1.ETHIC_BITS).filter((e) => (bits & faction_meeting_1.ETHIC_BITS[e]) !== 0);
    if (bits & faction_meeting_1.NOMADIC_BIT)
        out.push('nomadic');
    return out;
}
/** AI 에게 복무신조를 쓰게 하는 요청. 언어는 AiRouter 가 응답 언어 지시를 붙인다. 실제 군대·기관의 신조를 베끼지 않게 한다. */
function creedMessages(empire, ethics, gestalt, date) {
    const sys = 'You write the service creed (oath of duty) recited by the armed forces of a fictional space empire in the game Stellaris. '
        + 'Write ORIGINAL text only: never copy or closely paraphrase any real-world military, police or organization creed, oath or anthem. '
        + 'Length: 6 to 10 short lines, one sentence per line, each easy to recite aloud, no numbering, no markdown. '
        + 'Reflect the empire\'s character. Output ONLY JSON: {"title":"short creed title","text":"line1\\nline2\\n..."}.';
    const traits = [ethics.length ? 'ethics: ' + ethics.join(', ') : '', gestalt ? 'a gestalt consciousness (hive mind or machine intelligence); speak as one collective' : ''].filter(Boolean).join('; ');
    const usr = `Empire: ${String(empire || 'the empire').slice(0, 80)}${traits ? '\nCharacter — ' + traits : ''}${date ? '\nGame date: ' + date : ''}\nWrite the service creed.`;
    return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
/** AI 응답 → {title,text}. JSON(text 가 문자열이거나 줄 배열)이거나 그냥 글이어도 받는다. 너무 짧으면 null. */
function parseCreed(raw) {
    const s = typeof raw === 'string' ? raw : '';
    let title = '', text = '';
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
        try {
            const j = JSON.parse(s.slice(a, b + 1));
            title = (0, exports.cleanTitle)(j.title);
            const t = j.text ?? j.creed ?? j.lines;
            text = Array.isArray(t) ? t.filter((x) => typeof x === 'string').join('\n') : typeof t === 'string' ? t : '';
        }
        catch { /* 아래 평문으로 */ }
    }
    if (!text && a < 0 && !/^\s*(?:```|\[)/.test(s))
        text = s;
    text = (0, exports.cleanLyrics)(text).split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).join('\n').slice(0, exports.CREED_MAX).trim();
    return text.length >= 20 ? { title, text } : null;
}
/** 음성 합성은 한 번에 600자까지: 줄 경계로 묶어 나눈다(긴 줄은 문장·글자 단위로 자른다). */
function speechChunks(text, max = 580) {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean), out = [];
    let cur = '';
    const flush = () => { if (cur)
        out.push(cur); cur = ''; };
    for (const l0 of lines) {
        let l = l0;
        while (l.length > max) {
            const cut = Math.max(l.lastIndexOf('. ', max), l.lastIndexOf('。', max), l.lastIndexOf(' ', max));
            const at = cut > max / 2 ? cut + 1 : max;
            flush();
            out.push(l.slice(0, at).trim());
            l = l.slice(at).trim();
        }
        if (!l)
            continue;
        if (cur && cur.length + 1 + l.length > max)
            flush();
        cur = cur ? cur + '\n' + l : l;
    }
    flush();
    return out.slice(0, 4);
}
exports.CREED_VOICE_INSTRUCT = 'Recite slowly in a firm, solemn, resolute voice, like soldiers swearing an oath. Pause briefly between lines.';
exports.DEFAULT_CREED_OPTS = { gender: 'male', how: 'solo', n: 3, fx: 'none', engine: 'auto' };
exports.CREED_MAX_VOICES = 4, exports.CREED_MAX_SEGS = 12;
const oneOf = (v, list, d) => (typeof v === 'string' && list.includes(v) ? v : d);
/** 화면에서 온 설정을 안전한 값으로(모르는 값은 기본값, 인원은 2~4, 혼자면 1명). */
function creedOpts(v) {
    const o = (v && typeof v === 'object' ? v : {});
    const how = oneOf(o.how, ['solo', 'lead', 'group'], 'solo');
    const n = how === 'solo' ? 1 : Math.min(exports.CREED_MAX_VOICES, Math.max(2, Math.round(Number(o.n)) || exports.DEFAULT_CREED_OPTS.n));
    return { gender: oneOf(o.gender, ['male', 'female', 'mixed'], 'male'), how, n, fx: oneOf(o.fx, ['none', 'radio', 'megaphone', 'hall'], 'none'), engine: oneOf(o.engine, ['auto', 'openai', 'p2'], 'auto') };
}
/** 줄마다 따로 합성해 시작을 맞춘다. 줄이 12개를 넘으면 이웃한 줄끼리 묶는다. */
function creedSegments(text, max = exports.CREED_MAX_SEGS) {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length <= max)
        return lines;
    const out = [];
    const per = lines.length / max;
    for (let i = 0; i < max; i++)
        out.push(lines.slice(Math.round(i * per), Math.round((i + 1) * per)).join(' '));
    return out.filter(Boolean);
}
/** 성별에 맞게 n명 고르기: 혼성은 남·여 번갈아(남성 먼저), 목소리가 모자라면 돌려 쓴다. 목소리가 하나도 없으면 빈 목록. */
function castPick(male, female, gender, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const wantMale = gender === 'male' ? true : gender === 'female' ? false : i % 2 === 0;
        const pool = wantMale ? (male.length ? male : female) : (female.length ? female : male);
        if (!pool.length)
            return [];
        out.push(pool[Math.floor(i / (gender === 'mixed' ? 2 : 1)) % pool.length]);
    }
    return out;
}
exports.OPENAI_CAST = { male: ['onyx', 'echo', 'ash', 'fable'], female: ['nova', 'shimmer', 'coral', 'sage'] };
exports.CREED_GROUP_INSTRUCT = 'Shout this line loudly in unison, as a crowd of soldiers reciting an oath together: crisp, forceful, short and punchy. No pause at the end.';
/** 목소리 합성 호출 횟수(경고·상한 점검용): 혼자 1, 선창+제창 = 첫 줄 1 + 나머지×인원, 단체 = 줄×인원. */
function creedCalls(o, segs) {
    if (o.how === 'solo')
        return 1;
    if (segs <= 0)
        return 0;
    return o.how === 'lead' ? 1 + (segs - 1) * o.n : segs * o.n;
}
/** 복무신조 줄 수(의식 창과 같은 규칙: 빈 줄 제외, 40줄까지). */
const creedLineCount = (text) => String(text || '').split('\n').filter((l) => l.trim()).length && Math.min(40, String(text || '').split('\n').filter((l) => l.trim()).length);
exports.creedLineCount = creedLineCount;
/** 쉼 찾기: 소리 크기 봉투(frameSec 간격 RMS)에서 조용한 구간을 찾아 줄 시작 시각으로. lines-1 개 이상 쉼이 있어야 성공, 아니면 null.
 *  조용함 = 봉투 상위 수준(90퍼센타일)의 8% 아래가 minGap 초 이상 이어짐. 쉼이 많으면 긴 것부터 lines-1 개를 고른다. */
function cuesFromSilence(env, frameSec, lines, minGap = 0.22) {
    if (!Array.isArray(env) || env.length < 10 || !(frameSec > 0) || lines < 2 || lines > 40)
        return null;
    const sorted = env.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
    if (sorted.length < 10)
        return null;
    const hi = sorted[Math.floor(sorted.length * 0.9)], th = hi * 0.08;
    if (!(hi > 0))
        return null;
    // 앞뒤 무음은 제외: 첫 소리·마지막 소리 사이에서만 쉼을 찾는다
    let first = env.findIndex((x) => x >= th), last = env.length - 1;
    while (last > first && env[last] < th)
        last--;
    if (first < 0 || last - first < 10)
        return null;
    const gaps = [];
    let gs = -1;
    for (let i = first; i <= last; i++) {
        const quiet = env[i] < th;
        if (quiet && gs < 0)
            gs = i;
        else if (!quiet && gs >= 0) {
            if ((i - gs) * frameSec >= minGap)
                gaps.push({ s: gs, e: i });
            gs = -1;
        }
    }
    if (gaps.length < lines - 1)
        return null;
    const pickd = gaps.slice().sort((a, b) => (b.e - b.s) - (a.e - a.s)).slice(0, lines - 1).sort((a, b) => a.s - b.s);
    const cues = [Math.round(first * frameSec * 100) / 100, ...pickd.map((g) => Math.round(g.e * frameSec * 100) / 100)];
    return { cues, gaps: gaps.length };
}
//# sourceMappingURL=music.js.map
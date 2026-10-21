"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiRouter = exports.VERTEX_MODELS = exports.providerChat = exports.PRESETS = void 0;
exports.redactKey = redactKey;
exports.normalizeBase = normalizeBase;
exports.validBase = validBase;
exports.compatChat = compatChat;
exports.vertexBody = vertexBody;
exports.vertexText = vertexText;
exports.parseServiceAccount = parseServiceAccount;
exports.buildJwt = buildJwt;
exports.vertexUrl = vertexUrl;
exports.vertexChat = vertexChat;
exports.listModels = listModels;
exports.checkDebateShape = checkDebateShape;
exports.testConn = testConn;
exports.conversationOf = conversationOf;
// 공통 AI 호출 계층: Player2(기본)와 사용자의 개인 API(OpenAI 호환)를 같은 chat()으로 부른다.
// 설정 화면과 호출 코드를 분리한다: 외교·평의회·뉴스는 모두 AiRouter.chat() 하나만 쓴다.
const diagnostics_1 = require("./diagnostics");
const player2_1 = require("./player2");
const language_1 = require("./language");
const i18n_pick_1 = require("./i18n-pick");
const crypto_1 = require("crypto");
const model_rotation_host_1 = require("./model-rotation-host");
const model_rotation_1 = require("./model-rotation");
exports.PRESETS = {
    openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', needsKey: true },
    openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', needsKey: true },
    gemini: { label: 'Google Gemini (OpenAI 호환)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', needsKey: true },
    // 2026-10-19 테스터 요청: Google Cloud Agent Platform(구 Vertex AI) API 키. OpenAI 호환이 아니라 Google 자체 형식(generateContent)으로 부른다.
    // 프로젝트에 묶인 키는 주소를 https://aiplatform.googleapis.com/v1/projects/<프로젝트ID>/locations/global/publishers/google 로 바꾼다.
    vertex: { label: 'Google Agent Platform · Vertex AI (API 키 · 서비스 계정)', baseUrl: 'https://aiplatform.googleapis.com/v1/publishers/google', needsKey: true },
    anthropic: { label: 'Anthropic Claude (OpenAI 호환)', baseUrl: 'https://api.anthropic.com/v1', needsKey: true },
    groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', needsKey: true },
    ollama: { label: 'Ollama (내 컴퓨터)', baseUrl: 'http://localhost:11434/v1', needsKey: false },
    lmstudio: { label: 'LM Studio (내 컴퓨터)', baseUrl: 'http://localhost:1234/v1', needsKey: false },
    custom: { label: '직접 입력 (OpenAI 호환)', baseUrl: '', needsKey: false },
};
/** 오류 문장·로그에 API 키가 섞여 나가지 않게 가린다. */
function redactKey(text, key) {
    let t = String(text ?? '');
    if (key && key.length >= 6)
        t = t.split(key).join('****');
    return t.replace(/(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{12,})/g, '****');
}
function normalizeBase(u) { return String(u ?? '').trim().replace(/\/+$/, ''); }
function validBase(u) { try {
    const x = new URL(normalizeBase(u));
    return x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname));
}
catch {
    return false;
} }
async function http(method, url, key, body, ms = 90000, parent, auth = 'bearer', signal) {
    (0, diagnostics_1.registerDiagnosticSecret)(key);
    const span = (0, diagnostics_1.diagnosticSpan)('ai.http', { parent, method, url, timeoutMs: ms });
    try {
        const headers = { 'content-type': 'application/json' };
        if (key) {
            if (auth === 'goog')
                headers['x-goog-api-key'] = key;
            else
                headers.authorization = `Bearer ${key}`;
        } // goog: Google API 키는 주소가 아니라 머리글로(로그에 키가 남지 않게)
        const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: signal ?? AbortSignal.timeout(ms) })
            .catch((e) => { throw new Error(redactKey(e && e.name === 'TimeoutError' ? `응답이 ${Math.round(ms / 1000)}초 넘게 없습니다.` : '연결 실패: ' + (e && e.message), key)); });
        const text = await res.text();
        span.end({ status: res.status, bytes: Buffer.byteLength(text) });
        return { status: res.status, text, retryAfter: res.headers?.get('retry-after') ?? null };
    }
    catch (e) {
        span.fail(e);
        throw e;
    }
}
/** OpenAI 호환 /chat/completions 한 번 호출. 일부 서비스가 거부하는 옵션은 한 번 빼고 다시 시도한다. */
async function compatChat(c, key, messages, opts = {}) {
    const url = normalizeBase(c.baseUrl) + '/chat/completions';
    const body = { model: c.model, messages, stream: false, max_tokens: opts.maxTokens ?? 300 };
    if (opts.json)
        body.response_format = { type: 'json_object' };
    let r = await http('POST', url, key, body, 90000, opts._diagnosticId, 'bearer', opts.signal);
    for (let i = 0; !opts._rotationSingle && i < 2 && r.status === 400; i++) {
        if (/max_completion_tokens/i.test(r.text) && body.max_tokens !== undefined) {
            body.max_completion_tokens = body.max_tokens;
            delete body.max_tokens;
        }
        else if (body.response_format && /response_format|json/i.test(r.text))
            delete body.response_format;
        else
            break;
        r = await http('POST', url, key, body, 90000, opts._diagnosticId);
    }
    if (opts._rotationSingle && r.status === 429)
        throw (0, model_rotation_1.googleHttpError)(r.status, r.text, r.retryAfter);
    if (r.status < 200 || r.status >= 300)
        throw new Error(redactKey(`${c.name || c.provider} ${r.status}: ${r.text.slice(0, 200)}`, key));
    let j;
    try {
        j = JSON.parse(r.text);
    }
    catch {
        throw new Error((0, i18n_pick_1.L)('응답을 해석할 수 없습니다: ', 'Could not parse the response: ') + redactKey(r.text.slice(0, 120), key));
    }
    (0, diagnostics_1.logDiagnostic)('info', 'ai.usage', { parent: opts._diagnosticId, provider: c.provider, model: c.model, promptTokens: j.usage?.prompt_tokens, completionTokens: j.usage?.completion_tokens, totalTokens: j.usage?.total_tokens, finishReason: j.choices?.[0]?.finish_reason });
    const ch = j.choices?.[0];
    const text = ch?.message?.content ?? '';
    return (0, player2_1.finishText)(text, ch?.finish_reason, opts);
}
/** Google 자체 형식(Agent Platform·Vertex generateContent)의 요청 본문. system → systemInstruction, assistant → model, 같은 역할은 합친다. */
function vertexBody(messages, opts = {}, thinkingOff = true) {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = [];
    for (const m of messages) {
        if (m.role === 'system')
            continue;
        const role = m.role === 'assistant' ? 'model' : 'user', last = contents[contents.length - 1];
        if (last && last.role === role)
            last.parts[0].text += '\n\n' + m.content;
        else
            contents.push({ role, parts: [{ text: m.content }] });
    }
    if (!contents.length || contents[0].role !== 'user')
        contents.unshift({ role: 'user', parts: [{ text: '.' }] }); // Gemini 는 user 로 시작해야 한다
    const gc = { maxOutputTokens: opts.maxTokens ?? 300 };
    if (opts.json)
        gc.responseMimeType = 'application/json';
    if (thinkingOff)
        gc.thinkingConfig = { thinkingBudget: 0 }; // 생각 토큰이 답 한도를 먹지 않게(거부하는 모델이면 빼고 한도를 늘려 다시)
    return { ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}), contents, generationConfig: gc };
}
/** generateContent 응답에서 글(생각 부분 제외)과 끝난 이유('length' = 토큰 한도). */
function vertexText(j) {
    const c = j?.candidates?.[0];
    const parts = c?.content?.parts ?? [];
    const text = parts.filter((p) => !p?.thought && typeof p?.text === 'string').map((p) => p.text).join('');
    return { text, finish: c?.finishReason === 'MAX_TOKENS' ? 'length' : String(c?.finishReason ?? '') };
}
const SA_TOKEN_URI = 'https://oauth2.googleapis.com/token', SA_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const b64u = (b) => Buffer.from(b).toString('base64url');
/** 키 칸의 글이 서비스 계정 JSON 이면 읽는다(아니면 null → 보통 API 키). 토큰 주소는 구글 것만 받아 키가 엉뚱한 서버로 가지 않게 한다. */
function parseServiceAccount(raw) {
    const s = String(raw ?? '').trim();
    if (s[0] !== '{')
        return null;
    let j;
    try {
        j = JSON.parse(s);
    }
    catch {
        return null;
    }
    if (!j || typeof j !== 'object')
        return null;
    const email = String(j.client_email ?? ''), privateKey = String(j.private_key ?? ''), project = String(j.project_id ?? ''), tokenUri = String(j.token_uri || SA_TOKEN_URI);
    if (!email.includes('@') || !/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(privateKey))
        return null;
    try {
        const u = new URL(tokenUri);
        if (u.protocol !== 'https:' || u.hostname !== 'oauth2.googleapis.com')
            return null;
    }
    catch {
        return null;
    }
    return { email, privateKey, project, tokenUri };
}
/** 토큰 교환용 서명된 JWT(1시간). */
function buildJwt(sa, nowSec = Math.floor(Date.now() / 1000)) {
    const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), claim = b64u(JSON.stringify({ iss: sa.email, scope: SA_SCOPE, aud: sa.tokenUri, iat: nowSec, exp: nowSec + 3600 }));
    return head + '.' + claim + '.' + b64u((0, crypto_1.createSign)('RSA-SHA256').update(head + '.' + claim).sign(sa.privateKey));
}
const tokenCache = new Map();
async function saToken(sa, parent) {
    const ck = sa.email + '|' + (0, crypto_1.createHash)('sha256').update(sa.privateKey).digest('hex').slice(0, 16), now = Date.now();
    const hit = tokenCache.get(ck);
    if (hit && hit.exp - 60000 > now)
        return hit.token;
    (0, diagnostics_1.registerDiagnosticSecret)(sa.privateKey);
    const jwt = buildJwt(sa);
    (0, diagnostics_1.registerDiagnosticSecret)(jwt);
    const span = (0, diagnostics_1.diagnosticSpan)('ai.token', { parent, url: sa.tokenUri, timeoutMs: 30000 });
    let status = 0, text = '';
    try {
        const res = await fetch(sa.tokenUri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwt), signal: AbortSignal.timeout(30000) })
            .catch((e) => { throw new Error(redactKey(e && e.name === 'TimeoutError' ? (0, i18n_pick_1.L)('서비스 계정 인증 응답이 30초 넘게 없습니다.', 'No response from the service-account sign-in for over 30 seconds.') : (0, i18n_pick_1.L)('서비스 계정 인증 연결 실패: ', 'Service-account sign-in connection failed: ') + (e && e.message), jwt)); });
        text = await res.text();
        status = res.status;
        span.end({ status, bytes: Buffer.byteLength(text) });
    }
    catch (e) {
        span.fail(e);
        throw e;
    }
    let j = {};
    try {
        j = JSON.parse(text);
    }
    catch { /* 아래 오류로 알린다 */ }
    if (status !== 200 || typeof j.access_token !== 'string') {
        const code = String(j.error ?? status), why = String(j.error_description ?? '').slice(0, 160);
        const hint = code === 'invalid_grant' ? (0, i18n_pick_1.L)(' (키가 삭제·비활성이거나 이 PC 시계가 크게 틀렸을 수 있습니다)', ' (the key may be deleted or disabled, or this PC clock is far off)') : '';
        throw new Error(redactKey((0, i18n_pick_1.L)('서비스 계정 인증 실패: ', 'Service-account sign-in failed: ') + code + (why ? ' - ' + why : '') + hint, jwt));
    }
    (0, diagnostics_1.registerDiagnosticSecret)(j.access_token);
    tokenCache.set(ck, { token: j.access_token, exp: now + Math.max(300, Number(j.expires_in) || 3600) * 1000 });
    return j.access_token;
}
/** generateContent 주소. 서비스 계정이면 프로젝트 경로(/v1/projects/<프로젝트>/locations/<위치>/publishers/google)를 끼워 넣는다(위치 = 주소 앞의 us-central1- 같은 부분, 없으면 global). */
function vertexUrl(c, sa) {
    let base = normalizeBase(c.baseUrl);
    if (sa) {
        try {
            const u = new URL(base);
            if (u.pathname === '/v1/publishers/google' && /(^|[.-])aiplatform\.googleapis\.com$/.test(u.hostname)) {
                const m = /^([a-z0-9-]+)-aiplatform\.googleapis\.com$/.exec(u.hostname);
                base = `${u.origin}/v1/projects/${encodeURIComponent(sa.project)}/locations/${m ? m[1] : 'global'}/publishers/google`;
            }
        }
        catch { /* 주소가 이상하면 그대로 둔다(저장할 때 이미 검사함) */ }
    }
    return base + '/models/' + encodeURIComponent(c.model) + ':generateContent';
}
/** Agent Platform(Vertex)에서 generateContent 한 번 호출. 키 칸이 서비스 계정 JSON 이면 OAuth 토큰으로, 아니면 Express mode API 키로. */
async function vertexChat(c, key, messages, opts = {}) {
    const sa = parseServiceAccount(key);
    if (sa && !sa.project && !/\/projects\//.test(c.baseUrl))
        throw new Error((0, i18n_pick_1.L)('서비스 계정 JSON 에 project_id 가 없습니다. 구글 콘솔에서 받은 JSON 전체를 붙여 넣었는지 확인하세요.', 'The service-account JSON has no project_id. Make sure you pasted the whole JSON downloaded from the Google console.'));
    const url = vertexUrl(c, sa), cred = sa ? await saToken(sa, opts._diagnosticId) : key, auth = sa ? 'bearer' : 'goog';
    let body = vertexBody(messages, opts, true);
    let r = await http('POST', url, cred, body, 90000, opts._diagnosticId, auth);
    for (let i = 0; i < 2 && r.status === 400; i++) {
        if (body.generationConfig.thinkingConfig && /thinking/i.test(r.text)) {
            body = vertexBody(messages, { ...opts, maxTokens: (opts.maxTokens ?? 300) + 4096 }, false);
        }
        else if (body.generationConfig.responseMimeType && /response_?mime_?type|json/i.test(r.text))
            delete body.generationConfig.responseMimeType;
        else
            break;
        r = await http('POST', url, cred, body, 90000, opts._diagnosticId, auth);
    }
    if (r.status < 200 || r.status >= 300) {
        let hint = '';
        if (sa && r.status === 403)
            hint = (0, i18n_pick_1.L)(' → 서비스 계정에 「Vertex AI 사용자」(roles/aiplatform.user) 역할이 있는지, 프로젝트에서 Vertex AI API 가 켜져 있는지 확인하세요.', ' → Check that the service account has the "Vertex AI User" role (roles/aiplatform.user) and that the Vertex AI API is enabled for the project.');
        else if (sa && r.status === 404)
            hint = (0, i18n_pick_1.L)(' → 모델 이름과 위치를 확인하세요(위치는 API 주소 앞의 us-central1- 같은 부분이며 기본은 global).', ' → Check the model name and location (the location is the prefix of the API address such as us-central1-; the default is global).');
        else if (!sa && r.status === 401 && /API keys? (are|is) not supported/i.test(r.text))
            hint = (0, i18n_pick_1.L)(' → Express mode 로 만든 키가 아닌 듯합니다. 키 칸에 서비스 계정 JSON 전체를 붙여 넣어 보세요.', ' → This does not look like an Express mode key. Paste the whole service-account JSON into the key box instead.');
        throw new Error(redactKey(`${c.name || c.provider} ${r.status}: ${r.text.slice(0, 200)}`, key) + hint);
    }
    let j;
    try {
        j = JSON.parse(r.text);
    }
    catch {
        throw new Error((0, i18n_pick_1.L)('응답을 해석할 수 없습니다: ', 'Could not parse the response: ') + redactKey(r.text.slice(0, 120), key));
    }
    const u = j.usageMetadata || {}, out = vertexText(j);
    (0, diagnostics_1.logDiagnostic)('info', 'ai.usage', { parent: opts._diagnosticId, provider: c.provider, model: c.model, promptTokens: u.promptTokenCount, completionTokens: u.candidatesTokenCount, totalTokens: u.totalTokenCount, finishReason: out.finish });
    if (!out.text && j?.promptFeedback?.blockReason)
        throw new Error((0, i18n_pick_1.L)(`${c.name || c.provider}: 안전 필터가 답을 막았습니다(${j.promptFeedback.blockReason}).`, `${c.name || c.provider}: the safety filter blocked the reply (${j.promptFeedback.blockReason}).`));
    return (0, player2_1.finishText)(out.text, out.finish, opts);
}
/** 제공자에 맞는 호출(Agent Platform 은 Google 형식, 나머지는 OpenAI 호환). */
const providerChat = (c, key, messages, opts = {}) => (c.provider === 'vertex' ? vertexChat : compatChat)(c, key, messages, opts);
exports.providerChat = providerChat;
exports.VERTEX_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
/** 모델 목록. 조회가 안 되는 서비스는 오류를 돌려주고, 사용자는 모델을 직접 입력하면 된다. */
async function listModels(c, key) {
    if (c.provider === 'vertex')
        return exports.VERTEX_MODELS.slice(); // API 키로는 모델 목록 조회가 안 된다 → 자주 쓰는 이름(직접 입력 가능)
    const r = await http('GET', normalizeBase(c.baseUrl) + '/models', key, undefined, 20000);
    if (r.status < 200 || r.status >= 300)
        throw new Error(redactKey(`모델 목록을 가져오지 못했습니다(${r.status}). 모델 이름을 직접 입력해도 됩니다.`, key));
    let j;
    try {
        j = JSON.parse(r.text);
    }
    catch {
        throw new Error((0, i18n_pick_1.L)('모델 목록 형식을 알 수 없습니다. 모델 이름을 직접 입력해도 됩니다.', 'Unknown model list format. You can type the model name yourself.'));
    }
    const arr = Array.isArray(j) ? j : j.data ?? j.models ?? [];
    return arr.map((m) => String(m?.id ?? m?.name ?? m)).map((s) => s.replace(/^models\//, '')).filter(Boolean).sort();
}
/** 평의회 응답 형식 검사: {"replies":[{"id":숫자,"text":문자열,"shift":숫자}]}. 맞으면 '', 아니면 이유. */
function checkDebateShape(raw) {
    const m = /\{[\s\S]*\}/.exec(String(raw ?? '').replace(/```(?:json)?/g, ''));
    if (!m)
        return 'JSON 객체가 없음';
    let j;
    try {
        j = JSON.parse(m[0]);
    }
    catch {
        return 'JSON 해석 실패';
    }
    if (!j || !Array.isArray(j.replies))
        return 'replies 배열이 없음';
    if (!j.replies.length)
        return 'replies 가 비어 있음';
    const r = j.replies[0];
    if (!r || typeof r !== 'object')
        return 'replies 항목이 객체가 아님';
    if (typeof r.id !== 'number')
        return 'id 가 숫자가 아님';
    if (typeof r.text !== 'string' || !r.text.trim())
        return 'text 가 문자열이 아니거나 비어 있음';
    if (typeof r.shift !== 'number' || !Number.isFinite(r.shift))
        return 'shift 가 숫자가 아님';
    return '';
}
/** 게임 명령을 실행하지 않는 작은 시험: 실제로 JSON 형식 응답이 오는지까지 본다. */
async function testConn(c, key) {
    const t0 = Date.now();
    try {
        const raw = await (0, exports.providerChat)(c, key, [
            { role: 'system', content: '당신은 연결 시험용 응답기입니다. 반드시 JSON 객체 하나만 출력하세요.' },
            { role: 'user', content: '{"replies":[{"id":1,"text":"시험 응답입니다","shift":0}]} 와 같은 형식으로, id 1에 "연결 확인"이라는 text 를 넣어 답하세요.' },
        ], { maxTokens: 400, json: true });
        const bad = checkDebateShape(raw);
        return bad === '' ? { ok: true, ms: Date.now() - t0, message: (0, i18n_pick_1.L)(`연결 성공 · 평의회 응답 형식(replies/id/text/shift) 확인 (${Date.now() - t0}ms)`, `Connected · council reply format (replies/id/text/shift) confirmed (${Date.now() - t0}ms)`) } : { ok: false, ms: Date.now() - t0, message: (0, i18n_pick_1.L)(`연결은 됐지만 평의회 응답 형식이 맞지 않습니다: ${bad}. 다른 모델을 권합니다. 받은 응답: `, `Connected, but the council reply format is wrong: ${bad}. Another model is recommended. Reply received: `) + redactKey(raw.slice(0, 80), key) };
    }
    catch (e) {
        return { ok: false, ms: Date.now() - t0, message: redactKey(e.message, key) };
    }
}
const conversationIds = new WeakMap();
/** Stable id for one multi-turn conversation (keeps the same Gemini fallback model across its turns). Pass the object that lives exactly as long as that conversation. */
function conversationOf(owner) { let id = conversationIds.get(owner); if (!id) {
    id = (0, crypto_1.randomUUID)();
    conversationIds.set(owner, id);
} return id; }
/**
 * 활성 연결 하나를 모든 기능이 공유한다. 연결 변경은 진행 중인 요청이 모두 끝난 뒤에 적용해
 * 한 작업 도중 제공자가 섞이지 않게 한다. 자동 대체 연결은 없다(실패하면 오류로 알린다).
 */
class AiRouter {
    player2;
    custom;
    mode;
    language;
    inflight = 0;
    pending = null;
    constructor(player2, custom, mode, language = () => 'ko') {
        this.player2 = player2;
        this.custom = custom;
        this.mode = mode;
        this.language = language;
    }
    activeMode = null;
    activeCustom = null;
    pin() { if (this.inflight === 0 || !this.activeMode) {
        this.activeMode = this.mode();
        this.activeCustom = this.activeMode === 'custom' ? this.custom() : null;
    } }
    /** 설정이 바뀌었음을 알린다. 진행 중인 요청이 없을 때 적용된다. */
    refresh() { if (this.inflight === 0) {
        this.activeMode = null;
        this.pin();
        return true;
    } this.pending = () => { this.activeMode = null; }; return false; }
    async run(mode, cust, messages, opts, language) {
        const span = (0, diagnostics_1.diagnosticSpan)('ai.request', {
            purpose: opts.purpose || 'unspecified',
            mode,
            provider: cust?.conn.provider,
            model: cust?.conn.model,
            language,
            maxTokens: opts.maxTokens,
            json: opts.json,
            messageCount: messages.length,
            inputChars: messages.reduce((n, m) => n + m.content.length, 0),
            origin: new Error().stack?.split('\n').slice(2, 6),
        });
        opts = { ...opts, _diagnosticId: span.id };
        try {
            const instruction = (0, language_1.responseLanguageInstruction)(language);
            messages = messages.some(m => m.role === 'system') ? messages.map(m => m.role === 'system' ? { ...m, content: m.content + String.fromCharCode(10, 10) + instruction } : m) : [{ role: 'system', content: instruction }, ...messages];
            if (mode === 'custom') {
                if (!cust)
                    throw new Error((0, i18n_pick_1.L)('개인 API 연결이 선택되지 않았거나 API 키가 없습니다. 설정 → AI 연결을 확인하세요.', 'No personal API connection is selected, or it has no API key. Check Settings → AI connection.'));
                let result;
                if ((0, model_rotation_host_1.rotationEligible)(cust.conn)) {
                    const service = (0, model_rotation_host_1.modelRotation)(), setting = await service.get(cust.conn.id);
                    if (setting.config.enabled) {
                        try {
                            const reply = await service.run(cust.conn.id, cust.conn.model, (model, signal) => compatChat({ ...cust.conn, model }, cust.key, messages, { ...opts, signal, _rotationSingle: true }), { signal: opts.signal, conversationId: opts.conversationId ? (0, crypto_1.createHash)('sha256').update(opts.conversationId).digest('hex') : undefined });
                            result = reply.value;
                        }
                        catch (e) {
                            throw (0, model_rotation_host_1.rotationError)(e);
                        }
                    }
                    else
                        result = await (0, exports.providerChat)(cust.conn, cust.key, messages, opts);
                }
                else
                    result = await (0, exports.providerChat)(cust.conn, cust.key, messages, opts);
                span.end({ outputChars: result.length });
                return result;
            }
            const result = await this.player2.chat(messages, opts);
            span.end({ outputChars: result.length });
            return result;
        }
        catch (e) {
            span.fail(e);
            throw e;
        }
    }
    done() { this.inflight--; if (this.inflight === 0 && this.pending) {
        const p = this.pending;
        this.pending = null;
        p();
    } }
    /** 호출 한 번. */
    async chat(messages, opts = {}) {
        this.pin();
        this.inflight++;
        try {
            return await this.run(this.activeMode, this.activeCustom, messages, opts, this.language());
        }
        finally {
            this.done();
        }
    }
    /** 여러 번 부르는 작업(재시도 포함)을 같은 연결로 끝낸다. 작업이 끝날 때까지 연결 변경은 미뤄진다. */
    async session(fn) {
        this.pin();
        this.inflight++;
        const mode = this.activeMode, cust = this.activeCustom, language = this.language();
        const conversationId = (0, crypto_1.randomUUID)();
        try {
            return await fn((m, o = {}) => this.run(mode, cust, m, { ...o, conversationId: o.conversationId || conversationId }, language));
        }
        finally {
            this.done();
        }
    }
}
exports.AiRouter = AiRouter;
//# sourceMappingURL=aiclient.js.map
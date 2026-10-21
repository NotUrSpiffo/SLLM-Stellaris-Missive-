"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player2Client = void 0;
exports.finishText = finishText;
exports.fetchCauseCode = fetchCauseCode;
exports.altLocalBase = altLocalBase;
// Player2 local API: the desktop app owns user authentication.
// The public game ID identifies this integration; it is not a user's secret key.
const diagnostics_1 = require("./diagnostics");
const i18n_pick_1 = require("./i18n-pick");
/**
 * 응답이 토큰 한도에서 끊겼을 때(finish_reason=length)의 처리. 평문이면 ' …(잘림)' 표시를 붙이고,
 * JSON 모드면 표시를 붙이지 않고(JSON 을 더 망가뜨리므로) onTruncated 로 알려 호출자가 토큰을 늘려 다시 부르게 한다.
 */
function finishText(text, finish, opts = {}) {
    if (finish !== 'length')
        return text;
    if (opts.json) {
        try {
            opts.onTruncated?.();
        }
        catch { /* 알림 실패는 무시 */ }
        return text;
    }
    return text + (0, i18n_pick_1.L)(' …(잘림)', ' …(cut off)');
}
/** fetch 오류 안쪽(cause)의 실제 원인 코드(ECONNREFUSED 등). 없으면 ''. */
function fetchCauseCode(e) {
    let c = e?.cause;
    for (let i = 0; i < 4 && c; i++) {
        if (c.code)
            return String(c.code);
        if (Array.isArray(c.errors)) {
            const x = c.errors.find((y) => y?.code);
            if (x)
                return String(x.code);
        }
        c = c.cause;
    }
    return '';
}
/** 요청이 상대에게 닿기 전에 실패한 경우(다시 보내도 중복 요청이 아님). */
const NOT_SENT = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EADDRNOTAVAIL', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN']);
/**
 * localhost 가 IPv6(::1)로 먼저 풀리고 Player2 가 IPv4(127.0.0.1)에만 열려 있으면 접속이 안 된다(2026-10-18 테스터 제보:
 * 「Player2 다시 연결」도 fetch failed). localhost 주소면 127.0.0.1 주소를 돌려준다. 아니면 null.
 */
function altLocalBase(base) {
    try {
        const u = new URL(base);
        if (u.hostname !== 'localhost')
            return null;
        u.hostname = '127.0.0.1';
        return u.toString().replace(/\/+$/, '');
    }
    catch {
        return null;
    }
}
class Player2Client {
    clientId;
    base;
    healthTimer = null;
    fallback;
    constructor(clientId, base = 'http://localhost:4315') {
        this.clientId = clientId;
        this.base = base;
        this.fallback = altLocalBase(base);
    }
    /** 지금 쓰는 주소(127.0.0.1 로 바뀌었는지 진단용). */
    get baseUrl() { return this.base; }
    configureClientId(value) { this.clientId = value; }
    async req(method, endpoint, body, parent) {
        if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(this.clientId))
            throw new Error((0, i18n_pick_1.L)('Player2 프로젝트 등록과 배포용 Game Client ID 설정이 필요합니다. 개인 API 연결은 사용할 수 있습니다.', 'Player2 needs a registered project and a release Game Client ID. You can still use a personal API connection.'));
        const span = (0, diagnostics_1.diagnosticSpan)('player2.http', { parent, method, endpoint });
        try {
            const headers = { 'content-type': 'application/json', 'player2-game-key': this.clientId };
            const send = (base) => fetch(base + endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(endpoint === '/v1/health' ? 5000 : 90000) });
            const fail = (e) => {
                if (e.name === 'TimeoutError')
                    return new Error((0, i18n_pick_1.L)('Player2 응답 시간이 초과되었습니다.', 'Player2 timed out.'));
                const code = fetchCauseCode(e);
                return new Error((0, i18n_pick_1.L)('Player2 연결 실패: ', 'Player2 connection failed: ') + e.message + (code ? ' (' + code + ')' : '') + (code === 'ECONNREFUSED' || !code ? (0, i18n_pick_1.L)(' — Player2 앱이 켜져 있고 로그인돼 있는지 확인하세요.', ' — check that the Player2 app is running and signed in.') : ''));
            };
            let response;
            try {
                response = await send(this.base);
            }
            catch (e) {
                const err = e, code = fetchCauseCode(err), alt = this.fallback;
                // 요청이 닿기 전에 실패했을 때만(중복 대화 요청 방지) 127.0.0.1 로 한 번 더. 되면 그 주소를 계속 쓴다.
                if (!alt || alt === this.base || err.name === 'TimeoutError' || !(NOT_SENT.has(code) || method === 'GET'))
                    throw fail(err);
                try {
                    response = await send(alt);
                }
                catch {
                    throw fail(err);
                }
                (0, diagnostics_1.logDiagnostic)('info', 'player2.base.fallback', { from: this.base, to: alt, code });
                this.base = alt;
            }
            if (!response.ok) {
                // Do not echo arbitrary server response bodies into logs or the interface.
                if (response.status === 401 || response.status === 403)
                    throw new Error((0, i18n_pick_1.L)('Player2 앱 로그인 또는 프로젝트 사용 권한을 확인하세요.', 'Check the Player2 app login or the project permissions.'));
                if (response.status === 429)
                    throw new Error((0, i18n_pick_1.L)('Player2 사용량 또는 요청 제한입니다. 잠시 뒤 다시 시도하세요.', 'Player2 usage or rate limit reached. Try again shortly.'));
                throw new Error('Player2 HTTP ' + response.status + ' ' + endpoint);
            }
            const text = await response.text();
            try {
                const result = text ? JSON.parse(text) : {};
                span.end({ status: response.status, bytes: Buffer.byteLength(text) });
                return result;
            }
            catch {
                throw new Error((0, i18n_pick_1.L)('Player2 응답 형식이 올바르지 않습니다.', 'Player2 reply format is invalid.'));
            }
        }
        catch (e) {
            span.fail(e);
            throw e;
        }
    }
    /** Compatibility name retained for the UI; local authentication happens in Player2. */
    async login() { await this.health(); }
    health() { return this.req('GET', '/v1/health'); }
    startHealthPing(onError, ms = 60000) {
        if (this.healthTimer)
            return;
        this.health().catch(onError);
        this.healthTimer = setInterval(() => this.health().catch(onError), ms);
    }
    stop() { if (this.healthTimer)
        clearInterval(this.healthTimer); this.healthTimer = null; }
    joules() { return this.req('GET', '/v1/joules'); }
    /** Player2 앱의 음성 목록(남/여·언어 포함). */
    async ttsVoices() { const r = await this.req('GET', '/v1/tts/voices'); return Array.isArray(r?.voices) ? r.voices : []; }
    /** Player2 음성으로 mp3 한 덩어리를 받는다(앱에서 소리를 내지 않고 데이터만 받음). */
    async ttsSpeak(text, voiceId, speed = 1) {
        const r = await this.req('POST', '/v1/tts/speak', { text, voice_ids: [voiceId], speed, audio_format: 'mp3', play_in_app: false });
        if (typeof r?.data !== 'string' || !r.data)
            throw new Error((0, i18n_pick_1.L)('Player2 음성 응답에 소리가 없습니다.', 'Player2 voice reply has no audio.'));
        return Buffer.from(r.data, 'base64');
    }
    async chat(messages, opts = {}) {
        const body = { messages, stream: false, max_tokens: opts.maxTokens ?? 300 };
        if (opts.json)
            body.response_format = { type: 'json_object' };
        const r = await this.req('POST', '/v1/chat/completions', body, opts._diagnosticId), choice = r.choices?.[0];
        (0, diagnostics_1.logDiagnostic)('info', 'ai.usage', { parent: opts._diagnosticId, provider: 'player2', promptTokens: r.usage?.prompt_tokens, completionTokens: r.usage?.completion_tokens, totalTokens: r.usage?.total_tokens, finishReason: choice?.finish_reason });
        if (typeof choice?.message?.content !== 'string')
            throw new Error((0, i18n_pick_1.L)('Player2 응답에 대사가 없습니다.', 'Player2 reply has no text.'));
        return finishText(choice.message.content, choice.finish_reason, opts);
    }
}
exports.Player2Client = Player2Client;
//# sourceMappingURL=player2.js.map
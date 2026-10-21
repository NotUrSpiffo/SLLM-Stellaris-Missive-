"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttsAiSynth = ttsAiSynth;
exports.p2VoiceList = p2VoiceList;
exports.p2Synth = p2Synth;
exports.registerTts = registerTts;
// 라디오 음성으로 듣기 — AI 음성(2026-10-17). 개인 API 연결이 OpenAI 일 때만 /audio/speech 로 mp3 를 받아 돌려준다.
// 윈도우 내장 음성은 화면(ui/tts.js)에서 바로 처리하므로 여기를 거치지 않는다.
const electron_1 = require("electron");
const settings_1 = require("../app/settings");
const aiclient_1 = require("../aiclient");
const tts_1 = require("../tts");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
const L = settings_ui_1.pick; // 한국어·영어·언어 팩(2026-10-18)
/** 개인 OpenAI 연결로 mp3 한 덩어리를 받는다(라디오·복무신조 낭독 공용). 안 되면 이유(한/영 적용된 문장). */
async function ttsAiSynth(text, voice, instructions) {
    const c = (0, settings_1.activeCustom)();
    const ready = (0, tts_1.ttsAiReady)(settings_1.settings.aiMode, c?.conn.provider, !!c?.key);
    if (!ready.ok || !c)
        return { ok: false, error: L(ready.ko, ready.en) };
    const t = String(text ?? '').trim();
    if (!t)
        return { ok: false, error: L('읽을 문장이 없습니다.', 'Nothing to read.') };
    try {
        const res = await fetch((0, aiclient_1.normalizeBase)(c.conn.baseUrl) + '/audio/speech', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${c.key}` }, body: JSON.stringify((0, tts_1.ttsBody)(t, String(voice ?? ''), instructions)), signal: AbortSignal.timeout(60000) });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            return { ok: false, error: (0, aiclient_1.redactKey)(`${L('AI 음성', 'AI voice')} ${res.status}: ${body.slice(0, 160)}`, c.key) };
        }
        return { ok: true, buf: Buffer.from(await res.arrayBuffer()) };
    }
    catch (e) {
        return { ok: false, error: (0, aiclient_1.redactKey)(L('AI 음성 연결 실패: ', 'AI voice connection failed: ') + (e instanceof Error ? e.message : String(e)), c.key) };
    }
}
/** Player2 음성 목록(60초 동안 기억). 실패하면 이유(한/영 적용). */
let p2Cache = null;
async function p2VoiceList() {
    if (p2Cache && Date.now() - p2Cache.at < 60000)
        return { ok: true, list: p2Cache.list };
    try {
        const list = (0, tts_1.p2Voices)(await ctx_1.ctx.p2.ttsVoices());
        if (!list.length)
            return { ok: false, error: L('Player2 에 쓸 수 있는 목소리가 없습니다.', 'Player2 has no usable voices.') };
        p2Cache = { at: Date.now(), list };
        return { ok: true, list };
    }
    catch (e) {
        return { ok: false, error: L('Player2 음성을 쓸 수 없습니다: ', 'Player2 voice is unavailable: ') + (e instanceof Error ? e.message : String(e)) };
    }
}
async function p2Synth(text, voiceId) {
    const t = String(text ?? '').trim();
    if (!t)
        return { ok: false, error: L('읽을 문장이 없습니다.', 'Nothing to read.') };
    try {
        return { ok: true, buf: await ctx_1.ctx.p2.ttsSpeak(t.slice(0, 2000), voiceId) };
    }
    catch (e) {
        return { ok: false, error: L('Player2 음성 실패: ', 'Player2 voice failed: ') + (e instanceof Error ? e.message : String(e)) };
    }
}
function registerTts() {
    electron_1.ipcMain.handle('ttsP2Check', async () => { const r = await p2VoiceList(); return r.ok ? { ok: true, ko: '', en: '' } : { ok: false, ko: r.error, en: r.error }; });
    electron_1.ipcMain.handle('ttsP2Speak', async (_e, text, who) => {
        const t = String(text ?? ''), v = await p2VoiceList();
        if (!v.ok)
            return { ok: false, error: v.error };
        const id = (0, tts_1.p2VoiceFor)(v.list, (0, tts_1.p2LangOf)(t), String(who ?? ''));
        if (!id)
            return { ok: false, error: L('Player2 에 맞는 목소리가 없습니다.', 'No matching Player2 voice.') };
        const r = await p2Synth(t, id);
        return r.ok ? { ok: true, b64: r.buf.toString('base64') } : { ok: false, error: r.error };
    });
    electron_1.ipcMain.handle('ttsAiCheck', async () => { const c = (0, settings_1.activeCustom)(); return (0, tts_1.ttsAiReady)(settings_1.settings.aiMode, c?.conn.provider, !!c?.key); });
    electron_1.ipcMain.handle('ttsAiSpeak', async (_e, text, voice) => {
        const r = await ttsAiSynth(String(text ?? ''), String(voice ?? ''));
        return r.ok ? { ok: true, b64: r.buf.toString('base64') } : { ok: false, error: r.error };
    });
}
//# sourceMappingURL=tts-app.js.map
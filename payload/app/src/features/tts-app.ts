// 라디오 음성으로 듣기 — AI 음성(2026-10-17). 개인 API 연결이 OpenAI 일 때만 /audio/speech 로 mp3 를 받아 돌려준다.
// 윈도우 내장 음성은 화면(ui/tts.js)에서 바로 처리하므로 여기를 거치지 않는다.
import { ipcMain } from 'electron';
import { settings, activeCustom } from '../app/settings';
import { normalizeBase, redactKey } from '../aiclient';
import { ttsAiReady, ttsBody, p2Voices, p2LangOf, p2VoiceFor, type P2Voice } from '../tts';
import { ctx } from '../app/ctx';
import { pick } from './settings-ui';

const L = pick; // 한국어·영어·언어 팩(2026-10-18)

/** 개인 OpenAI 연결로 mp3 한 덩어리를 받는다(라디오·복무신조 낭독 공용). 안 되면 이유(한/영 적용된 문장). */
export async function ttsAiSynth(text: string, voice: string, instructions?: string): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const c = activeCustom(); const ready = ttsAiReady(settings.aiMode, c?.conn.provider, !!c?.key);
  if (!ready.ok || !c) return { ok: false, error: L(ready.ko, ready.en) };
  const t = String(text ?? '').trim(); if (!t) return { ok: false, error: L('읽을 문장이 없습니다.', 'Nothing to read.') };
  try {
    const res = await fetch(normalizeBase(c.conn.baseUrl) + '/audio/speech', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${c.key}` }, body: JSON.stringify(ttsBody(t, String(voice ?? ''), instructions)), signal: AbortSignal.timeout(60000) });
    if (!res.ok) { const body = await res.text().catch(() => ''); return { ok: false, error: redactKey(`${L('AI 음성', 'AI voice')} ${res.status}: ${body.slice(0, 160)}`, c.key) }; }
    return { ok: true, buf: Buffer.from(await res.arrayBuffer()) };
  } catch (e) { return { ok: false, error: redactKey(L('AI 음성 연결 실패: ', 'AI voice connection failed: ') + (e instanceof Error ? e.message : String(e)), c.key) }; }
}

/** Player2 음성 목록(60초 동안 기억). 실패하면 이유(한/영 적용). */
let p2Cache: { at: number; list: P2Voice[] } | null = null;
export async function p2VoiceList(): Promise<{ ok: true; list: P2Voice[] } | { ok: false; error: string }> {
  if (p2Cache && Date.now() - p2Cache.at < 60000) return { ok: true, list: p2Cache.list };
  try { const list = p2Voices(await ctx.p2.ttsVoices()); if (!list.length) return { ok: false, error: L('Player2 에 쓸 수 있는 목소리가 없습니다.', 'Player2 has no usable voices.') }; p2Cache = { at: Date.now(), list }; return { ok: true, list }; }
  catch (e) { return { ok: false, error: L('Player2 음성을 쓸 수 없습니다: ', 'Player2 voice is unavailable: ') + (e instanceof Error ? e.message : String(e)) }; }
}
export async function p2Synth(text: string, voiceId: string): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const t = String(text ?? '').trim(); if (!t) return { ok: false, error: L('읽을 문장이 없습니다.', 'Nothing to read.') };
  try { return { ok: true, buf: await ctx.p2.ttsSpeak(t.slice(0, 2000), voiceId) }; }
  catch (e) { return { ok: false, error: L('Player2 음성 실패: ', 'Player2 voice failed: ') + (e instanceof Error ? e.message : String(e)) }; }
}

export function registerTts(): void {
  ipcMain.handle('ttsP2Check', async () => { const r = await p2VoiceList(); return r.ok ? { ok: true, ko: '', en: '' } : { ok: false, ko: r.error, en: r.error }; });
  ipcMain.handle('ttsP2Speak', async (_e, text: unknown, who: unknown) => {
    const t = String(text ?? ''), v = await p2VoiceList(); if (!v.ok) return { ok: false, error: v.error };
    const id = p2VoiceFor(v.list, p2LangOf(t), String(who ?? '')); if (!id) return { ok: false, error: L('Player2 에 맞는 목소리가 없습니다.', 'No matching Player2 voice.') };
    const r = await p2Synth(t, id); return r.ok ? { ok: true, b64: r.buf.toString('base64') } : { ok: false, error: r.error };
  });
  ipcMain.handle('ttsAiCheck', async () => { const c = activeCustom(); return ttsAiReady(settings.aiMode, c?.conn.provider, !!c?.key); });
  ipcMain.handle('ttsAiSpeak', async (_e, text: unknown, voice: unknown) => {
    const r = await ttsAiSynth(String(text ?? ''), String(voice ?? ''));
    return r.ok ? { ok: true, b64: r.buf.toString('base64') } : { ok: false, error: r.error };
  });
}

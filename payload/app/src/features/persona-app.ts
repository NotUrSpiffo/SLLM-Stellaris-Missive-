// 집무실 인물 대화 + 기억(앱 쪽, 2026-10-18). 순수 로직은 src/persona.ts.
// 연락처의 인물과 집무실 안에서 1:1로 이야기한다(총독은 행성 정보가 있는 기존 총독 창을 그대로 쓴다).
// 세이브별 sllm_persona.json 에 인물마다 말투 한 줄·신뢰·기억(최근 12개)을 둔다. 대화는 끝날 때 한 번 요약해 기억으로 남긴다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { redactKey, conversationOf } from '../aiclient';
import { officeView } from './office-app';
import { gestaltCode } from './gestalt-app';
import { fleetView } from './fleet-app';
import { pick } from './settings-ui';
import { withPolicyContext } from './policy-app';
import {
  type PersonaMem, type Talk, type PersonInfo, emptyMem, applyMove, addMemory, syncEvents, syncHearing, trustLevel,
  personaMessages, talkMessages, summaryMessages, parseJson, endSentence, cleanLine, MAX_TURNS, MAX_MEM, needsPersona, traitSig, clampTrust,
} from '../persona';

const L = pick; // 한국어·영어·언어 팩
let data: Record<string, Record<string, PersonaMem>> | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_persona.json');
function all(): Record<string, Record<string, PersonaMem>> {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'persona', error: e }); data = {}; }
  return data!;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'persona', error: e }); } }
export const memOf = (sid: string, key: string): PersonaMem => { const s = (all()[sid] ??= {}); const m = (s[key] ??= emptyMem()); m.mems ??= []; return m; };

/** 지금 세이브의 연락처에서 이 인물 찾기. */
export function personOf(key: string): PersonInfo | null {
  const p = (officeView().people as PersonInfo[]).find((x) => x.key === key);
  if (!p) return null;
  const g = gestaltCode(); return g ? { ...p, gestalt: g } : p; // 단일 의식 제국이면 인물 말투가 달라진다(2026-10-19)
}
/** 사건(기술 수준 상승·청문회 결과)을 신뢰와 기억에 반영. */
function syncPerson(sid: string, p: PersonInfo): PersonaMem {
  const m = memOf(sid, p.key); const date = ctx.gameDate || '';
  let ch = syncEvents(m, p, date);
  const lid = Number(String(p.key).replace(/^(p|adm):/, ''));
  if (Number.isFinite(lid) && lid > 0) { const a = fleetView().admirals.find((x: { lid: number }) => x.lid === lid) as { hearings?: number; status?: string } | undefined; if (a && typeof a.hearings === 'number') ch = syncHearing(m, a.hearings, a.status, date) || ch; }
  if (ch) save();
  return m;
}
const view = (m: PersonaMem, p?: PersonInfo) => ({ traits: p?.traits ?? [], persona: m.persona ?? '', trust: m.trust, level: (() => { const t = trustLevel(m.trust); return L(t.ko, t.en); })(), mems: m.mems.slice().reverse(), talks: m.talks, last: m.last ?? '' });

const talks = new Map<string, Talk>(); // 진행 중인 대화(세이브|인물)
const busy = new Set<string>();

/** 인물 AI 호출(JSON). 추론형 모델(Player2 등)은 생각에 토큰을 많이 써서 답이 잘릴 수 있다(2026-10-18 실기: 700 중 686 을 쓰고 본문 30자).
 *  넉넉한 한도로 부르고, 필요한 칸을 못 읽으면 한도를 두 배로 한 번 더. 못 읽으면 null. */
export async function personaJson(msgs: Parameters<typeof ctx.ai.chat>[0], maxTokens: number, need: string, conversationId?: string): Promise<Record<string, unknown> | null> {
  let cut: Record<string, unknown> | null = null; // 끊긴 답(마지막 수단)
  for (const mt of [maxTokens, maxTokens * 2]) {
    const raw = await ctx.ai.chat(msgs, { purpose: 'persona', maxTokens: mt, json: true, ...(conversationId ? { conversationId } : {}) });
    const j = parseJson(raw); const has = !!(j && String(j[need] ?? '').trim());
    if (has && !j!.partial) return j; // 완성된 JSON 만 바로 쓴다. 한도에 걸려 끊긴 답은 한도를 늘려 다시
    if (has) cut = j;
    logDiagnostic('warn', 'ai.response.invalid', { feature: 'persona.' + need, chars: String(raw || '').length, maxTokens: mt, partial: has });
  }
  if (cut) { const { partial: _p, ...rest } = cut; return { ...rest, [need]: endSentence(String(cut[need])) }; } // 두 번 다 끊기면 마지막 완성 문장까지
  return null;
}
export async function ensurePersona(sid: string, p: PersonInfo, m: PersonaMem): Promise<void> {
  if (!needsPersona(m, p)) return; // 처음이거나 특성이 새로 들어오거나 바뀌었을 때만
  try {
    const j = await personaJson(personaMessages(p, ctx.playerName || '', m.bio || ''), 1000, 'persona'); const t = cleanLine(j?.persona, 120);
    if (t && ctx.curSaveId === sid) { m.persona = t; m.traitSig = traitSig(p); save(); }
  } catch (e) { logDiagnostic('warn', 'persona.init_failed', { error: String(e) }); }
}

async function finishTalk(sid: string, key: string): Promise<{ ok: boolean; memory?: string; error?: string }> {
  const tk = sid + '|' + key, talk = talks.get(tk); talks.delete(tk);
  if (!talk || !talk.lines.some((l) => l.who === 'me')) return { ok: true };
  const p = personOf(key); if (!p) return { ok: true };
  const m = memOf(sid, key); m.talks++; m.last = ctx.gameDate || m.last; save();
  try {
    const memo = cleanLine((await personaJson(summaryMessages(p, talk, ctx.playerName || ''), 1000, 'memory'))?.memory, 160);
    if (memo && ctx.curSaveId === sid && addMemory(m, ctx.gameDate || '', memo)) save();
    return { ok: true, ...(memo ? { memory: memo } : {}) };
  } catch (e) { return { ok: false, error: redactKey(L('기억을 정리하지 못했습니다: ', 'Could not save the memory: ') + (e as Error).message) }; }
}

export function registerPersona(): void {
  /** 연락처 상세용: 말투·신뢰·기억(최근 것 먼저). 대화 기록은 없다. */
  ipcMain.handle('personaInfo', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid || !k) return null;
    const p = personOf(k); if (!p) return null;
    return view(syncPerson(sid, p), p);
  });
  /** 통신 열기: 처음이면 말투를 정하고, 이 인물이 먼저 인사한다(기억이 있으면 지난 이야기로). */
  ipcMain.handle('personaOpen', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 통신할 수 있습니다.', 'Load a save before opening a channel.') };
    const p = personOf(k); if (!p) return { ok: false, error: L('연락처에서 이 인물을 찾지 못했습니다.', 'This person is not in your contacts.') };
    const tk = sid + '|' + k; if (busy.has(tk)) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    busy.add(tk);
    try {
      const m = syncPerson(sid, p); await ensurePersona(sid, p, m);
      const talk: Talk = { key: k, lines: [], moved: 0, opened: ctx.gameDate || '' }; talks.set(tk, talk);
      let greet = '';
      try {
        greet = cleanLine((await personaJson(withPolicyContext(talkMessages(p, m, talk, '[Channel open - the leader has opened the hologram link. Greet them briefly first.]', ctx.playerName || '', ctx.gameDate || '')), 1500, 'reply', conversationOf(talk)))?.reply);
      } catch (e) { return { ok: true, person: p, ...view(m, p), lines: [], error: redactKey(L('인사를 받지 못했습니다: ', 'No greeting: ') + (e as Error).message) }; }
      if (greet) talk.lines.push({ who: 'them', text: greet });
      return { ok: true, person: p, ...view(m, p), lines: talk.lines.slice() };
    } finally { busy.delete(tk); }
  });
  /** 말하기: 인물의 답 + 이번 말로 움직인 신뢰(앱이 한도로 묶음). */
  ipcMain.handle('personaSay', async (_e, key: unknown, text: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''), t = cleanLine(text, 500); if (!sid || !t) return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.') };
    const tk = sid + '|' + k, talk = talks.get(tk), p = personOf(k);
    if (!talk || !p) return { ok: false, error: L('통신이 끊겼습니다. 다시 열어 주세요.', 'The channel was closed. Open it again.') };
    if (busy.has(tk)) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    if (talk.lines.length >= MAX_TURNS * 2) return { ok: false, error: L('대화가 길어졌습니다. 마치고 다시 열어 주세요.', 'This conversation is long. End it and open a new one.') };
    busy.add(tk);
    try {
      const m = memOf(sid, k);
      const j = await personaJson(withPolicyContext(talkMessages(p, m, talk, t, ctx.playerName || '', ctx.gameDate || '')), 1500, 'reply', conversationOf(talk)); const reply = cleanLine(j?.reply);
      if (!reply) return { ok: false, error: L('답을 읽지 못했습니다. 다시 말해 보세요.', 'Could not read the reply. Try again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      talk.lines.push({ who: 'me', text: t }, { who: 'them', text: reply });
      const d = applyMove(m, talk, j?.move); save();
      return { ok: true, reply, delta: d, trust: m.trust, level: (() => { const t = trustLevel(m.trust); return L(t.ko, t.en); })() };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { busy.delete(tk); }
  });
  /** 대화 마치기: 1~2줄로 요약해 기억에 쌓는다. */
  ipcMain.handle('personaEnd', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid || !k) return { ok: true };
    const r = await finishTalk(sid, k);
    const m = memOf(sid, k);
    return { ...r, ...view(m, personOf(k) ?? undefined) };
  });
}
/** 인물 전기(2026-10-18, features/backstory-app.ts). 바꾸면 말투를 다시 정한다. */
export const personBio = (sid: string, key: string): string => all()[sid]?.[key]?.bio ?? '';
export function setPersonBio(sid: string, key: string, text: string): void {
  const m = memOf(sid, key), t = text.trim();
  if ((m.bio ?? '') === t) return;
  if (t) m.bio = t; else delete m.bio;
  delete m.persona; delete m.traitSig; save();
}
/** 총독 창(gov.ts)에서: 이 행성 총독의 인물 전기. */
export function governorBio(planet: string): string {
  const sid = ctx.curSaveId; if (!sid || !planet) return '';
  try { const p = (officeView().people as PersonInfo[]).find((x) => x.role === 'governor' && x.planet === planet); return p ? personBio(sid, p.key) : ''; } catch { return ''; }
}
/** 개인 서신(letters-app)에서: 마지막으로 이야기한 날짜, 기억 한 줄·신뢰 변화 남기기. */
export const personaLast = (sid: string, key: string): string | undefined => all()[sid]?.[key]?.last;
export function personaNote(sid: string, key: string, text: string, delta = 0): void {
  const m = memOf(sid, key); let ch = false;
  if (text && addMemory(m, ctx.gameDate || '', text)) ch = true;
  if (delta) { m.trust = clampTrust(m.trust + delta); ch = true; }
  if (ch) save();
}
/** 내각 회의(faction-app, 2026-10-19)에서: 이 인물의 말투·신뢰·기억 읽기만(없으면 null, 새로 만들지 않는다). */
export const personaPeek = (sid: string, key: string): PersonaMem | null => all()[sid]?.[key] ?? null;
export const _personaLimits = { MAX_MEM, MAX_TURNS };

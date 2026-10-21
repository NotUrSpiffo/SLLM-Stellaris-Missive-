// 은하 위기 특집 방송(앱 쪽, 2026-10-17). 순수 로직은 src/crisis.ts.
// 모드(sllm_crisis.1)가 매달 남기는 CRISIS/CRISIS_END 묶음으로 지금 은하에 있는 위기를 정하고,
// 라디오(radio-app)·신문(media)이 프롬프트와 지면 모양을 바꿀 수 있게 상태를 내준다. 창들에는 'crisisState' 로 알린다.
import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import { CrisisCollector, CrisisSave, applyCrisis, emptyCrisis, crisisBeginText, crisisEndText, crisisName, crisisNames, crisisRadioDirective, crisisFacts, crisisNewsDirective, markCrisisIssue, crisisSpecialFact } from '../crisis';
import { chronNoteWorld } from './chronicle-app';
import { pick, selectedBase } from './settings-ui';
import type { ChatMessage } from '../player2';

let data: Record<string, CrisisSave> | null = null;
/** 호외 예약(media.noteExtra)·위기 특별판 발행(media.publishCrisisSpecial). 가져오기 고리를 만들지 않으려고 media 가 시작할 때 넣어 준다. */
let noteExtra: (kind: string, date: string, text: string) => void = () => {};
let publishSpecial: (date: string, fact: string, label: { ko: string; en: string }) => Promise<void> = async () => {};
export function setCrisisExtra(fn: (kind: string, date: string, text: string) => void): void { noteExtra = fn; }
export function setCrisisSpecial(fn: (date: string, fact: string, label: { ko: string; en: string }) => Promise<void>): void { publishSpecial = fn; }
const file = () => path.join(app.getPath('userData'), 'sllm_crisis.json');
function all(): Record<string, CrisisSave> {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'crisis', error: e }); data = {}; }
  return data!;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'crisis', error: e }); } }
const cur = (): CrisisSave => { const sid = ctx.curSaveId; if (!sid) return emptyCrisis(); const d = all(); const s = (d[sid] ??= emptyCrisis()); s.issues ??= []; s.since ??= {}; s.ended ??= {}; s.active ??= []; return s; };

/** 화면에 보낼 상태(창은 이 값으로 특별 테마를 켜고 끈다). */
export function crisisView() {
  const s = cur();
  return { active: s.active.length > 0, kinds: s.active.slice(), names: crisisNames(s.active, 'ko'), namesEn: crisisNames(s.active, 'en'), since: { ...s.since }, issues: s.issues.slice(), labels: { ...(s.labels ?? {}) } };
}
const broadcast = () => { const v = crisisView(); for (const w of BrowserWindow.getAllWindows()) safeSend(w, 'crisisState', v); };

/** 라디오(radio-app)용: 위기 동안 덧붙일 지시와, 새 사건이 없을 때 쓸 위기 특보 사실. */
export const crisisRadio = (): { directive: string | null; facts: string[] } => { const s = cur(); return { directive: crisisRadioDirective(s), facts: crisisFacts(s, ctx.gameDate) }; };
/** 신문(media)용: 위기 동안 프롬프트 앞에 특별판 지시를 끼운다(없으면 그대로). */
export function crisisNewsWrap(messages: ChatMessage[]): ChatMessage[] { const d = crisisNewsDirective(cur()); return d ? [messages[0], { role: 'system', content: d }, ...messages.slice(1)] : messages; }
/** 신문(media)용: 위기 특별판 호를 표시(이 호만 특별판 지면). */
export function crisisMarkIssue(id: number, label: { ko: string; en: string }): void { const s = cur(); markCrisisIssue(s, id, label); save(); broadcast(); }
/** 신문(media)용: 이 호가 위기 특별판인가(호외 연 상한 계산에서 뺀다). */
export const crisisIsSpecial = (id: number): boolean => cur().issues.includes(id);

const collector = new CrisisCollector();
export function onCrisisBatch(kinds: string[], date: string): void {
  if (!ctx.curSaveId) return;
  const s = cur(); const { began, ended } = applyCrisis(s, kinds, date || ctx.gameDate);
  if (!began.length && !ended.length) return;
  save();
  for (const k of began) {
    const t = crisisBeginText(k); chronNoteWorld(t, false);
    const nm = crisisName(k, selectedBase()); ctx.notify({ kind: 'news', title: pick('⚠ 은하 위기 · 긴급 특별 방송', '⚠ Galactic crisis · Emergency broadcast'), body: `"${nm}" — ` + pick('신문과 라디오가 특별 편성으로 바뀝니다.', 'newspapers and radio switch to special programming.') });
  }
  if (began.length) void publishSpecial(date || ctx.gameDate, crisisSpecialFact(began, date || ctx.gameDate), { ko: crisisNames(began, 'ko'), en: crisisNames(began, 'en') }); // 위기 특별판은 이때 한 번만(정기호·일반 호외는 평소 지면)
  for (const k of ended) { const t = crisisEndText(k); chronNoteWorld(t, false); if (!s.active.length) noteExtra('war_end', date || ctx.gameDate, t); }
  logDiagnostic('info', 'crisis.changed', { began, ended, active: s.active });
  broadcast();
}

export function registerCrisis(router: LogRouter): void {
  router.on(SLOT.CRISIS, 'crisis:scan', (m: SllmMessage) => {
    if (m.kind !== 'CRISIS' && m.kind !== 'CRISIS_END') return;
    const r = collector.feed(m.kind, m.kv); if (r) onCrisisBatch(r.kinds, r.date);
  });
  ipcMain.handle('crisisState', async () => crisisView());
}
export const _crisisTest = { reset: () => { data = {}; } };

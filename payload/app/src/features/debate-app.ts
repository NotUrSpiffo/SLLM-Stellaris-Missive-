// 라디오 찬반 논평(2026-10-20 알파 10 ②, 라디오 전용). 규칙: src/debate.ts.
// 부르는 곳: 전쟁 선언문 발표(declare-app), 남의 전쟁에 우리 성명(condemn-app), 은하 공동체의 규탄(condemn-app).
// 사건이 나면 "찬성파와 반대파의 논평이 진행중입니다" 알림만 띄운다(AI 호출 없음). 알림이나 라디오 창의 [듣기]를 누르면
// 라디오를 켜고(꺼져 있었으면) 그때 AI 를 한 번 불러 진행자·찬성 의원·반대 의원의 대담 8줄을 방송한다. 신문·집무실에는 싣지 않는다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { gameState } from './gamestate-app';
import { radio, setRadio, configuredStation, pushRadioState } from './radio-app';
import { settings } from '../app/settings';
import { safeSend } from '../safe-send';
import { redactKey } from '../aiclient';
import { safeKey } from '../music';
import { gameName } from './namegen-app'; // 의원 이름: 게임 이름 표(우리 제국 종족 비율)
import { type Debate, type DebateKind, pickSides, debateGenders, debateMessages, parseDebate, sanitizeDebate, randomName, voiceOf } from '../debate';

const file = () => path.join(app.getPath('userData'), 'sllm_debate.json');
let store: ReturnType<typeof sanitizeDebate> | null = null;
function all() { if (store) return store; try { store = sanitizeDebate(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'debate', error: e }); store = sanitizeDebate({}); } return store; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'debate', error: e }); } }
const listOf = (sid = ctx.curSaveId) => (sid ? (all().saves[safeKey(sid)] ??= []) : []);
/** 아직 듣지 않은 논평(최근 것부터, 최대 3건). 라디오 창의 알림 줄에 보인다. */
export function pendingDebates(): Array<{ id: string; date: string; topic: string; pro: string; con: string }> {
  return listOf().filter((d) => !d.aired).slice(-3).reverse().map((d) => ({ id: d.id, date: d.date, topic: d.topic, pro: d.pro.faction, con: d.con.faction }));
}
const pushPending = () => safeSend(radio.win, 'radioDebates', { list: pendingDebates(), alarm: all().alarm });

/** 큰 사건 하나에 찬반 논평 알림을 건다. 파벌이 없거나(군체·기계) 찬성·반대 어느 한쪽이 없으면 조용히 넘어간다. */
export function debateOn(kind: DebateKind, topic: string, date = ctx.gameDate || ''): void {
  const snap = gameState.last, sides = pickSides(kind, snap?.factions, !!snap?.gestalt); if (!sides || !ctx.curSaveId) return;
  const list = listOf(), id = kind + '|' + date + '|' + topic.slice(0, 60);
  if (list.some((d) => d.id === id)) return;
  const g = debateGenders(Math.random()), nm = (x: 'm' | 'f') => gameName(x) || randomName();
  const d: Debate = { id, date, kind, topic: topic.slice(0, 300), lines: [], aired: false,
    pro: { faction: sides.pro.name, ethic: sides.pro.ethic, support: sides.pro.support, gender: g.pro, name: nm(g.pro) },
    con: { faction: sides.con.name, ethic: sides.con.ethic, support: sides.con.support, gender: g.con, name: nm(g.con) } };
  list.push(d); if (list.length > 20) list.splice(0, list.length - 20); save();
  pushPending();
  if (all().alarm) ctx.notify({ kind: 'debate', title: pick('찬성파와 반대파의 논평이 진행중입니다.', 'For and against: a debate is on the air.'), body: `${d.pro.faction} ↔ ${d.con.faction} — ${d.topic.slice(0, 120)}`, action: pick('라디오로 듣기', 'Listen on the radio') });
  logDiagnostic('info', 'debate.pending', { kind, pro: d.pro.ethic, con: d.con.ethic });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let playing = false;
/** 논평 한 편을 라디오로 내보낸다(id 가 없으면 가장 최근 미청취 논평). 라디오가 꺼져 있으면 켠다. */
export async function playDebate(id?: string): Promise<{ ok: boolean; error?: string }> {
  const sid = ctx.curSaveId, list = listOf(sid), d = id ? list.find((x) => x.id === id) : list.filter((x) => !x.aired).pop();
  if (!d || !sid) return { ok: false, error: pick('들을 논평이 없습니다.', 'There is no debate to listen to.') };
  if (playing) return { ok: false, error: pick('논평을 준비하고 있습니다.', 'The debate is being prepared.') };
  playing = true;
  try {
    if (!radio.on) setRadio(true);
    for (let i = 0; i < 90 && radio.busy; i++) await sleep(1000); // 정규 방송을 만드는 중이면 끝날 때까지
    if (!radio.on || radio.busy) return { ok: false, error: pick('라디오가 바쁩니다. 잠시 뒤 다시 눌러 주세요.', 'The radio is busy. Try again shortly.') };
    const station = configuredStation(settings.radioStation), session = radio.session;
    radio.busy = true; safeSend(radio.win, 'radioWorking', true);
    try {
      if (!d.pro.name) d.pro.name = gameName(d.pro.gender) || randomName(); if (!d.con.name) d.con.name = gameName(d.con.gender) || randomName(); // 옛 기록
      if (!d.lines.length) {
        const msgs = debateMessages(ctx.playerName || 'the player empire', d, station.announcer, station.name);
        let p = parseDebate(await ctx.ai.chat(msgs, { purpose: 'debate', json: true, maxTokens: 1600 }));
        if (!p) p = parseDebate(await ctx.ai.chat([...msgs, { role: 'user', content: 'Rewrite it. I need complete JSON with exactly 8 lines in the order announcer, pro, con, pro, con, pro, con, announcer.' }], { purpose: 'debate', json: true, maxTokens: 1600 }));
        if (!p) { safeSend(radio.win, 'radioError', pick('찬반 논평 대본을 완성하지 못했습니다. 다시 눌러 주세요.', 'Could not complete the debate script. Please try again.')); return { ok: false }; }
        d.lines = p.lines; d.station = station.name;
      }
      if (session !== radio.session || sid !== ctx.curSaveId) return { ok: false };
      for (let i = 0; i < 20 && radio.win && radio.win.webContents.isLoading(); i++) await sleep(250); // 방금 켠 창이 다 뜰 때까지
      d.aired = true; save();
      const names = { announcer: station.announcer, pro: d.pro.name, con: d.con.name };
      safeSend(radio.win, 'radioBroadcast', { debate: true, date: d.date, lines: d.lines, station: station.name, parent: station.parent, names, factions: { pro: d.pro.faction, con: d.con.faction }, voice: { pro: voiceOf(d.pro.gender), con: voiceOf(d.con.gender) }, topic: d.topic });
      pushPending(); logDiagnostic('info', 'debate.aired', { kind: d.kind });
      return { ok: true };
    } catch (e) { safeSend(radio.win, 'radioError', redactKey((e as Error).message)); return { ok: false }; }
    finally { radio.busy = false; radio.lastEnd = Date.now(); safeSend(radio.win, 'radioWorking', false); pushRadioState(); }
  } finally { playing = false; }
}
export function registerDebate(): void {
  ipcMain.handle('radioDebates', async () => ({ list: pendingDebates(), alarm: all().alarm }));
  ipcMain.handle('radioDebatePlay', async (_e, id: unknown) => playDebate(typeof id === 'string' ? id : undefined));
  ipcMain.handle('radioDebateAlarm', async (_e, on: unknown) => { all().alarm = on !== false; save(); return { alarm: all().alarm }; });
}

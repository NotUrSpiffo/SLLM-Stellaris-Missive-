// 비방 공작 → 신문 스캔들(2026-10-20 알파 9 ③) — 앱 쪽. 규칙: src/scandal.ts, 화면: ui/scandal.html.
// 모드 SPYOP(type=smear) → gamestate-app 의 onGameSpyOp → 여기.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { onGameSpyOp } from './gamestate-app';
import { chronNoteWorld } from './chronicle-app';
import { noteExtra } from './media';
import { moodNudge } from './mood-app';
import { debateOn } from './debate-app';
import { radio } from './radio-app';
import { openScandalPress } from './press-app'; // 추문 기자회견 = 실제 인터뷰(2026-10-20)
import { openGameHearing } from './espionage-app'; // 의혹 보도 → 상대 제국의 해명 요구(청문회)
import { safeSend } from '../safe-send';
import { type Scandal, type ScandalResp, scandalFrom, sanitizeScandal, respMood, SCANDAL_MOOD } from '../scandal';

const file = () => path.join(app.getPath('userData'), 'sllm_scandal.json');
let store: ReturnType<typeof sanitizeScandal> | null = null;
function all() { if (store) return store; try { store = sanitizeScandal(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scandal', error: e }); store = sanitizeScandal({}); } return store; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'scandal', error: e }); } }
const listOf = () => (ctx.curSaveId ? (all().saves[safeKey(ctx.curSaveId)] ??= []) : []);
export const scandal = { cur: null as Scandal | null, win: null as BrowserWindow | null };
const me = () => ctx.playerName || L('우리 정부', 'our government');

function onSmear(s: Scandal): void {
  const list = listOf(); if (!ctx.curSaveId || list.some((x) => x.id === s.id)) return;
  list.push(s); if (list.length > 30) list.splice(0, list.length - 30); save();
  const date = s.date || ctx.gameDate || '';
  if (s.side === 'against') {
    const line = L(`${date} [추문] 출처를 알 수 없는 문서가 퍼지며 ${me()} 정부가 외국 정부를 모욕·기만했다는 의혹이 제기됐다. 문서는 위조로 보이지만 파문이 커지고 있다.`,
      `${date} [Scandal] Anonymous documents claim officials of ${me()} insulted and deceived foreign governments. The papers look forged, but the uproar is growing.`);
    chronNoteWorld(line, true); noteExtra('scandal', date, line); moodNudge(SCANDAL_MOOD.hit, L('정부 추문 보도', 'Government scandal in the press'));
    scandal.cur = s;
    ctx.notify({ kind: 'scandal', title: L('우리 정부를 둘러싼 추문이 보도되고 있습니다 — 대응하시겠습니까?', 'A scandal about our government is in the press — how will you respond?'), body: L('기자회견·라디오 반박·무시 중에서 고를 수 있습니다. 대응에 따라 민심이 달라집니다.', 'Hold a press conference, rebut it on the radio, or ignore it. Public mood depends on your answer.'), action: L('대응하기', 'Respond') });
  } else {
    const line = L(`${date} [추문] ${s.other} 정부가 외국 정부를 모욕·기만했다는 문서가 은하 언론에 퍼졌다. ${s.other} 정부는 위조라고 반발했다.`,
      `${date} [Scandal] Documents claiming the government of ${s.other} insulted and deceived foreign governments spread through the galactic press. ${s.other} calls them forgeries.`);
    chronNoteWorld(line, true); noteExtra('scandal', date, line);
    if (s.exposed) {
      const ex = L(`${date} [의혹] 일부 언론은 ${s.other} 추문 뒤에 ${me()} 첩보 기관이 있다는 의혹을 제기했다.`, `${date} [Allegation] Some outlets suggest the intelligence service of ${me()} was behind the ${s.other} scandal.`);
      chronNoteWorld(ex, true); moodNudge(SCANDAL_MOOD.exposed, L('비방 공작 개입 의혹', 'Alleged smear campaign'));
      debateOn('smear_ok', `${s.other}: ${ex}`, date);
      openGameHearing({ opponent: s.other, operation: L('비방 공작', 'Smear campaign'), facts: [ex.replace(/^\S+\s/, ''), L(`${s.other} 정부를 겨냥한 위조 문서가 은하 언론에 퍼졌다.`, `Forged documents targeting the government of ${s.other} spread through the galactic press.`)], key: 'smear|' + s.id });
    }
  }
  logDiagnostic('info', 'scandal.smear', { side: s.side, exposed: s.exposed });
}

/** 플레이어의 대응. 성명문은 기자회견·라디오 반박에만(비우면 짧은 기본 문구). */
async function respond(rIn: unknown, textIn: unknown): Promise<{ ok: boolean; error?: string }> {
  const s = scandal.cur; if (!s) return { ok: false, error: L('대응할 추문이 없습니다.', 'There is no scandal to respond to.') };
  const r: ScandalResp = rIn === 'press' || rIn === 'radio' ? rIn : 'ignore';
  if (r === 'press') { // 실제 인터뷰 화면: 추문 한 주제. 끝나면 pressDone 이 결과로 마무리한다.
    const err = openScandalPress({ sid: ctx.curSaveId || '', id: s.id, suspect: s.other, date: s.date, done: (good) => pressDone(s, good) });
    return err ? { ok: false, error: err } : { ok: true };
  }
  const text = r === 'ignore' ? '' : (typeof textIn === 'string' ? textIn.replace(/\s+/g, ' ').trim().slice(0, 600) : '') || L('정부는 근거 없는 위조 문서에 흔들리지 않을 것입니다.', 'The government will not be shaken by baseless forged documents.');
  const rec = listOf().find((x) => x.id === s.id); if (rec) { rec.resp = r; rec.text = text; save(); }
  const date = ctx.gameDate || s.date;
  const line = r === 'radio' ? L(`${date} ${me()} 정부, 국영 라디오로 추문 반박: "${text}"`, `${date} ${me()} rebuts the scandal on state radio: "${text}"`)
    : L(`${date} ${me()} 정부는 추문에 아무 대응도 하지 않았다. 소문은 가라앉지 않고 있다.`, `${date} ${me()} has not responded to the scandal. The rumors are not dying down.`);
  chronNoteWorld(line, true);
  if (r === 'radio' && radio.on) { radio.q.push({ kind: 'scandal', date, text: line, n: Date.now() % 1e9, id: 'scandal|' + s.id }); safeSend(radio.win, 'radioQueue', radio.q.size); } // 다음 방송의 화제로
  moodNudge(respMood(r), r === 'radio' ? L('추문 라디오 반박', 'Scandal radio rebuttal') : L('추문 무시', 'Scandal ignored'));
  debateOn('smeared', line, date); // 라디오 찬반 논평 알림
  scandal.cur = null; logDiagnostic('info', 'scandal.respond', { resp: r });
  return { ok: true };
}

/** 추문 기자회견이 끝났다(인터뷰 평가). 호평이면 +6, 아니면 −4. */
function pressDone(s: Scandal, good: boolean): void {
  const rec = listOf().find((x) => x.id === s.id); if (rec) { rec.resp = 'press'; rec.text = good ? 'good' : 'bad'; save(); }
  const date = ctx.gameDate || s.date;
  const line = good ? L(`${date} ${me()} 지도자가 긴급 기자회견에서 추문을 해명했다. 언론은 해명이 설득력 있다고 평가했다.`, `${date} The leader of ${me()} addressed the scandal at an emergency press conference. The press found the explanation convincing.`)
    : L(`${date} ${me()} 지도자가 긴급 기자회견을 열었지만 해명은 설득력이 없었다는 평가가 나왔다.`, `${date} The leader of ${me()} held an emergency press conference, but the explanation was judged unconvincing.`);
  chronNoteWorld(line, true);
  moodNudge(respMood('press', good), good ? L('추문 기자회견 호평', 'Scandal press conference well received') : L('추문 기자회견 실패', 'Scandal press conference fell flat'));
  debateOn('smeared', line, date);
  if (scandal.cur && scandal.cur.id === s.id) scandal.cur = null;
  logDiagnostic('info', 'scandal.press', { good });
}
export function openScandal(): void {
  if (!scandal.cur) return;
  if (scandal.win && !scandal.win.isDestroyed()) { scandal.win.show(); scandal.win.focus(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, w = Math.min(760, Math.round(area.width * 0.7)), h = Math.min(600, Math.round(area.height * 0.8));
  scandal.win = new BrowserWindow({ width: w, height: h, x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + (area.height - h) / 2), resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  scandal.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void scandal.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'scandal.html'));
  scandal.win.once('ready-to-show', () => scandal.win?.show());
  scandal.win.on('closed', () => { scandal.win = null; });
}
export function registerScandal(): void {
  onGameSpyOp((op) => { const s = scandalFrom(op, ctx.playerName, Math.random()); if (s) onSmear(s); });
  ipcMain.handle('scandalState', async () => {
    const s = scandal.cur; if (!s) return null;
    return { date: s.date, suspect: s.other, empire: me(), mood: { hit: SCANDAL_MOOD.hit, pressGood: SCANDAL_MOOD.pressGood, pressBad: SCANDAL_MOOD.pressBad, radio: SCANDAL_MOOD.radio, ignore: SCANDAL_MOOD.ignore }, radioOn: radio.on };
  });
  ipcMain.handle('scandalRespond', async (_e, r: unknown, t: unknown) => respond(r, t));
  ipcMain.handle('scandalClose', async () => { if (scandal.win && !scandal.win.isDestroyed()) scandal.win.close(); return true; });
}

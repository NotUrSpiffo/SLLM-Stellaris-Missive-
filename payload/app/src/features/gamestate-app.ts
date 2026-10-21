// 게임 상황 수집 연결(2026-10-16 초석). 모드의 월간 상황·출신·첩보 작전 로그를 받아 보관한다.
// 지금은 저장과 연대기 기록까지. 평화 중재·파벌 회의·첩보 화면에 실제 자료로 넣는 것은 다음 단계(게임 검수 후).
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick'; // 연대기 문장은 인터페이스 언어로(2026-10-19)
import { chronNoteWorld } from './chronicle-app';
import { onFactionSnapshot } from './faction-app';
import { onMediationYear } from './mediation-app';
import { onVassalSnapshot } from './vassal-app';
import { onPolicySnapshot } from './policy-app';
import { onMoodSnapshot } from './mood-app'; // 민심(알파 10, 2026-10-20)
import { StateCollector, StateSnapshot, OriginRecord, SpyOpRecord, originFrom, spyOpFrom, originText, spyCandidate } from '../gamestate';

const MAX_KEEP = 50;
export const gameState = {
  collector: new StateCollector(),
  /** 마지막으로 완성된 월간 상황(세이브 번호 포함) */
  last: null as StateSnapshot | null,
  origins: [] as OriginRecord[],
  spyOps: [] as SpyOpRecord[],
};

const snapListeners: Array<(snap: StateSnapshot) => void> = [];
/** 매달 게임 상황을 받고 싶은 기능(이 파일을 가져오는 쪽)이 등록한다 — 가져오기 순환 없이(2026-10-19, 비서 상황 이벤트 기한). */
export function onGameSnapshot(fn: (snap: StateSnapshot) => void): void { snapListeners.push(fn); }
const originListeners: Array<(o: OriginRecord) => void> = [];
/** 반란·독립으로 새 나라가 생겼을 때(모드 SLLM:ORIGIN) 받고 싶은 기능이 등록한다(2026-10-19, 독립 선언 서신). */
export function onGameOrigin(fn: (o: OriginRecord) => void): void { originListeners.push(fn); }
const spyListeners: Array<(op: SpyOpRecord) => void> = [];
/** 끝난 첩보 작전(SPYOP)을 받는다 — 비방 공작 스캔들(scandal-app, 2026-10-20). */
export function onGameSpyOp(fn: (op: SpyOpRecord) => void): void { spyListeners.push(fn); }

export function registerGameState(router: LogRouter): void {
  let lastAgendaFinished = '';
  let pendingAgendaFinished: { sid: string; date: string } | null = null;
  router.on(SLOT.GAMESTATE, 'gamestate', (m: SllmMessage) => {
    if (m.kind === 'AGENDA_FINISHED') {
      // The event immediately follows this marker with a fresh snapshot.
      pendingAgendaFinished = m.kv.sid === ctx.curSaveId ? { sid: m.kv.sid, date: m.kv.date } : null;
      return;
    }
    const snap = gameState.collector.feed(m);
    if (snap) {
      gameState.last = snap;
      const key = `${snap.sid}:${snap.n}`;
      const finished = pendingAgendaFinished?.sid === snap.sid && pendingAgendaFinished?.date === snap.date && key !== lastAgendaFinished;
      pendingAgendaFinished = null;
      onFactionSnapshot(snap, finished);
      onMediationYear(snap); // 해가 바뀌면 AI 끼리 전쟁 중재 제안을 굴린다(LLM 없음)
      onVassalSnapshot(snap); // 종속국 통신 채널: 채널 갱신·충성도 급변 서신(2026-10-17)
      onPolicySnapshot(snap); // 정책 퀘스트: 한 달 측정·판정(2026-10-18)
      onMoodSnapshot(snap); // 민심: 점수·추이 기록, 급락 알림(2026-10-20 알파 10)
      for (const f of snapListeners) { try { f(snap); } catch (e) { logDiagnostic('warn', 'gamestate.listener_failed', { error: String(e) }); } } // 비서 상황 이벤트 기한 등(2026-10-19)
      if (finished) {
        lastAgendaFinished = key;
        chronNoteWorld(L(`제국 평의회 의제가 완료되어 새 의제를 선택할 수 있습니다. (${snap.date})`, `The empire's council agenda is complete; a new agenda can be chosen. (${snap.date})`), true);
        logDiagnostic('info', 'faction.agenda_finished', { sid: snap.sid, date: snap.date, factions: snap.factions.length });
      }
      logDiagnostic('info', 'gamestate.snapshot', { date: snap.date, wars: snap.wars.length, factions: snap.factions.length, spynets: snap.spynets.length, subject: !!snap.subject });
      return;
    }
    const o = originFrom(m);
    if (o) {
      gameState.origins.push(o); gameState.origins.splice(0, Math.max(0, gameState.origins.length - MAX_KEEP));
      chronNoteWorld(originText(o), true);
      for (const f of originListeners) { try { f(o); } catch (e) { logDiagnostic('warn', 'gamestate.origin_listener_failed', { error: String(e) }); } }
      return;
    }
    const op = spyOpFrom(m);
    if (op) {
      gameState.spyOps.push(op); gameState.spyOps.splice(0, Math.max(0, gameState.spyOps.length - MAX_KEEP));
      const cand = spyCandidate(op, ctx.playerName);
      logDiagnostic('info', 'gamestate.spyop', { phase: op.phase, owner: op.owner, target: op.target, role: cand?.role ?? null, type: op.type ?? null });
      for (const f of spyListeners) { try { f(op); } catch (e) { logDiagnostic('warn', 'gamestate.spyop_listener_failed', { error: String(e) }); } }
    }
  });
}

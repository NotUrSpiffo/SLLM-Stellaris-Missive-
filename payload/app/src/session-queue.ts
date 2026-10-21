import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)
/** Serial command queue. Queued work belongs to the save/session that requested it. */
export class SessionCommandQueue {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private current: () => { epoch: number; sid: string }) {}
  run<T>(work: () => Promise<T>): Promise<T> {
    const requested = this.current();
    const execute = () => {
      const now = this.current();
      if (now.epoch !== requested.epoch || now.sid !== requested.sid) {
        throw new Error(L('게임 또는 세이브가 바뀌어 대기 중인 요청을 취소했습니다. 현재 세이브에서 다시 시도해 주세요.', 'The game or save changed, so the queued request was cancelled. Please try again in the current save.'));
      }
      return work();
    };
    const next = this.pending.then(execute);
    this.pending = next.catch(() => undefined);
    return next;
  }
}

import type { ChatMessage } from './player2';
/**
 * 상대가 바뀔 때의 대화 기록 보관(2026-10-17): 지금 기록을 이전 상대 몫으로 맡겨 두고, 새 상대의 지난 기록(없으면 빈 기록)을 돌려준다.
 * 다른 상대의 말이 섞이지 않고, 돌아오면 이어서 쓴다. 보관은 최근 상대 40명까지.
 */
export function switchHistories(store: Map<number, ChatMessage[]>, current: ChatMessage[], prev: number, next: number, keep = 40): ChatMessage[] {
  if (prev) { store.delete(prev); store.set(prev, current); }
  while (store.size > keep) store.delete(store.keys().next().value as number);
  return store.get(next) ?? [];
}

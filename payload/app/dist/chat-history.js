"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchHistories = switchHistories;
/**
 * 상대가 바뀔 때의 대화 기록 보관(2026-10-17): 지금 기록을 이전 상대 몫으로 맡겨 두고, 새 상대의 지난 기록(없으면 빈 기록)을 돌려준다.
 * 다른 상대의 말이 섞이지 않고, 돌아오면 이어서 쓴다. 보관은 최근 상대 40명까지.
 */
function switchHistories(store, current, prev, next, keep = 40) {
    if (prev) {
        store.delete(prev);
        store.set(prev, current);
    }
    while (store.size > keep)
        store.delete(store.keys().next().value);
    return store.get(next) ?? [];
}
//# sourceMappingURL=chat-history.js.map
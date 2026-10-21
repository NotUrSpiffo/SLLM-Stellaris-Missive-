"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ctx = void 0;
exports.bindCtx = bindCtx;
exports.ctx = {};
/** main.ts가 한 번 부른다. 함수는 그대로, 변수는 get/set 쌍으로 넘긴다. */
function bindCtx(b) {
    for (const [k, v] of Object.entries(b)) {
        const isBinding = !!v && Object.getPrototypeOf(v) === Object.prototype && typeof v.get === 'function'; // Map 같은 객체는 값으로 넘긴다(Map 에도 get 이 있다)
        if (isBinding)
            Object.defineProperty(exports.ctx, k, { get: v.get, set: v.set, enumerable: true, configurable: true });
        else
            Object.defineProperty(exports.ctx, k, { value: v, enumerable: true, configurable: true, writable: false });
    }
}
//# sourceMappingURL=ctx.js.map
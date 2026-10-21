"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeSend = safeSend;
function safeSend(w, channel, ...args) {
    if (!w)
        return false;
    try {
        if (w.isDestroyed() || w.webContents.isDestroyed?.())
            return false;
        w.webContents.send(channel, ...args);
        return true;
    }
    catch {
        return false;
    } // 확인과 보내기 사이에 창이 닫힌 경우
}
//# sourceMappingURL=safe-send.js.map
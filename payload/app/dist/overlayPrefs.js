"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOTKEY_CHOICES = void 0;
exports.sanitizeHotkey = sanitizeHotkey;
exports.clampFade = clampFade;
exports.pointInRect = pointInRect;
exports.fadeTarget = fadeTarget;
exports.stepOpacity = stepOpacity;
// 오버레이 편의 기능의 순수 계산: 단축키 검사, 자동 흐려짐.
exports.HOTKEY_CHOICES = ['', 'Alt+F8', 'F8', 'F9', 'F10', 'Ctrl+Alt+T', 'Ctrl+Shift+Space'];
/** 허용한 단축키 목록에 있는 값만 받는다. 빈 문자열은 "사용 안 함". */
function sanitizeHotkey(v, fallback = 'Alt+F8') {
    return typeof v === 'string' && exports.HOTKEY_CHOICES.includes(v) ? v : fallback;
}
function clampFade(v, fallback = 0.6) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0.3, n)) * 100) / 100 : fallback;
}
function pointInRect(p, r) {
    return p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height;
}
/** 지금 있어야 할 투명도. 흐려짐이 꺼져 있거나, 마우스가 위에 있거나, 창이 포커스를 가졌거나, 방금 활동이 있었으면 1. */
function fadeTarget(o) {
    return !o.enabled || o.inside || o.focused || o.recent ? 1 : o.base;
}
/** 목표를 향해 한 걸음(깜박이지 않게 부드럽게). */
function stepOpacity(cur, target, step) {
    if (Math.abs(target - cur) <= step)
        return target;
    return Math.round((cur + Math.sign(target - cur) * step) * 100) / 100;
}
//# sourceMappingURL=overlayPrefs.js.map
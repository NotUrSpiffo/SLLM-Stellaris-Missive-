"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOM_CSS_TEMPLATE = exports.CUSTOM_KEYS = exports.THEME_NAMES = exports.EXTRA_THEMES = exports.ETHIC_THEMES = void 0;
exports.sanitizeTheme = sanitizeTheme;
exports.sanitizeCustom = sanitizeCustom;
// 앱 화면의 색 테마. 테마 정의 자체는 화면(ui/index.html)에 있고, 여기서는 저장된 값을 검증한다.
// 사용자가 고른 색(custom)은 허용한 항목만, #rrggbb 형식만 받는다.
// stellaris = 기본형(지금 모양). A-22 가치관 테마 10종은 ui/theme.js 에 색과 연출이 있다.
exports.ETHIC_THEMES = ['egalitarian', 'authoritarian', 'militarist', 'pacifist', 'materialist', 'spiritualist', 'xenophile', 'xenophobe', 'machine', 'hive'];
/** A-22 2단계: 바닐라 홀로그램풍(스텔라리스 원래 UI 느낌을 CSS로만 흉내, 게임 그림은 쓰지 않음) */
exports.EXTRA_THEMES = ['holo'];
exports.THEME_NAMES = ['stellaris', 'terminal', 'starfield', 'custom', ...exports.ETHIC_THEMES, ...exports.EXTRA_THEMES];
exports.CUSTOM_KEYS = ['bg', 'panel', 'text', 'hi', 'gold'];
function sanitizeTheme(v) {
    return exports.THEME_NAMES.includes(v) ? v : 'stellaris';
}
function sanitizeCustom(v) {
    const out = {};
    if (!v || typeof v !== 'object')
        return out;
    for (const k of exports.CUSTOM_KEYS) {
        const c = v[k];
        if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
            out[k] = c.toLowerCase();
    }
    return out;
}
/** 사용자 CSS 파일의 처음 내용(주석으로 쓸 수 있는 항목 안내). */
exports.CUSTOM_CSS_TEMPLATE = `/* 내 CSS: 저장한 뒤 앱 설정의 "CSS 다시 불러오기"를 누르면 바로 적용됩니다. */
/* 아래 예시의 바깥 주석 표시를 지우면 켜집니다. 바꿀 수 있는 색 변수 목록입니다.
:root{
  --bg:#06141b; --panel:#0b2230; --text:#dcecf0; --dim:#7fa3ad;
  --hi:#5fd4e4; --hi-text:#04161d; --ai:#7fe3f0; --gold:#e8c872;
  --bad:#e0705f; --good:#6fd6a8; --linec:#5fd4e4;
}
body{ font-size:14px; }
*/
`;
//# sourceMappingURL=theme.js.map
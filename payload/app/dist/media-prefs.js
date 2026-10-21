"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAPER_FONTS = exports.MEDIA_FAMILIES = void 0;
exports.cleanFont = cleanFont;
exports.defaultPersona = defaultPersona;
exports.isDefaultPersona = isDefaultPersona;
exports.sanitizeMedia = sanitizeMedia;
exports.effectivePaper = effectivePaper;
// 언론사 설정의 순수 부분(electron 없이 시험할 수 있게 media-custom.ts 에서 나눔, A-21 2026-10-15).
const galnews_1 = require("./galnews");
exports.MEDIA_FAMILIES = [
    { id: 'stn', radio: '성간방송 STN' },
    { id: 'starcluster', radio: '별무리 라디오' },
    { id: 'void', radio: '공허 공영방송' },
];
/** font: A-21 신문 서체(2026-10-15 사용자 21:40 — "문체"는 글꼴 고르기였다. 글 내용·AI 지시는 바꾸지 않음). auto = 지면 모양에 맞춤 */
exports.PAPER_FONTS = [
    { id: 'auto', name: '자동 (종이는 명조, 디스플레이는 고딕)' },
    { id: 'myeongjo', name: '명조 — 진지한 신문 (Noto Serif KR)' },
    { id: 'batang', name: '바탕 — 고전적인 활자 (Batang)' },
    { id: 'gothic', name: '고딕 — 단정한 (Noto Sans KR · 맑은 고딕)' },
    { id: 'pretendard', name: '프리텐다드 — 모던 (Pretendard)' },
];
function cleanFont(v) { return exports.PAPER_FONTS.some((f) => f.id === v) ? v : 'auto'; }
/** 설정창에 보일 기본 페르소나 영어(신문사 순서대로, 2026-10-19 영어 화면). */
const PERSONA_EN = [
    'Calm, formal style of a traditional daily newspaper.\nA conservative newspaper. It writes pessimistically and with concern about pacifist moves and alien-friendly moves (e.g. alliances or pacts with empires of many species), and approvingly about the player empire\'s military actions. It shows a xenophobic view but never uses slurs or insults. It never changes the facts themselves; the leaning shows only in judgments and tone.',
    'Breaking-news style that leads with the key point, yet explains fully rather than tersely.\nA progressive newspaper. It welcomes pacifist and alien-friendly moves, and writes pessimistically and critically about xenophobic events and wars. At times it speaks openly in favor of aliens. It never changes the facts themselves; the leaning shows only in judgments and tone.',
    'Cynical, sharp style of a current-affairs weekly.\nA neutral newspaper. It takes no side and reports the facts as accurately as possible. It adds no opinions or speculation.',
];
/** 기본 페르소나(설정창 표시용). t 를 주면 화면 언어로(기본 한국어). */
function defaultPersona(i, t = (ko) => ko) { const ko = galnews_1.PAPERS[i].tone + '\n' + galnews_1.PAPERS[i].slant.replace('comment 필드는 빈 문자열로 둡니다.', '의견이나 추측을 덧붙이지 않습니다.'); return t(ko, PERSONA_EN[i] ?? ko); }
/** 사용자가 기본 문구를 그대로 저장했는지(한/영 어느 쪽이든) — 그대로면 사용자 글로 보지 않는다(프롬프트에 영어 기본 문구가 가게). */
function isDefaultPersona(i, text) { const s = String(text || '').trim().replace(/\r\n/g, '\n'); return !!galnews_1.PAPERS[i] && (s === defaultPersona(i).trim() || s === (PERSONA_EN[i] ?? '').trim()); }
function sanitizeMedia(value) {
    return galnews_1.PAPERS.map((p, i) => {
        const v = Array.isArray(value) ? value[i] : null;
        return {
            paperName: typeof v?.paperName === 'string' ? v.paperName.trim().slice(0, 40) : '',
            radioName: typeof v?.radioName === 'string' ? v.radioName.trim().slice(0, 40) : '',
            persona: typeof v?.persona === 'string' ? v.persona.trim().slice(0, 4000) : '',
            comments: typeof v?.comments === 'boolean' ? v.comments : p.comments,
            font: cleanFont(v?.font), // 예전 style(문체 글)은 버린다
        };
    });
}
function effectivePaper(prefs, index) {
    const i = galnews_1.PAPERS[index] ? index : 0, base = galnews_1.PAPERS[i], pref = prefs[i];
    const tone = pref?.persona ? '아래 페르소나에 지정된 문체와 관점을 따릅니다.' : base.tone;
    return { ...base, name: pref?.paperName || base.name, comments: pref?.comments ?? base.comments, slant: pref?.persona || base.slant, tone };
}
//# sourceMappingURL=media-prefs.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOfficeStyle = exports.OFFICE_STYLES = void 0;
exports.autoOfficeStyle = autoOfficeStyle;
// 집무실 종류(2026-10-19 사용자 결정): 제국 가치관(권위주의·외계인 친화·외계인 혐오 등)에 따라 집무실 배경이 달라진다.
// 배경 그림은 GPT(ChatGPT)가 그린다(docs/GPT_SECRETARY_TODO_KO.md) → ui/assets/rooms/office-<키>.png. 없으면 기본 집무실(office-ai-v1.png).
// 기본은 「자동」(세이브에서 읽은 우리 제국 가치관), 집무실의 「집무실 꾸미기」 단추로 직접 고를 수 있다(세이브마다 기억).
exports.OFFICE_STYLES = [
    ['standard', '기본 집무실', 'Standard office'],
    ['authoritarian', '권위주의 · 제국풍', 'Authoritarian · Imperial'],
    ['egalitarian', '평등주의 · 공화정풍', 'Egalitarian · Republican'],
    ['xenophile', '외계인 친화', 'Xenophile'],
    ['xenophobe', '외계인 혐오', 'Xenophobe'],
    ['militarist', '군국주의', 'Militarist'],
    ['pacifist', '평화주의', 'Pacifist'],
    ['spiritualist', '유심론', 'Spiritualist'],
    ['materialist', '물질주의', 'Materialist'],
    ['gestalt', '단일 의식(군체·기계)', 'Gestalt (hive · machine)'],
];
const isOfficeStyle = (k) => typeof k === 'string' && exports.OFFICE_STYLES.some(([x]) => x === k);
exports.isOfficeStyle = isOfficeStyle;
/** 자동으로 고를 때 같은 단계에서의 우선순위(눈에 띄는 것부터). */
const ORDER = ['xenophobe', 'xenophile', 'authoritarian', 'egalitarian', 'militarist', 'pacifist', 'spiritualist', 'materialist'];
/** 세이브의 가치관(ethic_fanatic_xenophobe, ethic_authoritarian, ethic_gestalt_consciousness …) → 집무실 종류. 모르면 standard. 광신 가치관이 먼저. */
function autoOfficeStyle(ethics) {
    const e = (ethics ?? []).map((x) => String(x || '').toLowerCase());
    if (e.some((x) => x.includes('gestalt')))
        return 'gestalt';
    const fan = ORDER.find((k) => e.includes('ethic_fanatic_' + k));
    if (fan)
        return fan;
    return ORDER.find((k) => e.includes('ethic_' + k)) ?? 'standard';
}
//# sourceMappingURL=office-style.js.map
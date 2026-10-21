"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPicker = setPicker;
exports.L = L;
// 순수 로직 파일(전자 앱을 가져오지 않는 파일)에서 쓰는 한/영 문구 고르기(2026-10-19 영어 화면 점검).
// L('한국어', 'English') — 화면 언어에 맞는 쪽을 돌려준다. 실제 고르기는 main.ts 가 settings-ui 의 pick(언어 팩 포함)을 setPicker 로 꽂아 준다.
// 꽂히기 전(자체 시험 등)에는 한국어를 돌려준다. 이름이 L 인 것은 언어 팩 뼈대 도구(i18n-pairs.ts)가 L(…, …) 쌍을 모으기 때문.
let impl = (ko) => ko;
function setPicker(fn) { impl = fn; }
function L(ko, en) { return impl(ko, en); }
//# sourceMappingURL=i18n-pick.js.map
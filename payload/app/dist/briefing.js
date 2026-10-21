"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratioWord = ratioWord;
exports.buildBriefing = buildBriefing;
exports.briefingPrompt = briefingPrompt;
const rnd = (n) => Math.round(n);
/** 비율을 말로. 비슷하면 "비슷", 크게 차이 나면 "압도". */
function ratioWord(mine, theirs) {
    if (!(mine > 0) && !(theirs > 0))
        return '비슷';
    if (!(theirs > 0))
        return '상대가 훨씬 약함';
    const r = mine / theirs; // 내 쪽(AI) / 상대(플레이어)
    if (r >= 2)
        return '압도적으로 강함';
    if (r >= 1.25)
        return '더 강함';
    if (r > 0.8)
        return '비슷';
    if (r > 0.5)
        return '더 약함';
    return '압도적으로 약함';
}
/** 세이브가 없거나 수치를 못 읽으면 null. */
function buildBriefing(i) {
    if (!i.ai)
        return null;
    const a = i.ai, p = i.player;
    const out = { ...(i.date ? { 기준일: i.date } : {}), 상대: { 이름: i.aiName, 군사력: rnd(a.military), 기술력: rnd(a.tech), 함대규모: rnd(a.fleet), 영토규모: rnd(a.size), 종합순위: rnd(a.rank) }, 비교: {} };
    if (p) {
        out.비교 = {
            군사력: `${i.aiName}이(가) ${i.playerName || '플레이어'}보다 ${ratioWord(a.military, p.military)}`,
            기술력: `${i.aiName}이(가) ${i.playerName || '플레이어'}보다 ${ratioWord(a.tech, p.tech)}`,
            영토규모: `${i.aiName}이(가) ${i.playerName || '플레이어'}보다 ${ratioWord(a.size, p.size)}`,
        };
    }
    return out;
}
/** 프롬프트용 문단. 수치를 지어내지 않도록 이 값만 쓰라고 알려 준다. */
function briefingPrompt(b) {
    if (!b)
        return '';
    return '게임에서 읽은 국력 브리핑(JSON). 군사력·기술력 같은 비교는 여기 적힌 것만 근거로 말하고 다른 수치는 지어내지 마세요. 숫자를 그대로 읽기보다 "우리가 더 강하다" 같은 말로 자연스럽게 녹이세요:\n' + JSON.stringify(b);
}
//# sourceMappingURL=briefing.js.map
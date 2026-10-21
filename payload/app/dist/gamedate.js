"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateNum = dateNum;
exports.dayNo = dayNo;
exports.cmpDate = cmpDate;
exports.addMonths = addMonths;
exports.addYears = addYears;
// 게임 날짜("YYYY.MM.DD", 달·날은 한 자리도 받음) 계산을 한 곳에 모은다(F-28).
// 예전에는 govmemory.dateNum · mail.cmpDate/addYears · deferred.addMonths · chronicle.dayNo · radio.radioDay 가 따로 있었다.
// 옛 이름은 원래 파일에서 다시 내보내므로 부르는 쪽은 바꾸지 않아도 된다.
const DATE_RE = /^(\d+)\.(\d+)\.(\d+)$/;
function parts(d) { const m = DATE_RE.exec((d || '').trim()); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; }
/** 날짜 → 크기 비교용 숫자(YYYYMMDD). 못 읽으면 NaN. */
function dateNum(d) { const p = parts(d); return p ? p[0] * 10000 + p[1] * 100 + p[2] : NaN; }
/** 날짜 → 일 수(스텔라리스 달력: 한 달 30일, 한 해 360일). 못 읽으면 null. */
function dayNo(d) { const p = parts(d); return p ? p[0] * 360 + (p[1] - 1) * 30 + p[2] : null; }
/** a 가 b 보다 이전이면 음수. 모자란 칸은 0으로 본다(예전 mail.cmpDate 와 같은 규칙). */
function cmpDate(a, b) {
    const p = (d) => d.split('.').map(Number);
    const x = p(a), y = p(b);
    for (let i = 0; i < 3; i++)
        if ((x[i] || 0) !== (y[i] || 0))
            return (x[i] || 0) - (y[i] || 0);
    return 0;
}
/** n 달 뒤(달은 두 자리, F-26). 못 읽으면 그대로. */
function addMonths(date, n) {
    const m = DATE_RE.exec((date || '').trim());
    if (!m)
        return date;
    const t = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
    return `${Math.floor(t / 12)}.${String((t % 12) + 1).padStart(2, '0')}.${m[3]}`;
}
/** n 년 뒤(달·날 표기는 그대로). 못 읽으면 그대로. */
function addYears(date, years) {
    const m = DATE_RE.exec(date.trim());
    if (!m)
        return date;
    return `${Number(m[1]) + years}.${m[2]}.${m[3]}`;
}
//# sourceMappingURL=gamedate.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_PREFIX = void 0;
exports.transcriptLines = transcriptLines;
exports.transcriptText = transcriptText;
const action_1 = require("./action");
const i18n_pick_1 = require("./i18n-pick");
exports.SYSTEM_PREFIX = '[System notice] '; // AI 에게 가는 시스템 알림(2026-10-19 영어 프롬프트). 옛 기록의 한국어 머리말도 알아본다
const OLD_PREFIX = '[시스템 알림] ';
/** 한 줄씩 꾸민 대화 기록(줄바꿈은 \n). maxChars 를 넘으면 오래된 말부터 뺀다. */
function transcriptLines(history, aiName, maxChars = 900) {
    const lines = [];
    let used = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        const m = history[i];
        let line;
        if (m.role === 'assistant') {
            const say = (0, action_1.parseReply)(m.content).say;
            if (!say)
                continue;
            line = `§Y${aiName}§!: ${say}`;
        }
        else if (m.role === 'user') {
            {
                const pre = m.content.startsWith(exports.SYSTEM_PREFIX) ? exports.SYSTEM_PREFIX : m.content.startsWith(OLD_PREFIX) ? OLD_PREFIX : '';
                line = pre ? `§L※ ${m.content.slice(pre.length)}§!` : `§H${(0, i18n_pick_1.L)('나', 'Me')}§!: ${m.content}`;
            }
        }
        else
            continue;
        if (used + line.length > maxChars && lines.length)
            break;
        lines.unshift(line);
        used += line.length;
    }
    return lines;
}
/** 지역화 파일에 넣을 대화 기록. 아무것도 없으면 fallback 을 쓴다. */
function transcriptText(history, aiName, fallback, maxChars = 900) {
    const lines = transcriptLines(history, aiName, maxChars);
    return lines.length ? lines.join('\n\n') : fallback;
}
//# sourceMappingURL=transcript.js.map
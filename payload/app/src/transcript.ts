// 게임 안 대화 창에 보여 줄 대화 기록. 대화 기록(history)을 최근 것부터 거꾸로 모아 글자 수 한도 안에서 자르고,
// 오래된 것부터 아래로 이어 쓴다(가장 최근 말이 맨 아래). 색은 게임의 § 색상 코드를 쓴다.
import { ChatMessage } from './player2';
import { parseReply } from './action';
import { L } from './i18n-pick';

export const SYSTEM_PREFIX = '[System notice] '; // AI 에게 가는 시스템 알림(2026-10-19 영어 프롬프트). 옛 기록의 한국어 머리말도 알아본다
const OLD_PREFIX = '[시스템 알림] ';

/** 한 줄씩 꾸민 대화 기록(줄바꿈은 \n). maxChars 를 넘으면 오래된 말부터 뺀다. */
export function transcriptLines(history: ChatMessage[], aiName: string, maxChars = 900): string[] {
  const lines: string[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    let line: string;
    if (m.role === 'assistant') {
      const say = parseReply(m.content).say;
      if (!say) continue;
      line = `§Y${aiName}§!: ${say}`;
    } else if (m.role === 'user') {
      { const pre = m.content.startsWith(SYSTEM_PREFIX) ? SYSTEM_PREFIX : m.content.startsWith(OLD_PREFIX) ? OLD_PREFIX : ''; line = pre ? `§L※ ${m.content.slice(pre.length)}§!` : `§H${L('나', 'Me')}§!: ${m.content}`; }
    } else continue;
    if (used + line.length > maxChars && lines.length) break;
    lines.unshift(line);
    used += line.length;
  }
  return lines;
}

/** 지역화 파일에 넣을 대화 기록. 아무것도 없으면 fallback 을 쓴다. */
export function transcriptText(history: ChatMessage[], aiName: string, fallback: string, maxChars = 900): string {
  const lines = transcriptLines(history, aiName, maxChars);
  return lines.length ? lines.join('\n\n') : fallback;
}

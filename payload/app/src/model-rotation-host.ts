import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { RotationService, type RotationUse } from './rotation-service';
import { RotationStop } from './model-rotation';
import { logDiagnostic } from './diagnostics';
import { L } from './i18n-pick';

export function rotationEligible(c: {provider: string; baseUrl: string}): boolean {
  return c.provider === 'gemini' && c.baseUrl.replace(/\/+$/, '') === 'https://generativelanguage.googleapis.com/v1beta/openai';
}
let service: RotationService | undefined;
const useListeners: Array<(connectionId: string, use: RotationUse, previous: RotationUse | undefined) => void> = [];
/** Notified after each answered rotation request (display only). */
export function onRotationUse(fn: (connectionId: string, use: RotationUse, previous: RotationUse | undefined) => void): void { useListeners.push(fn); }
export function modelRotation(): RotationService {
  if (!service) {
    const file = path.join(app.getPath('userData'), 'model-rotation-state.json');
    service = new RotationService({
      async read() { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch(e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; } },
      async write(value) {
        const temp = file + '.' + randomUUID() + '.tmp';
        try { await fs.writeFile(temp, JSON.stringify(value), {flag:'wx'}); await fs.rename(temp,file); }
        finally { await fs.unlink(temp).catch(()=>{}); }
      }
    }, code => logDiagnostic('warn','ai.rotation',{code}));
    service.onUse = (id, use, previous) => { for (const fn of useListeners) { try { fn(id, use, previous); } catch { /* display only */ } } };
  }
  return service;
}
export function rotationError(e: unknown): Error {
  if (!(e instanceof RotationStop)) return e instanceof Error ? e : new Error(String(e));
  const messages = {
    INVALID_CONFIG: L('모델 전환 설정을 확인해 주세요. 현재 모델이 후보 목록에 있어야 합니다.', 'Check fallback settings. The current model must be in the candidate list.'),
    QUEUE_FULL: L('AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.', 'Too many AI requests. Try again shortly.'),
    WAIT_REQUIRED: L('Gemini 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 'The Gemini quota was reached. Please try again later.'),
    DEADLINE: L('AI 요청 대기 시간이 초과되었습니다.', 'The AI request deadline was exceeded.'),
    CANCELLED: L('AI 요청이 취소되었습니다.', 'The AI request was cancelled.')
  };
  return new Error(messages[e.code]);
}

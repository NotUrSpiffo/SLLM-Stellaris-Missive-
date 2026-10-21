// 창에 메시지를 안전하게 보낸다. 앱을 강제로 끌 때처럼 창이 이미 사라졌으면 보내지 않고 false 를 돌려준다.
// (사라진 창에 send 하면 Electron 이 "Object has been destroyed" 예외를 던진다. F-36)
export interface SendTarget { isDestroyed(): boolean; webContents: { isDestroyed?(): boolean; send(channel: string, ...args: unknown[]): void } }
export function safeSend(w: SendTarget | null | undefined, channel: string, ...args: unknown[]): boolean {
  if (!w) return false;
  try {
    if (w.isDestroyed() || w.webContents.isDestroyed?.()) return false;
    w.webContents.send(channel, ...args); return true;
  } catch { return false; } // 확인과 보내기 사이에 창이 닫힌 경우
}

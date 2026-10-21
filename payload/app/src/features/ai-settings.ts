// A-00b 4번: AI 연결 설정(Player2 / 개인 API) 화면의 IPC 7개(aiGet·aiSave·aiDelete·aiUse·aiModels·aiTest·aiP2Check).
// 2026-10-15 main.ts whenReady 안에서 옮김(동작 변경 없음). 키 저장은 src/app/settings.ts(getKey·putKey·dropKey).
import { ipcMain, safeStorage } from 'electron';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { modelRotation, rotationEligible, rotationError, onRotationUse } from '../model-rotation-host';
import { AiConn, PRESETS, Provider, listModels, testConn, validBase, normalizeBase, redactKey } from '../aiclient';
import { settings, saveSettings, getKey, putKey, dropKey, lastKeyError } from '../app/settings';
import { ctx } from '../app/ctx';
import { pick as L } from './settings-ui';

// ---- AI 연결 설정 (Player2 / 개인 API)
/** Player2 상태 확인은 Player2를 쓸 때만 돈다. 연결을 바꿀 때마다 시작·중지를 맞춘다. */
export function syncP2Ping() {
  if (settings.aiMode === 'custom') { ctx.p2.stop(); ctx.toUi('status', L('개인 API 연결을 사용 중입니다(Player2 연결 안 함)', 'Using a personal API connection (Player2 not connected)')); }
  else ctx.syncPlayer2Activity();
}
const connView = () => ({ mode: settings.aiMode, active: settings.aiActive, encrypt: safeStorage.isEncryptionAvailable(), presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v])), conns: settings.aiConns.map((c) => ({ ...c, hasKey: !!getKey(c.id) })) });
const sanitizeConn = (c: any): AiConn | string => {
  const provider = (c && c.provider in PRESETS ? c.provider : 'custom') as Provider;
  const baseUrl = normalizeBase(c?.baseUrl || PRESETS[provider].baseUrl);
  if (!validBase(baseUrl)) return L('API 주소가 올바르지 않습니다(https:// 로 시작해야 합니다. 내 컴퓨터의 서버는 http://localhost 만 허용).', 'Invalid API address (it must start with https://; for a server on this PC only http://localhost is allowed).');
  const model = String(c?.model || '').trim(); if (!model) return L('모델을 선택하거나 직접 입력하세요.', 'Choose a model or type one.');
  return { id: String(c?.id || '') || 'c' + Date.now().toString(36), name: String(c?.name || '').trim().slice(0, 40) || PRESETS[provider].label, provider, baseUrl, model: model.slice(0, 120), saveKey: c?.saveKey === true };
};
/** 저장된 키는 저장 당시의 제공자·주소로만 보낸다. 주소나 제공자를 바꿨으면 키를 다시 입력해야 한다. */
const storedKeyOk = (c: any) => {
  const old = settings.aiConns.find((x) => x.id === String(c?.id || ''));
  if (!old) return false;
  const provider = c && c.provider in PRESETS ? c.provider : 'custom';
  return old.provider === provider && normalizeBase(old.baseUrl) === normalizeBase(c?.baseUrl || PRESETS[provider as Provider].baseUrl);
};
const keyFor = (c: any, typed: unknown) => (typeof typed === 'string' && typed.trim() ? typed.trim() : storedKeyOk(c) ? getKey(String(c?.id || '')) : null);
const activeKeyReady = (id: string) => { const c = settings.aiConns.find((x) => x.id === id); return !!c && (!PRESETS[c.provider].needsKey || !!getKey(id)); };

export function registerAiSettings(): void {
  // Tell the player only when the answering Gemini model changes (fallback used, or back on the primary). No prompts or keys involved.
  onRotationUse((_id, use, previous) => {
    if (previous ? previous.model === use.model : !use.switched) return;
    const model = use.model, primary = use.primary;
    ctx.toUi('status', use.switched ? L(`Gemini 모델 한도 때문에 ${model} 모델로 전환해 답했습니다(주 모델 ${primary}).`, `Answered with ${model} after a Gemini model quota (primary ${primary}).`) : L(`주 모델 ${model}(으)로 다시 답하고 있습니다.`, `Answering with the primary model ${model} again.`));
  });
  const rotationConn = (e: Electron.IpcMainInvokeEvent,id: unknown) => {
    const frame = e.senderFrame;
    if (!frame || frame !== e.sender.mainFrame || path.resolve(fileURLToPath(frame.url)) !== path.resolve(__dirname,'../../ui/index.html')) throw new Error('Unauthorized settings window');
    const c = settings.aiConns.find(x=>x.id === id);
    if (!c || !rotationEligible(c)) throw new Error(L('공식 Gemini 연결을 먼저 저장하세요.', 'Save an official Gemini connection first.'));
    return c;
  };
  ipcMain.handle('aiRotationGet',async(e,id:unknown)=>{
    const c=rotationConn(e,id); return {...await modelRotation().get(c.id),status:await modelRotation().status(),usage:await modelRotation().usage(c.id)};
  });
  ipcMain.handle('aiRotationSave',async(e,id:unknown,revision:number,config:unknown)=>{
    const c=rotationConn(e,id);
    try { return await modelRotation().save(c.id,revision,config,c.model); } catch(error) { throw rotationError(error); }
  });

  ipcMain.handle('aiGet', async () => connView());
  ipcMain.handle('aiSave', async (_e, c: any, keyIn: unknown) => {
    const v = sanitizeConn(c); if (typeof v === 'string') return { ok: false, error: v };
    const typed = typeof keyIn === 'string' ? keyIn.trim() : '';
    if (!typed && settings.aiConns.some((x) => x.id === v.id) && !storedKeyOk(c) && PRESETS[v.provider].needsKey) return { ok: false, error: L('제공자나 API 주소를 바꿨습니다. 저장된 키는 다른 서버로 보내지 않으므로 API 키를 다시 입력하세요.', 'You changed the provider or API address. A saved key is never sent to a different server, so enter the API key again.') };
    const key = typed || (storedKeyOk(c) ? getKey(v.id) : null) || '';
    if (!typed && !storedKeyOk(c) && settings.aiConns.some((x) => x.id === v.id)) dropKey(v.id); // 키가 필요 없는 제공자로 바뀐 경우 옛 키를 지운다
    if (v.saveKey && key && !safeStorage.isEncryptionAvailable()) return { ok: false, error: L('이 컴퓨터는 암호화 저장을 지원하지 않습니다. "이 컴퓨터에 API 키 저장"을 끄세요(실행 중에만 기억합니다).', 'This PC does not support encrypted storage. Turn off "Save API key on this PC" (it will be remembered only while running).') };
    if (key && !putKey(v.id, key, v.saveKey)) return { ok: false, error: L('키를 저장하지 못했습니다.', 'Could not save the key.') + (lastKeyError ? ' ' + lastKeyError : '') }; // F-33 A: 이유를 같이 보여 줌
    const i = settings.aiConns.findIndex((x) => x.id === v.id); if (i >= 0) settings.aiConns[i] = v; else settings.aiConns.push(v);
    if (!settings.aiActive) settings.aiActive = v.id;
    saveSettings(); return { ok: true, id: v.id, state: connView() };
  });
  ipcMain.handle('aiDelete', async (_e, id: string) => {
    settings.aiConns = settings.aiConns.filter((x) => x.id !== id);
    dropKey(id);
    if (settings.aiActive === id) settings.aiActive = settings.aiConns[0]?.id ?? '';
    if (!settings.aiActive && settings.aiMode === 'custom') {
      settings.aiMode = 'player2';
      syncP2Ping();
      ctx.p2.login().catch(() => {});
    }
    saveSettings();
    const applied = ctx.ai.refresh();
    return { state: connView(), applied };
  });
  ipcMain.handle('aiUse', async (_e, mode: string, id: string) => {
    if (mode === 'custom') {
      if (!settings.aiConns.some((x) => x.id === id)) return { ok: false, error: L('먼저 연결을 저장하세요.', 'Save the connection first.'), state: connView() };
      if (!activeKeyReady(id)) return { ok: false, error: L('이 연결의 API 키가 없습니다.', 'This connection has no API key.'), state: connView() };
      settings.aiMode = 'custom';
      settings.aiActive = id;
      syncP2Ping();
    } else {
      settings.aiMode = 'player2';
      syncP2Ping();
      ctx.p2
        .login()
        .then(() => ctx.toUi('status', L('Player2 로그인 완료', 'Player2 login complete')))
        .catch((e) => ctx.toUi('status', L('Player2 로그인 실패: ', 'Player2 login failed: ') + redactKey(e.message)));
    }
    saveSettings(); const applied = ctx.ai.refresh(); return { ok: true, applied, state: connView() };
  });
  ipcMain.handle('aiModels', async (_e, c: any, typed: unknown) => {
    const provider = (c && c.provider in PRESETS ? c.provider : 'custom') as Provider, baseUrl = normalizeBase(c?.baseUrl || PRESETS[provider].baseUrl);
    if (!validBase(baseUrl)) return { ok: false, error: L('API 주소가 올바르지 않습니다.', 'Invalid API address.') };
    const key = keyFor(c, typed);
    try { return { ok: true, models: await listModels({ id: '', name: '', provider, baseUrl, model: '', saveKey: false }, key) }; } catch (e) { return { ok: false, error: redactKey((e as Error).message, key) }; }
  });
  ipcMain.handle('aiTest', async (_e, c: any, typed: unknown) => {
    const v = sanitizeConn(c); if (typeof v === 'string') return { ok: false, ms: 0, message: v };
    return testConn(v, keyFor(c, typed));
  });
  ipcMain.handle('aiP2Check', async () => { try { await ctx.p2.health(); await ctx.p2.login(); return { ok: true, message: L('Player2 앱 연결 완료', 'Connected to the Player2 app') }; } catch (e) { return { ok: false, message: redactKey((e as Error).message) }; } });
}

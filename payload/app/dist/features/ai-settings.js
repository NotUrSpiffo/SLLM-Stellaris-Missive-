"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncP2Ping = syncP2Ping;
exports.registerAiSettings = registerAiSettings;
// A-00b 4번: AI 연결 설정(Player2 / 개인 API) 화면의 IPC 7개(aiGet·aiSave·aiDelete·aiUse·aiModels·aiTest·aiP2Check).
// 2026-10-15 main.ts whenReady 안에서 옮김(동작 변경 없음). 키 저장은 src/app/settings.ts(getKey·putKey·dropKey).
const electron_1 = require("electron");
const url_1 = require("url");
const path = __importStar(require("path"));
const model_rotation_host_1 = require("../model-rotation-host");
const aiclient_1 = require("../aiclient");
const settings_1 = require("../app/settings");
const ctx_1 = require("../app/ctx");
const settings_ui_1 = require("./settings-ui");
// ---- AI 연결 설정 (Player2 / 개인 API)
/** Player2 상태 확인은 Player2를 쓸 때만 돈다. 연결을 바꿀 때마다 시작·중지를 맞춘다. */
function syncP2Ping() {
    if (settings_1.settings.aiMode === 'custom') {
        ctx_1.ctx.p2.stop();
        ctx_1.ctx.toUi('status', (0, settings_ui_1.pick)('개인 API 연결을 사용 중입니다(Player2 연결 안 함)', 'Using a personal API connection (Player2 not connected)'));
    }
    else
        ctx_1.ctx.syncPlayer2Activity();
}
const connView = () => ({ mode: settings_1.settings.aiMode, active: settings_1.settings.aiActive, encrypt: electron_1.safeStorage.isEncryptionAvailable(), presets: Object.fromEntries(Object.entries(aiclient_1.PRESETS).map(([k, v]) => [k, v])), conns: settings_1.settings.aiConns.map((c) => ({ ...c, hasKey: !!(0, settings_1.getKey)(c.id) })) });
const sanitizeConn = (c) => {
    const provider = (c && c.provider in aiclient_1.PRESETS ? c.provider : 'custom');
    const baseUrl = (0, aiclient_1.normalizeBase)(c?.baseUrl || aiclient_1.PRESETS[provider].baseUrl);
    if (!(0, aiclient_1.validBase)(baseUrl))
        return (0, settings_ui_1.pick)('API 주소가 올바르지 않습니다(https:// 로 시작해야 합니다. 내 컴퓨터의 서버는 http://localhost 만 허용).', 'Invalid API address (it must start with https://; for a server on this PC only http://localhost is allowed).');
    const model = String(c?.model || '').trim();
    if (!model)
        return (0, settings_ui_1.pick)('모델을 선택하거나 직접 입력하세요.', 'Choose a model or type one.');
    return { id: String(c?.id || '') || 'c' + Date.now().toString(36), name: String(c?.name || '').trim().slice(0, 40) || aiclient_1.PRESETS[provider].label, provider, baseUrl, model: model.slice(0, 120), saveKey: c?.saveKey === true };
};
/** 저장된 키는 저장 당시의 제공자·주소로만 보낸다. 주소나 제공자를 바꿨으면 키를 다시 입력해야 한다. */
const storedKeyOk = (c) => {
    const old = settings_1.settings.aiConns.find((x) => x.id === String(c?.id || ''));
    if (!old)
        return false;
    const provider = c && c.provider in aiclient_1.PRESETS ? c.provider : 'custom';
    return old.provider === provider && (0, aiclient_1.normalizeBase)(old.baseUrl) === (0, aiclient_1.normalizeBase)(c?.baseUrl || aiclient_1.PRESETS[provider].baseUrl);
};
const keyFor = (c, typed) => (typeof typed === 'string' && typed.trim() ? typed.trim() : storedKeyOk(c) ? (0, settings_1.getKey)(String(c?.id || '')) : null);
const activeKeyReady = (id) => { const c = settings_1.settings.aiConns.find((x) => x.id === id); return !!c && (!aiclient_1.PRESETS[c.provider].needsKey || !!(0, settings_1.getKey)(id)); };
function registerAiSettings() {
    // Tell the player only when the answering Gemini model changes (fallback used, or back on the primary). No prompts or keys involved.
    (0, model_rotation_host_1.onRotationUse)((_id, use, previous) => {
        if (previous ? previous.model === use.model : !use.switched)
            return;
        const model = use.model, primary = use.primary;
        ctx_1.ctx.toUi('status', use.switched ? (0, settings_ui_1.pick)(`Gemini 모델 한도 때문에 ${model} 모델로 전환해 답했습니다(주 모델 ${primary}).`, `Answered with ${model} after a Gemini model quota (primary ${primary}).`) : (0, settings_ui_1.pick)(`주 모델 ${model}(으)로 다시 답하고 있습니다.`, `Answering with the primary model ${model} again.`));
    });
    const rotationConn = (e, id) => {
        const frame = e.senderFrame;
        if (!frame || frame !== e.sender.mainFrame || path.resolve((0, url_1.fileURLToPath)(frame.url)) !== path.resolve(__dirname, '../../ui/index.html'))
            throw new Error('Unauthorized settings window');
        const c = settings_1.settings.aiConns.find(x => x.id === id);
        if (!c || !(0, model_rotation_host_1.rotationEligible)(c))
            throw new Error((0, settings_ui_1.pick)('공식 Gemini 연결을 먼저 저장하세요.', 'Save an official Gemini connection first.'));
        return c;
    };
    electron_1.ipcMain.handle('aiRotationGet', async (e, id) => {
        const c = rotationConn(e, id);
        return { ...await (0, model_rotation_host_1.modelRotation)().get(c.id), status: await (0, model_rotation_host_1.modelRotation)().status(), usage: await (0, model_rotation_host_1.modelRotation)().usage(c.id) };
    });
    electron_1.ipcMain.handle('aiRotationSave', async (e, id, revision, config) => {
        const c = rotationConn(e, id);
        try {
            return await (0, model_rotation_host_1.modelRotation)().save(c.id, revision, config, c.model);
        }
        catch (error) {
            throw (0, model_rotation_host_1.rotationError)(error);
        }
    });
    electron_1.ipcMain.handle('aiGet', async () => connView());
    electron_1.ipcMain.handle('aiSave', async (_e, c, keyIn) => {
        const v = sanitizeConn(c);
        if (typeof v === 'string')
            return { ok: false, error: v };
        const typed = typeof keyIn === 'string' ? keyIn.trim() : '';
        if (!typed && settings_1.settings.aiConns.some((x) => x.id === v.id) && !storedKeyOk(c) && aiclient_1.PRESETS[v.provider].needsKey)
            return { ok: false, error: (0, settings_ui_1.pick)('제공자나 API 주소를 바꿨습니다. 저장된 키는 다른 서버로 보내지 않으므로 API 키를 다시 입력하세요.', 'You changed the provider or API address. A saved key is never sent to a different server, so enter the API key again.') };
        const key = typed || (storedKeyOk(c) ? (0, settings_1.getKey)(v.id) : null) || '';
        if (!typed && !storedKeyOk(c) && settings_1.settings.aiConns.some((x) => x.id === v.id))
            (0, settings_1.dropKey)(v.id); // 키가 필요 없는 제공자로 바뀐 경우 옛 키를 지운다
        if (v.saveKey && key && !electron_1.safeStorage.isEncryptionAvailable())
            return { ok: false, error: (0, settings_ui_1.pick)('이 컴퓨터는 암호화 저장을 지원하지 않습니다. "이 컴퓨터에 API 키 저장"을 끄세요(실행 중에만 기억합니다).', 'This PC does not support encrypted storage. Turn off "Save API key on this PC" (it will be remembered only while running).') };
        if (key && !(0, settings_1.putKey)(v.id, key, v.saveKey))
            return { ok: false, error: (0, settings_ui_1.pick)('키를 저장하지 못했습니다.', 'Could not save the key.') + (settings_1.lastKeyError ? ' ' + settings_1.lastKeyError : '') }; // F-33 A: 이유를 같이 보여 줌
        const i = settings_1.settings.aiConns.findIndex((x) => x.id === v.id);
        if (i >= 0)
            settings_1.settings.aiConns[i] = v;
        else
            settings_1.settings.aiConns.push(v);
        if (!settings_1.settings.aiActive)
            settings_1.settings.aiActive = v.id;
        (0, settings_1.saveSettings)();
        return { ok: true, id: v.id, state: connView() };
    });
    electron_1.ipcMain.handle('aiDelete', async (_e, id) => {
        settings_1.settings.aiConns = settings_1.settings.aiConns.filter((x) => x.id !== id);
        (0, settings_1.dropKey)(id);
        if (settings_1.settings.aiActive === id)
            settings_1.settings.aiActive = settings_1.settings.aiConns[0]?.id ?? '';
        if (!settings_1.settings.aiActive && settings_1.settings.aiMode === 'custom') {
            settings_1.settings.aiMode = 'player2';
            syncP2Ping();
            ctx_1.ctx.p2.login().catch(() => { });
        }
        (0, settings_1.saveSettings)();
        const applied = ctx_1.ctx.ai.refresh();
        return { state: connView(), applied };
    });
    electron_1.ipcMain.handle('aiUse', async (_e, mode, id) => {
        if (mode === 'custom') {
            if (!settings_1.settings.aiConns.some((x) => x.id === id))
                return { ok: false, error: (0, settings_ui_1.pick)('먼저 연결을 저장하세요.', 'Save the connection first.'), state: connView() };
            if (!activeKeyReady(id))
                return { ok: false, error: (0, settings_ui_1.pick)('이 연결의 API 키가 없습니다.', 'This connection has no API key.'), state: connView() };
            settings_1.settings.aiMode = 'custom';
            settings_1.settings.aiActive = id;
            syncP2Ping();
        }
        else {
            settings_1.settings.aiMode = 'player2';
            syncP2Ping();
            ctx_1.ctx.p2
                .login()
                .then(() => ctx_1.ctx.toUi('status', (0, settings_ui_1.pick)('Player2 로그인 완료', 'Player2 login complete')))
                .catch((e) => ctx_1.ctx.toUi('status', (0, settings_ui_1.pick)('Player2 로그인 실패: ', 'Player2 login failed: ') + (0, aiclient_1.redactKey)(e.message)));
        }
        (0, settings_1.saveSettings)();
        const applied = ctx_1.ctx.ai.refresh();
        return { ok: true, applied, state: connView() };
    });
    electron_1.ipcMain.handle('aiModels', async (_e, c, typed) => {
        const provider = (c && c.provider in aiclient_1.PRESETS ? c.provider : 'custom'), baseUrl = (0, aiclient_1.normalizeBase)(c?.baseUrl || aiclient_1.PRESETS[provider].baseUrl);
        if (!(0, aiclient_1.validBase)(baseUrl))
            return { ok: false, error: (0, settings_ui_1.pick)('API 주소가 올바르지 않습니다.', 'Invalid API address.') };
        const key = keyFor(c, typed);
        try {
            return { ok: true, models: await (0, aiclient_1.listModels)({ id: '', name: '', provider, baseUrl, model: '', saveKey: false }, key) };
        }
        catch (e) {
            return { ok: false, error: (0, aiclient_1.redactKey)(e.message, key) };
        }
    });
    electron_1.ipcMain.handle('aiTest', async (_e, c, typed) => {
        const v = sanitizeConn(c);
        if (typeof v === 'string')
            return { ok: false, ms: 0, message: v };
        return (0, aiclient_1.testConn)(v, keyFor(c, typed));
    });
    electron_1.ipcMain.handle('aiP2Check', async () => { try {
        await ctx_1.ctx.p2.health();
        await ctx_1.ctx.p2.login();
        return { ok: true, message: (0, settings_ui_1.pick)('Player2 앱 연결 완료', 'Connected to the Player2 app') };
    }
    catch (e) {
        return { ok: false, message: (0, aiclient_1.redactKey)(e.message) };
    } });
}
//# sourceMappingURL=ai-settings.js.map
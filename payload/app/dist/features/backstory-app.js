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
exports.backstories = void 0;
exports.registerBackstory = registerBackstory;
// 배경 이야기 입력(2026-10-18): 외교 단말기 대화창의 「제국 전기」 단추, 집무실 연락처의 「인물 전기」 단추.
// 저장 형식·우선순위는 ../backstory.ts. 제국 글은 withLore 가, 인물 글은 persona/letters/gov 프롬프트가 쓴다.
const electron_1 = require("electron");
const path = __importStar(require("path"));
const backstory_1 = require("../backstory");
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const persona_app_1 = require("./persona-app");
const gov_1 = require("./gov");
exports.backstories = new backstory_1.BackstoryStore(() => path.join(electron_1.app.getPath('userData'), 'sllm_backstory.json'), (op, error) => (0, diagnostics_1.logDiagnostic)(op === 'read' ? 'warn' : 'error', op === 'read' ? 'storage.read_failed' : 'storage.write_failed', { store: 'backstory', error }));
/** autoLore: 사용자 글을 뺀 게임·모드·세이브 전기(main.ts withLore 와 같은 순서). */
function registerBackstory(autoLore) {
    (0, gov_1.setGovBio)(persona_app_1.governorBio);
    electron_1.ipcMain.handle('backstoryEmpire', async (_e, a) => {
        const name = String(a?.name ?? '').trim();
        if (!name)
            return null;
        const idx = Number(a?.idx);
        let auto = '';
        try {
            auto = autoLore(name, Number.isFinite(idx) ? idx : undefined) || '';
        }
        catch { /* 전기 없음 */ }
        return { name, custom: exports.backstories.empire(name), auto, max: backstory_1.BACKSTORY_MAX };
    });
    electron_1.ipcMain.handle('backstoryEmpireSet', async (_e, a) => {
        const name = String(a?.name ?? '').trim();
        if (!name)
            return { ok: false, error: (0, settings_ui_1.pick)('제국 이름이 없습니다.', 'No empire name.') };
        if (!exports.backstories.setEmpire(name, a?.text))
            return { ok: false, error: (0, settings_ui_1.pick)('저장하지 못했습니다.', 'Could not save.') };
        try {
            const t = ctx_1.ctx.talk;
            if (t && (t.name === name || t.player === name))
                ctx_1.ctx.talk = ctx_1.ctx.withLore(ctx_1.ctx.talk);
        }
        catch { /* 다음 대화부터 반영 */ }
        return { ok: true, custom: exports.backstories.empire(name) };
    });
    electron_1.ipcMain.handle('backstoryPerson', async (_e, key) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? '');
        if (!sid || !k)
            return null;
        const p = (0, persona_app_1.personOf)(k);
        if (!p)
            return null;
        return { name: p.name, custom: (0, persona_app_1.personBio)(sid, k), max: backstory_1.BACKSTORY_MAX };
    });
    electron_1.ipcMain.handle('backstoryPersonSet', async (_e, key, text) => {
        const sid = ctx_1.ctx.curSaveId, k = String(key ?? '');
        if (!sid || !k || !(0, persona_app_1.personOf)(k))
            return { ok: false, error: (0, settings_ui_1.pick)('연락처에서 이 인물을 찾지 못했습니다.', 'This person is not in your contacts.') };
        (0, persona_app_1.setPersonBio)(sid, k, (0, backstory_1.cleanBackstory)(text));
        return { ok: true, custom: (0, persona_app_1.personBio)(sid, k) };
    });
}
//# sourceMappingURL=backstory-app.js.map
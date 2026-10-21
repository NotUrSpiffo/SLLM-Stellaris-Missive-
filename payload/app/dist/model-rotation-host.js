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
exports.rotationEligible = rotationEligible;
exports.onRotationUse = onRotationUse;
exports.modelRotation = modelRotation;
exports.rotationError = rotationError;
const electron_1 = require("electron");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const rotation_service_1 = require("./rotation-service");
const model_rotation_1 = require("./model-rotation");
const diagnostics_1 = require("./diagnostics");
const i18n_pick_1 = require("./i18n-pick");
function rotationEligible(c) {
    return c.provider === 'gemini' && c.baseUrl.replace(/\/+$/, '') === 'https://generativelanguage.googleapis.com/v1beta/openai';
}
let service;
const useListeners = [];
/** Notified after each answered rotation request (display only). */
function onRotationUse(fn) { useListeners.push(fn); }
function modelRotation() {
    if (!service) {
        const file = path.join(electron_1.app.getPath('userData'), 'model-rotation-state.json');
        service = new rotation_service_1.RotationService({
            async read() { try {
                return JSON.parse(await fs.readFile(file, 'utf8'));
            }
            catch (e) {
                if (e.code === 'ENOENT')
                    return null;
                throw e;
            } },
            async write(value) {
                const temp = file + '.' + (0, crypto_1.randomUUID)() + '.tmp';
                try {
                    await fs.writeFile(temp, JSON.stringify(value), { flag: 'wx' });
                    await fs.rename(temp, file);
                }
                finally {
                    await fs.unlink(temp).catch(() => { });
                }
            }
        }, code => (0, diagnostics_1.logDiagnostic)('warn', 'ai.rotation', { code }));
        service.onUse = (id, use, previous) => { for (const fn of useListeners) {
            try {
                fn(id, use, previous);
            }
            catch { /* display only */ }
        } };
    }
    return service;
}
function rotationError(e) {
    if (!(e instanceof model_rotation_1.RotationStop))
        return e instanceof Error ? e : new Error(String(e));
    const messages = {
        INVALID_CONFIG: (0, i18n_pick_1.L)('모델 전환 설정을 확인해 주세요. 현재 모델이 후보 목록에 있어야 합니다.', 'Check fallback settings. The current model must be in the candidate list.'),
        QUEUE_FULL: (0, i18n_pick_1.L)('AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.', 'Too many AI requests. Try again shortly.'),
        WAIT_REQUIRED: (0, i18n_pick_1.L)('Gemini 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 'The Gemini quota was reached. Please try again later.'),
        DEADLINE: (0, i18n_pick_1.L)('AI 요청 대기 시간이 초과되었습니다.', 'The AI request deadline was exceeded.'),
        CANCELLED: (0, i18n_pick_1.L)('AI 요청이 취소되었습니다.', 'The AI request was cancelled.')
    };
    return new Error(messages[e.code]);
}
//# sourceMappingURL=model-rotation-host.js.map
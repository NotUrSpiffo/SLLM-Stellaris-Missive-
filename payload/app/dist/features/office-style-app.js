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
exports.registerOfficeStyle = registerOfficeStyle;
// 집무실 종류 고르기(앱 쪽, 2026-10-19). 순수 로직은 src/office-style.ts, 화면은 ui/office-style.js.
// 저장: sllm_office_style.json { saves: { [세이브]: 'auto' | 종류 } }.
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const office_style_1 = require("../office-style");
const L = settings_ui_1.pick;
let data = null;
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_office_style.json');
function all() {
    if (data)
        return data;
    try {
        const j = JSON.parse(fs.readFileSync(file(), 'utf8'));
        data = { saves: j && typeof j.saves === 'object' ? j.saves : {} };
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'office_style', error: e });
        data = { saves: {} };
    }
    return data;
}
function save() { try {
    fs.writeFileSync(file(), JSON.stringify(all()), 'utf8');
}
catch (e) {
    (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'office_style', error: e });
} }
function view() {
    const sid = ctx_1.ctx.curSaveId;
    let ethics = null;
    try {
        ethics = ctx_1.ctx.playerIdx >= 0 ? ctx_1.ctx.flagProv.ethicsFor(ctx_1.ctx.playerIdx) : null;
    }
    catch {
        ethics = null;
    }
    const auto = (0, office_style_1.autoOfficeStyle)(ethics), choice = (sid && all().saves[sid]) || 'auto';
    const label = (k) => { const s = office_style_1.OFFICE_STYLES.find(([x]) => x === k); return s ? L(s[1], s[2]) : k; };
    return { emblemUrl: sid ? ctx_1.ctx.flagProv.emblemFor(ctx_1.ctx.playerIdx) : null, choice, auto, autoKnown: !!ethics, applied: choice === 'auto' ? auto : choice, autoLabel: label(auto), options: office_style_1.OFFICE_STYLES.map(([k]) => ({ key: k, label: label(k) })) };
}
function registerOfficeStyle() {
    electron_1.ipcMain.handle('officeStyle', async () => view());
    electron_1.ipcMain.handle('officeStyleSet', async (_e, key) => {
        const sid = ctx_1.ctx.curSaveId;
        if (!sid)
            return { ok: false, error: L('세이브를 불러온 뒤 바꿀 수 있습니다.', 'Load a save first.'), state: view() };
        if (key !== 'auto' && !(0, office_style_1.isOfficeStyle)(key))
            return { ok: false, error: L('알 수 없는 집무실입니다.', 'Unknown office style.'), state: view() };
        if (key === 'auto')
            delete all().saves[sid];
        else
            all().saves[sid] = key;
        save();
        return { ok: true, state: view() };
    });
}
//# sourceMappingURL=office-style-app.js.map
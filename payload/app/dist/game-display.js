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
exports.DISPLAY_HINT_KO = void 0;
exports.parseDisplayMode = parseDisplayMode;
exports.toBorderless = toBorderless;
exports.pdxToBorderless = pdxToBorderless;
exports.readDisplayMode = readDisplayMode;
exports.fixDisplayMode = fixDisplayMode;
// 게임 화면 모드(2026-10-18): 스텔라리스가 「독점 전체화면(fullScreen=yes)」이면 윈도우 규칙상 다른 창(우리 앱)이 앞에 서는 순간
// 게임 화면이 내려간다. OP.GG 같은 겹침 앱도 이 모드에서는 똑같고, 그들이 게임 안에 그리는 방식(DirectX 끼워 넣기)은 우리가 쓰지 않는다.
// 대신 「테두리 없는 전체화면(borderless)」이면 전체화면과 똑같아 보이면서 앱 창이 위에 떠도 게임이 내려가지 않는다.
// 여기서는 게임 설정 파일(settings.txt·pdx_settings.txt)을 읽어 모드를 알아내고, 사용자가 원하면 테두리 없음으로 고쳐 준다(게임이 꺼져 있을 때만).
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** settings.txt 의 graphics 블록에서 모드를 읽는다. 없으면 null. */
function parseDisplayMode(settingsTxt) {
    const full = /^\s*fullScreen\s*=\s*(yes|no)/m.exec(settingsTxt), border = /^\s*borderless\s*=\s*(yes|no)/m.exec(settingsTxt);
    if (!full && !border)
        return null;
    if (full?.[1] === 'yes' && border?.[1] !== 'yes')
        return 'exclusive';
    return border?.[1] === 'yes' ? 'borderless' : 'windowed';
}
/** settings.txt 를 테두리 없는 전체화면으로. 바뀐 것이 없으면 null. */
function toBorderless(settingsTxt) {
    const out = settingsTxt.replace(/^(\s*fullScreen\s*=\s*)yes/m, '$1no').replace(/^(\s*borderless\s*=\s*)no/m, '$1yes');
    return out === settingsTxt ? null : out;
}
/** pdx_settings.txt(런처가 보는 쪽)의 display_mode 를 borderless_fullscreen 으로. 바뀐 것이 없으면 null. */
function pdxToBorderless(pdxTxt) {
    const out = pdxTxt.replace(/("display_mode"\s*=\s*\{\s*value=)"(fullscreen|windowed)"/, '$1"borderless_fullscreen"');
    return out === pdxTxt ? null : out;
}
/** 사용자 폴더의 설정 파일에서 현재 모드. 파일이 없으면 null. */
function readDisplayMode(userDir) {
    try {
        return parseDisplayMode(fs.readFileSync(path.join(userDir, 'settings.txt'), 'utf8'));
    }
    catch {
        return null;
    }
}
/** 두 설정 파일을 테두리 없는 전체화면으로 고친다. 고친 파일 수를 돌려준다(0 = 이미 그 모드). */
function fixDisplayMode(userDir) {
    let n = 0;
    for (const [file, fn] of [['settings.txt', toBorderless], ['pdx_settings.txt', pdxToBorderless]]) {
        const p = path.join(userDir, file);
        let txt;
        try {
            txt = fs.readFileSync(p, 'utf8');
        }
        catch {
            continue;
        }
        const out = fn(txt);
        if (!out)
            continue;
        fs.writeFileSync(p + '.sllm-bak', txt);
        fs.writeFileSync(p, out);
        n++; // 원본은 .sllm-bak 로 한 부 남긴다
    }
    return n;
}
exports.DISPLAY_HINT_KO = '스텔라리스가 「전체화면(독점)」 모드입니다. 이 모드에서는 앱 창이 뜨는 순간 게임 화면이 내려갑니다(윈도우 규칙이라 다른 겹침 앱도 같습니다). 게임을 끈 뒤 아래 [테두리 없는 전체화면으로 바꾸기]를 누르거나, 게임 설정 → 그래픽 → 디스플레이 모드를 「테두리 없음」으로 바꿔 주세요. 보기에는 전체화면과 똑같고 앱 창이 위에 떠도 게임이 내려가지 않습니다.';
//# sourceMappingURL=game-display.js.map
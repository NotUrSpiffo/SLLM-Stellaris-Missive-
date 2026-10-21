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
exports.readJsonObject = readJsonObject;
exports.writeJsonAtomic = writeJsonAtomic;
exports.cleanKeyMap = cleanKeyMap;
// 설정·API 키 파일을 안전하게 읽고 쓴다(F-33 A). Electron 없이 시험할 수 있게 settings.ts 에서 떼어 둠.
// - 파일이 없으면(ENOENT) 처음 실행으로 보고 빈 값.
// - 내용이 깨졌으면 원본을 `<파일>.bad` 로 남기고 빈 값으로 이어 간다(깨진 내용은 어차피 쓸 수 없다).
// - 그 밖의 읽기 오류(잠김·권한 등 일시적일 수 있는 것)는 실패로 돌려준다. 이때는 덮어쓰면 안 된다(멀쩡한 파일을 잃을 수 있음).
const fs = __importStar(require("fs"));
const i18n_pick_1 = require("./i18n-pick");
/** JSON 객체 파일 읽기. value=null 은 "파일 없음". recovered 는 깨진 파일을 옮겨 둔 경로. */
function readJsonObject(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        const code = e.code;
        if (code === 'ENOENT')
            return { ok: true, value: null };
        return { ok: false, error: `${code || 'read'}: ${e.message}` };
    }
    try {
        const j = JSON.parse(text.replace(/^﻿/, ''));
        if (j && typeof j === 'object' && !Array.isArray(j))
            return { ok: true, value: j };
    }
    catch { /* 아래에서 깨진 파일로 처리 */ }
    const bad = file + '.bad';
    try {
        fs.copyFileSync(file, bad);
    }
    catch (e) {
        return { ok: false, error: (0, i18n_pick_1.L)('깨진 파일을 옮겨 두지 못함: ', 'Could not move the broken file aside: ') + e.message };
    }
    return { ok: true, value: null, recovered: bad };
}
/** 임시 파일에 쓴 뒤 바꿔 끼운다(쓰다 끊겨도 원래 파일이 반쯤 깨지지 않게). 실패하면 오류 문장, 성공하면 null. */
function writeJsonAtomic(file, value, pretty = false) {
    const tmp = file + '.tmp';
    try {
        fs.writeFileSync(tmp, JSON.stringify(value, null, pretty ? 2 : undefined), 'utf8');
        fs.renameSync(tmp, file);
        return null;
    }
    catch (e) {
        try {
            fs.unlinkSync(tmp);
        }
        catch { /* 임시 파일이 없으면 그만 */ }
        return e.message;
    }
}
/** 키 파일: 문자열 값만 남긴다. */
function cleanKeyMap(v) {
    const out = {};
    if (v)
        for (const [k, s] of Object.entries(v))
            if (typeof s === 'string' && s)
                out[k] = s;
    return out;
}
//# sourceMappingURL=key-file.js.map
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
exports.gameName = gameName;
// 게임 이름 표로 인물 이름 짓기 — 앱 쪽(2026-10-20). 규칙: src/namegen.ts.
// 게임 폴더 + 켠 모드(ModResources)의 common/name_lists 와 이름 지역화 파일을 한 번 읽어 두고(모드 목록이 바뀌면 다시), 세이브의 종족 비율로 이름을 뽑는다.
// 화면 언어가 한국어면 l_korean 이름이 있으면 그것, 없으면 영어 이름. 재료가 없으면 null — 부르는 쪽이 대신 이름을 쓴다(AI 에게 짓게 하지 않는다).
const path = __importStar(require("path"));
const ctx_1 = require("../app/ctx");
const diagnostics_1 = require("../diagnostics");
const settings_ui_1 = require("./settings-ui");
const namegen_1 = require("../namegen");
let cache = null;
function load() {
    const res = ctx_1.ctx.modCompatibility.resources;
    res.refresh();
    if (cache && cache.rev === res.revision)
        return cache;
    const lists = new Map(), en = {}, ko = {};
    try {
        for (const f of res.files('common/name_lists', '.txt')) {
            try {
                for (const [k, v] of (0, namegen_1.parseNameLists)(res.read(f).toString('utf8')))
                    lists.set(k, v);
            }
            catch { /* 깨진 표는 건너뜀 */ }
        }
        // 이름 지역화: 파일 이름에 name 이 들어간 것만(게임: localisation/<언어>/name_lists/name_list_*.yml). 한국어·영어만 본다.
        for (const f of res.files('localisation', '.yml')) {
            const base = path.basename(f.relative).toLowerCase();
            if (!base.includes('name') || !/l_(english|korean)\.yml$/.test(base))
                continue;
            try {
                const { lang, map } = (0, namegen_1.parseLocNames)(res.read(f).toString('utf8'));
                Object.assign(lang === 'korean' ? ko : en, map);
            }
            catch { /* 건너뜀 */ }
        }
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'namegen.load_failed', { error: e });
    }
    cache = { rev: res.revision, lists, loc: { en, ko } };
    (0, diagnostics_1.logDiagnostic)('info', 'namegen.loaded', { lists: lists.size, en: Object.keys(en).length, ko: Object.keys(ko).length });
    return cache;
}
/** 우리 제국(기본) 또는 idx 제국 사람의 이름. 종족은 인구 비율대로 뽑는다. 못 지으면 null. */
function gameName(g, idx = ctx_1.ctx.playerIdx, rand = Math.random) {
    try {
        const c = load();
        if (!c.lists.size)
            return null;
        const info = ctx_1.ctx.flagProv.portraitInfoFor(idx);
        const mix = info?.pop?.length ? info.pop : info?.mix?.length ? info.mix : info?.founder ? [{ share: 1, cls: info.founder.cls, list: info.founder.list }] : [];
        const loc = (0, settings_ui_1.selectedLanguage)() === 'ko' ? { ...c.loc.en, ...c.loc.ko } : c.loc.en; // i18n-data: 게임 이름 지역화(한국어판 이름이 있을 때만 한국어, 그 밖의 언어는 영어 이름)
        // 세이브 정보가 없으면(새 게임 직후 등) 사람 계열 표로라도 짓는다
        return (0, namegen_1.empireName)(mix.length ? mix : [{ share: 1, cls: 'HUM' }], c.lists, loc, g, rand)?.name ?? null;
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'namegen.failed', { error: e });
        return null;
    }
}
//# sourceMappingURL=namegen-app.js.map
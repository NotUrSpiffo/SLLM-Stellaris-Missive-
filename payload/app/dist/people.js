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
exports.PeopleStore = exports.PeopleCollector = void 0;
exports.applyRoster = applyRoster;
exports.contactRole = contactRole;
// 집무실 연락처 — 내 지도자 명단(2026-10-18). 순수 로직: 매달 모드가 보내는 LEADER·LEADERAT·LEADER_END 묶음을 모아
// 세이브별 인물 장부에 반영한다. 지도자 번호(lid)는 함대 사령부와 같은 번호라 같은 사람으로 이어진다.
// 명단에서 사라진 인물은 지우지 않고 gone(날짜)으로 남긴다(뒤에 추모관·작별 편지에서 쓴다).
const fs = __importStar(require("fs"));
const diagnostics_1 = require("./diagnostics");
const CLS = ['commander', 'official', 'scientist'];
/** 한 달 묶음을 모은다. 묶음 끝(LEADER_END)에서 명단과 날짜를 돌려준다. */
class PeopleCollector {
    cur = new Map();
    feed(kind, kv) {
        if (kind === 'LEADER') {
            const lid = Number(kv.lid), name = String(kv.name ?? '').trim();
            if (!Number.isInteger(lid) || lid <= 0 || !name)
                return null;
            const cls = (CLS.includes(kv.cls) ? kv.cls : 'official');
            const lv = Math.max(0, Math.min(20, Math.round(Number(kv.lv) || 0)));
            this.cur.set(lid, { lid, name: name.slice(0, 60), cls, lv, ruler: kv.ruler === '1', council: kv.council === '1', ...(kv.tr === '1' ? { traits: [] } : {}), ...(kv.asg === '1' ? { asg: true } : {}), ...(Number(kv.cpos) > 0 && Number.isSafeInteger(Number(kv.cpos)) ? { cpos: Number(kv.cpos) } : {}) });
            return null;
        }
        if (kind === 'LTRAIT') { // 특성 키(바닐라 지도자 특성). 같은 묶음의 LEADER 뒤에 온다
            const p = this.cur.get(Number(kv.lid)), t = String(kv.t ?? '').trim();
            if (p && p.traits && /^[A-Za-z0-9_]{1,80}$/.test(t) && !p.traits.includes(t) && p.traits.length < 40)
                p.traits.push(t);
            return null;
        }
        if (kind === 'LEADERAT') {
            const p = this.cur.get(Number(kv.lid)), f = String(kv.fleet ?? '').trim();
            if (p && f)
                p.fleet = f.slice(0, 60);
            return null;
        }
        if (kind === 'LEADER_END') {
            const list = [...this.cur.values()];
            this.cur.clear();
            return { list, date: String(kv.date ?? '').trim() };
        }
        return null;
    }
}
exports.PeopleCollector = PeopleCollector;
/** 이번 달 명단을 장부에 반영한다. 새 인물·떠난 인물·이름이 바뀐 인물을 돌려준다. 빈 명단은 반영하지 않는다(읽기 실패로 모두 떠난 것처럼 되지 않게). */
function applyRoster(s, list, date) {
    const out = { added: [], gone: [], renamed: [] };
    if (!list.length)
        return out;
    const seen = new Set();
    for (const l of list) {
        seen.add(l.lid);
        const k = String(l.lid), p = s.persons[k];
        if (!p) {
            s.persons[k] = { ...l, first: date, last: date };
            out.added.push(l.lid);
            continue;
        }
        if (p.name !== l.name) {
            (p.names ??= []).includes(p.name) || p.names.push(p.name);
            if (p.names.length > 5)
                p.names.splice(0, p.names.length - 5);
            out.renamed.push(l.lid);
        }
        const back = !!p.gone;
        const keep = p.traits;
        Object.assign(p, l, { last: date });
        if (!l.fleet)
            delete p.fleet;
        if (!l.cpos)
            delete p.cpos;
        if (!l.asg)
            delete p.asg;
        if (back)
            delete p.gone; // 같은 번호가 다시 보이면 돌아온 것
        if (!l.traits && keep)
            p.traits = keep; // 특성을 읽지 않은 달에는 지난 특성 그대로
    }
    for (const [k, p] of Object.entries(s.persons))
        if (!p.gone && !seen.has(Number(k))) {
            p.gone = date;
            out.gone.push(p.lid);
        }
    return out;
}
class PeopleStore {
    file;
    data = {};
    constructor(file) {
        this.file = file;
        try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (j && typeof j === 'object')
                this.data = j;
        }
        catch (e) {
            if (e.code !== 'ENOENT')
                (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'people', file, error: e });
        }
    }
    get(sid) { const s = (this.data[sid] ??= { persons: {} }); s.persons ??= {}; return s; }
    save() { try {
        fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8');
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'people', file: this.file, error: e });
    } }
}
exports.PeopleStore = PeopleStore;
function contactRole(p, isGovernor, groundOnly) {
    if (p.ruler)
        return 'ruler';
    if (p.cls === 'scientist')
        return 'scientist';
    if (p.cls === 'official')
        return isGovernor ? 'governor' : 'official';
    if (p.fleet)
        return 'admiral';
    return groundOnly ? 'general' : 'commander';
}
//# sourceMappingURL=people.js.map
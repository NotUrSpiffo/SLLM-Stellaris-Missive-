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
exports.InboxStore = void 0;
const diagnostics_1 = require("./diagnostics");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const i18n_pick_1 = require("./i18n-pick");
class InboxStore {
    file;
    data = { next: 1, letters: [] };
    error = null;
    loadError = null;
    constructor(file) {
        this.file = file;
        try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (!j || !Array.isArray(j.letters))
                throw new Error((0, i18n_pick_1.L)('잘못된 편지 저장 형식', 'Invalid letter storage format'));
            this.data.letters = j.letters.filter((l) => l && /^\d{1,9}$/.test(l.sid) && Number.isSafeInteger(l.id) && l.id > 0 && Number.isSafeInteger(l.idx) && l.idx > 0 && typeof l.text === 'string' && typeof l.name === 'string' && typeof l.date === 'string' && typeof l.expires === 'string');
            this.data.next = Math.max(Number(j.next) || 1, 1, ...this.data.letters.map(l => l.id + 1));
        }
        catch (e) {
            if (e.code !== 'ENOENT') {
                this.error = e.message;
                this.loadError = this.error;
                (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'inbox', file, error: e });
            }
        }
    }
    save() {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data), 'utf8');
            fs.renameSync(this.file + '.tmp', this.file);
            this.error = null;
        }
        catch (e) {
            this.error = e.message;
            (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'inbox', file: this.file, error: e });
        }
    }
    list(sid) { return this.data.letters.filter(l => l.sid === sid).map(l => ({ ...l, proposal: l.proposal ? { ...l.proposal } : null })); }
    add(sid, branch, letter) {
        if (!/^\d{1,9}$/.test(sid))
            throw new Error((0, i18n_pick_1.L)('세이브 번호가 없습니다.', 'No save number.'));
        if (letter.sourceId && this.loadError)
            throw new Error(this.loadError);
        if (letter.sourceId) {
            const old = this.data.letters.find(x => x.sid === sid && x.branch === branch && x.sourceId === letter.sourceId);
            if (old) {
                this.save();
                return { ...old };
            }
        }
        const l = { ...letter, sid, branch, id: this.data.next++ };
        this.data.letters.push(l);
        this.save();
        return { ...l };
    }
    markRead(sid, id) { this.change(sid, id, l => { l.read = true; }); }
    handleProposal(sid, id) { this.change(sid, id, l => { l.proposalHandled = true; }); }
    change(sid, id, mutate) {
        const l = this.data.letters.find(l => l.sid === sid && l.id === id);
        if (!l)
            throw new Error((0, i18n_pick_1.L)('이 세이브의 편지가 아닙니다.', 'This letter is not from this save.'));
        mutate(l);
        this.save();
    }
}
exports.InboxStore = InboxStore;
//# sourceMappingURL=inbox-store.js.map
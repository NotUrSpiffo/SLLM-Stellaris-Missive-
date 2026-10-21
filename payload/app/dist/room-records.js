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
exports.RoomRecords = void 0;
/** Campaign-scoped private writing. No game effects or browser storage. */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const room_import_1 = require("./room-import");
class RoomRecords {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    file(sid) { if (!sid || sid.length > 200)
        throw Error('INVALID_SAVE'); return path.join(this.directory, (0, crypto_1.createHash)('sha256').update(sid).digest('hex') + '.json'); }
    read(sid) {
        let d;
        try {
            d = JSON.parse(fs.readFileSync(this.file(sid), 'utf8'));
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return { version: 1, sid, revision: 0, records: [] };
            throw e;
        }
        if (d.version !== 1 || d.sid !== sid || !Number.isSafeInteger(d.revision) || !Array.isArray(d.records) || d.records.length > 2000)
            throw Error('INVALID_STORE');
        return d;
    }
    save(actor, input) {
        if (!actor.rulerId || !actor.rulerName || !actor.date)
            throw Error('UNKNOWN_AUTHOR');
        const q = input, d = this.read(actor.sid);
        const kind = q?.kind;
        if (kind !== 'journal' && kind !== 'book')
            throw Error('INVALID_RECORD');
        if (typeof q.title !== 'string' || !q.title.trim() || q.title.length > 160 || typeof q.text !== 'string' || !q.text.trim() || q.text.length > (kind === 'book' ? 50000 : 20000))
            throw Error('INVALID_RECORD');
        const old = q.id ? d.records.find(x => x.id === q.id && !x.deleted) : undefined;
        if (q.id && (!old || old.revision !== q.revision || old.kind !== kind))
            throw Error('CONFLICT');
        if (!old && (d.records.length >= 2000 || d.records.filter(x => x.kind === 'book' && !x.deleted).length >= 200 && kind === 'book'))
            throw Error('FULL');
        // aiSummary: written by the player for books only (max 1,500 chars). Omitted = keep the stored/imported one; '' = remove it. Plain data, never instructions.
        if (q.aiSummary !== undefined && (typeof q.aiSummary !== 'string' || q.aiSummary.length > 1500))
            throw Error('INVALID_RECORD');
        const summary = kind === 'book' && typeof q.aiSummary === 'string' ? q.aiSummary.trim() : old?.aiSummary;
        const rec = { id: old?.id || (0, crypto_1.randomUUID)(), kind, revision: (old?.revision || 0) + 1, title: q.title.trim(), text: q.text, category: ['lore', 'species', 'history', 'writing'].includes(q.category || '') ? q.category : 'writing', author: old?.author || { ...actor }, updated: { ...actor }, ...(old?.imported ? { imported: old.imported } : {}), ...(summary ? { aiSummary: summary } : {}) };
        if (old)
            d.records[d.records.indexOf(old)] = rec;
        else
            d.records.push(rec);
        this.write(d);
        return rec;
    }
    remove(sid, id, revision) {
        const d = this.read(sid), r = d.records.find(x => x.id === id && !x.deleted);
        if (!r || r.revision !== revision)
            throw Error('CONFLICT');
        r.deleted = true;
        r.revision++;
        this.write(d);
    }
    importCopies(actor, revision, kind, content, fileName) {
        const copies = (0, room_import_1.parseRoomImport)(content, fileName, kind), d = this.read(actor.sid);
        if (d.revision !== revision)
            throw Error('CONFLICT');
        if (d.records.length + copies.length > 2000 || (kind === 'book' && d.records.filter(r => r.kind === 'book' && !r.deleted).length + copies.filter(r => !r.deleted).length > 200))
            throw Error('FULL');
        const added = copies.map(q => ({ id: (0, crypto_1.randomUUID)(), kind, revision: 1, title: q.title, text: q.text, category: q.category, author: q.author, updated: { ...actor }, deleted: q.deleted, aiSummary: q.aiSummary, imported: { fileName, by: { ...actor }, sourceId: q.sourceId, unverified: true } }));
        d.records.push(...added);
        this.write(d);
        return added;
    }
    restore(actor, id, revision) {
        const d = this.read(actor.sid), r = d.records.find(x => x.id === id && x.deleted);
        if (!r || r.revision !== revision)
            throw Error('CONFLICT');
        if (r.kind === 'book' && d.records.filter(x => x.kind === 'book' && !x.deleted).length >= 200)
            throw Error('FULL');
        r.deleted = false;
        r.revision++;
        r.updated = { ...actor };
        this.write(d);
        return r;
    }
    export(sid, kind, includeArchived) {
        if (kind !== 'book' && kind !== 'journal')
            throw Error('INVALID_RECORD');
        const d = this.read(sid);
        return JSON.stringify({ format: 'sllm-room-records', version: 1, campaignId: sid, kind, records: d.records.filter(x => x.kind === kind && (includeArchived || !x.deleted)) }, null, 2);
    }
    write(d) {
        fs.mkdirSync(this.directory, { recursive: true });
        const file = this.file(d.sid), temp = file + '.' + (0, crypto_1.randomUUID)() + '.tmp', lock = file + '.lock';
        let fd;
        try {
            fd = fs.openSync(lock, 'wx');
        }
        catch {
            throw Error('CONFLICT');
        }
        try {
            if (this.read(d.sid).revision !== d.revision)
                throw Error('CONFLICT');
            d.revision++;
            fs.writeFileSync(temp, JSON.stringify(d), 'utf8');
            fs.renameSync(temp, file);
        }
        finally {
            if (fs.existsSync(temp))
                fs.unlinkSync(temp);
            fs.closeSync(fd);
            fs.unlinkSync(lock);
        }
    }
}
exports.RoomRecords = RoomRecords;
//# sourceMappingURL=room-records.js.map
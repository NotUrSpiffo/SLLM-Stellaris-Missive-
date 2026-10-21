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
exports.RoomActivities = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
/** Append-only activity journal: original actor remains attached to every event. */
class RoomActivities {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    file(sid) { if (!sid || sid.length > 200)
        throw Error('INVALID_SAVE'); return path.join(this.directory, (0, crypto_1.createHash)('sha256').update(sid).digest('hex') + '.json'); }
    read(sid) {
        let raw;
        try {
            raw = JSON.parse(fs.readFileSync(this.file(sid), 'utf8'));
        }
        catch (e) {
            if (e.code === 'ENOENT')
                return [];
            throw e;
        }
        if (raw?.version !== 1 || raw.sid !== sid || !Array.isArray(raw.events))
            throw Error('INVALID_ACTIVITY_STORE');
        return raw.events;
    }
    append(event) { const events = this.read(event.actor.sid); if (events.some(x => x.id === event.id))
        return; events.push(event); fs.mkdirSync(this.directory, { recursive: true }); const file = this.file(event.actor.sid), temp = file + '.' + (0, crypto_1.randomUUID)() + '.tmp'; try {
        fs.writeFileSync(temp, JSON.stringify({ version: 1, sid: event.actor.sid, events }));
        fs.renameSync(temp, file);
    }
    finally {
        if (fs.existsSync(temp))
            fs.unlinkSync(temp);
    } }
    relevant(actor, room, subjectId) {
        return this.read(actor.sid).filter(x => x.secretaryId === 'primary' && (subjectId ? x.subjectId === subjectId : x.room === room && x.actor.rulerId === actor.rulerId)).slice(-4).map(x => ({ actor: x.actor, relation: x.actor.rulerId === actor.rulerId ? 'current-ruler' : 'other-ruler', room: x.room, subject: x.subjectTitle, kind: x.kind || 'chat', author: x.author, authorshipUnverified: !!x.authorshipUnverified, summary: (x.kind === 'shared-reading' ? 'The ruler explicitly shared these pages for reading together. Original author: ' + (x.author?.rulerName || 'Unknown') : ('The ruler said: ' + x.question + ' Secretary replied: ' + x.reply)).slice(0, 600) }));
    }
}
exports.RoomActivities = RoomActivities;
//# sourceMappingURL=room-activity.js.map
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
exports.RoomMusic = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const url_1 = require("url");
const extensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.webm'];
class RoomMusic {
    root;
    constructor(root) {
        this.root = root;
    }
    dir(sid) { if (!sid || sid.length > 200)
        throw Error('INVALID_SAVE'); return path.join(this.root, (0, crypto_1.createHash)('sha256').update(sid).digest('hex')); }
    read(sid) { try {
        const v = JSON.parse(fs.readFileSync(path.join(this.dir(sid), 'tracks.json'), 'utf8'));
        if (!Array.isArray(v) || v.length > 20 || v.some(t => !t || !/^[a-f0-9-]{36}$/.test(t.id) || !extensions.includes(t.ext) || typeof t.name !== 'string'))
            throw Error('INVALID_MUSIC_STORE');
        return v;
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return [];
        throw e;
    } }
    write(sid, tracks) { const dir = this.dir(sid); fs.mkdirSync(dir, { recursive: true }); const temp = path.join(dir, (0, crypto_1.randomUUID)() + '.tmp'); try {
        fs.writeFileSync(temp, JSON.stringify(tracks), 'utf8');
        fs.renameSync(temp, path.join(dir, 'tracks.json'));
    }
    finally {
        if (fs.existsSync(temp))
            fs.unlinkSync(temp);
    } }
    prefs(sid) {
        let p;
        try {
            p = JSON.parse(fs.readFileSync(path.join(this.dir(sid), 'settings.json'), 'utf8'));
        }
        catch (e) {
            if (e.code !== 'ENOENT')
                throw e;
        }
        return { selectedId: this.read(sid).some(t => t.id === p?.selectedId) ? p.selectedId : '', loop: p?.loop === true, autoplay: p?.autoplay === true, volume: typeof p?.volume === 'number' && Number.isFinite(p.volume) ? Math.max(0, Math.min(1, p.volume)) : .4 };
    }
    configure(sid, input) {
        const current = this.prefs(sid);
        if (!input || typeof input !== 'object')
            throw Error('INVALID_AUDIO');
        const p = { ...current };
        if (input.selectedId !== undefined) {
            if (input.selectedId !== '' && !this.read(sid).some(t => t.id === input.selectedId))
                throw Error('UNKNOWN_TRACK');
            p.selectedId = input.selectedId;
        }
        for (const k of ['loop', 'autoplay'])
            if (input[k] !== undefined) {
                if (typeof input[k] !== 'boolean')
                    throw Error('INVALID_AUDIO');
                p[k] = input[k];
            }
        if (input.volume !== undefined) {
            if (typeof input.volume !== 'number' || !Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1)
                throw Error('INVALID_AUDIO');
            p.volume = input.volume;
        }
        const dir = this.dir(sid);
        fs.mkdirSync(dir, { recursive: true });
        const temp = path.join(dir, (0, crypto_1.randomUUID)() + '.tmp');
        try {
            fs.writeFileSync(temp, JSON.stringify(p));
            fs.renameSync(temp, path.join(dir, 'settings.json'));
        }
        finally {
            if (fs.existsSync(temp))
                fs.unlinkSync(temp);
        }
        return p;
    }
    list(sid) { return this.read(sid).map(t => ({ ...t, url: (0, url_1.pathToFileURL)(path.join(this.dir(sid), t.id + t.ext)).href })); }
    add(sid, file) {
        const tracks = this.read(sid), ext = path.extname(file).toLowerCase(), stat = fs.statSync(file);
        if (tracks.length >= 20)
            throw Error('MUSIC_FULL');
        if (!extensions.includes(ext) || !stat.isFile() || stat.size > 50 * 1024 * 1024 || !stat.size)
            throw Error('INVALID_AUDIO');
        const t = { id: (0, crypto_1.randomUUID)(), ext, name: path.basename(file).slice(0, 160) }, dir = this.dir(sid);
        fs.mkdirSync(dir, { recursive: true });
        const dest = path.join(dir, t.id + t.ext);
        fs.copyFileSync(file, dest, fs.constants.COPYFILE_EXCL);
        try {
            this.write(sid, [...tracks, t]);
        }
        catch (e) {
            fs.unlinkSync(dest);
            throw e;
        }
        return this.list(sid);
    }
    remove(sid, id) { const tracks = this.read(sid), t = tracks.find(t => t.id === id); if (!t)
        throw Error('UNKNOWN_TRACK'); this.write(sid, tracks.filter(x => x.id !== id)); try {
        fs.unlinkSync(path.join(this.dir(sid), t.id + t.ext));
    }
    catch { } return this.list(sid); }
}
exports.RoomMusic = RoomMusic;
//# sourceMappingURL=room-music.js.map
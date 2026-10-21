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
exports.SupportBundles = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const zlib = __importStar(require("zlib"));
const crypto_1 = require("crypto");
const diagnostics_1 = require("./diagnostics");
const i18n_pick_1 = require("./i18n-pick");
const MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 32 * 1024 * 1024;
function tail(file, cap = MAX_FILE) {
    const fd = fs.openSync(file, 'r');
    try {
        const stat = fs.fstatSync(fd), size = stat.size, start = Math.max(0, size - cap), buf = Buffer.alloc(Math.min(size, cap)), bytes = fs.readSync(fd, buf, 0, buf.length, start);
        let text = buf.subarray(0, bytes).toString('utf8');
        if (start) {
            const newline = text.indexOf('\n');
            text = newline >= 0 ? text.slice(newline + 1) : text.slice(3);
        }
        return { text, size, modifiedAt: stat.mtime.toISOString(), truncated: start > 0 };
    }
    finally {
        fs.closeSync(fd);
    }
}
const crcTable = Array.from({ length: 256 }, (_, i) => { let n = i; for (let b = 0; b < 8; b++)
    n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
function crc32(buf) { let crc = 0xffffffff; for (const b of buf)
    crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
/** Standard ZIP, UTF-8 filenames, deflate; no executable archiver required. */
function zip(entries) {
    const local = [], central = [];
    let offset = 0;
    const now = new Date(), year = Math.max(1980, Math.min(2107, now.getUTCFullYear())), dosDate = ((year - 1980) << 9) | ((now.getUTCMonth() + 1) << 5) | now.getUTCDate(), dosTime = (now.getUTCHours() << 11) | (now.getUTCMinutes() << 5) | (now.getUTCSeconds() >> 1);
    for (const e of entries) {
        const name = Buffer.from(e.name, 'utf8'), body = zlib.deflateRawSync(e.data), crc = crc32(e.data), l = Buffer.alloc(30), c = Buffer.alloc(46);
        l.writeUInt32LE(0x04034b50);
        l.writeUInt16LE(20, 4);
        l.writeUInt16LE(0x800, 6);
        l.writeUInt16LE(8, 8);
        l.writeUInt16LE(33, 12);
        l.writeUInt32LE(crc, 14);
        l.writeUInt32LE(body.length, 18);
        l.writeUInt32LE(e.data.length, 22);
        l.writeUInt16LE(name.length, 26);
        c.writeUInt32LE(0x02014b50);
        c.writeUInt16LE(20, 4);
        c.writeUInt16LE(20, 6);
        c.writeUInt16LE(0x800, 8);
        c.writeUInt16LE(8, 10);
        c.writeUInt16LE(33, 14);
        c.writeUInt32LE(crc, 16);
        c.writeUInt32LE(body.length, 20);
        c.writeUInt32LE(e.data.length, 24);
        c.writeUInt16LE(name.length, 28);
        c.writeUInt32LE(offset, 42);
        l.writeUInt16LE(dosTime, 10);
        l.writeUInt16LE(dosDate, 12);
        c.writeUInt16LE(dosTime, 12);
        c.writeUInt16LE(dosDate, 14);
        local.push(l, name, body);
        central.push(c, name);
        offset += l.length + name.length + body.length;
    }
    const cd = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...local, cd, end]);
}
class SupportBundles {
    userData;
    gameLog;
    snapshot;
    snapshots = new Map();
    constructor(userData, gameLog, snapshot) {
        this.userData = userData;
        this.gameLog = gameLog;
        this.snapshot = snapshot;
    }
    prepare(input) {
        const options = {
            summary: String(input.summary || '').slice(0, 2000),
            steps: String(input.steps || '').slice(0, 6000),
            occurred: String(input.occurred || '').slice(0, 200),
            includeGame: input.includeGame !== false,
            includeRaw: input.includeRaw === true,
        };
        (0, diagnostics_1.flushDiagnostics)();
        const id = (0, crypto_1.randomUUID)(), created = new Date().toISOString(), entries = [], warnings = [], collection = [];
        let total = 0;
        const add = (name, text) => {
            const data = Buffer.from((0, diagnostics_1.sanitizeDiagnosticText)(text), 'utf8'), limit = ['manifest.json', 'README.txt'].includes(name) ? MAX_TOTAL : MAX_TOTAL - 65536;
            if (total + data.length > limit) {
                warnings.push(name + ': 전체 32MB 제한 / total limit 32MB');
                return;
            }
            entries.push({ name, data });
            total += data.length;
        };
        const read = (name, file, cap = MAX_FILE) => {
            try {
                const t = tail(file, cap);
                collection.push({
                    name,
                    source: (0, diagnostics_1.sanitizeDiagnosticText)(file),
                    originalBytes: t.size,
                    modifiedAt: t.modifiedAt,
                    truncated: t.truncated,
                });
                if (t.truncated)
                    warnings.push(name + ': 최근 부분만 포함 / recent tail only');
                add(name, (t.truncated ? '[TRUNCATED: recent tail only; original bytes=' + t.size + ']\n' : '') + t.text);
            }
            catch (e) {
                const error = (0, diagnostics_1.sanitizeDiagnosticText)(e.message);
                collection.push({ name, missing: true, error });
                warnings.push(name + ': ' + error);
            }
        };
        add('report.json', JSON.stringify({
            schema: 1,
            id,
            created,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            utcOffsetMinutes: -new Date().getTimezoneOffset(),
            ...options,
        }, null, 2));
        let state;
        try {
            state = this.snapshot();
        }
        catch (e) {
            state = { snapshotError: String(e.message) };
        }
        add('environment.json', JSON.stringify({
            schema: 1,
            created,
            os: {
                platform: process.platform,
                release: os.release(),
                arch: process.arch,
                totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
            },
            runtime: process.versions,
            diagnostics: (0, diagnostics_1.diagnosticStatus)(),
            state,
        }, null, 2));
        const dir = this.userData();
        for (const file of ['app.log', 'app.log.1', 'app.log.2', 'app.log.3', 'app.log.4'])
            read('app/' + file, path.join(dir, 'logs', file), 2 * 1024 * 1024);
        add('app/memory-recent.log', (0, diagnostics_1.diagnosticMemory)());
        read('app/console.log', path.join(dir, 'sllm_console.log'), 512 * 1024);
        if (options.includeGame) {
            const game = this.gameLog();
            read('stellaris/game.log', game);
            const logs = path.dirname(game);
            for (const file of ['error.log', 'system.log', 'setup.log', 'exceptions.log'])
                read('stellaris/' + file, path.join(logs, file), file === 'error.log' ? MAX_FILE : 2 * 1024 * 1024);
        }
        if (options.includeRaw)
            for (const file of ['sllm_govraw.log', 'sllm_councilraw.log'])
                read('optional/' + file, path.join(dir, file), 2 * 1024 * 1024);
        add('README.txt', 'SLLM bug report / 버그 신고\nReport ID: ' +
            id +
            '\nSnapshot time: ' +
            created +
            '\n\nreport.json: symptom, reproduction steps and occurrence time.\nenvironment.json: app/game paths, versions, active mods and safe settings.\napp/: structured app diagnostics, request timings, console acknowledgements.\nstellaris/: recent game/error/system/setup/exception logs when selected.\noptional/: optional governor/council raw diagnostics (may include questions and dialogue).\n\nCredentials, home paths and email patterns are redacted. Review all files before sharing; empire/mod names and free-form user text may remain.\nNo save files, key store, cookies, conversation archives, custom images or complete settings files are included.\nSome files may be missing or truncated: see manifest.json.\nAll timestamps in app logs are UTC. No automatic upload occurs.\n');
        const files = entries.map((e) => ({ name: e.name, bytes: e.data.length, sha256: (0, crypto_1.createHash)('sha256').update(e.data).digest('hex') }));
        const info = {
            id,
            created,
            files,
            warnings,
            options: {
                ...options,
                summary: (0, diagnostics_1.sanitizeDiagnosticText)(options.summary),
                steps: (0, diagnostics_1.sanitizeDiagnosticText)(options.steps),
                occurred: (0, diagnostics_1.sanitizeDiagnosticText)(options.occurred),
            },
        };
        add('manifest.json', JSON.stringify({
            schema: 1,
            id,
            created,
            files,
            warnings,
            collection,
            limits: { perFile: MAX_FILE, total: MAX_TOTAL },
            excluded: ['save files', 'key store', 'cookies', 'full settings', 'inbox/chronicle/history databases', 'custom images'],
        }, null, 2));
        info.files = entries.map((e) => ({ name: e.name, bytes: e.data.length, sha256: (0, crypto_1.createHash)('sha256').update(e.data).digest('hex') }));
        this.snapshots.set(id, { info, entries });
        while (this.snapshots.size > 2)
            this.snapshots.delete(this.snapshots.keys().next().value);
        return info;
    }
    preview(id, name) {
        const s = this.snapshots.get(id), e = s?.entries.find((e) => e.name === name);
        if (!e)
            throw Error((0, i18n_pick_1.L)('미리보기가 만료됐습니다. 로그 묶음을 다시 만들어 주세요.', 'The preview expired. Create the log bundle again.'));
        const max = 200000;
        return e.data.subarray(0, max).toString('utf8') + (e.data.length > max ? '\n[PREVIEW TRUNCATED: full content is in ZIP]' : '');
    }
    get(id) {
        return this.snapshots.get(id)?.info || null;
    }
    export(id, target) {
        const s = this.snapshots.get(id);
        if (!s)
            throw Error((0, i18n_pick_1.L)('미리보기가 만료됐습니다. 로그 묶음을 다시 만들어 주세요.', 'The preview expired. Create the log bundle again.'));
        const temp = target + '.' + (0, crypto_1.randomUUID)() + '.tmp';
        try {
            fs.writeFileSync(temp, zip(s.entries), { flag: 'wx' });
            fs.renameSync(temp, target);
            s.exported = target;
        }
        catch (e) {
            try {
                if (fs.existsSync(temp))
                    fs.unlinkSync(temp);
            }
            catch { }
            throw e;
        }
    }
    exported(id) {
        return this.snapshots.get(id)?.exported || null;
    }
}
exports.SupportBundles = SupportBundles;
//# sourceMappingURL=support-bundle.js.map
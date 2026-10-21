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
exports.registerDiagnosticSecret = registerDiagnosticSecret;
exports.sanitizeDiagnosticText = sanitizeDiagnosticText;
exports.safeDiagnosticValue = safeDiagnosticValue;
exports.startDiagnostics = startDiagnostics;
exports.logDiagnostic = logDiagnostic;
exports.flushDiagnostics = flushDiagnostics;
exports.diagnosticStatus = diagnosticStatus;
exports.diagnosticMemory = diagnosticMemory;
exports.writeRawDiagnostic = writeRawDiagnostic;
exports.diagnosticSpan = diagnosticSpan;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
const secrets = new Set();
function registerDiagnosticSecret(value) { if (value && value.length >= 6)
    secrets.add(value); }
/** Apply both before disk logging and again when assembling a report. */
function sanitizeDiagnosticText(value) {
    let text = String(value);
    for (const secret of [...secrets].sort((a, b) => b.length - a.length))
        text = text.split(secret).join('[REDACTED]').split(JSON.stringify(secret).slice(1, -1)).join('[REDACTED]');
    text = text.replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, '[REDACTED]');
    text = text.replace(/\bBearer\s+[^\s"'<>;,]+/gi, 'Bearer [REDACTED]');
    text = text.replace(/((?:["']?)(?:api[_-]?key|x-api-key|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret|token)(?:["']?)\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'[^']*'|[^\s,;&}\]]+)/gi, '$1"[REDACTED]"');
    text = text.replace(/(https?:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1[REDACTED]@');
    text = text.replace(/([?&](?:key|api_key|apikey|token|access_token|password|secret|auth)=)[^&#\s"']*/gi, '$1[REDACTED]');
    const home = os.homedir();
    if (home) {
        text = text.split(home).join('[HOME]').split(home.replace(/\\/g, '/')).join('[HOME]').split(home.replace(/\\/g, '\\\\')).join('[HOME]');
    }
    text = text.replace(/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s"<>]+/gi, '[HOME]');
    text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
    return text;
}
function safeDiagnosticValue(value, depth = 0) {
    if (depth > 8)
        return '[DEPTH LIMIT]';
    if (value instanceof Error)
        return { name: value.name, message: sanitizeDiagnosticText(value.message), stack: sanitizeDiagnosticText(value.stack || '') };
    if (typeof value === 'string')
        return sanitizeDiagnosticText(value).slice(0, 16000);
    if (Array.isArray(value))
        return value.slice(0, 200).map(v => safeDiagnosticValue(v, depth + 1));
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).slice(0, 150).map(([k, v]) => [k, /^(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|secret|client[_-]?secret|token)$/i.test(k) ? '[REDACTED]' : safeDiagnosticValue(v, depth + 1)]));
    return typeof value === 'bigint' ? String(value) : value;
}
const session = (0, crypto_1.randomUUID)();
let sequence = 0, directory = '', pending = '', timer = null, bytes = 0, context = null;
const recent = [];
let failure = '';
const LIMIT = 2 * 1024 * 1024, ROTATIONS = 4;
function startDiagnostics(dir, getContext) {
    directory = dir;
    context = getContext;
    try {
        fs.mkdirSync(dir, { recursive: true });
        bytes = fs.existsSync(path.join(dir, 'app.log')) ? fs.statSync(path.join(dir, 'app.log')).size : 0;
    }
    catch (e) {
        failure = String(e.message);
    }
    logDiagnostic('info', 'app.session.start', { pid: process.pid, versions: process.versions, platform: process.platform, arch: process.arch });
    flushDiagnostics();
}
function logDiagnostic(level, event, data = {}) {
    let ctx;
    try {
        ctx = context?.();
    }
    catch {
        ctx = { unavailable: true };
    }
    const line = JSON.stringify({ time: new Date().toISOString(), session, seq: ++sequence, level, event, context: safeDiagnosticValue(ctx), data: safeDiagnosticValue(data) }) + '\n';
    recent.push(line);
    if (recent.length > 1000)
        recent.shift();
    if (!directory)
        return;
    pending += line;
    if (Buffer.byteLength(pending) > 32768 || level === 'error')
        flushDiagnostics();
    else if (!timer) {
        timer = setTimeout(flushDiagnostics, 500);
        timer.unref();
    }
}
function flushDiagnostics() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    if (!pending || !directory)
        return;
    const chunk = pending;
    pending = '';
    try {
        fs.mkdirSync(directory, { recursive: true });
        const file = path.join(directory, 'app.log');
        if (bytes + Buffer.byteLength(chunk) > LIMIT) {
            for (let n = ROTATIONS; n >= 1; n--) {
                const prev = n === 1 ? file : file + '.' + (n - 1), next = file + '.' + n;
                if (n === ROTATIONS && fs.existsSync(next))
                    fs.unlinkSync(next);
                if (fs.existsSync(prev))
                    fs.renameSync(prev, next);
            }
            bytes = 0;
        }
        fs.appendFileSync(file, chunk, 'utf8');
        bytes += Buffer.byteLength(chunk);
        failure = '';
    }
    catch (e) {
        failure = sanitizeDiagnosticText(e.message);
    }
}
function diagnosticStatus() { return { session, directory: sanitizeDiagnosticText(directory), maxFileBytes: LIMIT, rotatedFiles: ROTATIONS, writeError: failure, memoryEntries: recent.length }; }
function diagnosticMemory() { return recent.join(''); }
function writeRawDiagnostic(file, text) {
    if (!directory || !['sllm_govraw.log', 'sllm_councilraw.log'].includes(file))
        return;
    const target = path.join(path.dirname(directory), file), chunk = sanitizeDiagnosticText(text).slice(0, 256 * 1024) + '\n';
    try {
        if (fs.existsSync(target) && fs.statSync(target).size + Buffer.byteLength(chunk) > LIMIT) {
            for (let n = 2; n >= 1; n--) {
                const prev = n === 1 ? target : target + '.1', next = target + '.' + n;
                if (n === 2 && fs.existsSync(next))
                    fs.unlinkSync(next);
                if (fs.existsSync(prev))
                    fs.renameSync(prev, next);
            }
        }
        fs.appendFileSync(target, chunk, 'utf8');
    }
    catch (error) {
        logDiagnostic('warn', 'raw_log.write_failed', { file, error });
    }
}
function diagnosticSpan(event, data = {}) {
    const id = (0, crypto_1.randomUUID)().slice(0, 12), start = Date.now();
    logDiagnostic('info', event + '.start', { id, ...data });
    return { id, end: (result = {}) => logDiagnostic('info', event + '.done', { id, ms: Date.now() - start, result }), fail: error => logDiagnostic('error', event + '.failed', { id, ms: Date.now() - start, error }) };
}
//# sourceMappingURL=diagnostics.js.map
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
exports.LogWatcher = void 0;
const fs = __importStar(require("fs"));
const events_1 = require("events");
const string_decoder_1 = require("string_decoder");
const protocol_1 = require("./protocol");
class LogWatcher extends events_1.EventEmitter {
    path;
    intervalMs;
    fromStart;
    pos = 0;
    historyEnd = 0;
    identity = '';
    rest = '';
    restIsHistory = false;
    decoder = new string_decoder_1.StringDecoder('utf8');
    lastFailure = '';
    timer = null;
    constructor(path, intervalMs = 200, fromStart = false) {
        super();
        this.path = path;
        this.intervalMs = intervalMs;
        this.fromStart = fromStart;
    }
    status() { return { path: this.path, position: this.pos, running: !!this.timer, readError: this.lastFailure, historyEnd: this.historyEnd, replaying: this.pos < this.historyEnd }; }
    clearLine() { this.rest = ''; this.restIsHistory = false; this.decoder = new string_decoder_1.StringDecoder('utf8'); }
    setPath(next) { if (next === this.path)
        return; const running = !!this.timer; this.stop(); this.path = next; this.pos = this.historyEnd = 0; this.identity = ''; this.clearLine(); this.lastFailure = ''; if (running) {
        this.emit('reset');
        this.start();
    } }
    start() {
        if (this.timer)
            return;
        this.clearLine();
        let size = 0;
        try {
            const stat = fs.statSync(this.path);
            size = stat.size;
            this.identity = `${stat.dev}:${stat.ino}`;
        }
        catch {
            this.identity = '';
        }
        this.pos = this.fromStart ? 0 : size;
        // Freeze startup EOF: appends while replaying a large file are still live.
        this.historyEnd = this.fromStart ? size : 0;
        this.emit('diagnostic', { event: 'watcher.start', path: this.path, position: this.pos, fromStart: this.fromStart, historyEnd: this.historyEnd });
        this.timer = setInterval(() => this.poll(), this.intervalMs);
    }
    stop() { if (this.timer)
        clearInterval(this.timer); this.timer = null; }
    poll() {
        let fd;
        try {
            fd = fs.openSync(this.path, 'r');
            const stat = fs.fstatSync(fd), size = stat.size, identity = `${stat.dev}:${stat.ino}`;
            if (this.lastFailure) {
                this.emit('diagnostic', { event: 'watcher.recovered', path: this.path });
                this.lastFailure = '';
            }
            if ((this.identity && identity !== this.identity) || size < this.pos || size < this.historyEnd) {
                this.pos = this.historyEnd = 0;
                this.clearLine();
                this.emit('diagnostic', { event: 'watcher.truncated', path: this.path, size });
                this.emit('reset');
            }
            this.identity = identity;
            if (size === this.pos)
                return;
            const history = this.pos < this.historyEnd, end = history ? Math.min(size, this.historyEnd) : size;
            const buf = Buffer.alloc(Math.min(end - this.pos, 2 * 1024 * 1024)), bytes = fs.readSync(fd, buf, 0, buf.length, this.pos);
            this.pos += bytes;
            const firstIsHistory = this.restIsHistory || history;
            const lines = (this.rest + this.decoder.write(buf.subarray(0, bytes))).split('\n');
            this.rest = lines.pop() ?? '';
            // Completing an old partial line must not turn it into a new game event.
            this.restIsHistory = lines.length ? history : firstIsHistory;
            if (!this.rest && bytes > 0 && buf[bytes - 1] === 0x0a)
                this.restIsHistory = false;
            if (this.rest.length > 1024 * 1024) {
                this.emit('diagnostic', { event: 'watcher.oversized_line', chars: this.rest.length });
                this.rest = '';
            }
            for (let i = 0; i < lines.length; i++) {
                const msg = (0, protocol_1.parseLogLine)(lines[i]), source = (i === 0 ? firstIsHistory : history) ? 'history' : 'message';
                if (msg)
                    try {
                        this.emit(source, msg);
                    }
                    catch (error) {
                        this.emit('diagnostic', { event: 'watcher.handler_failed', source, kind: msg.kind, error: error.message, stack: error.stack });
                    }
            }
            if (history && this.pos === this.historyEnd)
                this.emit('diagnostic', { event: 'watcher.history_complete', path: this.path, bytes: this.historyEnd });
        }
        catch (e) {
            const error = e.message;
            if (error !== this.lastFailure) {
                this.lastFailure = error;
                this.emit('diagnostic', { event: 'watcher.read_failed', path: this.path, error });
            }
        }
        finally {
            if (fd !== undefined)
                try {
                    fs.closeSync(fd);
                }
                catch { }
        }
    }
}
exports.LogWatcher = LogWatcher;
//# sourceMappingURL=logWatcher.js.map
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
exports.runLogReplayChecks = runLogReplayChecks;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const logWatcher_1 = require("./logWatcher");
const protocol_1 = require("./protocol");
const speech_1 = require("./speech");
const govmemory_1 = require("./govmemory");
/** Real file boundaries and stores, no game, network, Electron, or AI calls. */
function runLogReplayChecks(eq) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sllm-f41-'));
    const watchers = [];
    const watch = (file, replay = true) => {
        const w = new logWatcher_1.LogWatcher(file, 60000, replay);
        watchers.push(w);
        return w;
    };
    const line = (kind, values) => `SLLM:${kind}/;/${values}\n`;
    try {
        const file = path.join(root, 'game.log');
        const speech = new speech_1.SpeechStore(path.join(root, 'speech.json'));
        const gov = new govmemory_1.GovMemoryStore(path.join(root, 'gov.json'));
        speech.start('1', '2211.01.01');
        gov.track('1', '2211.01.01');
        const speechBefore = fs.readFileSync(path.join(root, 'speech.json'), 'utf8');
        const govBefore = fs.readFileSync(path.join(root, 'gov.json'), 'utf8');
        fs.writeFileSync(file, line('HELLO', 'req=12') + line('SPEECH', 'phase=prep/;/sid=1/;/date=2210.01.01') +
            line('MONTH', 'sid=1/;/date=2210.04.01/;/last=41') + line('LOADED', 'sid=1/;/date=2209.01.01') +
            line('NEWS', 'kind=war') + line('GOVTALK', 'name=old') + line('ACK', 'req=20'));
        let requests = 0, notifications = 0, branches = 0;
        const live = [], history = [];
        const w = watch(file);
        w.on('history', (m) => { history.push(m.kind); requests = Math.max(requests, (0, protocol_1.reqSeenIn)(m)); });
        w.on('message', (m) => {
            live.push(m.kind);
            requests = Math.max(requests, (0, protocol_1.reqSeenIn)(m));
            if (m.kind === 'SPEECH')
                speech.start(m.kv.sid, m.kv.date);
            if (m.kind === 'MONTH' && speech.tick(m.kv.sid, m.kv.date))
                notifications++;
            if ((m.kind === 'LOADED' || m.kind === 'MONTH') && gov.track(m.kv.sid, m.kv.date))
                branches++;
        });
        w.start();
        w.poll();
        eq([requests, history.length, live.length], [41, 7, 0], 'F-41 replay restores max req/last without feature delivery');
        eq(fs.readFileSync(path.join(root, 'speech.json'), 'utf8'), speechBefore, 'F-41 old speech/month leaves saved speech untouched');
        eq(fs.readFileSync(path.join(root, 'gov.json'), 'utf8'), govBefore, 'F-41 old loaded/month leaves governor timeline untouched');
        fs.appendFileSync(file, line('MONTH', 'sid=1/;/date=2211.04.01/;/last=42'));
        w.poll();
        eq([speech.get('1').phase, notifications, requests, branches], ['ready', 1, 42, 0], 'F-41 new monthly signal completes speech once');
        fs.appendFileSync(file, line('LOADED', 'sid=1/;/date=2210.12.01'));
        w.poll();
        eq(branches, 1, 'F-41 real save rewind still creates a governor branch');
        const stateAfter = fs.readFileSync(path.join(root, 'gov.json'), 'utf8');
        w.stop();
        w.start();
        w.poll();
        eq([notifications, branches, fs.readFileSync(path.join(root, 'gov.json'), 'utf8')], [1, 1, stateAfter], 'F-41 watcher restart does not repeat speech or rewind');
        const partial = path.join(root, 'partial.log');
        const bytes = Buffer.from(line('NEWS', 'name=가나다'));
        const cut = bytes.indexOf(Buffer.from('가')) + 1;
        fs.writeFileSync(partial, bytes.subarray(0, cut));
        const p = watch(partial), pg = [], ph = [];
        p.on('message', (m) => pg.push(m.kind));
        p.on('history', (m) => ph.push(m.kv.name));
        p.start();
        p.poll();
        fs.appendFileSync(partial, Buffer.concat([bytes.subarray(cut), Buffer.from(line('HELLO', 'req=55'))]));
        p.poll();
        eq([ph, pg], [['가나다'], ['HELLO']], 'F-41 split Korean bytes across startup EOF stay historical; following line is live');
        const big = path.join(root, 'big.log');
        fs.writeFileSync(big, ('padding'.repeat(30) + '\n').repeat(14000) + line('HELLO', 'last=99'));
        const b = watch(big), bg = [], bh = [];
        b.on('history', (m) => bh.push((0, protocol_1.reqSeenIn)(m)));
        b.on('message', (m) => bg.push(m.kind));
        b.start();
        b.poll();
        eq(b.status().replaying, true, 'F-41 large startup log spans bounded reads');
        fs.appendFileSync(big, line('MONTH', 'date=2212.01.01'));
        b.poll();
        b.poll();
        eq([bh, bg], [[99], ['MONTH']], 'F-41 append during replay remains live after frozen boundary');
        fs.writeFileSync(big, line('HELLO', 'req=1'));
        b.poll();
        eq(bg, ['MONTH', 'HELLO'], 'F-41 truncated game log starts a live session');
        const replacement = path.join(root, 'replacement.log');
        fs.writeFileSync(replacement, line('HELLO', 'req=2'));
        fs.renameSync(replacement, big);
        b.poll();
        eq(bg, ['MONTH', 'HELLO', 'HELLO'], 'F-41 same-size replacement is detected by file identity');
        const missing = path.join(root, 'missing.log'), miss = watch(missing), mg = [];
        miss.on('message', (m) => mg.push(m.kind));
        miss.start();
        miss.poll();
        fs.writeFileSync(missing, line('HELLO', 'req=3'));
        miss.poll();
        eq(mg, ['HELLO'], 'F-41 file created after startup is live');
        const switched = path.join(root, 'switched.log');
        fs.writeFileSync(switched, line('SPEECH', 'phase=prep'));
        miss.setPath(switched);
        miss.poll();
        fs.appendFileSync(switched, line('MONTH', 'date=2212.01.01'));
        miss.poll();
        eq(mg, ['HELLO', 'MONTH'], 'F-41 path change protects pre-existing history');
        const main = fs.readFileSync(path.join(__dirname, 'main.ts'), 'utf8');
        const handler = main.match(/watcher\.on\('history', \(m: SllmMessage\) => \{([\s\S]*?)\n\s*\}\);/)?.[1]?.trim();
        eq(handler, 'link.reqCounter = Math.max(link.reqCounter, reqSeenIn(m));', 'F-41 app history handler only learns request numbers');
        eq(main.includes("watcher.on('message', (m: SllmMessage) => router.dispatch(m))"), true, 'F-41 live messages still use the complete feature router');
    }
    finally {
        for (const w of watchers)
            w.stop();
        // Only this freshly created test directory is removed.
        fs.rmSync(root, { recursive: true, force: true });
    }
}
if (require.main === module) {
    const assert = require('node:assert/strict');
    let count = 0;
    runLogReplayChecks((a, b, name) => { assert.deepEqual(a, b, name); console.log('PASS ' + name); count++; });
    console.log(`F-41: ${count} checks passed`);
}
//# sourceMappingURL=log-replay-check.js.map
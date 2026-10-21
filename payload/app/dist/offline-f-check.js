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
exports.runOfflineFChecks = runOfflineFChecks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vm = __importStar(require("vm"));
const events_1 = require("events");
const ts = __importStar(require("typescript"));
const protocol_1 = require("./protocol");
const speech_1 = require("./speech");
const planets_1 = require("./planets");
const session_queue_1 = require("./session-queue");
const single_flight_1 = require("./single-flight");
async function runOfflineFChecks(eq) {
    const late = { sid: '1', n: 41, key: 'sllm_speech_war_2' };
    for (const [sid, key, n, expected] of [
        ['1', late.key, 41, true], ['2', late.key, 41, false], ['', late.key, 41, false],
        ['1', 'sllm_speech_war_1', 41, false], ['1', '', 41, false], ['1', late.key, NaN, false],
        ['1', late.key, 40, false], ['1', late.key + '_extra', 41, false],
    ])
        eq((0, speech_1.speechAppliedMatches)(late, sid, key, n), expected, `F-39 speech exact receipt ${sid}/${key}/${n}`);
    const want = { sid: '1', req: 42, key: 'resolution_x', kind: 'GCFORCE', mode: 'pass' };
    const receipt = (0, protocol_1.parseLogLine)('SLLM:GCFORCE/;/sid=1/;/req=42/;/mode=pass/;/state=done');
    eq((0, protocol_1.councilReceiptMatches)(receipt, want), true, 'F-39 council receipt does not need fragile key echo');
    const changes = [{ sid: '2' }, { req: '43' }, { mode: 'cancel' }, { state: 'anything' }, { key: 'resolution_y' }];
    for (const change of changes)
        eq((0, protocol_1.councilReceiptMatches)({ ...receipt, kv: { ...receipt.kv, ...change } }, want), false, 'F-39 unrelated or invalid council receipt rejected ' + JSON.stringify(change));
    const statusWant = { ...want, kind: 'GCSTATE' };
    eq((0, protocol_1.councilReceiptMatches)((0, protocol_1.parseLogLine)('SLLM:GCSTATE/;/sid=1/;/req=42/;/voting=0'), statusWant), true, 'F-39 explicit ended status accepted');
    eq((0, protocol_1.councilReceiptMatches)((0, protocol_1.parseLogLine)('SLLM:GCSTATE/;/sid=1/;/req=42/;/voting='), statusWant), false, 'F-39 empty status is not treated as ended');
    const collector = new planets_1.PlanetCollector();
    collector.feed((0, protocol_1.parseLogLine)('SLLM:PLANETS/;/run=1/;/sid=1/;/empire=E'));
    collector.feed((0, protocol_1.parseLogLine)('SLLM:PLANET/;/name=P/;/class=수정 정원 행성/;/pc=0/;/pops=/;/stab=/;/amen=/;/hous='));
    const list = collector.feed((0, protocol_1.parseLogLine)('SLLM:PLANETS_END/;/run=1')), planet = list.planets[0];
    eq((0, planets_1.planetType)(planet), '수정 정원 행성', 'F-35 custom class name preserved');
    eq((0, planets_1.govPrompt)(list, planet, 'player').includes('수정 정원 행성'), true, 'F-35 governor knows custom class');
    eq([planet.pops, planet.stability, planet.amenities, planet.housing], [null, null, null, null], 'F-35 empty numeric fields remain unknown');
    eq((0, planets_1.planetType)({ ...planet, pc: 10, className: '\\[This.GetClassName]' }), '용암 행성', 'F-35 unexpanded class getter uses known fallback');
    let epoch = 1, sid = '1', release;
    const queue = new session_queue_1.SessionCommandQueue(() => ({ epoch, sid })), ran = [];
    const first = queue.run(async () => { ran.push('first'); await new Promise(resolve => { release = resolve; }); });
    await Promise.resolve();
    const stale = queue.run(async () => { ran.push('stale'); });
    const staleResult = stale.then(() => false, () => true);
    epoch++;
    release();
    await first;
    eq(await staleResult, true, 'F-46 queued work cancelled after same-save session change');
    eq(ran, ['first'], 'F-46 stale command was never executed');
    await queue.run(async () => { ran.push('new'); });
    eq(ran, ['first', 'new'], 'F-46 cancellation does not stop later current-session work');
    let release2;
    const first2 = queue.run(async () => { await new Promise(resolve => { release2 = resolve; }); });
    await Promise.resolve();
    const other = queue.run(async () => { ran.push('other'); }).then(() => false, () => true);
    sid = '2';
    release2();
    await first2;
    eq(await other, true, 'F-46 queued work cancelled on save id change');
    let refreshes = 0, finish;
    const refresh = (0, single_flight_1.singleFlight)(() => { refreshes++; return new Promise(resolve => { finish = resolve; }); });
    const read1 = refresh(), read2 = refresh();
    await Promise.resolve();
    eq([refreshes, read1 === read2], [1, true], 'F governor concurrent refresh uses one request');
    finish(3);
    eq(await read2, 3, 'F governor shared refresh returns result to both callers');
    const read3 = refresh();
    await Promise.resolve();
    finish(4);
    await read3;
    eq(refreshes, 2, 'F governor completed refresh permits a fresh read');
    let failures = 0;
    const retry = (0, single_flight_1.singleFlight)(async () => { if (++failures === 1)
        throw Error('read failed'); return 5; });
    await retry().catch(() => undefined);
    eq(await retry(), 5, 'F governor failed refresh does not permanently block reads');
    const mod = (name) => fs.readFileSync(path.join(__dirname, '..', 'tester-mod', 'common', 'scripted_effects', name), 'utf8');
    const speech = mod('sllm_probe_speech.txt');
    eq((speech.match(/phase=applied/g) || []).length, 12, 'F-39 every speech kind/grade has a literal receipt');
    eq((speech.match(/limit = \{ has_modifier = sllm_speech_/g) || []).length, 12, 'F-39 speech receipt requires actual modifier');
    eq(speech.split('\n').filter(line => /log\s*=/.test(line) && /phase=(applied|failed)/.test(line)).every(line => !line.includes('$') && line.includes('/;/sid=') && line.includes('/;/req=') && line.includes('/;/n=')), true, 'F-39 speech receipt has numeric variables and save identity only');
    eq(mod('sllm_probe_galcom_force.txt').split('\n').filter(line => /log\s*=/.test(line)).every(line => !line.includes('$') && line.includes('/;/sid=')), true, 'F-39 council log has no string parameter substitution');
    const terminal = mod('sllm_probe_terminal.txt');
    eq(!terminal.includes('event_target:') && terminal.includes('who = prev } variable = sllm_terminal_op_a'), true, 'F-43 opposite opinion uses direct previous country scope');
    await keyboardChecks(eq);
}
async function keyboardChecks(eq) {
    const file = fs.readFileSync(path.join(__dirname, 'keyboard.ts'), 'utf8');
    eq((file.match(/public class SllmW/g) || []).length, 1, 'F-31 one shared scan-code script');
    const source = ts.transpileModule(file, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    for (const scenario of ['success', 'startup-failure', 'inflight-failure']) {
        let spawns = 0, clipboard = 0;
        const jobs = [];
        const children = [];
        const spawn = () => {
            const number = ++spawns, p = new events_1.EventEmitter(), stdout = new events_1.EventEmitter(), stdin = new events_1.EventEmitter();
            Object.assign(stdout, { setEncoding() { } });
            const job = (text) => {
                jobs.push(text.trim());
                setImmediate(() => { if (scenario === 'inflight-failure')
                    p.emit('exit', 1);
                else
                    stdout.emit('data', 'DONE\n'); });
            };
            Object.assign(stdin, { write: job, end: job });
            Object.assign(p, { stdin, stdout, stderr: new events_1.EventEmitter(), kill() { p.emit('exit', 1); } });
            children.push(p);
            setImmediate(() => { if (scenario === 'startup-failure' && number === 1)
                p.emit('error', new Error('startup failed'));
            else
                stdout.emit('data', 'READY\n'); });
            return p;
        };
        const exports = {};
        vm.runInNewContext(source, {
            exports, Buffer, process: { env: { SLLM_LEGACY_CONSOLE: '1' } },
            setTimeout, clearTimeout,
            require: (id) => id === 'child_process' ? { spawn } : id === './native-bridge' ? { runNativeCommand: async () => { throw Error('Unexpected native call'); } } :
                id === './diagnostics' ? { diagnosticSpan: () => ({ end() { }, fail() { } }) } : id === './i18n-pick' ? { L: (ko) => ko } : (() => { throw Error('Unexpected require: ' + id); })(),
        });
        try {
            const result = await exports.runConsoleCommand('effect test', () => { clipboard++; }).then(() => 'ok', () => 'fail');
            eq([result, spawns, jobs, clipboard], [scenario === 'inflight-failure' ? 'fail' : 'ok', scenario === 'startup-failure' ? 2 : 1, ['CONSOLE'], 1], 'F-31 common fallback and no in-flight retry: ' + scenario);
        }
        finally {
            for (const p of children)
                p.emit('exit', 0);
        }
    }
}
//# sourceMappingURL=offline-f-check.js.map
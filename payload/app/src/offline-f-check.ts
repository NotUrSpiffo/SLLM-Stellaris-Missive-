import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { EventEmitter } from 'events';
import * as ts from 'typescript';
import { parseLogLine, councilReceiptMatches } from './protocol';
import { speechAppliedMatches } from './speech';
import { PlanetCollector, planetType, govPrompt } from './planets';
import { SessionCommandQueue } from './session-queue';
import { singleFlight } from './single-flight';

type Eq = (actual: unknown, expected: unknown, name: string) => void;
export async function runOfflineFChecks(eq: Eq): Promise<void> {
  const late = { sid: '1', n: 41, key: 'sllm_speech_war_2' };
  for (const [sid, key, n, expected] of [
    ['1', late.key, 41, true], ['2', late.key, 41, false], ['', late.key, 41, false],
    ['1', 'sllm_speech_war_1', 41, false], ['1', '', 41, false], ['1', late.key, NaN, false],
    ['1', late.key, 40, false], ['1', late.key + '_extra', 41, false],
  ] as const) eq(speechAppliedMatches(late, sid, key, n), expected, `F-39 speech exact receipt ${sid}/${key}/${n}`);

  const want = { sid: '1', req: 42, key: 'resolution_x', kind: 'GCFORCE' as const, mode: 'pass' as const };
  const receipt = parseLogLine('SLLM:GCFORCE/;/sid=1/;/req=42/;/mode=pass/;/state=done')!;
  eq(councilReceiptMatches(receipt, want), true, 'F-39 council receipt does not need fragile key echo');
  const changes: Record<string, string>[] = [{ sid: '2' }, { req: '43' }, { mode: 'cancel' }, { state: 'anything' }, { key: 'resolution_y' }];
  for (const change of changes)
    eq(councilReceiptMatches({ ...receipt, kv: { ...receipt.kv, ...change } }, want), false, 'F-39 unrelated or invalid council receipt rejected ' + JSON.stringify(change));
  const statusWant = { ...want, kind: 'GCSTATE' as const };
  eq(councilReceiptMatches(parseLogLine('SLLM:GCSTATE/;/sid=1/;/req=42/;/voting=0')!, statusWant), true, 'F-39 explicit ended status accepted');
  eq(councilReceiptMatches(parseLogLine('SLLM:GCSTATE/;/sid=1/;/req=42/;/voting=')!, statusWant), false, 'F-39 empty status is not treated as ended');

  const collector = new PlanetCollector();
  collector.feed(parseLogLine('SLLM:PLANETS/;/run=1/;/sid=1/;/empire=E')!);
  collector.feed(parseLogLine('SLLM:PLANET/;/name=P/;/class=수정 정원 행성/;/pc=0/;/pops=/;/stab=/;/amen=/;/hous=')!);
  const list = collector.feed(parseLogLine('SLLM:PLANETS_END/;/run=1')!)!, planet = list.planets[0];
  eq(planetType(planet), '수정 정원 행성', 'F-35 custom class name preserved');
  eq(govPrompt(list, planet, 'player').includes('수정 정원 행성'), true, 'F-35 governor knows custom class');
  eq([planet.pops, planet.stability, planet.amenities, planet.housing], [null, null, null, null], 'F-35 empty numeric fields remain unknown');
  eq(planetType({ ...planet, pc: 10, className: '\\[This.GetClassName]' }), '용암 행성', 'F-35 unexpanded class getter uses known fallback');

  let epoch = 1, sid = '1', release!: () => void;
  const queue = new SessionCommandQueue(() => ({ epoch, sid })), ran: string[] = [];
  const first = queue.run(async () => { ran.push('first'); await new Promise<void>(resolve => { release = resolve; }); });
  await Promise.resolve();
  const stale = queue.run(async () => { ran.push('stale'); });
  const staleResult = stale.then(() => false, () => true);
  epoch++; release(); await first;
  eq(await staleResult, true, 'F-46 queued work cancelled after same-save session change');
  eq(ran, ['first'], 'F-46 stale command was never executed');
  await queue.run(async () => { ran.push('new'); });
  eq(ran, ['first', 'new'], 'F-46 cancellation does not stop later current-session work');
  let release2!: () => void;
  const first2 = queue.run(async () => { await new Promise<void>(resolve => { release2 = resolve; }); });
  await Promise.resolve();
  const other = queue.run(async () => { ran.push('other'); }).then(() => false, () => true);
  sid = '2'; release2(); await first2;
  eq(await other, true, 'F-46 queued work cancelled on save id change');

  let refreshes = 0, finish!: (value: number) => void;
  const refresh = singleFlight(() => { refreshes++; return new Promise<number>(resolve => { finish = resolve; }); });
  const read1 = refresh(), read2 = refresh(); await Promise.resolve();
  eq([refreshes, read1 === read2], [1, true], 'F governor concurrent refresh uses one request');
  finish(3); eq(await read2, 3, 'F governor shared refresh returns result to both callers');
  const read3 = refresh(); await Promise.resolve(); finish(4); await read3;
  eq(refreshes, 2, 'F governor completed refresh permits a fresh read');
  let failures = 0;
  const retry = singleFlight(async () => { if (++failures === 1) throw Error('read failed'); return 5; });
  await retry().catch(() => undefined);
  eq(await retry(), 5, 'F governor failed refresh does not permanently block reads');

  const mod = (name: string) => fs.readFileSync(path.join(__dirname, '..', 'tester-mod', 'common', 'scripted_effects', name), 'utf8');
  const speech = mod('sllm_probe_speech.txt');
  eq((speech.match(/phase=applied/g) || []).length, 12, 'F-39 every speech kind/grade has a literal receipt');
  eq((speech.match(/limit = \{ has_modifier = sllm_speech_/g) || []).length, 12, 'F-39 speech receipt requires actual modifier');
  eq(speech.split('\n').filter(line => /log\s*=/.test(line) && /phase=(applied|failed)/.test(line)).every(line => !line.includes('$') && line.includes('/;/sid=') && line.includes('/;/req=') && line.includes('/;/n=')), true, 'F-39 speech receipt has numeric variables and save identity only');
  eq(mod('sllm_probe_galcom_force.txt').split('\n').filter(line => /log\s*=/.test(line)).every(line => !line.includes('$') && line.includes('/;/sid=')), true, 'F-39 council log has no string parameter substitution');
  const terminal = mod('sllm_probe_terminal.txt');
  eq(!terminal.includes('event_target:') && terminal.includes('who = prev } variable = sllm_terminal_op_a'), true, 'F-43 opposite opinion uses direct previous country scope');

  await keyboardChecks(eq);
}

async function keyboardChecks(eq: Eq): Promise<void> {
  const file = fs.readFileSync(path.join(__dirname, 'keyboard.ts'), 'utf8');
  eq((file.match(/public class SllmW/g) || []).length, 1, 'F-31 one shared scan-code script');
  const source = ts.transpileModule(file, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const scenario of ['success', 'startup-failure', 'inflight-failure'] as const) {
    let spawns = 0, clipboard = 0;
    const jobs: string[] = [];
    const children: EventEmitter[] = [];
    const spawn = () => {
      const number = ++spawns, p = new EventEmitter(), stdout = new EventEmitter(), stdin = new EventEmitter();
      Object.assign(stdout, { setEncoding() {} });
      const job = (text: string) => {
        jobs.push(text.trim());
        setImmediate(() => { if (scenario === 'inflight-failure') p.emit('exit', 1); else stdout.emit('data', 'DONE\n'); });
      };
      Object.assign(stdin, { write: job, end: job });
      Object.assign(p, { stdin, stdout, stderr: new EventEmitter(), kill() { p.emit('exit', 1); } });
      children.push(p);
      setImmediate(() => { if (scenario === 'startup-failure' && number === 1) p.emit('error', new Error('startup failed')); else stdout.emit('data', 'READY\n'); });
      return p;
    };
    const exports: { runConsoleCommand?: (cmd: string, clipboard: () => void) => Promise<void> } = {};
    vm.runInNewContext(source, {
      exports, Buffer, process: { env: { SLLM_LEGACY_CONSOLE: '1' } },
      setTimeout, clearTimeout,
      require: (id: string) => id === 'child_process' ? { spawn } : id === './native-bridge' ? { runNativeCommand: async () => { throw Error('Unexpected native call'); } } :
        id === './diagnostics' ? { diagnosticSpan: () => ({ end() {}, fail() {} }) } : id === './i18n-pick' ? { L: (ko: string) => ko } : (() => { throw Error('Unexpected require: ' + id); })(),
    });
    try {
      const result = await exports.runConsoleCommand!('effect test', () => { clipboard++; }).then(() => 'ok', () => 'fail');
      eq([result, spawns, jobs, clipboard], [scenario === 'inflight-failure' ? 'fail' : 'ok', scenario === 'startup-failure' ? 2 : 1, ['CONSOLE'], 1], 'F-31 common fallback and no in-flight retry: ' + scenario);
    } finally { for (const p of children) p.emit('exit', 0); }
  }
}

const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const root = require('path').resolve(process.argv[2] || require('path').join(__dirname, '../../app/SLLM-Tester'));
const ts = require(root + '/node_modules/typescript');
const source = fs.readFileSync(root + '/src/features/condemn-app.ts', 'utf8');
function setup() {
  const ctx = {curSaveId:'A', gameDate:'2201.01.01', playerName:'A', actionsAllowed:()=>true,
    adoptedEthics:()=>({names:[]}),flagProv:{ethicsFor:()=>[]}, notify:()=>{}};
  const link={epoch:1}, writes=[], effects=[], queue=[], timers=[];
  const store={ours:{},saves:{},applyOpinion:true,foreignNotify:true};
  const no=()=>{};
  const mods={
    electron:{app:{getPath:()=>'/mock'}},
    fs:{readFileSync:()=>{throw Object.assign(Error(),{code:'ENOENT'})},writeFileSync:(p,s)=>writes.push(JSON.parse(s))},
    path:require('path'),'../app/ctx':{ctx},'./settings-ui':{pick:(k,e)=>e},
    '../music':{safeKey:x=>x,creedEthics:()=>[]},
    '../condemn':{sanitizeCondemn:()=>store,ourStatementSteps:()=>[-3,3],STANCE_KO:{condemn:'규탄'},STANCE_EN:{condemn:'Condemn'},
      foreignWorthNotice:()=>true,ourPastStanceOn:()=>null,galcomStance:()=>null,
      pickSpeakers:vs=>vs.map(v=>({v,stance:'condemn',score:-3})),countStances:()=>({}),
      reactionMessages:()=>[],parseReactions:()=>({items:[]}),stanceStep:()=>-3,countsLine:()=>''},
    '../warinfo':{describeWar:()=>'',warAggression:()=>0},
    '../app/game-link':{link,enqueue:fn=>{queue.push(fn)},sendBatch:async(n,fn)=>{effects.push(fn([1]));return 'ok'}},
    '../protocol':{opinionShiftEffects:(req,idx,step)=>({idx,step})},
    './mail-app':{mail:{countries:new Map()}},
    './chronicle-app':{chronNote:no,chronNoteWorld:no},'./debate-app':{debateOn:no},'../diagnostics':{logDiagnostic:no}
  };
  const code=ts.transpileModule(source+'\nexport const testIssue=issueOurStatement; export const testVerdict=runVerdict; export const testForeign=onForeignWar;',
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const box={exports:{}};
  vm.runInNewContext('(function(require,module,exports){'+code+'})',{
    setTimeout:fn=>{const t={fn,cleared:false};timers.push(t);return t},clearTimeout:t=>{t.cleared=true},console
  })(id=>mods[id]||new Proxy({},{get:()=>no}),box,box.exports);
  const war={war:'Shared name',date:'2201.01.01',attacker:'Att',defender:'Def',ai:7,di:9,attGoal:'conquest',side:'att'};
  return {api:box.exports,ctx,link,writes,effects,queue,timers,war,store};
}
(async()=>{
  let tests=0;
  async function test(name, fn){await fn();console.log('PASS '+name);tests++}
  await test('valid statement retains records and two opinion requests',async()=>{
    const t=setup();t.api.testForeign(t.war);assert.equal((await t.api.testIssue('condemn','x')).ok,true);
    assert.equal(t.store.ours.A.length,1);for(const job of t.queue)await job();assert.equal(t.effects.length,2);
  });
  for(const mode of ['switch','rewind'])await test(mode+' rejects stale statement without lifecycle hook',async()=>{
    const t=setup();t.api.testForeign(t.war);if(mode==='switch')t.ctx.curSaveId='B';else t.link.epoch++;
    assert.equal((await t.api.testIssue('condemn','x')).ok,false);assert.equal(t.writes.length,0);assert.equal(t.queue.length,0);
  });
  await test('queued opinion requests are cancelled after reload',async()=>{
    const t=setup();t.api.testForeign(t.war);await t.api.testIssue('condemn','x');t.link.epoch++;
    for(const job of t.queue)await job();assert.equal(t.effects.length,0);
  });
  await test('reset clears both timer types, dialog and duplicate history',async()=>{
    const t=setup();t.api.testForeign(t.war);let closed=false;t.api.foreign.win={isDestroyed:()=>false,close:()=>{closed=true}};
    t.api.condemnSetInfo(t.war);t.api.condemnAfterDeclaration(t.war.war,'x');t.link.epoch++;t.api.resetCondemnSession();
    assert(t.timers.every(x=>x.cleared));assert(closed);assert.equal(t.api.foreign.cur,null);assert.equal(t.api.condemn.pending.size,0);
    t.api.testForeign(t.war);assert(t.api.foreign.cur);
  });
  for(const mode of ['switch','rewind'])await test(mode+' during AI discards verdict and preserves newer same-name work',async()=>{
    const t=setup();let resolve;t.ctx.ai={chat:()=>new Promise(r=>resolve=r)};
    t.api.condemnSetInfo(t.war);t.api.condemn.pending.get(t.war.war).voices.push({idx:7,name:'Att',flags:{}});
    const pending=t.api.testVerdict(t.war.war,'x');
    if(mode==='switch')t.ctx.curSaveId='B';t.link.epoch++;t.api.resetCondemnSession();
    t.api.condemnSetInfo(t.war);const newer=t.api.condemn.pending.get(t.war.war);
    resolve('{}');await pending;
    assert.equal(t.writes.length,0);assert.equal(t.queue.length,0);assert.equal(t.api.condemn.pending.get(t.war.war),newer);
  });
  await test('valid AI verdict still records and schedules effect',async()=>{
    const t=setup();t.ctx.ai={chat:async()=> '{}'};t.api.condemnSetInfo(t.war);
    t.api.condemn.pending.get(t.war.war).voices.push({idx:7,name:'Att',flags:{}});
    await t.api.testVerdict(t.war.war,'x');assert.equal(t.store.saves.A.length,1);
    for(const job of t.queue)await job();assert.equal(t.effects.length,1);
  });
  await test('cancelled old timer cannot run newer war with same name',async()=>{
    const t=setup();let calls=0;t.ctx.ai={chat:async()=>{calls++;return '{}'}};
    t.api.condemnSetInfo(t.war);const old=t.timers[0];t.link.epoch++;t.api.resetCondemnSession();
    t.api.condemnSetInfo(t.war);t.api.condemn.pending.get(t.war.war).voices.push({idx:7,name:'Att',flags:{}});
    await old.fn();assert.equal(calls,0);assert.equal(t.writes.length,0);
  });
  console.log(`${tests} regression checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

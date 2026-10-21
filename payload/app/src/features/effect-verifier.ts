import { app, BrowserWindow, ipcMain, shell, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { VERIFY_EFFECTS, verificationCommand } from '../effect-verification';
import { ATTACHMENT_VERIFIED_IDS } from '../effect-verified';
import { settings } from '../app/settings';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { terminalRequest, terminalReplies } from './terminal';
import { LogRouter, SLOT } from '../app/log-router';
import { gameState } from './gamestate-app';
import { safeSend } from '../safe-send';
import { logDiagnostic } from '../diagnostics';
import { pick as L } from './settings-ui';

let win:BrowserWindow|null=null,busy=false,stop=false;
let rows:any[]=[],reportPath='',runId='';
const lab=<T extends {label:string;labelEn?:string}>(e:T):T=>({...e,label:L(e.label,e.labelEn??e.label)}); // 효과 이름 한/영(2026-10-19)
const view=()=>({busy,rows:rows.map(lab),reportPath,runId,effects:VERIFY_EFFECTS.filter(e=>!ATTACHMENT_VERIFIED_IDS.has(e.id)).map(lab),verifiedCount:ATTACHMENT_VERIFIED_IDS.size,targets:ctx.terminal.items.filter(c=>c.type==='default'),sid:ctx.curSaveId,date:ctx.gameDate});
const push=()=>safeSend(win,'effectVerifyState',view());
const permitted=(event:Electron.IpcMainInvokeEvent)=>settings.devMode&&event.sender===win?.webContents;
export function registerEffectVerifier(router:LogRouter):void {
 router.on(SLOT.EFFECT_VERIFY,'effect-verify',m=>{if(m.kind==='VERIFY_EFFECT')terminalReplies.get('VERIFY_EFFECT:'+m.kv.req)?.(m);});
 ipcMain.handle('devEffects',()=>{
  if(!settings.devMode)return {ok:false,error:L('개발자 모드에서만 열 수 있습니다.','Available only in developer mode.')};
  if(win&&!win.isDestroyed()){win.show();win.focus();return {ok:true};}
  const a=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:Math.min(1150,a.width),height:Math.min(850,a.height),minWidth:720,minHeight:500,backgroundColor:'#0b1820',webPreferences:{preload:path.join(__dirname,'..','preload.js')}});
  void win.loadFile(path.join(__dirname,'..','..','ui','effect-verifier.html'));win.webContents.once('did-finish-load',push);win.on('closed',()=>{win=null;stop=true;});return {ok:true};
 });
 ipcMain.handle('effectVerifyState',()=>view());
 ipcMain.handle('effectVerifyStop',event=>{if(permitted(event))stop=true;return true;});
 ipcMain.handle('effectVerifyReport',event=>{if(permitted(event)&&reportPath&&fs.existsSync(reportPath))shell.showItemInFolder(reportPath);return true;});
 ipcMain.handle('effectVerifyRun',async(event,input:unknown)=>{
  if(!permitted(event)||busy)return {ok:false,error:L('검증 창과 개발자 모드를 확인하세요.','Check the verification window and developer mode.')};
  const v=input as {saved?:boolean;ids?:unknown;target?:unknown};
  if(!v?.saved||!Array.isArray(v.ids)||!v.ids.length||v.ids.length>VERIFY_EFFECTS.length)return {ok:false,error:L('검증 항목과 테스트 세이브 저장 여부를 확인하세요.','Check the selected effects and that you saved a test save.')};
  const ids=v.ids as unknown[]; const selected=VERIFY_EFFECTS.filter(e=>ids.includes(e.id));
  if(ids.length!==selected.length||new Set(ids).size!==selected.length)return {ok:false,error:L('알 수 없거나 중복된 검증 항목입니다.','Unknown or duplicate effects.')};
  if(!ctx.gameRunning||!link.sessionReady||!/^\d+$/.test(ctx.curSaveId))return {ok:false,error:L('게임과 연결 모드를 먼저 연결하세요.','Connect the game and the link mod first.')};
  const sid=ctx.curSaveId,epoch=link.epoch,target=Number(v.target)||0;
  if(target!==0&&!ctx.terminal.items.some(c=>c.idx===target&&c.type==='default'))return {ok:false,error:L('현재 세이브의 대상 제국을 선택하세요.','Choose a target empire from the current save.')};
  const snap=gameState.last;
  const fid=snap?.sid===sid?Number(snap.factions.find(f=>f.fid)?.fid)||0:0;
  const dir=path.join(app.getPath('userData'),'effect-verification');fs.mkdirSync(dir,{recursive:true});
  runId=new Date().toISOString().replace(/[:.]/g,'-');reportPath=path.join(dir,runId+'.json');
  rows=selected.map(e=>({...e,status:'waiting'}));busy=true;stop=false;push();
  const errorStart=(()=>{try{return fs.statSync(path.join(path.dirname(ctx.GAME_LOG),'error.log')).size;}catch{return 0;}})();
  const persist=()=>{const tmp=reportPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify({runId,sid,epoch,date:ctx.gameDate,rows,limits:'부착·제거 검사. 생산량·기간은 별도 검증. 첩보는 시험 정의이며 자동 게임 연동 아님.'},null,2));fs.renameSync(tmp,reportPath);};
  try {
   for(const row of rows){
    if(stop||!settings.devMode||ctx.curSaveId!==sid||link.epoch!==epoch){row.status='cancelled';continue;}
    const actor=row.scope==='faction'?fid:target;
    if(row.scope!=='country'&&!actor){row.status='no_target';push();persist();continue;}
    row.status='running';row.req=++link.reqCounter;push();persist();
    try {
     const command=verificationCommand(row,row.req,sid,actor);
     const m=await terminalRequest(command,'VERIFY_EFFECT',row.req);
     if(ctx.curSaveId!==sid||link.epoch!==epoch||m.kv.sid!==sid||m.kv.id!==row.id)throw new Error(L('세이브 또는 검증 대상이 바뀌었습니다.','The save or the verification target changed.'));
     const statuses=['existing','attached_removed','cleanup_failed','attach_failed','no_target'];
     row.status=statuses.includes(m.kv.status)?m.kv.status:'unknown';row.receipt=m.kv;
     if(row.scope==='opinion'&&m.kv.before!==undefined){row.delta=Number(m.kv.after)-Number(m.kv.before);row.numericConfirmed=row.delta===row.expected;row.restored=Number(m.kv.restored)===Number(m.kv.before);}
     logDiagnostic('info','effect.verify.result',{id:row.id,req:row.req,status:row.status});
     if(row.status==='cleanup_failed'||row.status==='unknown')stop=true;
    } catch(e){row.status='unknown';row.error=String(e);stop=true;}
    persist();push();
   }
  }finally{
   busy=false;
   try{const f=path.join(path.dirname(ctx.GAME_LOG),'error.log'),buf=fs.readFileSync(f);const start=buf.length>=errorStart?errorStart:0;fs.writeFileSync(reportPath.replace(/\.json$/,'.error.log'),buf.subarray(start));}catch{}
   persist();push();
  }
  return {ok:true,reportPath};
 });
}

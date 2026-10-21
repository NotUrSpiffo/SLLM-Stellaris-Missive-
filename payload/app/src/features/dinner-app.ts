import {openBanquet} from './banquet-app';
import {app,BrowserWindow,ipcMain,screen} from 'electron';
import * as path from 'path';
import {DinnerStore,DinnerInvite,dinnerAcceptance,dinnerReplyMessages,parseDinnerReply,dinnerEffect,validDinnerDate} from '../dinner';
import {addMonths,addYears} from '../gamedate';
import {ctx} from '../app/ctx';
import {link,enqueue,sendConsole} from '../app/game-link';
import {LogRouter,SLOT} from '../app/log-router';
import {inboxStore,syncInbox} from './mail-app';
import {chronNote} from './chronicle-app';
import {logDiagnostic} from '../diagnostics';
import type {SllmMessage} from '../protocol';
import { pick } from './settings-ui';
const L = pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)
let store: DinnerStore|null=null,win:BrowserWindow|null=null,busy=false;
const visits=()=>store??=new DinnerStore(path.join(app.getPath('userData'),'sllm_dinner_invites.json'));
const branch=()=>ctx.govMem().currentBranch(ctx.curSaveId);
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
const waits=new Map<number,{row:DinnerInvite;epoch:number;resolve:(m:SllmMessage)=>void}>();
function list(){return ctx.curSaveId?visits().list(ctx.curSaveId,branch()):[];}
function signal(m:SllmMessage){
 if(m.kind!=='DINNER'||m.kv.sid!==ctx.curSaveId)return;
 const row=list().find(x=>x.id===Number(m.kv.vid)&&x.idx===Number(m.kv.tid));
 if(row&&['arrival_requested','arrived'].includes(row.phase)){
  if(m.kv.phase==='open'&&row.phase!=='arrived'){visits().update({...row,phase:'arrived',error:undefined});ctx.notify({kind:'event',title:L('지도자 도착', 'Leader arrived'),body:L(row.name+'의 지도자가 도착했습니다. 게임의 접대 선택지를 확인하세요.', 'The leader of '+row.name+' has arrived. Check the reception choices in the game.')});}
  if(m.kv.phase==='finished'&&['grand','normal','humiliating'].includes(m.kv.greeting)){
   const greeting=m.kv.greeting as 'grand'|'normal'|'humiliating';visits().update({...row,phase:'prepared',greeting,error:undefined});openBanquet({...row,phase:'prepared',greeting});chronNote(row.idx,L('지도자 방문 접대: ','Leader visit reception: ')+({grand:L('성대하게 대접','received grandly'),normal:L('일반적으로 대접','received normally'),humiliating:L('굴욕적으로 대접','received humiliatingly')})[greeting]);
  }
  if(m.kv.phase==='unavailable')visits().update({...row,phase:'cancelled',error:L('게임에서 상대와 통신할 수 없거나 전쟁 중이어서 방문하지 못했습니다.', 'The visit could not happen: no communications with them in the game, or you are at war.')});
  if(m.kv.phase==='missing'||m.kv.phase==='stale')visits().update({...row,error:L('게임의 방문 기록과 앱 예약이 일치하지 않습니다. 재전송하지 않고 확인을 기다립니다.', 'The game\'s visit record does not match the app\'s booking. Not resending; waiting for confirmation.')});
 }
 const w=waits.get(Number(m.kv.req));if(w&&w.epoch===link.epoch&&w.row.sid===m.kv.sid&&w.row.id===Number(m.kv.vid)&&w.row.idx===Number(m.kv.tid))w.resolve(m);
}
async function deliver(row:DinnerInvite,status:boolean){
 const req=++link.reqCounter,epoch=link.epoch;let timer:ReturnType<typeof setTimeout>|undefined;
 let resolve!:(m:SllmMessage)=>void,reject!:(e:Error)=>void;
 const response=new Promise<SllmMessage>((r,j)=>{resolve=r;reject=j;});void response.catch(()=>{});
 waits.set(req,{row,epoch,resolve});
 try{
  await enqueue(async()=>{
   if(ctx.curSaveId!==row.sid||branch()!==row.branch||link.epoch!==epoch)throw new Error(L('세이브 또는 시간선이 바뀌었습니다.', 'The save or timeline changed.'));
   timer=setTimeout(()=>reject(new Error(L('방문 이벤트 응답을 확인하지 못했습니다. 다음 게임 월에는 상태만 조회합니다.', 'Could not confirm the visit event reply. Next game month only the status will be checked.'))),10000);
   await sendConsole(dinnerEffect(row,req,status));
  });
  return await response;
 }finally{if(timer)clearTimeout(timer);waits.delete(req);}
}
export async function dinnerTick(){
 if(busy||!ctx.curSaveId||!validDinnerDate(ctx.gameDate))return;
 const sid=ctx.curSaveId,b=branch(),epoch=link.epoch,date=ctx.gameDate;
 const current=()=>ctx.curSaveId===sid&&branch()===b&&link.epoch===epoch;
 let active:DinnerInvite|undefined;
 busy=true;
 try{for(let row of visits().due(sid,b,date)){
  active=row;
  if(!current())break;
  const contact=ctx.terminal.sid===sid?ctx.terminal.items.find(x=>x.idx===row.idx):undefined;
  const profile=ctx.profiles.get(row.idx)??ctx.mailCountries.get(row.idx)?.profile;
  if(!contact){visits().update({...row,error:L('통신 가능한 제국 목록에서 상대를 확인하지 못했습니다. 채널 갱신 후 다음 게임 월에 다시 확인합니다.', 'The empire was not found among reachable contacts. Will check again next game month after the channels refresh.')});continue;}
  if(row.ruler&&profile?.ruler&&row.ruler!==profile.ruler){visits().update({...row,phase:'cancelled',error:L('초대한 지도자가 바뀌어 방문 예약을 취소했습니다.', 'The invited leader changed, so the visit was cancelled.')});continue;}
  if(['waiting_reply','writing_reply','reply_ready'].includes(row.phase)){
   if(row.phase==='waiting_reply'){
    const accepted=dinnerAcceptance(contact.score,profile?.flags??{},Math.random());
    row={...row,phase:'writing_reply',accepted,ruler:row.ruler||profile?.ruler||'',arrival:accepted?addMonths(date,6):undefined};
    // Reply date is actual game processing date; guests arrive six months after delivery, not a stale overdue date.
    row.due=date;visits().update(row);
   }
   // 이미 받은 답장(reply_ready)은 날짜만 옮기고 다시 쓰지 않는다(수신함 저장이 실패한 달마다 AI 답장을 새로 부르던 문제, 2026-10-18).
   if(row.due!==date){row=row.phase==='reply_ready'&&row.reply?{...row,due:date,arrival:row.accepted?addMonths(date,6):undefined}:{...row,phase:'writing_reply',due:date,arrival:row.accepted?addMonths(date,6):undefined,reply:undefined};visits().update(row);}
   if(row.phase==='writing_reply'){
    const raw=await ctx.ai.chat(dinnerReplyMessages(row,ctx.profileWithEthics(profile,row.idx),contact.score),{purpose:'leader-dinner-invitation',json:true,maxTokens:1200});
    if(!current())break;
    row={...row,phase:'reply_ready',reply:parseDinnerReply(raw)};visits().update(row);
   }
   if(!current())break;
   // A failed AI/storage operation leaves the pending invitation intact for the next MONTH.
   inboxStore().add(sid,b,{idx:row.idx,name:row.name,date:row.due,text:row.reply!,proposal:null,expires:addYears(row.due,2),read:false,sourceId:'dinner-reply:'+row.id});
   if(inboxStore().error)throw new Error(inboxStore().error!);
   visits().update({...row,phase:row.accepted?'accepted':'declined',error:undefined});syncInbox();
   ctx.notify({kind:'letter',title:L('지도자 초대 답장', 'Invitation reply'),body:row.accepted?L(row.name+'에서 초대를 수락했습니다. 방문 예정일: '+row.arrival, row.name+' accepted the invitation. Expected visit: '+row.arrival):L(row.name+'에서 초대를 거절했습니다.', row.name+' declined the invitation.')});
   continue;
  }
  if(profile?.flags.war&&row.phase==='accepted'){visits().update({...row,phase:'cancelled',error:L('전쟁 중이어서 방문을 취소했습니다.', 'The visit was cancelled because of the war.')});continue;}
  if(row.phase==='accepted'){
   row={...row,phase:'arrival_requested',error:undefined};visits().update(row); // before sending: uncertainty never triggers an automatic resend
   const receipt=await deliver(row,false);if(!['open','finished','unavailable'].includes(receipt.kv.phase))ctx.toUi('mailstatus',L('방문 이벤트를 확인하지 못했습니다. 자동 재전송 없이 상태만 조회합니다.', 'Could not confirm the visit event. Only checking status, without resending.'));
  }else if(row.phase==='arrival_requested'||row.phase==='arrived')await deliver(row,true);
 }}catch(e){if(current()&&active){try{const saved=visits().list(sid,b).find(x=>x.id===active!.id);if(saved)visits().update({...saved,error:message(e)});}catch{ /* original error is reported below */ }}logDiagnostic('warn','dinner.tick.failed',{sid,error:message(e)});ctx.toUi('mailstatus',L('지도자 초대 처리: ', 'Leader invitation: ')+message(e));}
 finally{busy=false;}
}
export function registerDinner(router:LogRouter){
 router.on(SLOT.DINNER,'dinner:calendar',m=>{
  try{if(m.kind==='DINNER')signal(m);if(m.kind==='MONTH')void dinnerTick();}catch(e){logDiagnostic('warn','dinner.signal.failed',{error:message(e)});}
 });
 ipcMain.handle('dinnerOpen',async()=>{
  if(win&&!win.isDestroyed()){win.show();win.focus();return true;}
  const area=screen.getPrimaryDisplay().workArea;
  const w=new BrowserWindow({width:Math.min(780,area.width),height:Math.min(760,area.height),minWidth:600,minHeight:550,frame:false,backgroundColor:'#081921',webPreferences:{preload:path.join(__dirname,'..','preload.js')}});
  win=w;void w.loadFile(path.join(__dirname,'..','..','ui','dinner-invite.html'));w.on('closed',()=>{if(win===w)win=null;});return true;
 });
 ipcMain.handle('dinnerState',async()=>{try{return {ok:true,sid:ctx.curSaveId,date:ctx.gameDate,branch:ctx.curSaveId?branch():0,contacts:ctx.terminal.sid===ctx.curSaveId?ctx.terminal.items.filter(x=>x.idx!==ctx.playerIdx):[],visits:list()};}catch(e){return {ok:false,error:message(e)};}});
 ipcMain.handle('dinnerInvite',async(_e,input:unknown)=>{
  try{
   const v=input as {sid?:unknown;branch?:unknown;idx?:unknown;body?:unknown};
   if(!v||v.sid!==ctx.curSaveId||v.branch!==branch()||ctx.terminal.sid!==ctx.curSaveId||!validDinnerDate(ctx.gameDate))throw new Error(L('현재 세이브의 날짜와 연락처를 먼저 갱신해 주세요.', 'Refresh the current save\'s date and contacts first.'));
   const contact=ctx.terminal.items.find(c=>c.idx===v.idx);if(!contact||contact.idx===ctx.playerIdx)throw new Error(L('초대할 제국을 선택해 주세요.', 'Choose an empire to invite.'));
   if(!ctx.actionsAllowed(contact.idx))throw new Error(L('이 제국에는 초대를 보낼 수 없습니다.', 'You cannot send an invitation to this empire.'));
   if(typeof v.body!=='string')throw new Error(L('초대 서신을 입력해 주세요.', 'Please write the invitation letter.'));
   const row=visits().add({sid:ctx.curSaveId,branch:branch(),idx:contact.idx,name:contact.name,ruler:ctx.profiles.get(contact.idx)?.ruler??ctx.mailCountries.get(contact.idx)?.profile.ruler??'',sent:ctx.gameDate,body:v.body.trim()},3+Math.floor(Math.random()*4));
   logDiagnostic('info','dinner.invited',{sid:row.sid,id:row.id,idx:row.idx,sent:row.sent,due:row.due});
   return {ok:true,invitation:row};
  }catch(e){return {ok:false,error:message(e)};}
 });
 ipcMain.handle('dinnerBanquet',async(_e,id:unknown)=>{try{const row=list().find(x=>x.id===id);if(!row)throw new Error(L('현재 시간선의 방문을 찾지 못했습니다.', 'No visit found on the current timeline.'));openBanquet(row);return {ok:true};}catch(e){return {ok:false,error:message(e)};}});
 ipcMain.handle('dinnerClose',async()=>{win?.close();return true;});
}

import {app,BrowserWindow,ipcMain,screen} from 'electron';
import * as path from 'path';
import {BanquetView,banquetView,banquetDemo,banquetMode} from '../banquet';
import type {DinnerInvite} from '../dinner';
import {ctx} from '../app/ctx';
import {terminal} from './terminal';
import {settings} from '../app/settings';
import {classKey} from '../speciesClass';
import {safeSend} from '../safe-send';
import {BanquetChats,banquetMessages,type BanquetAsk} from '../banquet-chat';
import {link} from '../app/game-link';
import {logDiagnostic} from '../diagnostics';
import {parseReply} from '../action';
import {CONVERSATION_TURNS,conversationFavors} from '../conversation-favors';
import {settleConversationFavors} from './conversation-favors';
import * as fs from 'fs';
import {randomUUID} from 'crypto';
import {terminalRequest} from './terminal';
import {chronNote} from './chronicle-app';
import {GIFT_KO,GIFT_MIN_FAVOR,giftAmount,giftRes,giftFromReply,giftFavor,giftCommand,settleAmount,isShort,type GiftOffer,type GiftRes} from '../banquet-gift';
import {MAX_CONVERSATION_FAVORS} from '../conversation-favors';
import {SPEC_BY_KEY,type SpecRarity,type SpecCat} from '../archive';
import {SPEC_REWARD,askedReward,askFromReply,specimenFavor,specimenGiftCommand,specimenRefuseCommand,type SpecGiftStatus,type SpecRefuseStatus} from '../banquet-specimen';
import {latestArchive,dropArchiveItem} from './archive-app';
import { pick } from './settings-ui';
const L = pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)
export const banquet={win:null as BrowserWindow|null,info:null as BanquetView|null};
let active:{key:string;sid:string;branch:number;idx:number;epoch:number}|null=null,busy=false;
let chats:BanquetChats|null=null;
const store=()=>chats??=new BanquetChats(path.join(app.getPath('userData'),'sllm_banquet_chat.json'));
let favorNote='';
// 만찬 자원 선물(알파 6): 대화에서 뽑은 제안(확인 카드), 창고 확인 결과, 보낸 기록(만찬별, 파일).
interface GiftRow { res:GiftRes;amt:number;status:'sent'|'short'|'uncertain'|'no_target'|'duplicate'|'demo';favor:boolean;date:string;req?:number;cid?:string;message:string }
// 표본 선물(수집품 2단계): 자원 선물과 따로 센다(specFavor). 만찬 호의 상한 5 는 대화+자원+표본 합계.
interface SpecRow { key:string;rarity:SpecRarity;status:'sent'|'give_failed'|'not_owned'|'cant_receive'|'no_target'|'duplicate'|'uncertain';favor:number;opinion:string|null;date:string;req?:number;cid?:string;message:string }
// 지도자 역요구(수집품 3단계): 만찬당 한 번. pending=대답 대기, accepted=줬음, refused=거절(trust: cut=신뢰 -30 적용, none=손해 없음, unknown=확인 못함).
interface SpecAsk { key:string;status:'pending'|'accepted'|'refused';trust?:'cut'|'none'|'unknown';date:string }
interface GiftVisit { favorPaid:boolean;settled?:number;gifts:GiftRow[];specs?:SpecRow[];specFavor?:number;ask?:SpecAsk }
const DEMO_OWNED=[...SPEC_BY_KEY.values()].filter(r=>r[2]==='rare'||r[2]==='epic').slice(0,3).map(r=>({key:r[0],ko:r[3],rarity:r[2] as string}));
/** 지도자가 요구할 수 있는 표본: 지금 플레이어가 가진 것(희귀도 높은 순 20개까지). 시연은 예시 몇 개. */
const ownedSpecs=()=>{const a=latestArchive(),list=a?a.items.map(i=>({key:i.key,ko:i.ko,rarity:i.rarity as string})):(banquet.info?.demo?DEMO_OWNED:[]);const rk=(r:string)=>['exceptional','epic','rare','common'].indexOf(r);return list.slice().sort((x,y)=>rk(x.rarity)-rk(y.rarity)).slice(0,20);};
let specOffer:{key:string}|null=null,specCheck:{key:string;ok:boolean|null;note:string}|null=null,specBusy=false;
const paidOf=(gv:GiftVisit)=>(gv.favorPaid?1:0)+(gv.specFavor||0);
let giftOffer:GiftOffer|null=null,giftCheck:{res:GiftRes;amt:number;ok:boolean|null;note:string}|null=null,giftBusy=false;
// 선물·표본·거절·대화는 모두 같은 만찬 장부(GiftVisit)를 통째로 읽고 쓴다. 하나라도 진행 중이면 나머지는 막는다(동시 저장으로 favorPaid·ask 가 지워져 호의 상한 5 를 넘는 일 방지, 2026-10-18).
const anyBusy=()=>busy||giftBusy||specBusy;
const giftFile=()=>path.join(app.getPath('userData'),'sllm_banquet_gifts.json');
const giftRead=():Record<string,GiftVisit>=>{if(!fs.existsSync(giftFile()))return {};const v=JSON.parse(fs.readFileSync(giftFile(),'utf8'));if(v.version!==1||!v.visits||typeof v.visits!=='object'||Array.isArray(v.visits))throw new Error(L('만찬 선물 기록을 읽지 못했습니다. 기존 파일을 보존했습니다.', 'Could not read the banquet gift record. The existing file was kept.'));return v.visits;};
const giftWrite=(v:Record<string,GiftVisit>)=>{const tmp=giftFile()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,visits:v},null,2),'utf8');fs.renameSync(tmp,giftFile());};
const giftVisit=(key:string):GiftVisit=>{try{const v=giftRead()[key];return v&&Array.isArray(v.gifts)?v:{favorPaid:false,gifts:[]};}catch{return {favorPaid:false,gifts:[]};}};
const giftSave=(key:string,v:GiftVisit)=>{const all=giftRead();all[key]=v;giftWrite(all);};
const guestEc=()=>{const pr=active?(ctx.profiles.get(active.idx)??ctx.mailCountries.get(active.idx)?.profile):undefined;return (pr as {ec?:string}|undefined)?.ec;};
function chatView(){const lines=active?store().get(active.key):[],turns=lines.filter(l=>l.who==='player').length,gv:GiftVisit=active?giftVisit(active.key):{favorPaid:false,gifts:[]},ec=guestEc();
 const conv=conversationFavors(lines.filter(l=>l.who==='guest').map(l=>l.mood??0)),paid=paidOf(gv),ended=turns>=CONVERSATION_TURNS,settledConv=ended?(gv.settled??Math.min(MAX_CONVERSATION_FAVORS-paid,conv)):0;
 const hint=giftOffer?giftFavor(giftOffer,ec,gv.favorPaid,settledConv+(gv.specFavor||0)).reason:null;
 const askKey=gv.ask&&gv.ask.status==='pending'?gv.ask.key:null,isAsk=!!specOffer&&specOffer.key===askKey;
 const sr=specOffer?SPEC_BY_KEY.get(specOffer.key):undefined,sreward=sr?(isAsk?askedReward(sr[2]):SPEC_REWARD[sr[2]]):undefined;
 const ar=gv.ask?SPEC_BY_KEY.get(gv.ask.key):undefined,arw=ar?askedReward(ar[2]):undefined;
 return {lines,busy,locked:anyBusy(),guest:banquet.info?.guest,turns,limit:CONVERSATION_TURNS,ended:turns>=CONVERSATION_TURNS,favors:Math.min(MAX_CONVERSATION_FAVORS,conv+paid),favorNote,
  spec:{offer:sr&&sreward?{key:sr[0],cat:sr[1] as SpecCat,rarity:sr[2],ko:sr[3],en:sr[4],favor:specimenFavor(sr[2],settledConv+paid,MAX_CONVERSATION_FAVORS,isAsk),baseFavor:sreward.favor,opinion:sreward.opinion,asked:isAsk}:null,
   ask:gv.ask&&ar&&arw?{key:gv.ask.key,ko:ar[3],en:ar[4],rarity:ar[2],status:gv.ask.status,trust:gv.ask.trust||null,favor:specimenFavor(ar[2],settledConv+paid,MAX_CONVERSATION_FAVORS,true),opinion:arw.opinion}:null,check:specCheck,busy:anyBusy(),demo:!!banquet.info?.demo,
   sent:(gv.specs||[]).map(g=>{const r=SPEC_BY_KEY.get(g.key);return {key:g.key,ko:r?.[3]||g.key,en:r?.[4]||g.key,rarity:g.rarity,status:g.status,favor:g.favor,opinion:g.opinion};})},
  gift:{offer:giftOffer,check:giftCheck,busy:anyBusy(),hint,min:GIFT_MIN_FAVOR,demo:!!banquet.info?.demo,short:(['energy','minerals','food','alloys','consumer_goods'] as GiftRes[]).filter(r=>isShort(ec,r)),sent:gv.gifts.map(g=>({res:g.res,amt:g.amt,status:g.status,favor:g.favor}))}};}
const pushChat=()=>safeSend(banquet.win,'banquetChat',chatView());
function show(info:BanquetView){
 favorNote='';giftOffer=null;giftCheck=null;specOffer=null;specCheck=null;
 banquet.info=info;
 if(banquet.win&&!banquet.win.isDestroyed()){banquet.win.show();banquet.win.focus();safeSend(banquet.win,'banquetState',info);pushChat();return;}
 const a=ctx.gameDip??screen.getPrimaryDisplay().workArea;
 const w=new BrowserWindow({width:Math.min(1400,a.width),height:Math.min(900,a.height),minWidth:900,minHeight:650,frame:false,show:false,backgroundColor:'#0a161b',alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'..','preload.js')}});
 banquet.win=w;void w.loadFile(path.join(__dirname,'..','..','ui','banquet.html'));w.once('ready-to-show',()=>{w.show();safeSend(w,'banquetState',banquet.info);pushChat();});w.on('closed',()=>{if(banquet.win===w){banquet.win=null;banquet.info=null;active=null;}});
}
export function openBanquet(row:DinnerInvite){
 if(row.sid!==ctx.curSaveId||row.branch!==ctx.govMem().currentBranch(row.sid))throw new Error(L('현재 세이브·시간선의 방문이 아닙니다.', 'This visit is not from the current save or timeline.'));
 const host=ctx.profiles.get(ctx.playerIdx),guest=ctx.profiles.get(row.idx)??ctx.mailCountries.get(row.idx)?.profile;
 const info=banquetView(row,{name:ctx.playerName||L('플레이어 제국', 'Player empire'),ruler:host?.ruler||L('주최국 대표', 'Host representative'),cls:classKey(host?.cls)||'',role:'host'},classKey(guest?.cls)||'',ctx.gameDate,banquetMode(terminal.sid===ctx.curSaveId?terminal.playerGest:0,guest?.gest));
 const key=`${row.sid}:${row.branch}:${row.id}`;store().get(key);
 active={key,sid:row.sid,branch:row.branch,idx:row.idx,epoch:link.epoch};show(info);
}
/** 창고에 이만큼 있는지 게임에 묻는다(보내지는 않음). 시연은 늘 있음으로 본다. */
async function checkGift(o:GiftOffer):Promise<void>{
 const info=banquet.info,session=active;if(!info||!session)return;
 giftCheck={res:o.res,amt:o.amt,ok:null,note:L('창고 확인 중…', 'Checking stockpile…')};pushChat();
 if(info.demo){giftCheck={res:o.res,amt:o.amt,ok:true,note:L('시연: 창고 확인을 생략했습니다.', 'Demo: stockpile check skipped.')};pushChat();return;}
 try{
  if(ctx.curSaveId!==session.sid||link.epoch!==session.epoch)throw new Error(L('세이브가 바뀌었습니다.', 'The save has changed.'));
  const req=++link.reqCounter,cid=randomUUID().replace(/-/g,'');
  const m=await terminalRequest(giftCommand(req,session.sid,session.idx,cid,o,true),'GIFT',req);
  if(giftOffer?.res!==o.res||giftOffer?.amt!==o.amt)return; // 그사이 숫자를 고쳤다
  giftCheck={res:o.res,amt:o.amt,ok:m.kv.status==='ok',note:m.kv.status==='ok'?L('창고에 충분히 있습니다.', 'Enough in the stockpile.'):m.kv.status==='short'?L('창고에 이만큼 없습니다.', 'Not that much in the stockpile.'):L('통신 가능한 상대를 찾지 못했습니다.', 'No contactable counterpart was found.')};
 }catch(e){giftCheck={res:o.res,amt:o.amt,ok:false,note:L('창고를 확인하지 못했습니다: ', 'Could not check the stockpile: ')+String((e as Error).message||e)};}
 pushChat();
}
async function sendGift(o:GiftOffer):Promise<{ok:boolean;error?:string;messages?:string[]}>{
 const info=banquet.info,session=active;
 if(!info||!session||anyBusy())return {ok:false,error:L('만찬 창에서 진행 중인 요청을 확인하세요.', 'Check the pending request in the banquet window.')};
 const current=()=>banquet.info===info&&active===session&&(info.demo?settings.devMode:ctx.curSaveId===session.sid&&link.epoch===session.epoch&&ctx.govMem().currentBranch(session.sid)===session.branch);
 if(!current())return {ok:false,error:L('세이브 또는 시간선이 바뀌었습니다. 방문을 다시 열어 주세요.', 'The save or timeline has changed. Please reopen the visit.')};
 if(!info.demo&&!ctx.actionsAllowed(session.idx))return {ok:false,error:L('이 상대에게는 게임 행동을 보낼 수 없습니다(호환 설정).', 'Game actions cannot be sent to this empire (compatibility settings).')};
 giftBusy=true;pushChat();
 try{
  const gv=giftVisit(session.key),lines=store().get(session.key),ended=lines.filter(l=>l.who==='player').length>=CONVERSATION_TURNS;
  const conv=conversationFavors(lines.filter(l=>l.who==='guest').map(l=>l.mood??0));
  const fav=giftFavor(o,guestEc(),gv.favorPaid,(ended?(gv.settled??conv):0)+(gv.specFavor||0),MAX_CONVERSATION_FAVORS);
  const date=ctx.gameDate||info.date;
  if(info.demo){gv.gifts.push({res:o.res,amt:o.amt,status:'demo',favor:false,date,message:L('시연: 게임에 적용하지 않았습니다.', 'Demo: not applied to the game.')});giftSave(session.key,gv);giftOffer=null;giftCheck=null;return {ok:true,messages:[L('시연: 게임에 적용하지 않았습니다.', 'Demo: not applied to the game.')]};}
  const req=++link.reqCounter,cid=randomUUID().replace(/-/g,'');
  const row:GiftRow={res:o.res,amt:o.amt,status:'uncertain',favor:false,date,req,cid,message:L('선물 전달 결과가 아직 확인되지 않았습니다. 자동 재전송하지 않습니다.', 'The gift delivery result is not confirmed yet. It will not be resent automatically.')};
  gv.gifts.push(row);giftSave(session.key,gv); // 보내기 전에 기록(불확실하면 다시 보내지 않게)
  try{
   const m=await terminalRequest(giftCommand(req,session.sid,session.idx,cid,o,false),'GIFT',req);
   if(m.kv.cid!==cid||m.kv.sid!==session.sid||Number(m.kv.idx)!==session.idx)throw new Error(L('선물 응답의 세이브·상대가 일치하지 않습니다.', 'The gift reply\'s save or partner does not match.'));
   row.status=(['sent','short','no_target','duplicate'].includes(m.kv.status)?m.kv.status:'uncertain') as GiftRow['status'];
   row.message=row.status==='sent'?L('선물을 전달했습니다(게임 확인).', 'Gift delivered (confirmed in game).'):row.status==='short'?L('창고에 이만큼 없어 보내지 않았습니다.', 'Not sent: not that much in the stockpile.'):row.status==='no_target'?L('통신 가능한 상대를 찾지 못해 보내지 않았습니다.', 'Not sent: no contactable counterpart was found.'):row.status==='duplicate'?L('이미 처리된 선물입니다.', 'This gift was already processed.'):row.message;
  }catch(e){row.message=L('선물 전달 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다. 게임에서 자원을 확인하세요.', 'Could not confirm the gift delivery. It will not be resent automatically. Check your resources in the game.');logDiagnostic('warn','banquet.gift.uncertain',{error:String(e)});}
  let favorMsg='';
  if(row.status==='sent'){
   chronNote(session.idx,L(`만찬에서 ${GIFT_KO[o.res]} ${o.amt}을(를) 선물했다(게임 확인)`,`Gave ${o.amt} ${o.res.replace('_',' ')} as a gift at a banquet (confirmed in game)`));
   if(fav.favor){row.favor=true;gv.favorPaid=true;giftSave(session.key,gv);favorMsg=await settleConversationFavors('banquet-gift:'+session.key,session.sid,session.idx,1,session.epoch);}
   else favorMsg=fav.reason==='small'?L('100 미만이라 호의는 오르지 않았습니다.', 'Under 100, so favor did not increase.'):fav.reason==='not_short'?L('상대가 부족하지 않은 자원이라 감사 인사만 받았습니다.', 'They were not short of that resource, so you only got thanks.'):fav.reason==='already'?L('이 만찬의 선물 호의는 이미 받았습니다.', 'You already received the gift favor for this banquet.'):L('이 만찬의 호의 상한(5)에 이미 닿았습니다.', 'The favor cap (5) for this banquet has already been reached.');
  }
  giftSave(session.key,gv);if(row.status==='sent'||row.status==='uncertain'){giftOffer=null;giftCheck=null;}else if(row.status==='short')giftCheck={res:o.res,amt:o.amt,ok:false,note:L('창고에 이만큼 없습니다.', 'Not that much in the stockpile.')};
  logDiagnostic('info','banquet.gift',{sid:session.sid,idx:session.idx,res:o.res,amt:o.amt,status:row.status,favor:row.favor});
  return {ok:row.status==='sent',messages:[row.message,favorMsg].filter(Boolean),...(row.status==='sent'?{}:{error:row.message})};
 }catch(e){logDiagnostic('warn','banquet.gift.failed',{error:String(e)});return {ok:false,error:String(e)};}
 finally{giftBusy=false;pushChat();}
}
/** 표본을 줄 수 있는지 게임에 묻는다(보유·상대가 받을 수 있는지). 보내지는 않는다. */
async function checkSpec(key:string):Promise<void>{
 const info=banquet.info,session=active;if(!info||!session)return;
 specCheck={key,ok:null,note:L('게임에서 확인 중…', 'Checking in game…')};pushChat();
 if(info.demo){specCheck={key,ok:true,note:L('시연: 게임 확인을 생략했습니다.', 'Demo: game check skipped.')};pushChat();return;}
 try{
  if(ctx.curSaveId!==session.sid||link.epoch!==session.epoch)throw new Error(L('세이브가 바뀌었습니다.', 'The save has changed.'));
  const req=++link.reqCounter,cid=randomUUID().replace(/-/g,'');
  const m=await terminalRequest(specimenGiftCommand(req,session.sid,session.idx,cid,key,true),'SPECGIFT',req);
  if(specOffer?.key!==key)return;
  const st=m.kv.status as SpecGiftStatus;
  specCheck={key,ok:st==='ok',note:st==='ok'?L('보낼 수 있습니다.', 'Ready to send.'):st==='not_owned'?L('이 표본을 더 이상 갖고 있지 않습니다.', 'You no longer own this specimen.'):st==='cant_receive'?L('상대가 이미 가졌거나 받을 전시 자리가 없습니다.', 'They already have it or have no display slot for it.'):L('통신 가능한 상대를 찾지 못했습니다.', 'No contactable counterpart was found.')};
 }catch(e){specCheck={key,ok:false,note:L('게임에서 확인하지 못했습니다: ', 'Could not check in game: ')+String((e as Error).message||e)};}
 pushChat();
}
async function sendSpec(key:string):Promise<{ok:boolean;error?:string;messages?:string[]}>{
 const info=banquet.info,session=active,row0=SPEC_BY_KEY.get(key);
 if(!info||!session||anyBusy()||!row0)return {ok:false,error:L('만찬 창에서 진행 중인 요청을 확인하세요.', 'Check the pending request in the banquet window.')};
 const current=()=>banquet.info===info&&active===session&&(info.demo?settings.devMode:ctx.curSaveId===session.sid&&link.epoch===session.epoch&&ctx.govMem().currentBranch(session.sid)===session.branch);
 if(!current())return {ok:false,error:L('세이브 또는 시간선이 바뀌었습니다. 방문을 다시 열어 주세요.', 'The save or timeline has changed. Please reopen the visit.')};
 if(!info.demo&&!ctx.actionsAllowed(session.idx))return {ok:false,error:L('이 상대에게는 게임 행동을 보낼 수 없습니다(호환 설정).', 'Game actions cannot be sent to this empire (compatibility settings).')};
 specBusy=true;pushChat();
 try{
  const gv=giftVisit(session.key),specs=gv.specs??=[],lines=store().get(session.key),ended=lines.filter(l=>l.who==='player').length>=CONVERSATION_TURNS;
  const conv=conversationFavors(lines.filter(l=>l.who==='guest').map(l=>l.mood??0)),rarity=row0[2],asked=gv.ask?.status==='pending'&&gv.ask.key===key,reward=asked?askedReward(rarity):SPEC_REWARD[rarity];
  const favor=specimenFavor(rarity,(ended?(gv.settled??Math.min(MAX_CONVERSATION_FAVORS-paidOf(gv),conv)):0)+paidOf(gv),MAX_CONVERSATION_FAVORS,asked);
  const date=ctx.gameDate||info.date;
  if(info.demo){if(asked&&gv.ask)gv.ask.status='accepted';specs.push({key,rarity,status:'sent',favor:0,opinion:null,date,message:L('시연: 게임에 적용하지 않았습니다.', 'Demo: not applied to the game.')});giftSave(session.key,gv);specOffer=null;specCheck=null;return {ok:true,messages:[L('시연: 게임에 적용하지 않았습니다.', 'Demo: not applied to the game.')]};}
  const req=++link.reqCounter,cid=randomUUID().replace(/-/g,'');
  const row:SpecRow={key,rarity,status:'uncertain',favor:0,opinion:reward.opinion,date,req,cid,message:L('표본 전달 결과가 아직 확인되지 않았습니다. 자동 재전송하지 않습니다.', 'The specimen delivery result is not confirmed yet. It will not be resent automatically.')};
  specs.push(row);giftSave(session.key,gv); // 보내기 전에 기록(불확실하면 다시 보내지 않게)
  try{
   const m=await terminalRequest(specimenGiftCommand(req,session.sid,session.idx,cid,key,false,reward.opinion),'SPECGIFT',req);
   if(m.kv.cid!==cid||m.kv.sid!==session.sid||Number(m.kv.idx)!==session.idx||m.kv.k!==key)throw new Error(L('표본 선물 응답의 세이브·상대가 일치하지 않습니다.', 'The specimen gift reply\'s save or partner does not match.'));
   const st=m.kv.status;
   row.status=(['sent','give_failed','not_owned','cant_receive','no_target','duplicate'].includes(st)?st:'uncertain') as SpecRow['status'];
   row.message={sent:L('표본을 전달했습니다(게임 확인).', 'Specimen delivered (confirmed in game).'),give_failed:L('게임이 표본 전달을 받아들이지 않아 내 표본은 그대로 두었습니다.', 'The game did not accept the specimen transfer, so your specimen was kept.'),not_owned:L('이 표본을 더 이상 갖고 있지 않아 보내지 않았습니다.', 'Not sent: you no longer own this specimen.'),cant_receive:L('상대가 이미 가졌거나 받을 자리가 없어 보내지 않았습니다.', 'Not sent: they already have it or have no slot for it.'),no_target:L('통신 가능한 상대를 찾지 못해 보내지 않았습니다.', 'Not sent: no contactable counterpart was found.'),duplicate:L('이미 처리된 선물입니다.', 'This gift was already processed.'),uncertain:row.message}[row.status];
  }catch(e){row.message=L('표본 전달 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다. 게임에서 수집품을 확인하세요.', 'Could not confirm the specimen delivery. It will not be resent automatically. Check your collection in the game.');logDiagnostic('warn','banquet.specgift.uncertain',{error:String(e)});}
  if(row.status!=='sent')row.opinion=null;
  const msgs=[row.message];
  if(row.status==='sent'){
   dropArchiveItem(key);
   if(asked&&gv.ask){gv.ask.status='accepted';msgs.push(L('지도자가 먼저 요구한 표본이라 보상이 한 단계 높아졌습니다.', 'The leader asked for this specimen first, so the reward is one step higher.'));}
   chronNote(session.idx,L(`만찬에서 대보관소 표본 「${row0[3]}」(${rarity})을(를) 선물했다(게임 확인)`,`Gave the Grand Archive specimen "${row0[3]}" (${rarity}) as a gift at a banquet (confirmed in game)`));
   if(reward.opinion)msgs.push(reward.opinion==='large'?L('상대의 관계가 크게 올랐습니다.', 'Their opinion rose greatly.'):L('상대의 관계가 조금 올랐습니다.', 'Their opinion rose a little.'));
   if(favor>0){row.favor=favor;gv.specFavor=(gv.specFavor||0)+favor;giftSave(session.key,gv);msgs.push(await settleConversationFavors('banquet-spec:'+session.key+':'+cid,session.sid,session.idx,favor,session.epoch));}
   else msgs.push(L('이 만찬의 호의 상한(5)에 이미 닿아 호의는 오르지 않았습니다.', 'The favor cap (5) for this banquet was already reached, so favor did not increase.'));
  }
  giftSave(session.key,gv);
  if(row.status==='sent'||row.status==='uncertain'||row.status==='not_owned'){specOffer=null;specCheck=null;}else if(row.status==='cant_receive')specCheck={key,ok:false,note:L('상대가 이미 가졌거나 받을 전시 자리가 없습니다.', 'They already have it or have no display slot for it.')};
  logDiagnostic('info','banquet.specgift',{sid:session.sid,idx:session.idx,key,rarity,status:row.status,favor:row.favor,opinion:row.opinion});
  return {ok:row.status==='sent',messages:msgs.filter(Boolean),...(row.status==='sent'?{}:{error:row.message})};
 }catch(e){logDiagnostic('warn','banquet.specgift.failed',{error:String(e)});return {ok:false,error:String(e)};}
 finally{specBusy=false;pushChat();}
}
/** 지도자의 요구를 거절한다. 물질주의 지도자(일반·광신)만 신뢰 -30(게임이 시간이 지나며 회복), 그 밖에는 손해 없음. */
async function refuseAsk():Promise<{ok:boolean;error?:string;messages?:string[]}>{
 const info=banquet.info,session=active;
 if(!info||!session||anyBusy())return {ok:false,error:L('만찬 창에서 진행 중인 요청을 확인하세요.', 'Check the pending request in the banquet window.')};
 const gv=giftVisit(session.key),ask=gv.ask;
 if(!ask||ask.status!=='pending')return {ok:false,error:L('거절할 요구가 없습니다.', 'There is no request to refuse.')};
 const current=()=>banquet.info===info&&active===session&&(info.demo?settings.devMode:ctx.curSaveId===session.sid&&link.epoch===session.epoch&&ctx.govMem().currentBranch(session.sid)===session.branch);
 if(!current())return {ok:false,error:L('세이브 또는 시간선이 바뀌었습니다. 방문을 다시 열어 주세요.', 'The save or timeline has changed. Please reopen the visit.')};
 if(!info.demo&&!ctx.actionsAllowed(session.idx))return {ok:false,error:L('이 상대에게는 게임 행동을 보낼 수 없습니다(호환 설정).', 'Game actions cannot be sent to this empire (compatibility settings).')};
 specBusy=true;pushChat();
 const ko=SPEC_BY_KEY.get(ask.key)?.[3]||ask.key;
 try{
  if(info.demo){ask.status='refused';ask.trust='none';giftSave(session.key,gv);return {ok:true,messages:[L('시연: 게임에 적용하지 않았습니다.', 'Demo: not applied to the game.')]};}
  ask.status='refused';ask.trust='unknown';giftSave(session.key,gv); // 보내기 전에 기록(불확실하면 다시 보내지 않게)
  const req=++link.reqCounter,cid=randomUUID().replace(/-/g,'');let msg=L('요구를 거절했습니다. 신뢰도 변화는 확인하지 못했습니다(게임에서 확인하세요).', 'You refused the request. The trust change could not be confirmed (check in the game).');
  try{
   const m=await terminalRequest(specimenRefuseCommand(req,session.sid,session.idx,cid,ask.key),'SPECGIFT',req);
   if(m.kv.cid!==cid||m.kv.sid!==session.sid||Number(m.kv.idx)!==session.idx||m.kv.k!==ask.key||m.kv.mode!=='refuse')throw new Error(L('거절 응답의 세이브·상대가 일치하지 않습니다.', 'The refusal reply\'s save or partner does not match.'));
   const st=m.kv.status as SpecRefuseStatus;
   if(st==='trust_cut'){ask.trust='cut';msg=L('요구를 거절했습니다. 물질주의 지도자라 상대의 신뢰도가 30 떨어졌습니다(시간이 지나면 다시 쌓입니다).', 'You refused the request. As a materialist leader, their trust fell by 30 (it rebuilds over time).');}
   else if(st==='no_trust'){ask.trust='none';msg=L('요구를 거절했습니다. 이 지도자는 물질주의가 아니라 손해는 없습니다.', 'You refused the request. This leader is not materialist, so there is no penalty.');}
   else if(st==='duplicate'){ask.trust='unknown';msg=L('이미 처리된 거절입니다.', 'This refusal was already processed.');}
   else {ask.trust='unknown';msg=L('통신 가능한 상대를 찾지 못해 신뢰도에는 반영하지 못했습니다.', 'No contactable counterpart was found, so trust was not affected.');}
  }catch(e){logDiagnostic('warn','banquet.specask.refuse_uncertain',{error:String(e)});}
  giftSave(session.key,gv);
  chronNote(session.idx,L(`만찬에서 대보관소 표본 「${ko}」 요구를 거절했다`,`Refused a request for the Grand Archive specimen "${ko}" at a banquet`));
  logDiagnostic('info','banquet.specask.refused',{sid:session.sid,idx:session.idx,key:ask.key,trust:ask.trust});
  return {ok:true,messages:[msg]};
 }catch(e){logDiagnostic('warn','banquet.specask.refuse_failed',{error:String(e)});return {ok:false,error:String(e)};}
 finally{specBusy=false;if(specOffer?.key===ask.key){specOffer=null;specCheck=null;}pushChat();}
}
export function registerBanquet(){
 ipcMain.handle('banquetSpecSet',async(event,key:unknown)=>{ // 수집품 목록에서 표본을 고르면 확인 카드 + 게임 확인
  if(event.sender!==banquet.win?.webContents||!active)return {ok:false};
  const k=typeof key==='string'?key:'';
  if(!SPEC_BY_KEY.has(k))return {ok:false,error:L('알 수 없는 표본입니다.', 'Unknown specimen.')};
  if(!banquet.info?.demo&&!latestArchive()?.items.some(i=>i.key===k))return {ok:false,error:L('지금 보유 목록에 없는 표본입니다. 수집품을 다시 읽어 주세요.', 'This specimen is not in your current collection. Please reload the collection.')};
  specOffer={key:k};specCheck=null;pushChat();void checkSpec(k);return {ok:true};
 });
 ipcMain.handle('banquetSpecRefuse',async(event)=>{if(event.sender!==banquet.win?.webContents||!active)return {ok:false};return refuseAsk();});
 ipcMain.handle('banquetSpecCancel',async(event)=>{if(event.sender===banquet.win?.webContents){specOffer=null;specCheck=null;pushChat();}return {ok:true};});
 ipcMain.handle('banquetSpecSend',async(event)=>{
  if(event.sender!==banquet.win?.webContents||!specOffer)return {ok:false,error:L('보낼 표본이 없습니다.', 'There is no specimen to send.')};
  if(!banquet.info?.demo&&!(specCheck&&specCheck.ok&&specCheck.key===specOffer.key))return {ok:false,error:L('게임 확인이 끝난 뒤에 보낼 수 있습니다.', 'You can send it after the game check finishes.')};
  return sendSpec(specOffer.key);
 });
 ipcMain.handle('banquetGiftSet',async(event,res:unknown,amt:unknown)=>{ // 카드에서 자원·양을 고치거나 직접 열 때: 값 검증 후 창고 다시 확인
  if(event.sender!==banquet.win?.webContents||!active)return {ok:false};
  const r=giftRes(res),a=giftAmount(amt);if(!r||!a){giftOffer=null;giftCheck=null;pushChat();return {ok:false,error:L('자원과 1~100000 사이의 양을 입력하세요.', 'Enter a resource and an amount from 1 to 100000.')};}
  giftOffer={res:r,amt:a};giftCheck=null;pushChat();void checkGift(giftOffer);return {ok:true};
 });
 ipcMain.handle('banquetGiftCancel',async(event)=>{if(event.sender===banquet.win?.webContents){giftOffer=null;giftCheck=null;pushChat();}return {ok:true};});
 ipcMain.handle('banquetGiftSend',async(event)=>{
  if(event.sender!==banquet.win?.webContents||!giftOffer)return {ok:false,error:L('보낼 선물이 없습니다.', 'There is no gift to send.')};
  if(!banquet.info?.demo&&!(giftCheck&&giftCheck.ok&&giftCheck.res===giftOffer.res&&giftCheck.amt===giftOffer.amt))return {ok:false,error:L('창고 확인이 끝난 뒤에 보낼 수 있습니다.', 'You can send it after the stockpile check finishes.')};
  return sendGift(giftOffer);
 });
 ipcMain.handle('banquetState',async()=>banquet.info);
 ipcMain.handle('banquetClose',async()=>{banquet.win?.close();return true;});
 ipcMain.handle('devBanquet',async()=>{if(!settings.devMode)return {ok:false,error:L('개발자 모드에서 시험할 수 있습니다.', 'Available for testing in developer mode.')};active={key:'demo:banquet',sid:'',branch:0,idx:0,epoch:link.epoch};show(banquetDemo());return {ok:true,message:L('가상 만찬을 열었습니다. 발언을 보내면 실제 AI를 사용하며 게임에는 적용하지 않습니다.', 'Opened a test banquet. Speaking uses the real AI but nothing is applied to the game.')};});
 ipcMain.handle('banquetChatState',()=>chatView());
 ipcMain.handle('banquetSay',async(event,input:unknown)=>{
  const info=banquet.info,session=active;
  if(event.sender!==banquet.win?.webContents||!info||!session||anyBusy())return {ok:false,error:L('만찬 창에서 진행 중인 응답을 확인하세요.', 'Check the reply in progress in the banquet window.')};
  const text=typeof input==='string'?input.trim():'';if(!text||text.length>1600)return {ok:false,error:L('발언을 1~1600자로 입력하세요.', 'Enter 1–1600 characters.')};
  const current=()=>banquet.info===info&&active===session&&(info.demo?settings.devMode:ctx.curSaveId===session.sid&&link.epoch===session.epoch&&ctx.govMem().currentBranch(session.sid)===session.branch);
  if(!current())return {ok:false,error:L('세이브 또는 시간선이 바뀌었습니다. 방문을 다시 열어 주세요.', 'The save or timeline has changed. Please reopen the visit.')};
  const pr=ctx.profiles.get(session.idx)??ctx.mailCountries.get(session.idx)?.profile;
  if(!info.demo&&pr?.ruler&&pr.ruler!==info.guest.ruler)return {ok:false,error:L('초대한 지도자가 바뀌었습니다. 현재 방문을 확인하세요.', 'The invited leader has changed. Check the current visit.')};
  busy=true;pushChat();
  try{
   const history=store().get(session.key);
   if(history.filter(l=>l.who==='player').length>=CONVERSATION_TURNS)throw new Error(L('이 만찬의 10회 대화를 마쳤습니다.', 'All 10 exchanges of this banquet are used.'));
   const gv0=giftVisit(session.key),done=history.filter(l=>l.who==='player').length;
   const canAsk=!gv0.ask&&done>=2&&done<CONVERSATION_TURNS-1,owned=canAsk?ownedSpecs():[]; // 세 번째 발언부터, 마지막 회차 전까지 한 번만
   const askArg:BanquetAsk={state:gv0.ask?gv0.ask.status:'none',owned,...(gv0.ask?{ko:SPEC_BY_KEY.get(gv0.ask.key)?.[3]}:{})};
   const raw=await ctx.ai.chat(banquetMessages(info,ctx.profileWithEthics(pr,session.idx),history,text,giftVisit(session.key).gifts,(giftVisit(session.key).specs||[]).filter(g=>g.status==='sent'||g.status==='uncertain').map(g=>({ko:SPEC_BY_KEY.get(g.key)?.[3]||g.key,rarity:g.rarity,status:g.status})),askArg),{conversationId:`banquet:${session.key}`,purpose:'banquet-conversation',json:true,maxTokens:1800});
   const reply=parseReply(raw),offer=giftFromReply(raw);
   if(!current())throw new Error(L('만찬 또는 세이브가 바뀌어 응답을 반영하지 않았습니다.', 'The banquet or save changed, so the reply was not applied.'));
   const lines=store().append(session.key,text,reply.say.trim(),reply.mood);
   if(offer){giftOffer=offer;giftCheck=null;void checkGift(offer);}
   const askedKey=canAsk?askFromReply(raw,new Set(owned.map(o=>o.key))):null;
   if(askedKey){const g2=giftVisit(session.key);if(!g2.ask){g2.ask={key:askedKey,status:'pending',date:ctx.gameDate||info.date};try{giftSave(session.key,g2);}catch(e){logDiagnostic('warn','banquet.specask.save_failed',{error:String(e)});}}}
   if(lines.filter(l=>l.who==='player').length===CONVERSATION_TURNS){
    const gv=giftVisit(session.key),amount=settleAmount(conversationFavors(lines.filter(l=>l.who==='guest').map(l=>l.mood??0)),paidOf(gv),MAX_CONVERSATION_FAVORS);
    if(!info.demo){gv.settled=amount;try{giftSave(session.key,gv);}catch{/* 기록 실패해도 정산은 진행 */}}
    favorNote=info.demo?L('시연 대화 종료 · 호의는 게임에 지급하지 않았습니다.', 'Demo conversation ended · favor was not granted in the game.'):await settleConversationFavors('banquet:'+session.key,session.sid,session.idx,amount,session.epoch);
   }
   logDiagnostic('info','banquet.chat',{sid:session.sid,visitId:info.visitId,idx:session.idx,demo:info.demo});return {ok:true};
  }catch(e){logDiagnostic('warn','banquet.chat.failed',{error:String(e)});return {ok:false,error:String(e)};}
  finally{busy=false;pushChat();}
 });
}

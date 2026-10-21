import {app} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {randomUUID} from 'crypto';
import {favorsCommand} from '../conversation-favors';
import {terminalRequest,terminalReplies} from './terminal';
import {ctx} from '../app/ctx';
import {link} from '../app/game-link';
import {LogRouter,SLOT} from '../app/log-router';
import {chronNote} from './chronicle-app';
import {logDiagnostic} from '../diagnostics';
import { L } from '../i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)
const file=()=>path.join(app.getPath('userData'),'sllm_favor_grants.json');
interface FavorGrant { sid:string;idx:number;cid:string;req:number;requested:number;status:string;date:string;message:string;error?:string;gained?:number;before?:number;after?:number }
const read=():Record<string,any>=>{if(!fs.existsSync(file()))return {};const v=JSON.parse(fs.readFileSync(file(),'utf8'));if(v.version!==1||!v.grants||typeof v.grants!=='object'||Array.isArray(v.grants))throw new Error(L('호의 지급 기록을 읽지 못했습니다. 기존 파일을 보존했습니다.', 'Could not read the favor grant record. The existing file was kept.'));return v.grants;};
const write=(v:Record<string,any>)=>{const tmp=file()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,grants:v},null,2),'utf8');fs.renameSync(tmp,file());};
let settlements:Promise<unknown>=Promise.resolve();
export function registerConversationFavors(router:LogRouter):void{router.on(SLOT.FAVORS,'conversation:favors',m=>{if(m.kind==='FAVORS')terminalReplies.get('FAVORS:'+m.kv.req)?.(m);});router.on(SLOT.GIFT,'banquet:gift',m=>{if(m.kind==='GIFT'||m.kind==='SPECGIFT')terminalReplies.get(m.kind+':'+m.kv.req)?.(m);});}
export function settleConversationFavors(key:string,sid:string,idx:number,amount:number,epoch:number):Promise<string>{
 const next=settlements.then(()=>settle(key,sid,idx,amount,epoch));settlements=next.catch(()=>{});return next;
}
async function settle(key:string,sid:string,idx:number,amount:number,epoch:number):Promise<string>{
 if(amount<=0)return L('이번 대화에서 적립된 호의가 없습니다.', 'No favors were earned in this conversation.');
 if(ctx.curSaveId!==sid||link.epoch!==epoch||!ctx.actionsAllowed(idx))return L('게임 상태가 바뀌어 호의를 지급하지 않았습니다.', 'The game state changed, so no favors were granted.');
 try{
  const grants=read(),previous=grants[key];
  if(previous)return previous.message||L('이미 요청한 호의입니다. 중복 지급하지 않습니다.', 'These favors were already requested. They will not be granted twice.');
  const cid=randomUUID().replace(/-/g,''),req=++link.reqCounter;
  const command=favorsCommand(req,sid,idx,cid,amount);
  const record:FavorGrant=grants[key]={sid,idx,cid,req,requested:amount,status:'uncertain',date:ctx.gameDate,message:L('호의 지급 요청의 결과가 아직 확인되지 않았습니다. 자동 재전송하지 않습니다.', 'The result of the favor grant request is not confirmed yet. It will not be resent automatically.')};write(grants);
  try{
   const m=await terminalRequest(command,'FAVORS',req);
   if(ctx.curSaveId!==sid||link.epoch!==epoch||m.kv.sid!==sid||m.kv.cid!==cid||Number(m.kv.idx)!==idx)throw new Error(L('호의 응답의 세이브·상대가 일치하지 않습니다.', 'The favor reply\'s save or empire does not match.'));
   const before=Number(m.kv.before),after=Number(m.kv.after),gained=after-before;
   if(m.kv.status==='readback'&&Number.isSafeInteger(before)&&before>=0&&Number.isSafeInteger(after)&&gained>=0&&gained<=amount){
    Object.assign(record,{status:'confirmed',before,after,gained,message:gained?L(`호의 ${gained}개 획득 확인 (보유 ${before} → ${after}).`,`Confirmed ${gained} favor(s) gained (held ${before} → ${after}).`):L(`호의 추가 없음 (보유 ${after}, 게임 한도·조건 확인 필요).`,`No favors added (held ${after}; check the game's limits and conditions).`)});
    if(gained)chronNote(idx,L(`외교 대화가 잘 풀려 상대에게 행사할 호의 ${gained}개를 얻었다(게임 확인)`,`A diplomatic conversation went well and we gained ${gained} favor(s) with them (confirmed in game)`));
   }else if(m.kv.status==='no_target'){record.status='rejected';record.message=L('현재 통신 가능한 상대를 찾지 못해 호의를 지급하지 않았습니다.', 'No contactable counterpart was found, so no favor was granted.');}
   else record.message=L('호의 적용 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다.', 'Could not confirm whether the favor was applied. It will not be resent automatically.');
  }catch(e){record.message=L('호의 적용 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다.', 'Could not confirm whether the favor was applied. It will not be resent automatically.');record.error=String(e);}
  // Merge with the latest ledger so another completed entry is never discarded.
  const latest=read();latest[key]=record;write(latest);logDiagnostic('info','conversation.favors',{sid,idx,req,status:record.status,gained:record.gained});return record.message;
 }catch(e){logDiagnostic('warn','conversation.favors.failed',{error:String(e)});return L('호의 정산을 완료하지 못했습니다. 기록과 게임 상태를 확인하세요.', 'Could not finish settling favor. Check the record and the game state.');}
}

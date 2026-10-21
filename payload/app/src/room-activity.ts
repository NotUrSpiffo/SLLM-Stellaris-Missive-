import * as fs from 'fs';
import * as path from 'path';
import {createHash,randomUUID} from 'crypto';
import type {RoomActor} from './room-records';
export interface RoomActivity {kind?:'chat'|'shared-reading';author?:RoomActor;authorshipUnverified?:boolean;id:string;fingerprint:string;actor:RoomActor;secretaryId:string;room:string;subjectId:string;subjectTitle:string;question:string;reply:string;pose:string;name:string}
/** Append-only activity journal: original actor remains attached to every event. */
export class RoomActivities {
 constructor(private directory:string){}
 private file(sid:string){if(!sid || sid.length>200)throw Error('INVALID_SAVE');return path.join(this.directory,createHash('sha256').update(sid).digest('hex')+'.json');}
 read(sid:string):RoomActivity[]{
  let raw;try{raw=JSON.parse(fs.readFileSync(this.file(sid),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
  if(raw?.version!==1||raw.sid!==sid||!Array.isArray(raw.events))throw Error('INVALID_ACTIVITY_STORE');return raw.events;
 }
 append(event:RoomActivity){const events=this.read(event.actor.sid);if(events.some(x=>x.id===event.id))return;events.push(event);fs.mkdirSync(this.directory,{recursive:true});const file=this.file(event.actor.sid),temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify({version:1,sid:event.actor.sid,events}));fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
 relevant(actor:RoomActor,room:string,subjectId:string){
  return this.read(actor.sid).filter(x=>x.secretaryId==='primary'&&(subjectId?x.subjectId===subjectId:x.room===room&&x.actor.rulerId===actor.rulerId)).slice(-4).map(x=>({actor:x.actor,relation:x.actor.rulerId===actor.rulerId?'current-ruler':'other-ruler',room:x.room,subject:x.subjectTitle,kind:x.kind||'chat',author:x.author,authorshipUnverified:!!x.authorshipUnverified,summary:(x.kind==='shared-reading'?'The ruler explicitly shared these pages for reading together. Original author: '+(x.author?.rulerName||'Unknown'):('The ruler said: '+x.question+' Secretary replied: '+x.reply)).slice(0,600)}));
 }
}

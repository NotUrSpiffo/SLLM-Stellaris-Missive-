/** Campaign-scoped private writing. No game effects or browser storage. */
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import {parseRoomImport} from './room-import';
export type RoomKind = 'journal' | 'book';
export interface RoomActor { sid: string; rulerId: string; rulerName: string; date: string }
export interface RoomRecord { id: string; kind: RoomKind; revision: number; title: string; text: string; category: string; author: RoomActor; updated: RoomActor; imported?: {fileName:string; by:RoomActor; sourceId?:string; unverified:true}; aiSummary?:string; deleted?: boolean }
interface RoomDocument { version: 1; sid: string; revision: number; records: RoomRecord[] }
export class RoomRecords {
 constructor(private directory: string) {}
 private file(sid: string) { if(!sid || sid.length>200)throw Error('INVALID_SAVE');return path.join(this.directory,createHash('sha256').update(sid).digest('hex')+'.json'); }
 read(sid: string): RoomDocument {
  let d: RoomDocument;
  try { d=JSON.parse(fs.readFileSync(this.file(sid),'utf8')); } catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,sid,revision:0,records:[]};throw e; }
  if(d.version!==1 || d.sid!==sid || !Number.isSafeInteger(d.revision) || !Array.isArray(d.records) || d.records.length>2000)throw Error('INVALID_STORE');
  return d;
 }
 save(actor:RoomActor, input:unknown):RoomRecord {
  if(!actor.rulerId || !actor.rulerName || !actor.date)throw Error('UNKNOWN_AUTHOR');
  const q=input as Partial<RoomRecord>, d=this.read(actor.sid);
  const kind=q?.kind;if(kind!=='journal' && kind!=='book')throw Error('INVALID_RECORD');
  if(typeof q.title!=='string' || !q.title.trim() || q.title.length>160 || typeof q.text!=='string' || !q.text.trim() || q.text.length>(kind==='book'?50000:20000))throw Error('INVALID_RECORD');
  const old=q.id ? d.records.find(x=>x.id===q.id && !x.deleted) : undefined;
  if(q.id && (!old || old.revision!==q.revision || old.kind!==kind))throw Error('CONFLICT');
  if(!old && (d.records.length>=2000 || d.records.filter(x=>x.kind==='book'&&!x.deleted).length>=200 && kind==='book'))throw Error('FULL');
  // aiSummary: written by the player for books only (max 1,500 chars). Omitted = keep the stored/imported one; '' = remove it. Plain data, never instructions.
  if(q.aiSummary!==undefined&&(typeof q.aiSummary!=='string'||q.aiSummary.length>1500))throw Error('INVALID_RECORD');
  const summary=kind==='book'&&typeof q.aiSummary==='string'?q.aiSummary.trim():old?.aiSummary;
  const rec:RoomRecord={id:old?.id||randomUUID(),kind,revision:(old?.revision||0)+1,title:q.title.trim(),text:q.text,category:['lore','species','history','writing'].includes(q.category||'')?q.category!:'writing',author:old?.author||{...actor},updated:{...actor},...(old?.imported?{imported:old.imported}:{}),...(summary?{aiSummary:summary}:{})};
  if(old)d.records[d.records.indexOf(old)]=rec;else d.records.push(rec);
  this.write(d);return rec;
 }
 remove(sid:string,id:string,revision:number) {
  const d=this.read(sid),r=d.records.find(x=>x.id===id&&!x.deleted);if(!r || r.revision!==revision)throw Error('CONFLICT');
  r.deleted=true;r.revision++;this.write(d);
 }
 importCopies(actor:RoomActor,revision:number,kind:RoomKind,content:string,fileName:string){
  const copies=parseRoomImport(content,fileName,kind),d=this.read(actor.sid);if(d.revision!==revision)throw Error('CONFLICT');
  if(d.records.length+copies.length>2000||(kind==='book'&&d.records.filter(r=>r.kind==='book'&&!r.deleted).length+copies.filter(r=>!r.deleted).length>200))throw Error('FULL');
  const added=copies.map(q=>({id:randomUUID(),kind,revision:1,title:q.title,text:q.text,category:q.category,author:q.author,updated:{...actor},deleted:q.deleted,aiSummary:q.aiSummary,imported:{fileName,by:{...actor},sourceId:q.sourceId,unverified:true as const}}));
  d.records.push(...added);this.write(d);return added;
 }
 restore(actor:RoomActor,id:string,revision:number){
  const d=this.read(actor.sid),r=d.records.find(x=>x.id===id&&x.deleted);if(!r||r.revision!==revision)throw Error('CONFLICT');
  if(r.kind==='book'&&d.records.filter(x=>x.kind==='book'&&!x.deleted).length>=200)throw Error('FULL');
  r.deleted=false;r.revision++;r.updated={...actor};this.write(d);return r;
 }
 export(sid:string,kind:RoomKind,includeArchived:boolean){
  if(kind!=='book'&&kind!=='journal')throw Error('INVALID_RECORD');
  const d=this.read(sid);return JSON.stringify({format:'sllm-room-records',version:1,campaignId:sid,kind,records:d.records.filter(x=>x.kind===kind&&(includeArchived||!x.deleted))},null,2);
 }
 private write(d:RoomDocument) {
  fs.mkdirSync(this.directory,{recursive:true});const file=this.file(d.sid),temp=file+'.'+randomUUID()+'.tmp',lock=file+'.lock';let fd:number;try{fd=fs.openSync(lock,'wx');}catch{throw Error('CONFLICT');}
  try{if(this.read(d.sid).revision!==d.revision)throw Error('CONFLICT');d.revision++;fs.writeFileSync(temp,JSON.stringify(d),'utf8');fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.closeSync(fd);fs.unlinkSync(lock);}
 }
}

import * as fs from 'fs';
import * as path from 'path';
import {createHash,randomUUID} from 'crypto';
import {pathToFileURL} from 'url';
interface Track {id:string;name:string;ext:string}
const extensions=['.mp3','.wav','.ogg','.m4a','.flac','.aac','.webm'];
export class RoomMusic {
 constructor(private root:string){}
 private dir(sid:string){if(!sid||sid.length>200)throw Error('INVALID_SAVE');return path.join(this.root,createHash('sha256').update(sid).digest('hex'));}
 private read(sid:string):Track[]{try{const v=JSON.parse(fs.readFileSync(path.join(this.dir(sid),'tracks.json'),'utf8'));if(!Array.isArray(v)||v.length>20||v.some(t=>!t||!/^[a-f0-9-]{36}$/.test(t.id)||!extensions.includes(t.ext)||typeof t.name!=='string'))throw Error('INVALID_MUSIC_STORE');return v;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}}
 private write(sid:string,tracks:Track[]){const dir=this.dir(sid);fs.mkdirSync(dir,{recursive:true});const temp=path.join(dir,randomUUID()+'.tmp');try{fs.writeFileSync(temp,JSON.stringify(tracks),'utf8');fs.renameSync(temp,path.join(dir,'tracks.json'));}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
 prefs(sid:string){
  let p:any;try{p=JSON.parse(fs.readFileSync(path.join(this.dir(sid),'settings.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  return {selectedId:this.read(sid).some(t=>t.id===p?.selectedId)?p.selectedId:'',loop:p?.loop===true,autoplay:p?.autoplay===true,volume:typeof p?.volume==='number'&&Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)):.4};
 }
 configure(sid:string,input:any){
  const current=this.prefs(sid);if(!input||typeof input!=='object')throw Error('INVALID_AUDIO');
  const p={...current};
  if(input.selectedId!==undefined){if(input.selectedId!==''&&!this.read(sid).some(t=>t.id===input.selectedId))throw Error('UNKNOWN_TRACK');p.selectedId=input.selectedId;}
  for(const k of ['loop','autoplay'] as const)if(input[k]!==undefined){if(typeof input[k]!=='boolean')throw Error('INVALID_AUDIO');p[k]=input[k];}
  if(input.volume!==undefined){if(typeof input.volume!=='number'||!Number.isFinite(input.volume)||input.volume<0||input.volume>1)throw Error('INVALID_AUDIO');p.volume=input.volume;}
  const dir=this.dir(sid);fs.mkdirSync(dir,{recursive:true});const temp=path.join(dir,randomUUID()+'.tmp');try{fs.writeFileSync(temp,JSON.stringify(p));fs.renameSync(temp,path.join(dir,'settings.json'));}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}return p;
 }
 list(sid:string){return this.read(sid).map(t=>({...t,url:pathToFileURL(path.join(this.dir(sid),t.id+t.ext)).href}));}
 add(sid:string,file:string){const tracks=this.read(sid),ext=path.extname(file).toLowerCase(),stat=fs.statSync(file);if(tracks.length>=20)throw Error('MUSIC_FULL');if(!extensions.includes(ext)||!stat.isFile()||stat.size>50*1024*1024||!stat.size)throw Error('INVALID_AUDIO');
  const t={id:randomUUID(),ext,name:path.basename(file).slice(0,160)},dir=this.dir(sid);fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,t.id+t.ext);fs.copyFileSync(file,dest,fs.constants.COPYFILE_EXCL);
  try{this.write(sid,[...tracks,t]);}catch(e){fs.unlinkSync(dest);throw e;}return this.list(sid);
 }
 remove(sid:string,id:string){const tracks=this.read(sid),t=tracks.find(t=>t.id===id);if(!t)throw Error('UNKNOWN_TRACK');this.write(sid,tracks.filter(x=>x.id!==id));try{fs.unlinkSync(path.join(this.dir(sid),t.id+t.ext));}catch{}return this.list(sid);}
}

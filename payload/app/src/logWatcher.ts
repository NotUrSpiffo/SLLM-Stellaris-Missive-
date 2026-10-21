import * as fs from 'fs';
import { EventEmitter } from 'events';
import { StringDecoder } from 'string_decoder';
import { parseLogLine } from './protocol';
export class LogWatcher extends EventEmitter {
  private pos=0;private historyEnd=0;private identity='';private rest='';private restIsHistory=false;private decoder=new StringDecoder('utf8');private lastFailure='';private timer:ReturnType<typeof setInterval>|null=null;
  constructor(private path:string,private intervalMs=200,private fromStart=false){super();}
  status(){return {path:this.path,position:this.pos,running:!!this.timer,readError:this.lastFailure,historyEnd:this.historyEnd,replaying:this.pos<this.historyEnd};}
  private clearLine():void{this.rest='';this.restIsHistory=false;this.decoder=new StringDecoder('utf8');}
  setPath(next:string):void{if(next===this.path)return;const running=!!this.timer;this.stop();this.path=next;this.pos=this.historyEnd=0;this.identity='';this.clearLine();this.lastFailure='';if(running){this.emit('reset');this.start();}}
  start():void{
    if(this.timer)return;
    this.clearLine();let size=0;
    try{const stat=fs.statSync(this.path);size=stat.size;this.identity=`${stat.dev}:${stat.ino}`;}catch{this.identity='';}
    this.pos=this.fromStart?0:size;
    // Freeze startup EOF: appends while replaying a large file are still live.
    this.historyEnd=this.fromStart?size:0;
    this.emit('diagnostic',{event:'watcher.start',path:this.path,position:this.pos,fromStart:this.fromStart,historyEnd:this.historyEnd});
    this.timer=setInterval(()=>this.poll(),this.intervalMs);
  }
  stop():void{if(this.timer)clearInterval(this.timer);this.timer=null;}
  poll():void{
    let fd:number|undefined;
    try{
      fd=fs.openSync(this.path,'r');const stat=fs.fstatSync(fd),size=stat.size,identity=`${stat.dev}:${stat.ino}`;
      if(this.lastFailure){this.emit('diagnostic',{event:'watcher.recovered',path:this.path});this.lastFailure='';}
      if((this.identity&&identity!==this.identity)||size<this.pos||size<this.historyEnd){this.pos=this.historyEnd=0;this.clearLine();this.emit('diagnostic',{event:'watcher.truncated',path:this.path,size});this.emit('reset');}
      this.identity=identity;
      if(size===this.pos)return;
      const history=this.pos<this.historyEnd,end=history?Math.min(size,this.historyEnd):size;
      const buf=Buffer.alloc(Math.min(end-this.pos,2*1024*1024)),bytes=fs.readSync(fd,buf,0,buf.length,this.pos);this.pos+=bytes;
      const firstIsHistory=this.restIsHistory||history;
      const lines=(this.rest+this.decoder.write(buf.subarray(0,bytes))).split('\n');this.rest=lines.pop()??'';
      // Completing an old partial line must not turn it into a new game event.
      this.restIsHistory=lines.length?history:firstIsHistory;
      if(!this.rest&&bytes>0&&buf[bytes-1]===0x0a)this.restIsHistory=false;
      if(this.rest.length>1024*1024){this.emit('diagnostic',{event:'watcher.oversized_line',chars:this.rest.length});this.rest='';}
      for(let i=0;i<lines.length;i++){const msg=parseLogLine(lines[i]),source=(i===0?firstIsHistory:history)?'history':'message';if(msg)try{this.emit(source,msg);}catch(error){this.emit('diagnostic',{event:'watcher.handler_failed',source,kind:msg.kind,error:(error as Error).message,stack:(error as Error).stack});}}
      if(history&&this.pos===this.historyEnd)this.emit('diagnostic',{event:'watcher.history_complete',path:this.path,bytes:this.historyEnd});
    }catch(e){const error=(e as Error).message;if(error!==this.lastFailure){this.lastFailure=error;this.emit('diagnostic',{event:'watcher.read_failed',path:this.path,error});}}
    finally{if(fd!==undefined)try{fs.closeSync(fd);}catch{}}
  }
}

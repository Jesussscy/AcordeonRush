import type {AccordionAudio} from './recorded-accordion-audio.js';
import type {FingeringEvent} from './song-library';

export type MediaClock={time:()=>number;play:()=>Promise<void>|void;pause:()=>void;seek:(time:number)=>void;rate:(rate:number)=>void};
export class MusicalTransport{
 phase:'ready'|'playing'|'paused'|'buffering'|'finished'='ready';
 rate=1;rangeStart=0;rangeEnd=0;loop:{a:number;b:number}|null=null;latency=0;audioEnabled=true;
 private anchor=0;private offset=0;private cursor=0;private scheduled=new Set<string>();
 media:MediaClock|null=null;lateEvents=0;maxLateMs=0;
 constructor(public audio:AccordionAudio,public events:FingeringEvent[],public duration:number){this.rangeEnd=duration;}
 get clockPosition(){return this.media?this.media.time():this.offset+(this.audio.context.currentTime-this.anchor)*this.rate;}
 get position(){return this.phase==='playing'?Math.max(this.offset,this.clockPosition):this.offset;}
 get isCountingIn(){return this.phase==='playing'&&!this.media&&this.audio.context.currentTime<this.anchor;}
 get visualPosition(){if(this.phase!=='playing'||this.media)return this.position;const timestamp=this.audio.context.getOutputTimestamp?.();const presented=timestamp?.performanceTime&&typeof timestamp.contextTime==='number'&&Math.abs(this.audio.context.currentTime-timestamp.contextTime)<.3?timestamp.contextTime:this.audio.context.currentTime-(this.audio.context.baseLatency||0);return this.offset+(presented-this.anchor)*this.rate;}
 private reconstruct(){this.cursor=Math.max(0,this.events.findIndex(e=>e.end>this.offset));this.scheduled.clear();}
 async play(countIn=0){
  if(this.phase==='playing')return;if(this.phase==='finished')this.offset=this.rangeStart;
  this.audio.allNotesOff();this.reconstruct();this.anchor=this.audio.context.currentTime+.08+countIn;
  this.phase='playing';
  if(this.media){this.media.seek(this.offset);this.media.rate(this.rate);try{await this.media.play();}catch(error){this.phase='paused';throw error;}}
  this.pump();
 }
 pause(){if(this.phase==='playing'||this.phase==='buffering'){this.offset=Math.max(this.rangeStart,this.position);this.phase='paused';}this.media?.pause();this.audio.allNotesOff();}
 seek(position:number){const wasPlaying=this.phase==='playing';this.audio.allNotesOff();this.offset=Math.max(this.rangeStart,Math.min(this.rangeEnd,position));this.media?.seek(this.offset);this.anchor=this.audio.context.currentTime;this.reconstruct();if(this.phase==='finished')this.phase='paused';if(wasPlaying){this.phase='playing';this.pump();}}
 setRate(rate:number){const position=this.position;this.rate=rate;this.media?.rate(rate);this.seek(position);}
 setBuffering(value:boolean){if(value&&this.phase==='playing'){this.offset=this.position;this.phase='buffering';this.audio.allNotesOff();}else if(!value&&this.phase==='buffering'){this.offset=this.media?.time()??this.offset;this.anchor=this.audio.context.currentTime;this.reconstruct();this.phase='playing';}}
 setRange(start:number,end:number){this.pause();this.rangeStart=Math.max(0,start);this.rangeEnd=Math.min(this.duration,end);this.offset=this.rangeStart;this.reconstruct();this.phase='ready';}
 reset(){this.pause();this.offset=this.rangeStart;this.media?.seek(this.offset);this.reconstruct();this.phase='ready';this.lateEvents=0;this.maxLateMs=0;}
 pump(){
  if(this.phase!=='playing')return;const position=this.position;
  if(this.loop&&position>=this.loop.b){this.seek(this.loop.a);return;}
  if(position>=this.rangeEnd){this.offset=this.rangeEnd;this.phase='finished';this.audio.allNotesOff();this.media?.pause();return;}
  if(!this.audioEnabled)return;
  const clockPosition=this.clockPosition,horizon=clockPosition+.14*this.rate,now=this.audio.context.currentTime;
  for(;this.cursor<this.events.length;this.cursor++){
   const event=this.events[this.cursor],effectiveStart=Math.max(event.start,this.rangeStart,this.offset);if(effectiveStart>horizon)break;if(event.end<=position||event.start>=this.rangeEnd||this.scheduled.has(event.id))continue;
   const target=now+(effectiveStart-clockPosition)/this.rate+this.latency;
   const when=Math.max(now+.002,target),end=Math.min(event.end,this.rangeEnd),remaining=(end-Math.max(position,event.start,this.rangeStart,this.offset))/this.rate;
   if(remaining<=0)continue;
   if(target<now-.02&&event.start>=this.offset){this.lateEvents++;this.maxLateMs=Math.max(this.maxLateMs,(now-target)*1000);}
   this.audio.scheduleNote(event.button.bone,event.direction,when,remaining,event.velocity);this.scheduled.add(event.id);
  }
 }
}

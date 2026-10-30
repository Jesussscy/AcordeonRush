import type {FingeringEvent} from './song-library';
export function phraseGuide(events:FingeringEvent[],start:number,end:number,bpm:number){
 const span=480/bpm,phrases=[];
 for(let a=start;a<end-.01;a+=span){const b=Math.min(a+span,end),notes=events.filter(e=>e.role==='melody'&&e.start>=a&&e.start<b);if(notes.length)phrases.push({start:a,end:b,notes});}
 return phrases;
}

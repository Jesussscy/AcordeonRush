import { allButtons, tuningOptions, registrations } from './accordion-catalog';
import type { Song } from './songs';
export type Direction = 'push' | 'pull';
export const tunings = tuningOptions;
export const profiles = registrations;
export const buttons = allButtons.map(b=>({name:b.bone,short:`${b.bone.includes('Melody')?'M':'B'}${Number(b.bone.slice(-2))}`,melody:b.bone.includes('Melody'),row:b.row+1,push:b.push,pull:b.pull,key:b.label}));
export type Button = typeof buttons[number];
export {noteName} from './accordion-catalog';
export const rowColors = ['#e99b69','#8fbfac','#b0a0dd'];
export type ChartNote = { id: number; time: number; duration: number; button: Button; direction: Direction; midi: number; exact: boolean; section:string; chord:string; role:'melody' };
export function makeChart(song: Song, tuning: string, rows: number): ChartNote[] {
 const shift = tunings.find(t=>t.id===tuning)?.semitones ?? 0;
 const available = buttons.filter(b=>b.melody && b.row <= rows);
 let lastDirection: Direction = 'pull';
 const durationOfMeasure=60_000/song.bpm*4;
 return song.events.filter(e=>e.role==='melody').map((event,id)=>{
  const choices = available.flatMap(button=>(['push','pull'] as const).map(direction=>({button,direction,midi:button[direction][0]+shift})));
  choices.sort((a,b)=>(Math.abs(a.midi-event.note)*100+(a.direction===lastDirection?0:1)+Math.abs(Number(a.button.name.slice(-2))-15)*.01)-(Math.abs(b.midi-event.note)*100+(b.direction===lastDirection?0:1)+Math.abs(Number(b.button.name.slice(-2))-15)*.01));
  const choice=choices[0];lastDirection=choice.direction;
  const measure=Math.floor(event.time/durationOfMeasure),progression=song.progression??[];
  const total=progression.reduce((sum,step)=>sum+step.beats,0),position=(measure*4)%total;let cursor=0;const section=progression.find(step=>{cursor+=step.beats;return position<cursor;})?.chord??`Grado ${[0,3,4,0][measure%4]!+1}`;
  return {id,time:event.time+2500,duration:event.duration,...choice,exact:choice.midi===event.note,section,chord:section,role:'melody'};
 });
}
export type AccompanimentNote={time:number;duration:number;button:Button;direction:Direction;role:'bass'|'chord'};
export function makeAccompaniment(song:Song,tuning:string):AccompanimentNote[]{
 const shift=tunings.find(t=>t.id===tuning)?.semitones??0;
 return song.events.filter(e=>e.role==='bass'||e.role==='chord').map(event=>{
  const root=(event.role==='chord'?event.note-12:event.note),wanted=event.role==='chord'?[root%12,(root+(event.chordQuality==='minor'?3:4))%12,(root+7)%12]:[event.note%12];
  const choices=buttons.filter(button=>!button.melody).flatMap(button=>(['push','pull'] as const).map(direction=>{
   const notes=button[direction].map(n=>((n+shift)%12+12)%12),missing=wanted.filter(n=>!notes.includes(n)).length,extra=notes.filter(n=>!wanted.includes(n)).length;
   const octavePenalty=event.role==='bass'?Math.min(...button[direction].map(n=>Math.abs(n+shift-event.note))):0;
   return {button,direction,cost:missing*12+extra*2+octavePenalty*.01};
  })).sort((a,b)=>a.cost-b.cost);
  const choice=choices[0]!;
  return {time:event.time,duration:event.duration,button:choice.button,direction:choice.direction,role:event.role as 'bass'|'chord'};
 });
}

import {buttons,makeChart,type ChartNote} from './accordion-map';
import type {Song} from './songs';

// Physical positions are stable across keyboard languages and Shift punctuation.
const codes=['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','Quote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
export function keyboardButton(code:string){return buttons[codes.indexOf(code)];}
export function keyboardLabel(bone:string,layout='es'){
 const index=buttons.findIndex(b=>b.name===bone),code=codes[index];
 const punctuation:Record<string,string>=layout==='es'?{Semicolon:'Ñ',Quote:'´',Comma:',',Period:'.',Slash:'-',Minus:"'",Equal:'¡'}:{Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Minus:'-',Equal:'='};
 return punctuation[code]??code?.replace('Key','').replace('Digit','')??'';
}
export type Lesson=ChartNote;
export function lessonFor(song:Song,tuning:string,difficulty:string,section:string):Lesson[]{
 const measure=240000/song.bpm;
 const start=section==='second'?measure*4:0;
 const end=section==='full'?Infinity:section==='second'?measure*8:measure*4;
 const notes=makeChart(song,tuning,3).filter(n=>n.time-2500>=start&&n.time-2500<end);
 const selected=notes.filter((_,i)=>difficulty==='beginner'?i%2===0:true);
 // A single bellows direction must serve the whole instrument at each instant.
 return selected.map((n,id)=>({...n,id,time:n.time-2500-start+1800,duration:Math.min(n.duration,selected[id+1]?selected[id+1].time-n.time:n.duration)}));
}
export type Result='hit'|'miss';
export function releaseResult(now:number,end:number,tolerance=110):Result{return now>=end-tolerance?'hit':'miss';}
export const clockLabel=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;

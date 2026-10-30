import {allButtons,getTuning,noteName,type BellowsDirection,type InstrumentKey} from './accordion-catalog';
import {songs,type Song} from './songs';

export type MusicalEvent={id:string;start:number;end:number;pitches:number[];role:'melody'|'bass'|'chord';velocity:number};
export type FingeringEvent=MusicalEvent&{button:InstrumentKey;direction:BellowsDirection;adapted:boolean};
export type MusicalChart={version:1;title:string;status:'didactic'|'user-supplied';bpm:number;duration:number;tuning:string;events:MusicalEvent[];provenance:{kind:string;source:string;reviewer:string;notes:string};media?:{filename:string;sha256?:string;offset:number}};
export const songProfiles=songs.map((song,index)=>({song,tuning:['BEA','GCF','DGC','FBbEb','EAD'][index],recordingTuningVerified:false,referenceKeyVerified:false,
 referenceVersion:`${song.artist} · ${song.title}`,review:'No hay transcripción revisada de esta grabación en el proyecto.'}));
export function didacticChart(song:Song,tuning:string,difficulty='complete'):MusicalChart{
 const melody=song.events.filter(e=>e.role==='melody').filter((_,i)=>difficulty==='initial'?i%2===0:true);
 const events:MusicalEvent[]=melody.map((e,i)=>({id:`m-${i}`,start:e.time/1000,end:Math.min((e.time+e.duration)/1000,melody[i+1]?.time/1000||Infinity),pitches:[e.note],role:'melody',velocity:.88}));
 for(const [i,e] of song.events.filter(e=>e.role==='bass'||e.role==='chord').entries()){
  const root=e.role==='chord'?e.note-12:e.note;
  events.push({id:`b-${i}`,start:e.time/1000,end:(e.time+e.duration)/1000,pitches:e.role==='chord'?[root,root+(e.chordQuality==='minor'?3:4),root+7]:[root],role:e.role as 'bass'|'chord',velocity:.6});
 }
 events.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
 return {version:1,title:`${song.title} · arreglo didáctico`,status:'didactic',bpm:song.bpm,tuning,duration:Math.max(...events.map(e=>e.end)),events,
  provenance:{kind:'generated-practice-v2',source:'src/songs.ts · original teaching motifs generated for this application',reviewer:'Sin revisión de una transcripción comercial',notes:'Arreglo monofónico local. Ritmo y sostenidos revisados para la práctica; acompañamiento adaptado al mapa y al fuelle. No corresponde a las notas ni a los tiempos de la grabación comercial.'}};
}
const samePitchClasses=(a:number[],b:number[])=>[...new Set(a.map(n=>(n%12+12)%12))].sort().join(',')===[...new Set(b.map(n=>(n%12+12)%12))].sort().join(',');
export function fingerChart(chart:MusicalChart,tuning:string){
 const shift=getTuning(tuning).semitones,events:FingeringEvent[]=[],problems:string[]=[];
 let lastDirection:BellowsDirection='push',lastPosition=4;
 const melody=chart.events.filter(e=>e.role==='melody').flatMap(e=>e.pitches.map((pitch,index)=>({...e,id:e.pitches.length===1?e.id:`${e.id}-${index}`,pitches:[pitch]})));
 const starts=[...new Set(melody.map(e=>e.start))].sort((a,b)=>a-b);
 for(const time of starts){
  const group=melody.filter(e=>e.start===time),sustained=events.filter(e=>e.end>time+.001);
  const possibilities=(['push','pull'] as const).flatMap(direction=>{
   if(sustained.some(e=>e.direction!==direction))return [];
   const choices=group.map(event=>{
    const button=allButtons.filter(b=>!b.id.startsWith('bass')&&b[direction][0]+shift===event.pitches[0]).sort((a,b)=>Math.abs(a.position-lastPosition)-Math.abs(b.position-lastPosition))[0];
    return button?{...event,button,direction,adapted:false}:null;
   });
   if(choices.some(c=>c===null))return [];
   const valid=choices as FingeringEvent[];
   return [{choices:valid,cost:(direction===lastDirection?0:2)+valid.reduce((n,e)=>n+Math.abs(e.button.position-lastPosition)*.1,0)}];
  }).sort((a,b)=>a.cost-b.cost);
  const best=possibilities[0];
  if(!best){for(const e of group)problems.push(`${e.id}: ${e.pitches.map(n=>noteName(n)).join('+')} no disponible con una dirección común en ${getTuning(tuning).label}`);continue;}
  events.push(...best.choices);lastDirection=best.choices[0].direction;lastPosition=best.choices[0].button.position;
 }
 for(const event of chart.events.filter(e=>e.role!=='melody')){
  const preceding=events.filter(e=>e.role==='melody'&&e.start<=event.start).at(-1),direction=preceding?.direction??'push';
  const candidates=allButtons.filter(b=>b.id.startsWith('bass')&&b.chord===(event.role==='chord')).map(button=>({button,notes:button[direction].map(n=>n+shift)}));
  const exact=candidates.find(c=>c.notes.join(',')===event.pitches.join(','));
  const chosen=exact??(chart.status==='didactic'?candidates.filter(c=>samePitchClasses(c.notes,event.pitches)).sort((a,b)=>Math.abs(a.notes[0]-event.pitches[0])-Math.abs(b.notes[0]-event.pitches[0]))[0]:undefined);
  if(!chosen){problems.push(`${event.id}: acompañamiento no disponible con fuelle ${direction}`);continue;}
  const nextReversal=events.find(e=>e.role==='melody'&&e.start>event.start&&e.direction!==direction);
  const end=chart.status==='didactic'?Math.min(event.end,nextReversal?.start??Infinity):event.end;
  if(end-event.start>.025)events.push({...event,end,pitches:chosen.notes,button:chosen.button,direction,adapted:!exact||end!==event.end});
 }
 events.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
 // A faithful imported chart cannot contain contradictory global bellows directions.
 for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length&&events[j].start<events[i].end-.001;j++)if(events[i].direction!==events[j].direction)problems.push(`${events[i].id}/${events[j].id}: sentidos incompatibles durante notas simultáneas`);
 return {events,problems,complete:problems.length===0,adapted:events.filter(e=>e.adapted).length};
}
export function parseChart(text:string):MusicalChart{
 if(text.length>2_000_000)throw Error('El archivo supera 2 MB.');
 const data=JSON.parse(text) as MusicalChart;
 if(data.version!==1||typeof data.title!=='string'||data.title.length>160||!Array.isArray(data.events)||!data.events.length||data.events.length>20000)throw Error('Formato de partitura no válido. Usa la plantilla JSON.');
 if(!Number.isFinite(data.bpm)||data.bpm<20||data.bpm>300||!Number.isFinite(data.duration)||data.duration<=0||data.duration>3600)throw Error('BPM o duración inválidos.');
 getTuning(data.tuning);
 if(!data.provenance||typeof data.provenance.source!=='string'||!data.provenance.source.trim())throw Error('Indica la procedencia de las notas.');
 for(const field of ['kind','reviewer','notes'] as const)if(typeof data.provenance[field]!=='string'||data.provenance[field].length>4000)throw Error('Metadatos de procedencia inválidos.');
 const ids=new Set<string>();
 for(const e of data.events){if(typeof e.id!=='string'||ids.has(e.id)||!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end<=e.start||e.end>data.duration+.01||!['melody','bass','chord'].includes(e.role)||!Array.isArray(e.pitches)||e.pitches.length<1||e.pitches.length>4||!e.pitches.every(n=>Number.isInteger(n)&&n>=21&&n<=108)||!Number.isFinite(e.velocity)||e.velocity<0||e.velocity>1)throw Error(`Evento inválido: ${String(e.id)}`);ids.add(e.id);}
 if(data.media&&(!Number.isFinite(data.media.offset)||Math.abs(data.media.offset)>3600||typeof data.media.filename!=='string'))throw Error('Referencia de audio inválida.');
 data.status='user-supplied';data.events.sort((a,b)=>a.start-b.start);return data;
}
export function soundingAt(events:FingeringEvent[],time:number){return events.filter(e=>e.start<=time&&e.end>time);}
export function phraseOpening(events:FingeringEvent[],time:number){
 const melody=events.filter(e=>e.role==='melody');if(!melody.length)return .35;
 let amount=.55,anchor=melody[0].start,direction=melody[0].direction;
 const advance=(at:number)=>{const target=direction==='pull'?.84:.16;return target+(amount-target)*Math.exp(-Math.max(0,at-anchor)*1.1);};
 for(const e of melody){if(e.start>time)break;if(e.direction!==direction){amount=advance(e.start);anchor=e.start;direction=e.direction;}}
 return advance(time);
}

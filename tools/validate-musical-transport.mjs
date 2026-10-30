import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
async function module(file){const result=await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const library=await module('src/song-library.ts'),{MusicalTransport}=await module('src/musical-transport.ts'),music=await module('src/accordion-catalog.ts');
assert.equal(music.tuningFamilies.length,12);assert.equal(music.tuningOptions.length,24);
assert.equal(new Set(music.tuningFamilies.map(t=>(t.semitones%12+12)%12)).size,12);
assert.equal(music.noteName(60),'Do4');assert.equal(music.noteName(74),'Re5');assert.throws(()=>music.getTuning('invalid'));
const template=library.parseChart(fs.readFileSync('public/charts/chart-template.json','utf8'));
const mapped=library.fingerChart(template,'GCF');assert.equal(mapped.problems.length,0);assert.equal(mapped.events.length,3);
assert.throws(()=>library.parseChart(JSON.stringify({...template,provenance:{...template.provenance,reviewer:{bad:true}}})));
assert.throws(()=>library.parseChart(JSON.stringify({...template,events:[{...template.events[0],end:-1}]})));
const poly=library.fingerChart({...template,events:[{...template.events[0],pitches:[60,64]}]},'GCF');assert.equal(poly.events.length,2);assert.equal(new Set(poly.events.map(e=>e.direction)).size,1);
let time=0;const scheduled=[];let stops=0;
const engine={context:{get currentTime(){return time;}},allNotesOff(){stops++;},scheduleNote(...args){scheduled.push(args);}};
const transport=new MusicalTransport(engine,mapped.events,template.duration);
await transport.play();assert.equal(transport.position,0);assert(transport.isCountingIn);transport.pump();assert.equal(scheduled.length,1);assert(Math.abs(scheduled[0][2]-.08)<1e-9);
time=.25;transport.pause();const paused=transport.position;time=3;assert.equal(transport.position,paused);await transport.play();assert(transport.position<.3);
transport.seek(.85);assert.equal(transport.position,.85);assert(scheduled.at(-1)[3]<=.251,'Seek must reconstruct remaining sustain, not full duration');
transport.setRate(.5);time+=.4;assert(Math.abs(transport.position-1.05)<1e-9);
transport.loop={a:.5,b:1};transport.pump();assert(Math.abs(transport.position-.5)<1e-9);
transport.loop=null;transport.seek(3.99);time+=.1;transport.pump();assert.equal(transport.phase,'finished');assert.equal(transport.position,4);
transport.reset();assert.equal(transport.phase,'ready');assert.equal(transport.position,0);assert(stops>5);
// Simulate the complete local arrangements against the same canonical scheduler.
const songResults=[];
for(const profile of library.songProfiles){
 const chart=library.didacticChart(profile.song,profile.tuning),fingers=library.fingerChart(chart,profile.tuning);
 const melodyProblems=fingers.problems.filter(p=>p.startsWith('m-'));assert.equal(melodyProblems.length,0,profile.song.title);
 let now=0;const calls=[];const a={context:{get currentTime(){return now;}},allNotesOff(){},scheduleNote(...args){calls.push(args);}};
 const t=new MusicalTransport(a,fingers.events,chart.duration);await t.play();let maxError=0;
 for(now=0;now<chart.duration+.2;now+=.025){t.pump();}
 assert.equal(t.phase,'finished');assert.equal(calls.length,fingers.events.length);
 calls.forEach((call,i)=>{maxError=Math.max(maxError,Math.abs(call[2]-(.08+fingers.events[i].start))*1000);});assert(maxError<.01);
 // Measured-case consistency and deterministic bellows reconstruction.
 for(const e of fingers.events)assert.deepEqual(e.pitches,e.button[e.direction].map(n=>n+music.getTuning(profile.tuning).semitones));
 assert.equal(library.phraseOpening(fingers.events,17.6),library.phraseOpening(fingers.events,17.6));
 songResults.push({title:profile.song.title,tuning:profile.tuning,status:chart.status,events:fingers.events.length,omittedOrAdapted:fingers.problems.length,completeSchedulerSimulation:true,virtualScheduleMaxErrorMs:maxError});
}
fs.mkdirSync('artifacts/qa',{recursive:true});fs.writeFileSync('artifacts/qa/musical-transport-result.json',JSON.stringify({passed:true,method:'Deterministic simulated AudioContext clock, same production scheduler. Does not measure physical output latency or certify a commercial transcription.',cases:['pause/resume','seek into sustain','tempo preserving MIDI','A-B loop','finish','reset','polyphonic common bellows','24 unique tuning/register options','five complete local arrangements'],songs:songResults},null,2));
console.log('PASS: 24 tunings, polyphonic fingering, clock/seek/tempo/loop, and five complete local arrangement scheduling simulations.');

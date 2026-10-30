import fs from 'node:fs';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/accordion-catalog.ts'],bundle:true,platform:'node',format:'esm',write:false});
const music=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const manifest=JSON.parse(fs.readFileSync('public/instrument/manifest.json','utf8'));
const roots=manifest.regions.map(r=>r.root),low=Math.min(...roots),high=Math.max(...roots);
const options=music.tuningOptions.map(t=>({id:t.id,family:t.id.replace(/-low$/,''),label:t.label,solfege:t.solfege,semitones:t.semitones,register:t.low?'low':'standard',
 verification:t.id==='GCF'?'Manufacturer GCF melody pitch table; bass pitch classes with explicitly virtual octaves/voicing':'Virtual semitone/octave transposition of the GCF base; not a separately sampled or manufacturer-certified instrument',source:music.layoutSource.source,
 buttons:music.allButtons.map(b=>({id:b.id,bone:b.bone,role:b.chord?'chord':b.id.startsWith('bass')?'bass':'melody',
  ...Object.fromEntries(['push','pull'].map(dir=>[dir,b[dir].map(n=>{const midi=n+t.semitones,region=manifest.regions.find(r=>midi>=r.low&&midi<=r.high)??manifest.regions.reduce((a,b)=>Math.abs(a.root-midi)<Math.abs(b.root-midi)?a:b);return {midi,name:music.noteName(midi,t.flats),frequency:music.midiFrequency(midi),recording:region.file,recordedRoot:region.root,playbackSemitones:midi-region.root,tuneCents:region.tune,coverage:midi<low||midi>high?'outside-recorded-range':roots.includes(midi)?'sampled-root':'interpolated-between-recordings'};} )]))}))}));
const report={schema:1,consulted:'2026-10-29',concertPitch:440,middleC:60,baseSource:music.layoutSource,recordings:{source:manifest.source,license:manifest.license,range:[low,high],sustains:17,releases:17,processing:manifest.processing},families:music.tuningFamilies.length,publishedOptions:options.length,musicalCases:options.length*43*2,options};
fs.writeFileSync('public/instruments/tuning-audit.json',JSON.stringify(report,null,2));
console.log(`Built ${options.length} tuning options / ${report.musicalCases} button-direction cases. Aliases are not counted as extra families.`);

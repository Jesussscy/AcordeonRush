import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function moduleFrom(path){const result=await build({entryPoints:[path],bundle:true,platform:'node',write:false,format:'esm'});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const map=await moduleFrom('src/accordion-map.ts'),{songs}=await moduleFrom('src/songs.ts');
const manifest=JSON.parse(fs.readFileSync('public/instrument/manifest.json','utf8'));
const binary=fs.readFileSync('public/models/accordion.glb');assert.equal(binary.toString('utf8',0,4),'glTF');
const gltf=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)));
const bones=new Set(gltf.nodes.map(n=>n.name));
assert.equal(map.buttons.filter(b=>b.melody).length,31);assert.equal(map.buttons.filter(b=>!b.melody).length,12);
assert.equal(new Set(map.buttons.map(b=>b.key)).size,43);
assert(gltf.animations.some(a=>a.name==='Bellows_OpenClose'));
for(const b of map.buttons){assert(bones.has(b.name),b.name);assert.deepEqual(manifest.buttons[b.name].push,b.push);assert.deepEqual(manifest.buttons[b.name].pull,b.pull);}
let checked=0;
for(const tuning of map.tunings){assert.equal(manifest.tunings.find(t=>t.id===tuning.id).semitones,tuning.semitones);for(const song of songs)for(const rows of [1,2,3]){const chart=map.makeChart(song,tuning.id,rows);assert(chart.length>0);for(const n of chart){assert(n.button.row<=rows);assert.equal(n.midi,n.button[n.direction][0]+tuning.semitones);assert(bones.has(n.button.name));checked++;}}}
console.log(`Validated 43 bones, keyboard bindings, audio mappings, ${map.tunings.length} tunings, and ${checked} chart notes across 5 songs / 1-3 rows.`);

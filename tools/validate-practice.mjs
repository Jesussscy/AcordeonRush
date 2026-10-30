import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer} from 'three';
import {createButtonInteraction} from '../assets/blender/realistic/button-interaction.js';
async function source(file){const output=await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));}
const practice=await source('src/practice.ts'),catalog=await source('src/accordion-catalog.ts'),{songs}=await source('src/songs.ts');
const codes=['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash','Quote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'];
assert.equal(new Set(codes.map(code=>practice.keyboardButton(code).name)).size,43);
assert.equal(practice.keyboardButton('Enter'),undefined);
for(const layout of ['es','en'])assert.equal(new Set(codes.map(code=>practice.keyboardLabel(practice.keyboardButton(code).name,layout))).size,43);
assert.equal(practice.keyboardLabel('BTN_Melody_20','es'),'Ñ');assert.equal(practice.keyboardLabel('BTN_Melody_31','en'),"'");
assert.equal(practice.releaseResult(1800,2300),'miss');assert.equal(practice.releaseResult(2300,2300),'hit');assert.equal(practice.releaseResult(2200,2300),'hit');
let lessons=0;
for(const song of songs)for(const tuning of catalog.tuningOptions)for(const difficulty of ['beginner','normal'])for(const section of ['first','second','full']){
 const lesson=practice.lessonFor(song,tuning.id,difficulty,section);assert(lesson.length);assert(Math.abs(lesson[0].time-1800)<1e-6);for(let i=0;i<lesson.length;i++){const note=lesson[i];assert(note.duration>0);assert.equal(note.midi,note.button[note.direction][0]+tuning.semitones);if(lesson[i+1])assert(note.time+note.duration<=lesson[i+1].time+.001);}lessons++;
}
const modelResults=[];
for(const design of catalog.instrumentDesigns){
 const bytes=fs.readFileSync('public'+design.model.split('?')[0]),jsonSize=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonSize));
 // Remove only texture references for DOM-free GLTFLoader; retain actual geometry/rig/clips.
 for(const material of doc.materials){for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture;}}
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),tail=bytes.subarray(20+jsonSize),glb=Buffer.alloc(20+padded.length+tail.length);
 glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded.length,12);glb.writeUInt32LE(0x4e4f534a,16);padded.copy(glb,20);tail.copy(glb,20+padded.length);
 const gltf=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
 const interaction=createButtonInteraction(gltf),mixer=new AnimationMixer(gltf.scene);assert.equal(interaction.names.length,43);const clip=gltf.animations.find(c=>c.name==='Bellows_OpenClose');assert(clip);mixer.clipAction(clip).play();
 for(const name of interaction.names){const bone=gltf.scene.getObjectByName(name),rest=bone.position.clone();interaction.press(name);for(let i=0;i<30;i++){mixer.update(1/60);interaction.update(1/60);}assert(Math.abs(bone.position.distanceTo(rest)-.0018)<1e-6,`${design.id} ${name} travel`);interaction.release(name);for(let i=0;i<60;i++){mixer.update(1/60);interaction.update(1/60);}assert(bone.position.distanceTo(rest)<1e-7,`${design.id} ${name} release`);}
 modelResults.push({design:design.id,buttons:43,travel_m:.0018,bellowsClip:clip.duration,passed:true});
}
fs.mkdirSync('artifacts/qa',{recursive:true});fs.writeFileSync('artifacts/qa/practice-unit.json',JSON.stringify({passed:true,keyboardBindings:43,keyboardLayouts:['es','en'],lessons,models:modelResults},null,2));
console.log(`PASS: 43 physical keys, ES/EN labels, sustain clock, ${lessons} lesson variants, all 43 animated buttons across ${modelResults.length} real GLBs.`);

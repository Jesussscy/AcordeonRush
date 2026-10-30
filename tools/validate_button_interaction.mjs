import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer} from 'three';
import {createButtonInteraction} from '../assets/blender/realistic/button-interaction.js';
const output=new URL('../assets/blender/realistic/',import.meta.url);
const bytes=fs.readFileSync(new URL('AcordeonVallenato_Realista.glb',output));
const jsonSize=bytes.readUInt32LE(12);const doc=JSON.parse(bytes.subarray(20,20+jsonSize));
// Geometry/animation unit check needs no DOM. Textures are tested by the real browser.
for(const m of doc.materials){for(const k of ['normalTexture','occlusionTexture','emissiveTexture'])delete m[k];if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
const json=Buffer.from(JSON.stringify(doc));const padding=(4-json.length%4)%4;const padded=Buffer.concat([json,Buffer.alloc(padding,32)]);
const tail=bytes.subarray(20+jsonSize);const glb=Buffer.alloc(20+padded.length+tail.length);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded.length,12);glb.writeUInt32LE(0x4e4f534a,16);padded.copy(glb,20);tail.copy(glb,20+padded.length);
const gltf=await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'');
const buttons=createButtonInteraction(gltf);assert.equal(buttons.names.length,43);
const mixer=new AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Bellows_OpenClose')).play();
const results=[];
for(const name of buttons.names){
 const bone=gltf.scene.getObjectByName(name);const rest=bone.position.clone();
 buttons.press(name);
 for(let i=0;i<30;i++){mixer.update(1/60);buttons.update(1/60);}
 const distance=bone.position.distanceTo(rest);assert.ok(Math.abs(distance-.0018)<.000001,`${name} travel ${distance}`);
 // A held button must follow its moving case with the exact same local travel.
 const heldPosition=bone.position.clone();
 for(let i=0;i<60;i++){mixer.update(1/60);buttons.update(1/60);}
 assert.ok(bone.position.distanceTo(heldPosition)<.000001);
 buttons.release(name);
 for(let i=0;i<60;i++){mixer.update(1/60);buttons.update(1/60);}
 assert.ok(bone.position.distanceTo(rest)<.0000001,`${name} did not return`);
 results.push({bone:name,measured_travel_m:distance,returns_to_rest:true,holds_while_bellows_moves:true});
}
buttons.press('Bass_01');buttons.press('Melody_31');buttons.update(.1);buttons.releaseAll();for(let i=0;i<60;i++)buttons.update(1/60);
const report={method:'Three.js GLTFLoader parsed actual GLB geometry and clips, with image references removed for Node-only animation testing. Browser separately loads original textured GLB.',buttons_tested:results.length,results,passed:true};
fs.writeFileSync(new URL('button_interaction_qa.json',output),JSON.stringify(report,null,2));
console.log('PASS: all 43 buttons press, hold independently while bellows moves, and release to rest.');

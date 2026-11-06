import {AnimationMixer,Vector3,type AnimationClip} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

export type BellowsCurve={clip:AnimationClip;points:{time:number;span:number}[];min:number;max:number};
export function calibrateBellows(gltf:GLTF){
 const curves=new Map<string,BellowsCurve>(),mixer=new AnimationMixer(gltf.scene);
 const bass=gltf.scene.getObjectByName('CTRL_LADO_BAJO'),melody=gltf.scene.getObjectByName('CTRL_LADO_MELODIA');
 if(!bass||!melody)throw Error('Missing rigid-case controls');
 const a=new Vector3(),b=new Vector3();
 for(const clip of gltf.animations.filter(c=>!c.name.includes('Button'))){
  const action=mixer.clipAction(clip);action.play();action.paused=true;const points=[];
  for(let i=0;i<=90;i++){action.time=clip.duration*i/90;mixer.update(0);gltf.scene.updateMatrixWorld(true);bass.getWorldPosition(a);melody.getWorldPosition(b);points.push({time:action.time,span:a.distanceTo(b)});}
  curves.set(clip.name,{clip,points,min:Math.min(...points.map(p=>p.span)),max:Math.max(...points.map(p=>p.span))});action.stop();
 }
 mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);return curves;
}
// Find the first monotonic opening branch from measured case separation, not duration/2.
export function openingTime(curve:BellowsCurve,amount:number){
 const target=curve.min+(curve.max-curve.min)*Math.max(0,Math.min(1,amount));
 const firstMin=curve.points.findIndex(p=>Math.abs(p.span-curve.min)<1e-6);
 const branch=curve.points.slice(Math.max(0,firstMin));
 for(let i=1;i<branch.length;i++){const prev=branch[i-1],next=branch[i];if(next.span>=target&&prev.span<=target&&next.span>prev.span)return prev.time+(next.time-prev.time)*(target-prev.span)/(next.span-prev.span);}
 return curve.points.reduce((a,b)=>Math.abs(a.span-target)<Math.abs(b.span-target)?a:b).time;
}

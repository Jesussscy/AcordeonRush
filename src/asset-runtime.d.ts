declare module '*accordion-audio.js' {
 export type AccordionAudio={context:AudioContext;
 setPlayingMode(mode:'direct'|'manual'):void;setDirection(direction:'push'|'pull'):void;setExpression(value:number):void;
 scheduleNote(name:string,direction:'push'|'pull',when:number,duration:number,velocity?:number):void;
 getDiagnostics():{rms:number;peak:number;contextState:string;playingMode:string;direction:'push'|'pull';expression:number;error:string;notes:number[]};
 preload():Promise<void>;unlock():Promise<void>;noteOn(name:string):void;noteOff(name:string):void;setBellows(direction:'push'|'pull',pressure:number):void;setProfile(id:string):void;setTuning(id:string):void;setVolume(volume:number):void;allNotesOff():void;dispose():void;};
 export function createAccordionAudio(options:{context:AudioContext;baseURL:URL}):Promise<AccordionAudio>;
}
declare module '*button-interaction.js' {
 import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
 export function createButtonInteraction(gltf:GLTF):{names:string[];press(name:string):void;release(name:string):void;releaseAll():void;update(dt:number):void};
}

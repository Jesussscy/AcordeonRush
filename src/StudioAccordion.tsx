import { AccordionScene } from './AccordionScene';
import { allButtons } from './accordion-catalog';
import type { Direction } from './accordion-map';
import type { instrumentDesigns } from './accordion-catalog';
type Design=typeof instrumentDesigns[number];
type Props={active:Set<string>;air:boolean;direction:Direction;onPress:(name:string)=>void;onRelease:(name:string)=>void;reset:number;design:Design};
export function StudioAccordion(props:Props){
 return <div className="model-scene"><AccordionScene key={`${props.design.id}-${props.reset}`} model={props.design.model} image={props.design.image} name={props.design.name} activeKeys={new Set(allButtons.filter(b=>props.active.has(b.bone)).map(b=>b.id))} bellows={props.air} direction={props.direction} onPlay={id=>{const b=allButtons.find(b=>b.id===id);if(b)props.onPress(b.bone);}} onStop={id=>{const b=allButtons.find(b=>b.id===id);if(b)props.onRelease(b.bone);}}/></div>;
}

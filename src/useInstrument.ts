import {useCallback,useEffect,useRef,useState} from 'react';
import {allButtons,type BellowsDirection} from './accordion-catalog';
import {createAccordionAudio,type AccordionAudio} from './recorded-accordion-audio.js';

type Settings={tuning:string;registration:string;volume:number;expression:number};
const emptyMeter={rms:0,peak:0,contextState:'suspended',playingMode:'direct',direction:'push' as BellowsDirection,expression:.7,error:'',notes:[] as number[]};
export function useInstrument(settings:Settings){
 const settingsRef=useRef(settings);settingsRef.current=settings;
 const engine=useRef<AccordionAudio>(),loading=useRef<Promise<AccordionAudio>>(),context=useRef<AudioContext>(),alive=useRef(false);
 const held=useRef(new Map<string,string>()),directionRef=useRef<BellowsDirection>('push'),manualRef=useRef(false),manualAir=useRef(false);
 const [active,setActive]=useState(new Set<string>()),[direction,setDirection]=useState<BellowsDirection>('push'),[manual,setManual]=useState(false),[air,setAir]=useState(false);
 const [status,setStatus]=useState('Cargando grabaciones Hohner…'),[ready,setReady]=useState(false),[meter,setMeter]=useState(emptyMeter);
 const configure=useCallback((audio:AccordionAudio)=>{
  const s=settingsRef.current;
  audio.setTuning(s.tuning);audio.setProfile(s.registration);audio.setVolume(s.volume);audio.setExpression(s.expression);
  audio.setPlayingMode(manualRef.current?'manual':'direct');audio.setDirection(directionRef.current);
  if(manualRef.current)audio.setBellows(directionRef.current,manualAir.current?s.expression:0);
 },[]);
 const prepare=useCallback((unlock=true)=>{
  if(!loading.current){
   const audioContext=new AudioContext({latencyHint:'interactive'});context.current=audioContext;
   loading.current=createAccordionAudio({context:audioContext,baseURL:new URL('/instrument/',location.origin)}).then(async audio=>{
    try{await audio.preload();}catch(error){audio.dispose();throw error;}
    if(!alive.current||context.current!==audioContext){audio.dispose();throw Error('Audio initialization cancelled');}
    engine.current=audio;configure(audio);setReady(true);setStatus('Grabaciones listas · pulsa para tocar');
    for(const id of new Set(held.current.values()))audio.noteOn(allButtons.find(b=>b.id===id)!.bone);
    return audio;
   }).catch(error=>{if(alive.current&&context.current===audioContext){loading.current=undefined;setReady(false);setStatus('Error de audio · pulsa Activar sonido para reintentar');}throw error;});
  }
  // Resume must occur synchronously inside the trusted pointer/keyboard gesture.
  if(unlock&&context.current?.state==='suspended')void context.current.resume().catch(()=>{if(alive.current)setStatus('Pulsa Activar sonido para permitir el audio');});
  return loading.current.then(async audio=>{if(unlock)await audio.unlock();return audio;});
 },[configure]);
 const stopAll=useCallback(()=>{held.current.clear();engine.current?.allNotesOff();manualAir.current=false;if(manualRef.current)engine.current?.setBellows(directionRef.current,0);setActive(new Set());setAir(false);},[]);
 const chooseDirection=useCallback((next:BellowsDirection)=>{
  directionRef.current=next;setDirection(next);engine.current?.setDirection(next);
  if(manualRef.current)engine.current?.setBellows(next,manualAir.current?settingsRef.current.expression:0);
 },[]);
 const setManualMode=useCallback((next:boolean)=>{
  if(manualRef.current===next)return;stopAll();manualRef.current=next;setManual(next);engine.current?.setPlayingMode(next?'manual':'direct');
  if(next)engine.current?.setBellows(directionRef.current,0);
 },[stopAll]);
 const setManualBellows=useCallback((on:boolean,next=directionRef.current)=>{
  chooseDirection(next);manualAir.current=on;setAir(on||(!manualRef.current&&held.current.size>0));
  if(manualRef.current)engine.current?.setBellows(next,on?settingsRef.current.expression:0);
 },[chooseDirection]);
 const press=useCallback((id:string,source=id)=>{
  const button=allButtons.find(b=>b.id===id);if(!button||held.current.has(source))return false;
  const already=[...held.current.values()].includes(id);held.current.set(source,id);
  if(!already){setActive(a=>new Set(a).add(id));if(!manualRef.current)setAir(true);
   // No direction/air boolean is consulted to gate direct note playback.
   void prepare().then(audio=>{if([...held.current.values()].includes(id)){configure(audio);audio.noteOn(button.bone);}}).catch(()=>{held.current.delete(source);setActive(a=>{const next=new Set(a);next.delete(id);return next;});if(!held.current.size)setAir(false);});
  }
  return !already;
 },[prepare,configure]);
 const release=useCallback((source:string)=>{
  const id=held.current.get(source);if(!id)return undefined;held.current.delete(source);
  if([...held.current.values()].includes(id))return undefined;
  engine.current?.noteOff(allButtons.find(b=>b.id===id)!.bone);setActive(a=>{const next=new Set(a);next.delete(id);return next;});
  if(!held.current.size&&!manualRef.current)setAir(false);return id;
 },[]);
 useEffect(()=>{alive.current=true;void prepare(false).catch(()=>undefined);return()=>{alive.current=false;held.current.clear();engine.current?.dispose();engine.current=undefined;loading.current=undefined;const old=context.current;context.current=undefined;void old?.close().catch(()=>undefined);};},[prepare]);
 useEffect(()=>{if(engine.current)configure(engine.current);},[settings.tuning,settings.registration,settings.volume,settings.expression,configure]);
 useEffect(()=>{const timer=setInterval(()=>{if(engine.current){const value=engine.current.getDiagnostics();setMeter(value);if(value.error)setStatus(value.error);else setStatus(value.contextState==='running'?'Hohner grabado · audio activo':'Grabaciones listas · pulsa para activar');}},70);return()=>clearInterval(timer);},[]);
 return {engine,prepare,press,release,stopAll,chooseDirection,setManualMode,setManualBellows,active,direction,manual,air,ready,status,meter};
}
export type InstrumentController=ReturnType<typeof useInstrument>;

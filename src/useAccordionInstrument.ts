import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createAccordionAudio,type AccordionAudio} from './recorded-accordion-audio.js';
import {allButtons,type BellowsDirection} from './accordion-catalog';
type Config={tuning:string;registration:string;direction:BellowsDirection;pressure:number;volume:number;muted:boolean};
export function useAccordionInstrument(config:Config){
 const configRef=useRef(config);configRef.current=config;
 const engine=useRef<AccordionAudio|null>(null),pending=useRef<Promise<AccordionAudio>|null>(null),held=useRef(new Set<string>()),context=useRef<AudioContext|null>(null),mounted=useRef(true);
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const last=useRef({tuning:'',registration:''});
 const configure=useCallback((audio:AccordionAudio)=>{const c=configRef.current;if(last.current.tuning!==c.tuning){audio.setTuning(c.tuning);last.current.tuning=c.tuning;}if(last.current.registration!==c.registration){audio.setProfile(c.registration);last.current.registration=c.registration;}audio.setVolume(c.volume);audio.setBellows(c.direction,c.muted?0:c.pressure);},[]);
 useEffect(()=>{if(engine.current)configure(engine.current);},[config.tuning,config.registration,config.direction,config.pressure,config.volume,config.muted,configure]);
 const start=useCallback((id:string)=>{
  const key=allButtons.find(k=>k.id===id);if(!key)return;held.current.add(key.bone);
  if(engine.current){configure(engine.current);engine.current.noteOn(key.bone);void engine.current.unlock();return;}
  if(!pending.current){
   context.current??=new AudioContext();void context.current.resume();
   pending.current=createAccordionAudio({context:context.current,baseURL:new URL('/instrument/',window.location.origin)}).then(async audio=>{await audio.preload();if(!mounted.current){audio.dispose();throw Error('Unmounted');}engine.current=audio;configure(audio);for(const bone of held.current)audio.noteOn(bone);setReady(true);setError('');return audio;}).catch(err=>{pending.current=null;if(mounted.current)setError(`No se pudo cargar el sonido. Vuelve a tocar para reintentar. ${String(err)}`);throw err;});
   void pending.current.catch(()=>undefined);
  }
 },[configure]);
 const stop=useCallback((id:string)=>{const key=allButtons.find(k=>k.id===id);if(key){held.current.delete(key.bone);engine.current?.noteOff(key.bone);}},[]);
 const stopAll=useCallback(()=>{held.current.clear();engine.current?.allNotesOff();},[]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;held.current.clear();engine.current?.dispose();engine.current=null;void context.current?.close();};},[]);
 return useMemo(()=>({start,stop,stopAll,ready,error}),[start,stop,stopAll,ready,error]);
}

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
type Player = {playVideo():void;pauseVideo():void;seekTo(seconds:number,allow:boolean):void;getCurrentTime():number;getDuration?():number;getAvailablePlaybackRates?():number[];setVolume(n:number):void;setPlaybackRate?(rate:number):void;destroy():void};
type YTWindow = Window & {YT?:{ Player: new (el: HTMLElement, config: object)=>Player };onYouTubeIframeAPIReady?:()=>void};
let apiPromise: Promise<void>|undefined;
function loadAPI(){return apiPromise??=new Promise<void>((resolve,reject)=>{const w=window as YTWindow;if(w.YT?.Player){resolve();return;}const previous=w.onYouTubeIframeAPIReady;w.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>reject(new Error('YouTube unavailable'));document.head.append(script);}).catch(error=>{apiPromise=undefined;throw error;});}
export type TrackHandle = {play():void;pause():void;rewind():void;time():number;seek(seconds:number):void;duration():number;availableRates():number[];setPlaybackRate(rate:number):void};
export const OriginalTrack=forwardRef<TrackHandle,{id:string;volume:number;onReady:(ready:boolean)=>void;onError:()=>void;onPlaybackState?:(state:string)=>void}>(function OriginalTrack({id,volume,onReady,onError,onPlaybackState},ref){
 const host=useRef<HTMLDivElement>(null),player=useRef<Player>();const callbacks=useRef({onReady,onError,onPlaybackState});callbacks.current={onReady,onError,onPlaybackState};
 useImperativeHandle(ref,()=>({play:()=>player.current?.playVideo?.(),pause:()=>player.current?.pauseVideo?.(),rewind:()=>player.current?.seekTo?.(0,true),time:()=>player.current?.getCurrentTime?.()??0,seek:seconds=>player.current?.seekTo?.(Math.max(0,seconds),true),duration:()=>player.current?.getDuration?.()??0,availableRates:()=>player.current?.getAvailablePlaybackRates?.()??[1],setPlaybackRate:rate=>player.current?.setPlaybackRate?.(rate)}),[]);
 useEffect(()=>{let disposed=false,playerReady=false;callbacks.current.onReady(false);const timeout=window.setTimeout(()=>{if(!playerReady)callbacks.current.onError();},12000);const mount=document.createElement('div');host.current!.append(mount);void loadAPI().then(()=>{if(disposed)return;player.current=new (window as YTWindow).YT!.Player(mount,{width:'100%',height:'100%',videoId:id,playerVars:{playsinline:1,origin:location.origin,rel:0},events:{onReady:()=>{playerReady=true;clearTimeout(timeout);player.current?.setVolume?.(volume);callbacks.current.onReady(true);},onStateChange:(event:{data:number})=>callbacks.current.onPlaybackState?.(({1:'playing',2:'paused',3:'buffering',0:'finished','-1':'ready'} as Record<number,string>)[event.data]??'ready'),onError:()=>callbacks.current.onError()}});}).catch(()=>{if(!disposed)callbacks.current.onError();});return()=>{disposed=true;clearTimeout(timeout);player.current?.destroy?.();player.current=undefined;host.current?.replaceChildren();};},[id]);
 useEffect(()=>{player.current?.setVolume?.(volume);},[volume]);
 return <div className="original-video" ref={host}/>;
});




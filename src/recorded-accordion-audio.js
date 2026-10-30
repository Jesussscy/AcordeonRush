/** Real sampled Hohner playback. Direction selects notes; pressure controls expression. */
export async function createAccordionAudio({context,baseURL=new URL('/instrument/',globalThis.location?.origin??'http://localhost'),manifest}={}) {
 context??=new AudioContext();
 const base=new URL(baseURL,import.meta.url);if(!base.pathname.endsWith('/'))base.pathname+='/';
 manifest??=await fetch(new URL('manifest.json',base)).then(r=>{if(!r.ok)throw Error('Audio manifest unavailable');return r.json();});
 const sampleBase=new URL(manifest.sampleDirectory??'button-accordion-hn/',base);
 const decoded=new Map(),pending=new Map(),held=new Map(),voices=new Set();
 const master=context.createGain(),expression=context.createGain(),limiter=context.createDynamicsCompressor(),analyser=context.createAnalyser(),body=context.createBiquadFilter(),brightness=context.createBiquadFilter();analyser.fftSize=8192;const waveform=new Float32Array(analyser.fftSize);
 const parts=Object.fromEntries(['melody','bass','chord'].map(id=>[id,context.createGain()]));for(const bus of Object.values(parts))bus.connect(body);
 body.type='lowshelf';body.frequency.value=240;body.gain.value=0;brightness.type='lowpass';brightness.frequency.value=Math.min(20000,context.sampleRate*.45);brightness.Q.value=.45;body.connect(brightness);brightness.connect(master);
 master.gain.value=.55;expression.gain.value=0;
 limiter.threshold.value=-3;limiter.knee.value=6;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.18;
 master.connect(expression);expression.connect(limiter);limiter.connect(analyser);analyser.connect(context.destination);
 let profile=manifest.profiles[0],tuning=0,tuningId='',direction='push',pressure=0,disposed=false,playingMode='manual',expressionLevel=.7,lastError='',releaseTime=.018,reedWidth=.55;
 const effectivePressure=()=>playingMode==='direct'?expressionLevel:pressure;
 const updateReedResponse=()=>{for(const voice of voices)if(voice.dynamicFilter)voice.filter.frequency.setTargetAtTime(voice.cutoff*(.42+.58*Math.sqrt(effectivePressure())),context.currentTime,.025);};
 const applyExpression=()=>{expression.gain.setTargetAtTime(effectivePressure(),context.currentTime,.012);updateReedResponse();};
 const reedPlan=(notes,part)=>{
  if(profile.id!=='vallenato')return profile.ranks;
  if(part==='bass')return [{semitones:0,cents:0,gain:.64},{semitones:12,cents:0,gain:.28},{semitones:24,cents:0,gain:.08}];
  if(part==='chord')return [{semitones:0,cents:0,gain:1}];
  if(reedWidth<.001)return [{semitones:0,cents:0,gain:1}];
  // A controlled frequency spread avoids the excessive fast beating of fixed cents at high pitches.
  const f=440*2**((notes[0]+tuning-69)/12),beat=(1.2+1.5*Math.sqrt(f/440))*reedWidth;
  return [{semitones:0,cents:0,gain:.54,pan:0,offset:0},{semitones:0,cents:1200*Math.log2(Math.max(.95,1-beat/f)),gain:.23,pan:-.12,offset:.0015},{semitones:0,cents:1200*Math.log2(1+beat/f),gain:.23,pan:.12,offset:.003}];
 };
 async function load(file){
  if(decoded.has(file))return decoded.get(file);
  const url=new URL(file.split('/').map(encodeURIComponent).join('/'),sampleBase);url.searchParams.set('v',manifest.audioRevision??'original');
  if(!pending.has(file))pending.set(file,fetch(url).then(r=>{if(!r.ok)throw Error(`Missing recording ${file}`);return r.arrayBuffer();}).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{decoded.set(file,buffer);return buffer;}).catch(error=>{pending.delete(file);throw error;}));
  return pending.get(file);
 }
 const regionFor=pitch=>manifest.regions.find(r=>pitch>=r.low&&pitch<=r.high)??manifest.regions.reduce((a,b)=>Math.abs(a.root-pitch)<Math.abs(b.root-pitch)?a:b);
 function rank(midi,registration,{release=false,level=1,when=context.currentTime,duration,part='melody'}={}){
  const natural=profile.id==='natural',dynamicFilter=profile.id==='vallenato',cutoff=dynamicFilter?(part==='bass'?3800:part==='chord'?6500:12500):profile.cutoff;
  const pitch=midi+tuning+registration.semitones,region=regionFor(pitch),file=release?region.releaseFile:region.file;
  const voice={cancelled:false,source:null,gain:null,filter:null,panner:null,dynamicFilter,cutoff,midi:pitch,startsAt:when,endsAt:duration===undefined?Infinity:when+duration};voices.add(voice);
  const play=buffer=>{
   if(voice.cancelled||disposed){voices.delete(voice);return;}
   const source=context.createBufferSource(),gain=context.createGain();voice.source=source;voice.gain=gain;
   source.buffer=buffer;source.loop=!release;
   if(!release){source.loopStart=region.loopStart;source.loopEnd=Math.min(region.loopEnd,buffer.duration-1/buffer.sampleRate);}
   source.playbackRate.value=2**((pitch-region.root)/12);source.detune.value=(release?region.releaseTune:region.tune)+registration.cents;
   const at=Math.max(when,context.currentTime),amplitude=registration.gain*level*(release?.065:1)*(dynamicFilter?(region.performanceGain??1):1);
   const attack=dynamicFilter?(part==='bass'?.014:.007):.003;
   gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(amplitude,at+attack);
   // Keep the recorded attack and sustain dynamics instead of adding an artificial decay.
   // Keep the recorded stereo reeds intact in Natural, including on closed bellows.
   if(natural){source.connect(gain);}else{const filter=context.createBiquadFilter();voice.filter=filter;filter.type='lowpass';filter.frequency.value=cutoff*(dynamicFilter?.42+.58*Math.sqrt(effectivePressure()):1);filter.Q.value=.35;source.connect(filter);filter.connect(gain);}
   if(dynamicFilter){const panner=context.createStereoPanner();voice.panner=panner;panner.pan.value=part==='melody'?(registration.pan??0):-.12;gain.connect(panner);panner.connect(parts[part]);}else gain.connect(parts[part]);source.onended=()=>{source.disconnect();voice.filter?.disconnect();voice.panner?.disconnect();gain.disconnect();voices.delete(voice);};
   source.start(at,release?Math.min(region.releaseOffset,buffer.duration-.001):.0012+(registration.offset??0));
   if(duration!==undefined){gain.gain.setTargetAtTime(0,at+duration,releaseTime);source.stop(at+duration+releaseTime*7);}
   if(release)source.stop(at+Math.min(.35,(buffer.duration-Math.min(region.releaseOffset,buffer.duration-.001))/source.playbackRate.value));
  };
  if(decoded.has(file))play(decoded.get(file));else void load(file).then(play).catch(error=>{lastError=String(error);voices.delete(voice);});
  voice.stop=(fast=false)=>{if(voice.cancelled)return;voice.cancelled=true;if(voice.source){const at=context.currentTime;voice.gain.gain.cancelAndHoldAtTime(at);voice.gain.gain.setTargetAtTime(0,at,fast?.006:releaseTime);voice.source.stop(at+(fast?.05:releaseTime*7));}else voices.delete(voice);};
  return voice;
 }
 function start(state){
  if((playingMode==='manual'&&pressure<=.005)||disposed)return;
  const notes=state.mapping[direction];state.notes=notes;state.part=state.bass?(notes.length>1?'chord':'bass'):'melody';state.ranks=reedPlan(notes,state.part);
  state.level=state.bass?(notes.length>1?.34:.65):.9;
  state.voices=notes.flatMap(midi=>state.ranks.map(r=>rank(midi,r,{level:state.level,part:state.part})));
 }
 function stop(state,tail=false){for(const voice of state.voices??[])voice.stop();if(tail&&(playingMode==='direct'||pressure>.005))for(const midi of state.notes??[])for(const r of state.ranks??[])rank(midi,r,{release:true,level:state.level,part:state.part});state.voices=[];}
 function restart(){for(const state of held.values()){stop(state);start(state);}}
 const api={
  context,manifest,
  setPlayingMode(mode){if(!['direct','manual'].includes(mode))throw Error('Invalid playing mode');if(playingMode===mode)return;playingMode=mode;applyExpression();restart();},
  setDirection(next){if(!['push','pull'].includes(next))throw Error('Invalid direction');if(direction===next)return;direction=next;restart();},
  setExpression(value){expressionLevel=Math.max(0,Math.min(1,value));applyExpression();},
  getDiagnostics(){analyser.getFloatTimeDomainData(waveform);let sum=0,peak=0;for(const n of waveform){sum+=n*n;peak=Math.max(peak,Math.abs(n));}return {rms:Math.sqrt(sum/waveform.length),peak,contextState:context.state,playingMode,direction,expression:playingMode==='direct'?expressionLevel:pressure,error:lastError,notes:[...new Set([...voices].filter(v=>!v.cancelled&&context.currentTime>=v.startsAt&&context.currentTime<v.endsAt).map(v=>v.midi))]};},
  scheduleNote(name,dir,when,duration,velocity=1){const key=name.startsWith('BTN_')?name:'BTN_'+name,mapping=manifest.buttons[key];if(!mapping||!['push','pull'].includes(dir)||!Number.isFinite(when)||!(duration>0))throw Error('Invalid scheduled note');const notes=mapping[dir],bass=key.includes('Bass'),part=bass?(notes.length>1?'chord':'bass'):'melody',level=(bass?(notes.length>1?.34:.65):.9)*velocity;for(const midi of notes)for(const r of reedPlan(notes,part))rank(midi,r,{level,when,duration,part});},
  setReedWidth(value){const next=Math.max(0,Math.min(1,value));if(Math.abs(reedWidth-next)<.0001)return;reedWidth=next;if(profile.id==='vallenato')restart();},
  setSound({brightness:bright=1,body:bodyDb=0,melody=1,bass=1,chord=1,release=.018}={}){const at=context.currentTime;brightness.frequency.setTargetAtTime(Math.min(context.sampleRate*.45,2500*8**Math.max(0,Math.min(1,bright))),at,.025);body.gain.setTargetAtTime(Math.max(-6,Math.min(6,bodyDb)),at,.025);for(const [id,level] of Object.entries({melody,bass,chord}))parts[id].gain.setTargetAtTime(Math.max(0,Math.min(1,level)),at,.012);releaseTime=Math.max(.008,Math.min(.06,release));},
  async preload(){await Promise.all(manifest.regions.flatMap(r=>[load(r.file),load(r.releaseFile)]));},
  async unlock(){if(context.state==='suspended'&&typeof context.startRendering!=='function')await context.resume();},
  noteOn(name){if(disposed)throw Error('Audio controller disposed');const key=name.startsWith('BTN_')?name:'BTN_'+name;if(held.has(key))return;const mapping=manifest.buttons[key];if(!mapping)throw Error(`Unknown button ${name}`);const state={mapping,bass:key.includes('Bass'),voices:[]};held.set(key,state);start(state);},
  noteOff(name){const key=name.startsWith('BTN_')?name:'BTN_'+name,state=held.get(key);if(state){stop(state,true);held.delete(key);}},
  setBellows(nextDirection,nextPressure){if(!['push','pull'].includes(nextDirection))throw Error('Direction must be push or pull');const previous=pressure,changed=direction!==nextDirection;pressure=Math.max(0,Math.min(1,nextPressure));direction=nextDirection;applyExpression();if(changed||(previous<=.005&&pressure>.005)||(previous>.005&&pressure<=.005))restart();},
  setProfile(id){const next=manifest.profiles.find(p=>p.id===id);if(!next)throw Error('Unknown registration');if(profile.id===id)return;profile=next;restart();},
  setTuning(id){const next=manifest.tunings.find(t=>t.id===id);if(!next)throw Error('Unknown tuning');if(tuningId===id)return;tuningId=id;tuning=next.semitones;restart();},
  setVolume(value){master.gain.setTargetAtTime(.55*Math.max(0,Math.min(1,value)),context.currentTime,.02);},
  allNotesOff(){for(const state of held.values())stop(state);held.clear();for(const voice of voices)voice.stop(true);},
  dispose(){api.allNotesOff();disposed=true;for(const bus of Object.values(parts))bus.disconnect();body.disconnect();brightness.disconnect();master.disconnect();expression.disconnect();limiter.disconnect();analyser.disconnect();},
 };
 return api;
}

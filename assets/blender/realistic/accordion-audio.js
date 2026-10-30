/** Sampled, pressure-gated audio companion to the GLB. No external runtime library. */
export async function createAccordionAudio({context,baseURL=new URL('./audio/',import.meta.url),manifest}={}) {
  context ??= new AudioContext();
  const base=new URL(baseURL,import.meta.url);
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  manifest ??= await fetch(new URL('manifest.json',base)).then(r=>{if(!r.ok)throw Error('Audio manifest unavailable');return r.json();});
  const samples=new Map(),held=new Map();
  const volume=context.createGain(),pressureGain=context.createGain(),limiter=context.createDynamicsCompressor();
  volume.gain.value=.28;pressureGain.gain.value=0;limiter.threshold.value=-10;limiter.knee.value=5;limiter.ratio.value=12;
  volume.connect(pressureGain);pressureGain.connect(limiter);limiter.connect(context.destination);
  let profile=manifest.profiles[0],tuning=0,direction='pull',pressure=0,disposed=false;
  async function load(file){
    if(!samples.has(file))samples.set(file,fetch(new URL('button-accordion-hn/'+file.split('/').map(encodeURIComponent).join('/'),base)).then(r=>{if(!r.ok)throw Error(`Missing sample ${file}`);return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).catch(error=>{throw Error(`Sample ${file}: ${error}`);}));
    return samples.get(file);
  }
  function regionFor(midi){return manifest.regions.find(r=>midi>=r.low&&midi<=r.high)??manifest.regions.reduce((a,b)=>Math.abs(a.root-midi)<Math.abs(b.root-midi)?a:b);}
  function rank(midi,registration,release=false,when=context.currentTime){
    const pitch=midi+tuning+registration.semitones,region=regionFor(pitch);
    const file=release?region.releaseFile:region.file;
    const voice={cancelled:false,source:null,gain:null};
    load(file).then(buffer=>{
      if(voice.cancelled||disposed)return;
      const source=context.createBufferSource(),gain=context.createGain(),filter=context.createBiquadFilter();
      source.buffer=buffer;source.loop=!release;
      if(!release){source.loopStart=region.loopStart;source.loopEnd=Math.min(region.loopEnd,buffer.duration-.00001);}
      source.playbackRate.value=2**((pitch-region.root)/12);source.detune.value=(release?region.releaseTune:region.tune)+registration.cents;
      filter.type='lowpass';filter.frequency.value=profile.cutoff*(direction==='pull'?1:.92);filter.Q.value=.35;
      const at=Math.max(when,context.currentTime),level=registration.gain*(release?.11:1);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+(release?.008:.025));
      source.connect(filter);filter.connect(gain);gain.connect(volume);
      voice.source=source;voice.gain=gain;
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      source.start(at,release?Math.min(region.releaseOffset,buffer.duration-.001):.0012);
      if(release)source.stop(at+Math.min(1.0,buffer.duration/Math.max(.25,source.playbackRate.value)));
    });
    voice.stop=()=>{if(voice.cancelled)return;voice.cancelled=true;if(voice.source){const at=context.currentTime;voice.gain.gain.cancelScheduledValues(at);voice.gain.gain.setTargetAtTime(0,at,.025);voice.source.stop(at+.18);}};
    return voice;
  }
  function start(state){if(pressure<=.005||disposed)return;const notes=state.mapping[direction];state.notes=notes;state.ranks=profile.ranks;state.voices=notes.flatMap(midi=>profile.ranks.map(r=>rank(midi,r)));}
  function stop(state,tail){for(const voice of state.voices??[])voice.stop();if(tail&&pressure>.005)for(const midi of state.notes??[])for(const r of state.ranks??[])rank(midi,r,true);state.voices=[];}
  function restart(){for(const state of held.values()){stop(state,false);start(state);}}
  const api={
    context,manifest,
    async preload(){await Promise.all(manifest.regions.flatMap(r=>[load(r.file),load(r.releaseFile)]));},
    async unlock(){if(context.state==='suspended'&&typeof context.startRendering!=='function')await context.resume();},
    noteOn(name){if(disposed)throw Error('Audio controller disposed');const key=name.startsWith('BTN_')?name:'BTN_'+name;if(held.has(key))return;const mapping=manifest.buttons[key];if(!mapping)throw Error(`Unknown button ${name}`);const state={mapping,voices:[]};held.set(key,state);start(state);},
    noteOff(name){const key=name.startsWith('BTN_')?name:'BTN_'+name;const state=held.get(key);if(state){stop(state,true);held.delete(key);}},
    setBellows(nextDirection,nextPressure){if(!['push','pull'].includes(nextDirection))throw Error('Direction must be push or pull');const previous=pressure,changed=direction!==nextDirection;pressure=Math.max(0,Math.min(1,nextPressure));direction=nextDirection;pressureGain.gain.setTargetAtTime(pressure,context.currentTime,.025);if(changed||(previous<=.005&&pressure>.005)||(previous>.005&&pressure<=.005))restart();},
    setProfile(id){const next=manifest.profiles.find(p=>p.id===id);if(!next)throw Error('Unknown registration');profile=next;restart();},
    setTuning(id){const next=manifest.tunings.find(t=>t.id===id);if(!next)throw Error('Unknown tuning');tuning=next.semitones;restart();},
    setVolume(value){volume.gain.setTargetAtTime(.28*Math.max(0,Math.min(1,value)),context.currentTime,.025);},
    allNotesOff(){for(const state of held.values())stop(state,false);held.clear();},
    dispose(){api.allNotesOff();disposed=true;volume.disconnect();pressureGain.disconnect();limiter.disconnect();},
  };
  return api;
}

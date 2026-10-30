export type BellowsDirection = 'push' | 'pull';
export type AccordionKey = { id: string; label: string; row: 'outer' | 'middle' | 'inner'; position: number; rowIndex: number; note: string; push: number; pull: number; chord?: number[] };
type Pair = readonly [push: string, pull: string];

// Common 31-button GCF vallenato layout. Each reed plate is bisonoric:
// the same button sounds a different note when pushing and pulling.
const rows: Pair[][] = [
  [['B3','C4'],['D4','E4'],['F4','G4'],['A4','A4'],['C5','B4'],['E5','D5'],['G5','F5'],['B5','A5'],['D6','C6'],['F6','E6'],['A6','G6']],
  [['E4','F4'],['G4','A4'],['B4','C5'],['D5','E5'],['F5','G5'],['A5','B5'],['C6','D6'],['E6','F6'],['G6','A6'],['B6','C7']],
  [['A3','B3'],['C4','D4'],['E4','F4'],['G4','A4'],['B4','C5'],['D5','E5'],['F5','G5'],['A5','B5'],['C6','D6'],['E6','F6']]
];
const keyboardRows = [['Q','W','E','R','T','Y','U','I','O','P','A'],['S','D','F','G','H','J','K','L','Ñ','Z'],['X','C','V','B','N','M',',','.','/',';']];
const parseNote = (name: string) => {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) return { note: name, frequency: 440 };
  const semitone: Record<string, number> = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = (Number(match[3]) + 1) * 12 + semitone[match[1]!]! + accidental;
  const names: Record<number, string> = {0:'Do',1:'Do♯',2:'Re',3:'Mi♭',4:'Mi',5:'Fa',6:'Fa♯',7:'Sol',8:'La♭',9:'La',10:'Si♭',11:'Si'};
  return { note: `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`, frequency: 440 * 2 ** ((midi - 69) / 12) };
};

export const melodyKeys: AccordionKey[] = rows.flatMap((row, rowIndex) => row.map((pair, index) => {
  const push = parseNote(pair[0]); const pull = parseNote(pair[1]);
  const start = rowIndex === 0 ? 0 : rowIndex === 1 ? 6 : 11;
  return { id: `melody-${rowIndex}-${index}`, label: keyboardRows[rowIndex]![index]!, row: rowIndex === 0 ? 'outer' : rowIndex === 1 ? 'middle' : 'inner', position: start + index, rowIndex:index, note: `${push.note} / ${pull.note}`, push: push.frequency, pull: pull.frequency };
}));

const bassPairs: Array<[string,string]> = [['G2','G3'],['D3','D3'],['C3','C3'],['G3','E3'],['D3','B2'],['G2','G2'],['C3','C3'],['G3','E3'],['F2','F3'],['C3','C3'],['G2','G2'],['D3','D3']];
const bassLabels = ['1','2','3','4','5','6','7','8','9','0','-','='];
export const bassKeys: AccordionKey[] = bassPairs.map((pair, index) => {
  const push = parseNote(pair[0]); const pull = parseNote(pair[1]);
  const root = index % 2 ? pull.frequency : push.frequency;
  return { id:`bass-${index}`, label:bassLabels[index]!, row:index % 2 ? 'middle' : 'outer', position:index, rowIndex:index, note:`${push.note} / ${pull.note}`, push:push.frequency, pull:pull.frequency, chord:[root,root*1.25,root*1.5] };
});

export const tuningOffsets: Record<string, number> = { 'Sol · Do · Fa (GCF)':0, 'La · Re · Sol (ADG)':2, 'Fa · Si♭ · Mi♭ (FB♭E♭)':-2, 'Mi · La · Re (EAD)':-3 };

// Real Hohner button-accordion recordings from FreePats (CC0). The SFZ bank
// provides one looped sample per mapped pitch; nearest-root transposition fills
// the chromatic notes between those recordings.
const sampleRegions = [
  { file:'B3', root:47, low:0, high:49, tune:-34, start:36018, end:62654 }, { file:'D4', root:50, low:50, high:53, tune:-38, start:49751, end:69153 },
  { file:'F#4', root:54, low:54, high:54, tune:-23, start:46413, end:79367 }, { file:'G4', root:55, low:55, high:56, tune:-30, start:66543, end:93290 },
  { file:'A4', root:57, low:57, high:58, tune:-32, start:60366, end:74543 }, { file:'B4', root:59, low:59, high:59, tune:-19, start:76136, end:91082 },
  { file:'C5', root:60, low:60, high:61, tune:-28, start:72926, end:86200 }, { file:'D5', root:62, low:62, high:63, tune:-26, start:73008, end:86264 },
  { file:'E5', root:64, low:64, high:65, tune:-30, start:65908, end:83784 }, { file:'F#5', root:66, low:66, high:66, tune:-26, start:85013, end:94643 },
  { file:'G5', root:67, low:67, high:68, tune:-29, start:78733, end:97217 }, { file:'A5', root:69, low:69, high:70, tune:-20, start:85262, end:93453 },
  { file:'B5', root:71, low:71, high:71, tune:-7, start:75333, end:82273 }, { file:'C6', root:72, low:72, high:73, tune:-26, start:101921, end:108876 },
  { file:'D6', root:74, low:74, high:75, tune:-16, start:50588, end:59478 }, { file:'E6', root:76, low:76, high:77, tune:-22, start:86641, end:93093 },
  { file:'G6', root:79, low:78, high:127, tune:-10, start:58658, end:63555 },
];
const sampleCache = new Map<string, Promise<AudioBuffer>>();
function loadAccordionSample(context: AudioContext, file: string) {
  let pending = sampleCache.get(file);
  if (!pending) {
    pending = fetch(`/audio/accordion-hn/Button%20Accordion%20HN%20${encodeURIComponent(file)}.flac`)
      .then(response => { if (!response.ok) throw new Error('Accordion sample unavailable'); return response.arrayBuffer(); })
      .then(data => context.decodeAudioData(data));
    sampleCache.set(file, pending);
  }
  return pending;
}

/** Sustain a reed rank while a key and a direction of air pressure are active. */
export function startReedNote(context: AudioContext, frequency: number, direction: BellowsDirection, volume: number, tuning: number) {
  const region = sampleRegions.reduce((best, item) => Math.abs(item.root - 69 - 12 * Math.log2(frequency / 440)) < Math.abs(best.root - 69 - 12 * Math.log2(frequency / 440)) ? item : best, sampleRegions[0]!);
  const master=context.createGain(), filter=context.createBiquadFilter();
  let source: AudioBufferSourceNode | undefined, cancelled=false, released=false;
  filter.type='lowpass'; filter.frequency.value=direction==='pull'?5200:4700; filter.Q.value=.35; master.gain.value=.0001; filter.connect(master); master.connect(context.destination);
  void loadAccordionSample(context, region.file).then(buffer=>{
    if(cancelled)return;
    source=context.createBufferSource(); source.buffer=buffer; source.loop=true;
    source.loopStart=region.start/buffer.sampleRate; source.loopEnd=Math.min(region.end/buffer.sampleRate,buffer.duration);
    const midi=69+12*Math.log2(frequency/440)+tuning;
    source.playbackRate.value=2**((midi-region.root+region.tune/100)/12);
    source.connect(filter); const at=context.currentTime;
    master.gain.setValueAtTime(.0001,at); master.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),at+.035);
    source.start(at);
    if(released) release();
  }).catch(error=>console.warn('Could not decode the CC0 accordion sample',error));
  function release(){const at=context.currentTime;master.gain.cancelScheduledValues(at);master.gain.setTargetAtTime(.0001,at,.075);try{source?.stop(at+.35);}catch{/* already released */}window.setTimeout(()=>{try{master.disconnect();filter.disconnect();}catch{/* released */}},450);}
  return {stop:()=>{if(cancelled)return;cancelled=true;if(source)release();else released=true;}};
}

export function startBassChord(context: AudioContext, frequencies: number[], direction: BellowsDirection, volume: number, tuning: number) {
  const voices = frequencies.map((frequency, index) => startReedNote(context, frequency, direction, volume / (index === 0 ? 1 : 1.8), tuning));
  return { stop: () => voices.forEach(voice => voice.stop()) };
}

export function playArrangementEvent(context: AudioContext, frequency: number, role: 'melody'|'bass'|'chord'|'perc', durationMs: number, volume: number, at = context.currentTime, chordQuality: 'major'|'minor' = 'major') {
  const now = Math.max(context.currentTime, at);
  if (role === 'perc') {
    const osc=context.createOscillator(),gain=context.createGain();osc.type='triangle';osc.frequency.setValueAtTime(125,now);osc.frequency.exponentialRampToValueAtTime(48,now+.08);gain.gain.setValueAtTime(Math.max(.0001,volume*.35),now);gain.gain.exponentialRampToValueAtTime(.0001,now+.09);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.1);return;
  }
  const notes=role==='chord'?[frequency,frequency*2**((chordQuality==='minor'?3:4)/12),frequency*2**(7/12)]:[frequency];
  notes.forEach(pitch=>{const osc=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();osc.type=role==='bass'?'triangle':'sawtooth';osc.frequency.value=pitch;filter.type='lowpass';filter.frequency.value=role==='bass'?600:2600;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*(role==='bass'?.22:role==='chord'?.12:.2)/(role==='chord'?notes.length:1)),now+.012);gain.gain.setTargetAtTime(.0001,now+durationMs/1000,.045);osc.connect(filter);filter.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+durationMs/1000+.2);});
}
export type ReedVoice=ReturnType<typeof startReedNote>;

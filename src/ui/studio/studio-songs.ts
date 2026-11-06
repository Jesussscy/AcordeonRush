export type PracticeEvent = { time: number; lane: number; note: number; duration: number; role: 'melody' | 'bass' | 'chord' | 'perc'; chordQuality?: 'major' | 'minor' };
export type Song = { id: string; title: string; artist: string; bpm: number; duration: string; color: string; accent: string; key: string; youtubeId: string; events: PracticeEvent[]; notes: number[]; durationMs: number; source?: string; progression?: Array<{chord:string;beats:number}> };
type SongSeed = Omit<Song, 'events'|'notes'|'durationMs'> & { phrase: number[]; measureCount: number; syncopation: number[] };

const midi = (semitone: number, octave: number) => 12 * (octave + 1) + semitone;
const hz = (midiNote: number) => 440 * 2 ** ((midiNote - 69) / 12);
const major = (root: number) => [root, root + 2, root + 4, root + 5, root + 7, root + 9, root + 11, root + 12];
const seeds: SongSeed[] = [
  { id:'locuras', title:'Las locuras mías', artist:'Silvestre Dangond', youtubeId:'LqKscPDW8Y0', bpm:158, duration:'3:42', color:'#f2a65a', accent:'#ffb352', key:'Mi mayor · ejercicio', phrase:[0,2,4,2,5,4,2,0,2,4,5,4,2,1,0,2], measureCount:24, syncopation:[0,.5,1,1.75,2.5,3,3.5], source:'Ejercicio generado en Mi mayor; no se ha verificado la tonalidad ni el acordeón de esta grabación. Progresión del ejercicio: E · G♯m · A · B; digitación de práctica, no transcripción nota por nota del solo.', progression:[{chord:'E',beats:8},{chord:'G♯m',beats:8},{chord:'A',beats:8},{chord:'B',beats:8},{chord:'E',beats:4},{chord:'G♯m',beats:4},{chord:'F♯m',beats:4},{chord:'A',beats:4},{chord:'E',beats:8},{chord:'G♯m',beats:4},{chord:'F♯m',beats:4},{chord:'A',beats:4},{chord:'E',beats:4},{chord:'C♯m',beats:4},{chord:'G♯m',beats:4},{chord:'A',beats:4},{chord:'B',beats:4}] },
  { id:'sentidos', title:'Mis cinco sentidos', artist:'Kaleth Morales', youtubeId:'tK8CzcaX1NY', bpm:98, duration:'3:38', color:'#78b8a6', accent:'#a3ead3', key:'Do mayor', phrase:[0,2,3,5,4,3,2,0,0,2,4,5,4,2,1,0], measureCount:22, syncopation:[0,1,2,3,3.5] },
  { id:'amarte', title:'Amarte más no pude', artist:'Diomedes Díaz', youtubeId:'mY0kAaTVawU', bpm:104, duration:'4:09', color:'#d69aa7', accent:'#f6b5c2', key:'Re mayor', phrase:[0,2,4,5,4,2,0,1,2,4,5,7,5,4,2,0], measureCount:27, syncopation:[0,1,1.5,2,3] },
  { id:'confite', title:'El confite', artist:'Silvestre Dangond', youtubeId:'X-773iP89_o', bpm:122, duration:'3:51', color:'#cfba67', accent:'#f5df81', key:'Fa mayor', phrase:[0,2,4,2,5,4,5,7,5,4,2,0,2,4,5,4], measureCount:29, syncopation:[0,.5,1,1.5,2.5,3,3.5] },
  { id:'culpa', title:'Culpa de los dos', artist:'Silvestre Dangond', youtubeId:'hnAyeSlHHIs', bpm:106, duration:'4:01', color:'#af9bd5', accent:'#c8b2ff', key:'La menor', phrase:[0,2,3,5,7,5,3,2,0,2,3,5,3,2,1,0], measureCount:26, syncopation:[0,1,2,2.5,3,3.5] },
];

function createPracticeArrangement(seed: SongSeed) {
  const beatMs = 60_000 / seed.bpm;
  const measureMs = beatMs * 4;
  const targetDurationMs = seed.duration.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 1000;
  const measureCount = Math.ceil(targetDurationMs / measureMs);
  const root = seed.id === 'locuras' ? 64 : seed.id === 'sentidos' ? 60 : seed.id === 'amarte' ? 62 : seed.id === 'confite' ? 53 : 57;
  const minorKey = seed.key.toLowerCase().includes('menor');
  const scale = minorKey ? [0,2,3,5,7,8,10,12] : seed.id==='locuras'?[0,2,4,5,7,9,11,12]:major(0);
  const chordDegrees = minorKey ? [0,5,6,0] : [0,3,4,0];
  const progression=seed.progression??[{chord:'I',beats:4},{chord:'IV',beats:4},{chord:'V',beats:4},{chord:'vi',beats:4}];
  const chordAtBeat=(beat:number)=>{const total=progression.reduce((sum,step)=>sum+step.beats,0),position=beat%total;let cursor=0;return progression.find(step=>{cursor+=step.beats;return position<cursor;})??progression[0]!;};
  const chordRootFor=(measure:number)=>{const chord=chordAtBeat(measure*4).chord;const offsets:Record<string,number>={E:0,A:5,B:7,'G♯m':4,'F♯m':9,'C♯m':1};return midi((root+ (seed.id==='locuras'?(offsets[chord]??0):scale[chordDegrees[measure%4]!]!))%12,2);};
  const events: PracticeEvent[] = [];
  for (let measure = 0; measure < measureCount; measure += 1) {
    const start = measure * measureMs;
    const chordDegree = chordDegrees[measure % 4]!;
    const chordName=chordAtBeat(measure*4).chord;
    const chordRoot = seed.id==='locuras'?chordRootFor(measure):midi((root % 12 + scale[chordDegree]!) % 12, 2);
    // Vallenato-style bass/chord alternation across a 4/4 measure.
    [0, 2].forEach((beat, index) => events.push({ time:start + beat * beatMs, lane:0, note:chordRoot + (index ? 7 : 0), duration:beatMs * .34, role:'bass' }));
    [1, 3].forEach(beat => {events.push({ time:start + beat * beatMs, lane:1, note:chordRoot + 12, duration:beatMs * .28, role:'chord', chordQuality:chordName.endsWith('m')?'minor':minorKey ? 'minor' : 'major' });});
    seed.syncopation.forEach((beat, subIndex) => {
      const phraseIndex = (measure * 3 + subIndex * 2 + Math.floor(measure / 2)) % seed.phrase.length;
      const degree = seed.phrase[phraseIndex]!;
      const pitch = midi((root % 12 + scale[degree % scale.length]!) % 12, 4 + Math.floor(degree / 7));
      events.push({ time:start + beat * beatMs, lane:degree % 5, note:pitch, duration:beatMs * (beat===0?1.4:beat % 1 ? .2 : .58), role:'melody' });
    });
    [0,1,2,3].forEach(beat => events.push({ time:start + beat * beatMs, lane:4, note:0, duration:.055, role:'perc' }));
  }
  const durationMs = measureCount * measureMs;
  events.sort((a,b)=>a.time-b.time);
  const chartLeadMs = 2_200;
  return { ...seed, events, notes:events.filter(event=>event.role==='melody').map(event=>event.time + chartLeadMs), durationMs:durationMs + chartLeadMs };
}

export const songs: Song[] = seeds.map(createPracticeArrangement);
export { hz };


import type { AccordionAudio } from './accordion-sampler.js';
import type { ParsedChart } from '../gameplay/chart';
import { harmonize, type ChordSpan } from '../gameplay/harmony';
import { caja, click, guacharaca } from './percussion';

export type AccompanimentEvent =
  | { beat: number; kind: 'bass'; midis: number[]; beats: number }
  | { beat: number; kind: 'chord'; midis: number[]; beats: number }
  | { beat: number; kind: 'caja'; stroke: 'tan' | 'pa' | 'ghost' }
  | { beat: number; kind: 'guacharaca'; beats: number; accent: boolean }
  | { beat: number; kind: 'click'; accent: boolean };

/** Lowest octave placement of a pitch class inside [low, low + 11]. */
const place = (pc: number, low: number) => low + ((pc - (low % 12) + 12) % 12);

function triad(span: ChordSpan) {
  const third = (span.root + 4) % 12;
  const fifth = (span.root + 7) % 12;
  const tones = [place(span.root, 55), place(third, 55), place(fifth, 55)];
  if (span.quality === 'dom7') tones.push(place((span.root + 10) % 12, 55));
  return tones.sort((a, b) => a - b);
}

/**
 * Paseo pattern per half bar (2 beats): bass on the downbeat (root, then fifth when the chord repeats),
 * chord stab on the off-beat, caja "tan – pa" with ghost notes, guacharaca in eighths with accents.
 * A one-bar count-in of clicks + guacharaca precedes beat 0.
 */
export function buildAccompaniment(chart: Pick<ParsedChart, 'notes' | 'lengthBeats' | 'timeSignature'>) {
  const events: AccompanimentEvent[] = [];
  const beatsPerBar = chart.timeSignature[0];
  for (let b = -beatsPerBar; b < 0; b++) events.push({ beat: b, kind: 'click', accent: b === -beatsPerBar });
  const spans = harmonize(chart);
  spans.forEach((span, i) => {
    const repeat = i > 0 && spans[i - 1].root === span.root;
    const bassPc = repeat ? (span.root + 7) % 12 : span.root;
    events.push({ beat: span.t, kind: 'bass', midis: [place(bassPc, 40)], beats: 0.9 });
    events.push({ beat: span.t + 1, kind: 'chord', midis: triad(span), beats: 0.45 });
    events.push({ beat: span.t + 1.5, kind: 'chord', midis: triad(span), beats: 0.3 });
    events.push({ beat: span.t, kind: 'caja', stroke: 'tan' });
    events.push({ beat: span.t + 0.75, kind: 'caja', stroke: 'ghost' });
    events.push({ beat: span.t + 1, kind: 'caja', stroke: 'pa' });
    events.push({ beat: span.t + 1.5, kind: 'caja', stroke: 'ghost' });
    for (let k = 0; k < 4; k++)
      events.push({ beat: span.t + k * 0.5, kind: 'guacharaca', beats: k % 2 ? 0.18 : 0.38, accent: k % 2 === 0 });
  });
  return events.sort((a, b) => a.beat - b.beat);
}

/** Lookahead scheduler: call pump() every frame. `ctxTimeOfBeat` maps beats → AudioContext time. */
export class AccompanimentPlayer {
  private cursor = 0;
  readonly percussion: GainNode;
  enabled = true;

  constructor(
    private readonly audio: AccordionAudio,
    private readonly events: AccompanimentEvent[],
    private readonly secondsPerBeat: number,
    destination: AudioNode,
  ) {
    this.percussion = audio.context.createGain();
    this.percussion.gain.value = 0.55;
    this.percussion.connect(destination);
  }

  /** Re-position the cursor (start, seek, loops). */
  seek(beat: number) {
    this.cursor = this.events.findIndex((e) => e.beat >= beat);
    if (this.cursor < 0) this.cursor = this.events.length;
  }

  pump(ctxTimeOfBeat: (beat: number) => number, rate: number, lookahead = 0.2) {
    const ctx = this.audio.context;
    const horizon = ctx.currentTime + lookahead;
    while (this.cursor < this.events.length) {
      const e = this.events[this.cursor];
      const when = ctxTimeOfBeat(e.beat);
      if (when > horizon) break;
      this.cursor++;
      if (!this.enabled || when < ctx.currentTime - 0.03) continue;
      const at = Math.max(when, ctx.currentTime);
      const seconds = (beats: number) => (beats * this.secondsPerBeat) / rate;
      if (e.kind === 'bass' || e.kind === 'chord')
        this.audio.scheduleMidi(e.midis, e.kind, at, seconds(e.beats), e.kind === 'bass' ? 0.9 : 0.7);
      else if (e.kind === 'caja') caja(ctx, this.percussion, at, e.stroke);
      else if (e.kind === 'guacharaca') guacharaca(ctx, this.percussion, at, seconds(e.beats), e.accent);
      else click(ctx, this.percussion, at, e.accent);
    }
  }

  dispose() {
    this.percussion.disconnect();
  }
}

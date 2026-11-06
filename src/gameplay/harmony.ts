import type { ParsedChart } from './chart';

/** Major-key profile (Krumhansl–Kessler) used to estimate the key of a melody. */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];

export type Chord = { root: number; quality: 'major' | 'dom7'; degree: 'I' | 'IV' | 'V' };
export type ChordSpan = Chord & { t: number; dur: number };

/** Estimated major tonic pitch class (0 = C) from duration-weighted melody pitch classes. */
export function estimateKey(chart: Pick<ParsedChart, 'notes'>): number {
  const weights = new Array(12).fill(0);
  for (const n of chart.notes) weights[n.midi % 12] += n.dur;
  const last = chart.notes.at(-1);
  if (last) weights[last.midi % 12] += 2; // songs tend to end on the tonic
  let best = 0;
  let bestScore = -Infinity;
  for (let tonic = 0; tonic < 12; tonic++) {
    const score = weights.reduce((s, w, pc) => s + w * MAJOR_PROFILE[(pc - tonic + 12) % 12], 0);
    if (score > bestScore) {
      bestScore = score;
      best = tonic;
    }
  }
  return best;
}

const chordTones = (c: Chord) => {
  const tones = [c.root, (c.root + 4) % 12, (c.root + 7) % 12];
  if (c.quality === 'dom7') tones.push((c.root + 10) % 12);
  return tones;
};

/**
 * Pick I / IV / V7 for every half bar so the paseo accompaniment fits the melody.
 * Ties keep the previous chord; the song starts and ends on I.
 */
export function harmonize(
  chart: Pick<ParsedChart, 'notes' | 'lengthBeats' | 'timeSignature'>,
  tonic = estimateKey(chart),
) {
  const chords: Chord[] = [
    { root: tonic, quality: 'major', degree: 'I' },
    { root: (tonic + 5) % 12, quality: 'major', degree: 'IV' },
    { root: (tonic + 7) % 12, quality: 'dom7', degree: 'V' },
  ];
  const span = chart.timeSignature[0] / 2;
  const total = Math.ceil(chart.lengthBeats / span) * span;
  const spans: ChordSpan[] = [];
  let previous = chords[0];
  for (let t = 0; t < total; t += span) {
    const weights = new Array(12).fill(0);
    for (const n of chart.notes) {
      const overlap = Math.min(n.t + n.dur, t + span) - Math.max(n.t, t);
      if (overlap > 0) weights[n.midi % 12] += overlap * (Math.abs(n.t - t) < 1e-6 ? 1.5 : 1);
    }
    let choice = previous;
    let best = -Infinity;
    for (const chord of chords) {
      const tones = chordTones(chord);
      const fit =
        weights.reduce((s, w, pc) => s + (tones.includes(pc) ? w : -0.6 * w), 0) + (chord === previous ? 0.15 : 0);
      if (fit > best + 1e-9) {
        best = fit;
        choice = chord;
      }
    }
    if (t === 0 || t + span >= total) choice = weights.some((w) => w > 0) && best > 0 ? choice : chords[0];
    if (t + span >= total) choice = chords[0];
    spans.push({ ...choice, t, dur: span });
    previous = choice;
  }
  return spans;
}

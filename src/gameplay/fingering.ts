import { getTuning, melodyButtons, type InstrumentKey } from '../instrument/accordion-catalog';
import type { Bellows, ParsedChart, ParsedNote } from './chart';

/** A chart note resolved to a concrete button and bellows direction. */
export type ResolvedNote = {
  index: number;
  /** Beats. */
  t: number;
  dur: number;
  midi: number;
  button: InstrumentKey;
  /** 0 = afuera, 1 = medio, 2 = adentro. */
  row: number;
  direction: Bellows;
  forced: boolean;
};

export type ResolveOptions = {
  tuning?: string;
  /** Allowed rows (0 afuera, 1 medio, 2 adentro). */
  rows?: number[];
};

type Candidate = { button: InstrumentKey; direction: Bellows };

/** Viterbi weights, tuned on the demo: mostly the middle row with ~0.4 bellows changes per note. */
export const COST = {
  bellowsChange: 1,
  /** Extra cost when the bellows must flip right after a short (< 1/2 beat) note. */
  fastBellowsChange: 0.5,
  positionJump: 0.12,
  rowChange: 0.35,
  /** Preference for the middle row. */
  outerRow: 1.2,
};

/** Every (button, bellows) pair of the allowed rows that sounds `midi`. */
export function candidatesFor(midi: number, shift: number, rows: number[]): Candidate[] {
  const result: Candidate[] = [];
  for (const button of melodyButtons) {
    if (!rows.includes(button.row)) continue;
    for (const direction of ['push', 'pull'] as const)
      if (button[direction][0] + shift === midi) result.push({ button, direction });
  }
  return result;
}

/**
 * Resolve chart notes to buttons + bellows with a Viterbi search that prefers the middle row,
 * small hand movements and as few bellows changes as possible. Forced `button` / `bellows`
 * fields in the chart restrict the candidates. Notes that cannot be played are returned in `dropped`.
 */
export function resolveChart(chart: Pick<ParsedChart, 'notes' | 'tuning'>, options: ResolveOptions = {}) {
  const shift = getTuning(options.tuning ?? chart.tuning).semitones;
  const rows = options.rows ?? [0, 1, 2];
  const dropped: { note: ParsedNote; reason: string }[] = [];
  const playable: { note: ParsedNote; candidates: Candidate[] }[] = [];

  for (const note of chart.notes) {
    let candidates = candidatesFor(note.midi, shift, rows);
    if (note.button) candidates = candidates.filter((c) => c.button.code === note.button);
    if (note.bellows) candidates = candidates.filter((c) => c.direction === note.bellows);
    if (candidates.length) playable.push({ note, candidates });
    else
      dropped.push({
        note,
        reason: note.button
          ? `el botón ${note.button} no da ${note.pitch}${note.bellows ? ` al ${note.bellows === 'push' ? 'cerrar' : 'abrir'}` : ''}`
          : `${note.pitch} no existe en las hileras permitidas`,
      });
  }

  // Viterbi over candidates.
  const costs: number[][] = [];
  const back: number[][] = [];
  playable.forEach(({ candidates }, i) => {
    costs[i] = [];
    back[i] = [];
    candidates.forEach((c, j) => {
      const own = c.button.row === 1 ? 0 : COST.outerRow;
      if (i === 0) {
        costs[i][j] = own;
        back[i][j] = -1;
        return;
      }
      const prev = playable[i - 1];
      let best = Infinity;
      let arg = 0;
      prev.candidates.forEach((p, k) => {
        let cost = costs[i - 1][k];
        if (p.direction !== c.direction)
          cost += COST.bellowsChange + (prev.note.dur < 0.5 ? COST.fastBellowsChange : 0);
        if (p.button.row !== c.button.row) cost += COST.rowChange;
        cost += Math.abs(p.button.position - c.button.position) * COST.positionJump;
        if (cost < best) {
          best = cost;
          arg = k;
        }
      });
      costs[i][j] = best + own;
      back[i][j] = arg;
    });
  });

  const notes: ResolvedNote[] = [];
  if (playable.length) {
    const last = costs[playable.length - 1];
    let j = last.indexOf(Math.min(...last));
    for (let i = playable.length - 1; i >= 0; i--) {
      const { note, candidates } = playable[i];
      const c = candidates[j];
      notes.push({
        index: note.index,
        t: note.t,
        dur: note.dur,
        midi: note.midi,
        button: c.button,
        row: c.button.row,
        direction: c.direction,
        forced: Boolean(note.button || note.bellows),
      });
      j = back[i][j];
    }
    notes.reverse();
  }
  return { notes, dropped };
}

/** Bellows changes needed by a resolved sequence. The resting state (Space released) is "pull". */
export function bellowsChanges(notes: ResolvedNote[], rest: Bellows = 'pull') {
  const changes: { t: number; direction: Bellows; noteIndex: number }[] = [];
  let current = rest;
  for (const n of notes) {
    if (n.direction !== current) changes.push({ t: n.t, direction: n.direction, noteIndex: n.index });
    current = n.direction;
  }
  return changes;
}

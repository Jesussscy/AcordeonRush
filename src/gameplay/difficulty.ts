import type { ParsedChart, ParsedNote } from './chart';
import { resolveChart, type ResolvedNote } from './fingering';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: { id: Difficulty; label: string; description: string; rows: number[] }[] = [
  { id: 'easy', label: 'Fácil', description: 'Solo la hilera del medio y pocos cambios de fuelle', rows: [1] },
  { id: 'medium', label: 'Medio', description: 'Hileras de afuera y del medio', rows: [0, 1] },
  { id: 'hard', label: 'Difícil', description: 'Las 3 hileras, sin las notas más rápidas', rows: [0, 1, 2] },
  { id: 'expert', label: 'Experto', description: 'Chart completo en las 3 hileras', rows: [0, 1, 2] },
];

const onBeat = (t: number, step: number) => Math.abs(t / step - Math.round(t / step)) < 1e-6;

/** Drop fast off-beat notes. `step` = grid that must be kept (1 = beats, 0.5 = eighths). */
function thin(notes: ParsedNote[], step: number, minDur: number) {
  return notes.filter((n) => onBeat(n.t, step) || n.dur > minDur);
}

/** Avoid bellows flips closer than `minBeats` by dropping the note that would force them. */
function limitBellowsChanges(notes: ResolvedNote[], minBeats: number) {
  const kept: ResolvedNote[] = [];
  let lastChange = -Infinity;
  for (const n of notes) {
    const prev = kept.at(-1);
    if (prev && prev.direction !== n.direction) {
      if (n.t - lastChange < minBeats) continue;
      lastChange = n.t;
    }
    kept.push(n);
  }
  return kept;
}

/** Derive a difficulty from the Expert chart. */
export function chartForDifficulty(chart: ParsedChart, difficulty: Difficulty) {
  const config = DIFFICULTIES.find((d) => d.id === difficulty)!;
  let source = chart.notes;
  if (difficulty === 'hard') source = thin(source, 0.5, 0.25);
  if (difficulty === 'medium') source = thin(source, 0.5, 0.25);
  if (difficulty === 'easy') source = thin(source, 1, 0.5);
  const resolved = resolveChart({ notes: source, tuning: chart.tuning }, { rows: config.rows });
  const notes = difficulty === 'easy' ? limitBellowsChanges(resolved.notes, 2) : resolved.notes;
  return { notes, dropped: resolved.dropped, removed: chart.notes.length - notes.length };
}

/** Scientific pitch notation helpers. C4 = MIDI 60. */
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE_SHARP = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const SOLFEGE_FLAT = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

/** Parse "C4", "F#3", "Bb5", "c#4" into a MIDI number. Throws on invalid input. */
export function noteToMidi(name: string): number {
  const match = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(name.trim());
  if (!match) throw new Error(`Nota inválida: "${name}" (usa notación como C4, F#3 o Bb5)`);
  const accidental = match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + SEMITONES[match[1].toUpperCase()] + accidental;
}

export function midiToNote(midi: number): string {
  return SHARP_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

/** Spanish solfège name, e.g. 64 → "Mi4". */
export function solfege(midi: number, flats = false, octave = true): string {
  const names = flats ? SOLFEGE_FLAT : SOLFEGE_SHARP;
  return names[((midi % 12) + 12) % 12] + (octave ? String(Math.floor(midi / 12) - 1) : '');
}

export const midiFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

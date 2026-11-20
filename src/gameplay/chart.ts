import { noteToMidi } from '../utils/notes';

/** Bellows direction: push = cerrar (close), pull = abrir (open). */
export type Bellows = 'push' | 'pull';

export type ChartNote = {
  /** Start in beats from beat 0. */
  t: number;
  /** Scientific pitch, e.g. "E4". */
  pitch: string;
  /** Duration in beats. */
  dur: number;
  /** Optional forced button id (A1…A10, M1…M11, D1…D10). */
  button?: string;
  /** Optional forced bellows direction. */
  bellows?: Bellows;
};

export type SongChart = {
  title: string;
  artist: string;
  bpm: number;
  timeSignature: [number, number];
  offsetMs: number;
  layout: string;
  tuning: string;
  backingStyle?: 'melody';
  license?: string;
  /** [start, end) ranges in beats whose notes are golden Parranda gems. */
  parrandaPhrases: [number, number][];
  notes: ChartNote[];
};

/** A chart note with its MIDI pitch resolved (still in beats). */
export type ParsedNote = ChartNote & { index: number; midi: number };
export type ParsedChart = Omit<SongChart, 'notes'> & { notes: ParsedNote[]; lengthBeats: number };

const fail = (source: string, message: string): never => {
  throw new Error(`${source}: ${message}`);
};

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validate a chart.json object (spec format, times in beats). Error messages are in Spanish for players. */
export function parseSongChart(raw: unknown, source = 'chart.json'): ParsedChart {
  if (!raw || typeof raw !== 'object') fail(source, 'el archivo no es un objeto JSON');
  const data = raw as Record<string, unknown>;
  const text = (key: string, fallback?: string) => {
    const value = data[key] ?? fallback;
    if (typeof value !== 'string' || !value.trim()) fail(source, `falta el campo de texto "${key}"`);
    return (value as string).trim();
  };
  const bpm = data.bpm;
  if (!isNumber(bpm) || bpm < 30 || bpm > 300) fail(source, '"bpm" debe ser un número entre 30 y 300');
  const timeSignature = (data.timeSignature ?? [4, 4]) as [number, number];
  if (!Array.isArray(timeSignature) || !isNumber(timeSignature[0]) || timeSignature[0] < 1)
    fail(source, '"timeSignature" debe ser como [4, 4]');
  const offsetMs = data.offsetMs ?? 0;
  if (!isNumber(offsetMs)) fail(source, '"offsetMs" debe ser un número');
  if (!Array.isArray(data.notes) || data.notes.length === 0) fail(source, '"notes" debe ser una lista con notas');
  if ((data.notes as unknown[]).length > 20000) fail(source, 'demasiadas notas (máximo 20000)');

  const notes = (data.notes as Record<string, unknown>[]).map((note, index): ParsedNote => {
    const where = `nota ${index + 1}`;
    if (!isNumber(note.t) || note.t < 0) fail(source, `${where}: "t" debe ser un número de beats ≥ 0`);
    if (!isNumber(note.dur) || note.dur <= 0) fail(source, `${where}: "dur" debe ser > 0`);
    if (typeof note.pitch !== 'string') fail(source, `${where}: falta "pitch"`);
    let midi = 0;
    try {
      midi = noteToMidi(note.pitch as string);
    } catch (error) {
      fail(source, `${where}: ${(error as Error).message}`);
    }
    if (note.bellows !== undefined && note.bellows !== 'push' && note.bellows !== 'pull')
      fail(source, `${where}: "bellows" debe ser "push" (cerrar) o "pull" (abrir)`);
    if (note.button !== undefined && (typeof note.button !== 'string' || !/^[AMD]\d{1,2}$/.test(note.button)))
      fail(source, `${where}: "button" debe ser como M5, A3 o D10`);
    return {
      index,
      t: note.t as number,
      dur: note.dur as number,
      pitch: note.pitch as string,
      midi,
      ...(note.button ? { button: note.button as string } : {}),
      ...(note.bellows ? { bellows: note.bellows as Bellows } : {}),
    };
  });
  notes.sort((a, b) => a.t - b.t || a.index - b.index);
  notes.forEach((n, i) => (n.index = i));

  const phrases = (data.parrandaPhrases ?? []) as [number, number][];
  if (
    !Array.isArray(phrases) ||
    phrases.some((p) => !Array.isArray(p) || !isNumber(p[0]) || !isNumber(p[1]) || p[1] <= p[0])
  )
    fail(source, '"parrandaPhrases" debe ser una lista de rangos [inicio, fin] en beats');

  // Round the song length up to a full bar so trailing rests are kept.
  const beatsPerBar = timeSignature[0];
  const lengthBeats = Math.ceil(Math.max(...notes.map((n) => n.t + n.dur)) / beatsPerBar) * beatsPerBar;
  return {
    title: text('title'),
    artist: text('artist', 'Desconocido'),
    bpm: bpm as number,
    timeSignature: [timeSignature[0], timeSignature[1] ?? 4],
    offsetMs: offsetMs as number,
    layout: text('layout', 'gcf'),
    tuning: text('tuning', 'GCF'),
    backingStyle: data.backingStyle === 'melody' ? 'melody' : undefined,
    ...(typeof data.license === 'string' ? { license: data.license } : {}),
    parrandaPhrases: phrases,
    notes,
    lengthBeats,
  };
}

/** Convert "E4:1 G4:0.5 R:1 …" text notation into chart notes (R = rest). Bar lines "|" are ignored. */
export function notesFromText(text: string, startBeat = 0): ChartNote[] {
  const notes: ChartNote[] = [];
  let t = startBeat;
  for (const token of text.split(/[\s|]+/).filter(Boolean)) {
    const [pitch, beats] = token.split(':');
    const dur = Number(beats);
    if (!pitch || !Number.isFinite(dur) || dur <= 0) throw new Error(`Token inválido: "${token}"`);
    if (pitch.toUpperCase() !== 'R') notes.push({ t, pitch, dur });
    t += dur;
  }
  return notes;
}

export const beatsToSeconds = (beats: number, bpm: number) => (beats * 60) / bpm;

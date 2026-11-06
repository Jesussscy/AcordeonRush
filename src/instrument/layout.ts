import { noteToMidi } from '../utils/notes';

/** JSON shape of data/layouts/*.json (see .claude/skills/accordion-layout). */
export type LayoutFile = {
  id: string;
  name: string;
  system: string;
  source: string;
  verify?: string;
  sourceNotes?: string;
  rows: { name: string; prefix: string; key?: string; buttons: { id: string; push: string; pull: string }[] }[];
  bass: { id: string; push: string[]; pull: string[]; chord: boolean }[];
  tunings: { id: string; label: string; solfege: string; semitones: number; flats: boolean }[];
  verification: {
    base: string;
    source: string;
    consulted: string;
    concertPitch: number;
    middleC: number;
    derivedFamilies: string;
    aliases: Record<string, { family: string; registerOffset: number }>;
  };
};

export type LayoutRow = { name: string; prefix: string; buttons: { id: string; push: number; pull: number }[] };
export type ParsedLayout = Omit<LayoutFile, 'rows' | 'bass'> & {
  rows: LayoutRow[];
  bass: { id: string; push: number[]; pull: number[]; chord: boolean }[];
};

/** Validate a layout file and convert note names to MIDI numbers. */
export function parseLayout(file: LayoutFile): ParsedLayout {
  if (!Array.isArray(file.rows) || file.rows.length !== 3) throw new Error('El layout debe tener 3 hileras');
  const ids = new Set<string>();
  const rows = file.rows.map((row) => ({
    name: row.name,
    prefix: row.prefix,
    buttons: row.buttons.map((b) => {
      if (ids.has(b.id)) throw new Error(`Botón duplicado en el layout: ${b.id}`);
      ids.add(b.id);
      return { id: b.id, push: noteToMidi(b.push), pull: noteToMidi(b.pull) };
    }),
  }));
  const bass = file.bass.map((b) => ({ ...b, push: b.push.map(noteToMidi), pull: b.pull.map(noteToMidi) }));
  return { ...file, rows, bass };
}

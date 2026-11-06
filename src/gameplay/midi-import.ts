/**
 * Minimal Standard MIDI File reader → Vallenato Hero chart (monophonic melody, times in beats).
 * Self-contained (no dependencies) so tools/midi-to-chart.mjs can import it directly with Node.
 */
export type MidiNote = {
  tick: number;
  durTicks: number;
  midi: number;
  channel: number;
  track: number;
  velocity: number;
};
export type MidiImportOptions = {
  title?: string;
  artist?: string;
  /** Track index to use (default: auto = highest-pitched track with the most notes). */
  track?: number;
  /** MIDI channel 1–16 to use (default: auto). */
  channel?: number;
  /** Quantization grid in beats (default 0.25 = sixteenth). */
  grid?: number;
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (midi: number) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

export function readMidi(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const str = (n: number) => String.fromCharCode(...bytes.subarray(pos, pos + n));
  if (str(4) !== 'MThd') throw new Error('No es un archivo MIDI (falta MThd)');
  const headerLength = view.getUint32(4);
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new Error('MIDI con división SMPTE no soportado');
  pos = 8 + headerLength;
  const notes: MidiNote[] = [];
  const tempos: { tick: number; usPerBeat: number }[] = [];
  for (let track = 0; track < trackCount && pos < bytes.length; track++) {
    if (str(4) !== 'MTrk') throw new Error(`Pista ${track} inválida`);
    const end = pos + 8 + view.getUint32(pos + 4);
    pos += 8;
    let tick = 0;
    let status = 0;
    const open = new Map<string, { tick: number; velocity: number }>();
    const varint = () => {
      let value = 0;
      let byte: number;
      do {
        byte = bytes[pos++];
        value = (value << 7) | (byte & 0x7f);
      } while (byte & 0x80);
      return value;
    };
    while (pos < end) {
      tick += varint();
      let byte = bytes[pos];
      if (byte & 0x80) {
        status = byte;
        pos++;
      } else byte = status;
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (status === 0xff) {
        const meta = bytes[pos++];
        const length = varint();
        if (meta === 0x51 && length === 3)
          tempos.push({ tick, usPerBeat: (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2] });
        pos += length;
      } else if (status === 0xf0 || status === 0xf7) {
        pos += varint();
      } else if (type === 0x90 || type === 0x80) {
        const midi = bytes[pos++];
        const velocity = bytes[pos++];
        const key = `${channel}:${midi}`;
        if (type === 0x90 && velocity > 0) open.set(key, { tick, velocity });
        else {
          const start = open.get(key);
          if (start) {
            notes.push({
              tick: start.tick,
              durTicks: tick - start.tick,
              midi,
              channel,
              track,
              velocity: start.velocity,
            });
            open.delete(key);
          }
        }
      } else if (type === 0xc0 || type === 0xd0) pos += 1;
      else pos += 2;
    }
    pos = end;
  }
  return { division, notes, tempos };
}

export function chartFromMidi(bytes: Uint8Array, options: MidiImportOptions = {}) {
  const { division, notes, tempos } = readMidi(bytes);
  const melodic = notes.filter((n) => n.channel !== 9); // channel 10 = drums
  if (!melodic.length) throw new Error('El MIDI no tiene notas melódicas');
  const groups = new Map<string, MidiNote[]>();
  for (const n of melodic) {
    if (options.track !== undefined && n.track !== options.track) continue;
    if (options.channel !== undefined && n.channel !== options.channel - 1) continue;
    const key = `${n.track}:${n.channel}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  if (!groups.size) throw new Error('No hay notas en la pista/canal indicados');
  // Melody heuristic: many notes and a high average pitch.
  const score = (list: MidiNote[]) => list.length * (list.reduce((s, n) => s + n.midi, 0) / list.length);
  const melody = [...groups.values()].sort((a, b) => score(b) - score(a))[0];
  const grid = options.grid ?? 0.25;
  const q = (ticks: number) => Math.round(ticks / division / grid) * grid;
  // Monophonic: at each start keep the highest note, cut overlaps.
  const byStart = new Map<number, MidiNote>();
  for (const n of melody) {
    const t = q(n.tick);
    const current = byStart.get(t);
    if (!current || n.midi > current.midi) byStart.set(t, n);
  }
  const starts = [...byStart.keys()].sort((a, b) => a - b);
  const chartNotes = starts.map((t, i) => {
    const n = byStart.get(t)!;
    const next = starts[i + 1] ?? Infinity;
    const dur = Math.max(grid, Math.min(q(n.tick + n.durTicks) - t, next - t));
    return { t, pitch: pitchName(n.midi), dur };
  });
  const first = chartNotes[0].t;
  const shift = Math.floor(first / 4) * 4; // keep the bar position, drop empty leading bars
  const usPerBeat = tempos.sort((a, b) => a.tick - b.tick)[0]?.usPerBeat ?? 500000;
  return {
    title: options.title ?? 'Canción MIDI',
    artist: options.artist ?? 'Importada de MIDI',
    bpm: Math.round((60_000_000 / usPerBeat) * 100) / 100,
    timeSignature: [4, 4] as [number, number],
    offsetMs: 0,
    layout: 'gcf',
    tuning: 'GCF',
    parrandaPhrases: [] as [number, number][],
    notes: chartNotes.map((n) => ({ ...n, t: n.t - shift })),
  };
}

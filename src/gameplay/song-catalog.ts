import { parseSongChart, type ParsedChart } from './chart';

/**
 * Songs are discovered at build time from songs/<slug>/:
 *   chart.json (or *.mid), audio.(mp3|ogg|wav)?, cover.(jpg|png|webp)?
 * Folders starting with "_" are private (git-ignored) but still listed.
 */
const charts = import.meta.glob('/songs/*/chart.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const audio = import.meta.glob('/songs/*/audio.{mp3,ogg,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const covers = import.meta.glob('/songs/*/cover.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const midis = import.meta.glob('/songs/*/*.mid', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

export type SongEntry = {
  /** Folder name, e.g. "paseo-de-prueba". */
  id: string;
  title: string;
  artist: string;
  bpm: number;
  private: boolean;
  chart?: ParsedChart;
  midiUrl?: string;
  audioUrl?: string;
  coverUrl?: string;
  error?: string;
};

const folderOf = (path: string) => path.split('/')[2];

function buildCatalog(): SongEntry[] {
  const ids = new Set([...Object.keys(charts), ...Object.keys(midis)].map(folderOf));
  const pick = (map: Record<string, string>, id: string) =>
    Object.entries(map).find(([path]) => folderOf(path) === id)?.[1];
  const entries: SongEntry[] = [];
  for (const id of ids) {
    const base = { id, private: id.startsWith('_'), audioUrl: pick(audio, id), coverUrl: pick(covers, id) };
    const raw = charts[`/songs/${id}/chart.json`];
    if (raw) {
      try {
        const chart = parseSongChart(raw, `songs/${id}/chart.json`);
        entries.push({ ...base, chart, title: chart.title, artist: chart.artist, bpm: chart.bpm });
      } catch (error) {
        entries.push({ ...base, title: id, artist: '—', bpm: 0, error: (error as Error).message });
      }
    } else {
      entries.push({
        ...base,
        title: id.replace(/[-_]/g, ' ').trim(),
        artist: 'MIDI',
        bpm: 0,
        midiUrl: pick(midis, id),
      });
    }
  }
  return entries.sort((a, b) => Number(a.private) - Number(b.private) || a.title.localeCompare(b.title, 'es'));
}

export const songCatalog: SongEntry[] = buildCatalog();

/** Resolve the playable chart of a catalog entry (MIDI-only songs are converted at runtime). */
export async function loadSongChart(entry: SongEntry): Promise<ParsedChart> {
  if (entry.chart) return entry.chart;
  if (entry.error) throw new Error(entry.error);
  if (!entry.midiUrl) throw new Error(`La canción ${entry.id} no tiene chart.json ni .mid`);
  const { chartFromMidi } = await import('./midi-import');
  const bytes = new Uint8Array(await (await fetch(entry.midiUrl)).arrayBuffer());
  const chart = parseSongChart(chartFromMidi(bytes, { title: entry.title }), `songs/${entry.id}/*.mid`);
  entry.chart = chart;
  entry.bpm = chart.bpm;
  return chart;
}

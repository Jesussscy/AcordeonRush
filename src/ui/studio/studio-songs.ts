import { harmonize } from '../../gameplay/harmony';
import { songCatalog } from '../../gameplay/song-catalog';

/** Studio (Estudio libre) song model. Built from the charts in songs/ — no hard-coded repertoire. */
export type PracticeEvent = {
  time: number;
  lane: number;
  note: number;
  duration: number;
  role: 'melody' | 'bass' | 'chord' | 'perc';
  chordQuality?: 'major' | 'minor';
};
export type Song = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: string;
  color: string;
  accent: string;
  key: string;
  /** Optional official reference video; empty = no reference. */
  youtubeId: string;
  events: PracticeEvent[];
  notes: number[];
  durationMs: number;
  source?: string;
};

const PALETTE = ['#f2c230', '#2fbf4f', '#e0393e', '#3d8bff', '#ff8a1f'];
const KEY_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
/** Two beats of silence before the first note, like the game count-in. */
const LEAD_BEATS = 2;

export function getStudioSongs(): Song[] {
  return songCatalog
    .filter((entry) => entry.chart)
    .map((entry, index) => {
      const chart = entry.chart!;
      const beatMs = 60_000 / chart.bpm;
      const at = (beat: number) => (beat + LEAD_BEATS) * beatMs;
      const events: PracticeEvent[] = chart.notes.map((n) => ({
        time: at(n.t),
        lane: n.midi % 5,
        note: n.midi,
        duration: n.dur * beatMs,
        role: 'melody',
      }));
      const spans = chart.backingStyle === 'melody' ? [] : harmonize(chart);
      for (const span of spans) {
        events.push({
          time: at(span.t),
          lane: 4,
          note: 40 + ((span.root - 4 + 12) % 12),
          duration: beatMs * 0.8,
          role: 'bass',
        });
        events.push({
          time: at(span.t + 1),
          lane: 4,
          note: 48 + span.root + 12,
          duration: beatMs * 0.4,
          role: 'chord',
          chordQuality: 'major',
        });
      }
      events.sort((a, b) => a.time - b.time);
      const durationMs = at(chart.lengthBeats);
      const seconds = Math.round(durationMs / 1000);
      return {
        id: entry.id,
        title: chart.title,
        artist: chart.artist,
        bpm: chart.bpm,
        duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
        color: PALETTE[index % PALETTE.length],
        accent: PALETTE[(index + 1) % PALETTE.length],
        key: spans.length ? `${KEY_NAMES[spans[0].root]} mayor` : 'Melodía MIDI',
        youtubeId: '',
        events,
        notes: events.filter((e) => e.role === 'melody').map((e) => e.time),
        durationMs,
        source: chart.license ?? `songs/${entry.id}/chart.json`,
      };
    });
}

export const songs: Song[] = getStudioSongs();

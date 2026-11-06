import type { Difficulty } from '../gameplay/difficulty';
import { readJson, writeJson } from './storage';

export type RecordEntry = { score: number; stars: number; accuracy: number; maxStreak: number; date: string };
type RecordBook = Record<string, Partial<Record<Difficulty, RecordEntry>>>;

const KEY = 'vallenato-hero:records';

export function getRecord(songId: string, difficulty: Difficulty): RecordEntry | undefined {
  return readJson<RecordBook>(KEY, {})[songId]?.[difficulty];
}

/** Save if better; returns which parts are new records. */
export function submitRecord(songId: string, difficulty: Difficulty, entry: RecordEntry) {
  const book = readJson<RecordBook>(KEY, {});
  const previous = book[songId]?.[difficulty];
  const newScore = !previous || entry.score > previous.score;
  const newStreak = !previous || entry.maxStreak > previous.maxStreak;
  if (newScore || newStreak) {
    book[songId] = {
      ...book[songId],
      [difficulty]: {
        ...(previous ?? entry),
        ...(newScore ? { score: entry.score, stars: entry.stars, accuracy: entry.accuracy, date: entry.date } : {}),
        maxStreak: Math.max(previous?.maxStreak ?? 0, entry.maxStreak),
      },
    };
    writeJson(KEY, book);
  }
  return { newScore, newStreak, previous };
}

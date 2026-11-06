import type { ErrorKind, Grade, JudgeEvent } from './judge';

export const POINTS: Record<Grade, number> = { perfect: 50, good: 35, ok: 20 };
export const SUSTAIN_POINTS_PER_BEAT = 25;
export const STREAK_MILESTONES = [25, 50, 100, 200, 500];
const NOTES_PER_LEVEL = 10;
const MAX_LEVEL = 4;

/** Ambientómetro deltas (meter is 0…1). */
const METER = { perfect: 0.03, good: 0.025, ok: 0.015, sustain: 0.01, miss: -0.07, wrong: -0.06, ghost: -0.02 };
const HAT_PER_PHRASE = 1.5;
const MAX_HATS = 3;
const PARRANDA_BEATS_PER_HAT = 8;

export type ScoreEvent =
  | { type: 'multiplier-up'; multiplier: number }
  | { type: 'multiplier-lost'; from: number }
  | { type: 'milestone'; streak: number }
  | { type: 'streak-broken'; streak: number }
  | { type: 'best-streak-beaten'; streak: number }
  | { type: 'hats'; hats: number }
  | { type: 'parranda-ready' }
  | { type: 'parranda-start' }
  | { type: 'parranda-end' }
  | { type: 'meter-zone'; zone: 'red' | 'yellow' | 'green' }
  | { type: 'failed' };

export type ScoreOptions = {
  /** Fácil: the first N errors only lower the meter. */
  graceErrors?: number;
  /** Practice mode: the meter never ends the song. */
  noFail?: boolean;
  /** Personal best streak for this song + difficulty. */
  bestStreak?: number;
  parrandaPhrases?: [number, number][];
  /** Notes (beats) of the current difficulty, to know when a Parranda phrase is complete. */
  noteBeats?: number[];
};

/** Score, multiplier, streak, Ambientómetro and Parranda state machine. */
export class ScoreKeeper {
  score = 0;
  streak = 0;
  maxStreak = 0;
  /** Consecutive hits since the multiplier was last reset (drives the 10 lights). */
  chain = 0;
  perfectStreak = 0;
  meter = 0.5;
  hats = 0;
  parranda = false;
  parrandaBeatsLeft = 0;
  failed = false;
  readonly bestStreakBefore: number;
  grades: Record<Grade, number> = { perfect: 0, good: 0, ok: 0 };
  errors: Record<ErrorKind, number> = { missed: 0, button: 0, bellows: 0, early: 0, late: 0, ghost: 0 };
  sustainPoints = 0;
  private graceLeft: number;
  private readonly noFail: boolean;
  private phraseState: { range: [number, number]; total: number; hit: number; broken: boolean; done: boolean }[];
  private lastZone: 'red' | 'yellow' | 'green' = 'yellow';
  private beatenAnnounced = false;

  constructor(options: ScoreOptions = {}) {
    this.graceLeft = options.graceErrors ?? 0;
    this.noFail = options.noFail ?? false;
    this.bestStreakBefore = options.bestStreak ?? 0;
    const beats = options.noteBeats ?? [];
    this.phraseState = (options.parrandaPhrases ?? []).map((range) => ({
      range,
      total: beats.filter((b) => b >= range[0] && b < range[1]).length,
      hit: 0,
      broken: false,
      done: false,
    }));
  }

  /** x1…x4, doubled during Parranda (max x8). */
  get multiplier() {
    const level = Math.min(MAX_LEVEL, 1 + Math.floor(this.chain / NOTES_PER_LEVEL));
    return this.parranda ? level * 2 : level;
  }

  /** 0…10 lights of the current level (10 when maxed). */
  get lights() {
    const level = 1 + Math.floor(this.chain / NOTES_PER_LEVEL);
    return level >= MAX_LEVEL ? NOTES_PER_LEVEL : this.chain % NOTES_PER_LEVEL;
  }

  get zone(): 'red' | 'yellow' | 'green' {
    return this.meter < 0.33 ? 'red' : this.meter < 0.66 ? 'yellow' : 'green';
  }

  get parrandaReady() {
    return !this.parranda && this.hats >= MAX_HATS / 2;
  }

  get hitCount() {
    return this.grades.perfect + this.grades.good + this.grades.ok;
  }

  private moveMeter(delta: number, out: ScoreEvent[]) {
    this.meter = Math.max(0, Math.min(1, this.meter + delta));
    if (this.zone !== this.lastZone) {
      this.lastZone = this.zone;
      out.push({ type: 'meter-zone', zone: this.zone });
    }
    if (this.meter <= 0 && !this.noFail && !this.failed) {
      this.failed = true;
      out.push({ type: 'failed' });
    }
  }

  private breakChain(out: ScoreEvent[], kind: ErrorKind) {
    this.perfectStreak = 0;
    if (kind !== 'ghost' && this.graceLeft > 0) {
      this.graceLeft--;
      return;
    }
    if (kind === 'ghost') {
      // Like an overstrum: lose the lights progress, keep the level.
      this.chain = Math.floor(this.chain / NOTES_PER_LEVEL) * NOTES_PER_LEVEL;
      return;
    }
    const from = this.multiplier;
    if (from > 1) out.push({ type: 'multiplier-lost', from });
    if (this.streak > 0) out.push({ type: 'streak-broken', streak: this.streak });
    this.chain = 0;
    this.streak = 0;
  }

  private phraseFor(beat: number) {
    return this.phraseState.find((p) => beat >= p.range[0] && beat < p.range[1]);
  }

  apply(event: JudgeEvent): ScoreEvent[] {
    const out: ScoreEvent[] = [];
    if (event.type === 'hit') {
      const before = this.multiplier;
      this.grades[event.grade]++;
      this.score += POINTS[event.grade] * this.multiplier;
      const phrase = this.phraseFor(event.note.t);
      if (event.bellowsWrong) {
        this.errors.bellows++;
        this.moveMeter(METER.wrong, out);
        this.breakChain(out, 'bellows');
        if (phrase) phrase.broken = true;
        return out;
      }
      this.moveMeter(METER[event.grade], out);
      this.streak++;
      this.chain++;
      this.perfectStreak = event.grade === 'perfect' ? this.perfectStreak + 1 : 0;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      if (this.multiplier > before) out.push({ type: 'multiplier-up', multiplier: this.multiplier });
      if (STREAK_MILESTONES.includes(this.streak)) out.push({ type: 'milestone', streak: this.streak });
      if (!this.beatenAnnounced && this.bestStreakBefore > 0 && this.streak > this.bestStreakBefore) {
        this.beatenAnnounced = true;
        out.push({ type: 'best-streak-beaten', streak: this.streak });
      }
      if (phrase && !phrase.broken && !phrase.done && ++phrase.hit >= phrase.total) {
        phrase.done = true;
        const wasReady = this.parrandaReady;
        this.hats = Math.min(MAX_HATS, this.hats + HAT_PER_PHRASE);
        out.push({ type: 'hats', hats: this.hats });
        if (!wasReady && this.parrandaReady) out.push({ type: 'parranda-ready' });
      }
    } else if (event.type === 'sustain') {
      const points = event.beats * SUSTAIN_POINTS_PER_BEAT * this.multiplier;
      this.score += points;
      this.sustainPoints += points;
    } else if (event.type === 'sustain-end' && event.complete) {
      this.moveMeter(METER.sustain, out);
    } else if (event.type === 'error') {
      // Wrong bellows is already scored by its 'hit' (OK points, chain broken); the error event is only a label.
      if (event.kind === 'bellows') return out;
      this.errors[event.kind]++;
      if (event.note) {
        const phrase = this.phraseFor(event.note.t);
        if (phrase) phrase.broken = true;
      }
      this.moveMeter(event.kind === 'ghost' ? METER.ghost : event.kind === 'missed' ? METER.miss : METER.wrong, out);
      this.breakChain(out, event.kind);
    } else if (event.type === 'reclassify') {
      this.errors[event.from]--;
      this.errors[event.to]++;
    }
    this.score = Math.round(this.score);
    return out;
  }

  /** Enter / bellows shake. */
  activateParranda(): ScoreEvent[] {
    if (!this.parrandaReady) return [];
    this.parranda = true;
    this.parrandaBeatsLeft = this.hats * PARRANDA_BEATS_PER_HAT;
    return [{ type: 'parranda-start' }];
  }

  /** Drain Parranda over time (in beats). */
  advance(beats: number): ScoreEvent[] {
    if (!this.parranda || beats <= 0) return [];
    this.parrandaBeatsLeft -= beats;
    this.hats = Math.max(0, this.parrandaBeatsLeft / PARRANDA_BEATS_PER_HAT);
    if (this.parrandaBeatsLeft <= 0) {
      this.parranda = false;
      this.hats = 0;
      return [{ type: 'parranda-end' }];
    }
    return [];
  }

  /** Total notes judged (hits + note-consuming errors). */
  accuracy(totalNotes: number) {
    return totalNotes ? this.hitCount / totalNotes : 0;
  }
}

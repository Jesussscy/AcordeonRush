import type { Bellows } from './chart';
import type { ResolvedNote } from './fingering';
import { melodyButtons, type InstrumentKey } from '../instrument/accordion-catalog';

export type Grade = 'perfect' | 'good' | 'ok';
export type ErrorKind = 'missed' | 'button' | 'bellows' | 'early' | 'late' | 'ghost';

/** Timing windows in seconds (spec: ±35 / ±70 / ±110 ms). */
export const WINDOWS = { perfect: 0.035, good: 0.07, ok: 0.11, early: 0.25 };

export type GameNote = ResolvedNote & {
  id: number;
  /** Seconds (song time). */
  start: number;
  end: number;
  sustained: boolean;
  parranda: boolean;
  state: 'pending' | 'hit' | 'missed';
  grade?: Grade;
  /** Error that consumed the note (missed notes) or flagged it (bellows). */
  error?: ErrorKind;
  holding: boolean;
  sustainedBeats: number;
  earlyAttempt: boolean;
  /** Correct button already held with the wrong bellows: waiting for a bellows "strum". */
  awaitingBellows: boolean;
};

export type JudgeEvent =
  | { type: 'hit'; note: GameNote; grade: Grade; offset: number; bellowsWrong: boolean }
  | { type: 'error'; kind: ErrorKind; note?: GameNote; pressed?: InstrumentKey; offset?: number }
  | { type: 'reclassify'; note: GameNote; from: ErrorKind; to: ErrorKind }
  | { type: 'bellows-needed'; note: GameNote }
  | { type: 'early-press'; note: GameNote; offset: number }
  | { type: 'sustain'; note: GameNote; beats: number }
  | { type: 'sustain-end'; note: GameNote; complete: boolean };

export type JudgeOptions = {
  /** Semitone shift of the tuning (sounding = layout note + shift). */
  shift?: number;
  /** "Fuelle asistido": bellows direction is never judged. */
  assistedBellows?: boolean;
  bpm: number;
};

const gradeFor = (offset: number): Grade =>
  Math.abs(offset) <= WINDOWS.perfect ? 'perfect' : Math.abs(offset) <= WINDOWS.good ? 'good' : 'ok';

/**
 * Pure rhythm judge. Buttons are frets and the bellows is the strum: a note is hit when, inside the
 * timing window, the held button sounds the note's pitch in the current bellows direction. Pressing the
 * right button with the wrong bellows waits for a bellows change until the window closes.
 */
export class Judge {
  readonly notes: GameNote[];
  bellows: Bellows = 'pull';
  private held = new Set<string>();
  private cursor = 0;
  private readonly shift: number;
  private readonly assisted: boolean;
  private readonly secondsPerBeat: number;

  constructor(notes: GameNote[], options: JudgeOptions) {
    this.notes = notes;
    this.shift = options.shift ?? 0;
    this.assisted = options.assistedBellows ?? false;
    this.secondsPerBeat = 60 / options.bpm;
  }

  static buildNotes(resolved: ResolvedNote[], bpm: number, parrandaPhrases: [number, number][]): GameNote[] {
    const spb = 60 / bpm;
    return resolved.map((n, id) => ({
      ...n,
      id,
      start: n.t * spb,
      end: (n.t + n.dur) * spb,
      sustained: n.dur >= 1,
      parranda: parrandaPhrases.some(([a, b]) => n.t >= a && n.t < b),
      state: 'pending',
      holding: false,
      sustainedBeats: 0,
      earlyAttempt: false,
      awaitingBellows: false,
    }));
  }

  isHeld(buttonId: string) {
    return this.held.has(buttonId);
  }

  private sounds(button: InstrumentKey, direction: Bellows, note: GameNote) {
    return button[direction][0] + this.shift === note.midi;
  }

  private soundsNow(button: InstrumentKey, note: GameNote) {
    return this.assisted
      ? this.sounds(button, 'push', note) || this.sounds(button, 'pull', note)
      : this.sounds(button, this.bellows, note);
  }

  /** Pending notes whose start is within [t - before, t + after], nearest first. */
  private pendingNear(t: number, before: number, after: number) {
    const result: GameNote[] = [];
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.start > t + after) break;
      if (n.state === 'pending' && n.start >= t - before) result.push(n);
    }
    return result.sort((a, b) => Math.abs(a.start - t) - Math.abs(b.start - t));
  }

  private hit(note: GameNote, t: number, bellowsWrong = false): JudgeEvent {
    const offset = t - note.start;
    note.state = 'hit';
    note.grade = bellowsWrong ? 'ok' : gradeFor(offset);
    note.awaitingBellows = false;
    if (bellowsWrong) note.error = 'bellows';
    note.holding = note.sustained && !bellowsWrong;
    return { type: 'hit', note, grade: note.grade, offset, bellowsWrong };
  }

  press(buttonId: string, t: number): JudgeEvent[] {
    const button = melodyButtons.find((b) => b.id === buttonId);
    if (!button || this.held.has(buttonId)) return [];
    this.held.add(buttonId);
    const near = this.pendingNear(t, WINDOWS.ok, WINDOWS.ok);
    const target = near[0];
    if (target) {
      // Alternate fingerings that produce the same pitch count as correct.
      if (this.soundsNow(button, target)) return [this.hit(target, t)];
      const other: Bellows = this.bellows === 'push' ? 'pull' : 'push';
      if (this.sounds(button, other, target)) {
        target.awaitingBellows = true;
        return [{ type: 'bellows-needed', note: target }];
      }
      // Another pending note in the window may be the intended one.
      const alternative = near.find((n) => this.soundsNow(button, n));
      if (alternative) return [this.hit(alternative, t)];
      target.state = 'missed';
      target.error = 'button';
      return [{ type: 'error', kind: 'button', note: target, pressed: button, offset: t - target.start }];
    }
    // Outside the window: decide between "TEMPRANO" (next note) and "TARDE" (note that just went by),
    // using the note this button actually sounds, nearest in time.
    const plays = (n: GameNote) => this.sounds(button, 'push', n) || this.sounds(button, 'pull', n);
    const upcoming = this.pendingNear(t, 0, WINDOWS.early).find(plays);
    let recent: GameNote | undefined;
    for (let i = this.cursor - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (t - n.start > WINDOWS.early) break;
      if (n.state === 'missed' && n.error === 'missed' && plays(n)) {
        recent = n;
        break;
      }
    }
    if (recent && (!upcoming || t - recent.start < upcoming.start - t)) {
      recent.error = 'late';
      return [{ type: 'reclassify', note: recent, from: 'missed', to: 'late' }];
    }
    if (upcoming) {
      upcoming.earlyAttempt = true;
      return [{ type: 'early-press', note: upcoming, offset: t - upcoming.start }];
    }
    return [{ type: 'error', kind: 'ghost', pressed: button }];
  }

  release(buttonId: string, t: number): JudgeEvent[] {
    if (!this.held.delete(buttonId)) return [];
    const events: JudgeEvent[] = [];
    for (const n of this.notes) {
      if (n.holding && n.button.id === buttonId) {
        n.holding = false;
        events.push({ type: 'sustain-end', note: n, complete: t >= n.end - Math.min(0.15, this.secondsPerBeat / 3) });
      }
      if (n.awaitingBellows && n.button.id === buttonId && n.state === 'pending') n.awaitingBellows = false;
    }
    return events;
  }

  /** Bellows change: the "strum". */
  setBellows(direction: Bellows, t: number): JudgeEvent[] {
    if (direction === this.bellows) return [];
    this.bellows = direction;
    const events: JudgeEvent[] = [];
    if (!this.assisted)
      for (const n of this.notes) {
        if (n.holding && !this.sounds(n.button, direction, n)) {
          n.holding = false;
          events.push({ type: 'sustain-end', note: n, complete: t >= n.end - Math.min(0.15, this.secondsPerBeat / 3) });
        }
      }
    for (const n of this.pendingNear(t, WINDOWS.ok, WINDOWS.ok)) {
      const held = melodyButtons.find((b) => this.held.has(b.id) && this.soundsNow(b, n));
      if (held) {
        events.push(this.hit(n, t));
        break;
      }
    }
    return events;
  }

  /** Advance time: misses, bellows deadlines and sustain scoring. */
  update(t: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.start > t) break;
      if (n.state !== 'pending' || t <= n.start + WINDOWS.ok) continue;
      if (n.awaitingBellows && this.held.has(n.button.id)) {
        events.push(this.hit(n, n.start + WINDOWS.ok, true));
        events.push({ type: 'error', kind: 'bellows', note: n });
      } else {
        n.state = 'missed';
        n.error = n.earlyAttempt ? 'early' : 'missed';
        events.push({ type: 'error', kind: n.error, note: n });
      }
    }
    while (
      this.cursor < this.notes.length &&
      this.notes[this.cursor].state !== 'pending' &&
      !this.notes[this.cursor].holding
    )
      this.cursor++;
    for (let i = Math.max(0, this.cursor - 8); i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.start > t) break;
      if (!n.holding) continue;
      const beats = Math.min(t, n.end) / this.secondsPerBeat - n.t - n.sustainedBeats;
      if (beats > 0) {
        n.sustainedBeats += beats;
        events.push({ type: 'sustain', note: n, beats });
      }
      if (t >= n.end) {
        n.holding = false;
        events.push({ type: 'sustain-end', note: n, complete: true });
      }
    }
    return events;
  }

  /** Practice loops: every note back to pending. */
  reset() {
    for (const n of this.notes) {
      n.state = 'pending';
      n.grade = undefined;
      n.error = undefined;
      n.holding = false;
      n.sustainedBeats = 0;
      n.earlyAttempt = false;
      n.awaitingBellows = false;
    }
    this.held.clear();
    this.cursor = 0;
  }

  get finished() {
    const last = this.notes.at(-1);
    return !last || this.notes.every((n) => n.state !== 'pending' && !n.holding);
  }
}

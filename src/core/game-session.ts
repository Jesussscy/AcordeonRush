import * as THREE from 'three';
import { AccompanimentPlayer, buildAccompaniment } from '../audio/accompaniment';
import { createAccordionAudio, SAMPLE_BANK_URL, type AccordionAudio } from '../audio/accordion-sampler.js';
import type { Bellows, ParsedChart } from '../gameplay/chart';
import { chartForDifficulty, type Difficulty } from '../gameplay/difficulty';
import { bellowsChanges } from '../gameplay/fingering';
import { Highway, LANE_X } from '../gameplay/highway/highway';
import { Judge, type GameNote, type JudgeEvent } from '../gameplay/judge';
import { ScoreKeeper, SUSTAIN_POINTS_PER_BEAT, type ScoreEvent } from '../gameplay/scoring';
import type { SongEntry } from '../gameplay/song-catalog';
import { Hud } from '../hud/Hud';
import type { HudApi } from '../hud/hud-types';
import { keyLabel } from '../input/bindings';
import { GameInput } from '../input/game-input';
import { MidiInput } from '../input/midi-input';
import { getTuning, melodyButtons, type instrumentDesigns } from '../instrument/accordion-catalog';
import { AccordionRig } from '../instrument/accordion-rig';
import { GameRenderer } from '../render/game-renderer';
import { solfege } from '../utils/notes';
import { GameClock } from './game-clock';
import { getRecord } from './records';
import type { Settings } from './settings';

export type GameMode = 'game' | 'practice';

export type SessionConfig = {
  entry: SongEntry;
  chart: ParsedChart;
  difficulty: Difficulty;
  design: (typeof instrumentDesigns)[number];
  mode: GameMode;
  /** Practice speed 0.5…1. */
  rate?: number;
  /** Practice: show the note name on gems. */
  showNoteNames?: boolean;
  /** Practice: loop these beats [start, end). */
  loop?: [number, number] | null;
  settings: Settings;
};

export type GameResult = {
  songId: string;
  title: string;
  difficulty: Difficulty;
  mode: GameMode;
  failed: boolean;
  score: number;
  maxScore: number;
  stars: number;
  accuracy: number;
  totalNotes: number;
  maxStreak: number;
  bestStreakBefore: number;
  grades: ScoreKeeper['grades'];
  errors: ScoreKeeper['errors'];
};

export type SessionCallbacks = {
  onStatus?(text: string): void;
  onReady?(): void;
  onPause?(paused: boolean): void;
  onFinish?(result: GameResult): void;
};

const LEAD_IN_BEATS = 4;

/** One play of one song. Owns audio, renderer, input and game state; React only mounts and unmounts it. */
export class GameSession {
  readonly notes: GameNote[];
  private readonly judge: Judge;
  readonly score: ScoreKeeper;
  private readonly renderer: GameRenderer;
  private readonly highway: Highway;
  private readonly rig = new AccordionRig();
  private hud?: HudApi;
  private input?: GameInput;
  private midi?: MidiInput;
  private ctx?: AudioContext;
  private audio?: AccordionAudio;
  private clock?: GameClock;
  private accompaniment?: AccompanimentPlayer;
  private raf = 0;
  private lastFrame = 0;
  private lastBeat = -Infinity;
  private paused = false;
  private finished = false;
  private disposed = false;
  private readonly held = new Set<string>();
  private bellows: Bellows = 'pull';
  private readonly lengthSeconds: number;
  private readonly secondsPerBeat: number;
  private readonly shift: number;
  private readonly bestStreakBefore: number;
  private readonly bellowsTimes: number[] = [];
  readonly changes: { t: number; direction: Bellows }[];

  constructor(
    private readonly container: HTMLElement,
    readonly config: SessionConfig,
    private readonly callbacks: SessionCallbacks = {},
  ) {
    const { chart } = config;
    this.secondsPerBeat = 60 / chart.bpm;
    this.lengthSeconds = chart.lengthBeats * this.secondsPerBeat;
    this.shift = getTuning(chart.tuning).semitones;
    const derived = chartForDifficulty(chart, config.difficulty);
    this.notes = Judge.buildNotes(derived.notes, chart.bpm, chart.parrandaPhrases);
    this.changes = bellowsChanges(derived.notes);
    this.judge = new Judge(this.notes, {
      bpm: chart.bpm,
      shift: this.shift,
      assistedBellows: config.settings.assistedBellows,
    });
    this.bestStreakBefore = getRecord(config.entry.id, config.difficulty)?.maxStreak ?? 0;
    this.score = new ScoreKeeper({
      graceErrors: config.difficulty === 'easy' ? 2 : 0,
      noFail: config.mode === 'practice',
      bestStreak: this.bestStreakBefore,
      parrandaPhrases: chart.parrandaPhrases,
      noteBeats: this.notes.map((n) => n.t),
    });
    this.renderer = new GameRenderer(container, config.settings.quality);
    const layout = config.settings.keyboardLayout;
    this.highway = new Highway(this.notes, {
      bpm: chart.bpm,
      lengthBeats: chart.lengthBeats,
      beatsPerBar: chart.timeSignature[0],
      bellowsChanges: this.changes,
      label: (note) => ({
        code: note.button.code,
        key: config.settings.showKeyHints
          ? keyLabel(config.settings.bindings.buttons[note.button.id], layout)
          : undefined,
        noteName: config.showNoteNames ? solfege(note.midi) : undefined,
      }),
    });
    this.renderer.scene.add(this.highway.group);
    this.renderer.setAccordion(this.rig);
  }

  /** Load samples and the 3D model, then start the count-in. */
  async start() {
    this.callbacks.onStatus?.('Cargando acordeón y grabaciones…');
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    void ctx.resume().catch(() => undefined);
    const [audio] = await Promise.all([
      createAccordionAudio({ context: ctx, baseURL: new URL(SAMPLE_BANK_URL, location.origin) }).then(async (a) => {
        await a.preload();
        return a;
      }),
      this.rig.load(this.config.design.model),
    ]);
    if (this.disposed) {
      audio.dispose();
      return;
    }
    this.audio = audio;
    audio.setPlayingMode('direct');
    audio.setTuning(this.config.chart.tuning);
    audio.setProfile('vallenato-high');
    audio.setVolume(this.config.settings.volume);
    audio.setDirection(this.bellows);
    const master = ctx.createGain();
    master.gain.value = this.config.settings.volume;
    master.connect(ctx.destination);
    this.accompaniment = new AccompanimentPlayer(
      audio,
      buildAccompaniment(this.config.chart),
      this.secondsPerBeat,
      master,
    );
    const rate = this.config.rate ?? 1;
    this.clock = new GameClock(
      ctx,
      this.config.chart.bpm,
      rate,
      this.config.settings.audioOffsetMs / 1000,
      this.config.settings.videoOffsetMs / 1000,
    );
    const startBeat = this.config.loop?.[0] ?? 0;
    this.accompaniment.seek(startBeat - LEAD_IN_BEATS);
    this.clock.start((startBeat - LEAD_IN_BEATS) * this.secondsPerBeat);
    this.hud = new Hud(this.container, { title: this.config.chart.title, artist: this.config.chart.artist });
    this.input = new GameInput(this.config.settings.bindings, {
      press: (id, ts) => this.press(id, ts),
      release: (id, ts) => this.release(id, ts),
      bellows: (direction, ts) => this.setBellows(direction, ts),
      parranda: () => this.activateParranda(),
      pause: () => (this.paused ? this.resume() : this.pause()),
    });
    // Optional MIDI controller: the bellows follows each MIDI note (keyboards have no bellows).
    this.midi = new MidiInput(
      {
        press: (id, ts, direction) => {
          if (direction !== this.bellows && !this.config.settings.assistedBellows) this.setBellows(direction, ts);
          this.press(id, ts);
        },
        release: (id, ts) => this.release(id, ts),
      },
      () => this.shift,
      () => this.bellows,
    );
    void this.midi.connect();
    this.callbacks.onReady?.();
    this.lastFrame = performance.now();
    this.loop();
  }

  private now() {
    return this.clock?.heardNow() ?? 0;
  }

  private press(id: string, timeStamp: number) {
    if (!this.clock || this.paused || this.finished) return;
    const button = melodyButtons.find((b) => b.id === id);
    if (!button) return;
    this.held.add(id);
    this.audio?.noteOn(button.bone);
    this.handle(this.judge.press(id, this.clock.eventTime(timeStamp)));
  }

  private release(id: string, timeStamp: number) {
    if (!this.held.delete(id)) return;
    const button = melodyButtons.find((b) => b.id === id);
    if (button) this.audio?.noteOff(button.bone);
    if (this.clock) this.handle(this.judge.release(id, this.clock.eventTime(timeStamp)));
  }

  private setBellows(direction: Bellows, timeStamp: number) {
    if (this.config.settings.assistedBellows || this.paused) return;
    this.bellows = direction;
    this.audio?.setDirection(direction);
    if (!this.clock) return;
    const t = this.clock.eventTime(timeStamp);
    this.bellowsTimes.push(t);
    // Shaking the bellows (4 flips in 0.7 s) activates Parranda.
    const recent = this.bellowsTimes.filter((x) => t - x < 0.7);
    if (recent.length >= 4 && this.score.parrandaReady) {
      this.bellowsTimes.length = 0;
      this.activateParranda();
    }
    this.handle(this.judge.setBellows(direction, t));
  }

  private activateParranda() {
    this.scoreEvents(this.score.activateParranda());
  }

  /** Screen position above a lane's target ring, for floating labels. */
  private laneScreen(row: number) {
    return this.renderer.toScreen(new THREE.Vector3(LANE_X[row], 0.9, 0));
  }

  private handle(events: JudgeEvent[]) {
    for (const event of events) {
      if (event.type === 'hit') {
        this.highway.markHit(event.note, this.now());
        if (event.bellowsWrong) this.hud?.error('bellows', this.laneScreen(event.note.row));
        else this.hud?.timing(event.grade, event.offset, this.laneScreen(event.note.row));
      } else if (event.type === 'error') {
        const row = event.note?.row ?? event.pressed?.row ?? 1;
        if (event.kind !== 'bellows') this.hud?.error(event.kind, this.laneScreen(row));
        if (event.note && event.kind !== 'bellows') this.highway.markMissed(event.note);
        if (event.kind === 'button' && event.note && event.pressed) {
          this.rig.flash(event.pressed.id, 'wrong', 0.8);
          this.rig.flash(event.note.button.id, 'hint', 0.8);
        }
      } else if (event.type === 'reclassify') {
        this.hud?.error(event.to, this.laneScreen(event.note.row));
      } else if (event.type === 'early-press') {
        this.hud?.error('early', this.laneScreen(event.note.row));
      } else if (event.type === 'bellows-needed') {
        this.hud?.bellowsHint(event.note.direction);
      } else if (event.type === 'sustain-end' && !event.complete) {
        this.highway.markSustainBroken(event.note);
      }
      this.scoreEvents(this.score.apply(event));
    }
  }

  private scoreEvents(events: ScoreEvent[]) {
    for (const e of events) {
      if (e.type === 'milestone') this.hud?.milestone(e.streak);
      else if (e.type === 'streak-broken') this.hud?.streakBroken(e.streak);
      else if (e.type === 'multiplier-up') this.hud?.multiplierUp(e.multiplier);
      else if (e.type === 'multiplier-lost') this.hud?.multiplierLost();
      else if (e.type === 'best-streak-beaten') this.hud?.bestStreakBeaten(e.streak);
      else if (e.type === 'parranda-ready') this.hud?.parrandaReady();
      else if (e.type === 'parranda-start') {
        this.highway.setGold(true);
        this.hud?.parranda(true);
      } else if (e.type === 'parranda-end') {
        this.highway.setGold(false);
        this.hud?.parranda(false);
      } else if (e.type === 'meter-zone') this.hud?.meterZone(e.zone);
      else if (e.type === 'failed') this.finish(true);
    }
  }

  /** In "fuelle asistido" the game moves the bellows to the next note's direction. */
  private assist(now: number) {
    const next = this.notes.find((n) => (n.state === 'pending' || n.holding) && n.end > now);
    if (next && next.direction !== this.bellows && next.start - now < 0.25) {
      this.bellows = next.direction;
      this.audio?.setDirection(next.direction);
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const frame = performance.now();
    const dt = Math.min(0.05, (frame - this.lastFrame) / 1000);
    this.lastFrame = frame;
    const clock = this.clock;
    if (!clock || !this.audio) return;
    const now = clock.heardNow();
    if (!this.paused && !this.finished) {
      if (this.config.settings.assistedBellows) this.assist(now);
      this.accompaniment?.pump(clock.ctxTimeOfBeat, clock.rate);
      this.handle(this.judge.update(now));
      const beat = now / this.secondsPerBeat;
      if (this.lastBeat > -Infinity) this.scoreEvents(this.score.advance(beat - this.lastBeat));
      this.lastBeat = beat;
      const end = this.config.loop ? this.config.loop[1] * this.secondsPerBeat : this.lengthSeconds;
      if (now > end + 0.6 && this.judge.finished) this.finish(false);
    }
    const visual = clock.visualNow();
    const beatPhase = (((visual / this.secondsPerBeat) % 1) + 1) % 1;
    const heldLanes = new Set([...this.held].map((id) => melodyButtons.find((b) => b.id === id)!.row));
    this.highway.update(visual, heldLanes, beatPhase);
    this.rig.setPressed(this.held);
    // Bellows opening follows the direction while air flows.
    const flowing = this.held.size > 0 || this.notes.some((n) => n.holding);
    if (flowing)
      this.rig.opening = Math.min(
        0.96,
        Math.max(0.04, this.rig.opening + dt * (this.bellows === 'pull' ? 0.22 : -0.22)),
      );
    else this.rig.opening += (0.45 - this.rig.opening) * Math.min(1, dt * 0.6);
    this.rig.update(dt);
    this.renderer.setZoom(this.score.parranda ? 0.5 + 0.5 * (1 - beatPhase) : 0);
    this.hud?.update(
      {
        score: this.score.score,
        multiplier: this.score.multiplier,
        lights: this.score.lights,
        streak: this.score.streak,
        bestStreak: Math.max(this.bestStreakBefore, this.score.maxStreak),
        perfectStreak: this.score.perfectStreak,
        meter: this.score.meter,
        zone: this.score.zone,
        hats: this.score.hats,
        parrandaReady: this.score.parrandaReady,
        parranda: this.score.parranda,
        progress: Math.max(0, Math.min(1, now / this.lengthSeconds)),
        countdown: -now,
        bellows: this.bellows,
      },
      dt,
    );
    this.renderer.render(dt);
  };

  pause() {
    if (this.paused || this.finished || !this.ctx) return;
    this.paused = true;
    this.input?.releaseAll();
    void this.ctx.suspend();
    this.callbacks.onPause?.(true);
  }

  resume() {
    if (!this.paused || !this.ctx) return;
    this.paused = false;
    void this.ctx.resume();
    this.callbacks.onPause?.(false);
  }

  private maxScore() {
    let total = 0;
    this.notes.forEach((n, i) => {
      const multiplier = Math.min(4, 1 + Math.floor(i / 10));
      total += 50 * multiplier + (n.sustained ? n.dur * SUSTAIN_POINTS_PER_BEAT * multiplier : 0);
    });
    return Math.round(total);
  }

  private finish(failed: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.input?.releaseAll();
    this.audio?.allNotesOff();
    if (failed) this.hud?.banner('¡Se acabó la parranda!', 'fail');
    const maxScore = this.maxScore();
    const ratio = maxScore ? this.score.score / maxScore : 0;
    const stars = failed ? 0 : ratio >= 0.9 ? 5 : ratio >= 0.7 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.3 ? 2 : 1;
    const result: GameResult = {
      songId: this.config.entry.id,
      title: this.config.chart.title,
      difficulty: this.config.difficulty,
      mode: this.config.mode,
      failed,
      score: this.score.score,
      maxScore,
      stars,
      accuracy: this.score.accuracy(this.notes.length),
      totalNotes: this.notes.length,
      maxStreak: this.score.maxStreak,
      bestStreakBefore: this.bestStreakBefore,
      grades: { ...this.score.grades },
      errors: { ...this.score.errors },
    };
    setTimeout(() => this.callbacks.onFinish?.(result), failed ? 2200 : 900);
  }

  /** Read-only snapshot for automated tests (window.__VH__ in debug mode). */
  debugSnapshot() {
    return {
      ready: Boolean(this.clock && this.input),
      now: this.now(),
      paused: this.paused,
      finished: this.finished,
      score: this.score.score,
      streak: this.score.streak,
      maxStreak: this.score.maxStreak,
      multiplier: this.score.multiplier,
      meter: this.score.meter,
      hats: this.score.hats,
      parranda: this.score.parranda,
      grades: { ...this.score.grades },
      errors: { ...this.score.errors },
      bellows: this.bellows,
    };
  }

  debugNotes() {
    return this.notes.map((n) => ({
      id: n.id,
      start: n.start,
      end: n.end,
      buttonId: n.button.id,
      code: n.button.code,
      key: this.config.settings.bindings.buttons[n.button.id],
      direction: n.direction,
      row: n.row,
      state: n.state,
      grade: n.grade,
      error: n.error,
      sustained: n.sustained,
    }));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input?.dispose();
    this.midi?.dispose();
    this.hud?.dispose();
    this.accompaniment?.dispose();
    this.audio?.dispose();
    void this.ctx?.close().catch(() => undefined);
    this.highway.dispose();
    this.rig.dispose();
    this.renderer.dispose();
  }
}

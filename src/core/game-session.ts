import * as THREE from 'three';
import { AccompanimentPlayer, buildAccompaniment } from '../audio/accompaniment';
import { createAccordionAudio, SAMPLE_BANK_URL, type AccordionAudio } from '../audio/accordion-sampler.js';
import { BackingTrack } from '../audio/backing-track';
import { Sfx } from '../audio/sfx';
import type { Bellows, ParsedChart } from '../gameplay/chart';
import { chartForDifficulty, type Difficulty } from '../gameplay/difficulty';
import { bellowsChanges } from '../gameplay/fingering';
import { Highway, LANE_COLORS, LANE_X } from '../gameplay/highway/highway';
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
import { createBloom } from '../render/post-processing';
import { Sparks } from '../render/sparks';
import { Stage } from '../stage/stage';
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

/** Optional scene decoration driven by the game (stage, characters, crowd — see render/stage). */
export interface StageHooks {
  update(dt: number, info: { beat: number; beatPhase: number; meter: number; parranda: boolean; opening: number }): void;
  reaction(kind: 'cheer' | 'boo' | 'hit'): void;
  dispose(): void;
}

const LEAD_IN_BEATS = 4;
/** Smoothing time constant of the miss → recovery ramp: ≈ 95 % recovered after 3τ = 300 ms. */
const RECOVERY_TAU = 0.1;

/** One play of one song. Owns audio, renderer, input and game state; React only mounts and unmounts it. */
export class GameSession {
  readonly notes: GameNote[];
  private readonly judge: Judge;
  readonly score: ScoreKeeper;
  private readonly renderer: GameRenderer;
  private readonly highway: Highway;
  private readonly sparks = new Sparks();
  private readonly rig = new AccordionRig();
  stage?: StageHooks;
  private hud?: HudApi;
  private input?: GameInput;
  private midi?: MidiInput;
  private ctx?: AudioContext;
  private audio?: AccordionAudio;
  private clock?: GameClock;
  private accompaniment?: AccompanimentPlayer;
  private backing?: BackingTrack;
  private sfx?: Sfx;
  private raf = 0;
  private lastFrame = 0;
  private lastBeat = -Infinity;
  private lastSustainSpark = 0;
  private paused = false;
  private finished = false;
  private disposed = false;
  private consecutiveErrors = 0;
  private loops = 0;
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
    const loop = config.loop;
    const resolved = loop ? derived.notes.filter((n) => n.t >= loop[0] && n.t < loop[1]) : derived.notes;
    this.notes = Judge.buildNotes(resolved, chart.bpm, chart.parrandaPhrases);
    this.changes = bellowsChanges(resolved);
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
    this.renderer.scene.add(this.highway.group, this.sparks.points);
    this.renderer.setAccordion(this.rig);
    this.stage = new Stage(this.renderer.scene, config.settings.quality);
    if (config.settings.quality === 'high')
      this.renderer.postProcess = createBloom(this.renderer.renderer, this.renderer.scene, this.renderer.camera);
  }

  private get rate() {
    return this.config.rate ?? 1;
  }

  /** Load samples, the 3D model and the song audio, then start the count-in. */
  async start() {
    this.callbacks.onStatus?.('Cargando acordeón y grabaciones…');
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    void ctx.resume().catch(() => undefined);
    const master = ctx.createGain();
    master.gain.value = this.config.settings.volume;
    master.connect(ctx.destination);
    // A recorded track is only used at full speed: slowing an AudioBuffer would also lower its pitch.
    const useTrack = Boolean(this.config.entry.audioUrl) && this.rate === 1;
    const [audio, backing] = await Promise.all([
      createAccordionAudio({ context: ctx, baseURL: new URL(SAMPLE_BANK_URL, location.origin) }).then(async (a) => {
        await a.preload();
        return a;
      }),
      useTrack ? BackingTrack.load(ctx, this.config.entry.audioUrl!, master) : Promise.resolve(undefined),
      this.rig.load(this.config.design.model),
    ]);
    if (this.disposed) {
      audio.dispose();
      backing?.dispose();
      return;
    }
    this.audio = audio;
    this.backing = backing;
    audio.setPlayingMode('direct');
    audio.setTuning(this.config.chart.tuning);
    audio.setProfile('vallenato-high');
    audio.setVolume(this.config.settings.volume * (backing ? 0.7 : 1));
    audio.setDirection(this.bellows);
    this.sfx = new Sfx(audio, master);
    this.accompaniment = new AccompanimentPlayer(
      audio,
      buildAccompaniment(this.config.chart),
      this.secondsPerBeat,
      master,
    );
    // With a recorded track only the count-in clicks are synthesized.
    if (backing) this.accompaniment.onlyClicks = true;
    this.clock = new GameClock(
      ctx,
      this.config.chart.bpm,
      this.rate,
      this.config.settings.audioOffsetMs / 1000,
      this.config.settings.videoOffsetMs / 1000,
    );
    this.startAt(this.config.loop?.[0] ?? 0);
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

  /** (Re)start the clock, accompaniment and track with a one-bar count-in before `beat`. */
  private startAt(beat: number) {
    const clock = this.clock!;
    const from = (beat - LEAD_IN_BEATS) * this.secondsPerBeat;
    this.accompaniment?.seek(beat - LEAD_IN_BEATS);
    clock.start(from);
    this.lastBeat = -Infinity;
    if (this.backing) {
      const offset = this.config.chart.offsetMs / 1000;
      const songStart = Math.max(from, -offset);
      this.backing.start(clock.ctxTimeOf(songStart), songStart + offset);
    }
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

  /** Miss feedback: the accordion goes flat, wobbles, crunches and drops in level. */
  private missFeedback() {
    this.consecutiveErrors++;
    const amount = Math.min(1, 0.45 + 0.2 * (this.consecutiveErrors - 1));
    this.audio?.setMelodyFx(
      { detune: -(40 + 40 * amount), wobble: 18 * amount, crush: 0.8 * amount, level: 1 - 0.45 * amount },
      0.02,
    );
    this.backing?.setMissFx(amount, 0.02);
    this.renderer.shake(0.08 + 0.06 * amount);
    if (this.consecutiveErrors === 3 || (this.consecutiveErrors > 3 && this.consecutiveErrors % 4 === 0)) {
      this.sfx?.crowd('boo', amount);
      this.stage?.reaction('boo');
    }
  }

  /** A good note: smoothly back in tune (≈ 300 ms). */
  private recover() {
    if (this.consecutiveErrors === 0) return;
    this.consecutiveErrors = 0;
    this.audio?.setMelodyFx({}, RECOVERY_TAU);
    this.backing?.setMissFx(0, RECOVERY_TAU);
  }

  private hitSparks(note: GameNote) {
    const level = Math.min(4, this.score.multiplier);
    const gold = this.score.parranda || note.parranda;
    this.sparks.burst(
      LANE_X[note.row],
      0,
      gold ? 0xffc23a : LANE_COLORS[note.row],
      10 + level * 6 + (gold ? 10 : 0),
      0.8 + level * 0.25 + (gold ? 0.4 : 0),
    );
  }

  private handle(events: JudgeEvent[]) {
    for (const event of events) {
      if (event.type === 'hit') {
        this.highway.markHit(event.note, this.now());
        if (event.bellowsWrong) {
          this.hud?.error('bellows', this.laneScreen(event.note.row));
          this.hud?.bellowsHint(event.note.direction);
          this.sfx?.pifia(event.note.midi);
          this.missFeedback();
        } else {
          this.hud?.timing(event.grade, event.offset, this.laneScreen(event.note.row));
          this.hitSparks(event.note);
          this.stage?.reaction('hit');
          this.recover();
        }
      } else if (event.type === 'error') {
        const row = event.note?.row ?? event.pressed?.row ?? 1;
        if (event.kind === 'bellows') continue;
        this.hud?.error(event.kind, this.laneScreen(row));
        if (event.note) this.highway.markMissed(event.note);
        if (event.kind === 'button' && event.note && event.pressed) {
          this.rig.flash(event.pressed.id, 'wrong', 0.9);
          this.rig.flash(event.note.button.id, 'hint', 0.9);
          this.sfx?.pifia(event.pressed[this.bellows][0] + this.shift);
        } else if (event.kind === 'ghost' && event.pressed) {
          this.rig.flash(event.pressed.id, 'wrong', 0.4);
        } else if (event.note) {
          this.rig.flash(event.note.button.id, 'hint', 0.6);
        }
        if (event.kind !== 'ghost') this.missFeedback();
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
      if (e.type === 'milestone') {
        this.hud?.milestone(e.streak);
        this.sfx?.crowd('cheer', Math.min(1.4, 0.7 + e.streak / 200));
        this.stage?.reaction('cheer');
      } else if (e.type === 'streak-broken') {
        this.hud?.streakBroken(e.streak);
        if (e.streak >= 5) this.sfx?.thud();
      } else if (e.type === 'multiplier-up') this.hud?.multiplierUp(e.multiplier);
      else if (e.type === 'multiplier-lost') this.hud?.multiplierLost();
      else if (e.type === 'best-streak-beaten') this.hud?.bestStreakBeaten(e.streak);
      else if (e.type === 'parranda-ready') this.hud?.parrandaReady();
      else if (e.type === 'parranda-start') {
        this.highway.setGold(true);
        this.hud?.parranda(true);
        this.sfx?.crowd('cheer', 1.4);
        this.stage?.reaction('cheer');
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

  /** Practice loop: rewind to the start of the section and replay it. */
  private restartLoop() {
    const loop = this.config.loop!;
    this.loops++;
    this.input?.releaseAll();
    this.audio?.allNotesOff();
    this.judge.reset();
    this.highway.reset();
    this.startAt(loop[0]);
    this.hud?.banner(`Vuelta ${this.loops + 1}`);
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
      if (this.score.zone === 'red' && now > 0) this.sfx?.alarm();
      const loop = this.config.loop;
      if (loop && now > loop[1] * this.secondsPerBeat + 0.3) this.restartLoop();
      else if (!loop && now > this.lengthSeconds + 0.6 && this.judge.finished) this.finish(false);
      // Sustained notes spray sparks while held.
      if (frame - this.lastSustainSpark > 35)
        for (const n of this.notes)
          if (n.holding) {
            this.lastSustainSpark = frame;
            this.sparks.burst(LANE_X[n.row], 0, this.score.parranda ? 0xffc23a : LANE_COLORS[n.row], 3, 0.6);
          }
    }
    const visual = clock.visualNow();
    const visualBeat = visual / this.secondsPerBeat;
    const beatPhase = ((visualBeat % 1) + 1) % 1;
    const heldLanes = new Set([...this.held].map((id) => melodyButtons.find((b) => b.id === id)!.row));
    this.highway.update(visual, heldLanes, beatPhase);
    this.sparks.update(this.paused ? 0 : dt);
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
    this.stage?.update(this.paused ? 0 : dt, {
      beat: visualBeat,
      beatPhase,
      meter: this.score.meter,
      parranda: this.score.parranda,
      opening: this.rig.opening,
    });
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
    if (failed) {
      this.hud?.banner('¡Se acabó la parranda!', 'fail');
      this.sfx?.crowd('boo', 1.2);
      this.backing?.setMissFx(1, 0.3);
    }
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
    setTimeout(() => {
      this.backing?.stop();
      this.callbacks.onFinish?.(result);
    }, failed ? 2400 : 900);
  }

  /** Read-only snapshot for automated tests (window.__VH__ in debug mode). */
  debugSnapshot() {
    return {
      ready: Boolean(this.clock && this.input),
      now: this.now(),
      paused: this.paused,
      finished: this.finished,
      loops: this.loops,
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
      consecutiveErrors: this.consecutiveErrors,
      hasTrack: Boolean(this.backing),
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
    this.backing?.dispose();
    this.sfx?.dispose();
    this.audio?.dispose();
    void this.ctx?.close().catch(() => undefined);
    this.stage?.dispose();
    this.highway.dispose();
    this.sparks.dispose();
    this.rig.dispose();
    this.renderer.dispose();
  }
}

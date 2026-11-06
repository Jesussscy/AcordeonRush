export type BellowsDirection = 'push' | 'pull';

export type SoundSettings = {
  brightness?: number;
  body?: number;
  presence?: number;
  melody?: number;
  bass?: number;
  chord?: number;
  release?: number;
};

export type AudioDiagnostics = {
  rms: number;
  peak: number;
  contextState: string;
  playingMode: string;
  direction: BellowsDirection;
  expression: number;
  error: string;
  notes: number[];
};

export type AccordionAudio = {
  context: AudioContext;
  setPlayingMode(mode: 'direct' | 'manual'): void;
  setDirection(direction: BellowsDirection): void;
  setExpression(value: number): void;
  setSound(settings: SoundSettings): void;
  setReedWidth(value: number): void;
  scheduleNote(name: string, direction: BellowsDirection, when: number, duration: number, velocity?: number): void;
  /** Absolute concert-pitch MIDI notes on a bus (independent of setTuning). */
  scheduleMidi(
    midis: number[],
    part: 'melody' | 'bass' | 'chord',
    when: number,
    duration: number,
    velocity?: number,
  ): void;
  /** Gain node of a part bus (melody / bass / chord). */
  partBus(part: 'melody' | 'bass' | 'chord'): GainNode;
  getDiagnostics(): AudioDiagnostics;
  preload(): Promise<void>;
  unlock(): Promise<void>;
  noteOn(name: string): void;
  noteOff(name: string): void;
  setBellows(direction: BellowsDirection, pressure: number): void;
  setProfile(id: string): void;
  setTuning(id: string): void;
  setVolume(volume: number): void;
  /** Miss feedback on the melody bus ("desafine"). `time` = smoothing time constant in seconds. */
  setMelodyFx(fx: { detune?: number; wobble?: number; crush?: number; level?: number }, time?: number): void;
  allNotesOff(): void;
  dispose(): void;
};

/** Runtime URL of the sampled Hohner bank inside the assets/ publicDir. */
export const SAMPLE_BANK_URL: string;

export function createAccordionAudio(options: {
  context: AudioContext;
  baseURL: URL;
  manifest?: unknown;
}): Promise<AccordionAudio>;

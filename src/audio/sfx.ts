import type { AccordionAudio } from './accordion-sampler.js';

/** Three dissonant accordion "pifia" clusters (semitone offsets from the intended pitch). */
export const PIFIA_VARIANTS = [
  [0, 1, 6],
  [-1, 0, 1, 7],
  [0, 6, 11],
];

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Game sound effects. Everything is synthesized or uses the accordion sampler (no external files). */
export class Sfx {
  private readonly out: GainNode;
  private readonly crowdNoise: AudioBuffer;
  private lastAlarm = 0;

  constructor(
    private readonly audio: AccordionAudio,
    destination: AudioNode,
  ) {
    const ctx = audio.context;
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(destination);
    this.crowdNoise = noiseBuffer(ctx, 2.5);
  }

  private get ctx() {
    return this.audio.context;
  }

  /** Short dissonant accordion cluster around `midi` (random variant). */
  pifia(midi: number, variant = Math.floor(Math.random() * PIFIA_VARIANTS.length)) {
    const at = this.ctx.currentTime + 0.005;
    const cluster = PIFIA_VARIANTS[variant % PIFIA_VARIANTS.length].map((o) => midi + o);
    this.audio.scheduleMidi(cluster, 'chord', at, 0.16, 0.9);
    return variant;
  }

  /** Dry low thud: the streak odometer jams. */
  thud() {
    const ctx = this.ctx;
    const at = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(120, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.18);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.7, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    osc.connect(gain).connect(this.out);
    osc.start(at);
    osc.stop(at + 0.3);
  }

  /** Crowd: band-passed noise swell ("cheer") or a low formant hum ("boo"). */
  crowd(kind: 'cheer' | 'boo', intensity = 1) {
    const ctx = this.ctx;
    const at = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.crowdNoise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'cheer' ? 1800 : 380;
    filter.Q.value = kind === 'cheer' ? 0.7 : 3;
    const gain = ctx.createGain();
    const peak = (kind === 'cheer' ? 0.5 : 0.35) * intensity;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + (kind === 'cheer' ? 0.25 : 0.4));
    gain.gain.linearRampToValueAtTime(0.0001, at + (kind === 'cheer' ? 1.8 : 1.4));
    src.connect(filter).connect(gain).connect(this.out);
    if (kind === 'boo') {
      // "Buuu": a falling vowel-like tone under the noise.
      const osc = ctx.createOscillator();
      const vg = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, at);
      osc.frequency.linearRampToValueAtTime(130, at + 1.2);
      vg.gain.setValueAtTime(0.0001, at);
      vg.gain.linearRampToValueAtTime(0.06 * intensity, at + 0.3);
      vg.gain.linearRampToValueAtTime(0.0001, at + 1.3);
      osc.connect(filter);
      osc.connect(vg).connect(this.out);
      osc.start(at);
      osc.stop(at + 1.4);
    }
    src.start(at, Math.random());
    src.stop(at + 2);
  }

  /** Soft alarm while the Ambientómetro is in the red (rate-limited). */
  alarm() {
    const ctx = this.ctx;
    if (ctx.currentTime - this.lastAlarm < 1.1) return;
    this.lastAlarm = ctx.currentTime;
    for (const [offset, f] of [
      [0, 880],
      [0.16, 660],
    ]) {
      const at = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.07, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      osc.connect(gain).connect(this.out);
      osc.start(at);
      osc.stop(at + 0.16);
    }
  }

  dispose() {
    this.out.disconnect();
  }
}

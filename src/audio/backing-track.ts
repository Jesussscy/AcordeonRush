/**
 * Recorded song track (songs/<slug>/audio.mp3). Decoded into an AudioBuffer and started on the
 * AudioContext clock, so it is sample-locked to the game clock. The miss "desafine" is applied without
 * touching playbackRate/detune (which would desync the song): a modulated delay (vibrato wobble that
 * averages out to zero drift), a darkening low-pass, a bitcrush mix and a level duck.
 */
export class BackingTrack {
  private source?: AudioBufferSourceNode;
  private readonly input: GainNode;
  private readonly delay: DelayNode;
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private readonly lowpass: BiquadFilterNode;
  private readonly dry: GainNode;
  private readonly wet: GainNode;
  private readonly level: GainNode;

  private constructor(
    private readonly ctx: AudioContext,
    private readonly buffer: AudioBuffer,
    destination: AudioNode,
  ) {
    this.input = ctx.createGain();
    this.delay = ctx.createDelay(0.05);
    this.delay.delayTime.value = 0.01;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth).connect(this.delay.delayTime);
    this.lfo.start();
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    const crusher = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.round(((i / 1023) * 2 - 1) * 8) / 8;
    crusher.curve = curve;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0;
    this.level = ctx.createGain();
    this.input.connect(this.delay).connect(this.lowpass);
    this.lowpass.connect(this.dry).connect(this.level);
    this.lowpass.connect(crusher).connect(this.wet).connect(this.level);
    this.level.connect(destination);
  }

  static async load(ctx: AudioContext, url: string, destination: AudioNode) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo cargar el audio de la canción (${response.status})`);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    return new BackingTrack(ctx, buffer, destination);
  }

  get duration() {
    return this.buffer.duration;
  }

  /** Start so that buffer time `offset` (s) sounds at AudioContext time `when`. */
  start(when: number, offset: number) {
    this.stop();
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.input);
    const at = Math.max(when, this.ctx.currentTime);
    const from = Math.max(0, offset + (at - when));
    if (from < this.buffer.duration) source.start(at, from);
    this.source = source;
  }

  stop() {
    try {
      this.source?.stop();
    } catch {
      // already stopped
    }
    this.source?.disconnect();
    this.source = undefined;
  }

  /** 0 = clean … 1 = full miss feedback. `time` = smoothing time constant. */
  setMissFx(amount: number, time = 0.1) {
    const a = Math.max(0, Math.min(1, amount));
    const at = this.ctx.currentTime;
    this.lfoDepth.gain.setTargetAtTime(a * 0.0035, at, time);
    this.lowpass.frequency.setTargetAtTime(20000 - a * 17500, at, time);
    this.wet.gain.setTargetAtTime(a * 0.5, at, time);
    this.dry.gain.setTargetAtTime(1 - a * 0.35, at, time);
    this.level.gain.setTargetAtTime(1 - a * 0.55, at, time);
  }

  dispose() {
    this.stop();
    this.lfo.stop();
    this.level.disconnect();
  }
}

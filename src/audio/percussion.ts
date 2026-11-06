/**
 * Synthesized vallenato percussion (no samples): caja (small hand drum) and guacharaca (ridged scraper).
 * All functions schedule on the AudioContext clock.
 */
let noiseCache: WeakMap<BaseAudioContext, AudioBuffer> = new WeakMap();

function noise(ctx: BaseAudioContext) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

export function resetPercussionCache() {
  noiseCache = new WeakMap();
}

/** Caja vallenata: "tan" = open low stroke, "pa" = slap, "ghost" = soft finger. */
export function caja(ctx: BaseAudioContext, out: AudioNode, when: number, stroke: 'tan' | 'pa' | 'ghost') {
  const level = stroke === 'tan' ? 0.9 : stroke === 'pa' ? 0.75 : 0.25;
  // Membrane: a short pitched body with a downward glide.
  const osc = ctx.createOscillator();
  const body = ctx.createGain();
  osc.type = 'sine';
  const f = stroke === 'tan' ? 165 : 230;
  osc.frequency.setValueAtTime(f * 1.6, when);
  osc.frequency.exponentialRampToValueAtTime(f, when + 0.04);
  body.gain.setValueAtTime(0, when);
  body.gain.linearRampToValueAtTime(level * (stroke === 'pa' ? 0.45 : 0.8), when + 0.003);
  body.gain.exponentialRampToValueAtTime(0.001, when + (stroke === 'tan' ? 0.28 : 0.12));
  osc.connect(body).connect(out);
  osc.start(when);
  osc.stop(when + 0.32);
  // Skin slap: band-passed noise burst.
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = stroke === 'pa' ? 2400 : 1200;
  band.Q.value = 0.9;
  const slap = ctx.createGain();
  slap.gain.setValueAtTime(0, when);
  slap.gain.linearRampToValueAtTime(level * (stroke === 'pa' ? 0.9 : 0.35), when + 0.002);
  slap.gain.exponentialRampToValueAtTime(0.001, when + (stroke === 'pa' ? 0.09 : 0.05));
  src.connect(band).connect(slap).connect(out);
  src.start(when, Math.random() * 0.5);
  src.stop(when + 0.12);
}

/** Guacharaca scrape: a burst of tiny ridge clicks through a bright band-pass. */
export function guacharaca(ctx: BaseAudioContext, out: AudioNode, when: number, duration: number, accent: boolean) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 5200;
  band.Q.value = 1.4;
  const ridges = ctx.createGain();
  const level = accent ? 0.32 : 0.18;
  // Amplitude modulation at ~70 Hz imitates the ridges of the cane.
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.type = 'square';
  lfo.frequency.value = 68;
  depth.gain.value = level * 0.5;
  ridges.gain.setValueAtTime(0, when);
  ridges.gain.linearRampToValueAtTime(level * 0.5, when + 0.01);
  ridges.gain.setValueAtTime(level * 0.5, when + duration * 0.8);
  ridges.gain.linearRampToValueAtTime(0, when + duration);
  lfo.connect(depth).connect(ridges.gain);
  src.connect(band).connect(ridges).connect(out);
  src.start(when, Math.random() * 0.5);
  lfo.start(when);
  src.stop(when + duration + 0.02);
  lfo.stop(when + duration + 0.02);
}

/** Metronome click for count-ins and calibration. */
export function click(ctx: BaseAudioContext, out: AudioNode, when: number, accent = false) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1760 : 1320;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + 0.08);
}

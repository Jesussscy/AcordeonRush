/** Real sampled Hohner playback. Direction selects notes; pressure controls expression. */
/** Runtime location of the sampled Hohner bank (served from the assets/ publicDir). */
export const SAMPLE_BANK_URL = '/audio/samples/hohner-hn/';
export async function createAccordionAudio({
  context,
  baseURL = new URL(SAMPLE_BANK_URL, globalThis.location?.origin ?? 'http://localhost'),
  manifest,
} = {}) {
  context ??= new AudioContext();
  const base = new URL(baseURL, import.meta.url);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  manifest ??= await fetch(new URL('manifest.json', base)).then((r) => {
    if (!r.ok) throw Error('Audio manifest unavailable');
    return r.json();
  });
  const sampleBase = new URL(manifest.sampleDirectory ?? 'button-accordion-hn/', base);
  const decoded = new Map(),
    pending = new Map(),
    held = new Map(),
    voices = new Set();
  const master = context.createGain(),
    expression = context.createGain(),
    limiter = context.createDynamicsCompressor(),
    analyser = context.createAnalyser(),
    body = context.createBiquadFilter(),
    brightness = context.createBiquadFilter();
  analyser.fftSize = 8192;
  const waveform = new Float32Array(analyser.fftSize);
  const parts = Object.fromEntries(['melody', 'bass', 'chord'].map((id) => [id, context.createGain()]));
  parts.bass.connect(body);
  parts.chord.connect(body);
  // Miss feedback ("desafine") on the melody bus only: per-voice detune + wobble LFO, a bitcrush
  // wet/dry mix and a level duck. Accompaniment buses are never affected.
  const melodyDry = context.createGain(),
    melodyWet = context.createGain(),
    crusher = context.createWaveShaper(),
    melodyLevel = context.createGain(),
    wobble = context.createOscillator(),
    wobbleDepth = context.createGain();
  const steps = 10,
    curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.round(((i / (curve.length - 1)) * 2 - 1) * steps) / steps;
  crusher.curve = curve;
  melodyWet.gain.value = 0;
  parts.melody.connect(melodyDry).connect(melodyLevel);
  parts.melody.connect(crusher).connect(melodyWet).connect(melodyLevel);
  melodyLevel.connect(body);
  wobble.frequency.value = 5.5;
  wobbleDepth.gain.value = 0;
  wobble.connect(wobbleDepth);
  wobble.start();
  let melodyDetune = 0;
  const presence = context.createBiquadFilter();
  presence.type = 'highshelf';
  presence.frequency.value = 2200;
  presence.gain.value = 0;
  body.type = 'lowshelf';
  body.frequency.value = 240;
  body.gain.value = 0;
  brightness.type = 'lowpass';
  brightness.frequency.value = Math.min(20000, context.sampleRate * 0.45);
  brightness.Q.value = 0.45;
  body.connect(brightness);
  brightness.connect(presence);
  presence.connect(master);
  master.gain.value = 0.55;
  expression.gain.value = 0;
  limiter.threshold.value = -3;
  limiter.knee.value = 6;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.18;
  master.connect(expression);
  expression.connect(limiter);
  limiter.connect(analyser);
  analyser.connect(context.destination);
  let profile = manifest.profiles[0],
    tuning = 0,
    tuningId = '',
    direction = 'push',
    pressure = 0,
    disposed = false,
    playingMode = 'manual',
    expressionLevel = 0.7,
    lastError = '',
    releaseTime = 0.018,
    reedWidth = 0.55;
  const effectivePressure = () => (playingMode === 'direct' ? expressionLevel : pressure);
  const updateReedResponse = () => {
    for (const voice of voices)
      if (voice.dynamicFilter)
        voice.filter.frequency.setTargetAtTime(
          voice.cutoff * (0.42 + 0.58 * Math.sqrt(effectivePressure())),
          context.currentTime,
          0.025,
        );
  };
  const applyExpression = () => {
    expression.gain.setTargetAtTime(effectivePressure(), context.currentTime, 0.012);
    updateReedResponse();
  };
  const reedPlan = (notes, part) => {
    if (!profile.id.startsWith('vallenato')) return profile.ranks;
    if (part === 'bass')
      return [
        { semitones: 0, cents: 0, gain: 0.64 },
        { semitones: 12, cents: 0, gain: 0.28 },
        { semitones: 24, cents: 0, gain: 0.08 },
      ];
    if (part === 'chord') return [{ semitones: 0, cents: 0, gain: 1 }];
    const high = profile.id === 'vallenato-high';
    if (reedWidth < 0.001)
      return high
        ? [
            { semitones: 0, cents: 0, gain: 0.64 },
            { semitones: 12, cents: 0, gain: 0.36 },
          ]
        : [{ semitones: 0, cents: 0, gain: 1 }];
    // A controlled frequency spread avoids the excessive fast beating of fixed cents at high pitches.
    const f = 440 * 2 ** ((notes[0] + tuning - 69) / 12),
      beat = (1.2 + 1.5 * Math.sqrt(f / 440)) * reedWidth;
    if (high)
      return [
        { semitones: 0, cents: 0, gain: 0.46, pan: 0, offset: 0 },
        { semitones: 0, cents: 1200 * Math.log2(1 + beat / f), gain: 0.18, pan: -0.1, offset: 0.0015 },
        { semitones: 12, cents: 0, gain: 0.36, pan: 0.1, offset: 0.002 },
      ];
    return [
      { semitones: 0, cents: 0, gain: 0.54, pan: 0, offset: 0 },
      { semitones: 0, cents: 1200 * Math.log2(Math.max(0.95, 1 - beat / f)), gain: 0.23, pan: -0.12, offset: 0.0015 },
      { semitones: 0, cents: 1200 * Math.log2(1 + beat / f), gain: 0.23, pan: 0.12, offset: 0.003 },
    ];
  };
  async function load(file) {
    if (decoded.has(file)) return decoded.get(file);
    const url = new URL(file.split('/').map(encodeURIComponent).join('/'), sampleBase);
    url.searchParams.set('v', manifest.audioRevision ?? 'original');
    if (!pending.has(file))
      pending.set(
        file,
        fetch(url)
          .then((r) => {
            if (!r.ok) throw Error(`Missing recording ${file}`);
            return r.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .then((buffer) => {
            decoded.set(file, buffer);
            return buffer;
          })
          .catch((error) => {
            pending.delete(file);
            throw error;
          }),
      );
    return pending.get(file);
  }
  const regionFor = (pitch) =>
    manifest.regions.find((r) => pitch >= r.low && pitch <= r.high) ??
    manifest.regions.reduce((a, b) => (Math.abs(a.root - pitch) < Math.abs(b.root - pitch) ? a : b));
  function rank(
    midi,
    registration,
    { release = false, level = 1, when = context.currentTime, duration, part = 'melody' } = {},
  ) {
    const natural = profile.id === 'natural',
      dynamicFilter = profile.id.startsWith('vallenato'),
      cutoff = dynamicFilter ? (part === 'bass' ? 3800 : part === 'chord' ? 6500 : 15000) : profile.cutoff;
    const pitch = midi + tuning + registration.semitones,
      region = regionFor(pitch),
      file = release ? region.releaseFile : region.file;
    const voice = {
      cancelled: false,
      source: null,
      gain: null,
      filter: null,
      panner: null,
      dynamicFilter,
      cutoff,
      midi: pitch,
      startsAt: when,
      endsAt: duration === undefined ? Infinity : when + duration,
    };
    voices.add(voice);
    const play = (buffer) => {
      if (voice.cancelled || disposed) {
        voices.delete(voice);
        return;
      }
      const source = context.createBufferSource(),
        gain = context.createGain();
      voice.source = source;
      voice.gain = gain;
      source.buffer = buffer;
      source.loop = !release;
      if (!release) {
        source.loopStart = region.loopStart;
        source.loopEnd = Math.min(region.loopEnd, buffer.duration);
      }
      source.playbackRate.value = 2 ** ((pitch - region.root) / 12);
      voice.baseDetune = (release ? region.releaseTune : region.tune) + registration.cents;
      voice.part = part;
      source.detune.value = voice.baseDetune + (part === 'melody' ? melodyDetune : 0);
      if (part === 'melody') wobbleDepth.connect(source.detune);
      const at = Math.max(when, context.currentTime),
        amplitude =
          registration.gain * level * (release ? 0.065 : 1) * (dynamicFilter ? (region.performanceGain ?? 1) : 1);
      const attack = dynamicFilter ? (part === 'bass' ? 0.014 : 0.007) : 0.003;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(amplitude, at + attack);
      // Keep the recorded attack and sustain dynamics instead of adding an artificial decay.
      // Keep the recorded stereo reeds intact in Natural, including on closed bellows.
      if (natural) {
        source.connect(gain);
      } else {
        const filter = context.createBiquadFilter();
        voice.filter = filter;
        filter.type = 'lowpass';
        filter.frequency.value = cutoff * (dynamicFilter ? 0.42 + 0.58 * Math.sqrt(effectivePressure()) : 1);
        filter.Q.value = 0.35;
        source.connect(filter);
        filter.connect(gain);
      }
      if (dynamicFilter) {
        const panner = context.createStereoPanner();
        voice.panner = panner;
        panner.pan.value = part === 'melody' ? (registration.pan ?? 0) : -0.12;
        gain.connect(panner);
        panner.connect(parts[part]);
      } else gain.connect(parts[part]);
      source.onended = () => {
        source.disconnect();
        if (part === 'melody') wobbleDepth.disconnect(source.detune);
        voice.filter?.disconnect();
        voice.panner?.disconnect();
        gain.disconnect();
        voices.delete(voice);
      };
      source.start(
        at,
        release ? Math.min(region.releaseOffset, buffer.duration - 0.001) : 0.0012 + (registration.offset ?? 0),
      );
      if (duration !== undefined) {
        gain.gain.setTargetAtTime(0, at + duration, releaseTime);
        source.stop(at + duration + releaseTime * 7);
      }
      if (release)
        source.stop(
          at +
            Math.min(
              0.35,
              (buffer.duration - Math.min(region.releaseOffset, buffer.duration - 0.001)) / source.playbackRate.value,
            ),
        );
    };
    if (decoded.has(file)) play(decoded.get(file));
    else
      void load(file)
        .then(play)
        .catch((error) => {
          lastError = String(error);
          voices.delete(voice);
        });
    voice.stop = (fast = false) => {
      if (voice.cancelled) return;
      voice.cancelled = true;
      if (voice.source) {
        const at = context.currentTime;
        voice.gain.gain.cancelAndHoldAtTime(at);
        voice.gain.gain.setTargetAtTime(0, at, fast ? 0.006 : releaseTime);
        voice.source.stop(at + (fast ? 0.05 : releaseTime * 7));
      } else voices.delete(voice);
    };
    return voice;
  }
  function start(state) {
    if ((playingMode === 'manual' && pressure <= 0.005) || disposed) return;
    const notes = state.mapping[direction];
    state.notes = notes;
    state.part = state.bass ? (notes.length > 1 ? 'chord' : 'bass') : 'melody';
    state.ranks = reedPlan(notes, state.part);
    state.level = state.bass ? (notes.length > 1 ? 0.34 : 0.65) : 0.9;
    state.voices = notes.flatMap((midi) =>
      state.ranks.map((r) => rank(midi, r, { level: state.level, part: state.part })),
    );
  }
  function stop(state, tail = false) {
    for (const voice of state.voices ?? []) voice.stop();
    if (tail && (playingMode === 'direct' || pressure > 0.005))
      for (const midi of state.notes ?? [])
        for (const r of state.ranks ?? []) rank(midi, r, { release: true, level: state.level, part: state.part });
    state.voices = [];
  }
  function restart() {
    for (const state of held.values()) {
      stop(state);
      start(state);
    }
  }
  const api = {
    context,
    manifest,
    /** Final output node (post-limiter), e.g. for recording. */
    output: analyser,
    setPlayingMode(mode) {
      if (!['direct', 'manual'].includes(mode)) throw Error('Invalid playing mode');
      if (playingMode === mode) return;
      playingMode = mode;
      applyExpression();
      restart();
    },
    setDirection(next) {
      if (!['push', 'pull'].includes(next)) throw Error('Invalid direction');
      if (direction === next) return;
      direction = next;
      restart();
    },
    setExpression(value) {
      expressionLevel = Math.max(0, Math.min(1, value));
      applyExpression();
    },
    getDiagnostics() {
      analyser.getFloatTimeDomainData(waveform);
      let sum = 0,
        peak = 0;
      for (const n of waveform) {
        sum += n * n;
        peak = Math.max(peak, Math.abs(n));
      }
      return {
        rms: Math.sqrt(sum / waveform.length),
        peak,
        contextState: context.state,
        playingMode,
        direction,
        expression: playingMode === 'direct' ? expressionLevel : pressure,
        error: lastError,
        notes: [
          ...new Set(
            [...voices]
              .filter((v) => !v.cancelled && context.currentTime >= v.startsAt && context.currentTime < v.endsAt)
              .map((v) => v.midi),
          ),
        ],
      };
    },
    scheduleNote(name, dir, when, duration, velocity = 1) {
      const key = name.startsWith('BTN_') ? name : 'BTN_' + name,
        mapping = manifest.buttons[key];
      if (!mapping || !['push', 'pull'].includes(dir) || !Number.isFinite(when) || !(duration > 0))
        throw Error('Invalid scheduled note');
      const notes = mapping[dir],
        bass = key.includes('Bass'),
        part = bass ? (notes.length > 1 ? 'chord' : 'bass') : 'melody',
        level = (bass ? (notes.length > 1 ? 0.34 : 0.65) : 0.9) * velocity;
      for (const midi of notes) for (const r of reedPlan(notes, part)) rank(midi, r, { level, when, duration, part });
    },
    /** Schedule absolute (concert-pitch) MIDI notes on a bus, independent of the selected tuning. */
    scheduleMidi(midis, part, when, duration, velocity = 1) {
      if (!['melody', 'bass', 'chord'].includes(part) || !Number.isFinite(when) || !(duration > 0))
        throw Error('Invalid scheduled MIDI note');
      const level = (part === 'bass' ? 0.65 : part === 'chord' ? 0.34 : 0.9) * velocity;
      for (const midi of midis)
        for (const r of reedPlan(midis, part)) rank(midi - tuning, r, { level, when, duration, part });
    },
    /** Output bus of a part, for external effects (e.g. the miss detune chain). */
    partBus(part) {
      return parts[part];
    },
    setReedWidth(value) {
      const next = Math.max(0, Math.min(1, value));
      if (Math.abs(reedWidth - next) < 0.0001) return;
      reedWidth = next;
      if (profile.id.startsWith('vallenato')) restart();
    },
    setSound({
      brightness: bright = 1,
      body: bodyDb = 0,
      presence: presenceDb = 0,
      melody = 1,
      bass = 1,
      chord = 1,
      release = 0.018,
    } = {}) {
      const at = context.currentTime;
      brightness.frequency.setTargetAtTime(
        Math.min(context.sampleRate * 0.45, 2500 * 8 ** Math.max(0, Math.min(1, bright))),
        at,
        0.025,
      );
      body.gain.setTargetAtTime(Math.max(-6, Math.min(6, bodyDb)), at, 0.025);
      presence.gain.setTargetAtTime(Math.max(0, Math.min(6, presenceDb)), at, 0.025);
      for (const [id, level] of Object.entries({ melody, bass, chord }))
        parts[id].gain.setTargetAtTime(Math.max(0, Math.min(1, level)), at, 0.012);
      releaseTime = Math.max(0.008, Math.min(0.06, release));
    },
    async preload() {
      await Promise.all(manifest.regions.flatMap((r) => [load(r.file), load(r.releaseFile)]));
    },
    async unlock() {
      if (context.state === 'suspended' && typeof context.startRendering !== 'function') await context.resume();
    },
    noteOn(name) {
      if (disposed) throw Error('Audio controller disposed');
      const key = name.startsWith('BTN_') ? name : 'BTN_' + name;
      if (held.has(key)) return;
      const mapping = manifest.buttons[key];
      if (!mapping) throw Error(`Unknown button ${name}`);
      const state = { mapping, bass: key.includes('Bass'), voices: [] };
      held.set(key, state);
      start(state);
    },
    noteOff(name) {
      const key = name.startsWith('BTN_') ? name : 'BTN_' + name,
        state = held.get(key);
      if (state) {
        stop(state, true);
        held.delete(key);
      }
    },
    setBellows(nextDirection, nextPressure) {
      if (!['push', 'pull'].includes(nextDirection)) throw Error('Direction must be push or pull');
      const previous = pressure,
        changed = direction !== nextDirection;
      pressure = Math.max(0, Math.min(1, nextPressure));
      direction = nextDirection;
      applyExpression();
      if (changed || (previous <= 0.005 && pressure > 0.005) || (previous > 0.005 && pressure <= 0.005)) restart();
    },
    setProfile(id) {
      const next = manifest.profiles.find((p) => p.id === id);
      if (!next) throw Error('Unknown registration');
      if (profile.id === id) return;
      profile = next;
      restart();
    },
    setTuning(id) {
      const next = manifest.tunings.find((t) => t.id === id);
      if (!next) throw Error('Unknown tuning');
      if (tuningId === id) return;
      tuningId = id;
      tuning = next.semitones;
      restart();
    },
    setVolume(value) {
      master.gain.setTargetAtTime(0.55 * Math.max(0, Math.min(1, value)), context.currentTime, 0.02);
    },
    /**
     * Miss feedback on the melody: detune in cents (negative = flat), wobble depth in cents,
     * crush 0…1 and level 0…1. `time` is the smoothing time constant (≈ 1/3 of the settle time).
     */
    setMelodyFx({ detune = 0, wobble: depth = 0, crush = 0, level = 1 } = {}, time = 0.1) {
      const at = context.currentTime;
      melodyDetune = detune;
      for (const voice of voices)
        if (voice.part === 'melody' && voice.source)
          voice.source.detune.setTargetAtTime(voice.baseDetune + detune, at, time);
      wobbleDepth.gain.setTargetAtTime(depth, at, time);
      melodyWet.gain.setTargetAtTime(Math.max(0, Math.min(1, crush)) * 0.7, at, time);
      melodyDry.gain.setTargetAtTime(1 - Math.max(0, Math.min(1, crush)) * 0.5, at, time);
      melodyLevel.gain.setTargetAtTime(Math.max(0, Math.min(1, level)), at, time);
    },
    allNotesOff() {
      for (const state of held.values()) stop(state);
      held.clear();
      for (const voice of voices) voice.stop(true);
    },
    dispose() {
      api.allNotesOff();
      disposed = true;
      for (const bus of Object.values(parts)) bus.disconnect();
      wobble.stop();
      for (const node of [melodyDry, melodyWet, crusher, melodyLevel, wobble, wobbleDepth]) node.disconnect();
      body.disconnect();
      brightness.disconnect();
      presence.disconnect();
      master.disconnect();
      expression.disconnect();
      limiter.disconnect();
      analyser.disconnect();
    },
  };
  return api;
}

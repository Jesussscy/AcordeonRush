/**
 * Song clock on the AudioContext timeline. Song time 0 = beat 0 of the chart; negative during the count-in.
 * Suspending the AudioContext pauses everything (scheduled audio and the clock) at once.
 */
export class GameClock {
  /** AudioContext time of song time 0. */
  private t0 = 0;
  started = false;

  constructor(
    readonly ctx: AudioContext,
    readonly bpm: number,
    /** Practice speed 0.5…1. */
    readonly rate = 1,
    /** Player calibration: positive = the player hears/presses later than the clock. */
    public audioOffset = 0,
    public videoOffset = 0,
  ) {}

  get secondsPerBeat() {
    return 60 / this.bpm;
  }

  /** Start so that `fromSongTime` plays `delay` seconds from now. */
  start(fromSongTime: number, delay = 0.12) {
    this.t0 = this.ctx.currentTime + delay - fromSongTime / this.rate;
    this.started = true;
  }

  ctxTimeOf(songTime: number) {
    return this.t0 + songTime / this.rate;
  }

  ctxTimeOfBeat = (beat: number) => this.ctxTimeOf(beat * this.secondsPerBeat);

  songTimeAt(ctxTime: number) {
    return (ctxTime - this.t0) * this.rate;
  }

  /** Output latency of the audio device, in seconds. */
  get outputLatency() {
    return (this.ctx as AudioContext & { outputLatency?: number }).outputLatency || this.ctx.baseLatency || 0;
  }

  /** Song time currently reaching the speakers. */
  heardNow() {
    return this.songTimeAt(this.ctx.currentTime - this.outputLatency);
  }

  /** Song time to draw (heard time + visual calibration). */
  visualNow() {
    return this.heardNow() + this.videoOffset;
  }

  /**
   * Song time of an input event, from its DOM timestamp (performance.now() domain), compensated
   * for output latency and the player's audio calibration.
   */
  eventTime(timeStamp: number) {
    const ageSeconds = Math.max(0, (performance.now() - timeStamp) / 1000);
    const heardAtPress = this.ctx.currentTime - ageSeconds - this.outputLatency;
    return this.songTimeAt(heardAtPress) - this.audioOffset;
  }
}

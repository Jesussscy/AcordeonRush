import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../core/settings';
import { click } from '../audio/percussion';

type Props = { settings: Settings; onChange(next: Settings): void; onBack(): void };

const BPM = 90;
const BEATS = 12;
/** First beats are a warm-up and are not measured. */
const WARMUP = 4;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/**
 * Latency calibration. Audio: tap Space with the clicks you hear. Video: tap Space when the ring flashes
 * (silent). The median offset of the taps becomes audioOffsetMs / videoOffsetMs.
 */
export default function Calibration({ settings, onChange, onBack }: Props) {
  const [phase, setPhase] = useState<'idle' | 'audio' | 'video'>('idle');
  const [message, setMessage] = useState('');
  const [flash, setFlash] = useState(false);
  const run = useRef<{ ctx: AudioContext; start: number; taps: number[]; timer: number } | null>(null);

  const stop = () => {
    if (!run.current) return;
    clearInterval(run.current.timer);
    void run.current.ctx.close();
    run.current = null;
  };
  useEffect(() => stop, []);

  const begin = (kind: 'audio' | 'video') => {
    stop();
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    void ctx.resume();
    const spb = 60 / BPM;
    const start = ctx.currentTime + 0.5;
    if (kind === 'audio') for (let i = 0; i < BEATS; i++) click(ctx, ctx.destination, start + i * spb, i % 4 === 0);
    const timer = window.setInterval(() => {
      if (!run.current) return;
      const outputLatency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
      const t = (kind === 'audio' ? ctx.currentTime - outputLatency : ctx.currentTime) - start;
      const beat = t / spb;
      setFlash(kind === 'video' && beat >= 0 && beat - Math.floor(beat) < 0.12 && beat < BEATS);
      if (beat > BEATS + 0.5) finish(kind);
    }, 8);
    run.current = { ctx, start, taps: [], timer };
    setPhase(kind);
    setMessage(
      kind === 'audio'
        ? 'Presiona Espacio con cada clic que escuches…'
        : 'Presiona Espacio cada vez que se ilumine el anillo…',
    );
  };

  const finish = (kind: 'audio' | 'video') => {
    const current = run.current;
    if (!current) return;
    const spb = 60 / BPM;
    const offsets = current.taps
      .map((t) => {
        const beat = Math.round(t / spb);
        return beat >= WARMUP && beat < BEATS ? t - beat * spb : null;
      })
      .filter((v): v is number => v !== null && Math.abs(v) < 0.3);
    stop();
    setPhase('idle');
    setFlash(false);
    if (offsets.length < 4) return setMessage('Muy pocos toques válidos. Inténtalo de nuevo, siguiendo el pulso.');
    const ms = Math.round(median(offsets) * 1000);
    if (kind === 'audio') onChange({ ...settings, audioOffsetMs: ms });
    // Display lag = how much later you tap the flash than the click; render that much ahead.
    else onChange({ ...settings, videoOffsetMs: ms - settings.audioOffsetMs });
    setMessage(
      `Listo: ${kind === 'audio' ? 'audio' : 'video'} ${ms > 0 ? '+' : ''}${ms} ms (${offsets.length} toques).`,
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || !run.current) return;
      e.preventDefault();
      const { ctx, start } = run.current;
      const ageSeconds = Math.max(0, (performance.now() - e.timeStamp) / 1000);
      const outputLatency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
      const heard = phase === 'audio' ? ctx.currentTime - ageSeconds - outputLatency : ctx.currentTime - ageSeconds;
      run.current.taps.push(heard - start);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase]);

  return (
    <main className="vh-screen">
      <button
        className="vh-back"
        onClick={() => {
          stop();
          onBack();
        }}
      >
        ← Menú
      </button>
      <h1 className="vh-logo">Calibración</h1>
      <p className="vh-tagline">
        Si las notas te parecen siempre tempranas o tardías, calibra. Usa los mismos audífonos o parlantes con los que
        juegas.
      </p>
      <div
        aria-hidden="true"
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          border: '12px solid var(--vh-gold)',
          margin: '24px 0',
          boxShadow: flash ? '0 0 60px 20px var(--vh-gold)' : 'none',
          background: flash ? 'rgba(242,194,48,.5)' : 'transparent',
          transition: 'none',
        }}
      />
      <div className="vh-row">
        <button className="vh-btn primary" disabled={phase !== 'idle'} onClick={() => begin('audio')}>
          <b>1 · Audio</b>
        </button>
        <button className="vh-btn" disabled={phase !== 'idle'} onClick={() => begin('video')}>
          <b>2 · Video</b>
        </button>
        <button className="vh-btn" onClick={() => onChange({ ...settings, audioOffsetMs: 0, videoOffsetMs: 0 })}>
          Reiniciar a 0
        </button>
      </div>
      <p role="status" style={{ marginTop: 16 }}>
        {message}
      </p>
      <p style={{ color: 'var(--vh-dim)' }}>
        Actual: audio {settings.audioOffsetMs} ms · video {settings.videoOffsetMs} ms
      </p>
    </main>
  );
}

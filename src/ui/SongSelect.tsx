import { useEffect, useMemo, useState } from 'react';
import type { PlayRequest } from '../App';
import { getRecord } from '../core/records';
import type { GameMode } from '../core/game-session';
import type { Settings } from '../core/settings';
import { DIFFICULTIES, type Difficulty } from '../gameplay/difficulty';
import { songCatalog } from '../gameplay/song-catalog';
import { instrumentDesigns } from '../instrument/accordion-catalog';

export type PracticeOptions = {
  rate: number;
  showNoteNames: boolean;
  /** Bar range [from, to) (1-based bars), or null for the whole song. */
  section: [number, number] | null;
};

type Props = {
  mode: GameMode;
  settings: Settings;
  onSettings(next: Settings): void;
  onBack(): void;
  onStart(request: PlayRequest): void;
};

const hats = (n: number) => '🎩'.repeat(n) || '—';

export function SongSelect({ mode, settings, onSettings, onBack, onStart }: Props) {
  const [songId, setSongId] = useState(songCatalog.find((s) => !s.error)?.id ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(settings.difficulty);
  const [designId, setDesignId] = useState(
    instrumentDesigns.some((d) => d.id === settings.design) ? settings.design : instrumentDesigns[0].id,
  );
  const [practice, setPractice] = useState<PracticeOptions>({ rate: 0.75, showNoteNames: true, section: null });
  const entry = songCatalog.find((s) => s.id === songId);
  const bars = entry?.chart ? Math.ceil(entry.chart.lengthBeats / entry.chart.timeSignature[0]) : 0;
  const sections = useMemo(() => {
    const result: [number, number][] = [];
    for (let b = 1; b <= bars; b += 4) result.push([b, Math.min(bars + 1, b + 4)]);
    return result;
  }, [bars]);
  useEffect(() => setPractice((p) => ({ ...p, section: null })), [songId]);

  const start = () => {
    if (!entry) return;
    onSettings({ ...settings, design: designId, difficulty });
    onStart({
      entry,
      difficulty,
      designId,
      mode,
      practice: mode === 'practice' ? practice : { rate: 1, showNoteNames: false, section: null },
    });
  };

  return (
    <main className="vh-screen">
      <button className="vh-back" onClick={onBack}>
        ← Menú
      </button>
      <h1 className="vh-logo" style={{ fontSize: 'clamp(44px, 7vw, 76px)' }}>
        {mode === 'practice' ? 'Práctica' : 'Escoge tu canción'}
      </h1>

      <h2 className="vh-section-title">Canción</h2>
      <div className="vh-grid" role="list">
        {songCatalog.map((song) => {
          const record = getRecord(song.id, difficulty);
          return (
            <button
              key={song.id}
              role="listitem"
              className="vh-card"
              aria-pressed={song.id === songId}
              disabled={Boolean(song.error)}
              onClick={() => setSongId(song.id)}
              title={song.error}
            >
              {song.coverUrl && <img src={song.coverUrl} alt="" />}
              <h3>{song.title}</h3>
              <p>
                {song.artist}
                {song.bpm ? ` · ${song.bpm} BPM` : ''}
              </p>
              {song.error ? (
                <p className="vh-error-box">{song.error}</p>
              ) : (
                <span className="vh-chip">
                  Récord: {record ? `${record.score.toLocaleString('es')} · ${hats(record.stars)}` : 'sin jugar'}
                </span>
              )}
              {song.private && <span className="vh-chip">Privada</span>}
            </button>
          );
        })}
      </div>

      <h2 className="vh-section-title">Dificultad</h2>
      <div className="vh-grid">
        {DIFFICULTIES.map((d) => (
          <button key={d.id} className="vh-card" aria-pressed={d.id === difficulty} onClick={() => setDifficulty(d.id)}>
            <h3>{d.label}</h3>
            <p>{d.description}</p>
          </button>
        ))}
      </div>

      {mode === 'practice' && (
        <>
          <h2 className="vh-section-title">Opciones de práctica</h2>
          <label className="vh-field">
            Velocidad: {Math.round(practice.rate * 100)}%
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={practice.rate * 100}
              onChange={(e) => setPractice({ ...practice, rate: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="vh-field">
            Sección en bucle
            <select
              value={practice.section ? practice.section.join('-') : ''}
              onChange={(e) =>
                setPractice({
                  ...practice,
                  section: e.target.value ? (e.target.value.split('-').map(Number) as [number, number]) : null,
                })
              }
            >
              <option value="">Canción completa (sin bucle)</option>
              {sections.map(([a, b]) => (
                <option key={a} value={`${a}-${b}`}>
                  Compases {a}–{b - 1}
                </option>
              ))}
            </select>
          </label>
          <label className="vh-check">
            <input
              type="checkbox"
              checked={practice.showNoteNames}
              onChange={(e) => setPractice({ ...practice, showNoteNames: e.target.checked })}
            />
            Mostrar el nombre de la nota en cada gema
          </label>
        </>
      )}

      <h2 className="vh-section-title">Tu acordeón</h2>
      <div className="vh-grid">
        {instrumentDesigns.map((d) => (
          <button key={d.id} className="vh-card" aria-pressed={d.id === designId} onClick={() => setDesignId(d.id)}>
            <img src={d.image} alt={d.name} loading="lazy" />
            <h3>{d.name}</h3>
            <p>{d.description}</p>
          </button>
        ))}
      </div>

      <label className="vh-check" style={{ marginTop: 20 }}>
        <input
          type="checkbox"
          checked={settings.assistedBellows}
          onChange={(e) => onSettings({ ...settings, assistedBellows: e.target.checked })}
        />
        Fuelle asistido (el juego mueve el fuelle por ti; solo para aprender)
      </label>
      <p style={{ color: 'var(--vh-dim)' }}>
        Controles: hilera de afuera <span className="vh-kbd">Z</span>…<span className="vh-kbd">-</span>, del medio{' '}
        <span className="vh-kbd">A</span>…<span className="vh-kbd">´</span>, de adentro{' '}
        <span className="vh-kbd">Q</span>…<span className="vh-kbd">P</span>. Mantén{' '}
        <span className="vh-kbd">Espacio</span> para cerrar el fuelle (←) y suéltalo para abrir (→).{' '}
        <span className="vh-kbd">Enter</span> = Parranda, <span className="vh-kbd">Esc</span> = pausa.
      </p>
      <div className="vh-row" style={{ marginTop: 16 }}>
        <button className="vh-btn primary" onClick={start} disabled={!entry || Boolean(entry.error)}>
          <b>¡A tocar!</b>
        </button>
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import type { PlayRequest } from '../App';
import type { GameResult } from '../core/game-session';
import { submitRecord } from '../core/records';
import { DIFFICULTIES } from '../gameplay/difficulty';
import type { ErrorKind } from '../gameplay/judge';
import { Sombrero } from './Sombrero';

type Props = { request: PlayRequest; result: GameResult; onRetry(): void; onSongs(): void; onMenu(): void };

const ERROR_LABELS: Record<ErrorKind, string> = {
  missed: 'Notas perdidas',
  button: 'Botón equivocado',
  bellows: 'Fuelle equivocado',
  early: 'Temprano',
  late: 'Tarde',
  ghost: 'Notas fantasma',
};

/** Automatic tip from the most frequent error. */
export function adviceFor(result: GameResult): string {
  const [kind, count] = (Object.entries(result.errors) as [ErrorKind, number][]).sort((a, b) => b[1] - a[1])[0];
  if (!count)
    return result.stars >= 5
      ? '¡Parranda perfecta! Prueba una dificultad más alta.'
      : '¡Muy bien! Busca más PERFECTOS para subir de sombreros.';
  switch (kind) {
    case 'bellows':
      return 'Fallaste mucho el fuelle: practica en Fácil mirando la franja lateral (azul ← cerrar, naranja → abrir).';
    case 'button':
      return 'Te equivocaste de botón: activa "nombre de la nota" en Práctica y baja la velocidad al 75 %.';
    case 'early':
      return 'Tocaste antes de tiempo: espera a que la gema llegue al anillo; si te pasa siempre, revisa la Calibración.';
    case 'late':
      return 'Tocaste tarde: anticipa la gema y escucha la caja; si te pasa siempre, revisa la Calibración.';
    case 'ghost':
      return 'Presionaste botones sin nota: toca solo cuando una gema cruce el anillo.';
    default:
      return 'Se te escaparon notas: usa Práctica con bucle en la sección difícil y súbele la velocidad poco a poco.';
  }
}

export function Results({ request, result, onRetry, onSongs, onMenu }: Props) {
  const [records, setRecords] = useState<{ newScore: boolean; newStreak: boolean }>({
    newScore: false,
    newStreak: false,
  });
  useEffect(() => {
    if (result.mode !== 'game' || result.failed) return;
    setRecords(
      submitRecord(result.songId, result.difficulty, {
        score: result.score,
        stars: result.stars,
        accuracy: result.accuracy,
        maxStreak: result.maxStreak,
        date: new Date().toISOString(),
      }),
    );
  }, [result]);
  const difficulty = DIFFICULTIES.find((d) => d.id === request.difficulty)!.label;
  return (
    <main className="vh-screen vh-results">
      <h1 className="vh-logo">{result.failed ? '¡Se acabó la parranda!' : '¡Qué parranda!'}</h1>
      <p className="vh-tagline">
        {result.title} · {difficulty}
        {result.mode === 'practice' ? ' · práctica' : result.mode === 'demo' ? ' · demostración' : ''}
      </p>
      <div className="vh-row" aria-label={`${result.stars} de 5 sombreros`} style={{ gap: 6 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Sombrero key={i} size={64} fill={i < result.stars ? 1 : 0} />
        ))}
      </div>
      <div className="vh-grid" style={{ marginTop: 24 }}>
        <div className="vh-card" data-testid="final-score">
          <p>Puntaje</p>
          <h3 style={{ fontSize: 48 }}>{result.score.toLocaleString('es')}</h3>
          {records.newScore && <span className="vh-chip">¡Nuevo récord!</span>}
        </div>
        <div className="vh-card">
          <p>Acierto</p>
          <h3 style={{ fontSize: 48 }}>{Math.round(result.accuracy * 100)}%</h3>
          <p>{result.totalNotes} notas</p>
        </div>
        <div className="vh-card">
          <p>Racha máxima</p>
          <h3 style={{ fontSize: 48 }}>{result.maxStreak}</h3>
          {records.newStreak && result.maxStreak > result.bestStreakBefore && (
            <span className="vh-chip">¡Récord de racha!</span>
          )}
        </div>
      </div>
      <div className="vh-grid" style={{ marginTop: 12 }}>
        <div className="vh-card">
          <h3>Timing</h3>
          <p>¡Perfecto!: {result.grades.perfect}</p>
          <p>¡Bien!: {result.grades.good}</p>
          <p>OK: {result.grades.ok}</p>
          <p>Fallos: {result.totalNotes - result.grades.perfect - result.grades.good - result.grades.ok}</p>
        </div>
        <div className="vh-card">
          <h3>Errores por tipo</h3>
          {(Object.keys(ERROR_LABELS) as ErrorKind[]).map((k) => (
            <p key={k}>
              {ERROR_LABELS[k]}: {result.errors[k]}
            </p>
          ))}
        </div>
        <div className="vh-card">
          <h3>Consejo</h3>
          <p data-testid="advice">{adviceFor(result)}</p>
        </div>
      </div>
      <div className="vh-row" style={{ marginTop: 24 }}>
        <button className="vh-btn primary" autoFocus onClick={onRetry}>
          <b>Otra vez</b>
        </button>
        <button className="vh-btn" onClick={onSongs}>
          Canciones
        </button>
        <button className="vh-btn" onClick={onMenu}>
          Menú
        </button>
      </div>
    </main>
  );
}

import { songCatalog } from '../gameplay/song-catalog';
import type { GameMode } from '../core/game-session';

type Props = {
  onPlay(mode: GameMode): void;
  onStudio(): void;
  onSettings(): void;
  onCalibration(): void;
};

export function MainMenu({ onPlay, onStudio, onSettings, onCalibration }: Props) {
  const playable = songCatalog.filter((s) => !s.error).length;
  return (
    <main className="vh-screen vh-main-menu">
      <h1 className="vh-logo">
        Vallenato
        <br />
        Hero
      </h1>
      <div className="vh-weave" aria-hidden="true" />
      <p className="vh-tagline">Toca los botones, mueve el fuelle y prende la parranda.</p>
      <nav className="vh-menu" aria-label="Menú principal">
        <button className="vh-btn primary" autoFocus onClick={() => onPlay('game')}>
          <span>
            <b>Jugar</b>
            <small>
              {playable} {playable === 1 ? 'canción' : 'canciones'} · 4 dificultades
            </small>
          </span>
        </button>
        <button className="vh-btn" onClick={() => onPlay('practice')}>
          <span>
            <b>Práctica</b>
            <small>Velocidad, bucle de secciones y nombre de las notas</small>
          </span>
        </button>
        <button className="vh-btn" onClick={() => onPlay('demo')}>
          <span>
            <b>Demostración</b>
            <small>El acordeón toca la canción solo: escucha cómo debe sonar</small>
          </span>
        </button>
        <button className="vh-btn" onClick={onStudio}>
          <span>
            <b>Estudio libre</b>
            <small>Toca el acordeón 3D sin canción</small>
          </span>
        </button>
        <button className="vh-btn" onClick={onSettings}>
          <span>
            <b>Ajustes</b>
            <small>Controles, fuelle asistido, sonido y gráficos</small>
          </span>
        </button>
        <button className="vh-btn" onClick={onCalibration}>
          <span>
            <b>Calibración</b>
            <small>Latencia de audio y video</small>
          </span>
        </button>
      </nav>
    </main>
  );
}

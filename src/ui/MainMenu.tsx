import { lazy, Suspense } from 'react';
import { ArrowDown, ArrowUpRight, AudioLines, Gauge, Headphones, Music2, Play, Settings2, Upload } from 'lucide-react';
import { songCatalog } from '../gameplay/song-catalog';
import type { GameMode } from '../core/game-session';
import { instrumentDesigns } from '../instrument/accordion-catalog';

const AccordionScene = lazy(() =>
  import('../instrument/AccordionScene').then((module) => ({ default: module.AccordionScene })),
);
const inactiveKeys = new Set<string>();
const silentPreview = () => {};

type Props = {
  onPlay(mode: GameMode): void;
  onStudio(): void;
  onSettings(): void;
  onCalibration(): void;
  onPrivate(): void;
  libraryError?: string;
};

export function MainMenu({ onPlay, onStudio, onSettings, onCalibration, onPrivate, libraryError }: Props) {
  const playable = songCatalog.filter((song) => !song.error);
  const featured = playable.find((song) => song.private) ?? playable[0];
  return (
    <main className="vh-screen vh-main-menu">
      <header className="home-header">
        <a className="brand" href="#" aria-label="Vallenato Hero, inicio">
          <AudioLines size={25} />
          <span>
            vallenato<span className="brand-light">hero</span>
          </span>
        </a>
        <nav aria-label="Herramientas">
          <button onClick={onPrivate}>
            <Upload size={16} />
            Mi música
          </button>
          <button onClick={onSettings}>
            <Settings2 size={18} />
            <span>Ajustes</span>
          </button>
        </nav>
      </header>
      {libraryError && (
        <p className="vh-error-box" role="alert">
          {libraryError}
        </p>
      )}
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">El vallenato está en tus manos</span>
          <h1>
            Siente el ritmo.
            <br />
            Abre el <em>fuelle.</em>
          </h1>
          <p>Tu acordeón, tu escenario. Aprende cada melodía y haz que la próxima parranda suene a ti.</p>
          <div className="hero-actions">
            <button className="vh-btn primary" onClick={() => onPlay('game')}>
              <Play size={18} fill="currentColor" />
              <b>Jugar</b>
              <ArrowUpRight size={20} />
            </button>
            <button className="text-action" onClick={onStudio}>
              Entrar al estudio <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="hero-details">
            <span>{playable.length} canciones disponibles</span>
            <span>4 dificultades</span>
            <span>Acordeón 3D</span>
          </div>
        </div>
        <div className="hero-instrument">
          <div className="instrument-halo" />
          <Suspense fallback={<div className="hero-model-loading">Cargando acordeón…</div>}>
            <AccordionScene
              model={instrumentDesigns[0].model}
              image={instrumentDesigns[0].image}
              name={instrumentDesigns[0].name}
              activeKeys={inactiveKeys}
              bellows={false}
              direction="push"
              interactive={false}
              opening={0.5}
              onPlay={silentPreview}
              onStop={silentPreview}
            />
          </Suspense>
          <div className="instrument-caption">
            <AudioLines size={20} />
            <div>
              <strong>{instrumentDesigns[0].name}</strong>
              <span>Acordeón diatónico · 31 botones</span>
            </div>
            <button className="icon-button" onClick={onStudio} aria-label="Explorar acordeón">
              <ArrowUpRight />
            </button>
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>Encuentra tu ritmo</h2>
        <span className="muted">
          De la primera nota al escenario <ArrowDown size={15} />
        </span>
      </div>
      <nav className="mode-grid" aria-label="Menú principal">
        <button className="mode-card" onClick={() => onPlay('practice')}>
          <span className="mode-icon">
            <Music2 />
          </span>
          <ArrowUpRight className="mode-arrow" />
          <h3>Práctica</h3>
          <p>Baja la velocidad y repite cada frase hasta hacerla tuya.</p>
          <span className="mode-link">A tu ritmo →</span>
        </button>
        <button className="mode-card" onClick={() => onPlay('demo')}>
          <span className="mode-icon">
            <Headphones />
          </span>
          <ArrowUpRight className="mode-arrow" />
          <h3>Demostración</h3>
          <p>Escucha la melodía y sigue los botones y el fuelle.</p>
          <span className="mode-link">Mira y aprende →</span>
        </button>
        <button className="mode-card" onClick={onStudio}>
          <span className="mode-icon">
            <AudioLines />
          </span>
          <ArrowUpRight className="mode-arrow" />
          <h3>Estudio libre</h3>
          <p>Explora el instrumento, sus registros y tu propio sonido.</p>
          <span className="mode-link">Empieza a crear →</span>
        </button>
        <button className="mode-card private-mode" onClick={onPrivate}>
          <span className="mode-icon">
            <Upload />
          </span>
          <ArrowUpRight className="mode-arrow" />
          <h3>Canciones privadas</h3>
          <p>Trae tus melodías y construye un repertorio personal.</p>
          <span className="mode-link">Importar canción →</span>
        </button>
      </nav>
      <section className="home-bottom">
        {featured && (
          <button className="featured-song" onClick={() => onPlay('practice')}>
            <span className="song-art">
              <Music2 />
            </span>
            <div>
              <small>En tu biblioteca</small>
              <h3>{featured.title}</h3>
              <p>{featured.artist}</p>
            </div>
            <Play size={20} />
          </button>
        )}
        <button className="calibration-link" onClick={onCalibration}>
          <Gauge size={23} />
          <div>
            <strong>Calibración</strong>
            <p>Ajusta el audio y la imagen a tu equipo.</p>
          </div>
          <ArrowUpRight size={20} />
        </button>
      </section>
      <footer className="home-footer">
        <span>Hecho para sentir el vallenato.</span>
        <span>Teclado · MIDI · Acordeón 3D</span>
      </footer>
    </main>
  );
}

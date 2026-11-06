import { useEffect, useRef, useState } from 'react';
import type { PlayRequest } from '../App';
import { GameSession, type GameResult } from '../core/game-session';
import type { Settings } from '../core/settings';
import { detectKeyboardLayout } from '../input/bindings';
import { instrumentDesigns } from '../instrument/accordion-catalog';
import { loadSongChart } from '../gameplay/song-catalog';

type Props = {
  request: PlayRequest;
  settings: Settings;
  onQuit(): void;
  onRestart(): void;
  onFinish(result: GameResult): void;
};

declare global {
  interface Window {
    /** Debug hook for automated tests (only with ?debug=1 or in development). */
    __VH__?: { session: GameSession };
  }
}

export function GameScreen({ request, settings, onQuit, onRestart, onFinish }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<GameSession>();
  const [status, setStatus] = useState('Preparando…');
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const latest = useRef({ onFinish });
  latest.current = { onFinish };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    (async () => {
      try {
        await detectKeyboardLayout();
        const chart = await loadSongChart(request.entry);
        if (cancelled) return;
        const design = instrumentDesigns.find((d) => d.id === request.designId) ?? instrumentDesigns[0];
        const beatsPerBar = chart.timeSignature[0];
        const loop = request.practice.section
          ? ([(request.practice.section[0] - 1) * beatsPerBar, (request.practice.section[1] - 1) * beatsPerBar] as [
              number,
              number,
            ])
          : null;
        const s = new GameSession(
          element,
          {
            entry: request.entry,
            chart,
            difficulty: request.difficulty,
            design,
            mode: request.mode,
            rate: request.practice.rate,
            showNoteNames: request.practice.showNoteNames,
            loop,
            settings,
          },
          {
            onStatus: setStatus,
            onReady: () => setStatus(''),
            onPause: setPaused,
            onFinish: (result) => latest.current.onFinish(result),
          },
        );
        session.current = s;
        if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__VH__ = { session: s };
        await s.start();
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      session.current?.dispose();
      session.current = undefined;
      if (window.__VH__) delete window.__VH__;
    };
  }, [request, settings]);

  return (
    <div className="vh-game">
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {(status || error) && (
        <div className="vh-overlay">
          <div className="vh-overlay-panel">
            {error ? (
              <>
                <h2>No se pudo cargar</h2>
                <p className="vh-error-box">{error}</p>
                <button className="vh-btn" onClick={onQuit}>
                  Volver
                </button>
              </>
            ) : (
              <p>{status}</p>
            )}
          </div>
        </div>
      )}
      {paused && (
        <div className="vh-overlay">
          <div className="vh-overlay-panel" role="dialog" aria-label="Pausa">
            <h2>Pausa</h2>
            <button className="vh-btn primary" autoFocus onClick={() => session.current?.resume()}>
              <b>Continuar</b>
            </button>
            <button className="vh-btn" onClick={onRestart}>
              Reiniciar canción
            </button>
            <button className="vh-btn" onClick={onQuit}>
              Salir a canciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

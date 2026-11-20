import { loadPrivateSongs } from './gameplay/private-songs';
import { PrivateSongs } from './ui/PrivateSongs';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { GameMode, GameResult } from './core/game-session';
import { loadSettings, saveSettings, type Settings } from './core/settings';
import type { Difficulty } from './gameplay/difficulty';
import type { SongEntry } from './gameplay/song-catalog';
import { MainMenu } from './ui/MainMenu';
import { Results } from './ui/Results';
import { SongSelect, type PracticeOptions } from './ui/SongSelect';
import './ui/theme.css';

const GameScreen = lazy(() => import('./ui/GameScreen').then((m) => ({ default: m.GameScreen })));
const Studio = lazy(() => import('./ui/studio/Workspace'));
const SettingsScreen = lazy(() => import('./ui/SettingsScreen'));
const Calibration = lazy(() => import('./ui/Calibration'));

export type PlayRequest = {
  entry: SongEntry;
  difficulty: Difficulty;
  designId: string;
  mode: GameMode;
  practice: PracticeOptions;
};

type Screen =
  | { name: 'menu' }
  | { name: 'select'; mode: GameMode; songId?: string }
  | { name: 'private' }
  | { name: 'game'; request: PlayRequest; attempt: number }
  | { name: 'results'; request: PlayRequest; result: GameResult }
  | { name: 'studio' }
  | { name: 'settings' }
  | { name: 'calibration' };

export default function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    location.hash === '#estudio' ? { name: 'studio' } : { name: 'menu' },
  );
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  useEffect(() => {
    void loadPrivateSongs()
      .catch((reason: Error) => setLibraryError(reason.message))
      .finally(() => setLibraryReady(true));
  }, []);
  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);
  const menu = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setScreen({ name: 'menu' });
  };

  if (!libraryReady)
    return (
      <div className="vh-screen" role="status">
        Abriendo tu biblioteca…
      </div>
    );
  if (screen.name === 'private')
    return <PrivateSongs onBack={menu} onPlay={(songId) => setScreen({ name: 'select', mode: 'practice', songId })} />;
  if (screen.name === 'menu')
    return (
      <MainMenu
        libraryError={libraryError}
        onPrivate={() => setScreen({ name: 'private' })}
        onPlay={(mode) => setScreen({ name: 'select', mode })}
        onStudio={() => {
          location.hash = 'estudio';
          setScreen({ name: 'studio' });
        }}
        onSettings={() => setScreen({ name: 'settings' })}
        onCalibration={() => setScreen({ name: 'calibration' })}
      />
    );
  if (screen.name === 'select')
    return (
      <SongSelect
        initialSongId={screen.songId}
        onPrivate={() => setScreen({ name: 'private' })}
        mode={screen.mode}
        settings={settings}
        onSettings={setSettings}
        onBack={menu}
        onStart={(request) => setScreen({ name: 'game', request, attempt: 0 })}
      />
    );
  if (screen.name === 'game')
    return (
      <Suspense fallback={<div className="vh-screen">Cargando escenario…</div>}>
        <GameScreen
          key={screen.attempt}
          request={screen.request}
          settings={settings}
          onQuit={() => setScreen({ name: 'select', mode: screen.request.mode })}
          onRestart={() => setScreen({ ...screen, attempt: screen.attempt + 1 })}
          onFinish={(result) => setScreen({ name: 'results', request: screen.request, result })}
        />
      </Suspense>
    );
  if (screen.name === 'results')
    return (
      <Results
        request={screen.request}
        result={screen.result}
        onRetry={() => setScreen({ name: 'game', request: screen.request, attempt: Date.now() })}
        onSongs={() => setScreen({ name: 'select', mode: screen.request.mode })}
        onMenu={menu}
      />
    );
  return (
    <Suspense fallback={<div className="vh-screen">Cargando…</div>}>
      {screen.name === 'studio' && <Studio onExit={menu} />}
      {screen.name === 'settings' && <SettingsScreen settings={settings} onChange={setSettings} onBack={menu} />}
      {screen.name === 'calibration' && <Calibration settings={settings} onChange={setSettings} onBack={menu} />}
    </Suspense>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, AudioLines, Check, ChevronDown, ChevronRight, CircleHelp, Crown, Headphones, Heart, Music2, Pause, Play, RotateCcw, Settings2, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { songs, type Song } from './songs';
import { bassKeys, melodyKeys, startBassChord, startReedNote, tuningOffsets, type BellowsDirection, type ReedVoice } from './instrument';
import { AccordionKeyboard } from './AccordionKeyboard';

type Phase = 'ready' | 'countdown' | 'playing' | 'paused' | 'finished';
type NoteState = 'pending' | 'hit' | 'miss';
type Note = { id: number; time: number; lane: number; state: NoteState; judged: boolean };
type LaneFlash = { lane: number; kind: 'hit' | 'miss'; token: number };
const laneColors = ['#ef8958', '#e7b849', '#b3ca68', '#65c1a9', '#9b83dd'];
const laneNames = ['DO', 'RE', 'MI', 'FA', 'SOL'];

function controlOfficialTrack(command: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute') {
  const frame = document.querySelector<HTMLIFrameElement>('.official-track iframe');
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: command, args: [] }), 'https://www.youtube-nocookie.com');
}

function Accordion({ open, direction }: { open: boolean; direction: BellowsDirection }) {
  return <div className="accordion-art" aria-label="Ilustración de un acordeón, el modelo 3D interactivo se añadirá en una próxima etapa">
    <div className="acc-flare" />
    <div className={`accordion ${open ? `bellows-open ${direction}` : ''}`}>
      <div className="acc-left"><div className="acc-crest">AR</div><div className="bass-grid">{bassKeys.map(key => <span className={`bass-button ${key.row}`} key={key.id} />)}</div><i className="gold-line" /></div>
      <div className="bellows"><div className="bellows-light" />{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      <div className="acc-right"><div className="right-crest">✳</div><div className="hero-button-rows">{[0,1,2].map(row => <div key={row}>{Array.from({ length: row === 0 ? 11 : 10 }, (_, i) => <span key={i} />)}</div>)}</div><i className="gold-line" /></div>
      <div className="acc-handle" />
    </div>
    <div className="acc-reflection" />
    <span className="art-caption"><span className="live-dot" /> ACORDEÓN VALLENATO <span className="caption-sep">·</span> SOL · DO · FA</span>
  </div>;
}

function useInstrument() {
  const audioRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef(new Map<string, ReedVoice>());
  const [audioReady, setAudioReady] = useState(false);
  const getAudio = useCallback(() => {
    const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioRef.current) audioRef.current = new AudioCtor();
    if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    return audioRef.current;
  }, []);
  const start = useCallback((id: string, frequency: number, direction: BellowsDirection, volume = 0.14, tuning = 0, chord?: number[]) => {
    const ctx = getAudio(); if (!ctx) return;
    voicesRef.current.get(id)?.stop();
    voicesRef.current.set(id, chord ? startBassChord(ctx, chord, direction, volume, tuning) : startReedNote(ctx, frequency, direction, volume, tuning));
    setAudioReady(true);
  }, [getAudio]);
  const stop = useCallback((id: string) => { voicesRef.current.get(id)?.stop(); voicesRef.current.delete(id); }, []);
  const stopAll = useCallback(() => { voicesRef.current.forEach(voice => voice.stop()); voicesRef.current.clear(); }, []);
  const context = useCallback(() => getAudio(), [getAudio]);
  return { start, stop, stopAll, ready: audioReady, context };
}

function App() {
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [notes, setNotes] = useState<Note[]>([]);
  const [songTime, setSongTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [health, setHealth] = useState(100);
  const [feedback, setFeedback] = useState('');
  const [laneFlash, setLaneFlash] = useState<LaneFlash | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(64);
  const [speed, setSpeed] = useState(1);
  const [difficulty, setDifficulty] = useState('Normal');
  const [bellows, setBellows] = useState(false);
  const [direction, setDirection] = useState<BellowsDirection>('pull');
  const [tuning, setTuning] = useState('Sol · Do · Fa');
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set());
  const [highScores, setHighScores] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem('acordenrush-scores') ?? '{}') as Record<string, number>; } catch { return {}; } });
  const instrument = useInstrument();
  const activeSong = songs[selected];
  const notesRef = useRef(notes); notesRef.current = notes;
  const songTimeRef = useRef(songTime); songTimeRef.current = songTime;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const muteRef = useRef(muted); muteRef.current = muted;
  const latestHitRef = useRef<(lane: number) => void>(() => undefined);
  const startTimeRef = useRef(0);
  const startTimestampRef = useRef(0);
  const rafRef = useRef(0);
  const nextNoteRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laneFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(0);
  const settingsRef = useRef({ volume, muted, bellows, direction, tuning, speed });
  settingsRef.current = { volume, muted, bellows, direction, tuning, speed };
  const voicesActiveRef = useRef(false);
  const heldKeysRef = useRef(new Set<string>());
  const gameKeys = ['A', 'S', 'D', 'F', 'G'];

  const playInstrumentKey = useCallback((id: string, fallback: number, kind: 'melody' | 'bass' = 'melody', selectedDirection?: BellowsDirection) => {
    if (settingsRef.current.muted || !settingsRef.current.bellows && !selectedDirection) return;
    const opened = settingsRef.current.bellows;
    const directionNow = selectedDirection ?? settingsRef.current.direction;
    const key = [...melodyKeys, ...bassKeys].find(item => item.id === id);
    const frequency = key ? (directionNow === 'push' ? key.push : key.pull) : fallback;
    instrument.start(id, frequency, directionNow, Math.max(.025, settingsRef.current.volume / 100 * (kind === 'bass' ? .2 : .29)), tuningOffsets[settingsRef.current.tuning] ?? 0, kind === 'bass' ? key?.chord : undefined);
    voicesActiveRef.current = true;
    setActiveKeys(old => new Set(old).add(id));
    if (!opened) setBellows(true);
    window.clearTimeout((window as Window & { __bellowsTimer?: number }).__bellowsTimer);
    (window as Window & { __bellowsTimer?: number }).__bellowsTimer = window.setTimeout(() => setBellows(settingsRef.current.bellows || voicesActiveRef.current), opened ? 500 : 420);
  }, [instrument]);
  const stopInstrumentKey = useCallback((id: string) => {
    instrument.stop(id);
    setActiveKeys(old => { const next = new Set(old); next.delete(id); voicesActiveRef.current = next.size > 0; if (!next.size && !settingsRef.current.bellows) setBellows(false); return next; });
  }, [instrument]);
  const setBellowsHeld = useCallback((held: boolean, nextDirection?: BellowsDirection) => {
    if (nextDirection) setDirection(nextDirection);
    setBellows(held);
    if (!held) { instrument.stopAll(); setActiveKeys(new Set()); voicesActiveRef.current = false; return; }
    const activeDirection = nextDirection ?? settingsRef.current.direction;
    [...heldKeysRef.current].forEach(label => {
      const key = melodyKeys.find(item => item.label === label) ?? bassKeys.find(item => item.label === label);
      if (key) playInstrumentKey(key.id, activeDirection === 'push' ? key.push : key.pull, key.id.startsWith('bass-') ? 'bass' : 'melody', activeDirection);
    });
  }, [instrument, playInstrumentKey]);
  const playMappedMelody = useCallback((keyLabel: string) => {
    const key = melodyKeys.find(item => item.label === keyLabel);
    if (!key) return;
    playInstrumentKey(key.id, settingsRef.current.direction === 'push' ? key.push : key.pull);
  }, [playInstrumentKey]);
  const playFreeLane = useCallback((lane: number) => {
    const key = melodyKeys[lane];
    if (!key) return;
    const directionNow = settingsRef.current.direction;
    playInstrumentKey(key.id, directionNow === 'push' ? key.push : key.pull, 'melody', directionNow);
    window.setTimeout(() => stopInstrumentKey(key.id), 230);
  }, [playInstrumentKey, stopInstrumentKey]);

  const showFeedback = useCallback((text: string) => {
    setFeedback(text);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(''), 680);
  }, []);

  const flashLane = useCallback((lane: number, kind: LaneFlash['kind']) => {
    setLaneFlash({ lane, kind, token: performance.now() });
    if (laneFlashTimerRef.current) clearTimeout(laneFlashTimerRef.current);
    laneFlashTimerRef.current = setTimeout(() => setLaneFlash(null), 260);
  }, []);

  const judge = useCallback((lane: number) => {
    if (phaseRef.current !== 'playing') { return; }
    const now = songTimeRef.current;
    const target = notesRef.current.filter(n => !n.judged && n.lane === lane).sort((a, b) => Math.abs(a.time - now) - Math.abs(b.time - now))[0];
    if (!target || Math.abs(target.time - now) > 190) { flashLane(lane, 'miss'); showFeedback(target ? 'MUY PRONTO' : 'SIN NOTA'); return; }
    const gap = Math.abs(target.time - now);
    const quality = gap <= 65 ? 'PERFECT' : gap <= 125 ? 'BIEN' : 'CERCA';
    flashLane(lane, 'hit');
    playFreeLane(lane);
    setNotes(old => old.map(note => note.id === target.id ? { ...note, judged: true, state: 'hit' } : note));
    const nextCombo = combo + 1; setCombo(nextCombo); setBestCombo(old => Math.max(old, nextCombo));
    setScore(old => old + (quality === 'PERFECT' ? 1000 : quality === 'BIEN' ? 650 : 300) * Math.min(4, 1 + Math.floor(nextCombo / 10)));
    setHealth(old => Math.min(100, old + (quality === 'PERFECT' ? 1 : 0)));
    showFeedback(quality);
  }, [combo, flashLane, playFreeLane, showFeedback]);
  latestHitRef.current = judge;

  const resetGame = useCallback((song: Song) => {
    sessionRef.current += 1;
    setNotes(song.events.filter(event => event.role === 'melody').map((event, id) => ({ id, time:event.time + 2200, lane:event.lane, state:'pending', judged:false })));
    setSongTime(0); setScore(0); setCombo(0); setBestCombo(0); setHealth(100); setFeedback(''); nextNoteRef.current = 0;
  }, []);

  const beginCountdown = useCallback((resume = false) => {
    const session = sessionRef.current;
    setPhase('countdown'); setCountdown(3);
    let count = 3;
    const timer = setInterval(() => {
      if (session !== sessionRef.current) { clearInterval(timer); return; }
      count -= 1;
      if (count > 0) setCountdown(count);
      else {
        clearInterval(timer); setPhase('playing');
        startTimestampRef.current = performance.now() - (resume ? songTimeRef.current / settingsRef.current.speed : 0);
        startTimeRef.current = resume ? songTimeRef.current : 0;
      }
    }, 650);
  }, [instrument]);

  const startGame = useCallback(() => { controlOfficialTrack('playVideo'); resetGame(activeSong); beginCountdown(false); }, [activeSong, beginCountdown, resetGame]);
  const previewSong = useCallback(() => { document.querySelector('.official-track')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, []);
  const pauseGame = useCallback(() => { controlOfficialTrack('pauseVideo'); setPhase('paused'); }, []);
  const resumeGame = useCallback(() => { controlOfficialTrack('playVideo'); beginCountdown(true); }, [beginCountdown]);
  const replay = useCallback(() => startGame(), [startGame]);
  const nextSong = useCallback((direction: number) => { controlOfficialTrack('pauseVideo'); const next = (selected + direction + songs.length) % songs.length; setSelected(next); setPhase('ready'); resetGame(songs[next]); }, [resetGame, selected]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const loop = (timestamp: number) => {
      if (phaseRef.current !== 'playing') return;
      const elapsed = startTimeRef.current + (timestamp - startTimestampRef.current) * speed;
      setSongTime(elapsed);
      const upcoming = activeSong.notes;
      while (nextNoteRef.current < upcoming.length && upcoming[nextNoteRef.current]! <= elapsed + 2600) nextNoteRef.current += 1;
      const notesLength = activeSong.durationMs;
      if (elapsed > notesLength + 500) {
        controlOfficialTrack('pauseVideo');
        setPhase('finished');
        setHighScores(old => { const next = { ...old, [activeSong.id]: Math.max(old[activeSong.id] ?? 0, score) }; localStorage.setItem('acordenrush-scores', JSON.stringify(next)); return next; });
        return;
      }
      const pending = notesRef.current;
      const missed = pending.filter(n => !n.judged && elapsed > n.time + 190);
      if (missed.length) {
        const missedIds = new Set(missed.map(n => n.id));
        setNotes(old => old.map(n => missedIds.has(n.id) ? { ...n, judged: true, state: 'miss' } : n));
        setCombo(0); setHealth(old => Math.max(0, old - missed.length * 7)); showFeedback('FALLO');
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [activeSong, health, phase, score, showFeedback, speed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Escape') { if (phaseRef.current === 'playing') pauseGame(); else if (phaseRef.current === 'paused') resumeGame(); return; }
      if (event.code === 'Space') { event.preventDefault(); setBellowsHeld(true, event.shiftKey ? 'push' : 'pull'); return; }
      const keyLabel = event.key.toUpperCase();
      const melodyKey = melodyKeys.find(item => item.label === keyLabel);
      const bassKey = bassKeys.find(item => item.label === keyLabel);
      const lane = gameKeys.indexOf(keyLabel);
      if (lane >= 0) { event.preventDefault(); latestHitRef.current(lane); return; }
      if (melodyKey) { event.preventDefault(); heldKeysRef.current.add(keyLabel); if (settingsRef.current.bellows) playMappedMelody(keyLabel); }
      else if (bassKey) { event.preventDefault(); heldKeysRef.current.add(keyLabel); if (settingsRef.current.bellows) playInstrumentKey(bassKey.id, bassKey.pull, 'bass'); }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setBellowsHeld(false);
      const key = melodyKeys.find(item => item.label === event.key.toUpperCase()) ?? bassKeys.find(item => item.label === event.key.toUpperCase());
      if (key) { heldKeysRef.current.delete(key.label); stopInstrumentKey(key.id); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [pauseGame, playInstrumentKey, playMappedMelody, resumeGame, setBellowsHeld, stopInstrumentKey]);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); if (laneFlashTimerRef.current) clearTimeout(laneFlashTimerRef.current); void (async () => { /* AudioContext is released by the browser when the page closes. */ })(); }, []);

  const visibleNotes = useMemo(() => notes.filter(note => !note.judged || songTime - note.time < 300).map(note => ({ ...note, y: 100 - ((note.time - songTime) / 2200) * 100 })), [notes, songTime]);
  const progress = Math.min(100, songTime / ((activeSong.notes.at(-1) ?? 1) + 3200) * 100);
  const displayDuration = activeSong.duration;
  const accuracy = notes.filter(n => n.judged).length ? Math.round(notes.filter(n => n.state === 'hit').length / notes.filter(n => n.judged).length * 100) : 100;

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="AcordenRush inicio"><span className="brand-mark"><AudioLines size={20} strokeWidth={2.5} /></span><span className="brand-word">acorden<span>rush</span></span></a>
      <nav className="top-nav" aria-label="Principal"><a className="nav-item active" href="#play">Jugar</a><a className="nav-item" href="#how-to-play">Cómo jugar</a><button className="nav-item nav-button" onClick={() => setSettingsOpen(true)}>Ajustes <ChevronDown size={14} /></button></nav>
      <div className="top-right"><span className="top-stats"><Activity size={15} /> <span>RACHA MÁS ALTA</span> <strong>{Math.max(0, ...Object.values(highScores)) > 0 ? '✦' : '—'}</strong></span><button className="settings-circle" onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes"><Settings2 size={17} /></button></div>
    </header>

    <section className="hero" id="home">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dash" /> EL RITMO DEL VALLENATO, EN TUS MANOS <span className="eyebrow-dash" /></div>
        <h1>Toca el fuelle.<br /><span>Domina el ritmo.</span></h1>
        <p className="hero-sub">El acordeón suena mejor cuando lo tocas tú.</p>
        <div className="hero-cta"><button className="primary-button" onClick={startGame}><Play size={17} fill="currentColor" /> EMPEZAR A JUGAR <span>→</span></button><a className="secondary-link" href="#how-to-play">¿PRIMERA VEZ? <ArrowDown size={14} /></a></div>
        <div className="feature-row"><div><span className="feature-icon heart-icon"><Heart size={17} /></span><span>Hecho con <i>♥</i> por el vallenato</span></div><span className="feature-divider" /><div><span className="feature-icon"><Headphones size={17} /></span><span>Se disfruta más con audífonos</span></div></div>
      </div>
      <Accordion open={bellows || activeKeys.size > 0} direction={direction} />
      <div className="hero-bottomline"><span>FUNDADO EN COLOMBIA <i>✦</i></span><span>VALLENATO EN CADA NOTA</span></div>
    </section>

    <section className="game-section" id="play">
      <div className="section-heading"><div><div className="section-kicker">TU PRÓXIMA CANCIÓN</div><h2>¿Listo para el reto?</h2></div><div className="song-count"><span>01</span> / 05 <span className="count-spark">✳</span></div></div>
      <div className="game-layout">
        <aside className="song-panel"><div className="panel-label"><span>SELECCIONA CANCIÓN</span><span className="available-dot" /> <small>{String(selected + 1).padStart(2, '0')} DE 05</small></div>
          <div className="song-list">{songs.map((song, index) => <button key={song.id} className={`song-item ${index === selected ? 'selected' : ''}`} onClick={() => { controlOfficialTrack('pauseVideo'); setSelected(index); setPhase('ready'); resetGame(song); }} style={{ '--song-color': song.color, '--song-accent': song.accent } as React.CSSProperties}>
            <span className="song-art"><Music2 size={18} /></span><span className="song-info"><strong>{song.title}</strong><span>{song.artist}</span></span><span className="song-bpm">{song.bpm}<small>BPM</small></span>{index === selected && <span className="selected-caret"><ChevronRight size={16} /></span>}
          </button>)}</div>
          <div className="setlist-footer"><span><Sparkles size={14} /> SETLIST VALLENATO</span><button onClick={() => nextSong(1)} aria-label="Siguiente canción"><ChevronRight size={16} /></button></div>
        </aside>
        <div className="play-panel rhythm-panel" style={{ '--song-color': activeSong.color, '--song-accent': activeSong.accent } as React.CSSProperties}>
          <div className="play-header"><span className="play-eyebrow"><span className="available-dot" /> {phase === 'playing' ? 'EN VIVO' : phase === 'paused' ? 'EN PAUSA' : phase === 'finished' ? 'CANCIÓN TERMINADA' : 'CANCIÓN SELECCIONADA'}</span><div className="play-actions">{phase === 'ready' && <button className="preview-button" onClick={previewSong}><Play size={11} fill="currentColor" /> IR A LA CANCIÓN</button>}<button className="icon-button" aria-label={muted ? 'Activar sonido' : 'Silenciar'} onClick={() => { const next = !muted; setMuted(next); controlOfficialTrack(next ? 'mute' : 'unMute'); }}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div></div>
          <div className="song-title-line"><div><h3>{activeSong.title}</h3><div className="song-artist">{activeSong.artist} <span>·</span> Audio oficial + carril de práctica</div></div><div className="song-meta"><span>{activeSong.bpm}<small>BPM</small></span><i /><span>{displayDuration}<small>CANCIÓN</small></span></div></div>
          <div className="official-track"><div className="official-track-heading"><span><Headphones size={14} /> GRABACIÓN ORIGINAL</span><small>Reproductor oficial de YouTube</small></div><iframe key={activeSong.youtubeId} src={`https://www.youtube-nocookie.com/embed/${activeSong.youtubeId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&rel=0&playsinline=1`} title={`${activeSong.title} — ${activeSong.artist} (audio oficial)`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
          <div className={`playfield guitar-board ${phase === 'ready' ? 'is-ready' : ''} ${phase === 'playing' ? 'is-playing' : ''}`}>
            <div className="field-shine" />
            <div className="stage-wash" aria-hidden="true"><i /><i /><i /><span className="stage-crowd" /></div>
            <div className="field-topline"><span>ACORDENRUSH · MODO RITMO</span><span className="tempo-chip"><i /> {activeSong.bpm} BPM</span></div>
            <div className="lane-grid" aria-hidden="true">{gameKeys.map((key, i) => {
              const topLeft = 37 + i * 5.2; const topRight = topLeft + 5.2;
              return <div className={`lane ${laneFlash?.lane === i ? `lane-${laneFlash.kind}` : ''}`} key={key} style={{ '--lane-color': laneColors[i], '--lane-x-top': `${(topLeft + topRight) / 2}%`, clipPath: `polygon(${topLeft}% 0, ${topRight}% 0, ${(i + 1) * 20}% 100%, ${i * 20}% 100%)` } as React.CSSProperties}><span className="lane-name">{laneNames[i]}</span></div>;
            })}</div>
            <svg className="track-rails" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
              <path d="M370 0 L0 500 M422 0 L200 500 M474 0 L400 500 M526 0 L600 500 M578 0 L800 500 M630 0 L1000 500" />
              <path d="M314 76 L686 76 M238 178 L762 178 M161 282 L839 282 M83 388 L917 388" className="track-frets" />
            </svg>
            <div className="note-layer" aria-hidden="true">{visibleNotes.filter(note => note.y >= 0 && note.y <= 100).map(note => {
              const center = 50 + (note.lane - 2) * (5.2 + note.y * 0.148);
              const scale = 0.42 + note.y * 0.008;
              return <div key={note.id} className={`falling-note ${note.state === 'hit' ? 'note-hit' : note.state === 'miss' ? 'note-miss' : ''}`} style={{ left: `${center}%`, top: `${note.y}%`, transform: `translate(-50%,-50%) scale(${scale})`, '--lane-color': laneColors[note.lane] } as React.CSSProperties}><span /></div>;
            })}</div>
            <div className="strike-zone" aria-hidden="true" />
            <div className="fret-pad-row">{gameKeys.map((key, i) => <button key={key} className={`hit-key ${laneFlash?.lane === i ? `fret-${laneFlash.kind}` : ''}`} style={{ '--lane-color': laneColors[i] } as React.CSSProperties} onPointerDown={event => { event.preventDefault(); judge(i); }} aria-label={`Carril ${laneNames[i]}, tecla ${key}`}><i /><span>{key}</span></button>)}</div>
            {feedback && <div className={`hit-feedback ${feedback === 'FALLO' ? 'bad' : ''}`}>{feedback}</div>}
            {(phase === 'ready' || phase === 'countdown' || phase === 'paused' || phase === 'finished') && <div className="field-overlay">{phase === 'ready' ? <div className="ready-card"><span>5 CARRILES · ACORDEÓN VALLENATO</span><strong>¿Le damos?</strong><small>Usa A · S · D · F · G o toca los círculos</small><button className="ready-button" onClick={startGame}><Play size={15} fill="currentColor" /> INICIAR CANCIÓN</button></div> : phase === 'countdown' ? <div className="countdown-number">{countdown}</div> : phase === 'paused' ? <div className="ready-card"><span>TOMA AIRE</span><strong>En pausa</strong><button className="ready-button" onClick={resumeGame}><Play size={15} fill="currentColor" /> CONTINUAR</button></div> : <div className="ready-card"><span>{health === 0 ? 'SE ACABÓ LA CANCIÓN' : '¡QUÉ BUEN TOQUE!'}</span><strong>{score.toLocaleString('es-CO')} pts</strong><div className="result-extra"><span>{accuracy}% precisión</span><span>✦ Mejor combo {bestCombo}</span></div><button className="ready-button" onClick={replay}><RotateCcw size={15} /> VOLVER A JUGAR</button></div>}</div>}
            <div className="field-bottom"><span><span className="keyboard-hint">⌨</span> TECLAS: A · S · D · F · G</span>{phase === 'playing' && <button className="pause-inline" onClick={pauseGame}><Pause size={13} fill="currentColor" /> PAUSA</button>}</div>
          </div>
          <div className="hud-row"><div className="hud-stat score-stat"><span>PUNTAJE</span><strong>{score.toLocaleString('es-CO')}</strong></div><div className="hud-stat combo-stat"><span>COMBO</span><strong>×{combo}</strong></div><div className="hud-stat accuracy-stat"><span>PRECISIÓN</span><strong>{accuracy}<small>%</small></strong></div><div className="hud-stat life-stat"><span>ENERGÍA</span><div className="health-meter"><i style={{ width: `${health}%` }} /></div><strong>{health}<small>%</small></strong></div></div>
          <div className="track-progress"><span>{Math.floor(songTime / 60000)}:{String(Math.floor(songTime / 1000) % 60).padStart(2, '0')}</span><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><span>{displayDuration}</span></div>
        </div>
      </div>
      <AccordionKeyboard tuning={tuning} onTuningChange={setTuning} direction={direction} bellows={bellows} activeKeys={activeKeys} audioReady={instrument.ready} onPlay={playInstrumentKey} onStop={stopInstrumentKey} onBellows={setBellowsHeld} />
    </section>

    <section className="how-section" id="how-to-play"><div className="how-title"><div className="section-kicker">ASÍ SE TOCA EL ACORDEÓN</div><h2>Mano, aire y melodía.</h2><p>Mantén el fuelle y pulsa una nota: el acordeón diatónico cambia al halar y empujar.</p></div><div className="steps"><div className="step-card"><div className="step-icon step-icon-one"><span>01</span><Music2 size={21} /></div><strong>Elige tu canción</strong><p>Escoge uno de los clásicos vallenatos.</p></div><div className="step-arrow"><ChevronRight size={17} /></div><div className="step-card"><div className="step-icon step-icon-two"><span>02</span><div className="mini-lanes"><i /><i /><i /><i /><i /></div></div><strong>Marca el fuelle</strong><p>Espacio hala; Shift + espacio empuja.</p></div><div className="step-arrow"><ChevronRight size={17} /></div><div className="step-card"><div className="step-icon step-icon-three"><span>03</span><Crown size={22} /></div><strong>Toca los botones</strong><p>Q–; melodía y 1–= bajos/acordes.</p></div></div>
      <div className="keys-guide"><span className="guide-label">31 TECLAS DE MELODÍA</span>{melodyKeys.slice(0,5).map(key => <span className="key-guide-item" key={key.id}><kbd>{key.label}</kbd><small>{key.note}</small></span>)}<span className="guide-tip"><CircleHelp size={14} /> Q–; melodía · 1–= bajos · mantén espacio para halar</span></div>
    </section>

    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark"><AudioLines size={17} /></span><span className="brand-word">acorden<span>rush</span></span></a><div><span>HECHO CON </span><i>♥</i><span> Y MUCHO VALLENATO EN COLOMBIA</span></div><span className="footer-note">Toca el fuelle, domina el ritmo.</span></footer>

    {settingsOpen && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div><div className="section-kicker">PERSONALIZA TU PARTIDA</div><h2 id="settings-title">Ajustes</h2></div><button className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Cerrar"><X size={18} /></button></header><label className="setting-control"><span><strong>Dificultad</strong><small>Ajusta el reto a tu manera</small></span><select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option>Fácil</option><option>Normal</option><option>Difícil</option></select></label><label className="setting-control"><span><strong>Velocidad de notas</strong><small>Velocidad actual: {speed.toFixed(2)}×</small></span><input type="range" min="0.65" max="1.4" step="0.05" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label><label className="setting-control"><span><strong>Volumen</strong><small>{volume}%</small></span><div className="volume-control"><button onClick={() => setMuted(v => !v)} aria-label="Alternar sonido">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /></div></label><p className="settings-note">La grabación original se reproduce desde YouTube y requiere conexión. Las notas son un arreglo de práctica, no la transcripción del acordeón de la grabación. El teclado usa muestras reales de acordeón Hohner.</p><button className="save-settings" onClick={() => setSettingsOpen(false)}><Check size={16} /> LISTO, ¡A TOCAR!</button></section></div>}
  </main>;
}

export default App;

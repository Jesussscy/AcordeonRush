import { useState, type FormEvent } from 'react';
import { Check, FileMusic, Music2, Trash2, Upload } from 'lucide-react';
import { parseSongChart } from '../gameplay/chart';
import { chartFromMidi } from '../gameplay/midi-import';
import { deletePrivateSong, savePrivateSong } from '../gameplay/private-songs';
import { songCatalog } from '../gameplay/song-catalog';
import { resolveChart } from '../gameplay/fingering';
import { tuningOptions } from '../instrument/accordion-catalog';

export function PrivateSongs({ onBack, onPlay }: { onBack(): void; onPlay(id: string): void }) {
  const [chartFile, setChartFile] = useState<File>();
  const [audio, setAudio] = useState<File>();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [tuning, setTuning] = useState('auto');
  const [offset, setOffset] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [, refresh] = useState(0);
  const entries = songCatalog.filter((entry) => entry.private);

  async function importSong(event: FormEvent) {
    event.preventDefault();
    if (!chartFile || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (chartFile.size > 2_000_000) throw Error('El MIDI o JSON debe ocupar menos de 2 MB.');
      if (audio && audio.size > 80_000_000) throw Error('El audio debe ocupar menos de 80 MB.');
      if (audio && !/\.(mp3|wav|ogg)$/i.test(audio.name)) throw Error('Usa audio MP3, WAV u OGG.');
      const midi = /\.midi?$/i.test(chartFile.name);
      if (!midi && !/\.json$/i.test(chartFile.name)) throw Error('Selecciona un MIDI o chart JSON.');
      const raw = midi
        ? chartFromMidi(new Uint8Array(await chartFile.arrayBuffer()), {
            title: title.trim() || chartFile.name.replace(/\.[^.]+$/, ''),
            artist: artist.trim() || 'Biblioteca privada',
            grid: 0.03125,
          })
        : JSON.parse(await chartFile.text());
      const chart = parseSongChart({
        ...raw,
        title: title.trim() || raw.title,
        artist: artist.trim() || raw.artist,
        offsetMs: offset === '' ? raw.offsetMs : Number(offset),
        backingStyle: 'melody',
      });
      if (tuning === 'auto') {
        const coverage = tuningOptions.map((item) => ({
          id: item.id,
          missing: resolveChart(chart, { tuning: item.id }).dropped.length,
        }));
        chart.tuning = coverage.sort((a, b) => a.missing - b.missing)[0].id;
      } else chart.tuning = tuning;
      const fit = resolveChart(chart);
      if (!fit.notes.length)
        throw Error('La melodía no tiene notas disponibles en esta afinación. Prueba la selección automática.');
      if (audio) {
        const context = new AudioContext();
        try {
          await context.decodeAudioData(await audio.arrayBuffer());
        } catch {
          throw Error('El navegador no pudo leer este audio. Usa otro archivo MP3, WAV u OGG.');
        } finally {
          await context.close();
        }
      }
      await savePrivateSong(chart, audio);
      setNotice(
        `«${chart.title}» guardada. ${fit.notes.length} notas disponibles${fit.dropped.length ? `, ${fit.dropped.length} fuera del rango del instrumento` : ''}.`,
      );
      refresh((n) => n + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo importar la canción.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError('');
    setBusy(true);
    try {
      await deletePrivateSong(id);
      setNotice('Canción eliminada de tu biblioteca.');
      refresh((n) => n + 1);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="vh-screen private-page">
      <button className="vh-back" onClick={onBack}>
        ← Menú
      </button>
      <header className="page-heading">
        <span className="eyebrow">Tu música, tu espacio</span>
        <h1 className="vh-logo">Canciones privadas</h1>
        <p>Prepara tu repertorio y llévalo al escenario.</p>
      </header>
      <div className="private-layout">
        <form className="import-panel" onSubmit={(event) => void importSong(event)}>
          <div className="panel-title">
            <Upload size={22} />
            <h2>Importar canción</h2>
          </div>
          <p className="muted">
            Los archivos se guardan en este navegador. Si borras sus datos, también se elimina esta biblioteca.
          </p>
          <label className="upload-field">
            <FileMusic size={30} />
            <b>{chartFile?.name || 'Selecciona la melodía'}</b>
            <span>MIDI o chart JSON · hasta 2 MB</span>
            <input
              required
              aria-label="Melodía MIDI o JSON"
              type="file"
              accept=".mid,.midi,.json"
              onChange={(e) => {
                setChartFile(e.target.files?.[0]);
                setNotice('');
              }}
            />
          </label>
          <div className="form-columns">
            <label className="vh-field">
              Título
              <input
                value={title}
                maxLength={160}
                placeholder="Nombre de la canción"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="vh-field">
              Artista
              <input
                value={artist}
                maxLength={160}
                placeholder="Nombre del intérprete"
                onChange={(e) => setArtist(e.target.value)}
              />
            </label>
          </div>
          <label className="vh-field">
            Afinación
            <select value={tuning} onChange={(e) => setTuning(e.target.value)}>
              <option value="auto">Automática · mejor cobertura</option>
              {tuningOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="vh-field">
            Grabación de fondo opcional
            <input type="file" accept=".mp3,.ogg,.wav" onChange={(e) => setAudio(e.target.files?.[0])} />
            <small>MP3, OGG o WAV · hasta 80 MB. Usa una grabación que coincida con la melodía.</small>
          </label>
          <label className="vh-field">
            Inicio de la melodía en el audio (ms)
            <input
              type="number"
              min={0}
              max={3600000}
              step={10}
              value={offset}
              placeholder="Usar el valor del chart o 0"
              onChange={(e) => setOffset(e.target.value)}
            />
            <small>Por ejemplo, 2000 si las notas empiezan a los dos segundos.</small>
          </label>
          <p className="muted">
            El MIDI aporta las notas. Sin grabación, escucharás una guía de acordeón. La pista grabada se reproduce al
            100 % de velocidad.
          </p>
          <button className="vh-btn primary" disabled={busy || !chartFile}>
            <Upload size={18} />
            {busy ? 'Guardando…' : 'Guardar en mi biblioteca'}
          </button>
        </form>
        <section className="private-library">
          <div className="panel-title">
            <Music2 size={22} />
            <h2>Mi repertorio</h2>
            <span className="vh-chip">{entries.length}</span>
          </div>
          {error && (
            <p className="vh-error-box" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="import-success" role="status">
              <Check size={18} />
              {notice}
            </p>
          )}
          {!entries.length && (
            <div className="empty-library">
              <Music2 size={40} />
              <h3>Tu próxima canción empieza aquí</h3>
              <p>Importa una melodía para jugar o practicar a tu ritmo.</p>
            </div>
          )}
          {entries.map((song) => (
            <article className="private-song" key={song.id}>
              <div className="song-art">
                <Music2 />
              </div>
              <div>
                <h3>{song.title}</h3>
                <p>{song.artist}</p>
                <small>
                  {song.bpm} BPM · {song.audioUrl ? 'Con grabación' : 'Guía de acordeón'}
                </small>
              </div>
              <div className="song-actions">
                <button className="vh-btn" disabled={busy || !!song.error} onClick={() => onPlay(song.id)}>
                  Practicar
                </button>
                {song.id.startsWith('local-') && (
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Eliminar ${song.title}`}
                    onClick={() => void remove(song.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

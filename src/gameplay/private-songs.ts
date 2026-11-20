import { parseSongChart, type SongChart } from './chart';
import { songCatalog, type SongEntry } from './song-catalog';

type PrivateSong = { id: string; chart: SongChart; audio?: Blob; audioName?: string };
const urls = new Map<string, string>();
let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('vallenato-private-songs', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('songs', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error('No se pudo abrir la biblioteca privada. Comprueba el almacenamiento del navegador.'));
  });
  return database;
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('songs', mode);
    const request = operation(tx.objectStore('songs'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(new Error('No se pudo guardar el cambio. Comprueba el espacio disponible.'));
    tx.onerror = () => reject(new Error('Error de almacenamiento en la biblioteca privada.'));
  });
}

function register(song: PrivateSong): SongEntry {
  const chart = parseSongChart(song.chart);
  const previous = urls.get(song.id);
  if (previous) URL.revokeObjectURL(previous);
  const audioUrl = song.audio ? URL.createObjectURL(song.audio) : undefined;
  if (audioUrl) urls.set(song.id, audioUrl);
  const entry = {
    id: song.id,
    chart,
    private: true,
    title: chart.title,
    artist: chart.artist,
    bpm: chart.bpm,
    audioUrl,
  };
  const index = songCatalog.findIndex((item) => item.id === song.id);
  if (index >= 0) songCatalog[index] = entry;
  else songCatalog.push(entry);
  return entry;
}

export async function loadPrivateSongs() {
  const saved = await transaction<PrivateSong[]>('readonly', (store) => store.getAll());
  saved.forEach(register);
}

export async function savePrivateSong(chart: SongChart, audio?: File) {
  const song: PrivateSong = { id: `local-${crypto.randomUUID()}`, chart, audio, audioName: audio?.name };
  parseSongChart(chart);
  await transaction('readwrite', (store) => store.put(song));
  return register(song);
}

export async function deletePrivateSong(id: string) {
  if (!id.startsWith('local-')) throw new Error('Esta canción pertenece a los archivos del proyecto.');
  await transaction('readwrite', (store) => store.delete(id));
  const index = songCatalog.findIndex((entry) => entry.id === id);
  if (index >= 0) songCatalog.splice(index, 1);
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}

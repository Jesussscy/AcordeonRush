import layoutFile from '../../data/layouts/gcf.json';
import { parseLayout, type LayoutFile } from './layout';
import modelManifest from '../../data/accordion-models.json';
export type BellowsDirection = 'push' | 'pull';

/** Active layout (G/C/F). Other layouts: add data/layouts/<id>.json with the same shape. */
export const layout = parseLayout(layoutFile as LayoutFile);
export type InstrumentKey = {
  id: string;
  /** Layout id shown on gems: A1…A10 (afuera), M1…M11 (medio), D1…D10 (adentro), B1…B12 (bajos). */
  code: string;
  bone: string;
  label: string;
  row: number;
  position: number;
  push: number[];
  pull: number[];
  chord: boolean;
};
const keyboardRows = [
  'QWERTYUIOP'.split(''),
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ', 'Z'],
  ['X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ';'],
];
let number = 0;
export const melodyButtons: InstrumentKey[] = layout.rows.flatMap((row, rowIndex) =>
  row.buttons.map(({ id: code, push, pull }, position) => ({
    id: `melody-${rowIndex}-${position}`,
    code,
    bone: `BTN_Melody_${String(++number).padStart(2, '0')}`,
    label: keyboardRows[rowIndex][position],
    row: rowIndex,
    position,
    push: [push],
    pull: [pull],
    chord: false,
  })),
);
export const bassButtons: InstrumentKey[] = layout.bass.map((item, index) => ({
  ...item,
  code: item.id,
  id: `bass-${index}`,
  bone: `BTN_Bass_${String(index + 1).padStart(2, '0')}`,
  label: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='][index],
  row: Math.floor(index / 3),
  position: index % 3,
}));
export const allButtons = [...melodyButtons, ...bassButtons];
export const tuningFamilies = layout.tunings.map((t) => ({
  ...t,
  verification: t.id === 'GCF' ? 'manufacturer-base' : 'virtual-transposition',
  source: layout.source,
}));
export const tuningOptions = tuningFamilies.flatMap((t) => [
  { ...t, low: false },
  { ...t, id: t.id + '-low', label: t.label + ' · Grave', semitones: t.semitones - 12, low: true },
]);
export const getTuning = (id: string) => {
  const result = tuningOptions.find((t) => t.id === id);
  if (!result) throw Error(`Afinación no publicada o alias retirado: ${id}. Usa una de las 24 opciones del catálogo.`);
  return result;
};
export const midiFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export function noteName(midi: number, flats = false, octave = true) {
  const names = flats
    ? ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Sol♭', 'Sol', 'La♭', 'La', 'Si♭', 'Si']
    : ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
  return names[((midi % 12) + 12) % 12] + (octave ? Math.floor(midi / 12) - 1 : '');
}
export function soundingNotes(key: InstrumentKey, direction: BellowsDirection, tuning: string) {
  const t = getTuning(tuning);
  return key[direction].map((n) => n + t.semitones);
}
export function buttonLabel(key: InstrumentKey, direction: BellowsDirection, tuning: string) {
  const t = getTuning(tuning),
    notes = soundingNotes(key, direction, tuning);
  return noteName(notes[0], t.flats, !key.chord) + (key.chord ? (notes[1] - notes[0] === 3 ? ' m' : ' M') : '');
}
export const registrations = [
  { id: 'vallenato-high', label: 'Vallenato agudo' },
  { id: 'vallenato', label: 'Vallenato · voces abiertas' },
  { id: 'natural', label: 'Natural · grabación base' },
  { id: 'double', label: 'Doble' },
  { id: 'musette', label: 'Musette' },
  { id: 'octave', label: 'Octava' },
];
const designs = [
  {
    id: 'curva-zafiro',
    name: 'Curva Zafiro',
    description: 'Azul perlado · rombo rojo',
    color: '#347cda',
    model: '/models/accordion/curva-zafiro.glb',
    image: '/models/accordion/curva-zafiro.webp',
  },
  {
    id: 'curva-esmeralda',
    name: 'Curva Esmeralda',
    description: 'Verde perlado · detalles dorados',
    color: '#3eac77',
    model: '/models/accordion/curva-esmeralda.glb',
    image: '/models/accordion/curva-esmeralda.webp',
  },
  {
    id: 'curva-granate',
    name: 'Curva Granate',
    description: 'Rojo perlado · rombo artesanal',
    color: '#c74b59',
    model: '/models/accordion/curva-granate.glb',
    image: '/models/accordion/curva-granate.webp',
  },
  {
    id: 'curva-grafito',
    name: 'Curva Grafito',
    description: 'Grafito perlado · rombo rojo',
    color: '#7f8d99',
    model: '/models/accordion/curva-grafito.glb',
    image: '/models/accordion/curva-grafito.webp',
  },
  {
    id: 'vino-clasico',
    name: 'Vino clásico',
    description: 'Perlado vino · parrilla de níquel',
    color: '#802b3b',
    model: '/models/accordion/vino-clasico.glb',
    image: '/models/accordion/vino-clasico.webp',
  },
  {
    id: 'azul-caribe',
    name: 'Azul Caribe',
    description: 'Azul profundo · diamantes y chevrones',
    color: '#205b9d',
    model: '/models/accordion/azul-caribe.glb',
    image: '/models/accordion/azul-caribe.webp',
  },
  {
    id: 'marfil-artesanal',
    name: 'Marfil artesanal',
    description: 'Marfil · incrustaciones geométricas',
    color: '#c3ac7e',
    model: '/models/accordion/marfil-artesanal.glb',
    image: '/models/accordion/marfil-artesanal.webp',
  },
  {
    id: 'negro-escenario',
    name: 'Negro escenario',
    description: 'Negro satinado · protectores y ranuras',
    color: '#454c59',
    model: '/models/accordion/negro-escenario.glb',
    image: '/models/accordion/negro-escenario.webp',
  },
];

export const instrumentDesigns = designs.map((d) => {
  const metadata = modelManifest[d.id as keyof typeof modelManifest];
  return {
    ...d,
    model: d.model + '?v=' + metadata.sha256.slice(0, 12),
    image: d.image + '?v=' + metadata.sha256.slice(0, 12),
    ...metadata,
  };
});
export const layoutSource = layout.verification;

import { allButtons } from '../instrument/accordion-catalog';

/** Accordion buttons in physical-key order (31 melody, then 12 bass). */
export const buttons = allButtons.map((b) => ({
  name: b.bone,
  short: `${b.bone.includes('Melody') ? 'M' : 'B'}${Number(b.bone.slice(-2))}`,
  melody: b.bone.includes('Melody'),
  row: b.row + 1,
  push: b.push,
  pull: b.pull,
  key: b.label,
}));
export type Button = (typeof buttons)[number];

// Physical positions are stable across keyboard languages and Shift punctuation.
const codes = [
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
  'Comma',
  'Period',
  'Slash',
  'Quote',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
  'Minus',
  'Equal',
];
export function keyboardButton(code: string) {
  return buttons[codes.indexOf(code)];
}
export function keyboardLabel(bone: string, layout = 'es') {
  const index = buttons.findIndex((b) => b.name === bone),
    code = codes[index];
  const punctuation: Record<string, string> =
    layout === 'es'
      ? { Semicolon: 'Ñ', Quote: '´', Comma: ',', Period: '.', Slash: '-', Minus: "'", Equal: '¡' }
      : { Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=' };
  return punctuation[code] ?? code?.replace('Key', '').replace('Digit', '') ?? '';
}
export const clockLabel = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

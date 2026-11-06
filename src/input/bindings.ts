import { melodyButtons } from '../instrument/accordion-catalog';

/** Game actions besides the 31 melody buttons. */
export type GameAction = 'bellows' | 'parranda' | 'pause';

/** Default game controls (spec): afuera = Z…/, medio = A…', adentro = Q…P, Space = bellows. */
export const DEFAULT_ROW_CODES: string[][] = [
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
];
export const DEFAULT_ACTION_CODES: Record<GameAction, string> = {
  bellows: 'Space',
  parranda: 'Enter',
  pause: 'Escape',
};

export type Bindings = { buttons: Record<string, string>; actions: Record<GameAction, string> };

/** code → melody button id (melody-<row>-<position>). */
export function defaultBindings(): Bindings {
  const buttons: Record<string, string> = {};
  for (const b of melodyButtons) buttons[b.id] = DEFAULT_ROW_CODES[b.row][b.position];
  return { buttons, actions: { ...DEFAULT_ACTION_CODES } };
}

export function codeToButtonMap(bindings: Bindings) {
  return new Map(Object.entries(bindings.buttons).map(([id, code]) => [code, id]));
}

const SPANISH: Record<string, string> = {
  Semicolon: 'Ñ',
  Quote: '´',
  Comma: ',',
  Period: '.',
  Slash: '-',
  Minus: "'",
  Equal: '¡',
  BracketLeft: '`',
  BracketRight: '+',
  Backslash: 'Ç',
};
const ENGLISH: Record<string, string> = {
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
};
let layoutMap: Map<string, string> | null = null;

/** Ask the browser for the real keyboard layout (Chrome/Edge); falls back to Spanish labels. */
export async function detectKeyboardLayout() {
  try {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } })
      .keyboard;
    if (keyboard) layoutMap = new Map(await keyboard.getLayoutMap());
  } catch {
    layoutMap = null;
  }
}

/** Human label of a KeyboardEvent.code for the player's keyboard. */
export function keyLabel(code: string, layout: 'auto' | 'es' | 'en' = 'auto') {
  if (code === 'Space') return 'Espacio';
  if (code === 'Enter') return 'Enter';
  if (code === 'Escape') return 'Esc';
  if (layout === 'auto' && layoutMap?.get(code)) return layoutMap.get(code)!.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return (layout === 'en' ? ENGLISH : SPANISH)[code] ?? code;
}

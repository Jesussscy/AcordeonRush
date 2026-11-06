import { describe, expect, it } from 'vitest';
import { keyboardButton, keyboardLabel } from '../../src/input/keyboard-map';

// Migrated from tools/validate-practice.mjs (keyboard part).
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

describe('studio keyboard map', () => {
  it('binds 43 physical keys to 43 distinct buttons', () => {
    expect(new Set(codes.map((code) => keyboardButton(code)?.name)).size).toBe(43);
    expect(keyboardButton('Enter')).toBeUndefined();
  });

  it.each(['es', 'en'])('shows 43 distinct labels for the %s layout', (layout) => {
    const labels = codes.map((code) => keyboardLabel(keyboardButton(code)!.name, layout));
    expect(new Set(labels).size).toBe(43);
  });

  it('uses layout-specific punctuation labels', () => {
    expect(keyboardLabel('BTN_Melody_20', 'es')).toBe('Ñ');
    expect(keyboardLabel('BTN_Melody_31', 'en')).toBe("'");
  });
});

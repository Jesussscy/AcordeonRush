import { defaultBindings, type Bindings } from '../input/bindings';
import { readJson, writeJson } from './storage';

export type Settings = {
  /** "Fuelle asistido": the game moves the bellows for you (off by default). */
  assistedBellows: boolean;
  /** Calibration in milliseconds. */
  audioOffsetMs: number;
  videoOffsetMs: number;
  volume: number;
  /** Show the keyboard key on every gem. */
  showKeyHints: boolean;
  quality: 'high' | 'low';
  keyboardLayout: 'auto' | 'es' | 'en';
  bindings: Bindings;
  /** Last chosen accordion design and difficulty. */
  design: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
};

const KEY = 'vallenato-hero:settings';

export const defaultSettings = (): Settings => ({
  assistedBellows: false,
  audioOffsetMs: 0,
  videoOffsetMs: 0,
  volume: 0.85,
  showKeyHints: true,
  quality: 'high',
  keyboardLayout: 'auto',
  bindings: defaultBindings(),
  design: 'curva-zafiro',
  difficulty: 'medium',
});

export function loadSettings(): Settings {
  const stored = readJson<Settings>(KEY, defaultSettings());
  // Merge bindings key by key so new buttons/actions keep their defaults.
  const defaults = defaultBindings();
  stored.bindings = {
    buttons: { ...defaults.buttons, ...(stored.bindings?.buttons ?? {}) },
    actions: { ...defaults.actions, ...(stored.bindings?.actions ?? {}) },
  };
  return stored;
}

export function saveSettings(settings: Settings) {
  writeJson(KEY, settings);
}

import type { ErrorKind, Grade } from '../gameplay/judge';

export type HudState = {
  score: number;
  multiplier: number;
  lights: number;
  streak: number;
  bestStreak: number;
  perfectStreak: number;
  meter: number;
  zone: 'red' | 'yellow' | 'green';
  hats: number;
  parrandaReady: boolean;
  parranda: boolean;
  /** 0…1 song progress. */
  progress: number;
  /** Seconds until the first note (count-in), negative once playing. */
  countdown: number;
  bellows: 'push' | 'pull';
};

export type ScreenPoint = { x: number; y: number };

/** Everything the game session tells the HUD. Implemented by hud/Hud.ts. */
export interface HudApi {
  update(state: HudState, dt: number): void;
  timing(grade: Grade, offset: number, at: ScreenPoint): void;
  error(kind: ErrorKind, at: ScreenPoint): void;
  milestone(streak: number): void;
  streakBroken(streak: number): void;
  multiplierUp(multiplier: number): void;
  multiplierLost(): void;
  bestStreakBeaten(streak: number): void;
  parranda(active: boolean): void;
  parrandaReady(): void;
  meterZone(zone: 'red' | 'yellow' | 'green'): void;
  bellowsHint(direction: 'push' | 'pull'): void;
  banner(text: string, kind?: 'info' | 'fail' | 'gold'): void;
  dispose(): void;
}

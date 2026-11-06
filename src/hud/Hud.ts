import type { ErrorKind, Grade } from '../gameplay/judge';
import type { HudApi, HudState, ScreenPoint } from './hud-types';
import './hud.css';

const GRADE_TEXT: Record<Grade, string> = { perfect: '¡PERFECTO!', good: '¡BIEN!', ok: 'OK' };
const ERROR_TEXT: Record<ErrorKind, string> = {
  missed: '¡FALLO!',
  button: 'BOTÓN',
  bellows: '¡FUELLE!',
  early: 'TEMPRANO',
  late: 'TARDE',
  ghost: '¡OJO!',
};

/** Minimal HUD (H1): score, multiplier, streak, timing labels and progress. */
export class Hud implements HudApi {
  private readonly el: HTMLElement;
  private readonly score: HTMLElement;
  private readonly multiplier: HTMLElement;
  private readonly streak: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly floats: HTMLElement;

  constructor(root: HTMLElement, info: { title: string; artist: string }) {
    this.el = document.createElement('div');
    this.el.className = 'vh-hud';
    this.el.innerHTML = `
      <div class="vh-top"><div class="vh-progress"><i></i></div><div class="vh-title"><b></b><span></span></div></div>
      <div class="vh-left"><div class="vh-score">0</div><div class="vh-mult">x1</div><div class="vh-streak">0</div></div>
      <div class="vh-countdown"></div><div class="vh-floats"></div>`;
    root.append(this.el);
    this.el.querySelector('.vh-title b')!.textContent = info.title;
    this.el.querySelector('.vh-title span')!.textContent = info.artist;
    this.score = this.el.querySelector('.vh-score')!;
    this.multiplier = this.el.querySelector('.vh-mult')!;
    this.streak = this.el.querySelector('.vh-streak')!;
    this.progress = this.el.querySelector('.vh-progress i')!;
    this.countdown = this.el.querySelector('.vh-countdown')!;
    this.floats = this.el.querySelector('.vh-floats')!;
  }

  update(state: HudState) {
    this.score.textContent = String(state.score);
    this.multiplier.textContent = `x${state.multiplier}`;
    this.streak.textContent = String(state.streak);
    this.progress.style.width = `${(state.progress * 100).toFixed(1)}%`;
    this.countdown.textContent = state.countdown > 0 ? String(Math.ceil(state.countdown)) : '';
  }

  private float(text: string, kind: string, at: ScreenPoint) {
    const label = document.createElement('div');
    label.className = `vh-float vh-${kind}`;
    label.textContent = text;
    label.style.left = `${at.x}px`;
    label.style.top = `${at.y}px`;
    this.floats.append(label);
    setTimeout(() => label.remove(), 900);
  }

  timing(grade: Grade, _offset: number, at: ScreenPoint) {
    this.float(GRADE_TEXT[grade], grade, at);
  }
  error(kind: ErrorKind, at: ScreenPoint) {
    this.float(ERROR_TEXT[kind], 'error', at);
  }
  milestone() {}
  streakBroken() {}
  multiplierUp() {}
  multiplierLost() {}
  bestStreakBeaten() {}
  parranda() {}
  parrandaReady() {}
  meterZone() {}
  bellowsHint() {}
  banner() {}
  dispose() {
    this.el.remove();
  }
}

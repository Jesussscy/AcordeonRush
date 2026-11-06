import type { ErrorKind, Grade } from '../gameplay/judge';
import { STREAK_MILESTONES } from '../gameplay/scoring';
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
/** 7-segment patterns a b c d e f g. */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  ' ': '',
};
const MULT_COLORS = ['#fff4dc', '#fff4dc', '#2fbf4f', '#3d8bff', '#e0393e'];
const SCORE_DIGITS = 7;
const STREAK_DIGITS = 4;

const el = (tag: string, className = '', html = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

/** Original woven sombrero vueltiao (SVG) with a fill level clip. */
function hatSvg(index: number) {
  return `<svg viewBox="0 0 100 62" class="vh-hat-svg"><defs>
    <pattern id="vh-weave-${index}" width="10" height="6" patternUnits="userSpaceOnUse"><rect width="10" height="6" fill="#f1e3c4"/>
    <path d="M0 3 L2.5 0 L5 3 L7.5 0 L10 3 L10 6 L7.5 3 L5 6 L2.5 3 L0 6Z" fill="#1b120d"/></pattern>
    <clipPath id="vh-hat-clip-${index}"><rect class="vh-hat-level" x="0" y="62" width="100" height="62"/></clipPath></defs>
    <g opacity=".25"><ellipse cx="50" cy="48" rx="48" ry="12" fill="#f1e3c4"/><path d="M30 46 C30 18 36 8 50 8 C64 8 70 18 70 46Z" fill="#f1e3c4"/></g>
    <g clip-path="url(#vh-hat-clip-${index})"><ellipse cx="50" cy="48" rx="48" ry="12" fill="url(#vh-weave-${index})" stroke="#1b120d" stroke-width="1.5"/>
    <path d="M30 46 C30 18 36 8 50 8 C64 8 70 18 70 46Z" fill="url(#vh-weave-${index})" stroke="#1b120d" stroke-width="1.5"/>
    <path d="M31 38 C40 41 60 41 69 38 L69 44 C60 47 40 47 31 44Z" fill="#1b120d"/></g></svg>`;
}

/** Semicircle arc path for the Ambientómetro (0…1 along the dial). */
function arc(from: number, to: number, r: number) {
  const point = (t: number) => {
    const a = Math.PI * (1 - t);
    return `${100 + r * Math.cos(a)} ${100 - r * Math.sin(a)}`;
  };
  return `M ${point(from)} A ${r} ${r} 0 0 1 ${point(to)}`;
}

/** GH3-style HUD in DOM/SVG over the WebGL canvas. Only touches the DOM when values change. */
export class Hud implements HudApi {
  private readonly root: HTMLElement;
  private readonly scoreDigits: HTMLElement[] = [];
  private shownScore = 0;
  private scoreText = '';
  private readonly multCircle: HTMLElement;
  private readonly multText: HTMLElement;
  private readonly lights: HTMLElement[] = [];
  private lastLights = -1;
  private lastMultiplier = 0;
  private readonly streakWheels: HTMLElement[] = [];
  private readonly streakBox: HTMLElement;
  private readonly bestText: HTMLElement;
  private readonly lostText: HTMLElement;
  private lastStreak = -1;
  private lastBest = -1;
  private readonly needle: SVGElement;
  private needleAngle = -90;
  private needleVelocity = 0;
  private readonly meterBox: HTMLElement;
  private readonly hats: SVGRectElement[] = [];
  private readonly hatBox: HTMLElement;
  private lastHats = -1;
  private readonly progress: HTMLElement;
  private readonly countdown: HTMLElement;
  private lastCountdown = '';
  private readonly floats: HTMLElement;
  private readonly banners: HTMLElement;
  private readonly perfects: HTMLElement;
  private lastPerfects = -1;
  private readonly bellows: HTMLElement;
  private lastBellows = '';
  private readonly title: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly next: HTMLElement;
  private elapsed = 0;

  constructor(container: HTMLElement, info: { title: string; artist: string }) {
    this.root = el('div', 'vh-hud');
    container.append(this.root);

    // ── Top: progress + title.
    const top = el('div', 'vh-top');
    this.progress = el('i');
    const bar = el('div', 'vh-progress');
    bar.append(this.progress);
    this.title = el('div', 'vh-title');
    this.title.append(el('b', '', ''), el('span'));
    this.title.querySelector('b')!.textContent = info.title;
    this.title.querySelector('span')!.textContent = info.artist;
    this.perfects = el('div', 'vh-perfects');
    top.append(bar, this.title, this.perfects);

    // ── Left panel: score LED, multiplier + lights, streak odometer.
    const left = el('div', 'vh-panel vh-left');
    const led = el('div', 'vh-led');
    for (let i = 0; i < SCORE_DIGITS; i++) {
      const digit = el('div', 'vh-seg-digit');
      for (const s of 'abcdefg') digit.append(el('i', `s-${s}`));
      led.append(digit);
      this.scoreDigits.push(digit);
    }
    const multRow = el('div', 'vh-mult-row');
    const lightsBox = el('div', 'vh-lights');
    for (let i = 0; i < 10; i++) {
      const light = el('i');
      lightsBox.prepend(light);
      this.lights.push(light);
    }
    this.multCircle = el('div', 'vh-mult');
    this.multText = el('span', '', 'x1');
    this.multCircle.append(this.multText);
    multRow.append(lightsBox, this.multCircle);
    this.streakBox = el('div', 'vh-streak');
    const wheels = el('div', 'vh-odometer');
    wheels.append(el('span', 'vh-note-icon', '♪'));
    for (let i = 0; i < STREAK_DIGITS; i++) {
      const wheel = el('div', 'vh-wheel');
      const strip = el('div', 'vh-wheel-strip', [...'0123456789'].map((d) => `<b>${d}</b>`).join(''));
      wheel.append(strip);
      wheels.append(wheel);
      this.streakWheels.push(strip);
    }
    this.bestText = el('div', 'vh-best');
    this.lostText = el('div', 'vh-lost');
    this.streakBox.append(wheels, this.bestText, this.lostText);
    left.append(el('div', 'vh-label', 'PUNTAJE'), led, multRow, el('div', 'vh-label', 'RACHA'), this.streakBox);

    // ── Right panel: sombreros + Ambientómetro.
    const right = el('div', 'vh-panel vh-right');
    this.hatBox = el('div', 'vh-hats');
    for (let i = 0; i < 3; i++) {
      const hat = el('div', 'vh-hat', hatSvg(i));
      this.hatBox.append(hat);
      this.hats.push(hat.querySelector('.vh-hat-level') as SVGRectElement);
    }
    this.meterBox = el(
      'div',
      'vh-meter',
      `<svg viewBox="0 0 200 118">
        <path d="${arc(0, 0.33, 80)}" class="z-red"/><path d="${arc(0.33, 0.66, 80)}" class="z-yellow"/><path d="${arc(0.66, 1, 80)}" class="z-green"/>
        ${[0, 0.25, 0.5, 0.75, 1].map((t) => `<path d="${arc(t - 0.003, t + 0.003, 66)}" class="tick"/>`).join('')}
        <text x="176" y="14" class="parranda-text">¡PARRANDA!</text>
        <g class="needle"><path d="M100 100 L100 26" /><circle cx="100" cy="100" r="9"/></g>
      </svg><div class="vh-meter-name">AMBIENTÓMETRO</div>`,
    );
    this.needle = this.meterBox.querySelector('.needle') as SVGElement;
    right.append(this.hatBox, this.meterBox);

    // ── Centre layers.
    this.bellows = el('div', 'vh-bellows');
    this.countdown = el('div', 'vh-countdown');
    this.floats = el('div', 'vh-floats');
    this.banners = el('div', 'vh-banners');
    this.vignette = el('div', 'vh-vignette');
    this.next = el('div', 'vh-next');
    this.root.append(
      this.vignette,
      top,
      left,
      right,
      this.bellows,
      this.next,
      this.countdown,
      this.floats,
      this.banners,
    );
  }

  update(state: HudState, dt: number) {
    this.elapsed += dt;
    // Score: count up quickly so digits "roll".
    const diff = state.score - this.shownScore;
    if (diff !== 0) this.shownScore += diff > 0 ? Math.max(1, Math.ceil(diff * Math.min(1, dt * 12))) : diff;
    const text = String(Math.min(this.shownScore, 10 ** SCORE_DIGITS - 1)).padStart(SCORE_DIGITS, ' ');
    if (text !== this.scoreText) {
      [...text].forEach((ch, i) => {
        if (ch === this.scoreText[i]) return;
        const on = SEGMENTS[ch] ?? '';
        const digit = this.scoreDigits[i];
        for (const seg of digit.children) seg.classList.toggle('on', on.includes(seg.className.slice(2, 3)));
        digit.classList.toggle('blank', ch === ' ');
        digit.classList.remove('roll');
        void digit.offsetWidth;
        digit.classList.add('roll');
      });
      this.scoreText = text;
    }
    // Multiplier + lights.
    if (state.multiplier !== this.lastMultiplier) {
      const level = state.parranda ? 0 : Math.min(4, state.multiplier);
      this.multText.textContent = `x${state.multiplier}`;
      this.multCircle.style.setProperty('--mult', state.parranda ? '#f2c230' : MULT_COLORS[level]);
      this.multCircle.classList.toggle('gold', state.parranda);
      this.lastMultiplier = state.multiplier;
    }
    if (state.lights !== this.lastLights) {
      this.lights.forEach((light, i) => light.classList.toggle('on', i < state.lights));
      this.lastLights = state.lights;
    }
    // Streak odometer.
    if (state.streak !== this.lastStreak) {
      const digits = String(Math.min(state.streak, 10 ** STREAK_DIGITS - 1)).padStart(STREAK_DIGITS, '0');
      [...digits].forEach((d, i) => (this.streakWheels[i].style.transform = `translateY(${-Number(d) * 10}%)`));
      this.lastStreak = state.streak;
    }
    if (state.bestStreak !== this.lastBest) {
      this.bestText.textContent = `Mejor: ${state.bestStreak}`;
      this.lastBest = state.bestStreak;
    }
    // Ambientómetro needle: damped spring with a little overshoot.
    const target = -90 + state.meter * 180;
    this.needleVelocity += ((target - this.needleAngle) * 90 - this.needleVelocity * 11) * dt;
    this.needleAngle += this.needleVelocity * dt;
    this.needle.setAttribute('transform', `rotate(${this.needleAngle.toFixed(2)} 100 100)`);
    this.meterBox.dataset.zone = state.zone;
    // Sombreros.
    const hats = Math.round(state.hats * 100);
    if (hats !== this.lastHats) {
      this.hats.forEach((rect, i) => {
        const fill = Math.max(0, Math.min(1, state.hats - i));
        rect.setAttribute('y', String(62 - 62 * fill));
      });
      this.lastHats = hats;
    }
    this.hatBox.classList.toggle('ready', state.parrandaReady);
    this.hatBox.classList.toggle('active', state.parranda);
    this.root.classList.toggle('parranda', state.parranda);
    // Top.
    this.progress.style.width = `${(state.progress * 100).toFixed(2)}%`;
    this.title.classList.toggle('hidden', state.countdown < -4);
    const count = state.countdown > 0 ? String(Math.ceil(state.countdown)) : '';
    if (count !== this.lastCountdown) {
      this.countdown.textContent = count;
      this.lastCountdown = count;
    }
    if (state.perfectStreak !== this.lastPerfects) {
      this.perfects.textContent = state.perfectStreak >= 5 ? `Perfectos seguidos: ${state.perfectStreak}` : '';
      this.lastPerfects = state.perfectStreak;
    }
    if (state.bellows !== this.lastBellows) {
      this.bellows.dataset.direction = state.bellows;
      this.bellows.innerHTML = state.bellows === 'push' ? '<b>←</b> CERRANDO' : 'ABRIENDO <b>→</b>';
      this.lastBellows = state.bellows;
    }
  }

  private float(text: string, kind: string, at: ScreenPoint, big = false) {
    const label = el('div', `vh-float vh-${kind}${big ? ' big' : ''}`);
    label.textContent = text;
    label.style.left = `${at.x}px`;
    label.style.top = `${at.y}px`;
    this.floats.append(label);
    while (this.floats.childElementCount > 10) this.floats.firstElementChild?.remove();
    setTimeout(() => label.remove(), 950);
  }

  banner(text: string, kind: 'info' | 'fail' | 'gold' = 'info') {
    const banner = el('div', `vh-banner vh-banner-${kind}`);
    banner.textContent = text;
    this.banners.replaceChildren(banner);
    setTimeout(() => banner.remove(), kind === 'fail' ? 4000 : 2200);
  }

  private sparks(count = 26) {
    const box = el('div', 'vh-sparks');
    for (let i = 0; i < count; i++) {
      const s = el('i');
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 160;
      s.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
      s.style.animationDelay = `${Math.random() * 0.1}s`;
      box.append(s);
    }
    this.banners.append(box);
    setTimeout(() => box.remove(), 1200);
  }

  timing(grade: Grade, offset: number, at: ScreenPoint) {
    const hint = grade === 'perfect' ? '' : offset < 0 ? ' ‹' : ' ›';
    this.float(GRADE_TEXT[grade] + hint, grade, at, grade === 'perfect');
  }

  error(kind: ErrorKind, at: ScreenPoint) {
    this.float(ERROR_TEXT[kind], kind === 'ghost' ? 'ghost' : 'error', at, kind !== 'ghost');
    if (kind === 'ghost') return;
    this.vignette.classList.remove('flash');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('flash');
  }

  milestone(streak: number) {
    this.banner(`¡${streak} NOTAS SEGUIDAS!`, streak >= STREAK_MILESTONES[2] ? 'gold' : 'info');
    this.sparks(streak >= 100 ? 40 : 26);
    this.streakBox.classList.remove('milestone');
    void this.streakBox.offsetWidth;
    this.streakBox.classList.add('milestone');
  }

  streakBroken(streak: number) {
    if (streak < 5) return;
    this.lostText.textContent = `Racha perdida: ${streak}`;
    this.streakBox.classList.remove('jam');
    void this.streakBox.offsetWidth;
    this.streakBox.classList.add('jam');
    setTimeout(() => this.streakBox.classList.remove('jam'), 1600);
  }

  multiplierUp(multiplier: number) {
    this.multCircle.classList.remove('flash', 'drop');
    void this.multCircle.offsetWidth;
    this.multCircle.classList.add('flash');
    if (multiplier >= 4) this.lights.forEach((l) => l.classList.add('on'));
  }

  multiplierLost() {
    this.multCircle.classList.remove('flash', 'drop');
    void this.multCircle.offsetWidth;
    this.multCircle.classList.add('drop');
  }

  bestStreakBeaten() {
    this.streakBox.classList.add('record');
    this.banner('¡NUEVO RÉCORD DE RACHA!', 'gold');
  }

  parranda(active: boolean) {
    if (active) {
      this.banner('¡MODO PARRANDA!', 'gold');
      this.sparks(40);
    }
  }

  parrandaReady() {
    this.banner('¡Parranda lista! Enter o sacude el fuelle', 'gold');
  }

  meterZone(zone: 'red' | 'yellow' | 'green') {
    if (zone === 'green') this.float('¡PARRANDA!', 'good', { x: innerWidth - 150, y: innerHeight - 260 });
  }

  bellowsHint(direction: 'push' | 'pull') {
    const hint = el(
      'div',
      `vh-bellows-hint ${direction}`,
      direction === 'push' ? '←<small>CIERRA</small>' : '→<small>ABRE</small>',
    );
    this.floats.append(hint);
    setTimeout(() => hint.remove(), 700);
  }

  upcoming(items: { key: string; code: string; direction: 'push' | 'pull'; row: number }[]) {
    this.next.replaceChildren(
      ...items.map((item, i) => {
        const chip = el('div', `vh-next-chip row-${item.row} ${item.direction}${i === 0 ? ' first' : ''}`);
        const key = el('b');
        key.textContent = item.key;
        const sub = el('small');
        sub.textContent = `${item.code} ${item.direction === 'push' ? '← cierra' : '→ abre'}`;
        chip.append(key, sub);
        return chip;
      }),
    );
    if (items.length) this.next.prepend(el('span', 'vh-next-label', 'SIGUE'));
  }

  dispose() {
    this.root.remove();
  }
}

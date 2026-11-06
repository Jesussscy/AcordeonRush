import type { Bellows } from '../gameplay/chart';
import { codeToButtonMap, type Bindings } from './bindings';

export type InputHandlers = {
  press(buttonId: string, timeStamp: number): void;
  release(buttonId: string, timeStamp: number): void;
  bellows(direction: Bellows, timeStamp: number): void;
  parranda(): void;
  pause(): void;
};

/**
 * Keyboard input for a game session. Holding the bellows key = cerrar (push), releasing = abrir (pull).
 * Listens in the capture phase and ignores auto-repeat. Losing focus releases everything.
 */
export class GameInput {
  private readonly codes: Map<string, string>;
  private readonly held = new Set<string>();
  private bellowsDown = false;
  enabled = true;

  constructor(
    private readonly bindings: Bindings,
    private readonly handlers: InputHandlers,
  ) {
    this.codes = codeToButtonMap(bindings);
    window.addEventListener('keydown', this.down, true);
    window.addEventListener('keyup', this.up, true);
    window.addEventListener('blur', this.releaseAll);
  }

  private down = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const { actions } = this.bindings;
    if (e.code === actions.pause) {
      e.preventDefault();
      if (!e.repeat) this.handlers.pause();
      return;
    }
    if (!this.enabled) return;
    if (e.code === actions.bellows) {
      e.preventDefault();
      if (!e.repeat && !this.bellowsDown) {
        this.bellowsDown = true;
        this.handlers.bellows('push', e.timeStamp);
      }
      return;
    }
    if (e.code === actions.parranda) {
      e.preventDefault();
      if (!e.repeat) this.handlers.parranda();
      return;
    }
    const id = this.codes.get(e.code);
    if (!id) return;
    e.preventDefault();
    if (e.repeat || this.held.has(id)) return;
    this.held.add(id);
    this.handlers.press(id, e.timeStamp);
  };

  private up = (e: KeyboardEvent) => {
    if (e.code === this.bindings.actions.bellows) {
      if (this.bellowsDown) {
        this.bellowsDown = false;
        this.handlers.bellows('pull', e.timeStamp);
      }
      return;
    }
    const id = this.codes.get(e.code);
    if (id && this.held.delete(id)) this.handlers.release(id, e.timeStamp);
  };

  releaseAll = () => {
    const now = performance.now();
    for (const id of this.held) this.handlers.release(id, now);
    this.held.clear();
    if (this.bellowsDown) {
      this.bellowsDown = false;
      this.handlers.bellows('pull', now);
    }
  };

  get bellowsHeld() {
    return this.bellowsDown;
  }

  dispose() {
    window.removeEventListener('keydown', this.down, true);
    window.removeEventListener('keyup', this.up, true);
    window.removeEventListener('blur', this.releaseAll);
  }
}

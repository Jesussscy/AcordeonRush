import type { Bellows } from '../gameplay/chart';
import { melodyButtons } from '../instrument/accordion-catalog';

export const midiInputSupported = () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

type MidiHandlers = {
  /** A MIDI note became a button press: the button that sounds this pitch (current bellows first). */
  press(buttonId: string, timeStamp: number, direction: Bellows): void;
  release(buttonId: string, timeStamp: number): void;
};

/**
 * Optional Web MIDI controller support. MIDI keyboards have no bellows, so each incoming pitch is mapped to
 * the button that produces it (preferring the current bellows direction) and the bellows follows the note.
 */
export class MidiInput {
  private access?: MIDIAccess;
  private readonly active = new Map<number, string>();

  constructor(
    private readonly handlers: MidiHandlers,
    private readonly shift: () => number,
    private readonly bellows: () => Bellows,
  ) {}

  async connect() {
    if (!midiInputSupported()) return false;
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch {
      return false;
    }
    for (const input of this.access.inputs.values()) input.onmidimessage = this.onMessage;
    this.access.onstatechange = () => {
      for (const input of this.access!.inputs.values()) input.onmidimessage = this.onMessage;
    };
    return this.access.inputs.size > 0;
  }

  private onMessage = (event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 3) return;
    const type = data[0] & 0xf0;
    const pitch = data[1];
    const velocity = data[2];
    if (type === 0x90 && velocity > 0) {
      const preferred = this.bellows();
      const other: Bellows = preferred === 'push' ? 'pull' : 'push';
      for (const direction of [preferred, other]) {
        const button = melodyButtons.find((b) => b[direction][0] + this.shift() === pitch);
        if (button) {
          this.active.set(pitch, button.id);
          this.handlers.press(button.id, event.timeStamp, direction);
          return;
        }
      }
    } else if (type === 0x80 || (type === 0x90 && velocity === 0)) {
      const id = this.active.get(pitch);
      if (id) {
        this.active.delete(pitch);
        this.handlers.release(id, event.timeStamp);
      }
    }
  };

  dispose() {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) input.onmidimessage = null;
    this.access.onstatechange = null;
  }
}

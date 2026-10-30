declare module '*accordion-audio.js' {
  export type AccordionAudio = {
    context: AudioContext; unlock(): Promise<void>; preload(): Promise<void>;
    noteOn(name: string): void; noteOff(name: string): void;
    setBellows(direction: 'push' | 'pull', pressure: number): void;
    setProfile(id: string): void; setTuning(id: string): void;
    allNotesOff(): void; dispose(): void;
  };
  export function createAccordionAudio(options?: {baseURL?: URL; context?: AudioContext}): Promise<AccordionAudio>;
}

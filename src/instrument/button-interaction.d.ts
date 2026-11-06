import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type ButtonInteraction = {
  names: string[];
  press(name: string): void;
  release(name: string): void;
  releaseAll(): void;
  update(dt: number): void;
};

/** Drives the 43 BTN_* bones of an accordion GLB. Apply after AnimationMixer.update(). */
export function createButtonInteraction(gltf: GLTF): ButtonInteraction;

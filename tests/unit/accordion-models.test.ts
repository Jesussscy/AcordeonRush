import fs from 'node:fs';
import { AnimationMixer } from 'three';
import { describe, expect, it } from 'vitest';
import { allButtons, instrumentDesigns } from '../../src/instrument/accordion-catalog';
import { createButtonInteraction } from '../../src/instrument/button-interaction.js';
import { loadGlbWithoutTextures, readGlbJson } from '../helpers/load-glb';

// Migrated from tools/validate-practice.mjs (models), tools/blender/validate_button_interaction.mjs
// and tools/validate-studio.mjs (bones / manifest consistency).
const manifest = JSON.parse(fs.readFileSync('assets/audio/samples/hohner-hn/manifest.json', 'utf8'));
const assetPath = (url: string) => 'assets' + url.split('?')[0];

describe('accordion catalog vs audio manifest', () => {
  it('has 31 melody and 12 bass buttons whose notes match the sample manifest', () => {
    expect(allButtons.filter((b) => !b.bone.includes('Bass'))).toHaveLength(31);
    expect(allButtons.filter((b) => b.bone.includes('Bass'))).toHaveLength(12);
    for (const button of allButtons) {
      expect(manifest.buttons[button.bone].push, button.bone).toEqual(button.push);
      expect(manifest.buttons[button.bone].pull, button.bone).toEqual(button.pull);
    }
  });
});

describe.each(instrumentDesigns.map((d) => [d.id, d] as const))('model %s', (_id, design) => {
  it('exists with its preview and declares every catalog bone and the bellows clip', () => {
    expect(fs.existsSync(assetPath(design.image))).toBe(true);
    const doc = readGlbJson(assetPath(design.model));
    const names = new Set(doc.nodes.map((n: { name?: string }) => n.name));
    for (const button of allButtons) expect(names.has(button.bone), button.bone).toBe(true);
    expect(doc.animations.some((a: { name: string }) => a.name === 'Bellows_OpenClose')).toBe(true);
  });

  it('presses, holds and releases all 43 buttons while the bellows animates', async () => {
    const gltf = await loadGlbWithoutTextures(assetPath(design.model));
    const interaction = createButtonInteraction(gltf);
    expect(interaction.names).toHaveLength(43);
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations.find((c) => c.name === 'Bellows_OpenClose')!).play();
    const step = (frames: number) => {
      for (let i = 0; i < frames; i++) {
        mixer.update(1 / 60);
        interaction.update(1 / 60);
      }
    };
    for (const name of interaction.names) {
      const bone = gltf.scene.getObjectByName(name)!;
      const rest = bone.position.clone();
      interaction.press(name);
      step(30);
      expect(Math.abs(bone.position.distanceTo(rest) - 0.0018), `${name} travel`).toBeLessThan(1e-6);
      interaction.release(name);
      step(60);
      expect(bone.position.distanceTo(rest), `${name} release`).toBeLessThan(1e-7);
    }
  }, 60_000);
});

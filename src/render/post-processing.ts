import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Light bloom for bulbs, beams, sparks and gold gems (rendered at half resolution). */
export function createBloom(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const size = renderer.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    bloom,
    render(dt: number) {
      composer.render(dt);
    },
    setSize(width: number, height: number) {
      composer.setSize(width, height);
      bloom.setSize(width / 2, height / 2);
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
    },
  };
}

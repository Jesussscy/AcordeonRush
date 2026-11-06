import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { allButtons } from './accordion-catalog';
import { calibrateBellows, openingTime, type BellowsCurve } from './bellows-motion';
import { createButtonInteraction, type ButtonInteraction } from './button-interaction.js';

export type HighlightKind = 'press' | 'wrong' | 'hint' | 'target';
const HIGHLIGHT_COLORS: Record<HighlightKind, number> = {
  press: 0xfff1c2,
  wrong: 0xff2b2b,
  hint: 0x35ff6a,
  target: 0x6fb7ff,
};

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function disposeObject(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
        m.dispose();
      }
    }
  });
  textures.forEach((t) => t.dispose());
}

/**
 * The playable accordion as a scene object: bellows opening driven by measured case separation,
 * bone-driven button travel, and per-button glow highlights (the model is a single skinned mesh,
 * so buttons cannot be recoloured individually; glows are anchored to each button bone instead).
 */
export class AccordionRig {
  readonly root = new THREE.Group();
  private gltf?: GLTF;
  private mixer?: THREE.AnimationMixer;
  private action?: THREE.AnimationAction;
  private curve?: BellowsCurve;
  private buttons?: ButtonInteraction;
  private pressed = new Set<string>();
  private readonly glows = new Map<string, THREE.Sprite>();
  private readonly highlight = new Map<string, { kind: HighlightKind; until: number }>();
  private readonly glowMap = glowTexture();
  private readonly bones = new Map<string, THREE.Object3D>();
  opening = 0.25;
  ready = false;

  async load(url: string) {
    const gltf = await new GLTFLoader().loadAsync(url);
    this.gltf = gltf;
    this.root.add(gltf.scene);
    const curves = calibrateBellows(gltf);
    this.curve = curves.get('Bellows_OpenClose');
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    if (this.curve) {
      this.action = this.mixer.clipAction(this.curve.clip);
      this.action.play();
      this.action.paused = true;
    }
    this.buttons = createButtonInteraction(gltf);
    for (const key of allButtons) {
      const bone = gltf.scene.getObjectByName(key.bone);
      if (bone) this.bones.set(key.id, bone);
    }
    for (const key of allButtons) {
      if (key.bone.includes('Bass')) continue;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowMap,
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }),
      );
      sprite.scale.setScalar(0.03);
      sprite.visible = false;
      sprite.renderOrder = 10;
      this.root.add(sprite);
      this.glows.set(key.id, sprite);
    }
    this.ready = true;
  }

  /** Which button ids are held this frame. */
  setPressed(ids: Iterable<string>) {
    const wanted = new Set(ids);
    if (!this.buttons) return;
    for (const key of allButtons) {
      const isHeld = wanted.has(key.id);
      if (isHeld && !this.pressed.has(key.id)) this.buttons.press(key.bone);
      else if (!isHeld && this.pressed.has(key.id)) this.buttons.release(key.bone);
    }
    this.pressed = wanted;
  }

  /** Flash a glow on a button for `seconds`. */
  flash(id: string, kind: HighlightKind, seconds = 0.6, now = performance.now() / 1000) {
    this.highlight.set(id, { kind, until: now + seconds });
  }

  clearHighlights() {
    this.highlight.clear();
  }

  update(dt: number, now = performance.now() / 1000) {
    if (!this.ready || !this.gltf) return;
    if (this.action && this.mixer && this.curve) {
      this.action.time = openingTime(this.curve, this.opening);
      this.mixer.update(0);
    }
    this.buttons?.update(dt);
    this.root.updateMatrixWorld(true);
    const position = new THREE.Vector3();
    for (const key of allButtons) {
      const sprite = this.glows.get(key.id);
      if (!sprite) continue;
      const h = this.highlight.get(key.id);
      const show = h && h.until > now ? h.kind : this.pressed.has(key.id) ? 'press' : null;
      if (h && h.until <= now) this.highlight.delete(key.id);
      sprite.visible = Boolean(show);
      if (!show) continue;
      const bone = this.bones.get(key.id);
      if (!bone) continue;
      bone.getWorldPosition(position);
      this.root.worldToLocal(position);
      sprite.position.copy(position);
      (sprite.material as THREE.SpriteMaterial).color.setHex(HIGHLIGHT_COLORS[show]);
      const pulse = show === 'wrong' || show === 'hint' ? 1 + 0.25 * Math.sin(now * 18) : 1;
      sprite.scale.setScalar(0.034 * pulse);
    }
  }

  dispose() {
    if (this.gltf) {
      this.mixer?.stopAllAction();
      this.mixer?.uncacheRoot(this.gltf.scene);
    }
    disposeObject(this.root);
    this.glowMap.dispose();
  }
}

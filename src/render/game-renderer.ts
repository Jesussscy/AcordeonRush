import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AccordionRig } from '../instrument/accordion-rig';

export type Quality = 'high' | 'low';

/**
 * Owns the WebGL renderer. Pass 1 draws the stage + highway with the main camera; pass 2 draws the
 * player's accordion in a viewport at the bottom centre with its own camera and lighting.
 */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(56, 1, 0.1, 400);
  readonly accordionScene = new THREE.Scene();
  readonly accordionCamera = new THREE.PerspectiveCamera(24, 1, 0.01, 10);
  private readonly resizeObserver: ResizeObserver;
  private readonly env: THREE.WebGLRenderTarget;
  private width = 1;
  private height = 1;
  private shakeAmount = 0;
  private zoom = 0;
  /** Extra per-frame hooks (stage, effects). */
  readonly onBeforeRender: ((dt: number) => void)[] = [];
  /** Optional post-processing pass for the main scene (set by the stage, H4). */
  postProcess?: { render(dt: number): void; setSize(w: number, h: number): void; dispose?(): void };
  readonly basePosition = new THREE.Vector3(0, 3.35, 4.9);
  readonly lookAt = new THREE.Vector3(0, 0, -3.2);

  constructor(
    readonly container: HTMLElement,
    readonly quality: Quality = 'high',
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: quality === 'high', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.autoClear = false;
    this.renderer.domElement.className = 'vh-canvas';
    container.append(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0b0608);
    this.scene.fog = new THREE.Fog(0x0b0608, 38, 95);
    this.scene.add(new THREE.HemisphereLight(0xffe2b8, 0x20100a, 1.4));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
    key.position.set(2, 6, 4);
    this.scene.add(key);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.lookAt);

    // Accordion pass: studio-like lighting and framing.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.accordionScene.environment = this.env.texture;
    this.accordionScene.add(new THREE.AmbientLight(0xffffff, 0.4));
    this.accordionCamera.position.set(0.12, 0.16, 0.82);
    this.accordionCamera.lookAt(0.02, -0.005, 0);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  setAccordion(rig: AccordionRig) {
    this.accordionScene.add(rig.root);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.postProcess?.setSize(width, height);
  }

  /** Bottom-centre rectangle reserved for the player's accordion (CSS pixels). */
  get accordionViewport() {
    const h = Math.round(this.height * 0.26);
    const w = Math.round(Math.min(this.width * 0.4, h * 1.8));
    return { x: Math.round((this.width - w) / 2), y: 0, w, h };
  }

  /** Brief camera shake (errors). */
  shake(amount = 0.12) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** Parranda pulse zoom 0…1. */
  setZoom(amount: number) {
    this.zoom = amount;
  }

  /** Project a world point of the main scene to CSS pixels. */
  toScreen(point: THREE.Vector3) {
    const p = point.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  render(dt: number) {
    for (const hook of this.onBeforeRender) hook(dt);
    this.camera.position.copy(this.basePosition);
    this.camera.position.z -= this.zoom * 0.9;
    this.camera.position.y -= this.zoom * 0.2;
    if (this.shakeAmount > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= Math.exp(-dt * 14);
    }
    this.camera.lookAt(this.lookAt);
    const r = this.renderer;
    r.setViewport(0, 0, this.width, this.height);
    r.setScissorTest(false);
    r.clear();
    if (this.postProcess) this.postProcess.render(dt);
    else r.render(this.scene, this.camera);
    const v = this.accordionViewport;
    this.accordionCamera.aspect = v.w / v.h;
    this.accordionCamera.updateProjectionMatrix();
    r.setViewport(v.x, v.y, v.w, v.h);
    r.setScissor(v.x, v.y, v.w, v.h);
    r.setScissorTest(true);
    r.clearDepth();
    r.render(this.accordionScene, this.accordionCamera);
    r.setScissorTest(false);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.postProcess?.dispose?.();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

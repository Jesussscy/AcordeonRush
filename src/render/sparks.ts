import * as THREE from 'three';

const MAX = 900;

/** Additive particle pool for hit sparks / flames rising from the target rings. */
export class Sparks {
  readonly points: THREE.Points;
  private readonly positions = new Float32Array(MAX * 3);
  private readonly colors = new Float32Array(MAX * 3);
  private readonly velocity = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private readonly maxLife = new Float32Array(MAX);
  private readonly base = new Float32Array(MAX * 3);
  private next = 0;
  private readonly geometry = new THREE.BufferGeometry();

  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: sparkTexture(),
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.positions.fill(-9999);
  }

  /** Burst at a world position. `power` 1 (x1) … 2.5 (x4/Parranda). */
  burst(x: number, z: number, color: number, count = 18, power = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const angle = Math.random() * Math.PI * 2;
      const spread = (0.6 + Math.random() * 1.6) * power;
      this.positions.set([x + Math.cos(angle) * 0.35, 0.15, z + Math.sin(angle) * 0.2], i * 3);
      this.velocity.set(
        [Math.cos(angle) * spread * 0.6, (2.2 + Math.random() * 2.8) * power, Math.sin(angle) * spread * 0.3],
        i * 3,
      );
      this.base.set([c.r, c.g, c.b], i * 3);
      this.maxLife[i] = this.life[i] = 0.35 + Math.random() * 0.35 * power;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) {
        this.positions[j + 1] = -9999;
        continue;
      }
      this.velocity[j + 1] -= 6 * dt;
      this.positions[j] += this.velocity[j] * dt;
      this.positions[j + 1] += this.velocity[j + 1] * dt;
      this.positions[j + 2] += this.velocity[j + 2] * dt;
      const fade = this.life[i] / this.maxLife[i];
      this.colors[j] = this.base[j] * fade + fade * 0.4;
      this.colors[j + 1] = this.base[j + 1] * fade + fade * 0.25;
      this.colors[j + 2] = this.base[j + 2] * fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    const material = this.points.material as THREE.PointsMaterial;
    material.map?.dispose();
    material.dispose();
  }
}

function sparkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,220,140,0.8)');
  gradient.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

import * as THREE from 'three';
import type { StageHooks } from '../core/game-session';
import { accordionist, cajero, guacharaquero, vueltiaoTexture, type Musician } from './characters';

const BULB_COLORS = [0xff3b3b, 0xffc23a, 0x2fbf4f, 0x3d8bff, 0xff8a1f, 0xff5ad1];
const BEAM_COLORS = [0xff3b6b, 0x3d8bff, 0xffc23a, 0x2fe08a];

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    const shade = 34 + Math.random() * 14;
    g.fillStyle = `rgb(${shade + 22},${shade + 10},${shade})`;
    g.fillRect(i * 32, 0, 31, 512);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(i * 32 + 31, 0, 1, 512);
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1, 6 + Math.random() * 30);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Crowd silhouette sprite (two poses: arms down / arms up). */
function silhouetteTexture(armsUp: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(32, 22, 12, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(32, 11, 22, 4, 0, 0, Math.PI * 2); // hat brim
  g.fill();
  g.fillRect(18, 34, 28, 52);
  g.fillRect(20, 84, 10, 44);
  g.fillRect(34, 84, 10, 44);
  if (armsUp) {
    g.save();
    g.translate(20, 38);
    g.rotate(-2.6);
    g.fillRect(-4, 0, 8, 40);
    g.restore();
    g.save();
    g.translate(44, 38);
    g.rotate(2.6);
    g.fillRect(-4, 0, 8, 40);
    g.restore();
  } else {
    g.fillRect(10, 36, 8, 40);
    g.fillRect(46, 36, 8, 40);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Procedural caseta stage around the highway. Pure decoration driven by the game state. */
export class Stage implements StageHooks {
  readonly group = new THREE.Group();
  private readonly musicians: Musician[];
  private readonly beams: { mesh: THREE.Mesh; base: number; speed: number; phase: number }[] = [];
  private readonly lights: THREE.SpotLight[] = [];
  private readonly bulbs: THREE.InstancedMesh;
  private readonly bulbMaterial: THREE.MeshBasicMaterial;
  private readonly crowd: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[]; phase: number[] }[] = [];
  private readonly led: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  private readonly textures: THREE.Texture[] = [];
  private mood = 0;
  private moodTimer = 0;
  private flash = 0;
  private lastLedBeat = -1;
  private readonly bars = new Array(24).fill(0);

  constructor(
    scene: THREE.Scene,
    quality: 'high' | 'low',
  ) {
    scene.add(this.group);
    scene.fog = new THREE.Fog(0x0b0608, 70, 190);
    const hat = vueltiaoTexture();
    this.textures.push(hat);

    // Night sky with stars.
    const starGeometry = new THREE.BufferGeometry();
    const stars = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) stars.set([(Math.random() - 0.5) * 300, 25 + Math.random() * 80, -90 - Math.random() * 60], i * 3);
    starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.group.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xfff4dc, size: 0.4, fog: false })));

    // Tarima (wooden stage floor) under and around the highway.
    const wood = woodTexture();
    this.textures.push(wood);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 80),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7, color: 0x9a7a5c }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.06, -30);
    this.group.add(floor);
    const front = new THREE.Mesh(new THREE.BoxGeometry(44, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x3a2418 }));
    front.position.set(0, -0.66, 10);
    this.group.add(front);

    // LED screen on the back wall.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.led = { canvas, ctx, texture };
    this.textures.push(texture);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(20, 8.75), new THREE.MeshBasicMaterial({ map: texture, fog: false }));
    screen.position.set(0, 5.2, -54);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(21, 9.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    frame.position.set(0, 5.2, -54.4);
    this.group.add(frame, screen);

    // Stacked speakers.
    const cabinet = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    const cone = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.4, metalness: 0.4 });
    for (const side of [-1, 1])
      for (let level = 0; level < 3; level++)
        for (let col = 0; col < 2; col++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 1.6), cabinet);
          box.position.set(side * (13 + col * 2.5), 1.1 + level * 2.25, -44 + col * 0.3);
          const woofer = new THREE.Mesh(new THREE.CircleGeometry(0.8, 18), cone);
          woofer.position.z = 0.81;
          box.add(woofer);
          this.group.add(box);
        }

    // Truss with lamps, sweeping beams and real spotlights.
    const truss = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8 }));
    truss.position.set(0, 11.5, -36);
    this.group.add(truss);
    const beamCount = quality === 'high' ? 8 : 4;
    for (let i = 0; i < beamCount; i++) {
      const color = BEAM_COLORS[i % BEAM_COLORS.length];
      const x = -14 + (28 * i) / (beamCount - 1);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      lamp.position.set(x, 10.9, -36);
      this.group.add(lamp);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 22, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.09,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          fog: false,
        }),
      );
      beam.geometry.translate(0, -11, 0);
      beam.position.copy(lamp.position);
      this.group.add(beam);
      this.beams.push({ mesh: beam, base: x > 0 ? -0.35 : 0.35, speed: 0.6 + Math.random() * 0.6, phase: Math.random() * 6 });
      if (i % 2 === 0) {
        const spot = new THREE.SpotLight(color, 60, 60, 0.35, 0.5, 1.2);
        spot.position.copy(lamp.position);
        spot.target.position.set(x * 0.3, 0, -22);
        this.group.add(spot, spot.target);
        this.lights.push(spot);
      }
    }

    // Guirnaldas: catenary strings of coloured bulbs.
    const strings = [-12, -26, -40];
    const perString = 34;
    this.bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), this.bulbMaterial, strings.length * perString);
    const m = new THREE.Matrix4();
    let k = 0;
    for (const z of strings)
      for (let i = 0; i < perString; i++) {
        const t = i / (perString - 1);
        const x = -18 + 36 * t;
        const y = 8.2 - 2.2 * Math.sin(Math.PI * t);
        m.makeTranslation(x, y, z);
        this.bulbs.setMatrixAt(k, m);
        this.bulbs.setColorAt(k, new THREE.Color(BULB_COLORS[k % BULB_COLORS.length]));
        k++;
      }
    this.group.add(this.bulbs);

    // Musicians.
    const lead = accordionist(hat);
    lead.root.position.set(-4.6, 0, -22);
    lead.root.scale.setScalar(1.7);
    const caja = cajero(hat);
    caja.root.position.set(4.4, 0, -32);
    caja.root.scale.setScalar(1.7);
    caja.root.rotation.y = -0.35;
    const guacha = guacharaquero(hat);
    guacha.root.position.set(7.4, 0, -27);
    guacha.root.scale.setScalar(1.7);
    this.group.add(lead.root, caja.root, guacha.root);
    this.musicians = [lead, caja, guacha];

    // Crowd silhouettes at both sides of the highway (instanced billboards).
    const perSide = quality === 'high' ? 60 : 24;
    for (const armsUp of [false, true]) {
      const map = silhouetteTexture(armsUp);
      this.textures.push(map);
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1.1, 2.2),
        new THREE.MeshBasicMaterial({ map, color: 0x170d0a, transparent: true, alphaTest: 0.5 }),
        perSide,
      );
      const base: THREE.Matrix4[] = [];
      const phase: number[] = [];
      for (let i = 0; i < perSide; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (9 + Math.random() * 14);
        const z = 1 - Math.random() * 20;
        const s = 1.4 + Math.random() * 0.6;
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(x, s * 1.1 - 0.06, z),
          new THREE.Quaternion(),
          new THREE.Vector3(s, s, s),
        );
        base.push(matrix);
        phase.push(Math.random() * Math.PI * 2);
        mesh.setMatrixAt(i, matrix);
      }
      this.group.add(mesh);
      this.crowd.push({ mesh, base, phase });
    }
  }

  reaction(kind: 'cheer' | 'boo' | 'hit') {
    if (kind === 'hit') this.flash = Math.min(1, this.flash + 0.25);
    else {
      this.mood = kind === 'cheer' ? 1 : -1;
      this.moodTimer = 2.5;
    }
  }

  private drawLed(beat: number, meter: number, parranda: boolean) {
    const { ctx, canvas, texture } = this.led;
    const w = canvas.width;
    const h = canvas.height;
    const step = Math.floor(beat * 2);
    if (step === this.lastLedBeat) return;
    this.lastLedBeat = step;
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, w, h);
    // Woven vueltiao band.
    ctx.fillStyle = parranda ? '#3a2a00' : '#1a1012';
    for (let x = 0; x < w; x += 32) ctx.fillRect(x + ((step % 2) * 16), 0, 16, 18);
    for (let x = 0; x < w; x += 32) ctx.fillRect(x + (((step + 1) % 2) * 16), h - 18, 16, 18);
    // Equalizer bars.
    for (let i = 0; i < this.bars.length; i++) {
      this.bars[i] = Math.max(this.bars[i] * 0.55, Math.random() * (0.35 + meter * 0.65));
      const bh = this.bars[i] * (h - 70);
      const hue = parranda ? 45 : (i / this.bars.length) * 140;
      ctx.fillStyle = `hsl(${hue},90%,${parranda ? 55 : 50}%)`;
      ctx.fillRect(16 + i * 20, h - 22 - bh, 14, bh);
    }
    ctx.textAlign = 'center';
    ctx.font = '72px "Bebas Neue", Impact, sans-serif';
    ctx.fillStyle = parranda ? '#ffd45a' : '#fff4dc';
    ctx.shadowColor = parranda ? '#ff9a1f' : '#e0393e';
    ctx.shadowBlur = 18;
    ctx.fillText(parranda ? '¡PARRANDA!' : 'VALLENATO HERO', w / 2, 96);
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  }

  update(dt: number, info: { beat: number; beatPhase: number; meter: number; parranda: boolean; opening: number }) {
    const time = performance.now() / 1000;
    if (this.moodTimer > 0) this.moodTimer -= dt;
    else this.mood *= Math.exp(-dt * 2);
    this.flash *= Math.exp(-dt * 6);
    const energy = Math.max(0, Math.min(1.4, info.meter + (this.mood > 0 ? 0.5 : this.mood < 0 ? -0.4 : 0) + (info.parranda ? 0.4 : 0)));
    const pulse = 1 - info.beatPhase;
    for (const musician of this.musicians) musician.animate(info.beat, info.beatPhase, Math.min(1, energy), info.opening);
    // Sweeping beams + spotlights.
    const intensity = (info.parranda ? 1.8 : 1) * (0.6 + 0.4 * info.meter);
    this.beams.forEach((b, i) => {
      const swing = Math.sin(time * b.speed + b.phase) * 0.45;
      b.mesh.rotation.set(0.35 + 0.15 * Math.sin(time * 0.7 + i), 0, b.base + swing);
      const material = b.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = (0.05 + 0.06 * pulse + 0.05 * this.flash) * intensity;
      if (info.parranda) material.color.setHex(i % 2 ? 0xffc23a : 0xff8a1f);
      else material.color.setHex(BEAM_COLORS[i % BEAM_COLORS.length]);
    });
    this.lights.forEach((l, i) => {
      l.intensity = (40 + 40 * pulse + 60 * this.flash) * intensity;
      l.target.position.x = Math.sin(time * 0.8 + i * 2) * 8;
    });
    // Bulbs twinkle on the beat.
    this.bulbMaterial.color.setScalar(0.55 + 0.45 * pulse * (info.parranda ? 1.3 : 1));
    // Crowd: jumps with energy, sags when booing.
    for (const group of this.crowd) {
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const up = group === this.crowd[1];
      group.mesh.visible = up ? energy > 0.55 : true;
      group.base.forEach((base, i) => {
        base.decompose(p, q, s);
        const jump = Math.max(0, Math.sin(info.beat * Math.PI + group.phase[i])) * 0.5 * Math.max(0, energy - 0.3);
        const sag = this.mood < 0 ? -0.25 * -this.mood : 0;
        p.y += jump + sag;
        if (up && energy <= 0.55) s.setScalar(0.0001);
        m.compose(p, q, s);
        group.mesh.setMatrixAt(i, m);
      });
      group.mesh.instanceMatrix.needsUpdate = true;
      (group.mesh.material as THREE.MeshBasicMaterial).color.setHex(this.mood < -0.2 ? 0x2a0a0a : 0x170d0a);
    }
    this.drawLed(info.beat, info.meter, info.parranda);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.InstancedMesh) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((mat) => mat.dispose());
      }
    });
    this.textures.forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}

import * as THREE from 'three';
import type { Bellows } from '../chart';
import type { GameNote } from '../judge';

/** afuera = verde, medio = amarillo, adentro = rojo. */
export const LANE_COLORS = [0x2fbf4f, 0xf2c230, 0xe0393e];
export const LANE_CSS = ['#2fbf4f', '#f2c230', '#e0393e'];
/** azul ← cerrar (push), naranja → abrir (pull). */
export const BELLOWS_COLORS: Record<Bellows, number> = { push: 0x3d8bff, pull: 0xff8a1f };
export const BELLOWS_CSS: Record<Bellows, string> = { push: '#3d8bff', pull: '#ff8a1f' };
/** World units per second of song time. */
export const SPEED = 9;
export const LANE_X = [-1.3, 0, 1.3];
const STRIP_X = -2.45;
const VIEW_AHEAD = 62;
const GEM_Y = 0.1;

export type GemLabel = { code: string; key?: string; noteName?: string };

type Gem = {
  note: GameNote;
  group: THREE.Group;
  body: THREE.Mesh;
  label: THREE.Mesh;
  rim: THREE.Mesh;
  tail?: THREE.Mesh;
  state: 'pending' | 'hit' | 'missed';
  hitAt: number;
};

const labelCache = new Map<string, THREE.CanvasTexture>();

function labelTexture(label: GemLabel, direction: Bellows, gold: boolean, cracked: boolean) {
  const key = `${label.code}|${label.key ?? ''}|${label.noteName ?? ''}|${direction}|${gold}|${cracked}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  // Button cap.
  const face = g.createRadialGradient(c - 30, c - 40, 10, c, c, c);
  face.addColorStop(0, cracked ? '#9a9a9a' : gold ? '#fff6c8' : '#fffaf0');
  face.addColorStop(1, cracked ? '#5e5e5e' : gold ? '#e6b53c' : '#d9cdb4');
  g.fillStyle = face;
  g.beginPath();
  g.arc(c, c, c - 6, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = cracked ? '#444' : BELLOWS_CSS[direction];
  g.stroke();
  // Button id (big), key hint and note name.
  g.fillStyle = cracked ? '#2c2c2c' : '#1d140e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${label.code.length > 2 ? 78 : 92}px "Arial Black", system-ui, sans-serif`;
  g.fillText(label.code, c, c - 8);
  g.font = '800 46px system-ui, sans-serif';
  const sub = [label.key, label.noteName].filter(Boolean).join(' · ');
  if (sub) g.fillText(sub, c, c + 62);
  // Bellows arrow on top.
  g.fillStyle = cracked ? '#444' : BELLOWS_CSS[direction];
  g.font = '900 54px system-ui, sans-serif';
  g.fillText(direction === 'push' ? '←' : '→', c, c - 82);
  if (cracked) {
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(60, 40);
    g.lineTo(120, 120);
    g.lineTo(95, 165);
    g.lineTo(150, 230);
    g.moveTo(120, 120);
    g.lineTo(200, 100);
    g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  labelCache.set(key, texture);
  return texture;
}

function surfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#1b120d';
  g.fillRect(0, 0, 256, 512);
  // Leather grain.
  for (let i = 0; i < 2600; i++) {
    const v = 20 + Math.random() * 22;
    g.fillStyle = `rgba(${v + 18},${v + 8},${v},0.35)`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Very subtle sombrero vueltiao weave: alternating stepped diamonds.
  g.globalAlpha = 0.08;
  g.strokeStyle = '#f1e3c4';
  g.lineWidth = 6;
  for (let y = -32; y < 544; y += 64) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + ((x / 32) % 2 ? 24 : -8));
    g.stroke();
  }
  g.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1, 6);
  return texture;
}

export type HighwayOptions = {
  bpm: number;
  lengthBeats: number;
  beatsPerBar: number;
  bellowsChanges: { t: number; direction: Bellows }[];
  label(note: GameNote): GemLabel;
};

/** The note highway. Song-time objects live in `track`, which slides toward the camera. */
export class Highway {
  readonly group = new THREE.Group();
  private readonly track = new THREE.Group();
  private readonly gems: Gem[] = [];
  private readonly rings: THREE.Mesh[] = [];
  private readonly surface: THREE.Mesh;
  private readonly surfaceMap: THREE.CanvasTexture;
  private readonly bodyMaterials = LANE_COLORS.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: 0.25,
      }),
  );
  private readonly goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5c542,
    roughness: 0.25,
    metalness: 0.7,
    emissive: 0xffb300,
    emissiveIntensity: 0.6,
  });
  private readonly greyMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
  private readonly rimMaterials: Record<Bellows, THREE.MeshBasicMaterial> = {
    push: new THREE.MeshBasicMaterial({ color: BELLOWS_COLORS.push }),
    pull: new THREE.MeshBasicMaterial({ color: BELLOWS_COLORS.pull }),
  };
  private gold = false;
  private gemCursor = 0;

  constructor(
    notes: GameNote[],
    private readonly options: HighwayOptions,
  ) {
    const spb = 60 / options.bpm;
    const width = 4.2;
    // Surface (static, its texture scrolls).
    this.surfaceMap = surfaceTexture();
    this.surface = new THREE.Mesh(
      new THREE.PlaneGeometry(width, VIEW_AHEAD + 8),
      new THREE.MeshStandardMaterial({ map: this.surfaceMap, roughness: 0.8, color: 0xffffff }),
    );
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.position.set(0, 0, -(VIEW_AHEAD + 8) / 2 + 4);
    this.group.add(this.surface);
    // Side rails and lane dividers.
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0xb08a4e, metalness: 0.6, roughness: 0.4 });
    for (const x of [-width / 2, width / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, VIEW_AHEAD + 8), railMaterial);
      rail.position.set(x, 0.04, -(VIEW_AHEAD + 8) / 2 + 4);
      this.group.add(rail);
    }
    const dividerMaterial = new THREE.MeshBasicMaterial({ color: 0x6b5a45, transparent: true, opacity: 0.5 });
    for (const x of [-0.65, 0.65]) {
      const divider = new THREE.Mesh(new THREE.PlaneGeometry(0.03, VIEW_AHEAD + 8), dividerMaterial);
      divider.rotation.x = -Math.PI / 2;
      divider.position.set(x, 0.005, -(VIEW_AHEAD + 8) / 2 + 4);
      this.group.add(divider);
    }
    // Hit line and target rings.
    const hitLine = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.8 }),
    );
    hitLine.rotation.x = -Math.PI / 2;
    hitLine.position.y = 0.01;
    this.group.add(hitLine);
    LANE_X.forEach((x, lane) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.47, 0.07, 12, 40),
        new THREE.MeshStandardMaterial({
          color: LANE_COLORS[lane],
          emissive: LANE_COLORS[lane],
          emissiveIntensity: 0.2,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, 0);
      this.group.add(ring);
      this.rings.push(ring);
    });
    this.group.add(this.track);

    // Frets: thin line per beat, thicker per bar.
    const beatMaterial = new THREE.MeshBasicMaterial({ color: 0x8a7458, transparent: true, opacity: 0.45 });
    const barMaterial = new THREE.MeshBasicMaterial({ color: 0xe8cf9c, transparent: true, opacity: 0.8 });
    const beatGeometry = new THREE.PlaneGeometry(width, 0.04);
    const barGeometry = new THREE.PlaneGeometry(width, 0.11);
    for (let beat = 0; beat <= options.lengthBeats; beat++) {
      const bar = beat % options.beatsPerBar === 0;
      const fret = new THREE.Mesh(bar ? barGeometry : beatGeometry, bar ? barMaterial : beatMaterial);
      fret.rotation.x = -Math.PI / 2;
      fret.position.set(0, 0.008, -beat * spb * SPEED);
      this.track.add(fret);
    }

    // Bellows strip: coloured runs + arrows where the direction changes.
    const runs: { from: number; to: number; direction: Bellows }[] = [];
    let current: Bellows = 'pull';
    let from = 0;
    for (const change of options.bellowsChanges) {
      if (change.t > from) runs.push({ from, to: change.t, direction: current });
      current = change.direction;
      from = change.t;
    }
    runs.push({ from, to: options.lengthBeats, direction: current });
    for (const run of runs) {
      const length = (run.to - run.from) * spb * SPEED;
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, Math.max(0.01, length)),
        new THREE.MeshBasicMaterial({ color: BELLOWS_COLORS[run.direction], transparent: true, opacity: 0.55 }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(STRIP_X, 0.01, -run.from * spb * SPEED - length / 2);
      this.track.add(strip);
    }
    for (const change of options.bellowsChanges) {
      const arrow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.62),
        new THREE.MeshBasicMaterial({ map: arrowTexture(change.direction), transparent: true, depthWrite: false }),
      );
      arrow.rotation.x = -Math.PI / 2 + 0.35;
      arrow.position.set(STRIP_X, 0.06, -change.t * spb * SPEED);
      this.track.add(arrow);
    }

    // Gems.
    const bodyGeometry = new THREE.CylinderGeometry(0.42, 0.46, 0.18, 32);
    const labelGeometry = new THREE.CircleGeometry(0.4, 40);
    const rimGeometry = new THREE.TorusGeometry(0.44, 0.045, 8, 40);
    const tailGeometry = new THREE.BoxGeometry(0.16, 0.05, 1);
    for (const note of notes) {
      const group = new THREE.Group();
      group.position.set(LANE_X[note.row], GEM_Y, -note.start * SPEED);
      const body = new THREE.Mesh(bodyGeometry, note.parranda ? this.goldMaterial : this.bodyMaterials[note.row]);
      const label = new THREE.Mesh(
        labelGeometry,
        new THREE.MeshBasicMaterial({ map: labelTexture(options.label(note), note.direction, note.parranda, false) }),
      );
      label.rotation.x = -Math.PI / 2 + 0.55;
      label.position.y = 0.2;
      const rim = new THREE.Mesh(rimGeometry, this.rimMaterials[note.direction]);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.1;
      group.add(body, rim, label);
      const gem: Gem = { note, group, body, label, rim, state: 'pending', hitAt: 0 };
      if (note.sustained) {
        const length = (note.end - note.start) * SPEED;
        const tail = new THREE.Mesh(
          tailGeometry,
          new THREE.MeshStandardMaterial({
            color: note.parranda ? 0xf5c542 : LANE_COLORS[note.row],
            emissive: note.parranda ? 0xffb300 : LANE_COLORS[note.row],
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.85,
          }),
        );
        tail.scale.z = length;
        tail.position.set(0, -0.06, -length / 2);
        group.add(tail);
        gem.tail = tail;
      }
      this.track.add(group);
      this.gems.push(gem);
    }
  }

  /** Lane index of a note row, for HUD positioning. */
  laneWorldPosition(lane: number, target = new THREE.Vector3()) {
    return target.set(LANE_X[lane], 0.3, 0);
  }

  setGold(on: boolean) {
    this.gold = on;
    (this.surface.material as THREE.MeshStandardMaterial).color.setHex(on ? 0xffd27a : 0xffffff);
    (this.surface.material as THREE.MeshStandardMaterial).emissive.setHex(on ? 0x3a2600 : 0x000000);
  }

  markHit(note: GameNote, now: number) {
    const gem = this.gems[note.id];
    if (!gem) return;
    gem.state = 'hit';
    gem.hitAt = now;
    if (!note.sustained) gem.group.visible = false;
    else {
      gem.body.visible = false;
      gem.label.visible = false;
      gem.rim.visible = false;
    }
  }

  markMissed(note: GameNote) {
    const gem = this.gems[note.id];
    if (!gem || gem.state === 'hit') return;
    gem.state = 'missed';
    gem.body.material = this.greyMaterial;
    gem.rim.visible = false;
    (gem.label.material as THREE.MeshBasicMaterial).map = labelTexture(
      this.options.label(note),
      note.direction,
      false,
      true,
    );
    if (gem.tail) (gem.tail.material as THREE.MeshStandardMaterial).color.setHex(0x555555);
  }

  /** Practice loops: restore every gem. */
  reset() {
    for (const gem of this.gems) {
      gem.state = 'pending';
      gem.group.visible = true;
      gem.body.visible = gem.label.visible = gem.rim.visible = true;
      gem.body.material = gem.note.parranda ? this.goldMaterial : this.bodyMaterials[gem.note.row];
      (gem.label.material as THREE.MeshBasicMaterial).map = labelTexture(
        this.options.label(gem.note),
        gem.note.direction,
        gem.note.parranda,
        false,
      );
      if (gem.tail) {
        const material = gem.tail.material as THREE.MeshStandardMaterial;
        material.color.setHex(gem.note.parranda ? 0xf5c542 : LANE_COLORS[gem.note.row]);
        material.emissiveIntensity = 0.5;
        const length = (gem.note.end - gem.note.start) * SPEED;
        gem.tail.scale.set(1, 1, length);
        gem.tail.position.z = -length / 2;
      }
    }
    this.gemCursor = 0;
  }

  /** Sustain broken: dim the remaining tail. */
  markSustainBroken(note: GameNote) {
    const gem = this.gems[note.id];
    if (gem?.tail) {
      const material = gem.tail.material as THREE.MeshStandardMaterial;
      material.color.setHex(0x555555);
      material.emissiveIntensity = 0;
    }
  }

  update(now: number, heldLanes: Set<number>, beatPhase: number) {
    this.track.position.z = now * SPEED;
    this.surfaceMap.offset.y = -(now * SPEED) / ((VIEW_AHEAD + 8) / 6);
    const time = performance.now() / 1000;
    // Only touch gems near the visible window.
    while (this.gemCursor < this.gems.length && this.gems[this.gemCursor].note.end < now - 2) {
      this.gems[this.gemCursor].group.visible = false;
      this.gemCursor++;
    }
    for (let i = this.gemCursor; i < this.gems.length; i++) {
      const gem = this.gems[i];
      const ahead = (gem.note.start - now) * SPEED;
      if (ahead > VIEW_AHEAD) {
        gem.group.visible = false;
        break;
      }
      if (gem.state !== 'hit' || gem.note.sustained) gem.group.visible = true;
      if (gem.note.parranda && gem.state === 'pending')
        this.goldMaterial.emissiveIntensity = 0.45 + 0.35 * Math.sin(time * 8);
      if (gem.tail && gem.state === 'hit' && gem.note.holding) {
        // Vibrating sustained tail, trimmed at the hit line.
        const remaining = Math.max(0, (gem.note.end - now) * SPEED);
        gem.tail.scale.set(1 + 0.6 * Math.abs(Math.sin(time * 40)), 1, Math.max(0.001, remaining));
        gem.tail.position.z = -(now - gem.note.start) * SPEED - remaining / 2;
      }
    }
    this.rings.forEach((ring, lane) => {
      const held = heldLanes.has(lane);
      const material = ring.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = held ? 1.6 : 0.25 + 0.15 * (1 - beatPhase);
      ring.scale.setScalar(held ? 1.12 : 1);
    });
    if (this.gold)
      (this.surface.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.4 * (1 - beatPhase);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const material = o.material as THREE.Material & { map?: THREE.Texture };
        if (material.map && !labelCacheHas(material.map)) material.map.dispose();
        material.dispose();
      }
    });
  }
}

const arrowCache = new Map<Bellows, THREE.CanvasTexture>();
function arrowTexture(direction: Bellows) {
  const cached = arrowCache.get(direction);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = BELLOWS_CSS[direction];
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 74px system-ui, sans-serif';
  g.fillText(direction === 'push' ? '←' : '→', 64, 58);
  g.font = '800 20px system-ui, sans-serif';
  g.fillText(direction === 'push' ? 'CERRAR' : 'ABRIR', 64, 104);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  arrowCache.set(direction, texture);
  return texture;
}

function labelCacheHas(texture: THREE.Texture) {
  for (const t of labelCache.values()) if (t === texture) return true;
  for (const t of arrowCache.values()) if (t === texture) return true;
  return false;
}

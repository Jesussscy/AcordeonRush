import * as THREE from 'three';

/** Woven black/cream zig-zag bands of a sombrero vueltiao (original procedural texture). */
export function vueltiaoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#efe2c2';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#1b120d';
  for (let band = 0; band < 3; band++) {
    const y = 6 + band * 20;
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      g.lineTo(x, y + ((x / 16) % 2 ? 0 : 8));
    }
    for (let x = 256; x >= 0; x -= 16) g.lineTo(x, y + 6 + ((x / 16) % 2 ? 0 : 8));
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const flat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...extra });

export type Musician = {
  root: THREE.Group;
  /** Called every frame: beat (float), beat phase 0…1, energy 0…1, bellows opening 0…1. */
  animate(beat: number, phase: number, energy: number, opening: number): void;
};

type Body = {
  root: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  hips: THREE.Group;
};

/** Low-poly stylised performer: guayabera, dark trousers, optional sombrero vueltiao. */
function person(options: { shirt: number; pants: number; skin: number; hat: THREE.Texture | null; scarf?: number }): Body {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 1.0;
  root.add(hips);
  const legGeometry = new THREE.BoxGeometry(0.22, 1.0, 0.24);
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(legGeometry, flat(options.pants));
    leg.position.set(x, -0.5, 0);
    hips.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.36), flat(0x2a1a10));
    shoe.position.set(x, -0.98, 0.06);
    hips.add(shoe);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 7), flat(options.shirt));
  torso.position.y = 0.45;
  hips.add(torso);
  // Guayabera pleats.
  for (const x of [-0.12, 0.12]) {
    const pleat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.02), flat(0xd8ccb0));
    pleat.position.set(x, 0.45, 0.27);
    hips.add(pleat);
  }
  if (options.scarf) {
    const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 3), flat(options.scarf));
    scarf.rotation.x = Math.PI;
    scarf.position.set(0, 0.74, 0.22);
    hips.add(scarf);
  }
  const head = new THREE.Group();
  head.position.y = 1.08;
  hips.add(head);
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), flat(options.skin)));
  if (options.hat) {
    const material = new THREE.MeshStandardMaterial({ map: options.hat, roughness: 0.9, flatShading: true });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.03, 14), material);
    brim.position.y = 0.1;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.2, 10), material);
    crown.position.y = 0.21;
    head.add(brim, crown);
  }
  const makeArm = (side: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.36 * side, 0.8, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), flat(options.shirt));
    upper.position.y = -0.21;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.12), flat(options.skin));
    fore.position.y = -0.19;
    elbow.add(fore);
    shoulder.add(elbow);
    hips.add(shoulder);
    return { shoulder, elbow };
  };
  const left = makeArm(-1);
  const right = makeArm(1);
  return { root, torso, head, armL: left.shoulder, armR: right.shoulder, forearmL: left.elbow, forearmR: right.elbow, hips };
}

/** Accordionist in front: sombrero vueltiao, red scarf, bellows synced with the player's. */
export function accordionist(hat: THREE.Texture): Musician {
  const body = person({ shirt: 0xf3ead6, pants: 0x2b2522, skin: 0x8a5a3c, hat, scarf: 0xc0262b });
  const accordion = new THREE.Group();
  accordion.position.set(0, 0.5, 0.42);
  body.hips.add(accordion);
  const caseMaterial = flat(0xb3242e, { metalness: 0.3, roughness: 0.4 });
  const bassCase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.3), caseMaterial);
  const trebleCase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.3), caseMaterial);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.22), flat(0xd7d7d7, { metalness: 0.8, roughness: 0.3 }));
  grille.position.x = 0.07;
  trebleCase.add(grille);
  const bellows = new THREE.Mesh(new THREE.BoxGeometry(1, 0.38, 0.28), flat(0x1b1b1b));
  accordion.add(bassCase, trebleCase, bellows);
  body.armL.rotation.set(-0.9, 0, -0.25);
  body.armR.rotation.set(-0.9, 0, 0.25);
  body.forearmL.rotation.x = -0.8;
  body.forearmR.rotation.x = -0.8;
  return {
    root: body.root,
    animate(beat, phase, energy, opening) {
      const width = 0.12 + opening * 0.42;
      bellows.scale.x = width;
      bassCase.position.x = -width / 2 - 0.06;
      trebleCase.position.x = width / 2 + 0.06;
      body.armL.rotation.z = -0.25 - opening * 0.35;
      body.armR.rotation.z = 0.25 + opening * 0.35;
      const bounce = Math.abs(Math.sin(Math.PI * phase)) * (0.04 + 0.06 * energy);
      body.hips.position.y = 1.0 - bounce;
      body.head.rotation.z = Math.sin(beat * Math.PI) * 0.08 * (0.5 + energy);
      body.root.rotation.y = 0.35 + Math.sin(beat * Math.PI * 0.25) * 0.12;
    },
  };
}

/** Caja player behind: hits the drum on the pattern. */
export function cajero(hat: THREE.Texture): Musician {
  const body = person({ shirt: 0xe9d9b5, pants: 0x3a2c22, skin: 0x6e4630, hat });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.42, 12), flat(0x8a5a2b));
  const skin = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), flat(0xf1e3c4));
  skin.rotation.x = -Math.PI / 2;
  skin.position.y = 0.211;
  drum.add(skin);
  drum.rotation.x = 0.5;
  drum.position.set(0, 0.0, 0.42);
  body.hips.add(drum);
  body.armL.rotation.x = -0.6;
  body.armR.rotation.x = -0.6;
  return {
    root: body.root,
    animate(beat, phase, energy) {
      const half = (beat * 2) % 2;
      const hitL = Math.max(0, 1 - ((half + 2) % 2) * 3);
      const hitR = Math.max(0, 1 - ((half + 1) % 2) * 3);
      body.forearmL.rotation.x = -0.6 - 0.7 * hitL;
      body.forearmR.rotation.x = -0.6 - 0.7 * hitR;
      body.hips.position.y = 1.0 - Math.abs(Math.sin(Math.PI * phase)) * (0.03 + 0.05 * energy);
      body.head.rotation.x = 0.1 + 0.08 * Math.sin(beat * Math.PI * 2);
    },
  };
}

/** Guacharaca player: scraping the cane with the fork in eighths. */
export function guacharaquero(hat: THREE.Texture): Musician {
  const body = person({ shirt: 0xd9e3ea, pants: 0x262626, skin: 0x9a6a48, hat });
  const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), flat(0xc9a15b));
  cane.rotation.z = 1.1;
  cane.position.set(-0.15, 0.55, 0.38);
  body.hips.add(cane);
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), flat(0x999999, { metalness: 0.9 }));
  fork.position.y = -0.4;
  body.forearmR.add(fork);
  body.armL.rotation.set(-1.0, 0, -0.5);
  body.forearmL.rotation.x = -0.6;
  return {
    root: body.root,
    animate(beat, phase, energy) {
      const stroke = Math.sin(beat * Math.PI * 2);
      body.armR.rotation.set(-0.9 + 0.35 * stroke, 0, 0.4 + 0.25 * stroke);
      body.forearmR.rotation.x = -0.7 - 0.2 * stroke;
      body.hips.position.y = 1.0 - Math.abs(Math.sin(Math.PI * phase)) * (0.03 + 0.05 * energy);
      body.root.rotation.y = -0.4 + Math.sin(beat * Math.PI * 0.5) * 0.1;
    },
  };
}

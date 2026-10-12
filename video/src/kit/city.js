// Consistent modern city kit: glass towers, roads, street lamps, cars, trees.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng } from '../rng.js';
import { facadeTextures, canvasTexture, puffTexture } from './textures.js';

const FLOOR_H = 3.6;
const WIN_W = 3.0;

export function makeFacadeSet(seed, { lit = 0.45, glass = ['#4f6378', '#5c6f82', '#41566b', '#6a7b8b'], warm = '#ffd49a' } = {}) {
  return glass.map((g, i) => ({
    ...facadeTextures({ cols: 8, rows: 16, seed: seed * 31 + i, lit, glass: g, warm, frame: i % 2 ? '#2a3038' : '#323a44' }),
    cols: 8,
    rows: 16,
  }));
}

function facadeMat(set, faceW, h, lightLevel, env) {
  const map = set.map.clone();
  const em = set.emissive.clone();
  for (const t of [map, em]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(faceW / (set.cols * WIN_W), h / (set.rows * FLOOR_H));
    t.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    map,
    emissiveMap: em,
    emissive: 0xffffff,
    emissiveIntensity: lightLevel,
    roughness: 0.32,
    metalness: 0.35,
    envMapIntensity: env,
  });
}

/** A glass tower; returns { group, setLights(level) }. */
export function makeTower({ w, h, d, set, roof = 0x3a3f46, light = 1, env = 1, rng }) {
  const group = new THREE.Group();
  const roofMat = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8, metalness: 0.1 });
  const mats = [];
  const addBlock = (bw, bh, bd, y) => {
    const side = facadeMat(set, bd, bh, light, env);
    const front = facadeMat(set, bw, bh, light, env);
    mats.push(side, front);
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [side, side, roofMat, roofMat, front, front]);
    m.position.y = y + bh / 2;
    group.add(m);
    return m;
  };
  // Snap heights to whole floors so window rows line up with roof edges.
  const floors = Math.max(4, Math.round(h / FLOOR_H));
  const H = floors * FLOOR_H;
  if (rng && rng.chance(0.35) && floors > 14) {
    const lower = Math.round(floors * rng.range(0.55, 0.75)) * FLOOR_H;
    addBlock(w, lower, d, 0);
    addBlock(w * 0.72, H - lower, d * 0.72, lower);
  } else {
    addBlock(w, H, d, 0);
  }
  if (rng && rng.chance(0.6)) {
    const u = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 2.4, d * 0.3), roofMat);
    u.position.set(rng.range(-w * 0.2, w * 0.2), H + 1.2, rng.range(-d * 0.2, d * 0.2));
    group.add(u);
  }
  return {
    group,
    height: H,
    setLights(level) {
      for (const m of mats) m.emissiveIntensity = level;
    },
  };
}

/**
 * Scatter towers on a grid of blocks. `avoid(x, z)` returns true for cells to keep empty.
 * Returns { group, towers: [{ tower, x, z }] }.
 */
export function makeCity({ seed = 1, x0 = -400, x1 = 400, z0 = -800, z1 = -100, block = 46, street = 16, minH = 30, maxH = 140, set, light = 1, env = 1, avoid = () => false, density = 0.9, heightFn = null }) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const towers = [];
  const pitch = block + street;
  for (let x = x0; x < x1; x += pitch) {
    for (let z = z0; z < z1; z += pitch) {
      const cx = x + block / 2;
      const cz = z + block / 2;
      if (avoid(cx, cz) || rng.next() > density) continue;
      const n = rng.chance(0.4) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = n === 2 ? block * rng.range(0.38, 0.46) : block * rng.range(0.55, 0.9);
        const d = block * rng.range(0.55, 0.9);
        const ox = n === 2 ? (k ? 1 : -1) * block * 0.25 : rng.range(-3, 3);
        let h = heightFn ? heightFn(cx, cz, rng) : rng.range(minH, maxH) * (rng.chance(0.15) ? 1.5 : 1);
        const t = makeTower({ w, h, d, set: set[rng.int(0, set.length - 1)], light, env, rng });
        t.group.position.set(cx + ox, 0, cz + rng.range(-2, 2));
        group.add(t.group);
        towers.push({ tower: t, x: cx + ox, z: cz });
      }
    }
  }
  return { group, towers };
}

export function asphaltTexture(seed = 3) {
  const rng = makeRng(seed);
  return canvasTexture(512, 512, (g) => {
    g.fillStyle = '#3a3b3d';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2500; i++) {
      const v = 50 + rng.int(-12, 12);
      g.fillStyle = `rgb(${v},${v},${v + 2})`;
      g.fillRect(rng.range(0, 512), rng.range(0, 512), 2, 2);
    }
  });
}

/** Street lamp: pole, arm, glowing head and a soft light pool on the ground. */
export function makeStreetLamp({ height = 7, color = 0xffd7a0, intensity = 6, pool = true } = {}) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, height, 10), metal);
  pole.position.y = height / 2;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.4), metal);
  arm.position.set(0, height - 0.1, 0.65);
  g.add(arm);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.7), headMat);
  head.position.set(0, height - 0.18, 1.2);
  g.add(head);
  let poolMesh = null;
  if (pool) {
    poolMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({ map: puffTexture(), color: new THREE.Color(color).multiplyScalar(0.22), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(0, 0.03, 1.2);
    g.add(poolMesh);
  }
  return {
    group: g,
    headMat,
    poolMesh,
    setOn(level) {
      headMat.color.set(color).multiplyScalar(Math.max(0.03, intensity * level));
      if (poolMesh) poolMesh.material.color.set(color).multiplyScalar(0.22 * level);
    },
  };
}

const CAR_COLORS = [0xd8dadc, 0x1f2328, 0x8a1e22, 0x2e4a6e, 0x7d8288, 0xe9e5dc, 0x3c5a3e, 0x23272e, 0xb2b6ba];

/** Low-poly car facing +z. Returns { group, lights(level) }. */
export function makeCar(rng, { color } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: color ?? rng.pick(CAR_COLORS), roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2c3a48, roughness: 0.12, metalness: 0.7 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const len = rng.range(4.2, 4.8);
  const wid = 1.8;
  const body = new THREE.Mesh(new RoundedBoxGeometry(wid, 0.7, len, 2, 0.12), paint);
  body.position.y = 0.62;
  g.add(body);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(wid * 0.84, 0.5, len * 0.46, 2, 0.12), glass);
  cab.position.set(0, 1.15, -len * 0.06);
  g.add(cab);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(wid * 0.8, 0.08, len * 0.42, 2, 0.03), paint);
  roof.position.set(0, 1.42, -len * 0.06);
  g.add(roof);
  const wheelG = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelG, tire);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * (wid / 2 - 0.08), 0.34, sz * len * 0.32);
      g.add(w);
    }
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x2a0606 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0x2b2b28 });
  for (const sx of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.04), tailMat);
    tl.position.set(sx * 0.62, 0.78, -len / 2 - 0.01);
    g.add(tl);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.04), headMat);
    hl.position.set(sx * 0.62, 0.74, len / 2 + 0.01);
    g.add(hl);
  }
  return { group: g, length: len, paint };
}

export function makeTree(rng, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 1.8 * scale, 7), new THREE.MeshLambertMaterial({ color: 0x5a4330 }));
  trunk.position.y = 0.9 * scale;
  g.add(trunk);
  const leaf = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.27 + rng.range(-0.03, 0.03), 0.45, 0.26 + rng.range(-0.04, 0.04)) });
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * scale, 1), leaf);
  c.position.y = 2.6 * scale;
  c.scale.y = 1.1;
  g.add(c);
  return g;
}

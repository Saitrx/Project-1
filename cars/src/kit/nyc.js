// A low-poly New York avenue with cross streets, built once and shared by all street shots.
// Coordinates: the avenue runs along z (north = -z). Building faces at x = +-18.
//   sidewalks x in [12, 18] (top at y = 0.15), roadway x in [-12, 12]
//   parking lanes |x| in [9, 12]; travel lanes 3 m wide (centres +-1.5, +-4.5, +-7.5)
//   northbound (moving -z) on the east side (x > 0), southbound on the west side.
//   cross streets every 100 m at z = 100k, 18 m wide (z +- 9).
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { worldBox, Batch, boxAt, mat4 } from './geom.js';
import { facadeTex, glassTex, storefrontTex, sidewalkTex, roadTex, plainRoadTex, signTex, crownTex } from './nyctex.js';
import { puffTexture } from './textures.js';

export const AVE = { face: 18, curb: 12, park: 9 };
export const STREETS = [];
for (let k = 3; k >= -13; k--) STREETS.push(k * 100);
export const STREET_HALF = 9;
export const SIDEWALK_Y = 0.15;
const FLOOR = 3.2;
const GROUND = 4.4;

function lambert(opts) {
  return new THREE.MeshLambertMaterial(opts);
}

function tiled(tex, w, h) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return { tex: t, tile: { w, h } };
}

// Building style catalogue.
function styles() {
  const brickRed = facadeTex('brickRed', { cols: 2, rows: 4, wall: '#b4432f', glass: ['#334457', '#3d5266', '#2a3848', '#4a6178'], frame: '#efe4cc', lintel: '#e6d9bd', seed: 1, brick: true });
  const brickOrange = facadeTex('brickOrange', { cols: 2, rows: 4, wall: '#d25a3a', glass: ['#334457', '#46607a', '#2b394a'], frame: '#f1e6cf', seed: 2, brick: true });
  const stone = facadeTex('stone', { cols: 4, rows: 4, wall: '#eadba8', glass: ['#8fb2d2', '#5b7a9c', '#a9c7e2', '#4a6684'], winW: 0.5, winH: 0.58, seed: 3 });
  const beige = facadeTex('beige', { cols: 4, rows: 4, wall: '#d8c08e', glass: ['#7c9ab8', '#4f6b8a', '#99b6d2'], winW: 0.56, winH: 0.55, seed: 4 });
  const white = facadeTex('white', { cols: 4, rows: 4, wall: '#e9e6dd', glass: ['#6f8eae', '#4b6585', '#91afcc'], winW: 0.6, winH: 0.6, seed: 6 });
  const glassA = glassTex('glassA', { base: '#56c2c6' });
  const glassB = glassTex('glassB', { base: '#4f9fcf', mullion: '#cfe6f2', seed: 4 });
  const glassC = glassTex('glassC', { base: '#7ccfc4', mullion: '#e6f4ef', seed: 5 });
  const mk = (tex, tw, th, opts = {}) => {
    const t = tiled(tex, tw, th);
    return { mat: lambert({ map: t.tex, ...opts }), tile: t.tile };
  };
  return {
    brickRed: { facade: mk(brickRed, 6, 4 * FLOOR), floors: [5, 7], cornice: '#7d2f22', fireEscape: true, kind: 'walkup' },
    brickOrange: { facade: mk(brickOrange, 6, 4 * FLOOR), floors: [5, 8], cornice: '#8a3a26', fireEscape: true, kind: 'walkup' },
    stone: { facade: mk(stone, 12, 4 * FLOOR), floors: [8, 14], cornice: '#cdbd8a', kind: 'mid' },
    beige: { facade: mk(beige, 12, 4 * FLOOR), floors: [9, 16], cornice: '#bba370', kind: 'mid' },
    white: { facade: mk(white, 12, 4 * FLOOR), floors: [10, 18], cornice: '#d2cfc6', kind: 'mid' },
    glassA: { facade: mk(glassA, 9, 6 * FLOOR), floors: [22, 48], kind: 'tower' },
    glassB: { facade: mk(glassB, 9, 6 * FLOOR), floors: [24, 52], kind: 'tower' },
    glassC: { facade: mk(glassC, 9, 6 * FLOOR), floors: [18, 40], kind: 'tower' },
  };
}

const STORE_COLORS = [
  { frame: '#2f4a33', sign: '#c73b2c' },
  { frame: '#2b2f36', sign: '#2f6fb3' },
  { frame: '#5a2a24', sign: '#e0b23a' },
  { frame: '#36302a', sign: '#3c8a4f' },
  { frame: '#1f3b4f', sign: '#d84a3a' },
];
const AWNING_COLORS = [0x2f7d3e, 0xb8352a, 0x2b5c8f, 0x2f7d3e, 0x7a2f2a];

export function buildCity(opts = {}) {
  const rng = makeRng(opts.seed ?? 77);
  const root = new THREE.Group();
  const S = styles();
  const roofMat = lambert({ color: 0x77736c });
  const interiorMat = lambert({ color: 0x5f5a54 });
  const blackMat = lambert({ color: 0x202224 });
  const greenMetal = lambert({ color: 0x2f5a3c });
  const storeMats = STORE_COLORS.map((c, i) => {
    const t = tiled(storefrontTex('store' + i, { ...c, seed: i }), 6, GROUND);
    return { mat: lambert({ map: t.tex }), tile: t.tile };
  });
  const corniceMats = new Map();
  const corniceMat = (hex) => {
    if (!corniceMats.has(hex)) corniceMats.set(hex, lambert({ color: hex }));
    return corniceMats.get(hex);
  };

  const buildings = [];
  const hero = { awnings: [], panes: [], signs: [], lamps: [], trees: [], hydrants: [], signals: [] };

  // ---- one building ---------------------------------------------------------------------------
  // fx: facade x (the avenue-facing side), sideSign: +1 for east (extends to +x), -1 for west.
  function building({ x0, x1, z0, z1, style, floors, store = true, heroTag = null, uvOrigin = null }) {
    const st = S[style];
    const batch = new Batch();
    const top = (st.kind === 'tower' ? 0 : GROUND) + floors * FLOOR;
    const origin = uvOrigin ?? [x0, 0, z0];
    if (st.kind !== 'tower' && store) {
      const sm = storeMats[Math.floor(rng.next() * storeMats.length)];
      batch.add(worldBox([x0, 0, z0], [x1, GROUND, z1], { uvOrigin: origin, tile: sm.tile }), [sm.mat, roofMat, roofMat]);
      batch.add(worldBox([x0, GROUND, z0], [x1, top, z1], { uvOrigin: [origin[0], GROUND, origin[2]], tile: st.facade.tile }), [st.facade.mat, roofMat, roofMat]);
    } else {
      batch.add(worldBox([x0, 0, z0], [x1, top, z1], { uvOrigin: origin, tile: st.facade.tile }), [st.facade.mat, roofMat, roofMat]);
    }
    if (st.cornice) {
      const m = corniceMat(st.cornice);
      batch.add(boxAt((x0 + x1) / 2, top + 0.35, (z0 + z1) / 2, x1 - x0 + 0.7, 0.7, z1 - z0 + 0.7), m);
      // Belt course above the shops.
      if (store) batch.add(boxAt((x0 + x1) / 2, GROUND + 0.1, (z0 + z1) / 2, x1 - x0 + 0.3, 0.35, z1 - z0 + 0.3), m);
    }
    if (st.kind === 'tower') {
      // Setback crown on tall towers.
      const inset = Math.min(x1 - x0, z1 - z0) * 0.18;
      const h2 = rng.range(6, 18);
      batch.add(worldBox([x0 + inset, top, z0 + inset], [x1 - inset, top + h2, z1 - inset], { uvOrigin: [x0, top, z0], tile: st.facade.tile }), [st.facade.mat, roofMat, roofMat]);
    }
    const group = batch.build();
    const b = { x0, x1, z0, z1, top, style, group, extras: [] };
    root.add(group);
    buildings.push(b);
    return b;
  }

  // Fire escape on a facade plane at x = fx facing -x*side (towards the avenue).
  function fireEscape(batch, fx, side, zc, floorsFrom, floorsTo) {
    const out = -side;
    const w = 4.2;
    for (let f = floorsFrom; f <= floorsTo; f++) {
      const y = GROUND + (f - 1) * FLOOR + 0.05;
      const xp = fx + out * 0.55;
      batch.add(boxAt(xp, y, zc, 1.1, 0.06, w), blackMat);
      batch.add(boxAt(fx + out * 1.08, y + 0.9, zc, 0.05, 0.05, w), blackMat);
      for (let i = 0; i <= 6; i++) batch.add(boxAt(fx + out * 1.08, y + 0.45, zc - w / 2 + (i * w) / 6, 0.04, 0.9, 0.04), blackMat);
      for (const zz of [zc - w / 2, zc + w / 2]) batch.add(boxAt(fx + out * 0.55, y + 0.9, zz, 1.1, 0.05, 0.05), blackMat);
      if (f < floorsTo) {
        // Diagonal stair to the next platform.
        const g = new THREE.BoxGeometry(0.6, 0.06, 3.9);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(fx + out * 0.55, y + FLOOR / 2, zc),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan2(FLOOR, 3.2) * (f % 2 ? 1 : -1)),
          new THREE.Vector3(1, 1, 1)
        );
        batch.add(g, blackMat, m);
      }
    }
  }

  // ---- avenue frontage, both sides -----------------------------------------------------------
  const heroRange = opts.heroRange ?? [-40, 170];
  for (let si = 0; si < STREETS.length - 1; si++) {
    const zs = STREETS[si + 1] + STREET_HALF; // north end of block (smaller z)
    const ze = STREETS[si] - STREET_HALF; // south end
    const far = Math.min(Math.abs(zs), Math.abs(ze)) > 420;
    for (const side of [1, -1]) {
      let z = zs;
      const isHero = ze > heroRange[0] && zs < heroRange[1];
      while (z < ze - 4) {
        let w = rng.range(10, 22);
        if (ze - (z + w) < 8) w = ze - z;
        // Reserved lots (built by the shots): skip over them.
        const res = (opts.reserved ?? []).find((r) => r.side === side && z < r.z1 && z + w > r.z0);
        if (res) {
          if (z < res.z0 - 4) w = res.z0 - z;
          else {
            z = res.z1;
            continue;
          }
        }
        const zA = z;
        const zB = z + w;
        const depth = rng.range(22, 29);
        const fx = side * AVE.face;
        const x0 = side > 0 ? fx : fx - depth;
        const x1 = side > 0 ? fx + depth : fx;
        const nearHero = Math.abs((zA + zB) / 2) < 450;
        let style;
        const r = rng.next();
        if (nearHero) style = r < 0.36 ? 'brickRed' : r < 0.52 ? 'brickOrange' : r < 0.74 ? 'stone' : r < 0.88 ? 'beige' : 'white';
        else style = r < 0.2 ? 'brickRed' : r < 0.4 ? 'stone' : r < 0.55 ? 'beige' : r < 0.7 ? 'white' : r < 0.85 ? 'glassA' : 'glassB';
        const st = S[style];
        let floors = rng.int(st.floors[0], st.floors[1]);
        if (far && st.kind !== 'tower') floors += rng.int(2, 8);
        const b = building({ x0, x1, z0: zA, z1: zB, style, floors });
        b.side = side;
        b.hero = isHero;
        // Street-level dressing on the avenue face (near blocks only).
        if (!far) {
          const extra = new Batch();
          if (st.fireEscape && w > 9) fireEscape(extra, fx, side, (zA + zB) / 2, 2, Math.min(floors, 6));
          if (st.kind !== 'tower') {
            // Awning over the shop and a hanging sign.
            const ac = AWNING_COLORS[Math.floor(rng.next() * AWNING_COLORS.length)];
            const aw = Math.min(w - 2, rng.range(6, 10));
            const az = zA + 1 + rng.range(0, Math.max(0.1, w - 2 - aw));
            if (isHero) {
              hero.awnings.push({ side, fx, z0: az, z1: az + aw, color: ac, b });
            } else {
              const g = new THREE.BoxGeometry(1.7, 0.12, aw);
              const m = new THREE.Matrix4().compose(
                new THREE.Vector3(fx - side * 0.8, 3.35, az + aw / 2),
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), side * 0.32),
                new THREE.Vector3(1, 1, 1)
              );
              extra.add(g, lambert({ color: ac }), m);
            }
            if (rng.chance(0.55)) {
              const sz = zA + rng.range(1, w - 1);
              const sm = lambert({ map: signTex('s' + (Math.floor(rng.next() * 3)), { bg: ['#d63a2c', '#2f6fb3', '#e0a02a'][Math.floor(rng.next() * 3)] }) });
              if (isHero) hero.signs.push({ side, fx, z: sz, mat: sm, b });
              else {
                extra.add(boxAt(fx - side * 0.75, 5.6, sz, 1.2, 0.08, 0.08), blackMat);
                extra.add(boxAt(fx - side * 1.0, 5.0, sz, 0.08, 1.0, 1.1), sm);
              }
            }
          }
          const eg = extra.build();
          root.add(eg);
          b.extras.push(eg);
        }
        // Tower behind the frontage on some lots (skyline when looking up). Next to the detailed
        // cross streets the towers sit behind the cross-street buildings instead.
        const nearCross = [0, 100, 200].some((zc) => Math.abs((zA + zB) / 2 - zc) < 95);
        if (rng.chance(nearHero ? 0.45 : 0.6)) {
          const ts = rng.pick(['glassA', 'glassB', 'glassC', 'white', 'beige']);
          const tf = rng.int(S[ts].floors[0], S[ts].floors[1]);
          const d2 = rng.range(18, 30);
          const gap = nearCross ? rng.range(205, 230) - (side > 0 ? x1 : -x0) : rng.range(4, 14);
          const tx0 = side > 0 ? x1 + gap : x0 - gap - d2;
          const tb = building({ x0: tx0, x1: tx0 + d2, z0: zA, z1: Math.min(ze, zA + rng.range(16, 28)), style: ts, floors: tf, store: false });
          tb.side = side;
          tb.back = true;
        }
        z = zB;
      }
    }
  }

  // ---- cross-street frontage near the hero intersections ---------------------------------------
  for (const zc of [0, 100, 200]) {
    for (const side of [1, -1]) {
      for (const ns of [-1, 1]) {
        let x = AVE.face + 32;
        while (x < 190) {
          const w = rng.range(14, 26);
          const style = rng.pick(['brickRed', 'brickOrange', 'stone', 'beige', 'white', 'glassA']);
          const floors = rng.int(S[style].floors[0], S[style].floors[1]);
          const zf = zc + ns * STREET_HALF;
          const depth = rng.range(20, 34);
          const za = ns > 0 ? zf : zf - depth;
          const xa = side > 0 ? x : -x - w;
          const b = building({ x0: xa, x1: xa + w, z0: za, z1: za + depth, style, floors, uvOrigin: [xa, 0, za] });
          b.side = side;
          b.cross = zc;
          x += w + rng.range(0, 2);
        }
      }
    }
  }

  // ---- ground: roadway, sidewalks, cross streets, crosswalks -------------------------------------
  const ground = new THREE.Group();
  root.add(ground);
  const road = tiled(roadTex(), 24, 12);
  const roadMat = lambert({ map: road.tex });
  const plain = tiled(plainRoadTex(), 12, 12);
  const plainMat = lambert({ map: plain.tex });
  const side = tiled(sidewalkTex(), 3, 3);
  const sideMat = lambert({ map: side.tex });
  const curbMat = lambert({ color: 0xb9b8b2 });
  const zMin = STREETS[STREETS.length - 1] - 200;
  const zMax = STREETS[0] + 200;
  {
    const g = new THREE.PlaneGeometry(24, zMax - zMin);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 12) / 24, -(pos.getZ(i) + (zMax + zMin) / 2) / 12);
    const m = new THREE.Mesh(g, roadMat);
    m.position.set(0, 0, (zMax + zMin) / 2);
    m.receiveShadow = true;
    ground.add(m);
  }
  // Intersections: plain asphalt patches over the lane markings + crosswalks.
  const whiteMat = lambert({ color: 0xeceae2 });
  const xwalk = new Batch();
  for (const zc of STREETS) {
    xwalk.add(boxAt(0, 0.005, zc, 24, 0.01, 2 * STREET_HALF), plainMat);
    for (const zz of [zc - STREET_HALF - 1.8, zc + STREET_HALF + 1.8]) {
      for (let x = -11; x <= 11; x += 1.3) xwalk.add(boxAt(x, 0.012, zz, 0.62, 0.01, 3.0), whiteMat);
    }
    for (const sx of [1, -1]) {
      for (let z = zc - 5.4; z <= zc + 5.4; z += 1.3) xwalk.add(boxAt(sx * (AVE.face - 3.2), 0.012, z, 3.0, 0.01, 0.62), whiteMat);
      // Cross-street sidewalks (3 m) with curbs, from the avenue curb outward.
      for (const sz of [-1, 1]) {
        const z0 = sz < 0 ? zc - STREET_HALF : zc + 6;
        const x0 = sx > 0 ? AVE.curb + 0 : -AVE.face - 400;
        const x1 = sx > 0 ? AVE.face + 400 : -AVE.curb;
        if (sx > 0) xwalk.add(worldBox([AVE.face - 0.5, -0.2, z0], [x1, SIDEWALK_Y, z0 + 3], { tile: side.tile }), [curbMat, sideMat, sideMat]);
        else xwalk.add(worldBox([x0, -0.2, z0], [-AVE.face + 0.5, SIDEWALK_Y, z0 + 3], { tile: side.tile }), [curbMat, sideMat, sideMat]);
      }
    }
    // Cross street asphalt both sides.
    for (const sx of [1, -1]) xwalk.add(boxAt(sx * 210, -0.004, zc, 400, 0.01, 2 * STREET_HALF), plainMat);
  }
  // Sidewalks as raised slabs, broken at cross streets. Cross-street sidewalks too.
  for (let i = 0; i < STREETS.length - 1; i++) {
    const za = STREETS[i + 1] + STREET_HALF;
    const zb = STREETS[i] - STREET_HALF;
    for (const sx of [1, -1]) {
      const x0 = sx > 0 ? AVE.curb : -AVE.face - 400;
      const x1 = sx > 0 ? AVE.face + 400 : -AVE.curb;
      xwalk.add(worldBox([x0, -0.2, za], [x1, SIDEWALK_Y, zb], { tile: side.tile }), [curbMat, sideMat, sideMat]);
    }
  }
  const gm = xwalk.build({ castShadow: false });
  ground.add(gm);

  // ---- distant skyline + spire ---------------------------------------------------------------------
  const spire = new THREE.Group();
  {
    const st = S.white;
    const b = new Batch();
    const sx = -34;
    const sz = -1720;
    const crown = tiled(crownTex(), 12, 14);
    const crownMat = lambert({ map: crown.tex, color: 0xffffff });
    const steel = lambert({ color: 0xd8dde3 });
    b.add(worldBox([sx - 22, 0, sz - 22], [sx + 22, 190, sz + 22], { tile: st.facade.tile }), [st.facade.mat, roofMat, roofMat]);
    b.add(worldBox([sx - 16, 190, sz - 16], [sx + 16, 230, sz + 16], { tile: st.facade.tile }), [st.facade.mat, roofMat, roofMat]);
    // Stacked crown tiers.
    let y = 230;
    for (let i = 0; i < 6; i++) {
      const r = 14 - i * 2.2;
      const g = new THREE.CylinderGeometry(r * 0.8, r, 13, 4, 1);
      g.rotateY(Math.PI / 4);
      g.translate(sx, y + 6.5, sz);
      b.add(g, i % 2 ? steel : crownMat);
      y += 12;
    }
    b.add(new THREE.CylinderGeometry(0.4, 1.6, 60, 6).translate(sx, y + 30, sz), steel);
    spire.add(b.build({ castShadow: false }));
    root.add(spire);
  }

  return { root, buildings, hero, ground, materials: { roadMat, sideMat, blackMat, greenMetal, interiorMat, roofMat, whiteMat, lambert } };
}

// ---- street furniture (separate objects so shots can hide/move/break them) -------------------------
const FURN = {};
function furnMat(key, color) {
  if (!FURN[key]) FURN[key] = new THREE.MeshLambertMaterial({ color });
  return FURN[key];
}

export function makeTree(rng, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 6), furnMat('trunk', 0x5d4632));
  trunk.position.y = 1.3;
  g.add(trunk);
  const leaf = furnMat('leaf' + (rng.int(0, 2)), [0x3f9b3a, 0x4aa844, 0x368c35][rng.int(0, 2)]);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(0.9, 1.25) * scale, 0), leaf);
    c.position.set(rng.range(-0.4, 0.4), 3.0 + rng.range(0, 0.9) + i * 0.3, rng.range(-0.4, 0.4));
    c.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
    g.add(c);
  }
  // Tree pit.
  const pit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 1.2), furnMat('pit', 0x4b3d30));
  pit.position.y = 0.16;
  g.add(pit);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function makeHydrant() {
  const g = new THREE.Group();
  const red = furnMat('hydrant', 0xd8352a);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.62, 8), red);
  body.position.y = 0.31;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.14, 8), red);
  cap.position.y = 0.68;
  const nub = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.1), red);
  nub.position.y = 0.45;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 8), red);
  base.position.y = 0.035;
  g.add(body, cap, nub, base);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

// Cobra-head street light. Arm extends toward local -x (point the group's -x at the road).
export function makeLamp() {
  const g = new THREE.Group();
  const m = furnMat('lamp', 0x3b4a44);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 8, 8), m);
  pole.position.y = 4;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), m);
  arm.position.set(-1.15, 7.9, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 0.34), m);
  head.position.set(-2.35, 7.8, 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.6, 8), m);
  base.position.y = 0.3;
  g.add(pole, arm, head, base);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export function makeTrashCan() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.85, 8), furnMat('trash', 0x2f5a3c));
  c.position.y = 0.43;
  g.add(c);
  c.castShadow = true;
  return g;
}

// Hot-dog cart: white box on wheels with a striped umbrella.
export function makeHotDogCart() {
  const g = new THREE.Group();
  const white = furnMat('cartW', 0xf2f1ec);
  const steel = furnMat('cartS', 0xa9adb2);
  const red = furnMat('cartR', 0xd23a2c);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.95, 0.9), white);
  box.position.y = 0.85;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.06, 0.96), steel);
  top.position.y = 1.36;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.22, 0.92), red);
  band.position.y = 0.62;
  g.add(box, top, band);
  for (const sx of [-0.62, 0.62]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), furnMat('tire', 0x1d1d1d));
    w.rotation.x = Math.PI / 2;
    w.position.set(sx, 0.3, 0.48);
    g.add(w);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), steel);
  pole.position.y = 2.0;
  g.add(pole);
  const cols = [0xf2c419, 0x2b62c4, 0xd23a2c, 0xf2c419, 0x2b62c4, 0xd23a2c, 0xf2c419, 0x2b62c4];
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.45, 8, 1, true, (i * Math.PI) / 4, Math.PI / 4), furnMat('umb' + i, cols[i]));
    seg.material.side = THREE.DoubleSide;
    seg.position.y = 2.75;
    g.add(seg);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export function makeManhole() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), furnMat('manhole', 0x2b2c2e));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// NYC-style signal: pole + mast arm along local -x, signal heads hanging at given offsets.
export function makeSignal({ arm = 9, height = 5.8, heads = [3.2, 6.6] } = {}) {
  const yellow = furnMat('sigY', 0xe8b923);
  const dark = furnMat('sigD', 0x1d2125);
  const metal = furnMat('sigM', 0x6d7276);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, height + 0.6, 8), metal);
  pole.position.y = (height + 0.6) / 2;
  const armM = new THREE.Mesh(new THREE.BoxGeometry(arm, 0.16, 0.16), metal);
  armM.position.set(-arm / 2, height, 0);
  const headMeshes = heads.map((hx) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.08, 0.34), yellow);
    box.position.y = -0.62;
    g.add(box);
    for (let i = 0; i < 3; i++) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), dark);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, -0.3 - i * 0.32, 0.18);
      g.add(lens);
    }
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), metal);
    hanger.position.y = -0.06;
    g.add(hanger);
    g.position.set(-hx, height - 0.08, 0);
    return g;
  });
  for (const o of [pole, armM, ...headMeshes]) o.traverse((m) => m.isMesh && (m.castShadow = true));
  return { pole, arm: armM, heads: headMeshes, height, armLength: arm };
}

// Dust/smoke puff sprite material factory.
export function dustMaterial(color = 0xc8ae86) {
  return new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, depthWrite: false, opacity: 0 });
}

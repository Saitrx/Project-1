// Scripted vehicles: each has an analytic pose(t) so every frame is reproducible.
import * as THREE from 'three';
import { makeVehicle, placeVehicle, foldMirrors } from '../kit/vehicles.js';
import { carScale } from '../timeline.js';

/** Distance travelled for a speed profile given as [[t, v], ...] (piecewise linear). */
export function distanceFn(profile) {
  const P = profile.slice().sort((a, b) => a[0] - b[0]);
  return (t) => {
    let d = 0;
    if (t <= P[0][0]) return P[0][1] * (t - P[0][0]);
    for (let i = 0; i < P.length - 1; i++) {
      const [ta, va] = P[i];
      const [tb, vb] = P[i + 1];
      if (t <= ta) break;
      const te = Math.min(t, tb);
      const vEnd = va + ((vb - va) * (te - ta)) / (tb - ta);
      d += ((va + vEnd) / 2) * (te - ta);
      if (t <= tb) return d;
    }
    const [tl, vl] = P[P.length - 1];
    if (t > tl) d += vl * (t - tl);
    return d;
  };
}

/**
 * spec: { type, color, x (lane centre or fn), z0 (centre z at dist 0), dir: -1 north | +1 south,
 *         dist: (t) => metres, scale: (t) => s (default carScale), heading: (t) => extra yaw }
 */
export function scriptedCar(scene, spec) {
  const v = makeVehicle(spec.type, { color: spec.color });
  scene.add(v.group);
  const scaleFn = spec.scale ?? carScale;
  const xFn = typeof spec.x === 'function' ? spec.x : () => spec.x;
  const car = {
    v,
    spec,
    pose(t) {
      const d = spec.dist(t);
      const s = scaleFn(t);
      const z = spec.z0 + spec.dir * d;
      const heading = (spec.dir < 0 ? Math.PI : 0) + (spec.heading ? spec.heading(t) : 0);
      return { x: xFn(t), z, heading, s, d };
    },
    update(t) {
      const p = car.pose(t);
      placeVehicle(v, p.x, 0, p.z, p.heading, p.s);
      v.roll(p.d, p.s);
      v.group.visible = true;
      return p;
    },
    hide() {
      v.group.visible = false;
    },
    // Footprint rectangle (axis-aligned approximation) incl. mirrors.
    halfWidth(s, mirrors = true) {
      return (mirrors ? v.dims.mirrorReach : v.dims.W / 2) * s;
    },
  };
  return car;
}

/** Fold the mirrors of any car whose mirror would touch a neighbour (no clipping). */
export function autoFold(cars, t, skip = new Set()) {
  const poses = cars.map((c) => (c.v.group.visible ? c.pose(t) : null));
  cars.forEach((c, i) => {
    if (skip.has(c) || !poses[i]) return;
    const p = poses[i];
    let fold = 0;
    cars.forEach((o, j) => {
      if (i === j || !poses[j]) return;
      const q = poses[j];
      const dz = Math.abs(p.z - q.z);
      const lenSum = (c.v.dims.L * p.s + o.v.dims.L * q.s) / 2;
      if (dz > lenSum) return;
      const gap = Math.abs(p.x - q.x) - (c.v.dims.W / 2) * p.s - (o.v.dims.W / 2) * q.s;
      const need = (c.v.dims.mirrorReach - c.v.dims.W / 2) * p.s + 0.1;
      if (gap < need) fold = Math.max(fold, Math.min(1, (need - gap) / (0.25 * p.s) + 0.6));
    });
    foldMirrors(c.v, fold);
  });
}

/** Debug: report body overlaps between cars over [t0, t1]. */
export function checkOverlaps(cars, t0, t1, label = '') {
  const issues = [];
  for (let t = t0; t <= t1; t += 0.2) {
    const ps = cars.map((c) => c.pose(t));
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dz = Math.abs(a.z - b.z) - (cars[i].v.dims.L * a.s + cars[j].v.dims.L * b.s) / 2;
        const dx = Math.abs(a.x - b.x) - (cars[i].v.dims.W * a.s + cars[j].v.dims.W * b.s) / 2;
        if (dz < 0 && dx < 0) issues.push(`${label} t=${t.toFixed(1)} ${cars[i].spec.type}@${a.x.toFixed(1)},${a.z.toFixed(1)} vs ${cars[j].spec.type}@${b.x.toFixed(1)},${b.z.toFixed(1)}`);
      }
    }
  }
  if (issues.length) console.log('OVERLAP ' + issues.slice(0, 12).join(' | '));
  return issues;
}

/**
 * Collision boxes (scale 1, vehicle local frame) approximating a vehicle's body for PhysicsBake
 * kinematics: lower body, cabin/box and, for taxis, the roof sign.
 */
export function kinShapes(v, { wheels = false } = {}) {
  const base = kinBody(v);
  if (!wheels) return base;
  const { wheelR, wheelbase, track } = v.dims;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) base.push({ half: [0.16, wheelR, wheelR * 0.9], offset: [(sx * track) / 2, wheelR, (sz * wheelbase) / 2] });
  return base;
}

function kinBody(v) {
  const { L, W, H, clearance: clr } = v.dims;
  const t = v.type;
  if (t === 'van') {
    return [
      { half: [W / 2, (H - clr) / 2, L * 0.39], offset: [0, clr + (H - clr) / 2, -L * 0.11] },
      { half: [W / 2, H * 0.22, L * 0.12], offset: [0, clr + H * 0.22, L * 0.38] },
    ];
  }
  if (t === 'bus' || t === 'truck') return [{ half: [W / 2, (H - clr) / 2, L / 2], offset: [0, clr + (H - clr) / 2, 0] }];
  const lowerH = H * 0.45;
  const cabH = H - lowerH - clr;
  const shapes = [
    { half: [W / 2, lowerH / 2, L / 2], offset: [0, clr + lowerH / 2, 0] },
    { half: [W * 0.42, cabH / 2, L * 0.22], offset: [0, clr + lowerH + cabH / 2, -L * 0.05] },
  ];
  if (t === 'taxi') shapes.push({ half: [0.36, 0.13, 0.14], offset: [0, H + 0.12, -L * 0.08] });
  return shapes;
}

/** PhysicsBake pose function for a scripted car. */
export function kinPose(car) {
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  return (t) => {
    const p = car.pose(t);
    return { position: new THREE.Vector3(p.x, 0, p.z), quaternion: q.clone().setFromAxisAngle(up, p.heading), scale: p.s };
  };
}

/** Solve z0 so that a car's centre is at zAt at time tAt (dir/dist as in scriptedCar). */
export function z0For(zAt, tAt, dir, dist) {
  return zAt - dir * dist(tAt);
}

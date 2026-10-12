// Keyframed camera with smooth (monotone cubic) channels, plus walk/run bob and shake.
import * as THREE from 'three';
import { fbm1 } from '../rng.js';

// Monotone cubic Hermite interpolation (Fritsch-Carlson): smooth, never overshoots the keys.
export class Track {
  constructor(keys) {
    this.k = keys.slice().sort((a, b) => a[0] - b[0]);
    const n = this.k.length;
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((this.k[i + 1][1] - this.k[i][1]) / (this.k[i + 1][0] - this.k[i][0]));
    const m = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    m[0] = 0;
    m[n - 1] = 0;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    this.m = m;
  }
  at(t) {
    const k = this.k;
    if (t <= k[0][0]) return k[0][1];
    if (t >= k[k.length - 1][0]) return k[k.length - 1][1];
    let i = 0;
    while (t > k[i + 1][0]) i++;
    const h = k[i + 1][0] - k[i][0];
    const s = (t - k[i][0]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * k[i][1] + (s3 - 2 * s2 + s) * h * this.m[i] + (-2 * s3 + 3 * s2) * k[i + 1][1] + (s3 - s2) * h * this.m[i + 1];
  }
}

/** keys: [{ t, x, y, z, yaw, pitch, roll }] (any channel may be omitted after the first key). */
export function camPath(keys) {
  const ch = {};
  for (const name of ['x', 'y', 'z', 'yaw', 'pitch', 'roll']) {
    let last = keys[0][name] ?? 0;
    const pts = [];
    for (const k of keys) {
      if (k[name] !== undefined) last = k[name];
      pts.push([k.t, last]);
    }
    ch[name] = new Track(pts);
  }
  return (t) => ({
    x: ch.x.at(t),
    y: ch.y.at(t),
    z: ch.z.at(t),
    yaw: ch.yaw.at(t),
    pitch: ch.pitch.at(t),
    roll: ch.roll.at(t),
  });
}

// yaw: 0 looks toward -z (north), positive turns left (toward -x). pitch: positive looks up.
export function applyCam(camera, p) {
  camera.position.set(p.x, p.y, p.z);
  camera.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
  camera.updateMatrixWorld(true);
}

// Head bob for walking/running. steps = distance / stepLength (continuous).
export function bob(steps, kind = 'walk') {
  const ph = steps * Math.PI;
  if (kind === 'run') {
    return { dy: 0.055 * (Math.abs(Math.cos(ph)) - 0.6), dx: 0.03 * Math.sin(ph), roll: 0.012 * Math.sin(ph), pitch: 0.012 * Math.cos(2 * ph) };
  }
  return { dy: 0.028 * (Math.abs(Math.cos(ph)) - 0.6), dx: 0.018 * Math.sin(ph), roll: 0.005 * Math.sin(ph), pitch: 0.004 * Math.cos(2 * ph) };
}

// Smooth seeded shake (rotation in radians, translation in metres).
export function shake(camera, t, amp, { seed = 1, freq = 7, trans = 0.0 } = {}) {
  if (amp <= 0) return;
  camera.rotateX(fbm1(t * freq, seed) * 0.02 * amp);
  camera.rotateY(fbm1(t * freq, seed + 3) * 0.02 * amp);
  camera.rotateZ(fbm1(t * freq * 0.8, seed + 7) * 0.012 * amp);
  if (trans) {
    camera.position.x += fbm1(t * freq, seed + 11) * trans * amp;
    camera.position.y += fbm1(t * freq, seed + 13) * trans * amp;
  }
  camera.updateMatrixWorld(true);
}

// Gentle handheld drift (always on, very small).
export function drift(camera, t, amp = 1, seed = 5) {
  camera.rotateX(fbm1(t * 0.35, seed) * 0.006 * amp);
  camera.rotateY(fbm1(t * 0.35, seed + 2) * 0.008 * amp);
  camera.updateMatrixWorld(true);
}

export function makeCamera(fov = 62, near = 0.03, far = 6000) {
  return new THREE.PerspectiveCamera(fov, 9 / 16, near, far);
}

// Orientation keys as quaternions with eased slerp between keys (no gimbal problems when
// looking straight up). keys: [{ t, x, y, z, yaw, pitch, roll }]; positions use monotone cubics.
export function camPathQ(keys) {
  const pos = {};
  for (const name of ['x', 'y', 'z']) {
    let last = keys[0][name];
    pos[name] = new Track(keys.map((k) => [k.t, (last = k[name] ?? last)]));
  }
  let ly = keys[0].yaw ?? 0;
  let lp = keys[0].pitch ?? 0;
  let lr = keys[0].roll ?? 0;
  const qs = keys.map((k) => {
    ly = k.yaw ?? ly;
    lp = k.pitch ?? lp;
    lr = k.roll ?? lr;
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(lp, ly, lr, 'YXZ'));
  });
  const ts = keys.map((k) => k.t);
  const q = new THREE.Quaternion();
  return (t) => {
    let i = 0;
    while (i < ts.length - 2 && t > ts[i + 1]) i++;
    const u = Math.min(1, Math.max(0, (t - ts[i]) / (ts[i + 1] - ts[i])));
    const e = u * u * u * (u * (u * 6 - 15) + 10);
    q.slerpQuaternions(qs[i], qs[i + 1], e);
    return { x: pos.x.at(t), y: pos.y.at(t), z: pos.z.at(t), q: q.clone() };
  };
}

export function applyCamQ(camera, p) {
  camera.position.set(p.x, p.y, p.z);
  camera.quaternion.copy(p.q);
  camera.updateMatrixWorld(true);
}

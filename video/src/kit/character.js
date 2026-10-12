// Stylised faceless block characters (Roblox-like proportions from the reference video)
// with a jointed rig and a procedural walk / run cycle that keeps planted feet still.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smoothstep } from '../util.js';

const geoCache = new Map();
function rbox(w, h, d, r = 0.018) {
  const key = `${w}|${h}|${d}|${r}`;
  if (!geoCache.has(key)) geoCache.set(key, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
  return geoCache.get(key);
}
const matCache = new Map();
function mat(color) {
  const key = String(color);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(key);
}

let shadowTex;
function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.32)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}

export const SKIN = [0xe0b48c, 0xc99a6e, 0x9a6b47, 0x6e4a32, 0xf0c8a0];
export const HAIR = [0x1b1714, 0x3a2416, 0x5b3a22, 0x8a8580, 0xb08850];

function part(parent, geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * opts: {
 *   kind: 'man' | 'woman' | 'boy' | 'girl', skin, hair, shirt, pants, shoes,
 *   longSleeves, skirt (color), vest (hi-vis), hardHat, suit, tie, shadow (bool)
 * }
 */
export function makeCharacter(opts = {}) {
  const kind = opts.kind ?? 'man';
  const child = kind === 'boy' || kind === 'girl';
  const female = kind === 'woman' || kind === 'girl';
  const s = child ? 0.66 : 1; // overall scale for body segments
  const skin = opts.skin ?? SKIN[0];
  const hair = opts.hair ?? HAIR[0];
  const shirt = opts.shirt ?? 0x3aa0e0;
  const pants = opts.pants ?? 0x1e2a44;
  const shoes = opts.shoes ?? 0x1a1a1a;
  const skirt = opts.skirt ?? (female ? 0x6a4a6e : null);
  const longSleeves = opts.longSleeves ?? female;

  const dims = {
    shin: 0.42 * s,
    thigh: 0.42 * s,
    foot: 0.08 * s,
    torsoH: (female ? 0.54 : 0.56) * s,
    torsoW: (female ? 0.4 : 0.44) * s,
    torsoD: 0.23 * s,
    upper: 0.3 * s,
    fore: 0.27 * s,
    head: (child ? 0.3 : 0.27) * (child ? 0.9 : 1),
  };
  const hipH = dims.shin + dims.thigh + dims.foot;

  const root = new THREE.Group();
  root.userData.dims = dims;
  const hips = pivot(root, 0, hipH, 0);
  part(hips, rbox(dims.torsoW * 0.86, 0.14 * s, dims.torsoD * 0.95), skirt ?? pants, 0, 0.02 * s, 0);

  const spine = pivot(hips, 0, 0.06 * s, 0);
  const torsoColor = opts.suit ?? shirt;
  const torso = part(spine, rbox(dims.torsoW, dims.torsoH, dims.torsoD, 0.03 * s), torsoColor, 0, dims.torsoH / 2, 0);
  if (female) {
    // Loose tunic: a slightly wider hem so the top hangs rather than clings.
    part(spine, rbox(dims.torsoW * 1.08, 0.16 * s, dims.torsoD * 1.12, 0.03 * s), torsoColor, 0, 0.06 * s, 0);
  }
  if (opts.suit) {
    part(torso, rbox(0.12 * s, 0.2 * s, 0.01), 0xf2f2f0, 0, dims.torsoH * 0.28, dims.torsoD / 2 + 0.002);
    if (opts.tie) part(torso, rbox(0.045 * s, 0.26 * s, 0.012, 0.005), opts.tie, 0, dims.torsoH * 0.18, dims.torsoD / 2 + 0.01);
  }
  if (opts.vest) {
    part(spine, rbox(dims.torsoW * 1.04, dims.torsoH * 0.82, dims.torsoD * 1.08, 0.025), opts.vest, 0, dims.torsoH * 0.47, 0);
    for (const y of [0.26, 0.5]) {
      part(spine, rbox(dims.torsoW * 1.06, 0.045, dims.torsoD * 1.1, 0.01), 0xd8dde0, 0, dims.torsoH * y, 0);
    }
  }

  const neck = pivot(spine, 0, dims.torsoH, 0);
  part(neck, rbox(0.1 * s, 0.07, 0.1 * s, 0.01), skin, 0, 0.03, 0);
  const head = pivot(neck, 0, 0.06, 0);
  const hs = dims.head;
  part(head, rbox(hs * 0.92, hs, hs * 0.92, 0.05 * hs), skin, 0, hs / 2, 0);
  // Hair: cap on top, plus back panel; long hair falls to the upper back.
  part(head, rbox(hs * 0.98, hs * 0.3, hs * 0.98, 0.05 * hs), hair, 0, hs * 0.92, -0.005);
  part(head, rbox(hs * 0.98, hs * (female ? 0.95 : 0.6), hs * 0.22, 0.04 * hs), hair, 0, hs * (female ? 0.42 : 0.62), -hs * 0.4);
  if (female) {
    part(head, rbox(hs * 0.16, hs * 0.85, hs * 0.75, 0.04 * hs), hair, hs * 0.44, hs * 0.48, -hs * 0.08);
    part(head, rbox(hs * 0.16, hs * 0.85, hs * 0.75, 0.04 * hs), hair, -hs * 0.44, hs * 0.48, -hs * 0.08);
    part(neck, rbox(hs * 1.02, 0.34 * s, hs * 0.26, 0.04 * hs), hair, 0, -0.08 * s, -dims.torsoD * 0.42);
  }
  if (opts.hardHat) {
    part(head, rbox(hs * 1.08, hs * 0.34, hs * 1.08, 0.08 * hs), opts.hardHat, 0, hs * 1.02, 0);
    part(head, rbox(hs * 1.3, hs * 0.05, hs * 1.3, 0.02 * hs), opts.hardHat, 0, hs * 0.86, 0.02);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const sh = pivot(spine, side * (dims.torsoW / 2 + 0.065 * s), dims.torsoH - 0.07 * s, 0);
    part(sh, rbox(0.12 * s, dims.upper, 0.13 * s), torsoColor, 0, -dims.upper / 2 + 0.03 * s, 0);
    const elbow = pivot(sh, 0, -dims.upper + 0.03 * s, 0);
    part(elbow, rbox(0.11 * s, dims.fore, 0.12 * s), longSleeves || opts.suit ? torsoColor : skin, 0, -dims.fore / 2, 0);
    part(elbow, rbox(0.1 * s, 0.11 * s, 0.09 * s, 0.02), skin, 0, -dims.fore - 0.05 * s, 0);
    arms.push({ sh, elbow, side });
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = pivot(hips, side * dims.torsoW * 0.24, 0, 0);
    part(hip, rbox(0.15 * s, dims.thigh, 0.17 * s), pants, 0, -dims.thigh / 2, 0);
    const knee = pivot(hip, 0, -dims.thigh, 0);
    part(knee, rbox(0.135 * s, dims.shin, 0.15 * s), pants, 0, -dims.shin / 2, 0);
    const ankle = pivot(knee, 0, -dims.shin, 0);
    part(ankle, rbox(0.15 * s, dims.foot, 0.27 * s, 0.025), shoes, 0, -dims.foot / 2, 0.05 * s);
    legs.push({ hip, knee, ankle, side });
  }

  if (skirt !== null && female) {
    // Long, flared, modest skirt from the waist to just above the ankles.
    const len = hipH - dims.foot - 0.07 * s;
    const g = new THREE.CylinderGeometry(dims.torsoW * 0.5, dims.torsoW * 0.82, len, 10, 1);
    const m = new THREE.Mesh(g, mat(skirt));
    m.scale.z = 0.92;
    m.position.y = 0.08 * s - len / 2;
    hips.add(m);
    root.userData.skirt = m;
  }

  if (opts.shadow !== false) {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.012;
    sh.scale.set(0.9 * s + 0.1, 0.75 * s + 0.1, 1);
    sh.renderOrder = -1;
    root.add(sh);
    root.userData.shadow = sh;
  }

  const rig = { root, hips, spine, neck, head, arms, legs, dims, hipH, female, skirted: skirt !== null && female, scale: s };
  root.userData.rig = rig;
  setPose(rig, { phase: 0, walk: 0, run: 0, t: 0 });
  return rig;
}

// Foot fore/aft displacement as a fraction of the stride half-width D, for a leg phase p in [0,1).
// Stance is linear (foot locked to the ground), swing is a smooth return.
function footCurve(p, stance) {
  if (p < stance) return 1 - (2 * p) / stance;
  const u = (p - stance) / (1 - stance);
  return -1 + 2 * (u * u * (3 - 2 * u));
}

// Stride length (one full cycle) for walk and run at this character's scale.
export function strideLength(rig, runW) {
  // Skirted characters take shorter steps so their legs stay inside the skirt.
  // The foot never travels further back than the hem is deep: shorter, quicker steps.
  return lerp(1.25, 2.5, runW) * rig.scale * (rig.skirted ? lerp(0.72, 0.5, runW) : 1);
}

/**
 * Pose the rig. state = {
 *   phase: cycles travelled (float), walk: 0..1, run: 0..1 (blend), t: seconds (for idle motion),
 *   lookUp: radians, lean: extra lean, armsUp: 0..1, armPoint: 0..1, reach: 0..1 (right arm forward)
 * }
 */
export function setPose(rig, st) {
  const { dims } = rig;
  const moving = clamp(st.walk + st.run, 0, 1);
  const runW = clamp(st.run, 0, 1);
  const stance = lerp(0.6, 0.36, runW);
  const L = strideLength(rig, runW);
  const D = (L * stance) / 2; // half the foot travel during stance (body travels 2D in stance)
  const legLen = dims.thigh + dims.shin;
  const out = [];
  for (const leg of rig.legs) {
    const offset = leg.side < 0 ? 0 : 0.5;
    const p = (((st.phase + offset) % 1) + 1) % 1;
    const f = footCurve(p, stance) * moving;
    const swingU = p >= stance ? (p - stance) / (1 - stance) : 0;
    const inSwing = p >= stance && moving > 0.001;
    // In a long skirt the shin must stay inside the hem, so the knee bends far less.
    const kneeMax = rig.skirted ? lerp(0.6, 0.62, runW) : lerp(0.95, 1.75, runW);
    const kneeSwing = inSwing ? Math.sin(Math.PI * swingU) * kneeMax * moving : 0;
    const kneeStance = !inSwing ? Math.sin(Math.PI * clamp(p / stance)) * lerp(0.06, 0.32, runW) * moving : 0;
    const knee = kneeSwing + kneeStance;
    // Hip angle that places the foot at displacement f*D given the knee bend.
    const reach = clamp((f * D) / legLen, -0.95, 0.95);
    const a = -Math.asin(reach) + knee * 0.45 * (inSwing ? 1 : 0.5) * -1;
    leg.hip.rotation.x = a;
    leg.knee.rotation.x = knee;
    leg.ankle.rotation.x = -(a + knee) + (inSwing ? 0.25 * Math.sin(Math.PI * swingU) * moving : 0);
    const drop = dims.thigh * Math.cos(a) + dims.shin * Math.cos(a + knee) + dims.foot;
    out.push({ drop, inSwing, f });
  }
  const anyStance = out.some((o) => !o.inSwing);
  let hipY = Math.max(out[0].drop, out[1].drop);
  if (!anyStance) {
    // Flight phase of the run: a small hop arc between foot contacts.
    const pA = (((st.phase % 0.5) + 0.5) % 0.5) / 0.5;
    const u = clamp((pA - stance * 2 + 1) / (1 - (stance * 2 - 1) + 1e-6));
    hipY += 0.05 * Math.sin(Math.PI * u) * runW;
  }
  const breathe = Math.sin((st.t ?? 0) * 2.1 + (rig.root.id % 7)) * 0.004 * (1 - moving);
  rig.hips.position.y = hipY + breathe;
  // Shift weight subtly while idle so standing people never look frozen.
  rig.hips.rotation.z = (1 - moving) * Math.sin((st.t ?? 0) * 0.7 + rig.root.id) * 0.015;

  const fL = out[0].f;
  const fR = out[1].f;
  rig.spine.rotation.x = lerp(0.03, 0.24, runW) * moving + (st.lean ?? 0);
  rig.spine.rotation.y = 0.07 * fL * (1 - runW) * moving;
  rig.neck.rotation.x = -rig.spine.rotation.x * 0.6 - (st.lookUp ?? 0);
  rig.neck.rotation.y = st.lookSide ?? 0;

  for (const arm of rig.arms) {
    const opposite = arm.side < 0 ? fR : fL;
    const amp = lerp(0.42, 0.95, runW);
    let sh = -amp * opposite;
    let el = -lerp(0.18, 1.45, runW) * moving - 0.08 * (1 - moving) - 0.25 * Math.max(0, opposite) * (1 - runW) * moving;
    let abd = 0.06 * arm.side;
    const up = st.armsUp ?? 0;
    if (up > 0) {
      sh = lerp(sh, -2.95, up);
      el = lerp(el, -0.1, up);
      abd = lerp(abd, 0.18 * arm.side, up);
    }
    // Right arm (local -x) reaches forward and down, e.g. to press a button.
    if (arm.side < 0 && (st.reach ?? 0) > 0) {
      sh = lerp(sh, st.reachSh ?? -0.95, st.reach);
      el = lerp(el, st.reachEl ?? -0.55, st.reach);
    }
    arm.sh.rotation.x = sh;
    arm.sh.rotation.z = abd;
    arm.elbow.rotation.x = el;
  }
  if (rig.root.userData.skirt) {
    // Skirt sways gently with the stride instead of the legs poking through it.
    rig.root.userData.skirt.rotation.x = -0.05 * (fL + fR) * moving;
  }
}

/**
 * Precomputes a character's path motion for every frame so poses are a pure function of frame.
 * path: THREE.Curve in world XZ (y ignored). speed(t) -> m/s. runW(t) -> 0..1. t0..t1 seconds.
 */
export function bakeMotion(rig, { path, speed, run = () => 0, t0 = 0, t1 = 10, fps = 30, startS = 0, turnRate = 6 }) {
  const len = path.getLength();
  const sub = 8;
  const dt = 1 / (fps * sub);
  const frames = [];
  let s = startS;
  let phase = 0;
  let heading = null;
  const n = Math.ceil((t1 - t0) * fps) + 1;
  for (let i = 0; i < n * sub; i++) {
    const t = t0 + i * dt;
    const v = Math.max(0, speed(t));
    const rw = clamp(run(t));
    const ds = Math.min(v * dt, Math.max(0, len - s));
    s += ds;
    phase += ds / strideLength(rig, rw);
    const u = clamp(s / len);
    const tan = path.getTangentAt(Math.min(u, 0.9999));
    const target = Math.atan2(tan.x, tan.z);
    if (heading === null) heading = target;
    let d = target - heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading += d * (1 - Math.exp(-turnRate * dt));
    if (i % sub === 0) {
      const p = path.getPointAt(u);
      const vNorm = v * (ds > 0 ? 1 : 0);
      frames.push({ x: p.x, y: p.y, z: p.z, heading, phase, speed: vNorm, run: rw });
    }
  }
  return {
    at(t) {
      const f = clamp((t - t0) * fps, 0, frames.length - 1);
      const i = Math.floor(f);
      const j = Math.min(frames.length - 1, i + 1);
      const k = f - i;
      const A = frames[i];
      const B = frames[j];
      let dh = B.heading - A.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      return {
        x: lerp(A.x, B.x, k),
        y: lerp(A.y, B.y, k),
        z: lerp(A.z, B.z, k),
        heading: A.heading + dh * k,
        phase: lerp(A.phase, B.phase, k),
        speed: lerp(A.speed, B.speed, k),
        run: lerp(A.run, B.run, k),
      };
    },
  };
}

// Apply baked motion at time t: place the root and pose the rig with walk/run weights from speed.
export function driveCharacter(rig, motion, t, extra = {}) {
  const m = motion.at(t);
  rig.root.position.set(m.x, m.y, m.z);
  rig.root.rotation.y = m.heading;
  const moving = smoothstep(0.05, 0.6, m.speed);
  setPose(rig, {
    phase: m.phase,
    walk: moving * (1 - m.run),
    run: moving * m.run,
    t,
    ...extra,
  });
  return m;
}

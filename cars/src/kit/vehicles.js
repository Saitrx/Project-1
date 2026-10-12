// Low-poly vehicles in the reference style: chunky flat-coloured bodies, dark cabins, octagonal
// wheels with small hub caps, boxy mirrors and bright headlights. No brands or logos.
// Local frame: origin at the ground under the body centre, forward = +z, up = +y.
import * as THREE from 'three';

const MATS = new Map();
function lam(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
  return MATS.get(key);
}
function emissive(hex, intensity) {
  const key = 'e' + hex + ':' + intensity;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) }));
  return MATS.get(key);
}

const TYPES = {
  taxi: { L: 4.6, W: 1.84, H: 1.52, body: 0xf3c11b, cabin: 'sedan', roofSign: true, clearance: 0.16, wheelR: 0.34 },
  sedan: { L: 4.5, W: 1.8, H: 1.46, body: 0xd8c59c, cabin: 'sedan', clearance: 0.16, wheelR: 0.33 },
  van: { L: 5.2, W: 1.98, H: 2.15, body: 0xeeeeea, cabin: 'van', clearance: 0.18, wheelR: 0.36 },
  bus: { L: 12, W: 2.55, H: 3.2, body: 0x2f6fb3, cabin: 'bus', clearance: 0.3, wheelR: 0.5 },
  truck: { L: 7.8, W: 2.4, H: 3.4, body: 0xf2f2ee, cabin: 'truck', clearance: 0.3, wheelR: 0.48 },
};

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Trapezoid cabin (narrower roof) as a convex hull of 8 points.
function cabinGeo(wb, wt, lb, lt, h, shiftTop = 0) {
  const v = [
    [-wb / 2, 0, -lb / 2], [wb / 2, 0, -lb / 2], [wb / 2, 0, lb / 2], [-wb / 2, 0, lb / 2],
    [-wt / 2, h, -lt / 2 + shiftTop], [wt / 2, h, -lt / 2 + shiftTop], [wt / 2, h, lt / 2 + shiftTop], [-wt / 2, h, lt / 2 + shiftTop],
  ];
  const f = [
    [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
  ];
  const pos = [];
  for (const tri of f) for (const i of tri) pos.push(...v[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * makeVehicle(type, { color }) -> {
 *   group (scaled as a whole), body (inner group), wheels[], mirrors[], dims, setScale(s), roll(dist)
 * }
 */
export function makeVehicle(type, { color = null, seed = 0 } = {}) {
  const T = TYPES[type];
  const L = T.L;
  const W = T.W;
  const H = T.H;
  const group = new THREE.Group();
  group.userData.vehicle = true;
  const body = new THREE.Group();
  group.add(body);
  const paint = lam(color ?? T.body);
  const glass = lam(0x1d2a3d);
  const dark = lam(0x26282b);
  const trim = lam(0x3a3d42);
  const head = emissive(0xfff3d8, 3.2);
  const tail = emissive(0xff2a1a, 1.4);
  const clr = T.clearance;
  const wheelR = T.wheelR;
  const lowerH = type === 'bus' || type === 'truck' ? H * 0.5 : H * 0.45;

  if (T.cabin === 'sedan') {
    body.add(box(W, lowerH, L, paint, 0, clr + lowerH / 2, 0));
    // Hood and trunk slightly lower than the beltline give the classic three-box shape.
    const cab = new THREE.Mesh(cabinGeo(W * 0.92, W * 0.78, L * 0.5, L * 0.36, H - lowerH - clr, -L * 0.02), glass);
    cab.position.set(0, clr + lowerH, -L * 0.05);
    body.add(cab);
    // Roof panel + pillars in body colour.
    const roof = box(W * 0.8, 0.07, L * 0.36, paint, 0, H - 0.03, -L * 0.07);
    body.add(roof);
    for (const sx of [-1, 1]) {
      const pillar = box(0.08, H - lowerH - clr - 0.05, 0.1, paint, sx * W * 0.43, clr + lowerH + (H - lowerH - clr) / 2, -L * 0.07);
      body.add(pillar);
    }
    if (T.roofSign) {
      body.add(box(0.7, 0.24, 0.26, lam(0xf8f6ee), 0, H + 0.12, -L * 0.08));
      body.add(box(0.72, 0.05, 0.28, lam(0xe0a313), 0, H + 0.02, -L * 0.08));
      // Checker band on the doors.
      body.add(box(W + 0.01, 0.08, L * 0.5, lam(0x1c1c1c), 0, clr + lowerH * 0.62, -L * 0.04));
    }
  } else if (T.cabin === 'van') {
    body.add(box(W, H - clr - 0.05, L * 0.78, paint, 0, clr + (H - clr) / 2, -L * 0.11));
    body.add(box(W, lowerH, L * 0.24, paint, 0, clr + lowerH / 2, L * 0.38));
    const ws = new THREE.Mesh(cabinGeo(W * 0.96, W * 0.92, 0.12, 0.12, H - clr - lowerH - 0.12, -0.45), glass);
    ws.position.set(0, clr + lowerH, L * 0.28);
    body.add(ws);
    for (const sx of [-1, 1]) body.add(box(0.02, 0.55, 1.0, glass, sx * (W / 2 + 0.005), clr + lowerH + 0.45, L * 0.16));
  } else if (T.cabin === 'bus') {
    body.add(box(W, H - clr, L, paint, 0, clr + (H - clr) / 2, 0));
    body.add(box(W + 0.01, 0.35, L, lam(0xf2f2f2), 0, clr + 0.45, 0));
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) body.add(box(0.02, 0.95, 1.25, glass, sx * (W / 2 + 0.006), clr + H * 0.62, -L / 2 + 1.4 + i * 1.5));
    }
    body.add(box(W * 0.92, 1.2, 0.02, glass, 0, clr + H * 0.6, L / 2 + 0.01));
    body.add(box(W * 0.6, 0.3, 0.02, emissive(0xffb040, 1.2), 0, H - 0.25, L / 2 + 0.015));
  } else {
    // Box truck: cab + cargo box.
    body.add(box(W, H - clr - 0.1, L * 0.68, paint, 0, clr + (H - clr) / 2 + 0.05, -L * 0.16));
    body.add(box(W * 0.98, H * 0.62, L * 0.26, lam(0x3a6fb0), 0, clr + H * 0.31, L * 0.36));
    const ws = new THREE.Mesh(cabinGeo(W * 0.94, W * 0.9, 0.1, 0.1, H * 0.22, -0.2), glass);
    ws.position.set(0, clr + H * 0.38, L * 0.48);
    body.add(ws);
  }

  // Lights and bumpers (front = +z).
  const fy = clr + lowerH * 0.62;
  for (const sx of [-1, 1]) {
    const hl = box(W * 0.2, lowerH * 0.2, 0.05, head, sx * W * 0.33, fy, L / 2 + 0.02);
    hl.userData.headlight = true;
    body.add(hl);
    body.add(box(W * 0.16, lowerH * 0.16, 0.05, tail, sx * W * 0.36, fy + 0.04, -L / 2 - 0.02));
  }
  body.add(box(W * 1.01, lowerH * 0.24, 0.16, trim, 0, clr + lowerH * 0.16, L / 2 + 0.05));
  body.add(box(W * 1.01, lowerH * 0.24, 0.16, trim, 0, clr + lowerH * 0.16, -L / 2 - 0.05));
  body.add(box(W * 0.4, lowerH * 0.22, 0.04, dark, 0, fy, L / 2 + 0.03));

  // Mirrors on short arms, pivoting so they can fold or snap off.
  const mirrors = [];
  const mz = T.cabin === 'sedan' ? L * 0.14 : T.cabin === 'van' ? L * 0.33 : L * 0.42;
  const my = clr + lowerH + 0.12;
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * W * 0.47, my, mz);
    const arm = box(0.16, 0.05, 0.06, dark, sx * 0.08, 0, 0);
    const head2 = box(0.08, 0.17, 0.22, paint, sx * 0.17, 0.02, -0.02);
    pivot.add(arm, head2);
    body.add(pivot);
    mirrors.push({ pivot, side: sx, reach: W * 0.47 + 0.21 });
  }

  // Octagonal wheels with a little orange hub cap (like the reference).
  const wheels = [];
  const wb = T.cabin === 'bus' ? L * 0.62 : T.cabin === 'truck' ? L * 0.6 : L * 0.6;
  const track = W * 0.86;
  const tireMat = lam(0x1b1c1e);
  const hubMat = lam(0xe0752a);
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, Math.min(0.3, W * 0.15), 8);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(sx * track / 2, wheelR, (sz * wb) / 2);
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const hub = box(0.06, wheelR * 0.38, wheelR * 0.38, hubMat, sx * 0.13, 0, 0);
      w.add(tire, hub);
      group.add(w);
      wheels.push({ group: w, tire, front: sz > 0, side: sx });
    }
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const dims = { L, W, H, wheelR, wheelbase: wb, track, mirrorReach: W * 0.47 + 0.25, mirrorY: my, mirrorZ: mz, clearance: clr };
  return {
    type,
    group,
    body,
    wheels,
    mirrors,
    dims,
    paint,
    // Roll the wheels for distance travelled in metres at the current scale s.
    roll(dist, s) {
      const a = dist / (wheelR * s);
      for (const w of wheels) w.tire.rotation.x = a;
      for (const w of wheels) w.group.children[1].rotation.x = a;
    },
  };
}

/** Place a vehicle at ground point (x, y, z) facing heading (radians, 0 = +z), uniform scale s. */
export function placeVehicle(v, x, y, z, heading, s) {
  v.group.position.set(x, y, z);
  v.group.rotation.set(0, heading, 0);
  v.group.scale.setScalar(s);
}

// Mirror fold angle 0..1 (1 = folded flat against the body).
export function foldMirrors(v, amount) {
  for (const m of v.mirrors) m.pivot.rotation.y = m.side * amount * 1.2;
}

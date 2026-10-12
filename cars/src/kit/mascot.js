// An original chunky-kid character for the low-poly city: puffy quilted orange jacket, blue scarf,
// navy trousers, green-and-cream bobble hat with a red pompom, simple confident face.
// Origin at the feet, facing +z. Height about 1.3 m.
import * as THREE from 'three';

const mats = new Map();
function lam(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return mats.get(color);
}

export function makeMascot({ pose = 'hips' } = {}) {
  const g = new THREE.Group();
  const add = (parent, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, lam(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const C = { jacket: 0xe8852a, puff: 0xf29a3f, zip: 0x3a2a20, pants: 0x27324f, shoe: 0x4a3326, skin: 0xf2c49b,
    hat: 0x2f8f5b, band: 0xf1e6cc, pom: 0xd8432f, scarf: 0x2f6fb3, dark: 0x1d1a18, cheek: 0xe98a7a, mitten: 0x2f8f5b };

  // Legs and shoes.
  for (const sx of [-1, 1]) {
    add(g, box(0.21, 0.3, 0.22), C.pants, sx * 0.15, 0.2, 0);
    add(g, box(0.24, 0.1, 0.33), C.shoe, sx * 0.15, 0.05, 0.04);
  }
  // Puffy quilted jacket: a wide body with lighter puff bands and a zip.
  add(g, box(0.8, 0.62, 0.58), C.jacket, 0, 0.66, 0);
  for (const y of [0.5, 0.7, 0.9]) add(g, box(0.84, 0.07, 0.62), C.puff, 0, y, 0);
  add(g, box(0.03, 0.58, 0.02), C.zip, 0, 0.66, 0.3);
  // Scarf with a tail.
  add(g, box(0.62, 0.12, 0.5), C.scarf, 0, 1.01, 0);
  add(g, box(0.13, 0.32, 0.05), C.scarf, -0.16, 0.86, 0.29, 0, 0, 0.12);
  // Head: chunky low-poly ball.
  const head = add(g, new THREE.IcosahedronGeometry(0.31, 1), C.skin, 0, 1.3, 0);
  head.scale.set(1.05, 0.93, 1.0);
  // Face.
  for (const sx of [-1, 1]) {
    add(g, box(0.055, 0.075, 0.03), C.dark, sx * 0.095, 1.33, 0.285);
    add(g, box(0.1, 0.022, 0.03), C.dark, sx * 0.1, 1.405, 0.27, 0, 0, sx * -0.28);
    add(g, box(0.07, 0.04, 0.02), C.cheek, sx * 0.175, 1.25, 0.25);
  }
  add(g, box(0.13, 0.028, 0.03), C.dark, 0.02, 1.2, 0.285, 0, 0, -0.12);
  // Bobble hat.
  add(g, new THREE.CylinderGeometry(0.315, 0.325, 0.09, 12), C.band, 0, 1.43, 0);
  const crown = add(g, new THREE.IcosahedronGeometry(0.3, 1), C.hat, 0, 1.5, 0);
  crown.scale.set(1.0, 0.6, 1.0);
  add(g, new THREE.IcosahedronGeometry(0.085, 0), C.pom, 0, 1.69, 0);
  // Arms: hands on hips (or relaxed).
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sx * 0.43, 0.9, 0);
    g.add(sh);
    const up = new THREE.Group();
    const waving = pose === 'wave' && sx < 0; // the right arm (character's right is -x)
    up.rotation.z = waving ? sx * 2.55 : pose === 'hips' ? sx * 0.85 : sx * 0.22;
    sh.add(up);
    add(up, box(0.17, 0.3, 0.18), C.jacket, 0, -0.14, 0);
    const el = new THREE.Group();
    el.position.set(0, -0.28, 0);
    el.rotation.z = waving ? sx * 0.45 : pose === 'hips' ? -sx * 2.0 : -sx * 0.1;
    up.add(el);
    add(el, box(0.16, 0.26, 0.17), C.jacket, 0, -0.12, 0);
    add(el, box(0.15, 0.13, 0.16), C.mitten, 0, -0.29, 0);
  }
  return g;
}

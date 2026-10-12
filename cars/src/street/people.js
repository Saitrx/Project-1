// Pedestrians: faceless block people (men, women in long skirts and loose long sleeves, kids),
// walking straight sidewalk lanes with baked, foot-planted motion.
import * as THREE from 'three';
import { makeCharacter, bakeMotion, driveCharacter, setPose, SKIN, HAIR } from '../kit/character.js';
import { makeRng } from '../rng.js';

const SHIRTS = [0x3aa0e0, 0xe0782b, 0xf2c94c, 0x2fa59a, 0xd2403a, 0x8e6bbf, 0x5f9a3c, 0xf0ebe0, 0x2f5d8c, 0xd35f8d];
const PANTS = [0x1e2a44, 0x6a2a24, 0x2b2b30, 0x8a7a5a, 0x3b4a5c];
const SKIRTS = [0x7a5c9a, 0x40566e, 0x9a5a48, 0x4f6aa0, 0x5f7a4a, 0x6b4a6e];

export function randomPerson(rng, kind = null) {
  const k = kind ?? rng.pick(['man', 'woman', 'man', 'woman', 'boy', 'girl', 'man', 'woman']);
  const female = k === 'woman' || k === 'girl';
  const c = makeCharacter({
    kind: k,
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    skirt: female ? rng.pick(SKIRTS) : undefined,
    hair: rng.pick(HAIR),
    skin: rng.pick(SKIN),
  });
  c.root.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.castShadow = true;
  });
  // The blob shadow is unnecessary with real sun shadows.
  if (c.root.userData.shadow) c.root.userData.shadow.visible = false;
  c.kind = k;
  return c;
}

/**
 * A pedestrian on a straight path. spec: { kind, x, z0, z1, speed, t0, t1, y }
 * Returns { rig, motion, update(t, extra) }.
 */
export function walker(scene, rng, spec) {
  const rig = randomPerson(rng, spec.kind);
  scene.add(rig.root);
  const y = spec.y ?? 0.15;
  const pts = spec.points ?? [new THREE.Vector3(spec.x, y, spec.z0), new THREE.Vector3(spec.x2 ?? spec.x, y, spec.z1)];
  const path = pts.length === 2 ? new THREE.LineCurve3(pts[0], pts[1]) : new THREE.CatmullRomCurve3(pts);
  const speedFn = typeof spec.speed === 'function' ? spec.speed : () => spec.speed;
  const motion = bakeMotion(rig, { path, speed: speedFn, run: spec.run ?? (() => 0), t0: spec.t0, t1: spec.t1, turnRate: spec.turnRate ?? 6 });
  return {
    rig,
    motion,
    update(t, extra = {}) {
      rig.root.visible = true;
      return driveCharacter(rig, motion, t, extra);
    },
    hide() {
      rig.root.visible = false;
    },
  };
}

/** Someone standing still facing `heading`, with an optional pose function. */
export function stander(scene, rng, { kind, x, z, y = 0.15, heading = 0 }) {
  const rig = randomPerson(rng, kind);
  scene.add(rig.root);
  rig.root.position.set(x, y, z);
  rig.root.rotation.y = heading;
  return {
    rig,
    update(t, extra = {}) {
      rig.root.visible = true;
      setPose(rig, { phase: 0, walk: 0, run: 0, t, ...extra });
    },
    hide() {
      rig.root.visible = false;
    },
  };
}

export { makeRng };

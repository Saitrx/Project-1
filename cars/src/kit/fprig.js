// First-person body: blocky low-poly arms (navy sleeves, peach block hands like the reference),
// solved with 2-bone IK every frame, plus an invisible full body that only casts our shadow.
import * as THREE from 'three';
import { makeCharacter, setPose, HAIR } from './character.js';
import { clamp } from '../util.js';

const SLEEVE = 0x26324d;
const CUFF = 0x1c2538;
const SKIN = 0xf0b98a;

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// Hand in its own frame: palm centre at origin, fingers along +y, palm normal +z.
function makeHand(isRight) {
  const g = new THREE.Group();
  const skin = lam(SKIN);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.105, 0.036), skin);
  g.add(palm);
  const fingers = [];
  const xs = [-0.0345, -0.0115, 0.0115, 0.0345];
  const lens = [0.07, 0.082, 0.078, 0.062];
  xs.forEach((x, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.052, 0);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, lens[i], 0.026), skin);
    f.position.y = lens[i] / 2;
    pivot.add(f);
    pivot.rotation.z = (x / 0.0345) * -0.06;
    g.add(pivot);
    fingers.push(pivot);
  });
  const thumbPivot = new THREE.Group();
  const tx = isRight ? 0.05 : -0.05;
  thumbPivot.position.set(tx, -0.015, 0.004);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.062, 0.028), skin);
  thumb.position.y = 0.031;
  thumbPivot.add(thumb);
  thumbPivot.rotation.z = isRight ? -0.65 : 0.65;
  g.add(thumbPivot);
  return { group: g, fingers, thumb: thumbPivot };
}

function makeArm(isRight) {
  const root = new THREE.Group();
  const sleeve = lam(SLEEVE);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.135, 1, 0.135), sleeve);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.125, 1, 0.125), sleeve);
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.13), lam(CUFF));
  const hand = makeHand(isRight);
  root.add(upper, fore, cuff, hand.group);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { root, upper, fore, cuff, hand, isRight };
}

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

// Place a unit box (height 1 along y) between points a and b.
function span(mesh, a, b) {
  _v.subVectors(b, a);
  const len = _v.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, _v.normalize());
  mesh.scale.set(1, Math.max(0.001, len), 1);
}

export class FPRig {
  constructor(scene) {
    this.right = makeArm(true);
    this.left = makeArm(false);
    scene.add(this.right.root, this.left.root);
    this.upperLen = 0.31;
    this.foreLen = 0.3;
    // Shadow-only body.
    this.body = makeCharacter({ kind: 'man', shirt: SLEEVE, pants: 0x2a2f3a, hair: HAIR[1], shadow: false });
    const invisible = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.body.root.traverse((o) => {
      if (o.isMesh) {
        o.material = invisible;
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
    this.body.root.scale.setScalar(0.94);
    scene.add(this.body.root);
  }

  /**
   * Solve one arm. target: { space: 'cam'|'world', pos: [x,y,z], palm: [x,y,z], fingers: [x,y,z],
   * curl: 0..1 } where palm/fingers are directions in the same space. null hides the arm.
   */
  solveArm(arm, camera, target, side) {
    if (!target) {
      arm.root.visible = false;
      return;
    }
    arm.root.visible = true;
    const toWorld = (p) => (target.space === 'world' ? new THREE.Vector3(...p) : new THREE.Vector3(...p).applyMatrix4(camera.matrixWorld));
    const dirWorld = (d) => (target.space === 'world' ? new THREE.Vector3(...d).normalize() : new THREE.Vector3(...d).transformDirection(camera.matrixWorld));
    const shoulder = new THREE.Vector3(side * 0.2, -0.26, 0.14).applyMatrix4(camera.matrixWorld);
    const palmN = dirWorld(target.palm);
    const fingerD = dirWorld(target.fingers);
    // Orthonormal hand frame: y = fingers, z = palm normal.
    const zAxis = palmN.clone().sub(fingerD.clone().multiplyScalar(palmN.dot(fingerD))).normalize();
    const xAxis = new THREE.Vector3().crossVectors(fingerD, zAxis).normalize();
    const m = new THREE.Matrix4().makeBasis(xAxis, fingerD, zAxis);
    const hq = new THREE.Quaternion().setFromRotationMatrix(m);
    const handPos = toWorld(target.pos);
    const wrist = handPos.clone().addScaledVector(fingerD, -0.07).addScaledVector(zAxis, -0.004);
    // 2-bone IK with the elbow pointing down and outward.
    const L1 = this.upperLen;
    const L2 = this.foreLen;
    const d = clamp(wrist.distanceTo(shoulder), 0.05, L1 + L2 - 0.001);
    const dir = _a.subVectors(wrist, shoulder).normalize().clone();
    const reach = shoulder.clone().addScaledVector(dir, d);
    const pole = new THREE.Vector3(side * 0.7, -1, 0.25).transformDirection(camera.matrixWorld);
    const poleOrtho = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const elbow = shoulder.clone().addScaledVector(dir, L1 * cosA).addScaledVector(poleOrtho, L1 * sinA);
    span(arm.upper, shoulder, elbow);
    span(arm.fore, elbow, reach);
    arm.cuff.position.copy(reach);
    arm.cuff.quaternion.copy(arm.fore.quaternion);
    arm.hand.group.position.copy(handPos);
    arm.hand.group.quaternion.copy(hq);
    const curl = target.curl ?? 0;
    for (const f of arm.hand.fingers) f.rotation.x = curl * 1.4;
    arm.hand.thumb.rotation.x = curl * 0.6;
  }

  update(camera, { right = null, left = null } = {}) {
    camera.updateMatrixWorld(true);
    this.solveArm(this.right, camera, right, 1);
    this.solveArm(this.left, camera, left, -1);
  }

  /**
   * Shadow body under the camera. state: { mode: 'stand'|'walk'|'run'|'lie'|'sit',
   * phase, t, yaw, lean } — the body stands under the eye point.
   */
  placeBody(camera, st) {
    const b = this.body;
    const p = camera.position;
    const yaw = st.yaw ?? 0;
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    b.root.rotation.set(0, yaw + Math.PI, 0);
    if (st.mode === 'lie') {
      // On the back, head toward -z (north), eyes at the camera position.
      b.root.rotation.set(-Math.PI / 2, 0, 0);
      b.root.position.set(p.x, st.groundY + 0.12, p.z + 1.7);
      setPose(b, { phase: 0, walk: 0, run: 0, t: st.t });
      return;
    }
    if (st.mode === 'hide') {
      b.root.visible = false;
      return;
    }
    b.root.visible = true;
    const sit = st.sit ?? 0;
    b.root.position.set(p.x, st.groundY ?? 0, p.z).addScaledVector(back, 0.12);
    b.root.rotation.x = -sit * 0.3;
    const moving = st.mode === 'walk' || st.mode === 'run';
    setPose(b, {
      phase: st.phase ?? 0,
      walk: st.mode === 'walk' ? 1 : 0,
      run: st.mode === 'run' ? 1 : 0,
      t: st.t ?? 0,
      armsUp: st.armsUp ?? 0,
      lean: st.lean ?? 0,
    });
    if (!moving && st.armsUp) setPose(b, { phase: 0, walk: 0, run: 0, t: st.t, armsUp: st.armsUp });
  }
}

// Camera-space hand poses used by the shots. Directions: x right, y up, -z forward.
export const HANDS = {
  shieldR: { space: 'cam', pos: [0.13, 0.0, -0.4], palm: [0, 0, -1], fingers: [0.1, 1, 0.05], curl: 0.05 },
  shieldL: { space: 'cam', pos: [-0.13, -0.02, -0.4], palm: [0, 0, -1], fingers: [-0.1, 1, 0.05], curl: 0.05 },
};

// Running arm pump: phase in cycles; returns camera-space targets for both hands (or null).
export function runArms(phase, amount = 1) {
  const r = (ph, side) => {
    const s = Math.sin(2 * Math.PI * ph);
    // Forward swing brings the fist up into the lower corner of the frame.
    const fwd = Math.max(0, s);
    return {
      space: 'cam',
      pos: [side * (0.24 - 0.04 * fwd), -0.62 + 0.36 * fwd * amount, -0.18 - 0.2 * fwd],
      palm: [-side * 0.8, 0.2, -0.4],
      fingers: [side * 0.25, 0.9, -0.5],
      curl: 0.85,
    };
  };
  return { right: r(phase, 1), left: r(phase + 0.5, -1) };
}

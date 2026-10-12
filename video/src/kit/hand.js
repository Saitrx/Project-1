// First-person mannequin hand like the reference: block palm, capsule fingers, block sleeve.
// The hand points along -z (away from the camera) with the index finger extended.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function makeHand({ skin = 0xd9b48e, sleeve = 0x1f2630, glove = null } = {}) {
  const skinMat = new THREE.MeshStandardMaterial({ color: glove ?? skin, roughness: 0.55 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: sleeve, roughness: 0.8 });
  const root = new THREE.Group();
  // Sleeve/forearm runs back toward the camera (+z).
  const sleeveMesh = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.1, 0.5, 2, 0.02), sleeveMat);
  sleeveMesh.position.set(0, 0, 0.3);
  root.add(sleeveMesh);
  const palm = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.035, 0.1, 2, 0.012), skinMat);
  palm.position.set(0, 0, 0.0);
  root.add(palm);
  const fingers = [];
  const capsule = (len) => new THREE.CapsuleGeometry(0.0105, len, 4, 10);
  // Right hand, palm down: index finger is next to the thumb on the -x side.
  const xs = [-0.032, -0.011, 0.011, 0.032];
  xs.forEach((x, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, -0.05);
    const len = [0.05, 0.055, 0.05, 0.04][i];
    const f = new THREE.Mesh(capsule(len), skinMat);
    f.rotation.x = -Math.PI / 2;
    f.position.z = -(len / 2 + 0.01);
    pivot.add(f);
    root.add(pivot);
    fingers.push(pivot);
  });
  const thumb = new THREE.Group();
  thumb.position.set(-0.048, -0.005, -0.01);
  const tm = new THREE.Mesh(capsule(0.035), skinMat);
  tm.rotation.x = -Math.PI / 2;
  tm.position.z = -0.025;
  thumb.add(tm);
  thumb.rotation.y = 0.6;
  root.add(thumb);
  return {
    root,
    fingers,
    thumb,
    // point: 0 = open hand, 1 = index extended, others curled.
    setPoint(point) {
      fingers.forEach((p, i) => {
        p.rotation.x = i === 0 ? 0 : -1.5 * point;
      });
      thumb.rotation.x = -0.4 * point;
    },
  };
}

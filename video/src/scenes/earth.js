// 1:00-1:06  YEAR 100. Earth from space: green, clean, quiet; slow rotation. No city lights.
import * as THREE from 'three';
import { makeStars } from '../kit/sky.js';
import { makeEarth, lonLatToVec3 } from '../kit/earth.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp } from '../util.js';

export async function build(ctx) {
  const scene = new THREE.Scene();
  const stars = makeStars({ count: 6000, seed: 131, minY: -1.1, radius: 3000 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  const earth = makeEarth(ctx.earth, { green: true });
  scene.add(earth.group);
  earth.uniforms.lightsGain.value = 0;
  earth.uniforms.ambient.value = 0.02;
  earth.uniforms.cloudAmt.value = 0.7;
  const focus = lonLatToVec3(20, 12).normalize();
  const north = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(north, focus).normalize();
  // Sun from the upper left so the disc has a soft terminator on the right.
  earth.uniforms.sunDir.value.copy(focus.clone().multiplyScalar(0.8).addScaledVector(east, -0.55).addScaledVector(north, 0.25).normalize());
  const camera = makeCamera(THREE, 40, 0.01, 5000);
  const shot = { scene, camera, post: { bloomStrength: 0.45, bloomThreshold: 1.1, exposure: 0.95, lift: 0.015, vignette: 0.14, saturation: 1.0 } };
  return {
    shotsAt(t) {
      earth.group.rotation.y = -0.05 * t;
      earth.uniforms.cloudShift.value = 0.002 * t;
      stars.material.uniforms.time.value = t;
      const d = lerp(5.6, 4.9, ease('sine.inOut', -0.5, 6.5, t));
      camera.position.copy(focus).multiplyScalar(d).addScaledVector(north, 0.25);
      camera.up.copy(north);
      camera.lookAt(focus.clone().multiplyScalar(0.12));
      handheld(camera, t, { amp: 0.2, seed: 133 });
      return [{ shot, w: 1 }];
    },
  };
}

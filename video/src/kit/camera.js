// Camera helpers: seeded handheld drift and shake, so motion is smooth and repeatable.
import { fbm1 } from '../rng.js';

export function handheld(cam, t, { amp = 1, seed = 1, speed = 0.3 } = {}) {
  cam.rotateX(fbm1(t * speed, seed) * 0.007 * amp);
  cam.rotateY(fbm1(t * speed, seed + 5) * 0.009 * amp);
  cam.rotateZ(fbm1(t * speed * 0.7, seed + 9) * 0.005 * amp);
}

// Short, light shake for the big moments only; `env` is a 0..1 envelope.
export function shake(cam, t, env, { seed = 3, freq = 9 } = {}) {
  if (env <= 0) return;
  cam.rotateX(fbm1(t * freq, seed) * 0.012 * env);
  cam.rotateY(fbm1(t * freq, seed + 3) * 0.012 * env);
  cam.rotateZ(fbm1(t * freq, seed + 7) * 0.006 * env);
}

export function makeCamera(THREE, fov = 50, near = 0.1, far = 5000) {
  return new THREE.PerspectiveCamera(fov, 9 / 16, near, far);
}

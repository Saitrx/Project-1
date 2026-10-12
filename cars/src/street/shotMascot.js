// Example still: the original chunky-kid character standing on the street, traffic behind him.
// Rendered on its own (shots=mascot&notext) at t = 100 s, outside the video's timeline.
import * as THREE from 'three';
import { makeMascot } from '../kit/mascot.js';
import { scriptedCar } from './traffic.js';
import { applyCam } from '../kit/camrig.js';

export function buildMascotShot(ctx, W) {
  const { scene, camera, fp } = W;
  const objs = [];
  const kid = makeMascot({ pose: 'wave' });
  kid.position.set(14.2, 0.15, 24);
  kid.rotation.y = -0.12; // facing the camera, sun over our left shoulder
  scene.add(kid);
  objs.push(kid);
  for (const [x, z, type, color] of [[7.5, 27, 'taxi'], [4.5, 33, 'sedan', 0xc8352b], [7.5, 15, 'taxi'], [-2.0, 38, 'bus'], [1.5, 20, 'van']]) {
    const c = scriptedCar(scene, { type, color, x, z0: z, dir: -1, dist: () => 0, scale: () => 1 });
    objs.push(c.v.group);
    c.carUpdate = c.update;
    objs[objs.length - 1].userData.car = c;
  }
  return {
    range: [99, 101],
    objects: objs,
    update(t) {
      for (const o of objs) o.userData.car?.update(t);
      for (const tc of W.furn.trash) if (Math.abs(tc.position.z - 25) < 1 && tc.position.x > 0) tc.visible = false;
      applyCam(camera, { x: 13.75, y: 0.98, z: 27.2, yaw: -0.08, pitch: 0.12, roll: 0 });
      fp.update(camera, {});
      fp.placeBody(camera, { mode: 'hide' });
      W.setShadowFocus(12, 24, 26);
      return { bloomThreshold: 1.7, bloomStrength: 0.35 };
    },
  };
}

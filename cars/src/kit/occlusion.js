// Per-shot building visibility. Rays are cast through a dense grid from sampled camera poses of a
// shot; any building that is ever the first thing a ray hits stays visible for the whole shot, plus
// every building inside the sun's shadow box (so off-screen casters still cast). Everything else
// is hidden for the entire shot: no per-frame popping, and far less hidden geometry to rasterize.
import * as THREE from 'three';

export function buildingBoxes(buildings) {
  const B = new Float32Array(buildings.length * 6);
  buildings.forEach((b, i) => {
    B.set([b.x0, 0, b.z0, b.x1, b.top + 20, b.z1], i * 6);
  });
  return B;
}

function nearestHit(B, n, ox, oy, oz, dx, dy, dz, maxT, live) {
  let best = -1;
  let bestT = maxT;
  const ix = 1 / dx;
  const iy = 1 / dy;
  const iz = 1 / dz;
  for (let i = 0; i < n; i++) {
    if (!live[i]) continue;
    const o = i * 6;
    let t1 = (B[o] - ox) * ix;
    let t2 = (B[o + 3] - ox) * ix;
    let tmin = Math.min(t1, t2);
    let tmax = Math.max(t1, t2);
    t1 = (B[o + 1] - oy) * iy;
    t2 = (B[o + 4] - oy) * iy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (B[o + 2] - oz) * iz;
    t2 = (B[o + 5] - oz) * iz;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax >= Math.max(tmin, 0) && tmin < bestT) {
      bestT = Math.max(tmin, 0);
      best = i;
    }
  }
  return best;
}

/**
 * sample(t) must pose `camera` (and the sun shadow camera) for time t.
 * Returns a Set of building indices to keep visible.
 */
export function shotVisibility({ buildings, camera, sun, sample, t0, t1, step = 0.2, gridX = 96, gridY = 170 }) {
  const B = buildingBoxes(buildings);
  const n = buildings.length;
  const keep = new Set();
  const frustum = new THREE.Frustum();
  const m = new THREE.Matrix4();
  const box = new THREE.Box3();
  const dir = new THREE.Vector3();
  for (let t = t0; t <= t1 + 1e-6; t += step) {
    sample(Math.min(t, t1 - 1e-3));
    // Buildings the shot has flattened (hidden) neither occlude nor need drawing.
    const live = buildings.map((b) => b.group.visible);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const o = camera.position;
    for (let gy = 0; gy < gridY; gy++) {
      for (let gx = 0; gx < gridX; gx++) {
        dir.set(((gx + 0.5) / gridX) * 2 - 1, ((gy + 0.5) / gridY) * 2 - 1, 0.5).unproject(camera).sub(o).normalize();
        // Ground plane cut-off: rays that hit the ground first stop there.
        let maxT = 1e5;
        if (dir.y < -1e-4) maxT = (0 - o.y) / dir.y;
        const hit = nearestHit(B, n, o.x, o.y, o.z, dir.x, dir.y, dir.z, maxT, live);
        if (hit >= 0) keep.add(hit);
      }
    }
    // Shadow casters inside the sun's shadow box.
    sun.updateMatrixWorld(true);
    sun.target.updateMatrixWorld(true);
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.updateMatrices(sun);
    frustum.copy(sun.shadow.getFrustum());
    for (let i = 0; i < n; i++) {
      box.min.set(B[i * 6], B[i * 6 + 1], B[i * 6 + 2]);
      box.max.set(B[i * 6 + 3], B[i * 6 + 4], B[i * 6 + 5]);
      if (live[i] && frustum.intersectsBox(box)) keep.add(i);
    }
  }
  return keep;
}

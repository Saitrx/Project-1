// Geometry helpers: axis-aligned boxes with world-space UVs (so facade textures line up across
// separate pieces and pre-fractured chunks), merging by material, and simple prisms.
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Box from world min/max with UVs derived from world coordinates relative to `uvOrigin`.
 * tile = { w, h } metres per texture repeat. Positions are relative to `center` (default: world
 * origin, i.e. world coordinates; pass the box centre for pieces that move on their own).
 * Face groups: 0 = sides (+x,-x,+z,-z), 1 = top, 2 = bottom.
 */
export function worldBox(min, max, { uvOrigin = [0, 0, 0], tile = { w: 1, h: 1 }, center = null } = {}) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const c = center ?? [0, 0, 0];
  const pos = [];
  const nor = [];
  const uv = [];
  const groups = [];
  const [ox, oy, oz] = uvOrigin;
  const quad = (a, b, cc, d, n, uvf, group) => {
    const start = pos.length / 3;
    for (const p of [a, b, cc, a, cc, d]) {
      pos.push(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      nor.push(...n);
      uv.push(...uvf(p));
    }
    groups.push({ start, count: 6, group });
  };
  const uX = (p) => [(p[2] - oz) / tile.w, (p[1] - oy) / tile.h];
  const uXn = (p) => [(oz - p[2]) / tile.w, (p[1] - oy) / tile.h];
  const uZ = (p) => [(p[0] - ox) / tile.w, (p[1] - oy) / tile.h];
  const uZn = (p) => [(ox - p[0]) / tile.w, (p[1] - oy) / tile.h];
  const uY = (p) => [(p[0] - ox) / tile.w, (p[2] - oz) / tile.w];
  // +x face (normal +x), seen from +x: u runs toward -z
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], uXn, 0);
  // -x face, seen from -x: u runs toward +z
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], uX, 0);
  // +z face, seen from +z: u runs toward +x
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], uZ, 0);
  // -z face, seen from -z: u runs toward -x
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], uZn, 0);
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], uY, 1);
  quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], uY, 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // Merge consecutive same-group ranges.
  let cur = null;
  for (const gr of groups) {
    if (cur && cur.group === gr.group && cur.start + cur.count === gr.start) cur.count += gr.count;
    else {
      if (cur) g.addGroup(cur.start, cur.count, cur.group);
      cur = { ...gr };
    }
  }
  g.addGroup(cur.start, cur.count, cur.group);
  return g;
}

/**
 * Collects world-space geometry per material and merges it into one mesh per material.
 * add(geometry, material) where geometry is already in world space (or will be transformed by matrix).
 */
export class Batch {
  constructor() {
    this.parts = new Map();
  }
  add(geo, mat, matrix = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
    if (Array.isArray(mat)) {
      // Split multi-material geometry by group.
      const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
      for (const gr of groups) {
        const sub = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const a = g.attributes[name];
          sub.setAttribute(name, new THREE.Float32BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
        }
        this.push(sub, mat[gr.materialIndex]);
      }
    } else {
      g.clearGroups();
      this.push(g, mat);
    }
  }
  push(g, mat) {
    if (!mat) return;
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [mat, geos] of this.parts) {
      const merged = BufferGeometryUtils.mergeGeometries(geos, false);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = castShadow;
      m.receiveShadow = receiveShadow;
      group.add(m);
    }
    return group;
  }
}

// Box helper in world space (centre + size), plain UVs.
export function boxAt(cx, cy, cz, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(cx, cy, cz);
  return g;
}

export function mat4(position, rotationY = 0, scale = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(scale, scale, scale)
  );
  return m;
}

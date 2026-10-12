// Merge every visible mesh under `root` into one mesh per material (world space).
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeByMaterial(root, { castShadow = true, receiveShadow = true, filter = () => true } = {}) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !filter(o)) return;
    let vis = true;
    for (let p = o; p && p !== root.parent; p = p.parent) if (!p.visible) vis = false;
    if (!vis) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const push = (geo, m) => {
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(geo);
    };
    if (mats.length === 1) push(g, mats[0]);
    else {
      for (const gr of g.groups) {
        const sub = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'uv']) {
          const a = g.attributes[name];
          sub.setAttribute(name, new THREE.Float32BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
        }
        push(sub, mats[gr.materialIndex]);
      }
    }
  });
  const out = new THREE.Group();
  for (const [m, geos] of byMat) {
    const merged = BufferGeometryUtils.mergeGeometries(geos.map((x) => { x.clearGroups(); return x; }), false);
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    out.add(mesh);
  }
  return out;
}

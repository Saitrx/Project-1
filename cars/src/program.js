// Picks the shot for each frame, renders it, and composites the 4K text layer last.
import * as THREE from 'three';
import { FPS, BEATS } from './timeline.js';
import { drawOverlay, drawCover } from './overlay.js';
import { setMaxAniso } from './kit/textures.js';
import { buildWorld } from './street/world.js';

export async function buildProgram(engine, params) {
  setMaxAniso(params.has('aniso') ? Number(params.get('aniso')) : Math.min(4, engine.maxAniso));
  const only = params.get('shots')?.split(',');
  const want = (id) => !only || only.includes(id);
  const ctx = { engine, renderer: engine.renderer, pxScale: engine.H / 1920 };
  // Eyelid matte frames for the wake-up (a green-screen blink clip, cut to the part we use).
  if (want('wake')) {
    const urls = Array.from({ length: 117 }, (_, i) => `assets/eye/${String(i).padStart(3, '0')}.png`);
    ctx.eyeFrames = await Promise.all(urls.map((u) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = u;
    })));
  }
  const world = buildWorld(ctx);
  {
    // Shadow-pass material without texture sampling (three copies material.map into the depth
    // material by default, which samples facade textures for every shadow-map texel).
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    world.scene.traverse((o) => {
      if (o.isMesh && o.castShadow) o.customDepthMaterial = depthMat;
    });
    world.depthMat = depthMat;
  }
  if (params.has('mergecity')) {
    const { mergeByMaterial } = await import('./kit/merge.js');
    const merged = mergeByMaterial(world.city.root);
    world.city.root.visible = false;
    world.scene.add(merged);
  }
  const allObjects = [];
  const shots = [];
  const register = (id, s) => {
    s.id = id;
    shots.push(s);
    allObjects.push(...(s.objects ?? []));
  };
  if (want('wake')) register('wake', (await import('./street/shotWake.js')).buildWakeShot(ctx, world));
  if (want('manhole')) register('manhole', (await import('./street/shotManhole.js')).buildManholeShot(ctx, world));
  if (want('lights')) register('lights', (await import('./street/shotLights.js')).buildLightsShot(ctx, world));
  if (want('avenue')) register('avenue', (await import('./street/shotAvenue.js')).buildAvenueShot(ctx, world));
  if (only?.includes('mascot')) register('mascot', (await import('./street/shotMascot.js')).buildMascotShot(ctx, world));
  if (want('plow')) register('plow', (await import('./street/shotPlow.js')).buildPlowShot(ctx, world));
  if (want('giant')) register('giant', (await import('./street/shotGiant.js')).buildGiantShot(ctx, world));
  if (want('aerial')) register('aerial', (await import('./shots/aerial.js')).buildAerialShot(ctx));
  if (want('space')) register('space', await (await import('./shots/space.js')).buildSpaceShot(ctx));
  if (want('crack')) register('crack', (await import('./shots/crack.js')).buildCrackShot(ctx));

  // Building visibility per 1-second window of each street shot (sampled with overlap so a
  // building is shown slightly before it can first be seen and kept slightly after).
  const { shotVisibility } = await import('./kit/occlusion.js');
  const WIN = 1.0;
  for (const s of shots) {
    if (s.ownScene) continue;
    const t0v = performance.now();
    s.windows = [];
    for (let a = s.range[0]; a < s.range[1] - 1e-6; a += WIN) {
      const b = Math.min(s.range[1], a + WIN);
      world.resetAll();
      s.windows.push(
        shotVisibility({
          buildings: world.city.buildings,
          camera: world.camera,
          sun: world.sun,
          sample: (t) => s.update(t),
          t0: Math.max(s.range[0], a - 0.3),
          t1: Math.min(s.range[1], b + 0.3),
          step: 0.1,
          gridX: 80,
          gridY: 142,
        })
      );
    }
    const avg = s.windows.reduce((x, w) => x + w.size, 0) / s.windows.length;
    console.log(`visibility ${s.id}: avg ${avg.toFixed(0)}/${world.city.buildings.length} buildings per window (${((performance.now() - t0v) / 1000).toFixed(1)}s)`);
  }

  function shotAt(t) {
    return shots.find((s) => t >= s.range[0] && t < s.range[1]) ?? null;
  }

  function render(n) {
    const t = n / FPS;
    const shot = shotAt(t);
    if (params.has('cover')) drawCover(engine.overlayCtx, engine.W, engine.H);
    else if (params.has('notext')) engine.overlayCtx.clearRect(0, 0, engine.W, engine.H);
    else drawOverlay(engine.overlayCtx, engine.W, engine.H, t);
    if (!shot) {
      engine.presentBlack(n);
      return;
    }
    let post;
    let target;
    if (shot.ownScene) {
      post = shot.update(t);
      target = { scene: shot.scene, camera: shot.camera, post, clearColor: shot.clearColor };
    } else {
      world.resetAll();
      const vis = shot.windows[Math.min(shot.windows.length - 1, Math.floor((t - shot.range[0]) / WIN))];
      if (!params.has('nocull')) world.city.buildings.forEach((b, i) => {
        if (!vis.has(i)) {
          b.group.visible = false;
          for (const e of b.extras) e.visible = false;
        }
      });
      for (const o of allObjects) o.visible = false;
      for (const o of shot.objects ?? []) o.visible = true;
      post = shot.update(t);
      target = { scene: world.scene, camera: world.camera, post };
    }
    const r = engine.renderer;
    if (params.has('noshadow')) r.shadowMap.enabled = false;
    if (params.has('nopeople')) world.scene.traverse((o) => o.userData.rig && (o.visible = false));
    if (params.has('nocars')) world.scene.traverse((o) => o.userData.vehicle && (o.visible = false));
    if (params.has('nocity')) world.city.root.visible = false;
    if (params.has('noground')) world.city.ground.visible = false;
    if (params.has('nobuild')) for (const b of world.city.buildings) b.group.visible = false;
    if (params.has('nofog')) world.scene.fog = null;
    if (params.has('noback')) for (const b of world.city.buildings) if (b.back) b.group.visible = false;
    if (params.has('nocross')) for (const b of world.city.buildings) if (b.cross !== undefined) b.group.visible = false;
    if (params.has('near')) for (const b of world.city.buildings) if (Math.abs((b.z0 + b.z1) / 2) > Number(params.get('near'))) b.group.visible = false;
    if (params.has('noextras')) for (const b of world.city.buildings) for (const e of b.extras) e.visible = false;
    if (params.has('nomap')) world.city.root.traverse((o) => { if (o.isMesh && o.material.map && !o.userData.nm) { o.userData.nm = 1; o.material = o.material.clone(); o.material.map = null; } });
    if (params.has('basicmat')) world.city.root.traverse((o) => { if (o.isMesh && !o.userData.bm) { o.userData.bm = 1; o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: o.material.color }); } });
    if (params.has('basic')) world.city.root.traverse((o) => { if (o.isMesh && !o.userData.basic) { o.userData.basic = 1; const m = new (o.material.constructor === Array ? Object : o.material.constructor)(); } });
    if (params.has('aniso')) world.scene.traverse((o) => o.isMesh && o.material.map && (o.material.map.anisotropy = Number(params.get('aniso'))));
    if (params.has('smap')) {
      const sz = Number(params.get('smap'));
      if (world.sun.shadow.mapSize.x !== sz) {
        world.sun.shadow.mapSize.set(sz, sz);
        world.sun.shadow.map?.dispose();
        world.sun.shadow.map = null;
      }
    }
    if (params.has('ray')) {
      const cam = target.camera;
      target.scene.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const rc = new THREE.Raycaster(cam.position, dir, 0.05, 500);
      const hits = rc.intersectObject(target.scene, true).filter((h) => {
        for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
        return h.object.material && h.object.material.colorWrite !== false && !h.object.isInstancedMesh && h.distance > 0.3;
      });
      const h = hits[0];
      let path = '';
      for (let o = h?.object; o; o = o.parent) path = (o.name || o.type) + '/' + path;
      const f = (v) => v.toArray().map((x) => x.toFixed(2)).join(',');
      const bb = h ? new THREE.Box3().setFromObject(h.object) : null;
      console.log(`t=${t.toFixed(2)} cam=${f(cam.position)} dir=${f(dir)} hit=${h ? h.distance.toFixed(2) + ' @' + f(h.point) + ' ' + path + ' bb=' + f(bb.min) + '..' + f(bb.max) + ' mat=' + (h.object.material.color?.getHexString?.() ?? 'arr') + ' mt=' + h.object.material.type + ' gt=' + h.object.geometry.type + JSON.stringify(h.object.geometry.parameters ?? {}) + ' tr=' + h.object.material.transparent + ' op=' + h.object.material.opacity + ' ud=' + JSON.stringify(Object.keys(h.object.userData)) + ' pud=' + JSON.stringify(h.object.parent?.userData ?? {}).slice(0, 120) : 'none'}`);
    }
    const p0 = performance.now();
    engine.renderShot(target, n);
    engine.present(n);
    if (params.has('profile')) {
      const gl = r.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      let meshes = 0;
      let visible = 0;
      target.scene.traverse((o) => {
        if (o.isMesh || o.isSprite) {
          meshes++;
          if (o.visible) visible++;
        }
      });
      const stat = (root) => {
        let m = 0;
        let v = 0;
        root.traverse((o) => {
          if (o.isMesh) {
            m++;
            v += o.geometry.attributes.position.count;
          }
        });
        return `${m} meshes ${(v / 1000) | 0}k verts`;
      };
      console.log(`city: ${stat(world.city.root)} | scene: ${stat(world.scene)}`);
      console.log(`t=${t.toFixed(2)} calls=${r.info.render.calls} tris=${r.info.render.triangles} meshes=${meshes} vis=${visible} ms=${(performance.now() - p0) | 0}`);
    }
  }

  return { render, world, shots };
}

export { BEATS };

// Deterministic effects: lingering dust clouds, water spray, growing asphalt cracks, pigeons.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { puffTexture } from './textures.js';
import { clamp, smoothstep } from '../util.js';

/** Soft billboard puffs from a fixed list of emissions; pure function of time. */
export class Dust {
  constructor(scene, { color = 0xc9ad83, max = 160, opacity = 0.75, renderOrder = 2 } = {}) {
    this.specs = [];
    this.sprites = [];
    this.opacity = opacity;
    this.base = new THREE.Color(color);
    for (let i = 0; i < max; i++) {
      const m = new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, depthWrite: false, opacity: 0, fog: true });
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.renderOrder = renderOrder;
      scene.add(s);
      this.sprites.push(s);
    }
  }
  /**
   * emit({ t, pos:[x,y,z], count, spread:[sx,sy,sz], vel:[vx,vy,vz], velSpread, size, growth,
   *        life, rise, drag, shade:[min,max], seed })
   */
  emit(o) {
    const rng = makeRng(o.seed ?? this.specs.length + 1);
    for (let i = 0; i < (o.count ?? 10); i++) {
      const sp = o.spread ?? [1, 1, 1];
      const vs = o.velSpread ?? 1;
      const shade = o.shade ?? [0.85, 1.05];
      this.specs.push({
        t0: (o.t ?? 0) + rng.range(0, o.duration ?? 0),
        p: new THREE.Vector3(o.pos[0] + rng.range(-1, 1) * sp[0], o.pos[1] + rng.range(-1, 1) * sp[1], o.pos[2] + rng.range(-1, 1) * sp[2]),
        v: new THREE.Vector3((o.vel?.[0] ?? 0) + rng.range(-1, 1) * vs, (o.vel?.[1] ?? 0) + rng.range(0, 1) * vs * 0.6, (o.vel?.[2] ?? 0) + rng.range(-1, 1) * vs),
        size: (o.size ?? 3) * rng.range(0.7, 1.3),
        growth: (o.growth ?? 2) * rng.range(0.7, 1.3),
        life: (o.life ?? 6) * rng.range(0.8, 1.2),
        rise: (o.rise ?? 0.3) * rng.range(0.6, 1.4),
        drag: o.drag ?? 1.2,
        shade: rng.range(shade[0], shade[1]),
        alpha: (o.alpha ?? 1) * rng.range(0.7, 1),
        rot: rng.range(0, Math.PI * 2),
      });
    }
  }
  update(t) {
    let n = 0;
    const base = this.base;
    for (const s of this.specs) {
      const age = t - s.t0;
      if (age < 0 || age > s.life) continue;
      if (n >= this.sprites.length) break;
      const sp = this.sprites[n++];
      const k = (1 - Math.exp(-s.drag * age)) / s.drag;
      sp.position.set(s.p.x + s.v.x * k, s.p.y + s.v.y * k + s.rise * age, s.p.z + s.v.z * k);
      const size = s.size + s.growth * Math.sqrt(age);
      sp.scale.set(size, size, 1);
      sp.material.rotation = s.rot + age * 0.05;
      sp.material.opacity = this.opacity * s.alpha * smoothstep(0, 0.35, age) * (1 - smoothstep(s.life * 0.55, s.life, age));
      sp.material.color.copy(base).multiplyScalar(s.shade);
      sp.visible = true;
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }
}

/** Ballistic water spray from a broken hydrant (gravity, ground splash fade). */
export class Spray {
  constructor(scene, { pos, t0, t1 = 99, count = 90, seed = 4, power = 9, color = 0xdfeaf2, dir = null, spread = [1.2, 1.2], rate = 26, size = [0.35, 0.7] }) {
    this.pos = new THREE.Vector3(...pos);
    this.t0 = t0;
    this.t1 = t1;
    this.rate = rate;
    this.power = power;
    this.rng = makeRng(seed);
    this.drops = [];
    const mat = new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, depthWrite: false, opacity: 0.7 });
    this.sprites = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.visible = false;
      scene.add(s);
      this.sprites.push(s);
    }
    const n = Math.ceil((t1 - t0) * this.rate);
    for (let i = 0; i < Math.min(n, 4000); i++) {
      this.drops.push({
        tb: t0 + i / this.rate,
        v: dir
          ? new THREE.Vector3(dir[0] + this.rng.range(-spread[0], spread[0]), dir[1] + this.rng.range(-spread[1], spread[1]), dir[2] + this.rng.range(-spread[0], spread[0]))
          : new THREE.Vector3(this.rng.range(-1.2, 1.2), power * this.rng.range(0.85, 1.1), this.rng.range(-1.2, 1.2)),
        size: this.rng.range(size[0], size[1]),
      });
    }
  }
  update(t) {
    let n = 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const age = t - d.tb;
      if (age < 0) continue;
      const y = this.pos.y + d.v.y * age - 4.9 * age * age;
      if (y < -0.2 || age > 3) continue;
      if (n >= this.sprites.length) break;
      const s = this.sprites[n++];
      s.position.set(this.pos.x + d.v.x * age, Math.max(0.05, y), this.pos.z + d.v.z * age);
      const sz = d.size * (1 + age * 0.9);
      s.scale.set(sz, sz, 1);
      s.material.opacity = 0.75 * (1 - clamp(age / 2.4));
      s.visible = true;
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }
}

/** Branching dark cracks on the asphalt that grow from seed points over time. */
export class Cracks {
  constructor(scene, { maxSegments = 900, color = 0x161616, y = 0.012 } = {}) {
    this.segs = [];
    this.y = y;
    const g = new THREE.BoxGeometry(1, 0.01, 1);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color }), maxSegments);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }
  /** grow({ t0, x, z, len, width, speed, seed, dir, branches }) */
  grow(o) {
    const rng = makeRng(o.seed ?? 1);
    const walk = (x, z, ang, len, w, tStart, depth) => {
      let px = x;
      let pz = z;
      let tt = tStart;
      const step = Math.max(0.25, len / 10);
      let remaining = len;
      while (remaining > 0 && this.segs.length < this.mesh.instanceMatrix.count) {
        ang += rng.range(-0.55, 0.55);
        const l = Math.min(step * rng.range(0.6, 1.3), remaining);
        const nx = px + Math.cos(ang) * l;
        const nz = pz + Math.sin(ang) * l;
        const dur = l / (o.speed ?? 6);
        this.segs.push({ x0: px, z0: pz, x1: nx, z1: nz, w: w * rng.range(0.7, 1.1), t0: tt, t1: tt + dur });
        if (depth < 3 && rng.chance(0.28)) walk(nx, nz, ang + rng.range(0.6, 1.2) * (rng.chance(0.5) ? 1 : -1), remaining * 0.55, w * 0.6, tt + dur, depth + 1);
        px = nx;
        pz = nz;
        tt += dur;
        remaining -= l;
        w *= 0.93;
      }
    };
    const n = o.branches ?? 5;
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? 0) + (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
      walk(o.x, o.z, a, o.len * rng.range(0.6, 1.2), o.width ?? 0.18, o.t0 + rng.range(0, 0.2), 0);
    }
  }
  update(t) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let n = 0;
    for (const sg of this.segs) {
      if (t < sg.t0) continue;
      const u = clamp((t - sg.t0) / Math.max(1e-3, sg.t1 - sg.t0));
      const dx = sg.x1 - sg.x0;
      const dz = sg.z1 - sg.z0;
      const len = Math.hypot(dx, dz) * u;
      p.set(sg.x0 + (dx * u) / 2, this.y, sg.z0 + (dz * u) / 2);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx));
      s.set(Math.max(0.001, len), 1, sg.w * (0.4 + 0.6 * u));
      m.compose(p, q, s);
      this.mesh.setMatrixAt(n++, m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** A few low-poly pigeons flying along arcs with flapping wings. */
export function makePigeons(scene, n, seed = 9) {
  const rng = makeRng(seed);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8d9196 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5d6168 });
  const birds = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), mat);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), dark);
    head.position.set(0, 0.06, 0.2);
    g.add(body, head);
    const wings = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.07, 0.03, 0);
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.18), dark);
      w.position.x = sx * 0.17;
      pivot.add(w);
      g.add(pivot);
      wings.push({ pivot, sx });
    }
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    scene.add(g);
    birds.push({ g, wings, phase: rng.range(0, 1), speed: rng.range(7, 9), off: new THREE.Vector3(rng.range(-3, 3), rng.range(-1.5, 1.5), rng.range(-3, 3)), flap: rng.range(7, 9) });
  }
  return {
    birds,
    // Fly all birds along path(u) (u: 0..1 over [t0, t1]).
    update(t, path, t0, t1) {
      for (const b of birds) {
        const u = clamp((t - t0 - b.phase * 0.4) / (t1 - t0));
        const p = path(u).add(b.off);
        const p2 = path(Math.min(1, u + 0.01)).add(b.off);
        b.g.position.copy(p);
        b.g.lookAt(p2);
        b.g.visible = t >= t0 && u < 1;
        for (const w of b.wings) w.pivot.rotation.z = w.sx * Math.sin((t * b.flap + b.phase) * Math.PI * 2) * 0.9;
      }
    },
  };
}

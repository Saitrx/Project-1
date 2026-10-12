// Deterministic rigid-body destruction with cannon-es.
// The simulation runs once, at a fixed timestep, when a shot is first built; every body's pose is
// recorded per video frame so renderFrame(n) just looks the result up (random access, repeatable).
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { makeRng } from '../rng.js';

const v3 = (a) => new CANNON.Vec3(a[0], a[1], a[2]);

export class PhysicsBake {
  constructor({ t0, t1, fps = 30, hz = 120, seed = 1, maxSpeed = 20, groundY = 0 } = {}) {
    this.t0 = t0;
    this.t1 = t1;
    this.fps = fps;
    this.hz = hz;
    this.maxSpeed = maxSpeed;
    this.rng = makeRng(seed);
    const w = (this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) }));
    w.broadphase = new CANNON.SAPBroadphase(w);
    w.allowSleep = true;
    w.solver.iterations = 12;
    w.defaultContactMaterial.friction = 0.55;
    w.defaultContactMaterial.restitution = 0.12;
    w.defaultContactMaterial.contactEquationStiffness = 5e7;
    w.defaultContactMaterial.contactEquationRelaxation = 4;
    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    ground.position.set(0, groundY, 0);
    w.addBody(ground);
    this.pieces = [];
    this.kinematics = [];
    this.timers = [];
    this.baked = false;
  }

  addStaticBox(min, max) {
    const half = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(v3(half)) });
    b.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    this.world.addBody(b);
    return b;
  }

  /**
   * A breakable piece driven by a mesh (mesh must sit directly in the scene, world transform).
   * opts: { half: [hx,hy,hz] | shapes: [{ half, offset }], mass, active (start dynamic),
   *         trigger: 'kinematic' | number (time), margin, kick: (body, rng, kin) => void,
   *         damping, onActivate }
   */
  addPiece(mesh, opts) {
    mesh.updateMatrixWorld(true);
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    const shapes = opts.shapes ?? [{ half: opts.half, offset: [0, 0, 0] }];
    for (const s of shapes) body.addShape(new CANNON.Box(v3(s.half)), v3(s.offset ?? [0, 0, 0]));
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
    body.linearDamping = opts.damping ?? 0.05;
    body.angularDamping = opts.angularDamping ?? 0.08;
    body.sleepSpeedLimit = 0.15;
    body.sleepTimeLimit = 0.6;
    this.world.addBody(body);
    const piece = { mesh, body, opts, active: false, rec: null, activatedAt: null };
    this.pieces.push(piece);
    if (opts.active) this.activate(piece, this.t0, null);
    return piece;
  }

  activate(piece, t, kin) {
    if (piece.active) return;
    piece.active = true;
    piece.activatedAt = t;
    const b = piece.body;
    b.type = CANNON.Body.DYNAMIC;
    b.mass = piece.opts.mass ?? 50;
    b.updateMassProperties();
    b.aabbNeedsUpdate = true;
    if (kin) {
      b.velocity.set(kin.vel.x, kin.vel.y, kin.vel.z);
      b.velocity.scale(piece.opts.inherit ?? 0.8, b.velocity);
    }
    piece.opts.kick?.(b, this.rng, kin, t);
    for (const c of piece.opts.removeConstraints ?? []) this.world.removeConstraint(c);
    piece.opts.onActivate?.(piece, t);
    b.wakeUp();
  }

  /**
   * Kinematic collider following an analytic pose. pose(t) -> { position: Vector3, quaternion:
   * Quaternion, scale: number }. shapes are given at scale 1 in the object's local frame.
   */
  addKinematic(pose, shapes, { triggerMargin = 0.2 } = {}) {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
    for (const s of shapes) body.addShape(new CANNON.Box(v3(s.half)), v3(s.offset ?? [0, 0, 0]));
    this.world.addBody(body);
    const kin = { pose, shapes, body, scale: 1, vel: new THREE.Vector3(), triggerMargin, aabb: new CANNON.AABB() };
    this.kinematics.push(kin);
    return kin;
  }

  setKinematicScale(kin, s) {
    if (Math.abs(s - kin.scale) < 1e-4) return;
    kin.scale = s;
    kin.shapes.forEach((sh, i) => {
      const box = kin.body.shapes[i];
      box.halfExtents.set(sh.half[0] * s, sh.half[1] * s, sh.half[2] * s);
      box.updateConvexPolyhedronRepresentation();
      box.updateBoundingSphereRadius();
      const o = sh.offset ?? [0, 0, 0];
      kin.body.shapeOffsets[i].set(o[0] * s, o[1] * s, o[2] * s);
    });
    kin.body.updateBoundingRadius();
    kin.body.aabbNeedsUpdate = true;
  }

  at(time, fn) {
    this.timers.push({ time, fn, done: false });
  }

  stepKinematics(t, dt) {
    for (const k of this.kinematics) {
      const a = k.pose(t);
      const b = k.pose(t + dt);
      this.setKinematicScale(k, a.scale ?? 1);
      k.body.position.set(a.position.x, a.position.y, a.position.z);
      k.body.quaternion.set(a.quaternion.x, a.quaternion.y, a.quaternion.z, a.quaternion.w);
      k.vel.subVectors(b.position, a.position).divideScalar(dt);
      k.body.velocity.set(k.vel.x, k.vel.y, k.vel.z);
      k.body.aabbNeedsUpdate = true;
      k.body.updateAABB();
      k.aabb.copy(k.body.aabb);
      const m = k.triggerMargin;
      k.aabb.lowerBound.vadd(new CANNON.Vec3(-m, -m, -m), k.aabb.lowerBound);
      k.aabb.upperBound.vadd(new CANNON.Vec3(m, m, m), k.aabb.upperBound);
    }
  }

  // Exact oriented-box overlap (separating axis test) between any of the piece's boxes and any of
  // the kinematic's boxes, expanded by the kinematic's trigger margin.
  touches(k, piece) {
    piece.body.updateAABB();
    if (!k.aabb.overlaps(piece.body.aabb)) return false;
    const boxes = (body) =>
      body.shapes.map((sh, i) => {
        const c = new CANNON.Vec3();
        body.quaternion.vmult(body.shapeOffsets[i], c);
        c.vadd(body.position, c);
        const ax = [new CANNON.Vec3(1, 0, 0), new CANNON.Vec3(0, 1, 0), new CANNON.Vec3(0, 0, 1)].map((a) => body.quaternion.vmult(a));
        return { c, ax, h: [sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z] };
      });
    const A = boxes(k.body);
    const B = boxes(piece.body);
    for (const a of A) for (const b of B) if (obbOverlap(a, b, k.triggerMargin)) return true;
    return false;
  }

  bake() {
    const dt = 1 / this.hz;
    const nFrames = Math.ceil((this.t1 - this.t0) * this.fps) + 1;
    for (const p of this.pieces) p.rec = new Float32Array(nFrames * 7);
    const sub = this.hz / this.fps;
    let t = this.t0;
    for (let f = 0; f < nFrames; f++) {
      // Record this frame.
      for (const p of this.pieces) {
        const b = p.body;
        p.rec.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], f * 7);
      }
      for (let s = 0; s < sub; s++) {
        this.stepKinematics(t, dt);
        for (const tm of this.timers) {
          if (!tm.done && t >= tm.time) {
            tm.done = true;
            tm.fn(this, t);
          }
        }
        for (const p of this.pieces) {
          if (p.active) continue;
          const tr = p.opts.trigger;
          if (typeof tr === 'number') {
            if (t >= tr) this.activate(p, t, null);
          } else if (tr === 'kinematic') {
            for (const k of this.kinematics) {
              if (this.touches(k, p)) {
                this.activate(p, t, k);
                break;
              }
            }
            if (!p.active && p.opts.alsoTrigger?.(t, p)) this.activate(p, t, null);
          } else if (typeof tr === 'function') {
            if (tr(t, p)) this.activate(p, t, null);
          }
        }
        this.onStep?.(t, this);
        this.world.step(dt);
        // Keep penetration impulses from flinging debris unrealistically far.
        for (const p of this.pieces) {
          if (!p.active) continue;
          const v = p.body.velocity;
          const lim = p.opts.maxSpeed ?? this.maxSpeed;
          const sp = v.length();
          if (sp > lim) v.scale(lim / sp, v);
          const vc = p.opts.velClamp;
          if (vc) {
            if (vc.x) v.x = Math.min(vc.x[1], Math.max(vc.x[0], v.x));
            if (vc.y) v.y = Math.min(vc.y[1], Math.max(vc.y[0], v.y));
            if (vc.z) v.z = Math.min(vc.z[1], Math.max(vc.z[0], v.z));
          }
          const w = p.body.angularVelocity;
          const ws = w.length();
          if (ws > 12) w.scale(12 / ws, w);
        }
        t += dt;
      }
    }
    this.nFrames = nFrames;
    this.baked = true;
  }

  // Apply recorded poses for time t (interpolated between frames).
  apply(t) {
    const f = Math.min(this.nFrames - 1, Math.max(0, (t - this.t0) * this.fps));
    const i = Math.floor(f);
    const j = Math.min(this.nFrames - 1, i + 1);
    const k = f - i;
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    for (const p of this.pieces) {
      const r = p.rec;
      const a = i * 7;
      const b = j * 7;
      p.mesh.position.set(r[a] + (r[b] - r[a]) * k, r[a + 1] + (r[b + 1] - r[a + 1]) * k, r[a + 2] + (r[b + 2] - r[a + 2]) * k);
      qa.set(r[a + 3], r[a + 4], r[a + 5], r[a + 6]);
      qb.set(r[b + 3], r[b + 4], r[b + 5], r[b + 6]);
      p.mesh.quaternion.slerpQuaternions(qa, qb, k);
    }
  }

  /** Recorded world position of a piece at time t (no interpolation). */
  positionAt(piece, t) {
    const f = Math.min(this.nFrames - 1, Math.max(0, Math.round((t - this.t0) * this.fps)));
    const r = piece.rec;
    return new THREE.Vector3(r[f * 7], r[f * 7 + 1], r[f * 7 + 2]);
  }

  /** First time after `after` when the piece's height drops below y (e.g. lands), or null. */
  landTime(piece, after, y) {
    for (let f = 0; f < this.nFrames; f++) {
      const t = this.t0 + f / this.fps;
      if (t < after) continue;
      if (piece.rec[f * 7 + 1] < y) return t;
    }
    return null;
  }

  activationTime(piece) {
    return piece.activatedAt;
  }
}

function obbOverlap(a, b, margin) {
  const d = b.c.vsub(a.c);
  const axes = [...a.ax, ...b.ax];
  for (const u of a.ax) for (const v of b.ax) {
    const x = u.cross(v);
    if (x.lengthSquared() > 1e-8) axes.push(x.unit());
  }
  for (const L of axes) {
    let ra = margin;
    let rb = 0;
    for (let i = 0; i < 3; i++) {
      ra += a.h[i] * Math.abs(a.ax[i].dot(L));
      rb += b.h[i] * Math.abs(b.ax[i].dot(L));
    }
    if (Math.abs(d.dot(L)) > ra + rb) return false;
  }
  return true;
}

export { CANNON };

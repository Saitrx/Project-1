// Cut-out creatures: each part is an illustrated sprite (fill, scales, stipple, shadow hatching,
// outline) with a joint. Poses rotate parts about their joints (forward kinematics) so animals
// breathe, turn their heads, sway their tails and walk without redrawing their textures.
import { Layer, smoothPath, paintShape, scales, stipple, scribble, rgba, shade, mix, INK, glossyBall, bounds } from './paint.js';
import { makeRng } from './util.js';

// def.parts: [{ name, parent, at: [x, y] in parent coords, pts: outline in own coords (joint at 0,0),
//   z, fill, belly, stripes, scale (scale tile size), shadow, extra(g, path, box) }]
export function buildCreature(res, def) {
  const parts = {};
  for (const p of def.parts) {
    if (p.hidden) {
      parts[p.name] = { ...p, L: null };
      continue;
    }
    const b = bounds(p.pts);
    const m = (p.margin ?? 14) + (p.scale ?? 6);
    const L = new Layer(b.w + 2 * m, b.h + 2 * m, res, -b.x + m, -b.y + m);
    const path = smoothPath(p.pts, true, new Path2D(), p.tension ?? 1 / 6);
    const box = { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m };
    const fill = p.fill ?? def.fill;
    paintShape(L, path, {
      fill,
      light: def.light ?? [-0.5, -1],
      shadowDepth: p.shadowDepth ?? Math.min(b.w, b.h) * 0.28,
      shadowBlur: p.shadowBlur,
      shadowAlpha: p.shadowAlpha ?? 0.55,
      shadow: p.shadowColor ?? def.shadowColor,
      cross: p.cross ?? true,
      hatchSpacing: p.hatchSpacing ?? def.hatchSpacing ?? 2.6,
      hatchAlpha: p.hatchAlpha ?? def.hatchAlpha ?? 0.42,
      seed: (def.seed ?? 1) * 100 + def.parts.indexOf(p),
      outline: p.outline ?? def.outline ?? 1.2,
      outlineAlpha: p.outlineAlpha ?? 0.95,
      mottleAmount: 0.08,
      before: (Lx) => {
        const g = Lx.g;
        if ((p.scale ?? def.scale) > 0) scales(g, path, box, { size: p.scale ?? def.scale, base: fill, seed: (def.seed ?? 1) * 31 + def.parts.indexOf(p), contrast: p.contrast ?? def.contrast ?? 0.9 });
        // belly / underside colour toward the bottom of the part
        if (p.belly ?? def.belly) {
          g.save();
          g.clip(path);
          const bc = p.belly ?? def.belly;
          const gr = g.createLinearGradient(0, b.y + b.h * (p.bellyFrom ?? 0.45), 0, b.y + b.h);
          gr.addColorStop(0, rgba(bc, 0));
          gr.addColorStop(1, rgba(bc, 0.85));
          g.fillStyle = gr;
          g.fillRect(box.x, box.y, box.w, box.h);
          g.restore();
        }
        // darker stripes / blotches across the back
        if (p.stripes ?? def.stripes) {
          const st = p.stripes ?? def.stripes;
          const r = makeRng((def.seed ?? 1) * 7 + def.parts.indexOf(p));
          g.save();
          g.clip(path);
          g.fillStyle = rgba(st.color, st.alpha ?? 0.35);
          for (let x = box.x + r.range(0, st.gap); x < box.x + box.w; x += st.gap * r.range(0.8, 1.2)) {
            g.beginPath();
            g.ellipse(x, b.y + b.h * 0.15, st.w * r.range(0.7, 1.2), b.h * (st.len ?? 0.35), r.range(-0.3, 0.3), 0, Math.PI * 2);
            g.fill();
          }
          g.restore();
        }
        stipple(g, path, box, { count: Math.round((box.w * box.h) / 12), r: [0.3, 0.9], color: '#2a2414', alpha: 0.25, seed: (def.seed ?? 1) * 17 + def.parts.indexOf(p) });
      },
      after: p.extra ? (Lx) => p.extra(Lx.g, path, box) : undefined,
    });
    parts[p.name] = { ...p, L, path };
  }
  return { def, parts };
}

// Parts ordered so every parent comes before its children.
function ordered(def) {
  if (def._ordered) return def._ordered;
  const done = new Set();
  const out = [];
  while (out.length < def.parts.length) {
    for (const p of def.parts) {
      if (done.has(p.name)) continue;
      if (!p.parent || done.has(p.parent)) {
        out.push(p);
        done.add(p.name);
      }
    }
  }
  def._ordered = out;
  return out;
}

// World matrices of every part for a pose, without drawing.
export function creatureMatrices(def, pose = {}) {
  const mats = {};
  for (const p of ordered(def)) {
    const parent = p.parent ? mats[p.parent] : new DOMMatrix();
    let m = parent.translate(p.at?.[0] ?? 0, p.at?.[1] ?? 0);
    const a = pose[p.name] ?? 0;
    if (a) m = m.rotate((a * 180) / Math.PI);
    const sc = pose[p.name + '_s'];
    if (sc) m = m.scale(sc[0], sc[1]);
    mats[p.name] = m;
  }
  return mats;
}

// Compute world matrices for a pose ({ partName: angle }) and draw parts in z order.
export function drawCreature(g, C, pose = {}, opts = {}) {
  const mats = {};
  const order = C.def.parts;
  for (const p of ordered(C.def)) {
    const parent = p.parent ? mats[p.parent] : new DOMMatrix();
    let m = parent.translate(p.at?.[0] ?? 0, p.at?.[1] ?? 0);
    const a = pose[p.name] ?? 0;
    if (a) m = m.rotate((a * 180) / Math.PI);
    const sc = pose[p.name + '_s'];
    if (sc) m = m.scale(sc[0], sc[1]);
    mats[p.name] = m;
  }
  const list = [...order].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  const base = g.getTransform();
  for (const p of list) {
    if (opts.hide?.includes(p.name)) continue;
    const part = C.parts[p.name];
    if (!part.L) continue;
    g.setTransform(base.multiply(mats[p.name]));
    if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
    g.drawImage(part.L.c, -part.L.ox, -part.L.oy, part.L.w, part.L.h);
    if (opts.after?.[p.name]) opts.after[p.name](g);
  }
  g.setTransform(base);
  g.globalAlpha = 1;
  return mats;
}

// A point in a part's local coords, in the coordinates of the drawCreature call.
export function partPoint(mats, name, x, y) {
  const p = mats[name].transformPoint(new DOMPoint(x, y));
  return [p.x, p.y];
}

export { glossyBall, rgba, shade, mix, INK, scribble };

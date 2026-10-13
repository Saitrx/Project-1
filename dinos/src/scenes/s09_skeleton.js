// 0:48-0:54 The T. rex dissolves into its own line-art skeleton (same pose, same place), which
// settles at the top of the frame. A copy morphs into a chicken skeleton below; then matching bones
// light up in turn (skull, wishbone, thigh, shin, foot, hips), joined by lavender construction lines.
import { sparkle, rgba, strokePartial } from '../kit/paint.js';
import { clamp, lerp, smoothstep, easeInOut, easeOutBack, TAU } from '../kit/util.js';
import { trexBones, chickenBones, resample, GLOW_ORDER } from '../kit/skeletons.js';
import { trexDef } from '../kit/trex.js';
import { creatureMatrices } from '../kit/creature.js';
import { PLACE, sceneTrexPose, trexCam } from './s08_trex.js';

const BG = '#180f0b';
const CREAM = '#f1e3c2';
const LAV = '#8e8fd6';
const GOLD = '#ffcf6a';
const TOP = { x: 640, y: 506, s: 0.62 };
const BOT = { x: 580, y: 1060, s: 0.82 };
const SETTLE = [48.55, 49.7];
const MORPH = [49.65, 51.0];

export async function build(env) {
  const { S } = env;
  const def = trexDef();
  const TB = trexBones().map((b) => ({ ...b, rs: resample(b.pts, b.closed) }));
  const CBraw = chickenBones();
  const CB = {};
  for (const b of TB) CB[b.id] = resample(CBraw[b.id], b.closed);
  const groups = {};
  for (const b of TB) (groups[b.group] ??= []).push(b.id);

  // T. rex bone points in screen design coords at time t.
  function trexScreen(t) {
    const pose = sceneTrexPose(Math.min(t, SETTLE[0]));
    const mats = creatureMatrices(def, pose);
    const c = trexCam(Math.min(t, SETTLE[0]));
    const k = easeInOut(clamp((t - SETTLE[0]) / (SETTLE[1] - SETTLE[0])));
    const out = {};
    for (const b of TB) {
      const m = mats[b.part];
      out[b.id] = b.rs.map(([x, y]) => {
        const p = m.transformPoint(new DOMPoint(x, y));
        const ax = 540 + (PLACE.x + p.x * PLACE.s - c.x) * c.z;
        const ay = 960 + (PLACE.y + p.y * PLACE.s - c.y) * c.z;
        const bx = TOP.x + p.x * TOP.s;
        const by = TOP.y + p.y * TOP.s;
        return [lerp(ax, bx, k), lerp(ay, by, k)];
      });
    }
    return out;
  }
  const chickenScreen = {};
  for (const id of Object.keys(CB)) chickenScreen[id] = CB[id].map(([x, y]) => [BOT.x + x * BOT.s, BOT.y + y * BOT.s]);

  const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  const groupCentroid = (set, ids) => centroid(ids.map((id) => centroid(set[id])));

  function strokeBone(g, pts, closed) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (closed) g.closePath();
    g.stroke();
  }

  function drawSet(g, set, t, alpha, which) {
    for (const b of TB) {
      const gl = glowAmount(b.group, t);
      g.strokeStyle = gl > 0 ? `rgba(${lerp(241, 255, gl) | 0},${lerp(227, 207, gl) | 0},${lerp(194, 106, gl) | 0},${alpha * (b.far ? 0.45 : 1)})` : rgba(CREAM, alpha * (b.far ? 0.42 : 0.95));
      g.lineWidth = (b.far ? 1.3 : 1.8) + gl * 0.9;
      strokeBone(g, set[b.id], b.closed);
    }
    void which;
  }

  function glowAmount(group, t) {
    const e = GLOW_ORDER.find(([gname]) => gname === group);
    if (!e) return 0;
    return smoothstep(e[1], e[1] + 0.22, t) * (1 - 0.35 * smoothstep(e[1] + 0.4, e[1] + 0.9, t));
  }

  function draw(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(S, 0, 0, S, 0, 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // construction grid and ground lines
    const gk = smoothstep(48.4, 49.4, t);
    g.strokeStyle = rgba(LAV, 0.16 * gk);
    g.lineWidth = 0.7;
    for (let x = 60; x < 1080; x += 120) {
      g.beginPath();
      g.moveTo(x, 120);
      g.lineTo(x, 1560);
      g.stroke();
    }
    g.strokeStyle = rgba(LAV, 0.55 * gk);
    g.lineWidth = 1;
    strokePartial(g, [[60, TOP.y + 446 * TOP.s + 6], [1020, TOP.y + 446 * TOP.s + 6]], gk);
    const mk = smoothstep(MORPH[0], MORPH[1], t);
    strokePartial(g, [[60, BOT.y + 330 * BOT.s + 6], [1020, BOT.y + 330 * BOT.s + 6]], mk);

    const T = trexScreen(t);
    drawSet(g, T, t, 1, 'trex');
    // the copy that morphs into the chicken
    if (t > MORPH[0]) {
      const m = easeInOut(clamp((t - MORPH[0]) / (MORPH[1] - MORPH[0])));
      const C = {};
      for (const id of Object.keys(T)) C[id] = T[id].map((p, i) => [lerp(p[0], chickenScreen[id][i][0], m), lerp(p[1], chickenScreen[id][i][1], m)]);
      drawSet(g, C, t, smoothstep(MORPH[0], MORPH[0] + 0.25, t), 'chicken');
      // a sparkle rides the morph
      if (m < 1) sparkle(g, lerp(TOP.x, BOT.x, m) - 60, lerp(TOP.y, BOT.y, m) - 100, 10, '#d6d7ff', 1 - m * 0.5);
    }
    // matching bones: dashed lavender connectors from T. rex to chicken
    for (const [group, tg] of GLOW_ORDER) {
      const k = clamp((t - tg) / 0.35);
      if (k <= 0) continue;
      const a = groupCentroid(T, groups[group].filter((id) => !id.endsWith('Far')));
      const b = groupCentroid(chickenScreen, groups[group].filter((id) => !id.endsWith('Far')));
      g.save();
      g.strokeStyle = rgba('#b9baff', 0.75 * (1 - 0.4 * smoothstep(tg + 0.5, tg + 1, t)));
      g.lineWidth = 1.2;
      g.setLineDash([7, 6]);
      strokePartial(g, [a, b], easeInOut(k));
      g.setLineDash([]);
      g.restore();
      const pop = easeOutBack(clamp((t - tg) / 0.3), 2);
      g.strokeStyle = rgba(GOLD, 0.8);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(a[0], a[1], 26 * pop, 0, TAU);
      g.stroke();
      if (k >= 1) {
        g.beginPath();
        g.arc(b[0], b[1], 20 * pop, 0, TAU);
        g.stroke();
      }
      sparkle(g, a[0] + 26 * pop, a[1] - 4, 7, '#fff2c8', 1 - 0.5 * smoothstep(tg + 0.4, tg + 0.8, t));
      if (k >= 1) sparkle(g, b[0] + 20 * pop, b[1] - 4, 6, '#fff2c8', 1 - 0.5 * smoothstep(tg + 0.6, tg + 1.0, t));
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  return { draw };
}

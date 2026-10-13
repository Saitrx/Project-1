// 0:11-0:17 Prehistoric forest floor. A tiny furry mammal hides under a fern; the dinosaur's shadow
// passes, a huge three-toed foot stamps down beside it (dust, shaking fronds, camera shake), then
// lifts away. The mammal flinches, then peeks out again.
import { Layer, drawLayer, paintShape, smoothPath, tube, scales, stipple, scribble, hatch, rgba, shade, mix, INK, glossyBall } from '../kit/paint.js';
import { makeRng, makeNoise, clamp, lerp, smoothstep, keys, easeInOut, easeOut, TAU, wobble } from '../kit/util.js';
import { setCam, shakeOffset } from '../kit/cam.js';
import { fern, drawFern, trunk, cycad, leafLitter, grassTuft } from '../kit/plants.js';
import { buildMammal, drawMammal } from '../kit/mammal.js';

const LAND = 13.5; // foot touches down (footstep sound)
const LIFT = 15.0;
export const MAMMAL = { x: 300, y: 1352, s: 1.4 };

function buildFoot(res) {
  // Local origin: ground contact under the ball of the foot. Toes point left (toward the mammal).
  const L = new Layer(980, 1400, res, 560, 1250);
  const skin = '#6e6844';
  const parts = [];
  const leg = tube(
    [[150, -1250], [120, -900], [70, -560], [40, -300], [10, -120], [-30, -40]],
    (u) => {
      const w = lerp(150, 62, Math.pow(u, 0.8));
      return [w, w * 1.05];
    },
    40
  );
  const toe = (pts, w0, w1) => tube(pts, (u) => [lerp(w0, w1, u), lerp(w0, w1, u) * 1.1], 30, true);
  const outer = toe([[-20, -60], [-120, -95], [-230, -118], [-300, -122]], 46, 20);
  const middle = toe([[-40, -40], [-180, -40], [-330, -26], [-430, -14]], 58, 22);
  const inner = toe([[-30, -20], [-130, 10], [-240, 38], [-300, 52]], 54, 22);
  const back = toe([[60, -90], [110, -60], [140, -40]], 24, 10);
  const scaleOpts = (seed, size) => ({ size, base: skin, seed, contrast: 1.1 });
  const paint = (pts, seed, size, opts = {}) => {
    const path = smoothPath(pts, true);
    paintShape(L, path, {
      fill: opts.fill ?? skin,
      light: [-0.6, -1],
      shadowDepth: opts.depth ?? 70,
      shadowAlpha: 0.55,
      cross: true,
      hatchSpacing: 3,
      seed,
      before: (Lx) => {
        const b = { x: -560, y: -1250, w: 980, h: 1400 };
        scales(Lx.g, path, b, scaleOpts(seed + 1, size));
        stipple(Lx.g, path, b, { count: 9000, r: [0.4, 1.1], color: '#2a2414', alpha: 0.3, seed: seed + 2 });
      },
      after: opts.after,
    });
    return path;
  };
  paint(back, 401, 10, { depth: 26 });
  paint(outer, 402, 11, { fill: shade(skin, -0.12), depth: 36 });
  const legPath = paint(leg, 403, 15, { depth: 90 });
  // big scutes down the front of the metatarsus
  {
    const g = L.g;
    g.save();
    g.clip(legPath);
    for (let i = 0; i < 9; i++) {
      const y = -520 + i * 54;
      const x = lerp(40, -40, i / 8) - 30;
      g.fillStyle = rgba(shade(skin, 0.08 - i * 0.01));
      g.strokeStyle = rgba(INK, 0.7);
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, y, 52, 22, -0.25, 0, TAU);
      g.fill();
      g.stroke();
    }
    g.restore();
  }
  for (const [pts, seed, w] of [
    [middle, 404, 13],
    [inner, 405, 13],
  ]) {
    const p = paint(pts, seed, w, { depth: 40 });
    // scute bands across the toes
    const g = L.g;
    g.save();
    g.clip(p);
    g.strokeStyle = rgba(INK, 0.55);
    g.lineWidth = 1.2;
    const r = makeRng(seed);
    for (let k = 0; k < 9; k++) {
      const x = -60 - k * 40 + r.range(-6, 6);
      g.beginPath();
      g.moveTo(x, -200);
      g.quadraticCurveTo(x - 12, 0, x, 200);
      g.stroke();
    }
    g.restore();
  }
  // claws: dark, curved, glossy, pressing into the ground
  const claw = (x, y, a, len) => {
    const g = L.g;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    const p = smoothPath([[0, -14], [-len * 0.5, -16], [-len, 4], [-len * 0.55, 6], [0, 14]], true);
    const grd = g.createLinearGradient(0, -16, -len, 4);
    grd.addColorStop(0, '#4a3b2c');
    grd.addColorStop(1, '#1a1410');
    g.fillStyle = grd;
    g.fill(p);
    g.strokeStyle = 'rgba(255,245,225,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-len * 0.15, -12);
    g.quadraticCurveTo(-len * 0.5, -14, -len * 0.75, -6);
    g.stroke();
    g.strokeStyle = rgba(INK, 0.95);
    g.lineWidth = 1.2;
    g.stroke(p);
    g.restore();
  };
  claw(-292, -122, 0.1, 70);
  claw(-422, -14, 0.08, 86);
  claw(-292, 52, -0.1, 76);
  claw(138, -40, 2.4, 30);
  return L;
}

function buildBackdrop(S) {
  // far haze layer with pale trunks and cycad crowns
  const res = S * 1.15;
  const far = new Layer(1500, 1500, res, 210, 260);
  {
    const g = far.g;
    const sky = g.createLinearGradient(0, -260, 0, 1240);
    sky.addColorStop(0, '#efe2b6');
    sky.addColorStop(0.45, '#dcdcae');
    sky.addColorStop(1, '#bccaa0');
    g.fillStyle = sky;
    g.fillRect(-210, -260, 1500, 1500);
    // light shafts
    const rng = makeRng(501);
    for (let i = 0; i < 7; i++) {
      const x = rng.range(-100, 1150);
      const w = rng.range(40, 120);
      const grd = g.createLinearGradient(x, -260, x - 260, 1240);
      grd.addColorStop(0, 'rgba(255,248,215,0.35)');
      grd.addColorStop(1, 'rgba(255,248,215,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x, -260);
      g.lineTo(x + w, -260);
      g.lineTo(x + w - 380, 1240);
      g.lineTo(x - 380, 1240);
      g.fill();
    }
    for (let i = 0; i < 9; i++) {
      const tl = trunk(res, { h: 1350, w: rng.range(38, 70), color: mix('#a9b896', '#c7d0a9', rng.next()), seed: 510 + i });
      drawLayer(g, tl, -150 + i * 170 + rng.range(-40, 40), 1180);
    }
    for (let i = 0; i < 5; i++) {
      const c = cycad(res, { size: rng.range(150, 220), trunkH: rng.range(120, 260), color: '#93a878', seed: 520 + i, detail: 0 });
      drawLayer(g, c, -100 + i * 300 + rng.range(-60, 60), 1210);
    }
    // haze over the far layer
    const hz = g.createLinearGradient(0, 600, 0, 1240);
    hz.addColorStop(0, 'rgba(225,226,190,0)');
    hz.addColorStop(1, 'rgba(225,226,190,0.55)');
    g.fillStyle = hz;
    g.fillRect(-210, 600, 1500, 640);
  }
  // mid layer: darker trunks, tree ferns
  const mid = new Layer(1500, 1500, res, 210, 260);
  {
    const g = mid.g;
    const rng = makeRng(530);
    for (let i = 0; i < 4; i++) {
      const tl = trunk(res, { h: 1500, w: rng.range(80, 120), color: mix('#6f7a55', '#83886a', rng.next()), seed: 540 + i });
      drawLayer(g, tl, [-60, 300, 900, 1180][i], 1220);
    }
    for (let i = 0; i < 4; i++) {
      const c = cycad(res, { size: rng.range(220, 300), trunkH: rng.range(200, 380), color: '#6e8d50', seed: 550 + i });
      drawLayer(g, c, [80, 560, 760, 1100][i], 1225);
    }
  }
  // ground band with leaf litter
  const ground = new Layer(1600, 900, res * 1.05, 260, -1060);
  {
    const g = ground.g;
    const gr = g.createLinearGradient(0, 1080, 0, 1960);
    gr.addColorStop(0, '#8b8156');
    gr.addColorStop(0.25, '#7a6a42');
    gr.addColorStop(1, '#4c3d26');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-260, 1150);
    for (let x = -260; x <= 1340; x += 40) g.lineTo(x, 1140 + Math.sin(x * 0.013) * 12);
    g.lineTo(1340, 1960);
    g.lineTo(-260, 1960);
    g.fill();
    leafLitter(g, { x: -260, y: 1150, w: 1600, h: 810 }, { count: 3200, seed: 560, size: [5, 13] });
    stipple(g, null, { x: -260, y: 1150, w: 1600, h: 810 }, { count: 9000, r: [0.4, 1.2], color: '#2a1e10', alpha: 0.35, seed: 561 });
    for (let i = 0; i < 30; i++) {
      const r = makeRng(570 + i);
      grassTuft(g, r.range(-200, 1300), r.range(1150, 1250), r.range(20, 45), { count: 10, seed: 580 + i, color: '#8a9a55', dark: '#56693a' });
    }
    // dappled light on the ground
    const rng = makeRng(590);
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-150, 1250);
      const y = rng.range(1180, 1900);
      const rr = rng.range(30, 90);
      const d = g.createRadialGradient(x, y, 0, x, y, rr);
      d.addColorStop(0, 'rgba(255,240,190,0.28)');
      d.addColorStop(1, 'rgba(255,240,190,0)');
      g.save();
      g.translate(x, y);
      g.scale(1, 0.35);
      g.translate(-x, -y);
      g.fillStyle = d;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      g.restore();
    }
  }
  return { far, mid, ground };
}

export async function build(env) {
  const { S } = env;
  const zoomMax = 1.4;
  const back = buildBackdrop(S);
  const M = buildMammal(S * 1.6 * zoomMax);
  const foot = buildFoot(S * zoomMax);
  const hideFern = fern(S * 1.3, { size: 340, count: 10, seed: 21, spread: 2.5, base: -Math.PI / 2 - 0.35 });
  const sideFern = fern(S * 1.1, { size: 300, count: 9, seed: 22, spread: 2.6 });
  const fgFern = fern(S * 0.9, { size: 420, count: 7, seed: 23, spread: 2.2, colors: { front: '#3f6232', back: '#33532b', dark: '#1c3218', light: '#6d8f50' } });
  const fgFern2 = fern(S * 0.9, { size: 380, count: 6, seed: 24, spread: 2.0, colors: { front: '#3f6232', back: '#33532b', dark: '#1c3218', light: '#6d8f50' } });
  // dust puffs (seeded particles)
  const rng = makeRng(600);
  const dust = Array.from({ length: 34 }, () => ({ a: rng.range(Math.PI * 0.85, Math.PI * 2.15), sp: rng.range(60, 260), r: rng.range(18, 50), up: rng.range(20, 90), d: rng.range(0, 0.15) }));
  const flying = Array.from({ length: 24 }, () => ({ x: rng.range(-300, 120), vx: rng.range(-160, 160), vy: rng.range(-420, -160), rot: rng.range(-8, 8), c: rng.pick(['#a8793f', '#8d6233', '#c19356', '#6f5a2f']), s: rng.range(6, 12) }));

  function footPose(t) {
    // descend from above, touch down at LAND with a slight toe-first roll, then lift heel-first
    if (t < LAND) {
      const u = clamp((t - (LAND - 0.75)) / 0.75);
      const e = u * u;
      return { y: lerp(-1500, 0, e), rot: lerp(-0.22, 0, e), on: u > 0 };
    }
    if (t < LIFT) return { y: 0, rot: 0, on: true };
    const u = clamp((t - LIFT) / 0.9);
    const e = easeInOut(u);
    return { y: lerp(0, -1700, e * e), rot: lerp(0, 0.3, e), on: u < 1 };
  }

  function draw(g, t) {
    const impact = t - LAND;
    const shake = impact > 0 ? 9 * Math.exp(-impact * 6) : 0;
    const [sx, sy] = shakeOffset(t, shake, 3, 11);
    const push = smoothstep(10.6, 17.2, t);
    const cam = { x: 580 + push * 6 + sx, y: 1196 + push * 24 + sy, z: 1.28 + push * 0.1 };
    const layer = (f) => setCam(g, S, 540 + (cam.x - 540) * f, 960 + (cam.y - 960) * f, 1 + (cam.z - 1) * f);
    layer(0.3);
    drawLayer(g, back.far, 0, 0);
    layer(0.6);
    drawLayer(g, back.mid, 0, 0);
    layer(1);
    drawLayer(g, back.ground, 0, 0);
    // the dinosaur's shadow sweeps in before the foot and leaves after
    const sh = smoothstep(12.2, 13.2, t) * (1 - smoothstep(15.2, 16.2, t));
    if (sh > 0) {
      const sxp = lerp(1500, 760, smoothstep(12.2, 13.4, t)) - smoothstep(15.2, 16.2, t) * 900;
      const grd = g.createRadialGradient(sxp, 1300, 40, sxp, 1300, 620);
      grd.addColorStop(0, `rgba(30,24,14,${0.45 * sh})`);
      grd.addColorStop(1, 'rgba(30,24,14,0)');
      g.save();
      g.translate(sxp, 1300);
      g.scale(1, 0.42);
      g.translate(-sxp, -1300);
      g.fillStyle = grd;
      g.fillRect(sxp - 620, 680, 1240, 1240);
      g.restore();
      // overall dimming of the scene as it blots out the light
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = `rgba(20,16,8,${0.18 * sh})`;
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.restore();
      layer(1);
    }
    // side fern behind the foot area
    const sway = wobble(t, 7, 0.35) * 0.03;
    const fernShake = impact > 0 ? 0.09 * Math.exp(-impact * 3.5) : 0;
    drawFern(g, sideFern, 1010, 1262, 1, sway, fernShake * 0.7, t);
    const fp = footPose(t);
    const FX = 650;
    const FY = 1398;
    const drawFoot = () => {
      if (!fp.on) return;
      // contact shadow under the foot
      if (fp.y > -300) {
        const k = clamp(1 + fp.y / 300);
        g.fillStyle = `rgba(25,18,10,${0.5 * k})`;
        g.beginPath();
        g.ellipse(FX + 190, FY + 8, 360, 38, 0, 0, TAU);
        g.fill();
      }
      // mirrored so the toes point right; rolls about the toe tips
      g.save();
      g.translate(FX + 430, FY);
      g.rotate(-fp.rot);
      g.translate(-430, fp.y);
      g.scale(-1, 1);
      g.drawImage(foot.c, -foot.ox, -foot.oy, foot.w, foot.h);
      g.restore();
    };
    // dust burst and flying leaves at the impact
    if (impact > 0 && impact < 1.6) {
      for (const d of dust) {
        const u = clamp((impact - d.d) / 1.4);
        if (u <= 0) continue;
        const e = easeOut(u);
        const x = FX + 220 + Math.cos(d.a) * d.sp * e * 1.6;
        const y = FY - d.up * e - 10 + Math.sin(d.a) * 20 * e;
        const r = d.r * (0.6 + e * 1.4);
        const a = 0.42 * (1 - u) * smoothstep(0, 0.08, u);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(196,176,136,${a})`);
        grd.addColorStop(1, 'rgba(196,176,136,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      for (const f of flying) {
        const tt = impact;
        const x = FX + 300 + f.x + f.vx * tt;
        const y = FY - 5 + f.vy * tt + 0.5 * 900 * tt * tt;
        if (y > FY + 40) continue;
        g.save();
        g.translate(x, y);
        g.rotate(f.rot * tt);
        g.fillStyle = f.c;
        g.beginPath();
        g.ellipse(0, 0, f.s, f.s * 0.4, 0, 0, TAU);
        g.fill();
        g.strokeStyle = rgba(INK, 0.6);
        g.lineWidth = 0.5;
        g.stroke();
        g.restore();
      }
    }
    // the hiding fern arches over the mammal from behind; one low frond in front
    const frontFronds = hideFern.filter((f, i) => i === 1);
    const backFronds = hideFern.filter((f, i) => i !== 1);
    drawFern(g, backFronds, 395, 1318, 1.08, sway, fernShake, t);
    const flinch = impact > 0 ? Math.exp(-impact * 2.2) * smoothstep(0, 0.06, impact) : 0;
    const peek = smoothstep(15.6, 16.6, t);
    // soft contact shadow under the mammal
    g.fillStyle = 'rgba(30,20,10,0.35)';
    g.beginPath();
    g.ellipse(MAMMAL.x + 10, MAMMAL.y + 2, 120, 14, 0, 0, TAU);
    g.fill();
    drawMammal(g, M, {
      x: MAMMAL.x - flinch * 26 + peek * 18,
      y: MAMMAL.y,
      s: MAMMAL.s,
      breath: t * (0.9 + flinch * 2.5),
      headRot: -0.05 + Math.sin(t * 1.3) * 0.04 - peek * 0.1 + flinch * 0.1,
      blink: Math.max(clamp(1 - Math.abs(t - 12.1) / 0.09), clamp(1 - Math.abs(t - 16.3) / 0.09), clamp(1 - Math.abs(t - 13.53) / 0.06)),
      earBack: flinch,
      crouch: Math.min(1, flinch * 1.6),
      sniff: t < 12.4 || t > 15.8 ? t * 0.9 : 0,
      tailSway: Math.sin(t * 1.7),
    });
    drawFern(g, frontFronds, 395, 1318, 1.08, sway, fernShake, t);
    drawFoot();
    // dark foreground fronds framing the bottom corners
    layer(1.35);
    drawFern(g, fgFern, -40, 1700, 1.3, sway * 1.4, fernShake * 0.5, t);
    drawFern(g, fgFern2, 1130, 1760, 1.3, -sway * 1.3, fernShake * 0.5, t);
    // gentle vignette to keep captions readable
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = g.canvas.height;
    const W = g.canvas.width;
    const vg = g.createLinearGradient(0, H * 0.62, 0, H);
    vg.addColorStop(0, 'rgba(20,14,6,0)');
    vg.addColorStop(1, 'rgba(20,14,6,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.62, W, H * 0.38);
  }

  // Where the mammal is on screen (for the fossil inset that grows out of it).
  function mammalScreen(t) {
    const push = smoothstep(10.6, 17.2, t);
    const cam = { x: 580 + push * 6, y: 1196 + push * 24, z: 1.28 + push * 0.1 };
    const wx = MAMMAL.x + 18 * smoothstep(15.6, 16.6, t);
    const wy = MAMMAL.y - 40 * MAMMAL.s;
    return [540 + (wx - cam.x) * cam.z, 960 + (wy - cam.y) * cam.z];
  }

  return { draw, mammalScreen };
}

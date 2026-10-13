// 0:50-0:58.5 "In 1820, only 12% of people could read. Without schools, we slowly slide back."
// Diagram in the bee film's style: cream line art on dark brown. Two bar frames draw on; the 1820
// bar fills to 12%, the Today bar to 87%. On "Without schools..." the Today bar slowly drains (a
// dashed ghost line stays at 87%) while a circular inset shows a girl squinting up at a green
// LIBRARY street sign whose letters slowly tumble and scramble; she leans in, then scratches her
// head.
import { strokePartial, sparkle, hatch, stipple, INK } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOut, easeInOut, easeOutBack, TAU, rgba } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { ring, ripple, RING_BLUE } from '../kit/rings.js';
import { makePerson, drawPerson, pose, reach, headAt, groundShadow, toWorld, KID } from '../kit/person.js';
import { STAND, LEG, idle, keyPose } from '../kit/motion.js';
import { CAST } from './cast.js';
import { VO } from '../vo_timing.js';

const BG = '#1a110c';
const CREAM = '#f1e3c2';
const LAV = '#8e8fd6';
const GOLD = '#e8b04a';
const T0 = 50.0;
const T_SLIDE = VO[7].chunks[1].t; // "Without schools, we slowly slide back."

// chart geometry (design px); all text stays left of x 918 and above y 1536
const BASE = 735; // bar baseline
const TOP = 215; // 100% line
const BARS = [
  { x: 140, w: 228, label: '1820', pct: 12, draw: [50.45, 51.1], fill: [51.55, 52.45] },
  { x: 512, w: 228, label: 'Today', pct: 87, draw: [50.95, 51.6], fill: [52.75, 53.9] },
];
const levelY = (pct) => BASE - (BASE - TOP) * (pct / 100);

// the inset
const IN = { x: 450, y: 1075, r: 240, t0: 54.0 };
const WORD = 'LIBRARY';

export async function build(env) {
  const { S } = env;
  const girl = makePerson(CAST[4]);
  const rng = makeRng(808);
  // per-letter scramble parameters
  const order = [4, 0, 6, 2, 5, 1, 3]; // where each letter ends up
  const letters = [...WORD].map((ch, i) => ({
    ch,
    i,
    to: order[i],
    rot: rng.range(0.6, 2.6) * (rng.next() < 0.5 ? -1 : 1),
    flip: rng.next() < 0.55,
    dy: rng.range(-14, 14),
    delay: rng.range(0, 0.35),
  }));

  // the Today bar level over time (fills, then slowly drains on "slide back")
  function todayPct(t) {
    const f = easeOut(clamp((t - BARS[1].fill[0]) / (BARS[1].fill[1] - BARS[1].fill[0])));
    const drain = easeInOut(clamp((t - (T_SLIDE + 0.15)) / 3.6));
    return 87 * f - 41 * drain;
  }
  function barPct(b, t) {
    if (b.label === 'Today') return todayPct(t);
    return b.pct * easeOut(clamp((t - b.fill[0]) / (b.fill[1] - b.fill[0])));
  }

  function chart(g, t) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // faint gridlines at 25/50/75/100% and the baseline
    const gd = smoothstep(50.4, 51.0, t);
    for (const q of [25, 50, 75, 100]) {
      const y = levelY(q);
      g.strokeStyle = rgba(LAV, 0.28 * gd);
      g.lineWidth = 2;
      g.setLineDash([10, 12]);
      g.beginPath();
      g.moveTo(110, y);
      g.lineTo(lerp(110, 770, gd), y);
      g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = rgba(CREAM, 0.95);
    g.lineWidth = 4;
    strokePartial(g, [[90, BASE], [800, BASE]], smoothstep(50.3, 50.9, t));
    // a tiny open-book glyph above the chart (line art), drawn on
    const bk = smoothstep(50.5, 51.3, t);
    if (bk > 0) {
      g.save();
      g.translate(440, 125);
      g.strokeStyle = rgba(CREAM, 0.9);
      g.lineWidth = 3.5;
      const L = [[0, 10], [-28, -2], [-62, -4], [-80, 2], [-80, 40], [-62, 34], [-28, 36], [0, 48]];
      const R = L.map(([x, y]) => [-x, y]);
      strokePartial(g, L, bk);
      strokePartial(g, R, bk);
      strokePartial(g, [[0, 10], [0, 48]], bk);
      g.lineWidth = 2.5;
      g.strokeStyle = rgba(CREAM, 0.5 * bk);
      for (const k of [0, 1, 2]) {
        strokePartial(g, [[-66, 12 + k * 8], [-14, 18 + k * 8]], bk);
        strokePartial(g, [[66, 12 + k * 8], [14, 18 + k * 8]], bk);
      }
      g.restore();
    }
    for (const b of BARS) {
      const d = smoothstep(b.draw[0], b.draw[1], t);
      if (d <= 0) continue;
      const x0 = b.x;
      const x1 = b.x + b.w;
      // bar frame draws on (up the left, across, down the right)
      g.strokeStyle = rgba(CREAM, 0.9);
      g.lineWidth = 4;
      strokePartial(g, [[x0, BASE], [x0, TOP], [x1, TOP], [x1, BASE]], d);
      if (d >= 1 && t < b.draw[1] + 0.4) sparkle(g, x1, BASE, 12, '#ffe8b0', 1 - (t - b.draw[1]) / 0.4);
      // label under the bar
      const la = smoothstep(b.draw[0] + 0.2, b.draw[0] + 0.6, t);
      g.save();
      g.font = '600 68px "EBGaramond"';
      g.textAlign = 'center';
      g.fillStyle = rgba(CREAM, la * (b.label === 'Today' ? 1 - 0.25 * smoothstep(T_SLIDE, T_SLIDE + 2, t) : 1));
      g.fillText(b.label, x0 + b.w / 2, BASE + 76 + (1 - la) * 10);
      g.restore();
      // the fill: soft gold wash + diagonal hatching + stipple, top edge in gold
      const pct = barPct(b, t);
      if (pct > 0.05) {
        const y = levelY(pct);
        g.save();
        g.beginPath();
        g.rect(x0 + 6, y, b.w - 12, BASE - y - 2);
        g.clip();
        g.fillStyle = rgba(GOLD, 0.22);
        g.fillRect(x0, y, b.w, BASE - y);
        g.strokeStyle = rgba(GOLD, 0.75);
        g.lineWidth = 3;
        g.beginPath();
        for (let k = -b.w; k < BASE - TOP + b.w; k += 17) {
          g.moveTo(x0, BASE - k);
          g.lineTo(x1, BASE - k - b.w * 0.8);
        }
        g.stroke();
        g.restore();
        g.strokeStyle = GOLD;
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(x0 + 4, y);
        g.lineTo(x1 - 4, y);
        g.stroke();
        // the number rides on top of the fill
        g.save();
        g.font = '600 78px "EBGaramond"';
        g.textAlign = 'center';
        g.fillStyle = GOLD;
        g.fillText(`${Math.round(pct)}%`, x0 + b.w / 2, y - 22);
        g.restore();
      }
    }
    // on "slide back": a dashed ghost line stays at 87% and a soft arrow points down
    const sl = smoothstep(T_SLIDE + 0.1, T_SLIDE + 0.6, t);
    if (sl > 0) {
      const b = BARS[1];
      const y = levelY(87);
      g.strokeStyle = rgba(CREAM, 0.6 * sl);
      g.lineWidth = 3;
      g.setLineDash([12, 10]);
      g.beginPath();
      g.moveTo(b.x - 10, y);
      g.lineTo(b.x + b.w + 10, y);
      g.stroke();
      g.setLineDash([]);
      const ax = b.x + b.w + 52;
      const bob = Math.sin((t - T_SLIDE) * 3.2) * 6;
      const ya = levelY(80) + bob;
      const yb = levelY(52) + bob;
      g.strokeStyle = rgba(CREAM, 0.85 * sl);
      g.lineWidth = 5;
      strokePartial(g, [[ax, ya], [ax, yb]], sl);
      g.beginPath();
      g.moveTo(ax - 18, yb - 22);
      g.lineTo(ax, yb);
      g.lineTo(ax + 18, yb - 22);
      g.globalAlpha = sl;
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  // ---- inset: girl and the street sign ----
  function signLetters(g, t) {
    const s = clamp((t - (T_SLIDE + 0.5)) / 2.6);
    g.font = '600 54px "EBGaramond"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const step = 33;
    const x0 = -step * 3;
    for (const L of letters) {
      const u = easeInOut(clamp((s - L.delay) / 0.65));
      const x = lerp(x0 + L.i * step, x0 + L.to * step, u);
      const wob = Math.sin(t * 5 + L.i * 1.7) * 0.15 * u;
      g.save();
      g.translate(x, L.dy * u);
      g.rotate(L.rot * u + wob);
      if (L.flip) g.scale(Math.cos(Math.PI * u), 1);
      g.fillStyle = '#f4f1e6';
      g.fillText(L.ch, 0, 2);
      g.restore();
    }
    g.textBaseline = 'alphabetic';
  }

  function insetScene(g, t, R) {
    // warm afternoon behind, a sidewalk at the bottom
    const sk = g.createLinearGradient(0, -R, 0, R);
    sk.addColorStop(0, '#f2d7b0');
    sk.addColorStop(0.65, '#f6e6c6');
    sk.addColorStop(1, '#efdcb8');
    g.fillStyle = sk;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    // distant faint houses
    g.fillStyle = 'rgba(160,120,110,0.25)';
    for (const [x, w, h] of [[-230, 120, 150], [-110, 100, 110], [120, 140, 130]]) {
      g.fillRect(x, 200 - h - 40, w, h);
      g.beginPath();
      g.moveTo(x - 8, 200 - h - 40);
      g.lineTo(x + w / 2, 200 - h - 95);
      g.lineTo(x + w + 8, 200 - h - 40);
      g.fill();
    }
    g.fillStyle = '#cfc5b0';
    g.fillRect(-R, 160, 2 * R, R);
    g.strokeStyle = 'rgba(90,80,70,0.5)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-R, 160);
    g.lineTo(R, 160);
    g.stroke();
    stipple(g, null, { x: -R, y: 160, w: 2 * R, h: R }, { count: 260, r: [0.8, 1.6], color: '#6a6050', alpha: 0.35, seed: 81 });
    // sign post
    const px = 92;
    g.fillStyle = '#5c6a72';
    g.fillRect(px - 7, -72, 14, 262);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeRect(px - 7, -72, 14, 262);
    groundShadow(g, px + 10, 190, 40, 0.3);
    // the green street sign
    g.save();
    g.translate(36, -118);
    g.rotate(-0.025);
    const sw = 270;
    const sh = 86;
    g.fillStyle = '#2f7a4f';
    g.beginPath();
    g.roundRect(-sw / 2, -sh / 2, sw, sh, 10);
    g.fill();
    g.strokeStyle = '#f4f1e6';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(-sw / 2 + 7, -sh / 2 + 7, sw - 14, sh - 14, 7);
    g.stroke();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(-sw / 2, -sh / 2, sw, sh, 10);
    g.stroke();
    hatch(g, { x: -sw / 2, y: -sh / 2, w: sw, h: sh }, { angle: -0.9, spacing: 5, width: 1.2, color: '#123a22', alpha: 0.18, seed: 82, broken: 0.6 });
    signLetters(g, t);
    g.restore();
    // the girl, three-quarter view looking up at it
    const LOOK = { ...STAND, x: -112, y: 192 - LEG(KID) * 2.7, flip: 1, sc: 2.7, fv: 0.3, turn: 0.2, spine: -0.1, neck: -0.85, roll: 0 };
    const LEAN = { ...LOOK, spine: 0.12, neck: -0.95, hunch: 0.1, roll: 0.06 };
    const PUZZLED = { ...LOOK, spine: -0.02, neck: -0.6, roll: -0.32, fv: 0.45 };
    const tl = T_SLIDE + 0.45;
    let p = pose(keyPose([[IN.t0, LOOK], [tl, LOOK], [tl + 0.7, LEAN], [tl + 1.4, LEAN], [tl + 2.0, PUZZLED]], t));
    p = idle(p, t, 5, 0.8);
    const h = headAt(girl, p);
    const lean = smoothstep(tl, tl + 0.7, t);
    const puz = smoothstep(tl + 1.4, tl + 2.0, t);
    // near hand shades the eyes while he leans in; then a puzzled shrug, palms up
    if (lean > 0.02) {
      const vx = h.x + h.r * 1.05;
      const vy = h.y - h.r * 0.8;
      const arc = Math.sin(Math.PI * lean) * h.r * 1.1;
      reach(girl, p, 'N', lerp(h.x + h.r * 1.2, vx, lean) + arc, lerp(h.y + h.r * 2.6, vy, lean), -1);
    }
    if (puz > 0) {
      const sh = puz * (0.75 + 0.2 * Math.sin((t - tl - 1.4) * 5) * Math.exp(-(t - tl - 1.4)));
      p.shrug = Math.max(p.shrug, sh);
      p.aN = lerp(p.aN, 0.4, puz);
      p.eN = lerp(p.eN, 1.4, puz);
      p.aF = lerp(p.aF, -0.35, puz);
      p.eF = lerp(p.eF, -1.3, puz);
    }
    groundShadow(g, -104, 194, 70, 0.3);
    drawPerson(g, girl, p, { t, light: [0.6, -0.8] });
    // little confusion swirls above her head
    if (puz > 0) {
      const [hx, hy] = toWorld(p, [h.x, h.y]);
      const hr = h.r * p.sc;
      g.strokeStyle = rgba(INK, 0.75 * puz);
      g.lineWidth = 4;
      g.lineCap = 'round';
      for (const k of [0, 1]) {
        const cx = hx - hr * 1.15 - k * 34;
        const cy = hy - hr * 1.75 + k * 6;
        const sp = t * (k ? -4 : 4);
        g.beginPath();
        for (let a = 0; a < 5.2; a += 0.2) {
          const rr = 3 + a * 3.8;
          const x = cx + Math.cos(a + sp) * rr;
          const y = cy + Math.sin(a + sp) * rr * 0.7;
          if (a === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }

  function inset(g, t) {
    const a = t - IN.t0;
    if (a < 0) return;
    const pop = a < 0.5 ? easeOutBack(clamp(a / 0.45), 1.6) : 1;
    const R = IN.r;
    g.save();
    g.translate(IN.x, IN.y);
    g.scale(pop, pop);
    const sg = g.createRadialGradient(14, 22, R * 0.8, 14, 22, R * 1.12);
    sg.addColorStop(0, 'rgba(0,0,0,0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(14, 22, R * 1.12, 0, TAU);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.clip();
    insetScene(g, t, R);
    g.restore();
    ring(g, 0, 0, R, { width: 6, color: RING_BLUE });
    g.restore();
    ripple(g, IN.x, IN.y, t, IN.t0 + 0.05, { rMax: R * 1.7, dur: 1.0, width: 4, count: 1 });
  }

  function draw(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    // warm soft glow behind the chart
    g.setTransform(S, 0, 0, S, 0, 0);
    const gl = g.createRadialGradient(480, 480, 60, 480, 480, 720);
    gl.addColorStop(0, 'rgba(90,60,40,0.35)');
    gl.addColorStop(1, 'rgba(90,60,40,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, 1080, 1920);
    const z = 1 + (t - T0) * 0.005;
    setCam(g, S, 540, 960, z);
    chart(g, t);
    inset(g, t);
  }
  return { draw };
}

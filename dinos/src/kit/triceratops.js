// Triceratops, side view facing left. Origin at the hip; about 900 long, hip about 262 above ground.
import { buildCreature, drawCreature, glossyBall, rgba, shade, INK } from './creature.js';
import { smoothPath } from './paint.js';
import { makeRng } from './util.js';

const SKIN = '#9a7c50';
const FAR = '#7a6140';
export const TRIKE_GROUND = 262;

function horn(g, x0, y0, x1, y1, w) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  const p = new Path2D();
  p.moveTo(x0 + nx * w, y0 + ny * w);
  p.quadraticCurveTo((x0 + x1) / 2 + nx * w * 0.6 - dy * 0.06, (y0 + y1) / 2 + ny * w * 0.6 + dx * 0.06, x1, y1);
  p.quadraticCurveTo((x0 + x1) / 2 - nx * w * 0.6 - dy * 0.06, (y0 + y1) / 2 - ny * w * 0.6 + dx * 0.06, x0 - nx * w, y0 - ny * w);
  p.closePath();
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#d9c9a1');
  gr.addColorStop(0.7, '#efe3c4');
  gr.addColorStop(1, '#5b4a35');
  g.fillStyle = gr;
  g.fill(p);
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 1.2;
  g.stroke(p);
  // growth lines
  g.strokeStyle = rgba('#8a7552', 0.6);
  g.lineWidth = 0.8;
  for (let k = 1; k < 5; k++) {
    const u = k / 6;
    const cx = x0 + dx * u;
    const cy = y0 + dy * u;
    const ww = w * (1 - u) * 0.9;
    g.beginPath();
    g.moveTo(cx + nx * ww, cy + ny * ww);
    g.quadraticCurveTo(cx + dx * 0.03, cy + dy * 0.03, cx - nx * ww, cy - ny * ww);
    g.stroke();
  }
}

export function trikeDef() {
  const leg = (suf, fill, z, ax, front) => [
    { name: 'upper' + suf, parent: 'body', at: [ax, 30], z, fill, pts: front ? [[36, -60], [-34, -64], [-48, 20], [-38, 104], [26, 108], [40, 30]] : [[52, -80], [-30, -84], [-56, 0], [-42, 104], [30, 108], [50, 20]], shadowDepth: 30, outlineAlpha: 0.6 },
    {
      name: 'lower' + suf,
      parent: 'upper' + suf,
      at: [-6, 100],
      z: z - 0.1,
      fill,
      pts: [[30, -12], [-30, -12], [-34, 70], [-46, 98], [44, 98], [36, 60]],
      shadowDepth: 18,
      extra: (g) => {
        // toenails
        for (const x of [-38, -14, 10, 32]) {
          g.fillStyle = '#d8c8a0';
          g.beginPath();
          g.ellipse(x, 96, 9, 5, 0, Math.PI, 0);
          g.fill();
          g.strokeStyle = rgba(INK, 0.8);
          g.lineWidth = 0.8;
          g.stroke();
        }
      },
    },
  ];
  const parts = [
    { name: 'tail', parent: 'body', at: [136, -36], z: 0.5, pts: [[-10, -40], [120, -22], [236, 2], [248, 10], [120, 30], [-10, 46]], stripes: { color: '#5a4529', gap: 40, w: 12, len: 0.4, alpha: 0.4 }, shadowDepth: 20 },
    ...leg('FarH', FAR, 0.3, 50, false),
    ...leg('FarF', FAR, 0.31, -250, true),
    {
      name: 'body',
      z: 1,
      pts: [[150, -30], [110, -112], [0, -152], [-150, -152], [-280, -124], [-336, -76], [-346, 10], [-302, 72], [-200, 100], [-60, 102], [60, 84], [140, 34]],
      stripes: { color: '#5a4529', gap: 56, w: 18, len: 0.3, alpha: 0.42 },
      shadowDepth: 70,
    },
    {
      name: 'head',
      parent: 'body',
      at: [-318, -60],
      z: 1.4,
      pts: [[64, -150], [10, -212], [-56, -206], [-104, -152], [-146, -96], [-200, -62], [-250, -32], [-278, 0], [-264, 28], [-220, 38], [-150, 42], [-80, 54], [-20, 64], [40, 44], [84, -40]],
      fill: '#a88859',
      shadowDepth: 40,
      extra: (g, path) => {
        // frill pattern: pale band and dark rosettes, then the bony rim knobs
        g.save();
        g.clip(path);
        g.fillStyle = 'rgba(232,206,150,0.5)';
        g.beginPath();
        g.ellipse(4, -120, 70, 90, -0.4, 0, Math.PI * 2);
        g.fill();
        const r = makeRng(77);
        for (let i = 0; i < 9; i++) {
          const a = -2.6 + i * 0.34;
          const x = 6 + Math.cos(a) * 62;
          const y = -110 + Math.sin(a) * 78;
          g.fillStyle = 'rgba(90,62,36,0.55)';
          g.beginPath();
          g.ellipse(x, y, 10 + r.range(-2, 3), 7, a, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
        // bony knobs sitting on the frill rim (along the outline from the back of the frill over the top)
        const rim = [[78, -96], [64, -150], [10, -212], [-56, -206], [-104, -152]];
        const segs = [];
        let total = 0;
        for (let k = 1; k < rim.length; k++) {
          const l = Math.hypot(rim[k][0] - rim[k - 1][0], rim[k][1] - rim[k - 1][1]);
          segs.push(l);
          total += l;
        }
        for (let i = 0; i < 13; i++) {
          let d = ((i + 0.5) / 13) * total;
          let k = 0;
          while (d > segs[k]) {
            d -= segs[k];
            k++;
          }
          const f = d / segs[k];
          const ax = rim[k][0] + (rim[k + 1][0] - rim[k][0]) * f;
          const ay = rim[k][1] + (rim[k + 1][1] - rim[k][1]) * f;
          // outward normal of the rim (points away from the frill centre)
          let nx = ax - 6;
          let ny = ay + 110;
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl;
          ny /= nl;
          const tx = -ny;
          const ty = nx;
          g.fillStyle = '#c9b184';
          g.beginPath();
          g.moveTo(ax + tx * 8 - nx * 3, ay + ty * 8 - ny * 3);
          g.lineTo(ax + nx * 13, ay + ny * 13);
          g.lineTo(ax - tx * 8 - nx * 3, ay - ty * 8 - ny * 3);
          g.closePath();
          g.fill();
          g.strokeStyle = rgba(INK, 0.8);
          g.lineWidth = 0.8;
          g.stroke();
        }
        // beak, cheek, eye, horns
        g.fillStyle = '#3e3022';
        g.beginPath();
        g.moveTo(-246, -30);
        g.quadraticCurveTo(-290, -10, -282, 12);
        g.quadraticCurveTo(-266, 30, -232, 30);
        g.quadraticCurveTo(-246, 6, -246, -30);
        g.fill();
        g.strokeStyle = rgba(INK, 0.8);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-226, 18);
        g.quadraticCurveTo(-170, 30, -100, 24);
        g.stroke();
        glossyBall(g, -112, -64, 7.5, { color: '#2a1a0e', ring: '#5a3a1c' });
        g.strokeStyle = rgba(INK, 0.8);
        g.lineWidth = 3;
        g.beginPath();
        g.arc(-112, -64, 12, Math.PI * 1.1, Math.PI * 1.85);
        g.stroke();
        horn(g, -128, -100, -238, -214, 12);
        horn(g, -230, -36, -258, -82, 9);
      },
    },
    ...leg('NearH', SKIN, 2.2, 36, false),
    ...leg('NearF', SKIN, 2.1, -262, true),
  ];
  return { fill: SKIN, belly: '#d8c49a', bellyFrom: 0.55, scale: 7.5, seed: 91, light: [-0.4, -1], parts };
}

export function buildTrike(res) {
  return buildCreature(res, trikeDef());
}

export function trikePose(t, extra = {}) {
  const br = Math.sin(t * 1.4);
  return {
    body: br * 0.006,
    body_s: [1, 1 + br * 0.012],
    tail: Math.sin(t * 0.8) * 0.06,
    head: (extra.head ?? 0) + Math.sin(t * 0.6) * 0.02,
    upperNearF: extra.step ?? 0,
    lowerNearF: -(extra.step ?? 0) * 0.6,
  };
}

export { drawCreature };

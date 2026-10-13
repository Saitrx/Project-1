// The film: which scene(s) draw at time t, the transitions between them, paper grain, and the
// caption layer on top. render(n) is a pure function of the frame number.
import { canvas, paperGrain } from './kit/paint.js';
import { drawCaptions } from './captions.js';
import { drawCover } from './cover.js';
import { clamp, smoothstep, easeInOut } from './kit/util.js';

export const FPS = 30;
export const DURATION = 60;

const MODULES = {
  space: () => import('./scenes/s01_space.js'),
  globe: () => import('./scenes/s02_globe.js'),
  forest: () => import('./scenes/s03_forest.js'),
  fossil: () => import('./scenes/s04_fossil.js'),
  city: () => import('./scenes/s05_city.js'),
  airport: () => import('./scenes/s06_airport.js'),
  farm: () => import('./scenes/s07_farm.js'),
  trex: () => import('./scenes/s08_trex.js'),
  skeleton: () => import('./scenes/s09_skeleton.js'),
  sidewalk: () => import('./scenes/s10_sidewalk.js'),
};

// [t0, t1, plan]. A plan is a scene id, or a transition {kind, a, b, ...} over [t0, t1].
const TIMELINE = [
  [0, 4.55, 'space'],
  [4.55, 5.45, { kind: 'dissolve', a: 'space', b: 'globe' }],
  [5.45, 10.55, 'globe'],
  [10.55, 11.35, { kind: 'iris', a: 'globe', b: 'forest' }],
  [11.35, 17.0, 'forest'],
  [17.0, 22.55, 'fossil'],
  [22.55, 23.45, { kind: 'shrink', a: 'fossil', b: 'city' }],
  [23.45, 29.6, 'city'],
  [29.6, 30.4, { kind: 'dissolve', a: 'city', b: 'airport' }],
  [30.4, 35.65, 'airport'],
  [35.65, 36.35, { kind: 'dissolve', a: 'airport', b: 'farm' }],
  [36.35, 41.65, 'farm'],
  [41.65, 42.35, { kind: 'dissolve', a: 'farm', b: 'trex' }],
  [42.35, 47.6, 'trex'],
  [47.6, 48.6, { kind: 'lineart', a: 'trex', b: 'skeleton' }],
  [48.6, 53.6, 'skeleton'],
  [53.6, 54.5, { kind: 'dissolve', a: 'skeleton', b: 'sidewalk' }],
  [54.5, 60.01, 'sidewalk'],
];

export async function buildFilm({ W, H, g, params }) {
  const S = W / 1080;
  const env = { W, H, S, params, scenes: null };
  const built = {};
  const get = async (id) => {
    if (!built[id]) {
      const t0 = performance.now();
      built[id] = await (await MODULES[id]()).build(env);
      console.log(`built ${id} in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    }
    return built[id];
  };
  env.get = get;
  const grain = paperGrain(W, H, 9, { speckle: !params.has('nospeckle') });
  const text = canvas(W, H);
  const tg = text.getContext('2d');
  const bufs = [canvas(W, H), canvas(W, H)].map((c) => c.getContext('2d'));
  const only = params.get('only');

  function reset(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingQuality = 'high';
  }

  async function drawScene(ctx, id, t) {
    const sc = await get(id);
    reset(ctx);
    ctx.save();
    sc.draw(ctx, t);
    ctx.restore();
    reset(ctx);
  }

  async function render(n) {
    const t = n / FPS;
    reset(g);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const seg = TIMELINE.find(([a, b]) => t >= a && t < b) ?? TIMELINE[TIMELINE.length - 1];
    const [t0, t1, plan] = seg;
    if (only) await drawScene(g, only, t);
    else if (typeof plan === 'string') await drawScene(g, plan, t);
    else {
      const u = clamp((t - t0) / (t1 - t0));
      const A = await get(plan.a);
      const B = await get(plan.b);
      if (plan.kind === 'dissolve' || plan.kind === 'lineart') {
        // B owns the line-art hand-off when it has one (e.g. the T. rex becoming its skeleton).
        await drawScene(g, plan.a, t);
        const b = bufs[0];
        reset(b);
        b.clearRect(0, 0, W, H);
        await drawScene(b, plan.b, t);
        g.globalAlpha = easeInOut(u);
        g.drawImage(b.canvas, 0, 0);
        reset(g);
      } else if (plan.kind === 'iris') {
        // A circle opens from A's focus point (A.irisFrom(t)) and reveals B.
        await drawScene(g, plan.a, t);
        const b = bufs[0];
        reset(b);
        b.clearRect(0, 0, W, H);
        await drawScene(b, plan.b, t);
        const [fx, fy, r0] = A.irisFrom ? A.irisFrom(t) : [540, 960, 0];
        const e = easeInOut(u);
        const cx = (fx + (540 - fx) * e) * S;
        const cy = (fy + (960 - fy) * e) * S;
        const r = (r0 + (1200 - r0) * Math.pow(u, 1.6)) * S;
        g.save();
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.clip();
        g.drawImage(b.canvas, 0, 0);
        g.restore();
        // thin cream ring on the opening edge, like the reference's insets
        g.strokeStyle = `rgba(243,230,200,${0.9 * (1 - u)})`;
        g.lineWidth = 3 * S;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
        reset(g);
      } else if (plan.kind === 'shrink') {
        // B underneath; A provides its own hand-off drawing (inset shrinking into B's sun).
        await drawScene(g, plan.b, t);
        reset(g);
        g.save();
        A.drawShrink(g, t, u, B);
        g.restore();
        reset(g);
      }
    }
    // Paper grain over everything, then the captions on their own layer.
    if (!params.has('nograin')) g.drawImage(grain, 0, 0);
    if (!params.has('notext')) {
      drawCaptions(tg, S, t);
      g.drawImage(text, 0, 0);
    }
    if (params.has('cover')) drawCover(g, S);
  }

  return { render, get, S };
}

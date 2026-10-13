// The film: which scene draws at time t, the transitions between scenes, the anti-banding grain,
// the paper grain, and the caption layer on top. render(n) is a pure function of the frame number.
import { canvas, paperGrain } from './kit/paint.js';
import { drawCaptions } from './captions.js';
import { clamp, easeInOut } from './kit/util.js';
import { TIMELINE, FPS, DURATION } from './timeline.js';

export { FPS, DURATION };

const MODULES = {
  classroom: () => import('./scenes/s01_classroom.js'),
  field: () => import('./scenes/s02_field.js'),
  montage: () => import('./scenes/s05_montage.js'),
  globe: () => import('./scenes/s06_globe.js'),
  curb: () => import('./scenes/s07_curb.js'),
  literacy: () => import('./scenes/s08_literacy.js'),
  future: () => import('./scenes/s09_future.js'),
  sad: () => import('./scenes/s10_sad.js'),
  ending: () => import('./scenes/s11_ending.js'),
  rigtest: () => import('./scenes/rigtest.js'),
};

// Fine seeded luminance dither over the whole frame (screen space, changes every frame with a
// seeded offset) so big soft gradients don't band after compression.
function ditherTile(seed) {
  const N = 256;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  let s = seed >>> 0;
  for (let i = 0; i < N * N; i++) {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    const v = (s & 255) / 255;
    const o = i * 4;
    const light = v > 0.5;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = light ? 255 : 0;
    img.data[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * 7);
  }
  g.putImageData(img, 0, 0);
  return c;
}

export async function buildFilm({ W, H, g, params }) {
  const S = W / 1080;
  const env = { W, H, S, params };
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
  const dither = ditherTile(5);
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
    await sc.draw(ctx, t);
    ctx.restore();
    reset(ctx);
  }

  async function sceneInto(i, id, t) {
    const b = bufs[i];
    reset(b);
    b.clearRect(0, 0, W, H);
    await drawScene(b, id, t);
    return b.canvas;
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
      if (plan.kind === 'dissolve') {
        await drawScene(g, plan.a, t);
        const b = await sceneInto(0, plan.b, t);
        g.globalAlpha = easeInOut(u);
        g.drawImage(b, 0, 0);
        reset(g);
      } else if (plan.kind === 'custom') {
        // The outgoing scene owns the hand-off: A.handoff(g, t, u, drawB) draws both.
        const A = await get(plan.a);
        await get(plan.b);
        const b = await sceneInto(0, plan.b, t);
        const a = await sceneInto(1, plan.a, t);
        reset(g);
        g.save();
        await A.handoff(g, t, u, a, b, S);
        g.restore();
        reset(g);
      }
    }
    // Paper grain and a fine dither over everything, then the captions on their own layer.
    if (!params.has('nograin')) {
      g.drawImage(grain, 0, 0);
      const pat = g.createPattern(dither, 'repeat');
      const ox = (n * 97) % 256;
      const oy = (n * 57) % 256;
      g.translate(-ox, -oy);
      g.fillStyle = pat;
      g.fillRect(0, 0, W + 256, H + 256);
      reset(g);
    }
    if (!params.has('notext')) {
      drawCaptions(tg, S, t, params);
      g.drawImage(text, 0, 0);
    }
  }

  return { render, get, S };
}

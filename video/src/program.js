// Ties the scenes to the script timeline: picks the shots for a frame, handles dissolves and
// fades to black, and draws the HUD and captions on the 4K overlay.
import { SCENES, DISSOLVE, BLACK_FADE, FPS } from './timeline.js';
import { drawHUD, drawCaptions, drawTitle, drawEndCard, drawCode, titleAlpha, endAlpha } from './overlay.js';
import { setMaxAniso } from './kit/textures.js';
import { bakeEarth } from './kit/earth.js';
import { smoothstep } from './util.js';

export async function buildProgram(engine) {
  setMaxAniso(engine.maxAniso);
  const params = new URLSearchParams(location.search);
  const only = params.get('scenes')?.split(',');
  const ctx = {
    engine,
    renderer: engine.renderer,
    W: engine.W,
    H: engine.H,
    pxScale: engine.H / 1920,
    earth: await bakeEarth(engine.renderer, engine.maxAniso),
  };
  const impl = {};
  for (const s of SCENES) {
    if (s.black || (only && !only.includes(s.id))) continue;
    const mod = await import(`./scenes/${s.id}.js`);
    impl[s.id] = await mod.build(ctx);
  }
  const live = (s) => s && !s.black && impl[s.id];
  // The dominant shot of a scene at local time lt.
  const mainShot = (s, lt) => {
    const list = impl[s.id].shotsAt(lt);
    return list.reduce((a, b) => (b.w > a.w ? b : a)).shot;
  };

  function sceneIndex(t) {
    for (let i = 0; i < SCENES.length; i++) if (t < SCENES[i].end) return i;
    return SCENES.length - 1;
  }

  function render(n) {
    const t = n / FPS;
    const i = sceneIndex(t);
    const cur = SCENES[i];
    const prev = SCENES[i - 1];
    const next = SCENES[i + 1];
    const k = engine.W / 1080;
    const g = engine.overlayCtx;

    let shots = [];
    if (live(cur)) {
      const lt = t - cur.start;
      let fade = 1;
      if (prev && prev.black) fade *= smoothstep(cur.start, cur.start + BLACK_FADE, t);
      if (next && next.black) fade *= 1 - smoothstep(cur.end - BLACK_FADE, cur.end, t);
      const h = DISSOLVE / 2;
      if (live(prev) && t < cur.start + h) {
        const w = 1 - smoothstep(cur.start - h, cur.start + h, t);
        shots = [{ shot: mainShot(prev, t - prev.start), w, fade: 1 }, { shot: mainShot(cur, lt), w: 1 - w, fade }];
      } else if (live(next) && t > cur.end - h) {
        const w = smoothstep(cur.end - h, cur.end + h, t);
        shots = [{ shot: mainShot(next, t - next.start), w, fade: 1 }, { shot: mainShot(cur, lt), w: 1 - w, fade }];
      } else {
        shots = impl[cur.id].shotsAt(lt).map((s) => ({ ...s, fade }));
      }
      // Shots are listed so that the one blended in via the "prev" buffer comes first.
      shots.sort((a, b) => a.w - b.w);
    }

    g.clearRect(0, 0, engine.W, engine.H);
    if (cur.id === 'button') drawTitle(g, k, titleAlpha(t));
    if (cur.id === 'code') drawCode(g, k, t);
    if (cur.counter) {
      let a = 1;
      if (!prev || !prev.counter) a *= smoothstep(cur.start, cur.start + 0.4, t);
      if (!next || !next.counter) a *= 1 - smoothstep(cur.end - 0.4, cur.end, t);
      drawHUD(g, k, { value: cur.counter, sub: cur.sub, alpha: a });
    }
    drawCaptions(g, k, t);
    if (cur.id === 'end') drawEndCard(g, k, endAlpha(t));

    if (shots.length === 0) {
      engine.presentBlack(n);
    } else if (shots.length === 1) {
      engine.renderShot(shots[0].shot, false, n, shots[0].fade);
      engine.present(0, n);
    } else {
      engine.renderShot(shots[0].shot, true, n, shots[0].fade);
      engine.renderShot(shots[1].shot, false, n, shots[1].fade);
      engine.present(shots[0].w, n);
    }
  }

  return { render };
}

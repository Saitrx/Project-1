import { Engine } from './engine.js';
import { FONTS } from './overlay.js';

const canvas = document.getElementById('out');
const params = new URLSearchParams(location.search);
let engine;
let program;

window.__setup = async (W, H) => {
  // Real fonts only: load every face used, then wait for the font set to settle.
  await Promise.all(FONTS.map((f) => document.fonts.load(f, 'What if 0123456789×')));
  await document.fonts.ready;
  for (const f of FONTS) {
    if (!document.fonts.check(f)) throw new Error(`font not loaded: ${f}`);
  }
  engine = new Engine(canvas, W, H);
  const { buildProgram } = await import('./program.js');
  program = await buildProgram(engine, params);
};

// Draw exactly frame n. Everything visible is a pure function of n.
window.renderFrame = (n) => program.render(n);

const inflight = new Set();
window.__capture = async (n, url) => {
  const gl = engine.renderer.getContext();
  const one = new Uint8Array(4);
  const t0 = performance.now();
  window.renderFrame(n);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
  const t1 = performance.now();
  const px = engine.readPixels();
  const job = ws ? sendWs(n, px) : Promise.resolve();
  inflight.add(job);
  job.catch(() => {}).finally(() => inflight.delete(job));
  while (inflight.size > 2) await Promise.race(inflight);
  if (params.has('profile')) console.log(`frame ${n}: render ${(t1 - t0) | 0}ms total ${(performance.now() - t0) | 0}ms`);
};
window.__flush = () => Promise.all(inflight);

let ws;
const acks = new Map();
function sendWs(n, px) {
  return new Promise((resolve, reject) => {
    acks.set(n, { resolve, reject });
    ws.send(new Blob([new Uint32Array([n]), px]));
  });
}
window.__connect = (url) =>
  new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error('ws error'));
    ws.onmessage = (e) => {
      const [n, ok] = String(e.data).split(':');
      const a = acks.get(Number(n));
      if (!a) return;
      acks.delete(Number(n));
      ok === 'ok' ? a.resolve() : a.reject(new Error(e.data));
    };
  });

window.__ready = true;

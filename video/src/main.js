import { Engine } from './engine.js';

const canvas = document.getElementById('out');
const params = new URLSearchParams(location.search);
let engine;
let program;

window.__setup = async (W, H) => {
  await Promise.all([
    document.fonts.load('400 100px Serif4'),
    document.fonts.load('italic 400 100px Serif4'),
    document.fonts.load('600 100px Serif4'),
    document.fonts.load('500 100px PlexSans'),
    document.fonts.load('600 100px PlexSans'),
    document.fonts.load('500 100px PlexMono'),
  ]);
  engine = new Engine(canvas, W, H);
  const { buildProgram } = await import('./program.js');
  program = await buildProgram(engine);
};

// Draw exactly frame n. Everything visible is a pure function of n.
window.renderFrame = (n) => program.render(n);

// Uploads run in the background so the next frame can render while pixels transfer.
const inflight = new Set();
window.__capture = async (n, url) => {
  const gl = engine.renderer.getContext();
  const one = new Uint8Array(4);
  const t0 = performance.now();
  window.renderFrame(n);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
  const t1 = performance.now();
  const px = engine.readPixels();
  let job;
  if (params.has('nopost')) job = Promise.resolve();
  else if (ws) job = sendWs(n, px);
  else
    job = fetch(url, { method: 'POST', body: px }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text());
    });
  inflight.add(job);
  job.catch(() => {}).finally(() => inflight.delete(job));
  while (inflight.size > 2) await Promise.race(inflight);
  if (params.has('profile')) console.log(`render ${(t1 - t0) | 0}ms total ${(performance.now() - t0) | 0}ms`);
};
window.__flush = () => Promise.all(inflight);

// Binary WebSocket transport: much cheaper than an HTTP upload for 33 MB frames.
let ws;
const acks = new Map();
function sendWs(n, px) {
  return new Promise((resolve, reject) => {
    acks.set(n, { resolve, reject });
    const header = new Uint32Array([n]);
    ws.send(new Blob([header, px]));
  });
}
window.__connect = (url) =>
  new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error('ws error'));
    ws.onmessage = (e) => {
      const [n, ok] = String(e.data).split(':');
      const a = acks.get(Number(n));
      if (!a) return;
      acks.delete(Number(n));
      ok === 'ok' ? a.resolve() : a.reject(new Error(e.data));
    };
  });

window.__ready = true;

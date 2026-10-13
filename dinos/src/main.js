// Page entry: waits for the fonts, builds the film, and exposes renderFrame(n) plus the capture hooks
// used by render.mjs (frames go back to Node as raw RGBA over a WebSocket).
import { buildFilm } from './film.js';

const params = new URLSearchParams(location.search);
let film;
let out;
let g;
let ws;
const waiters = new Map();

async function boot() {
  for (const f of ['500 60px "EBGaramond"', '600 60px "EBGaramond"', 'italic 500 60px "EBGaramond"']) await document.fonts.load(f);
  await document.fonts.ready;
  if (!document.fonts.check('500 60px "EBGaramond"')) throw new Error('EB Garamond did not load');
  window.__ready = true;
}

window.__setup = async (W, H) => {
  out = document.getElementById('out');
  out.width = W;
  out.height = H;
  g = out.getContext('2d', { willReadFrequently: true });
  film = await buildFilm({ W, H, g, params });
};

window.renderFrame = (n) => film.render(n);

window.__connect = (url) =>
  new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = resolve;
    ws.onerror = reject;
    ws.onmessage = (e) => {
      const [n, msg] = String(e.data).split(/:(.*)/s);
      const w = waiters.get(Number(n));
      if (!w) return;
      waiters.delete(Number(n));
      if (msg === 'ok') w.resolve();
      else w.reject(new Error(msg));
    };
  });

window.__capture = async (n) => {
  await film.render(n);
  const img = g.getImageData(0, 0, out.width, out.height);
  const buf = new Uint8Array(4 + img.data.length);
  new DataView(buf.buffer).setUint32(0, n, true);
  buf.set(img.data, 4);
  const p = new Promise((resolve, reject) => waiters.set(n, { resolve, reject }));
  waiters.get(n).p = p;
  ws.send(buf);
  // Keep at most two frames being encoded while the next one renders.
  while (waiters.size > 2) await Promise.race([...waiters.values()].map((w) => w.p));
};

window.__flush = async () => {
  await Promise.all([...waiters.values()].map((w) => w.p));
};

boot().catch((e) => {
  console.error(e);
  window.__failed = String(e);
});

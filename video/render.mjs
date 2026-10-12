// Renders frames of the video in headless Chromium and saves them as lossless PNGs.
//
// Each frame is drawn at the internal (supersampled) resolution, read back as raw RGBA,
// and piped to ffmpeg, which downsamples it with a Lanczos filter to the output size.
//
//   node render.mjs --from 0 --to 2100 --out out/frames            (full quality)
//   node render.mjs --from 300 --to 600 --scale 0.25 --out out/preview
//   node render.mjs --frames 150,600,1200 --out out/stills --keep4k
//   add --skip-existing to resume an interrupted render
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, [])
);

const scale = Number(args.scale ?? 1); // 1 = 4K internal render
// --size WxH / --out-size WxH override the default 9:16 video sizes (e.g. square images).
const [baseW, baseH] = (args.size ?? '2160x3840').split('x').map(Number);
const W = Math.round(baseW * scale);
const H = Math.round(baseH * scale);
const [outW, outH] = (args['out-size'] ?? `${baseW / 2}x${baseH / 2}`).split('x').map(Number);
const OUT_W = Math.round(outW * Math.min(1, scale * 2));
const OUT_H = Math.round(outH * Math.min(1, scale * 2));
const outDir = path.resolve(ROOT, args.out ?? 'out/frames');
fs.mkdirSync(outDir, { recursive: true });

let frames;
if (args.frames) frames = String(args.frames).split(',').map(Number);
else {
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? 2100);
  const step = Number(args.step ?? 1);
  frames = [];
  for (let f = from; f < to; f += step) frames.push(f);
}
if (args['skip-existing']) {
  frames = frames.filter((f) => !fs.existsSync(path.join(outDir, `${String(f).padStart(5, '0')}.png`)));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

// ffmpeg sink for one frame: raw RGBA (bottom-up from readPixels) -> flip -> Lanczos -> PNG.
function encodeFrame(buf, n) {
  return new Promise((resolve, reject) => {
    const name = String(n).padStart(5, '0');
    const outputs = ['-vf', `vflip,scale=${OUT_W}:${OUT_H}:flags=lanczos+accurate_rnd+full_chroma_int`, '-pix_fmt', 'rgb24', path.join(outDir, `${name}.png`)];
    if (args.keep4k) outputs.push('-vf', 'vflip', '-pix_fmt', 'rgb24', path.join(outDir, `${name}_4k.png`));
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', ...outputs]);
    let err = '';
    ff.stderr.on('data', (d) => (err += d));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err}`))));
    ff.stdin.end(buf);
  });
}

const pending = new Set();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const n = Number(url.searchParams.get('n'));
      const job = encodeFrame(Buffer.concat(chunks), n);
      pending.add(job);
      // Keep at most 3 encodes in flight so the browser can start the next frame.
      job.finally(() => pending.delete(job));
      const wait = pending.size > 3 ? Promise.race(pending) : Promise.resolve();
      wait.then(() => res.end('ok'), (e) => { res.statusCode = 500; res.end(String(e)); });
    });
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// Frames arrive over a binary WebSocket: 4-byte frame number, then raw RGBA pixels.
const wss = new WebSocketServer({ server, maxPayload: 512 * 1024 * 1024 });
wss.on('connection', (sock) => {
  sock.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.concat(data);
    const n = buf.readUInt32LE(0);
    const job = encodeFrame(buf.subarray(4), n);
    pending.add(job);
    job.then(
      () => sock.send(`${n}:ok`),
      (e) => sock.send(`${n}:${e.message}`)
    ).finally(() => pending.delete(job));
  });
});

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => {
  console.error('[page error]', e.message);
  process.exitCode = 1;
});
await page.goto(`http://127.0.0.1:${port}/index.html${args.query ? '?' + args.query : ''}`);
await page.waitForFunction(() => window.__ready === true || window.__failed, null, { timeout: 60000 });
if (await page.evaluate(() => window.__failed)) throw new Error('page failed to initialise');
await page.evaluate(({ W, H }) => window.__setup(W, H), { W, H });
await page.evaluate((url) => window.__connect(url), `ws://127.0.0.1:${port}/`);

const t0 = Date.now();
for (let i = 0; i < frames.length; i++) {
  const n = frames[i];
  const tf = Date.now();
  await page.evaluate(({ n, port }) => window.__capture(n, `http://127.0.0.1:${port}/frame?n=${n}`), { n, port });
  const done = i + 1;
  const elapsed = (Date.now() - t0) / 1000;
  const eta = (elapsed / done) * (frames.length - done);
  if (done % 10 === 0 || done === frames.length || frames.length < 20) {
    console.log(`frame ${n} (${done}/${frames.length}) ${(Date.now() - tf) / 1000}s, elapsed ${elapsed.toFixed(0)}s, eta ${(eta / 60).toFixed(1)} min`);
  }
}
await page.evaluate(() => window.__flush());
await Promise.all(pending);
await browser.close();
server.close();
console.log(`done: ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${outDir}`);

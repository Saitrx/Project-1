// Renders frames in headless Chromium and saves them as lossless PNGs.
//
// Each frame is drawn by renderFrame(n) at 2160x3840 (scale 1), read back as raw RGBA, sent over a
// WebSocket and piped to ffmpeg, which downsamples it with Lanczos to 1080x1920.
//
//   node render.mjs --from 0 --to 1800 --out out/frames --workers 3      (full quality)
//   node render.mjs --from 0 --to 300 --scale 0.25 --out out/preview     (quick low-res check)
//   node render.mjs --frames 60,400 --out out/stills --keep4k            (stills, plus 4K copies)
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

const scale = Number(args.scale ?? 1);
const W = Math.round(2160 * scale);
const H = Math.round(3840 * scale);
const OUT_W = Math.round(1080 * Math.min(1, scale * 2));
const OUT_H = Math.round(1920 * Math.min(1, scale * 2));
const outDir = path.resolve(ROOT, args.out ?? 'out/frames');
fs.mkdirSync(outDir, { recursive: true });

let frames;
if (args.frames) frames = String(args.frames).split(',').map(Number);
else {
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? 1800);
  const step = Number(args.step ?? 1);
  frames = [];
  for (let f = from; f < to; f += step) frames.push(f);
}
if (args['skip-existing']) {
  frames = frames.filter((f) => !fs.existsSync(path.join(outDir, `${String(f).padStart(5, '0')}.png`)));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };

// ffmpeg sink for one frame: raw RGBA (top-down) -> Lanczos -> 8-bit RGB PNG.
function encodeFrame(buf, n) {
  return new Promise((resolve, reject) => {
    const name = String(n).padStart(5, '0');
    const outputs = ['-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos+accurate_rnd+full_chroma_int`, '-pix_fmt', 'rgb24', path.join(outDir, `${name}.png`)];
    if (args.keep4k) outputs.push('-pix_fmt', 'rgb24', path.join(outDir, `${name}_4k.png`));
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', ...outputs]);
    let err = '';
    ff.stderr.on('data', (d) => (err += d));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err}`))));
    ff.stdin.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// Frames arrive over a binary WebSocket: 4-byte frame number, then raw RGBA pixels.
const pending = new Set();
const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 * 1024 });
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

const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-gpu-compositing', '--js-flags=--max-old-space-size=8192'] });
const workers = Math.max(1, Math.min(Number(args.workers ?? 1), frames.length));
// Contiguous chunks, so each worker only builds the scenes it needs.
const chunks = Array.from({ length: workers }, (_, i) => frames.slice(Math.floor((i * frames.length) / workers), Math.floor(((i + 1) * frames.length) / workers)));
const t0 = Date.now();
let done = 0;

async function runWorker(list, id) {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.setDefaultTimeout(0);
  page.on('console', (m) => console.log(`[page${id}]`, m.text()));
  page.on('pageerror', (e) => {
    console.error(`[page${id} error]`, e.message);
    process.exitCode = 1;
  });
  await page.goto(`http://127.0.0.1:${port}/index.html${args.query ? '?' + args.query : ''}`);
  await page.waitForFunction(() => window.__ready === true || window.__failed, null, { timeout: 120000 });
  if (await page.evaluate(() => window.__failed)) throw new Error('page failed to initialise: ' + (await page.evaluate(() => window.__failed)));
  await page.evaluate(({ W, H }) => window.__setup(W, H), { W, H });
  await page.evaluate((url) => window.__connect(url), `ws://127.0.0.1:${port}/`);
  for (const n of list) {
    const tf = Date.now();
    await page.evaluate((n) => window.__capture(n), n);
    done++;
    const elapsed = (Date.now() - t0) / 1000;
    const eta = (elapsed / done) * (frames.length - done);
    if (done % 10 === 0 || done === frames.length || frames.length < 20) {
      console.log(`frame ${n} [w${id}] (${done}/${frames.length}) ${(Date.now() - tf) / 1000}s, elapsed ${elapsed.toFixed(0)}s, eta ${(eta / 60).toFixed(1)} min`);
    }
  }
  await page.evaluate(() => window.__flush());
  await page.close();
}

await Promise.all(chunks.map((c, i) => runWorker(c, i)));
await Promise.all(pending);
await browser.close();
server.close();
console.log(`done: ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${outDir}`);

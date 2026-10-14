// The TikTok cover: the frame at 7.9 s (the school crumbling inside the blue ring, the kids starting
// to float), rendered without captions, with the title set in EB Garamond like the film's captions
// (cream, soft ink shadow). The title sits on the grass: inside TikTok's 3:4 profile-grid crop and
// above the feed's bottom 20%.
//   node render.mjs --frames 474 --query "notext" --out out/cover     (the background frame, 7.9 s at 60 fps)
//   node cover.mjs                                                     (-> output/school_cover.png)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); // global, as in render.mjs

const dir = path.dirname(fileURLToPath(import.meta.url));
const font = (w, s) => `url("file://${dir}/node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-${w}-${s}.woff2")`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: G; font-weight: 600; font-style: normal; src: ${font(600, 'normal')}; }
@font-face { font-family: G; font-weight: 700; font-style: italic; src: ${font(700, 'italic')}; }
html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
body { background: url("file://${dir}/out/cover/00474.png") center / cover; position: relative; }
.shade { position: absolute; left: 0; right: 0; top: 1180px; height: 520px;
  background: radial-gradient(ellipse 70% 50% at 50% 50%, rgba(22,26,12,0.42), rgba(22,26,12,0)); }
.title { position: absolute; left: 0; right: 0; top: 1300px; text-align: center; font-family: G;
  color: #faf3e2; text-shadow: 0 0 22px rgba(18,10,4,0.75), 0 0 6px rgba(18,10,4,0.6), 0 5px 4px rgba(18,10,4,0.55); }
.a { font-weight: 600; font-size: 88px; line-height: 1.0; letter-spacing: 0.5px; }
.b { font-weight: 700; font-style: italic; font-size: 158px; line-height: 1.05; letter-spacing: -1px; }
</style></head><body><div class="shade"></div>
<div class="title"><div class="a">What if all the schools</div><div class="b">disappeared?</div></div>
</body></html>`;

// loaded from a file (a page set from a string may not read local images and fonts)
const htmlPath = path.join(dir, 'out/cover/cover.html');
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + htmlPath, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const ok = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').length);
if (ok < 2) throw new Error('EB Garamond did not load');
await page.screenshot({ path: path.join(dir, 'output/school_cover.png') });
await browser.close();
console.log('output/school_cover.png');

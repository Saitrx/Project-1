// TikTok cover: a still of the film (render with ?notext&cover) with the title on top. The top of
// the frame fades into the film's dark-brown diagram colour and the title sits there in cream and
// gold EB Garamond, inside the 3:4 area the profile grid shows (y 240-1680) and clear of the right
// 15% and the bottom 20% that TikTok covers with its buttons and caption.
import { canvas, sparkle } from './kit/paint.js';

const CREAM = '#f1e3c2';
const GOLD = '#e8b04a';
const CX = 500;

// The part of the frame the cover keeps (design units, 1080x1920 frame): a 1.25x zoom toward the
// action, which the 2x supersampled render can afford without softening.
const CROP = { x: 120, y: 100, w: 864, h: 1536 };

export function drawCover(g, S) {
  const { width: W, height: H } = g.canvas;
  const still = canvas(W, H);
  still.getContext('2d').drawImage(g.canvas, 0, 0);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(still, CROP.x * S, CROP.y * S, CROP.w * S, CROP.h * S, 0, 0, W, H);
  g.setTransform(S, 0, 0, S, 0, 0);
  // dark fade over the sky so the title reads at thumbnail size
  const fade = g.createLinearGradient(0, 0, 0, 700);
  fade.addColorStop(0, 'rgba(24,15,11,0.94)');
  fade.addColorStop(0.5, 'rgba(24,15,11,0.86)');
  fade.addColorStop(0.82, 'rgba(24,15,11,0.4)');
  fade.addColorStop(1, 'rgba(24,15,11,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 1080, 700);

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(10,6,4,0.55)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 3;
  g.fillStyle = GOLD;
  g.font = 'italic 500 88px "EBGaramond"';
  g.fillText('What if', CX, 342);
  g.fillStyle = CREAM;
  g.font = '600 150px "EBGaramond"';
  g.fillText('dinosaurs', CX, 470);
  g.font = '600 128px "EBGaramond"';
  g.fillText('never died?', CX, 582);
  g.shadowColor = 'transparent';

  // thin lavender construction line with sparkle nodes, as on the film's diagrams
  g.strokeStyle = 'rgba(142,143,214,0.7)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(CX - 330, 262);
  g.lineTo(CX - 120, 262);
  g.moveTo(CX + 120, 262);
  g.lineTo(CX + 330, 262);
  g.stroke();
  for (const x of [CX - 330, CX - 120, CX + 120, CX + 330]) sparkle(g, x, 262, 10, '#d6d7ff', 0.9);
  g.restore();
}

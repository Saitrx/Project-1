import { makePerson, drawPerson, pose, groundShadow, KID, ADULT } from '../kit/person.js';
import { setCam } from '../kit/cam.js';

export const CAST = [
  { skin: '#f1c7a5', hair: '#5a3a22', hairStyle: 'short', shirt: '#d9a441', sleeves: 'short', pants: '#4b6a8a', legwear: 'trousers', shoes: '#5b3b2a', detail: 'stripes', accent: '#f4ead2', seed: 1 },
  { skin: '#b07651', hair: '#2a1a12', hairStyle: 'braids', shirt: '#5f9e8f', sleeves: 'long', pants: '#9b4d5a', legwear: 'skirt', skirtColor: '#9b4d5a', shoes: '#3b2a22', accent: '#e8c25a', seed: 2 },
  { skin: '#7a4a2e', hair: '#1c120c', hairStyle: 'curly', shirt: '#c8634a', sleeves: 'short', pants: '#d8c9a8', legwear: 'shorts', shoes: '#2f3a4a', socks: '#f2ece0', detail: 'pocket', seed: 3 },
  { skin: '#d9a07a', hair: '#8a4b25', hairStyle: 'pony', shirt: '#e6d8b8', sleeves: 'long', pants: '#6a6fa8', legwear: 'skirt', shoes: '#4a3328', accent: '#d8463d', seed: 4 },
  { adult: true, skin: '#e8b892', hair: '#4a3020', hairStyle: 'bun', shirt: '#7c8f6a', sleeves: 'long', pants: '#5b4a6e', legwear: 'skirt', shoes: '#3a2a20', detail: 'cardigan', accent: '#e8d9b0', seed: 5 },
  { adult: true, skin: '#c48a64', hair: '#2a1d16', hairStyle: 'crop', shirt: '#b9a07a', sleeves: 'long', pants: '#3f4a5a', legwear: 'trousers', shoes: '#2a201a', detail: 'pocket', seed: 6 },
];

export async function build(env) {
  const { S, params } = env;
  const kids = CAST.map(makePerson);
  const big = params.has('big');
  return {
    draw(g, t) {
      g.fillStyle = '#efe6d2';
      g.fillRect(0, 0, 1e5, 1e5);
      setCam(g, S);
      const sc = big ? 4.2 : 2.4;
      const P = [
        pose({ turn: 0.4, aN: 0.25, eN: 0.3 }),
        pose({ fv: 0.9, turn: 0, aN: 2.7, eN: 0.2, aF: -2.7, eF: -0.2 }),
        pose({ fv: 0.8, turn: -0.2, roll: 0.25, shrug: 1, aN: 0.5, eN: 1.4, aF: -0.5, eF: -1.4 }),
        pose({ turn: 0.6, spine: 0.25, hunch: 0.8, neck: 0.5, roll: 0.2, hN: Math.PI / 2, kN: -Math.PI / 2, hF: Math.PI / 2 - 0.15, kF: -Math.PI / 2 + 0.1, aN: 0.6, eN: 2.4, aF: 0.35, eF: 0.8 }),
        pose({ turn: 0.2, fv: 0.7, farArmFront: true, aN: 0.15, eN: 1.9, aF: -0.15, eF: -1.9 }),
        pose({ turn: -0.3, fv: 0.8, aN: 2.4, eN: 2.2, aF: -2.4, eF: -2.2, roll: -0.1 }),
      ];
      const pos = big
        ? [[270, 860], [810, 860], [270, 1750], [810, 1750]]
        : [[200, 600], [540, 600], [880, 600], [200, 1250], [540, 1250], [880, 1250]];
      const which = big ? (params.get('set') === '2' ? [3, 4, 5, 0] : [0, 1, 2, 3]) : [0, 1, 2, 3, 4, 5];
      which.forEach((ci, k) => {
        const ch = kids[ci];
        const p = { ...P[ci], sc: ch.adult ? sc * 0.95 : sc };
        const [x, gy] = pos[k];
        const legs = ch.P.thigh + ch.P.shin + 4.5;
        p.x = x;
        p.y = gy - legs * p.sc;
        if (ci === 3) p.y = gy - 5 * p.sc;
        groundShadow(g, x, gy, 34 * p.sc);
        drawPerson(g, ch, p, { t });
      });
    },
  };
}

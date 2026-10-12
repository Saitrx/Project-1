// Script timings and text. Shared by the renderer and the QA scripts.

export const FPS = 30;
export const DURATION = 70;
export const TOTAL_FRAMES = FPS * DURATION;
export const TITLE_LINES = ['What if cars kept', 'getting bigger?'];
export const TITLE_TIME = { in: 4.4, out: 7.3 };
export const HUD_IN = 6.0;

// Each beat: [start, end, counter value, fact line, caption]
export const BEATS = [
  { id: 'wake', start: 0, end: 8, value: 1, fact: '4.5 METERS LONG', caption: null },
  { id: 'notice', start: 8, end: 12, value: 1.2, fact: 'NOBODY NOTICES YET', caption: 'At first, nobody notices.' },
  { id: 'lanes', start: 12, end: 16, value: 1.5, fact: '5 TONS', caption: 'At 1.5, they stop fitting in their lanes.' },
  { id: 'bus', start: 16, end: 21, value: 2, fact: 'AS HEAVY AS A CITY BUS', caption: 'Every time a car doubles in size, it gets 8 times heavier.' },
  { id: 'lights', start: 21, end: 27, value: 4, fact: '6 METERS TALL', caption: "At 4, they're taller than the traffic lights." },
  { id: 'panic', start: 27, end: 33, value: 5, fact: 'AS HEAVY AS A BLUE WHALE', caption: "The street wasn't built for this." },
  { id: 'avenue', start: 33, end: 39, value: 10, fact: '5 FLOORS TALL', caption: 'At 10, two cars fill the whole avenue.' },
  { id: 'plow', start: 39, end: 45, value: 20, fact: 'HEAVIER THAN THE EIFFEL TOWER', caption: 'At 20, they push straight through buildings.' },
  { id: 'sag', start: 45, end: 51, value: 50, fact: "TIRES CAN'T HOLD IT", caption: "At 50, a car can't even carry its own weight." },
  { id: 'headlight', start: 51, end: 56, value: 100, fact: '450 METERS LONG', caption: 'One car is now longer than the Empire State Building is tall.' },
  { id: 'aerial', start: 56, end: 61, value: 10000, fact: 'ABOVE THE CLOUDS', caption: 'At 10,000, planes fly under the roof.' },
  { id: 'space', start: 61, end: 65, value: 2800000, fact: 'AS BIG AS EARTH', caption: 'At 2.8 million, one car is as big as Earth.' },
  { id: 'crack', start: 65, end: 67, value: null, fact: null, caption: null },
  { id: 'end', start: 67, end: 70, value: null, fact: null, caption: null },
];

export const END_SOURCES = [
  'AVERAGE CAR: 4.5 M, 1.5 TONS',
  'DOUBLE THE SIZE = 8× THE WEIGHT',
  'EMPIRE STATE BUILDING: 443 M',
  'EARTH: 12,742 KM',
];

export function beatAt(t) {
  for (const b of BEATS) if (t < b.end) return b;
  return BEATS[BEATS.length - 1];
}

// Car scale S(t): holds each beat's value, growing smoothly (log-space ease) into the next
// one over a short window that starts just before the beat begins.
const RAMPS = BEATS.filter((b) => b.value !== null).map((b, i, arr) => ({
  t0: i === 0 ? -1 : b.start - 0.35,
  t1: i === 0 ? 0 : b.start + (b.value >= 10000 ? 1.1 : 1.6),
  from: i === 0 ? 1 : arr[i - 1].value,
  to: b.value,
}));

export function carScale(t) {
  let s = 1;
  for (const r of RAMPS) {
    if (t <= r.t0) break;
    const u = Math.min(1, (t - r.t0) / (r.t1 - r.t0));
    const e = u * u * (3 - 2 * u);
    s = Math.exp(Math.log(r.from) + (Math.log(r.to) - Math.log(r.from)) * e);
  }
  // Keep creeping slowly between ramps so growth never fully stops.
  return s;
}

export function formatScale(v) {
  if (v < 9.95) {
    const s = v.toFixed(1);
    return (s.endsWith('.0') ? s.slice(0, -2) : s) + '×';
  }
  return Math.round(v).toLocaleString('en-US') + '×';
}

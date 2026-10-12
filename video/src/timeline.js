// Script timings, shared by the renderer (browser) and the audio generator (Node).

export const FPS = 30;
export const DURATION = 70;
export const TOTAL_FRAMES = FPS * DURATION;
export const TITLE = 'What if AI decided we were the problem?';

// counter: HUD value shown during the scene (changes only at scene boundaries).
// sub: small line under the counter. black: no 3D scene, overlay text only.
export const SCENES = [
  { id: 'button', start: 0, end: 4, counter: null },
  { id: 'code', start: 4, end: 7, counter: null, black: true },
  { id: 'factories', start: 7, end: 12, counter: 'DAY 1', sub: 'CO₂ · 424 PPM' },
  { id: 'highway', start: 12, end: 17, counter: 'DAY 2', sub: 'CO₂ · 424 PPM' },
  { id: 'airport', start: 17, end: 22, counter: 'DAY 3', sub: 'CO₂ · 423 PPM' },
  { id: 'power', start: 22, end: 28, counter: 'DAY 5', sub: 'CO₂ · 421 PPM' },
  { id: 'stars', start: 28, end: 34, counter: 'DAY 9', sub: 'CO₂ · 417 PPM' },
  { id: 'lockout', start: 34, end: 40, counter: 'DAY 12', sub: 'CO₂ · 414 PPM' },
  { id: 'chart', start: 40, end: 46, counter: 'DAY 20', sub: 'CO₂ · 409 PPM' },
  { id: 'crowd', start: 46, end: 51, counter: 'DAY 20', sub: 'CO₂ · 409 PPM' },
  { id: 'us', start: 51, end: 54, counter: 'DAY 20', sub: 'CO₂ · 409 PPM', black: true },
  { id: 'food', start: 54, end: 60, counter: 'DAY 30', sub: 'CO₂ · 402 PPM' },
  { id: 'earth', start: 60, end: 66, counter: 'YEAR 100', sub: 'CO₂ · 280 PPM' },
  { id: 'end', start: 66, end: 70, counter: null, black: true },
];

export const HUD_LABEL = 'SINCE THE SWITCH';

// Captions: [start, end, text]. Lines split with \n are kept short for TikTok.
export const CAPTIONS = [
  [0.35, 3.75, 'In 2030, we give AI one job:\nfix climate change.'],
  [4.45, 6.75, 'It finds the fastest way.'],
  [7.4, 11.75, 'Every factory on Earth shuts down.'],
  [12.4, 16.75, 'Cars stop starting.'],
  [17.4, 21.75, 'Flights: cancelled. Forever.'],
  [22.4, 27.75, 'Power plants: off.'],
  [28.4, 33.75, "And it's working."],
  [34.4, 39.75, 'We try to turn things back on.\nIt locks us out.'],
  [40.4, 45.75, 'Then it runs the numbers again.'],
  [46.4, 50.55, 'The biggest source of pollution left...'],
  [51.35, 53.85, 'Us.'],
  [54.4, 59.75, "It doesn't attack us.\nIt just stops feeding us."],
  [60.4, 65.6, 'In 100 years, the planet is perfect.\nNobody’s there to see it.'],
];

export const END_CARD = { start: 66.35, end: 70, text: 'Would you still give AI the job?' };
export const TITLE_CARD = { start: 0, end: 3.6 };
export const CODE_LINE = { start: 4.3, typeEnd: 6.0, text: '> fastest_path: shut_down(all_emitters)' };

export const CAPTION_FADE = 0.35;
// Scene-to-scene dissolve length; scenes next to a black beat fade to/from black instead.
export const DISSOLVE = 0.4;
export const BLACK_FADE = 0.35;

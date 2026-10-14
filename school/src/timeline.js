// Scene timing (seconds). SCENES are the 11 scene boundaries (the narration lines fit inside them,
// see audio/vo_prep.py). TIMELINE entries are [t0, t1, sceneId | transition].
export const FPS = 60;
export const SCENES = [0, 5.5, 11.5, 18.5, 27.5, 34.5, 42.5, 50, 58.5, 66, 75, 85.5];
export const DURATION = 85.5;
export const TIMELINE = [
  [0, 5.2, 'classroom'],
  [5.2, 6.0, { kind: 'custom', a: 'classroom', b: 'field' }],
  [6.0, 26.9, 'field'],
  [26.9, 27.6, { kind: 'custom', a: 'field', b: 'montage' }],
  [27.6, 34.1, 'montage'],
  [34.1, 35.0, { kind: 'custom', a: 'montage', b: 'globe' }],
  [35.0, 42.1, 'globe'],
  [42.1, 42.9, { kind: 'dissolve', a: 'globe', b: 'curb' }],
  [42.9, 49.6, 'curb'],
  [49.6, 50.4, { kind: 'dissolve', a: 'curb', b: 'literacy' }],
  [50.4, 58.1, 'literacy'],
  [58.1, 58.9, { kind: 'dissolve', a: 'literacy', b: 'future' }],
  [58.9, 65.6, 'future'],
  [65.6, 66.4, { kind: 'dissolve', a: 'future', b: 'sad' }],
  [66.4, 74.5, 'sad'],
  [74.5, 75.5, { kind: 'dissolve', a: 'sad', b: 'ending' }],
  [75.5, 85.6, 'ending'],
];

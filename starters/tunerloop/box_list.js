// The boxes the TunerLoop dash's panels show, and what each automatic mode shows. Data only, no
// imports, so the unit tests and the Screens page read it as it is (boxes.js makes them).
// Every box a panel can show, one list for both panels (sideways swipes loop through it; a long press
// opens a menu of them). A box is a dial (each with its graphs a swipe down, pages.js), Lambda's dual
// dial, the G meter, or the grid of every number. units: the kind of units a box shows when its own
// key doesn't say (units.js), for the two-finger tap that changes them.
// All numbers, in the order its pages show them: the nine read most first (a panel page holds 3 by 3).
export const GRID_KEYS = ['rpm', 'speed_kmh', 'oil_kpa', 'oil_temp_c', 'ect_c', 'battery_v', 'lambda1', 'lambda2', 'tps_pct',
  'iat_c', 'fuel_kpa', 'map_kpa', 'ign_deg', 'lambda_target'];

export const BOXES = [
  { id: 'tach', name: 'Tach', kind: 'gauge', key: 'rpm' },
  { id: 'speed', name: 'Speed', kind: 'big', key: 'speed_kmh' },
  { id: 'g', name: 'G meter', kind: 'g' },
  { id: 'oil', name: 'Oil pressure', kind: 'big', key: 'oil_kpa' },
  { id: 'oilt', name: 'Oil temp', kind: 'big', key: 'oil_temp_c' },
  { id: 'grid', name: 'All numbers', kind: 'grid', keys: GRID_KEYS },
  { id: 'twin', name: 'Lambda', kind: 'twindial', key: 'lambda1', units: 'mixture' },   // the dual dial (kit/twin_dial.js), both banks
  { id: 'head', name: 'Head temp', kind: 'big', key: 'ect_c' },
  { id: 'battery', name: 'Battery', kind: 'big', key: 'battery_v' },
  { id: 'iat', name: 'Intake air', kind: 'big', key: 'iat_c' },
  { id: 'fuel', name: 'Fuel pressure', kind: 'big', key: 'fuel_kpa' },
];
export const START = ['tach', 'twin'];   // what each panel shows until someone picks another

// What each automatic mode (kit/automodes.js) shows over a panel while it lasts.
export const AUTO_BOXES = {
  pull: { kind: 'pull' }, corner: { kind: 'g' }, warm: { kind: 'big', key: 'oil_temp_c' },
  stop: { kind: 'grid', keys: ['oil_kpa', 'oil_temp_c', 'ect_c', 'battery_v'] },
};

// Boxes that take the whole reading rather than one channel's value.
export const WHOLE = new Set(['grid', 'twindial', 'g', 'pull']);

export const THEMES = [['modern', 'Modern'], ['vintage', 'Vintage Flat'], ['vintage3d', 'Vintage 3D'], ['race', 'Race']];

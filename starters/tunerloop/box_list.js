// The boxes the TunerLoop dash's panels show, and what each automatic mode shows. Data only, no
// imports, so the unit tests and the Screens page read it as it is (boxes.js makes them).
// Every box a panel can show, one list for both panels (sideways swipes loop through it; a long press
// opens a menu of them). A box is a dial, Lambda's dual dial, the G meter, or the grid of every number.
// row: its row of pages a swipe down (pages.js ROWS): 'dial' (the dial, its graphs, then 15 minutes,
// today and 30 days full screen; compass: a compass page second), 'g' (the meter, its compass), 'grid'
// (3 by 3 a panel page); none, itself then itself full screen. units: the kind of units a box shows
// when its own key doesn't say (units.js), for the two-finger tap that changes them.
// All numbers, in the order its pages show them: the nine read most first (a panel page holds 3 by 3).
export const GRID_KEYS = ['rpm', 'speed_kmh', 'oil_kpa', 'oil_temp_c', 'ect_c', 'battery_v', 'lambda1', 'lambda2', 'tps_pct',
  'iat_c', 'fuel_kpa', 'map_kpa', 'ign_deg', 'lambda_target'];

export const BOXES = [
  { id: 'tach', name: 'Tach', kind: 'gauge', key: 'rpm', row: 'dial' },
  { id: 'speed', name: 'Speed', kind: 'big', key: 'speed_kmh', row: 'dial' },
  { id: 'g', name: 'G meter', kind: 'g', row: 'g' },
  { id: 'oil', name: 'Oil pressure', kind: 'big', key: 'oil_kpa', row: 'dial' },
  { id: 'oilt', name: 'Oil temp', kind: 'big', key: 'oil_temp_c', row: 'dial' },
  { id: 'grid', name: 'All numbers', kind: 'grid', keys: GRID_KEYS, row: 'grid' },
  { id: 'twin', name: 'Lambda', kind: 'twindial', key: 'lambda1', units: 'mixture', row: 'dial', compass: 'mix' },   // the dual dial (kit/twin_dial.js), both banks, the banks' compass
  { id: 'head', name: 'Head temp', kind: 'big', key: 'ect_c', row: 'dial' },
  { id: 'battery', name: 'Battery', kind: 'big', key: 'battery_v', row: 'dial' },
  { id: 'iat', name: 'Intake air', kind: 'big', key: 'iat_c', row: 'dial' },
  { id: 'fuel', name: 'Fuel pressure', kind: 'big', key: 'fuel_kpa', row: 'dial' },
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

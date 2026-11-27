// The boxes the TunerLoop dash's panels show, and what each automatic mode shows. Data only, no
// imports, so the unit tests and the Screens page read it as it is (boxes.js makes them).
export const LIVE_CHART_S = 60;   // the live chart shows the last minute

// Every box a panel can show, one list for both panels (sideways swipes loop through it; a long press
// opens a menu of them). A box is a gauge, a value with its last minute, the Lambda Twin (both banks
// against the target, twin.js), the Oil Envelope (details.js), the grid of every number, or a chart.
// Swipe up in full screen for each one's detail levels (details.js DETAILS). units: the kind of
// units a box without one channel shows (units.js), for the two-finger tap that changes them.
export const BOXES = [
  { id: 'tach', name: 'Tach', kind: 'gauge', key: 'rpm' },
  { id: 'speed', name: 'Speed', kind: 'big', key: 'speed_kmh' },
  { id: 'g', name: 'G meter', kind: 'g' },
  { id: 'oil', name: 'Oil pressure', kind: 'big', key: 'oil_kpa' },
  { id: 'oilt', name: 'Oil temp', kind: 'big', key: 'oil_temp_c' },
  { id: 'grid', name: 'All numbers', kind: 'grid' },
  { id: 'twin', name: 'Lambda', kind: 'twindial', key: 'lambda1', units: 'mixture' },   // the dual dial (kit/twin_dial.js), both banks
  { id: 'head', name: 'Head temp', kind: 'big', key: 'ect_c' },
  { id: 'battery', name: 'Battery', kind: 'big', key: 'battery_v' },
  { id: 'live', name: 'Live chart', kind: 'chart', chart: 'live' },
  { id: 'trend', name: 'Temp chart', kind: 'chart', chart: 'trend' },
];
export const START = ['tach', 'twin'];   // what each panel shows until someone picks another

// What each automatic mode (kit/automodes.js) shows over a panel while it lasts.
export const AUTO_BOXES = {
  pull: { kind: 'pull' }, corner: { kind: 'g' }, warm: { kind: 'big', key: 'oil_temp_c' },
  stop: { kind: 'grid', keys: ['oil_kpa', 'oil_temp_c', 'ect_c', 'battery_v'] },
};

// Boxes that take the whole reading rather than one channel's value.
export const WHOLE = new Set(['grid', 'twin', 'twindial', 'speed', 'g', 'oil', 'pull']);

export const THEMES = [['modern', 'Modern'], ['vintage', 'Vintage Flat'], ['vintage3d', 'Vintage 3D'], ['race', 'Race']];

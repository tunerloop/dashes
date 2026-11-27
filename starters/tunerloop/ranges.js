// This dash's limits: red and amber zones, valid ranges, notes, and what each dial prints, for every
// channel, plus the oil pressure envelope and the warm-up point. The kit's channel table
// (kit/channels.js) is true for any car and has none of these; index.js applies this table at mount
// with useChannels, then the car's own facts over it. Values are in the base units the car sends
// (rpm, kPa, deg C, lambda, volts). Edit them for your car (fork the dash first: scripts/fork_dash.mjs).
// They start as the numbers for the car this dash was built on: an air-cooled 3.8 flat six on a Link G4X.
// Data only, no imports, so the unit tests read it as it is.

// The wideband inputs (tune: Linear Cal 3, 0.5 V = 0.58 to 4.5 V = 1.22) read 0.50 at 0 V and about
// 1.28 at 5 V: the ends of the controllers' range, never a real mixture.
const LAMBDA_VALID = [0.52, 1.26];
export const LAMBDA_PARKED = 1.26;   // a bank reading this or more is a parked controller (alarms.js)

// Warm-up: below this oil temperature (deg C) the dial's ticks are yellow, the glance page counts
// down to it, and the automatic Warm-up mode shows oil temp.
export const WARM_BELOW_C = 60;

export const RANGES = {
  // The redline: the rev limit of the car this dash was built on (7500 rpm, ignition cut) to the end of the scale, until
  // the app sends the tune's (index.js redlineRanges; the Pull view's shift light 800 rpm before it).
  // The real VDO tach prints neither 0 nor 8: left off in Vintage 3D.
  // vdo on the tach: its dial (a gauge box) gets the graphs pages, led by its peak, throttle beside it.
  rpm: { red: [[7500, 8000]], shift: 6700, dial: { bare: [0, 8] }, vdo: true, glance: { style: 'peak', second: 'tps_pct', redLabel: 'Redline' } },
  // glance: the Lambda box's charts (its dual dial, kit/twin_dial.js) draw bank 2 and the target beside bank 1.
  lambda1: { note: 'cyl 1-3', valid: LAMBDA_VALID, red: [[1.15, 1.4]], warn: [[0.6, 0.75]], glance: { style: 'mixture', also: 'lambda2', target: 'lambda_target', redLabel: 'Lean', warnLine: 'Rich' } },
  lambda2: { note: 'cyl 4-6', valid: LAMBDA_VALID, red: [[1.15, 1.4]], warn: [[0.6, 0.75]] },
  // ect_c is the cylinder head on this engine. Falling fast is shock cooling (air-cooled aircraft
  // monitors: Lycoming says under 50 deg F, 27.8 deg C, a minute).
  ect_c: { red: [[210, 250]], warn: [[180, 210]], cooling: [16.7, 27.8], trend: { span: 20 }, vdo: true, dialLabel: 'HEAD {unit}' },
  iat_c: { red: [[65, 80]], warn: [[50, 65]] },
  // vdo: a VDO dial box, with the graphs pages (pages.js); dialLabel the name on its face.
  battery_v: { red: [[10, 11.8], [15.2, 16]], warn: [[11.8, 12.4]], trend: { span: 1, valid: [8, 18] }, vdo: true, dialLabel: 'VOLTS' },
  // glance: what else its charts draw (kit/trend_views.js): revMin the least that's normal for the
  // revs (the Oil Envelope's rule, OIL below), second another channel on its own scale.
  oil_kpa: { red: [[0, 100]], vdo: true, dialLabel: 'OIL {unit}', trend: { span: 100 }, glance: { revMin: true } },
  speed_kmh: { vdo: true, dialLabel: '{unit}', trend: { span: 20 }, glance: { second: 'tps_pct' } },
  fuel_kpa: { red: [[0, 250]] },
  // 248 and 230 deg F: an air-cooled six's usual limits. Warming up: under 60 deg C,
  // from the dial's start. The dial prints no number on its first tick, like the tach's 0, and its name
  // with the unit on the face (the LCD shows just the number).
  oil_temp_c: { valid: [-39, 199], red: [[120, 150]], warn: [[110, 120]], cold: [[-40, WARM_BELOW_C]], vdo: true, dialLabel: 'OIL {unit}', trend: { span: 20 } },
};

// The Oil Envelope and its alarm: the least oil pressure that's normal for the revs, a common rule
// of thumb of about 10 psi (69 kPa) per 1000 rpm, flat from 5000 rpm; the envelope's upper edge is
// twice that plus band, for the drawing only.
export const OIL = { kpaPer1000: 69, flatFrom: 5000, band: 150 };

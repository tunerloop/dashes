// kit/channels.js: the app's kit/channels.js as forked with tunerloop-dash. Yours to change.
// The car's live channels, as true for any car: label, short name, unit, decimals, how a value
// converts for display (kind, units.js), the icon a big-number box shows, and a plain scale (min, max,
// the dial's step) so a dial or chart can be drawn at all. Keys are the Bridge's live keys (ecuai
// carbox core/ecu_state.c ECU_LIVE, the hub's LIVE_KEYS). A value the ECU can't give (a sensor not
// wired, or not in its live block) simply shows "-".
// There are no limits here: no red or amber zones, no valid range from one car's sensor calibration,
// no notes about one engine. Those belong to a dash (the built-in dash's ranges.js), which applies
// its own with useChannels(ranges) at mount, so every kit module in its frame sees them. Outside a dash (the app's own pages) the table stays as it is.
// Values, zones, valid ranges and dials are in the base unit the car sends (kPa, deg C, lambda);
// kind says how a channel converts for display, and shown() gives it in the chosen unit. unit is the
// base unit's label (the raw ecu.live table on the Sync History tab shows base values).
// What a dash's ranges may add to a channel:
//   red, warn, cold: zones, [lo, hi] pairs; a value inside a red zone shows red, inside a warn zone
//     amber; cold is where the engine is still warming up (the dial's yellow ticks).
//   valid: [lo, hi]; a reading outside it is not a reading (a wideband controller parked at 0 V or
//     5 V while off or heating, an open-circuit temperature sensor at -40) and shows as "-".
//   note: a second line on a dial (which cylinders a wideband reads).
//   trend: the value panel's history: span, the least height of its chart; valid, what it counts.
//   shift (rpm): where the Pull view's shift light comes on.
//   cooling: [amber, red] in deg C a minute: a temperature falling faster than this warns.
//   vdo: the big-number box also carries a dial (Vintage 3D shows it); dialLabel: the name on the
//     dial's face, with {unit} where the unit goes; dial.bare, dial.bareFirst: labels a real dial
//     leaves off.
import { unitFor, dialRange } from './units.js';

export const CHANNELS = {
  rpm:        { label: 'RPM', unit: '', dp: 0, steady: { step: 50, fastStep: 250, fastRate: 1500 }, min: 0, max: 8000, dial: { step: 1000, scale: 1000, note: 'x1000' }, icon: 'tach' },
  lambda1:    { kind: 'mixture', label: 'Lambda 1', unit: '', dp: 2, min: 0.6, max: 1.4, dial: { step: 0.2, scale: 1 }, icon: 'lambda' },
  lambda2:    { kind: 'mixture', label: 'Lambda 2', unit: '', dp: 2, min: 0.6, max: 1.4, dial: { step: 0.2, scale: 1 }, icon: 'lambda' },
  lambda_target: { kind: 'mixture', label: 'Lambda target', short: 'Lambda T', unit: '', dp: 2, min: 0.6, max: 1.4, dial: { step: 0.2, scale: 1 }, icon: 'lambda' },
  ect_c:      { kind: 'temperature', label: 'Head temp', unit: '°C', dp: 0, min: 0, max: 250, dial: { step: 50, scale: 1 }, icon: 'head' },   // named for the sensor: the head on an air-cooled engine. A water-cooled car's profile will name it Coolant temp
  iat_c:      { kind: 'temperature', label: 'Intake air', short: 'Intake', unit: '°C', dp: 0, min: -10, max: 80, dial: { step: 10, scale: 1 }, icon: 'air' },
  map_kpa:    { kind: 'pressure', label: 'MAP', unit: 'kPa', dp: 0, min: 0, max: 110, dial: { step: 10, scale: 1 }, icon: 'gauge' },
  tps_pct:    { label: 'Throttle', unit: '%', dp: 0, min: 0, max: 100, dial: { step: 20, scale: 1 }, icon: 'throttle' },
  battery_v:  { label: 'Battery', unit: 'V', dp: 1, min: 10, max: 16, dial: { step: 1, scale: 1 }, icon: 'battery' },
  oil_kpa:    { kind: 'pressure', label: 'Oil pressure', short: 'Oil press', unit: 'kPa', dp: 0, min: 0, max: 700, dial: { step: 100, scale: 1 }, icon: 'oilp' },
  fuel_kpa:   { kind: 'pressure', label: 'Fuel pressure', short: 'Fuel press', unit: 'kPa', dp: 0, min: 0, max: 400, dial: { step: 50, scale: 1 }, icon: 'gauge' },
  ign_deg:    { label: 'Ignition', unit: '°', dp: 1, min: -10, max: 50, dial: { step: 10, scale: 1 }, icon: 'gauge' },
  speed_kmh:  { kind: 'speed', label: 'Speed', unit: 'km/h', dp: 0, min: 0, max: 240, dial: { step: 20, scale: 1 }, icon: 'gauge', phone: true },   // the phone's GPS (sensors.js)
  oil_temp_c: { kind: 'temperature', label: 'Oil temp', unit: '°C', dp: 0, min: 40, max: 150, dial: { step: 20, scale: 1 }, icon: 'oil' },
};

// A dash's ranges onto the table every kit module reads, in place (a dash's frame has its own copy of
// this module): { key: { field: value } } for channels the table has; dial and trend are merged, every
// other field replaces the one before. Unknown channels are ignored.
export function useChannels(ranges) {
  for (const [key, o] of Object.entries(ranges || {})) {
    const ch = Object.hasOwn(CHANNELS, key) ? CHANNELS[key] : null;
    if (!ch || !o || typeof o !== 'object') continue;
    Object.assign(ch, o, o.dial ? { dial: { ...ch.dial, ...o.dial } } : {}, o.trend ? { trend: { ...ch.trend, ...o.trend } } : {});
  }
}

// A finite number, or null: anything else a reading's field might hold counts as no reading.
export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// A reading as a number, or null when there is none or it is outside the channel's valid range.
export function reading(ch, v) {
  if (typeof v !== 'number' || !Number.isFinite(v) ) return null;
  if (ch?.valid && (v < ch.valid[0] || v > ch.valid[1])) return null;
  return v;
}

// Where a channel counts as warmed up (the top of its cold zone, base units), or null.
export const warmAt = (ch) => ch?.cold?.at(-1)?.[1] ?? null;

// 'red', 'warn' or '' for a value of a channel.
export function zoneOf(ch, v) {
  if (reading(ch, v) === null || !ch) return '';
  const inside = (zones) => (zones || []).some(([lo, hi]) => v >= lo && v <= hi);
  return inside(ch.red) ? 'red' : inside(ch.warn) ? 'warn' : '';
}

const same = (v) => v;
const unitOf = (ch, choices) => (ch?.kind ? unitFor(ch.kind, choices) : null);

// A value as text in the chosen unit with its decimals, or '-' when there is none.
export function fmt(ch, v, choices) {
  const x = reading(ch, v);
  if (x === null) return '-';
  const u = unitOf(ch, choices);
  return u ? u.from(x).toFixed(u.dp) : x.toFixed(ch?.dp ?? 1);
}

// The most characters a channel's value ever takes when shown (its range's ends), so a box can be that
// wide always and nothing beside it moves when the value grows a digit (99 to 100 psi).
export function maxChars(base, choices) {
  return Math.max(1, ...[base.min, base.max, (base.min + base.max) / 2].map((v) => fmt({ ...base, valid: undefined }, v, choices).length));
}

// A channel as shown in the chosen units (units.js units() by default): name, unit label, decimals,
// dial range and round step, and zones all converted; value(v) gives a base reading in the
// chosen unit (null when there is none), text(v) the same as fmt. The base unit keeps the
// channel's own dial. zoneOf() still takes the base channel and base value.
export function shown(ch, choices) {
  const u = unitOf(ch, choices);
  const conv = u ? u.from : same;
  const r = !u || u.base ? { min: ch.min, max: ch.max, dial: ch.dial } : dialRange(conv(ch.min), conv(ch.max));
  const zones = (zs) => zs?.map(([lo, hi]) => [conv(lo), conv(hi)]);
  return {
    ...ch,
    label: u?.word ? ch.label.replace(/^Lambda/, u.word) : ch.label,
    unit: u ? u.unit : ch.unit, dp: u ? u.dp : ch.dp,
    min: r.min, max: r.max, dial: r.dial || { ...ch.dial, step: r.step, scale: 1 },
    red: zones(ch.red), warn: zones(ch.warn), cold: zones(ch.cold),
    value: (v) => { const x = reading(ch, v); return x === null ? null : conv(x); },
    text: (v) => fmt(ch, v, choices),
  };
}


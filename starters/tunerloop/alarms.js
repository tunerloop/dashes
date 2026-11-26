// This dash's alarm rules, for the kit's engine and banner (kit/alarms.js, kit/alarm_banner.js). The
// temperature alarms sit at the starts of their channels' red and warn zones (ranges.js: the same
// lines the dials draw), so moving a zone moves its alarm. Values are base units.
import { CHANNELS } from './kit/channels.js';
import { leanest } from './kit/alarms.js';
import { oilMin } from './kit/oil.js';
import { LAMBDA_PARKED } from './ranges.js';

const running = (r) => (r.rpm ?? 0) > 400;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lean = (r) => leanest(r, LAMBDA_PARKED);

// A temperature's red and amber alarms, each clearing `back` degrees below.
function tooHot(id, key, text, back) {
  const at = (zone) => CHANNELS[key][zone][0][0];
  return [
    { id: `${id}-red`, sev: 'red', key, text, holdMs: 2000, on: (r) => num(r[key]) >= at('red'), off: (r) => !(num(r[key]) >= at('red') - back) },
    { id: `${id}-warn`, sev: 'warn', key, text, holdMs: 3000, on: (r) => num(r[key]) >= at('warn'), off: (r) => !(num(r[key]) >= at('warn') - back) },
  ];
}

// key: the channel the banner quotes (lean: how lean, for the mixture alarms); on(r) / off(r): true
// when the alarm should set / may clear.
export const ALARMS = [
  { id: 'oil-low', sev: 'red', key: 'oil_kpa', text: 'OIL PRESSURE LOW', holdMs: 1000,
    on: (r) => running(r) && r.rpm > 1000 && num(r.oil_kpa) !== null && r.oil_kpa < 70, off: (r) => !running(r) || r.oil_kpa > 85 },
  // the oil envelope (ranges.js OIL): about 10 psi (69 kPa) per 1000 rpm
  { id: 'oil-low-rpm', sev: 'warn', key: 'oil_kpa', text: 'OIL PRESSURE LOW FOR RPM', holdMs: 2000,
    on: (r) => running(r) && r.rpm > 1500 && num(r.oil_kpa) !== null && r.oil_kpa < oilMin(r.rpm), off: (r) => !running(r) || r.oil_kpa > oilMin(r.rpm) * 1.09 },
  ...tooHot('head', 'ect_c', 'HEAD TEMP HIGH', 5),
  ...tooHot('oilt', 'oil_temp_c', 'OIL TEMP HIGH', 3),
  // lean under load is what hurts an engine; light-throttle and overrun readings don't count
  { id: 'lean-red', sev: 'red', key: 'lambda', lean, text: 'LEAN UNDER LOAD', holdMs: 500,
    on: (r) => running(r) && (r.tps_pct ?? 0) > 50 && lean(r) > 0.08, off: (r) => !((r.tps_pct ?? 0) > 40 && lean(r) > 0.05) },
  { id: 'lean-warn', sev: 'warn', key: 'lambda', lean, text: 'LEAN UNDER LOAD', holdMs: 1000,
    on: (r) => running(r) && (r.tps_pct ?? 0) > 50 && lean(r) > 0.05, off: (r) => !((r.tps_pct ?? 0) > 40 && lean(r) > 0.03) },
  { id: 'fuel-low', sev: 'red', key: 'fuel_kpa', text: 'FUEL PRESSURE LOW', holdMs: 1000, on: (r) => running(r) && num(r.fuel_kpa) !== null && r.fuel_kpa < 250, off: (r) => !running(r) || r.fuel_kpa > 265 },
  { id: 'batt-red', sev: 'red', key: 'battery_v', text: 'BATTERY', holdMs: 5000, on: (r) => running(r) && num(r.battery_v) !== null && (r.battery_v < 11.8 || r.battery_v > 15.2), off: (r) => !running(r) || (r.battery_v > 12.2 && r.battery_v < 15) },
  { id: 'charge', sev: 'warn', key: 'battery_v', text: 'NOT CHARGING', holdMs: 10000, on: (r) => running(r) && r.rpm > 1500 && num(r.battery_v) !== null && r.battery_v < 12.6, off: (r) => !running(r) || r.battery_v > 13 },
];

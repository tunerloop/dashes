// kit/units.js: the app's kit/units.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Display units: the choices for each kind of reading, the conversion from the base unit the car
// sends (kPa, deg C, km/h, lambda), and the dial range in the chosen unit. Values, zones and valid
// ranges stay in base units everywhere else; only what is shown is converted. The choice is per
// device (localStorage), and a change tells the listeners so open gauges rebuild.
import { store } from './store.js';

export const STOICH = 14.7;          // petrol: AFR = lambda x 14.7

const same = (v) => v;
// kind: { name (the Settings row), def (the default option), options: { key: { name (the
// select's text), unit (after the number), dp (decimals), from (base unit to this one), word
// (optional: replaces "Lambda" in a channel's name, so "Lambda 1" shows as "AFR 1") } } }.
// The first option of each kind is its base unit.
export const UNITS = {
  pressure: { name: 'Pressure', def: 'psi', options: {
    kpa: { name: 'kPa', unit: 'kPa', dp: 0, from: same },
    bar: { name: 'bar', unit: 'bar', dp: 2, from: (v) => v / 100 },
    psi: { name: 'psi', unit: 'psi', dp: 0, from: (v) => v * 0.1450377 },
  } },
  temperature: { name: 'Temperature', def: 'f', options: {
    c: { name: '°C', unit: '°C', dp: 0, from: same },
    f: { name: '°F', unit: '°F', dp: 0, from: (v) => v * 9 / 5 + 32 },
  } },
  speed: { name: 'Speed', def: 'mph', options: {
    kmh: { name: 'km/h', unit: 'km/h', dp: 0, from: same },
    mph: { name: 'mph', unit: 'mph', dp: 0, from: (v) => v / 1.609344 },
  } },
  mixture: { name: 'Mixture', def: 'lambda', options: {
    lambda: { name: 'Lambda', unit: '', dp: 2, from: same },
    afr: { name: 'AFR', unit: 'AFR', dp: 1, from: (v) => v * STOICH, word: 'AFR' },
  } },
};

const KEY = 'ecuai-units';
const listeners = new Set();
let saved = null;                    // { kind: option key } as stored, read once

// The chosen option key for every kind, defaults filled in and unknown keys dropped.
export function units(raw) {
  if (raw === undefined) {
    if (saved === null) { try { saved = JSON.parse(store.get(KEY)) || {}; } catch { saved = {}; } }
    raw = saved;
  }
  return Object.fromEntries(Object.entries(UNITS).map(([kind, u]) => [kind, u.options[raw?.[kind]] ? raw[kind] : u.def]));
}

// In a dash's frame (no storage of its own): the choices the app sends.
export function useUnits(raw) { saved = { ...(raw || {}) }; }

export function setUnit(kind, key) {
  if (!UNITS[kind]?.options[key]) return;
  saved = { ...units(), [kind]: key };
  store.set(KEY, JSON.stringify(saved));
  for (const fn of listeners) fn(units());
}

// fn(choices) on every change; returns a function that stops it.
export function onUnitsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The option shown for a kind: { key, name, unit, dp, from, base }. choices: units() by default.
export function unitFor(kind, choices = units()) {
  const u = UNITS[kind];
  const key = u.options[choices[kind]] ? choices[kind] : u.def;
  return { key, ...u.options[key], base: key === Object.keys(u.options)[0] };
}

// A base-unit value in the chosen unit, and as text with that unit's decimals.
export const convert = (kind, v, choices) => unitFor(kind, choices).from(v);
export const format = (kind, v, choices) => { const u = unitFor(kind, choices); return u.from(v).toFixed(u.dp); };

// A round dial step near x: 1, 2 or 5 times a power of ten, the nearest on a log scale.
export function niceStep(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  const f = x / p;
  return +((f < Math.SQRT2 ? 1 : f < Math.sqrt(10) ? 2 : f < Math.sqrt(50) ? 5 : 10) * p).toPrecision(6);
}

// A dial from min to max (display units): about six round steps, the ends on a step.
export function dialRange(min, max) {
  const step = niceStep((max - min) / 6);
  const at = (v) => +(Math.round(v / step) * step).toPrecision(6);
  return { min: at(min), max: at(max), step };
}

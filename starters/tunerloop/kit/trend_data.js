// kit/trend_data.js: the app's kit/trend_data.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// The value panels' stored history, fetched when a view first needs it and kept for a while: the
// last hour (the trends function) and the last 30 days by day (trend_days). Views read it every
// frame, so a read never waits: it gives what is held and refreshes it behind the scenes.
import { CHANNELS, reading } from './channels.js';

const KEEP_MS = { hour: 30_000, days: 300_000 };
const held = new Map();
let source = null;   // { call(name, body), bridge() }

export const setTrendSource = (s) => { source = s; held.clear(); };

// One of the two history functions through the source: the app answers a dash frame's request with
// it (js/dash/requests.js); in the frame the dash's own source asks the app.
export function callTrend(name, body) {
  if (!source) return Promise.reject(new Error('no history source'));
  return source.call(name, { ...body, bridge: source.bridge() });
}

// A reading the history should count: valid for the channel and inside its trend.valid.
function counts(key, v) {
  const ch = CHANNELS[key], x = reading(ch, typeof v === 'string' ? Number(v) : v), w = ch.trend?.valid;
  return x !== null && (!w || (x >= w[0] && x <= w[1])) ? x : null;
}

async function fetchKind(kind, key) {
  const bridge = source.bridge();
  if (kind === 'hour') {
    const r = await source.call('trends', { bridge, minutes: 60, fields: [key] });
    return { rows: (r.rows || []).map((x) => ({ t: new Date(x.t).getTime(), v: counts(key, x[key]) })).filter((x) => x.v !== null) };
  }
  const ch = CHANNELS[key], [lo, hi] = ch.trend?.valid || ch.valid || [-1e6, 1e6];
  const r = await source.call('trend_days', { bridge, key, lo, hi });
  return { today: r.today, rows: (r.days || []).map((d) => ({ day: d.day, min: d.min, max: d.max, avg: d.avg, n: Number(d.n) })) };
}

// { rows, today, loaded } for 'hour' or 'days' of a channel.
export function trendData(kind, key) {
  if (!source) return { rows: [], loaded: true };
  const id = `${source.bridge()}:${kind}:${key}`;
  let e = held.get(id);
  if (!e) { e = { rows: [], loaded: false, at: 0, busy: false }; held.set(id, e); }
  if (!e.busy && Date.now() - e.at > KEEP_MS[kind]) {
    e.busy = true;
    fetchKind(kind, key).then((r) => Object.assign(e, r), () => {}).finally(() => { e.busy = false; e.loaded = true; e.at = Date.now(); });
  }
  return e;
}

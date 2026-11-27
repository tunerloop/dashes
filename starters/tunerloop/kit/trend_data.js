// kit/trend_data.js: the app's kit/trend_data.js as forked with tunerloop-dash. Yours to change.
// The value panels' stored history, fetched when a view first needs it and kept for a while: the
// last hour (the trends function), today in 15-minute buckets (trend_today) and the last 30 days by day
// (trend_days). Views read it every
// frame, so a read never waits: it gives what is held and refreshes it behind the scenes.
import { CHANNELS, reading } from './channels.js';

const KEEP_MS = { hour: 30_000, today: 60_000, days: 300_000 };
const held = new Map();
let source = null;   // { call(name, body), bridge() }

export const setTrendSource = (s) => { source = s; held.clear(); };

// One of the history functions through the source: the app answers a dash frame's request with
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
  if (kind === 'today') {
    const r = await source.call('trend_today', { bridge, key, lo, hi, running: true });
    return { rows: (r.buckets || []).map((b) => ({ at: new Date(b.at).getTime(), min: b.min, max: b.max, avg: b.avg, n: Number(b.n) })) };
  }
  const r = await source.call('trend_days', { bridge, key, lo, hi, running: true });   // engine running only: a parked car's zeros would be every pressure's min
  return { today: r.today, rows: (r.days || []).map((d) => ({ day: d.day, min: d.min, max: d.max, avg: d.avg, n: Number(d.n) })) };
}

// { rows, today, loaded } for 'hour', 'today' or 'days' of a channel.
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

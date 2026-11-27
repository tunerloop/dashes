// kit/hist.js: the app's kit/hist.js as forked with tunerloop-dash. Yours to change.
// A short history of the live reading on the phone, for the Car tab's detail views (the 10 s and
// 30 s charts, the compass cloud, the G trail, the temperature trends). Fast channels are sampled
// 25 times a second for 30 s; slow ones once a second for 15 minutes. A missing value is NaN. Peak g for this drive is kept too.
import { overrun } from './twin.js';

export class Ring {
  constructor(n) { this.n = n; this.a = new Float32Array(n).fill(NaN); this.i = 0; this.len = 0; }
  push(v) { this.a[this.i] = typeof v === 'number' && Number.isFinite(v) ? v : NaN; this.i = (this.i + 1) % this.n; if (this.len < this.n) this.len++; }
  at(k) { return this.a[(this.i - 1 - k + this.n * 2) % this.n]; }   // k = 0 is the newest
  avg(n) { let s = 0, c = 0; for (let k = 0; k < Math.min(n, this.len); k++) { const v = this.at(k); if (!Number.isNaN(v)) { s += v; c++; } } return c ? s / c : null; }
}

export const FAST_HZ = 25;
const FAST_KEYS = ['rpm', 'tps_pct', 'map_kpa', 'lambda1', 'lambda2', 'lambda_target', 'oil_kpa', 'speed_kmh', 'g_lat', 'g_long'];
// Every channel a glance page draws needs its 15 minutes here: a dash's VDO dial boxes, and what
// their charts add (throttle beside speed, rpm for oil pressure's least for the revs).
const SLOW_KEYS = ['ect_c', 'oil_temp_c', 'iat_c', 'battery_v', 'oil_kpa', 'speed_kmh', 'tps_pct', 'rpm', 'lambda1', 'lambda2', 'lambda_target'];

// Time with no readings is not stored: the rings simply stop, so the charts stop scrolling. Each stop
// longer than this is remembered as a break to mark on the chart.
const BREAK_MS = 3000;

export function createHistory() {
  const fast = Object.fromEntries(FAST_KEYS.map((k) => [k, new Ring(30 * FAST_HZ)]));
  const slow = Object.fromEntries(SLOW_KEYS.map((k) => [k, new Ring(900)]));
  const cut = new Ring(30 * FAST_HZ);
  const peak = { l: 0, r: 0, a: 0, b: 0 };
  const marks = { fast: { n: 0, last: -Infinity, list: [], size: 30 * FAST_HZ }, slow: { n: 0, last: -Infinity, list: [], size: 900 } };
  let clock = -Infinity;
  const stepped = (m, now) => {
    if (Number.isFinite(m.last) && now - m.last > BREAK_MS) m.list.push({ at: m.n, ms: now - m.last });
    m.last = now; m.n++;
    while (m.list.length && m.n - m.list[0].at > m.size) m.list.shift();
  };
  const rings = () => [...Object.entries(fast).map(([k, r]) => [`f:${k}`, r]), ...Object.entries(slow).map(([k, r]) => [`s:${k}`, r]), ['cut', cut]];
  return {
    fast, slow, cut, peak,
    // A copy of everything, for a dash starting up in its frame (it restores it there).
    snapshot() {
      return { rings: Object.fromEntries(rings().map(([k, r]) => [k, { a: r.a.slice(), i: r.i, len: r.len }])), peak: { ...peak }, marks: JSON.parse(JSON.stringify(marks)), clock };
    },
    restore(s) {
      for (const [k, r] of rings()) { const x = s?.rings?.[k]; if (x && x.a?.length === r.n) { r.a.set(x.a); r.i = x.i; r.len = x.len; } }
      Object.assign(peak, s?.peak || {});
      for (const kind of ['fast', 'slow']) {
        const m = s?.marks?.[kind];
        if (m) Object.assign(marks[kind], { n: m.n, last: m.last ?? -Infinity, list: m.list || [] });
      }
      clock = s?.clock ?? clock;
    },
    tick(now) { clock = now; },   // the time now, when no reading came with it
    // The breaks in the newest span samples of 'fast' or 'slow', newest first: [{k, ms}], the break lying
    // just older than sample k. k -1: no reading is coming in right now.
    breaks(kind, span) {
      const m = marks[kind], out = [];
      if (Number.isFinite(m.last) && clock - m.last > BREAK_MS) out.push({ k: -1, ms: clock - m.last });
      for (let i = m.list.length - 1; i >= 0; i--) {
        const k = m.n - 1 - m.list[i].at;
        if (k + 1 < span) out.push({ k, ms: m.list[i].ms });
      }
      return out;
    },
    // r: the reading (base units, phone values included); now: ms.
    push(r, now) {
      clock = now;
      if (now - marks.fast.last >= 1000 / FAST_HZ) {
        stepped(marks.fast, now);
        for (const k of FAST_KEYS) fast[k].push(r?.[k]);
        cut.push(overrun(r) ? 1 : 0);
        const x = r?.g_lat, y = r?.g_long;
        if (typeof x === 'number' && typeof y === 'number') {
          peak.r = Math.max(peak.r, x); peak.l = Math.max(peak.l, -x); peak.a = Math.max(peak.a, y); peak.b = Math.max(peak.b, -y);
        }
      }
      if (now - marks.slow.last >= 1000) { stepped(marks.slow, now); for (const k of SLOW_KEYS) slow[k].push(r?.[k]); }
    },
  };
}

export const hist = createHistory();

// kit/trend_rules.js: the app's kit/trend_rules.js as forked with tunerloop-dash. Yours to change.
// The value panels' history as plain functions (no DOM), checked by tests/unit/trend-rules.test.js:
// min and max, the rate of the current climb or fall, and a chart range that holds still.

// Min and max of a list of numbers (gaps skipped), or null when there are none.
export function summarize(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return xs.length ? { min: Math.min(...xs), max: Math.max(...xs) } : null;
}

// The straight-line change per unit of x through [[x, y], ...], or null with under two distinct x.
export function slope(points) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const [x, y] of points) { sx += x; sy += y; sxy += x * y; sxx += x * x; }
  const d = n * sxx - sx * sx;
  return d > 0 ? (n * sxy - sx * sy) / d : null;
}

// The rate of the climb or fall happening now, never averaged across a peak or a dip. points: [[t, v]]
// oldest first. A turn counts once the value comes back minMove from its extreme, so noise doesn't
// start a new run; a break longer than maxGapMs starts one too. Only the newest maxMs of the run is
// measured. {rate (per ms), ms}, or null when the run is too short to say.
export function runTrend(points, { minMove, maxGapMs = Infinity, maxMs = Infinity, minMs = 0, minPoints = 3 }) {
  if (!points.length) return null;
  let start = 0, dir = 0, ext = 0, hi = 0, lo = 0;
  points.forEach(([t, v], i) => {
    if (i && t - points[i - 1][0] > maxGapMs) { start = ext = hi = lo = i; dir = 0; return; }
    if (dir === 0) {
      if (v > points[hi][1]) hi = i;
      if (v < points[lo][1]) lo = i;
      if (points[hi][1] - points[lo][1] >= minMove) { dir = hi > lo ? 1 : -1; start = dir > 0 ? lo : hi; ext = dir > 0 ? hi : lo; }
    } else if (dir * (v - points[ext][1]) > 0) ext = i;
    else if (dir * (points[ext][1] - v) >= minMove) { start = ext; dir = -dir; ext = i; }
  });
  const end = points[points.length - 1][0];
  while (end - points[start][0] > maxMs) start++;
  const part = points.slice(start), ms = end - part[0][0];
  if (part.length < minPoints || ms < minMs) return null;
  const rate = slope(part.map(([t, v]) => [t - part[0][0], v]));
  return rate === null ? null : { rate, ms };
}

// The smallest of 1, 2, or 5 x 10^n that is at least x.
function niceStep(x) {
  const m = 10 ** Math.floor(Math.log10(x)), f = x / m;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * m;
}

// A chart range on round numbers, at least minSpan tall, that only moves when a value leaves it, so
// the line doesn't rescale with every reading. {lo, hi, step}, or null with no values.
export function niceRange(values, minSpan) {
  const s = summarize(values);
  if (!s) return null;
  const step = niceStep(Math.max(minSpan / 2, (s.max - s.min) / 4));
  const lo = Math.floor((s.min - step * 0.1) / step) * step;
  let hi = Math.ceil((s.max + step * 0.1) / step) * step;
  if (hi - lo < minSpan) hi = lo + Math.ceil(minSpan / step) * step;
  return { lo, hi, step };
}

// How long a gap was, as a short label: "20 s", "17 min", "3 h", "2 d".
export function gapText(ms) {
  if (ms < 59_500) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(ms / 3_600_000);
  return h < 24 ? `${h} h` : `${Math.round(ms / 86_400_000)} d`;
}

// How many samples a chart that grows spans: the samples there are, at least least and at most most,
// so a chart that has only just started fills its width and then scrolls once it is full.
export const growSpan = (have, most, least = 10) => Math.max(least, Math.min(most, have));

// The glance over a value's chart: from one reading a second, newest first (NaN where none), the
// reading now (its newest 3 averaged), its rate per second (runTrend over the newest 5 minutes),
// the highest, and while it is under warmAt the seconds until it gets there at that rate (null
// while it isn't climbing; undefined once warm). minMove: the least change that counts as a trend.
export function glance(vals, { warmAt = null, minMove = 1 } = {}) {
  const points = [];
  for (let k = vals.length - 1; k >= 0; k--) if (Number.isFinite(vals[k])) points.push([-k * 1000, vals[k]]);
  if (!points.length) return null;
  const last = points.slice(-3), now = last.reduce((s, [, v]) => s + v, 0) / last.length;
  const t = runTrend(points, { minMove, maxGapMs: 10_000, maxMs: 300_000, minMs: 20_000 });
  const rate = t ? t.rate * 1000 : null;
  const warming = warmAt !== null && now < warmAt;
  return { now, rate, max: Math.max(...points.map(([, v]) => v)), warmS: !warming ? undefined : rate > 0 ? (warmAt - now) / rate : null };
}

// A time to go: m:ss under 10 minutes, whole minutes after ("14m"), "--:--" for none. Never wider than "8:88".
export function etaText(s) {
  if (s === null || s === undefined || !Number.isFinite(s)) return '--:--';
  const t = Math.max(0, Math.round(s));
  return t < 600 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `${Math.min(99, Math.ceil(t / 60))}m`;
}

// Stored buckets (oldest first, each { at, ... } with at its start in ms) as a chart's series: the
// buckets newest first, and a break wherever whole buckets are missing between two held ones (the
// chart gives a gap one small mark with its length, collapseGaps). stepMs: one bucket's length.
export function bucketSeries(rows, stepMs) {
  const pts = [...rows].sort((a, b) => b.at - a.at), breaks = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const missing = Math.round((pts[k].at - pts[k + 1].at) / stepMs) - 1;
    if (missing > 0) breaks.push({ k, ms: missing * stepMs });
  }
  return { pts, breaks };
}

// The lowest min, the highest max and the reading-weighted average of a set of buckets ({ min, max,
// avg, n }), or null.
export function bucketSummary(rows) {
  const held = rows.filter((r) => Number.isFinite(r.max) && Number.isFinite(r.avg));
  if (!held.length) return null;
  const n = held.reduce((t, r) => t + (r.n || 1), 0), mins = held.map((r) => (Number.isFinite(r.min) ? r.min : r.avg));
  return { min: Math.min(...mins), max: Math.max(...held.map((r) => r.max)), avg: held.reduce((t, r) => t + r.avg * (r.n || 1), 0) / n };
}

// A ring of one sample a second (newest first, get(k)) as bins of B seconds, newest first: each bin's
// average, lowest and highest of its finite samples (NaN for a bin with none). n: samples to use.
export function binSeries(get, n, B) {
  const avg = [], min = [], max = [];
  for (let b = 0; b * B < n; b++) {
    let s = 0, c = 0, lo = Infinity, hi = -Infinity;
    for (let k = b * B; k < Math.min((b + 1) * B, n); k++) { const x = get(k); if (Number.isFinite(x)) { s += x; c++; lo = Math.min(lo, x); hi = Math.max(hi, x); } }
    avg.push(c ? s / c : NaN); min.push(c ? lo : NaN); max.push(c ? hi : NaN);
  }
  return { avg, min, max };
}
// The bin size that keeps a chart of secs seconds near `points` points.
export const binSize = (secs, points = 90) => Math.max(1, Math.round(secs / points));

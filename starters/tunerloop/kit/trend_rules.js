// kit/trend_rules.js: the app's kit/trend_rules.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
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

// The days' rows ({day, min, max, avg, n}) as one min and max.
export function summarizeDays(days) {
  return days.length ? { min: Math.min(...days.map((d) => d.min)), max: Math.max(...days.map((d) => d.max)) } : null;
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

// Day slots (present[k], k = 0 today) packed side by side: missing days take no room, each run of them
// is one break. Oldest empty days are dropped.
//   slots: per chart position, the day it shows; breaks: [{k, ms}], k the position the break sits before.
export function collapseGaps(present, slotMs) {
  const slots = [], breaks = [];
  let last = present.length - 1;
  while (last >= 0 && !present[last]) last--;
  for (let k = 0; k <= last; k++) {
    if (present[k]) { slots.push(k); continue; }
    let j = k;
    while (!present[j + 1]) j++;
    breaks.push({ k: slots.length, ms: (j - k + 1) * slotMs });
    k = j;
  }
  return { slots, breaks };
}

// Sample times (ms, oldest first) with every break longer than maxGapMs cut out, leaving a mark px wide
// on a plot plotPx wide showing activeMs of data (default: all of it). xs: the chart's x per sample;
// gaps: [{from, to, ms}] in x; width: a mark's width in x; real(x): the true time at a chart x.
export function collapseTimes(tms, maxGapMs, { px = 0, plotPx = 0, activeMs = null } = {}) {
  let active = 0, count = 0;
  for (let i = 1; i < tms.length; i++) { const d = tms[i] - tms[i - 1]; if (d <= maxGapMs) active += d; else count++; }
  const held = activeMs ?? active;
  const width = px && held > 0 ? held * px / Math.max(plotPx * 0.5, plotPx - count * px) : maxGapMs;
  const xs = [], gaps = [], anchors = [];
  let shift = 0;
  tms.forEach((t, i) => {
    const d = i ? t - tms[i - 1] : 0;
    if (i && d > maxGapMs) {
      const from = xs[i - 1];
      shift += d - width;
      gaps.push({ from, to: t - shift, ms: d });
      anchors.push([t - shift, t]);
    } else if (!i) anchors.push([t, t]);
    xs.push(t - shift);
  });
  const real = (x) => {
    let a = anchors[0];
    for (const c of anchors) { if (c[0] <= x) a = c; else break; }
    return a ? a[1] + (x - a[0]) : x;
  };
  return { xs, gaps, width, real };
}

// How long a gap was, as a short label: "20 s", "17 min", "3 h", "2 d".
export function gapText(ms) {
  if (ms < 59_500) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(ms / 3_600_000);
  return h < 24 ? `${h} h` : `${Math.round(ms / 86_400_000)} d`;
}

// Readings [{t, v}] (oldest first) packed onto a chart of span positions, k = 0 newest: time with no
// readings takes no room. Breaks come only from the readings' own times, so they don't change as the
// clock moves; time since the newest reading is one too (k -1) once it passes maxGapMs.
// {at: value per k (NaN none), ts: its readings' mean time (ms), breaks: [{k, ms}] newest first, k the position just newer than the break}.
export function timeChart(points, now, maxGapMs, span) {
  const at = new Float64Array(span).fill(NaN), breaks = [];
  if (!points.length) return { at, ts: new Float64Array(span).fill(NaN), breaks };
  let active = 0;
  for (let i = 1; i < points.length; i++) { const d = points[i].t - points[i - 1].t; if (d <= maxGapMs) active += d; }
  const hop = active / Math.max(1, span - 2), xs = [0];      // a break is one position wide, so the two sides stay apart
  for (let i = 1; i < points.length; i++) { const d = points[i].t - points[i - 1].t; xs.push(xs[i - 1] + (d > maxGapMs ? hop : d)); }
  const x1 = xs[xs.length - 1], K = (x) => (x1 > 0 ? Math.round((x1 - x) / x1 * (span - 1)) : 0);
  const sum = new Float64Array(span), tsum = new Float64Array(span), n = new Uint16Array(span), ts = new Float64Array(span).fill(NaN);
  points.forEach((p, i) => { const k = K(xs[i]); sum[k] += p.v; tsum[k] += p.t; n[k]++; });
  for (let k = 0; k < span; k++) if (n[k]) { at[k] = sum[k] / n[k]; ts[k] = tsum[k] / n[k]; }
  const idle = now - points[points.length - 1].t;
  if (idle > maxGapMs) breaks.push({ k: -1, ms: idle });
  for (let i = points.length - 1; i > 0; i--) { const d = points[i].t - points[i - 1].t; if (d > maxGapMs) breaks.push({ k: K(xs[i]), ms: d }); }
  return { at, ts, breaks };
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

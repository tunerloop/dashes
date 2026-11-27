// kit/trend_views.js: the app's kit/trend_views.js as forked with tunerloop-dash. Yours to change.
// The glance pages of a dash's VDO dial boxes (kit/gauge.js makeGlance), all in one look: two big
// numbers over an amber window with a chart, the reading now as a tag on its newest point; the last 15
// minutes from the phone's own history, today and the last 30 days from the hub's (trend_data.js).
// Time with no data takes no room: each gap is one small mark with its length. Also the last minute
// along the bottom of a value panel (drawRecent).
import { hist } from './hist.js';
import { CHANNELS, warmAt } from './channels.js';
import { oilMin } from './oil.js';
import { prep, themeOf, trace, signed } from './kit.js';
import { niceRange, gapText, glance, etaText, growSpan, bucketSeries, bucketSummary, binSeries, binSize } from './trend_rules.js';
import { view, grid, gridText, valText, glanceStyle, isTemp, cell, widestText, glanceFrame } from './glance_frame.js';
import { trendData } from './trend_data.js';
import { clock12 } from './time.js';

const DAY_MS = 86_400_000, DAYS = 30;
// The mouse's label (canvas_tip.js): how long ago sample k of a ring of one a second was taken,
// counting the breaks newer than it (hist.breaks), and the reading.
export function agoText(k, breaks) {
  const s = Math.round(k + breaks.reduce((t, b) => t + (b.k < k ? b.ms / 1000 : 0), 0));
  if (s < 1) return 'Now';
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min${s % 60 ? ` ${s % 60} s` : ''} ago` : `${gapText(s * 1000)} ago`;
}
const ringTip = (ch, breaks) => (k, v) => [agoText(k, breaks), valText(ch, v)];

// The last secs of a channel on a panel's canvas (one sample a second).
export function drawRecent(cv, key, secs, timeLabel) {
  const c = prep(cv); if (!c) return;
  const [g, w, h] = c, T = themeOf(cv), { ch, conv, minSpan } = view(key), ring = hist.slow[key], vals = [];
  for (let k = 0; k < Math.min(secs, ring.len); k++) vals.push(conv(ring.at(k)));
  const r = niceRange(vals, minSpan) || { lo: ch.min, hi: ch.max, step: (ch.max - ch.min) / 2 }, breaks = hist.breaks('slow', secs);
  trace(g, T, 0, 0, w, h, { breaks, span: secs, lo: r.lo, hi: r.hi, grid: grid(r), gridLabel: gridText(r), timeLabel, tip: ringTip(ch, breaks),
    series: [{ fn: (k) => (k < ring.len ? conv(ring.at(k)) : NaN), color: T.chartLine || T.fg, w: 2.5, fill: T.chartFill || T.fg, alpha: T.chartFillAlpha ?? 0.08, glow: T.chartGlow }] });
}

// A dial box's graphs pages (gauge.js makeGlance), all in one look: two numbers over a chart in one
// window, dashed lines at the warm-up temperature and Hot (where the red zone starts), each labelled,
// and the reading now as a tag riding the line's newest point, in place of a value axis. The numbers
// take the type scale's big step, or the largest under it their widest values fit (kit.js typeScale).
// view: 'recent' (the last 15 minutes, one point a second), 'today' (15-minute buckets since
// midnight) or 'days' (one point a day for 30 days); stored ones from the hub (trend_data.js), time
// with no data one small mark with its length.
export function drawGlanceView(cv, key, view = 'recent') {
  (view === 'today' ? glanceToday : view === 'days' ? glanceDays : drawGlance)(cv, key);
}

// The last 15 minutes (the chart's time axis grows from 10 s as readings come in, so the line spans
// it from the start), the trend in whole degrees a minute and, while it is under its warm-up
// temperature, how long until it gets there at that rate (m:ss, then minutes), once warm the highest
// of the 15 minutes.
export function drawGlance(cv, key, most = 900) {
  const v = view(key), { ch, conv, delta, base } = v, ring = hist.slow[key], temp = isTemp(base);
  const secs = growSpan(ring.len, most);   // the time axis grows with the data, from 10 s up to 15 minutes, so the line always fills it
  const n = Math.min(secs, ring.len), raw = []; for (let k = 0; k < n; k++) raw.push(ring.at(k));
  const s = glance(raw, { warmAt: temp ? warmAt(base) : null, minMove: (base.trend?.span ?? 20) / 20 }), warming = s && s.warmS !== undefined;
  const vals = raw.map(conv), held = vals.filter(Number.isFinite), lo = held.length ? Math.min(...held) : null;
  const avg = held.length ? held.reduce((t, x) => t + x, 0) / held.length : null, hi = s ? conv(s.max) : null;
  // Drawn in bins of B seconds (about 90 points), so a busy reading stays readable over 15 minutes:
  // each bin's average as the line, and for a pressure its lowest dashed (a dip stays seen).
  const B = binSize(secs), bins = binSeries((k) => vals[k], n, B), span = Math.max(2, Math.ceil(secs / B));
  const style = glanceStyle(base), at = (k) => bins.avg[k] ?? NaN, under = style.recentEdge ? (k) => bins[style.recentEdge][k] ?? NaN : null;
  const rawBreaks = hist.breaks('slow', secs), breaks = rawBreaks.map((b) => ({ ...b, k: b.k < 0 ? b.k : Math.floor(b.k / B) }));
  const { extra, second, alsoAvg } = glanceAdds(v, n, B), stat = { min: lo, max: hi, avg, alsoAvg };
  const cells = temp ? [['Trend', s && s.rate !== null ? signed(delta(s.rate * 60), 0) : '-', `${ch.unit}/min`],
    warming ? ['Warm in', etaText(s.warmS), '', 'cold'] : cell('Max', v, hi)] : style.recent.map(([k, name]) => cell(name, v, stat[k]));
  const tip = ringTip(ch, rawBreaks);
  glanceFrame(cv, key, {
    cells, widest: temp ? ['+88', '8:88', wide(v)] : [wide(v)], warming, span, vals: [...bins.avg, ...(under ? bins[style.recentEdge] : []), ...extra.vals], at, under, breaks,
    timeLabel: gapText(secs * 1000), tip: (k, val) => tip(k * B, val), now: s ? conv(s.now) : null, extra: extra.series, second, seconds: secs, mainLabel: extra.mainLabel,
  });
}
const wide = (v) => widestText(v);

// What a channel's 15 minutes adds, from the dash's ranges (glance), in the same bins: revMin, the
// least oil pressure that's normal for the revs (kit/oil.js oilMin of each bin's average rpm, only
// with the engine running), as a thin red line in the channel's own units; second, another channel
// on its own scale (its catalogue range), as a thin line with its name in the corner.
function glanceAdds(v, n, B) {
  const extra = { series: [], vals: [] }, g = v.base.glance || {}, ringOf = (k) => (r) => (k < r.len ? r.at(k) : NaN);
  if (g.revMin && hist.slow.rpm) {
    const rpm = binSeries((k) => ringOf(k)(hist.slow.rpm), n, B).avg, line = rpm.map((r) => (r > 300 ? v.conv(oilMin(r)) : NaN));
    extra.series.push({ fn: (k) => line[k] ?? NaN, color: 'red', w: 1.5, label: 'Normal min' });
    extra.vals.push(...line.filter(Number.isFinite));
  }
  const paired = pairedLines(v, (key) => {
    const ring = hist.slow[key];
    if (!ring) return null;
    const line = binSeries((k) => ringOf(k)(ring), n, B).avg.map((x) => v.conv(x)), held = line.filter(Number.isFinite);
    return { line, avg: held.length ? held.reduce((t, x) => t + x, 0) / held.length : null };
  });
  extra.series.push(...paired.series); extra.vals.push(...paired.vals); extra.mainLabel = paired.mainLabel;
  const k2 = g.second, c2 = k2 && CHANNELS[k2], ring2 = k2 && hist.slow[k2];
  const b2 = ring2 ? binSeries((k) => ringOf(k)(ring2), n, B).avg : null;
  const second = c2 && b2 ? { at: (k) => b2[k] ?? NaN, lo: c2.min, hi: c2.max, label: `${c2.short || c2.label}${c2.unit ? ` ${c2.unit}` : ''}` } : null;
  return { extra, second, alsoAvg: paired.alsoAvg };
}

// The lines the dash's ranges pair with a channel (glance.also, glance.target: Lambda's bank 2 and the
// target), each from lineOf(key): { line (display values, one per point of the chart), avg }.
const PAIRED = [['also', { color: 'cold', w: 2.5, label: 'Bank 2' }], ['target', { color: 'label', w: 1.5, dash: [4, 4], label: 'Target' }]];
function pairedLines(v, lineOf) {
  const g = v.base.glance || {}, series = [], vals = [];
  let alsoAvg = null;
  for (const [name, look] of PAIRED) {
    const got = g[name] ? lineOf(g[name]) : null;
    if (!got) continue;
    series.push({ fn: (k) => got.line[k] ?? NaN, ...look });
    vals.push(...got.line.filter(Number.isFinite));
    if (name === 'also') alsoAvg = got.avg;
  }
  return { series, vals, alsoAvg, mainLabel: g.also ? 'Bank 1' : null };
}

// Stored buckets ({ at, min, max, avg, n }) in the same look: each bucket's average as the line,
// and a thin dashed line for the side that matters (a temperature's max, anything else's min), with
// the summary on top (see cell). gaps: mark missing buckets as a gap (today's parked time); off, held
// buckets simply follow each other (the days driven, so a day at home doesn't chop the 30 days up).
function glanceBuckets(cv, key, d, stepMs, timeLabel, when, gaps = true) {
  const v = view(key), { ch, conv, base } = v, { pts, breaks: all } = bucketSeries(d.rows, stepMs), breaks = gaps ? all : [], sum = bucketSummary(pts);
  const style = glanceStyle(base), edge = style.edge, edgeName = edge === 'max' ? 'Max' : 'Min', c = (k) => (sum ? conv(sum[k]) : null);
  const at = (k) => (k < pts.length ? conv(pts[k].avg) : NaN), side = edge ? (k) => (k < pts.length ? conv(pts[k][edge] ?? pts[k].avg) : NaN) : null;
  const { series: extra, vals: extraVals, alsoAvg, mainLabel } = bucketAdds(v, pts, d.kind);
  const stat = { ...(sum || {}), alsoAvg }, c2 = (k) => (k === 'alsoAvg' ? alsoAvg : c(k));
  const cells = style.stored.map(([k, name]) => cell(name, v, c2(k)));
  glanceFrame(cv, key, {
    cells, widest: [widestText(v)], warming: false, span: Math.max(2, pts.length), vals: [...pts.flatMap((q) => [conv(q.avg), conv(q[edge] ?? q.avg)]), ...extraVals], at, breaks,
    timeLabel, tip: (k, val) => [when(pts[k]), `Avg ${valText(ch, val)}`, ...(side ? [`${edgeName} ${valText(ch, side(k))}`] : [])], under: side, extra, mainLabel,
    now: pts.length ? at(0) : null, note: pts.length ? null : d.loaded ? 'No data' : 'Loading', tight: true,
  });
}
// The stored buckets of a channel with their start in ms (at), for 'today' or 'days'.
function bucketsOf(kind, key) {
  const d = trendData(kind, key);
  return kind === 'days' ? { ...d, kind, rows: d.rows.map((x) => ({ ...x, at: Date.parse(`${x.day}T00:00:00Z`) })) } : { ...d, kind };
}
// What stored buckets add from the dash's ranges (pairedLines), each matched to the main channel's
// buckets by start time.
function bucketAdds(v, pts, kind) {
  return pairedLines(v, (key) => {
    if (!kind) return null;
    const rows = bucketsOf(kind, key).rows, byAt = new Map(rows.map((q) => [q.at, q])), s = bucketSummary(rows);
    return { line: pts.map((q) => { const x = byAt.get(q.at); return x ? v.conv(x.avg) : NaN; }), avg: s ? v.conv(s.avg) : null };
  });
}
const QUARTER_MS = 15 * 60_000;
function glanceToday(cv, key) {
  glanceBuckets(cv, key, bucketsOf('today', key), QUARTER_MS, 'Today', (q) => `${clock12(q.at)} to ${clock12(q.at + QUARTER_MS)}`);
}
function glanceDays(cv, key) {
  const d = bucketsOf('days', key);
  glanceBuckets(cv, key, d, DAY_MS, `${d.rows.length} of ${DAYS} days`, (q) => dayText(q.day), false);
}

// "Tue Nov 24" for a day's "2026-11-24" (the day as stored, not moved by the time zone).
const dayText = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '');

// kit/trend_views.js: the app's kit/trend_views.js as forked with tunerloop-dash. Yours to change.
// The value panels' charts (battery, head temp, oil temp): the last minute along the bottom of the
// panel, then full screen the last hour and the last 30 days by day, each with now, min, max, and the
// trend of the current climb or fall (trend_rules.js runTrend). Time with no data takes no room: each gap is one small mark with its length.
import { hist } from './hist.js';
import { CHANNELS, shown, warmAt } from './channels.js';
import { oilMin } from './oil.js';
import { steadyText } from './steady.js';
import { prep, themeOf, typeScale, font, text, label, fixed, fixedWidth, trace, axes, line, signed, twoCharts, GAP_PX } from './kit.js';
import { summarize, summarizeDays, runTrend, niceRange, collapseGaps, gapText, timeChart, glance, etaText, growSpan, bucketSeries, bucketSummary, binSeries, binSize } from './trend_rules.js';
import { trendData } from './trend_data.js';
import { addTip, nearest } from './canvas_tip.js';
import { clock12 } from './time.js';

const HOUR_MS = 3_600_000, DAY_MS = 86_400_000, GAP_MS = 90_000, TREND_MAX_MS = 15 * 60_000, HOUR_POINTS = 240, DAYS = 30;
const num = (v) => (v === null || v === undefined ? NaN : v);

// A channel's display conversions, its least chart height, and the grid inside a range.
function view(key) {
  const base = CHANNELS[key], ch = shown(base), conv = (v) => num(ch.value(v));
  const delta = (d) => conv(base.min + d) - conv(base.min);
  const span = base.trend?.span ?? (base.max - base.min) / 4;   // a dash's ranges give it; else a quarter of the scale
  return { base, ch, conv, delta, span, minSpan: Math.abs(delta(span)) };
}
function grid(r) {
  const out = [];
  for (let v = r.lo + r.step; v < r.hi - r.step * 0.01; v += r.step) out.push(v);
  return out;
}
const gridText = (r) => (v) => v.toFixed(r.step < 1 ? 1 : 0);

// The mouse's label (canvas_tip.js): a reading with its unit, and how long ago sample k of a ring of one a
// second was taken, counting the breaks newer than it (hist.breaks).
const valText = (ch, v) => `${v.toFixed(ch.dp ?? 0)}${ch.unit ? ` ${ch.unit}` : ''}`;
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
  const at = (k) => bins.avg[k] ?? NaN, under = base.kind === 'pressure' ? (k) => bins.min[k] ?? NaN : null;
  const rawBreaks = hist.breaks('slow', secs), breaks = rawBreaks.map((b) => ({ ...b, k: b.k < 0 ? b.k : Math.floor(b.k / B) }));
  const cells = base.kind === 'speed' ? [cell('Max', v, hi), cell('Avg', v, avg)] : !temp ? [cell('Min', v, lo), cell('Max', v, hi)]
    : [['Trend', s && s.rate !== null ? signed(delta(s.rate * 60), 0) : '-', `${ch.unit}/min`],
      warming ? ['Warm in', etaText(s.warmS), '', 'cold'] : cell('Max', v, hi)];
  const { extra, second } = glanceAdds(v, n, B);
  const tip = ringTip(ch, rawBreaks);
  glanceFrame(cv, key, {
    cells, widest: temp ? ['+88', '8:88', wide(v)] : [wide(v)], warming, span, vals: [...bins.avg, ...(under ? bins.min : []), ...extra.vals], at, under, breaks,
    timeLabel: gapText(secs * 1000), tip: (k, val) => tip(k * B, val), now: s ? conv(s.now) : null, extra: extra.series, second, seconds: secs,
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
  const k2 = g.second, c2 = k2 && CHANNELS[k2], ring2 = k2 && hist.slow[k2];
  const b2 = ring2 ? binSeries((k) => ringOf(k)(ring2), n, B).avg : null;
  const second = c2 && b2 ? { at: (k) => b2[k] ?? NaN, lo: c2.min, hi: c2.max, label: `${c2.short || c2.label}${c2.unit ? ` ${c2.unit}` : ''}` } : null;
  return { extra, second };
}

// What a channel's glance pages lead with. A temperature: how fast it climbs and its highest, then
// its highest and average. A pressure, where low is the danger: its lowest and highest, then its
// lowest and average. Anything else (the battery): its lowest and highest.
const isTemp = (base) => base.kind === 'temperature';
function cell(k, v, x) { return [k, x === null || x === undefined || !Number.isFinite(x) ? '-' : x.toFixed(v.ch.dp ?? 0), v.ch.unit]; }
// The widest a channel's number gets in display units, as 8s, so the size step holds still.
function widestText(v) { return [v.base.min, v.base.max].map((x) => Math.abs(v.conv(x)).toFixed(v.ch.dp ?? 0)).sort((a, b) => b.length - a.length)[0].replace(/\d/g, '8'); }

// Stored buckets ({ at, min, max, avg, n }) in the same look: each bucket's average as the line,
// and a thin dashed line for the side that matters (a temperature's max, anything else's min), with
// the summary on top (see cell). gaps: mark missing buckets as a gap (today's parked time); off, held
// buckets simply follow each other (the days driven, so a day at home doesn't chop the 30 days up).
function glanceBuckets(cv, key, d, stepMs, timeLabel, when, gaps = true) {
  const v = view(key), { ch, conv, base } = v, { pts, breaks: all } = bucketSeries(d.rows, stepMs), breaks = gaps ? all : [], sum = bucketSummary(pts);
  const temp = isTemp(base), edge = temp ? 'max' : 'min', edgeName = temp ? 'Max' : 'Min', c = (k) => (sum ? conv(sum[k]) : null);
  const at = (k) => (k < pts.length ? conv(pts[k].avg) : NaN), side = (k) => (k < pts.length ? conv(pts[k][edge] ?? pts[k].avg) : NaN);
  const cells = temp ? [cell('Max', v, c('max')), cell('Avg', v, c('avg'))] : base.kind === 'pressure' ? [cell('Min', v, c('min')), cell('Avg', v, c('avg'))]
    : [cell('Min', v, c('min')), cell('Max', v, c('max'))];
  glanceFrame(cv, key, {
    cells, widest: [widestText(v)], warming: false, span: Math.max(2, pts.length), vals: pts.flatMap((q) => [conv(q.avg), conv(q[edge] ?? q.avg)]), at, breaks,
    timeLabel, tip: (k, val) => [when(pts[k]), `Avg ${valText(ch, val)}`, `${edgeName} ${valText(ch, side(k))}`], under: side,
    now: pts.length ? at(0) : null, note: pts.length ? null : d.loaded ? 'No data' : 'Loading', tight: true,
  });
}
const QUARTER_MS = 15 * 60_000;
function glanceToday(cv, key) {
  glanceBuckets(cv, key, trendData('today', key), QUARTER_MS, 'Today', (q) => `${clock12(q.at)} to ${clock12(q.at + QUARTER_MS)}`);
}
function glanceDays(cv, key) {
  const d = trendData('days', key), rows = d.rows.map((x) => ({ ...x, at: Date.parse(`${x.day}T00:00:00Z`) }));
  glanceBuckets(cv, key, { ...d, rows }, DAY_MS, `${rows.length} of ${DAYS} days`, (q) => dayText(q.day), false);
}

// The dashed lines across a glance chart, from the dash's zones: a temperature's warm-up point
// (Warm), and each red zone's edge: Low where it starts at the bottom of the scale, else Hot (a
// temperature) or High. While warming up only Warm shows.
export function zoneLines(v, T, warming = false) {
  const { base, conv, ch } = v, out = [], fmt = (x) => conv(x).toFixed(ch.dp ?? 0), warm = isTemp(base) ? warmAt(base) : null;
  if (warm !== null) out.push({ v: conv(warm), color: T.cold, label: `Warm ${fmt(warm)}` });
  if (warming) return out;
  for (const [lo, hi] of base.red || []) {
    if (lo <= base.min + 1e-9) out.push({ v: conv(hi), color: T.red, label: `Low ${fmt(hi)}` });
    else out.push({ v: conv(lo), color: T.red, label: `${isTemp(base) ? 'Hot' : 'High'} ${fmt(lo)}` });
  }
  return out;
}

// The frame all three share. o: { cells: [[label, text, unit, 'cold'?]], widest (each cell's widest
// text, so the size step holds still as they change), warming, span, vals (for the range), at(k) (the
// line, newest first), under(k)? (a thin dashed line), breaks, timeLabel, tip, now (the newest
// point's value, null for none), note? (said across an empty chart) }.
function glanceFrame(cv, key, o) {
  const c = prep(cv); if (!c) return;
  const [g, w, h] = c, T = themeOf(cv), Z = typeScale(w, h), v = view(key), { ch, conv } = v;
  const num = T.chartNum || T.fg, p = Math.max(8, Math.min(w, h) * 0.05), cw = (w - p) / 2, lbl = Math.min(Z.lbl, cw * 0.14);   // the columns reach half a pad into the sides
  const step = ['big', 'value', 'small'].find((n) => Z[n] <= h * 0.3 && o.widest.every((t) => fixedWidth(g, t, font(T, Z[n])) <= cw * 0.9)) ?? 'small';
  const size = Z[step];
  cv.dataset.step = step; cv.dataset.span = o.seconds ?? o.span;   // the size step and the span shown (seconds for the 15 minutes), for scripts/browser/glance.mjs
  const numY = p + lbl * 1.4 + size * 0.82, band = numY + lbl * 1.6 - p;
  o.cells.forEach(([k, t, unit, tone], i) => {
    const cx = p / 2 + cw * i + cw / 2, color = tone === 'cold' ? T.cold : num;
    label(g, T, k, cx, p + lbl, lbl, T.label, 'center');
    g.save(); g.shadowColor = T.chartLine || color; g.shadowBlur = T.chartGlow;
    fixed(g, t, cx, numY, font(T, size), color, 0, 'center');
    g.restore();
    if (unit) label(g, T, unit, cx, numY + lbl * 1.5, lbl, T.label, 'center');
  });
  const cy = p + band + p * 0.6, cwid = w - 2 * p, chh = h - cy - p, levels = zoneLines(v, T, o.warming);
  const r = niceRange([...o.vals, ...levels.map((l) => l.v)], v.minSpan) || { lo: ch.min, hi: ch.max, step: (ch.max - ch.min) / 2 };
  const line = T.chartLine || T.fg, series = [{ fn: o.at, color: line, w: 2.5, fill: T.chartFill || T.fg, alpha: T.chartFillAlpha ?? 0.08, glow: T.chartGlow }];
  if (o.under) series.push({ fn: o.under, color: line, w: 1.2, dash: [3, 4] });
  for (const e of o.extra || []) series.push({ ...e, color: e.color === 'red' ? T.red : e.color });
  if (o.second) {   // another channel on its own scale, drawn across the same height
    const { at: at2, lo: lo2, hi: hi2 } = o.second;
    series.push({ fn: (k) => r.lo + (Math.min(hi2, Math.max(lo2, at2(k))) - lo2) / (hi2 - lo2) * (r.hi - r.lo), color: T.cold, w: 1.5 });
  }
  const { P } = trace(g, T, p, cy, cwid, chh, { breaks: o.breaks, span: o.span, lo: r.lo, hi: r.hi, grid: grid(r), timeLabel: o.timeLabel, levels, levelsLeft: true, tip: o.tip, series, tight: o.tight });
  if (o.note) note(g, T, Z, p, cy, cwid, chh, o.note);
  const keys = [...(o.extra || []).filter((e) => e.label).map((e) => [e.label, T.red]), ...(o.second ? [[o.second.label, T.cold]] : [])];
  keys.forEach(([t, color], i) => text(g, t, p + cwid - 5, cy + 14 + i * 15, font(T, 11, 600), color, 'right'));   // what the extra lines are, top right
  const nowT = o.now === null ? '-' : nowText(key, ch, null);
  if (nowT !== '-') nowTag(g, T, Z, size, nowT, ch.unit, { P, at: o.at, now: o.now, top: cy, h: chh, fill: line });
}

// The reading now as a tag at the numbers' size (big: the least for something read at a glance while
// driving), tight round its text, over the right end of the line: above the newest point or below it,
// whichever side the last stretch of line under the tag leaves clear (above while it climbs or holds,
// below while it falls), with a short pointer angled down or up to the point.
function nowTag(g, T, Z, size, t, unit, { P, at, now, top, h: chh, fill }) {
  const f = font(T, size), uf = font(T, Z.lbl, 700), tw = fixedWidth(g, t, f);
  g.font = uf;
  const uw = g.measureText(unit).width, padX = size * 0.16, w = tw + uw + padX * 2 + 2, h = size * 0.92, pt = size * 0.22, r = h * 0.22;
  const [tipX, tipY] = P(0, now), x = tipX - w - 1;
  let hi = tipY, lo = tipY;                          // the line's top and bottom under the tag
  for (let k = 0; k < 2000; k++) {
    const v = at(k), [px, py] = P(k, v);
    if (px < x) break;
    if (!Number.isNaN(v)) { hi = Math.min(hi, py); lo = Math.max(lo, py); }
  }
  const aboveY = hi - pt - h, belowY = lo + pt, fitsAbove = aboveY >= top + 2, fitsBelow = belowY + h <= top + chh - 2;
  const falling = hi < tipY - 2 && lo <= tipY + 2;   // the older line under the tag sits higher on screen (y grows down): it was hotter
  const above = fitsAbove && fitsBelow ? !falling : fitsAbove || (!fitsBelow && tipY - top > top + chh - tipY);
  const ty = Math.max(top + 2, Math.min(top + chh - h - 2, above ? aboveY : belowY));
  g.canvas.dataset.tag = above ? 'above' : 'below';   // for scripts/browser/glance.mjs
  const edge = above ? ty + h : ty, bx = Math.max(x + r + pt, Math.min(x + w - r - pt, tipX - pt * 0.8));   // the pointer's base, near the tag's right end
  g.save(); g.shadowColor = fill; g.shadowBlur = T.chartGlow; g.fillStyle = fill;
  g.beginPath(); g.roundRect(x, ty, w, h, r);
  g.moveTo(bx - pt * 0.7, edge); g.lineTo(tipX, tipY); g.lineTo(bx + pt * 0.7, edge); g.closePath(); g.fill(); g.restore();
  const base = ty + h / 2 + size * 0.36, ink = T.chartTagInk || T.face;
  fixed(g, t, x + padX, base, f, ink);
  text(g, unit, x + padX + tw + 2, base, uf, ink);
}

// The channel's newest reading, steadied: live if the panel has one, else the last stored one.
const steadies = {};
function nowText(key, ch, stored) {
  const live = hist.slow[key].avg(3), v = ch.value(live) !== null ? live : stored;
  return v === null || v === undefined ? '-' : (steadies[key] ??= steadyText(ch))(v);
}

// The name and the four numbers over a chart. trend: runTrend's answer; per: its unit of time in ms;
// perText: "h" or "d". Returns the chart's top.
function header(g, T, Z, v, p, w, h, nowT, s, trend, per, perText) {
  const up = h > w * 1.2, cols = up ? 2 : 4, cw = (w - 2 * p) / cols, size = Z.value, rowH = Z.lbl * 1.35 + size;
  const { ch, conv, delta } = v;
  label(g, T, ch.unit ? `${ch.label} (${ch.unit})` : ch.label, p, p + Z.lbl, Z.lbl, T.fg);
  const top = p + Z.lbl * 1.9, dp = ch.dp ? ch.dp + 1 : 0;
  const cells = [['Now', nowT], ['Min', s ? conv(s.min).toFixed(ch.dp) : '-'], ['Max', s ? conv(s.max).toFixed(ch.dp) : '-'],
    [trend ? `Trend ${gapText(trend.ms)}` : 'Trend', trend ? signed(delta(trend.rate * per), dp) : '-', trend ? `/${perText}` : '']];
  cells.forEach(([k, t, unit], i) => {
    const x = p + (i % cols) * cw, y = top + Math.floor(i / cols) * rowH, base = y + Z.lbl * 1.25 + size * 0.85;
    label(g, T, k, x, y + Z.lbl, Z.lbl);
    const tw = fixed(g, t, x, base, font(T, size), T.fg);
    if (unit) text(g, unit, x + tw + 3, base, font(T, Z.small * 0.7, 600), T.label);
  });
  return top + Math.ceil(4 / cols) * rowH + p * 0.4;
}
function note(g, T, Z, x, y, w, h, s) { text(g, s, x + w / 2, y + h / 2, font(T, Z.small, 600), T.label, 'center'); }

// The readings of the last spanMs as a line, with real breaks marked.
function hourChart(g, T, Z, v, d, now, spanMs, x, y, cw, chh) {
  const rows = d.rows.filter((q) => q.t > now - spanMs);
  const points = rows.map((q) => ({ t: q.t, v: v.conv(q.v) })), { at, ts, breaks } = timeChart(points, now, GAP_MS, HOUR_POINTS);
  const r = niceRange([...at], v.minSpan) || { lo: v.ch.min, hi: v.ch.max, step: (v.ch.max - v.ch.min) / 2 };
  const gapMs = breaks.reduce((t, q) => t + q.ms, 0), held = rows.length ? now - rows[0].t - gapMs : 0;
  trace(g, T, x, y, cw, chh, { span: HOUR_POINTS, lo: r.lo, hi: r.hi, grid: grid(r), gridLabel: gridText(r), breaks, sparse: true,
    timeLabel: rows.length ? `${Math.max(1, Math.round(held / 60_000))} min of data` : '', tip: (k, val) => [clock12(ts[k]), valText(v.ch, val)],
    series: [{ fn: (k) => at[k], color: T.fg, w: 2.5, fill: T.fg, alpha: 0.08 }] });
  if (!rows.length) note(g, T, Z, x, y, cw, chh, d.loaded ? 'No data' : 'Loading');
}

function drawHour(g, w, h, T, key, p, Z) {
  const v = view(key), d = trendData('hour', key), now = Date.now(), rows = d.rows.filter((x) => x.t > now - HOUR_MS);
  const s = summarize(rows.map((x) => x.v)), move = v.span / 4;
  const trend = runTrend(rows.map((x) => [x.t, x.v]), { minMove: move, maxGapMs: GAP_MS, maxMs: TREND_MAX_MS, minMs: 60_000 });
  const y = header(g, T, Z, v, p, w, h, nowText(key, v.ch, rows[rows.length - 1]?.v), s, trend, HOUR_MS, 'h'), cw = w - 2 * p;
  if (h <= w * 1.2) { hourChart(g, T, Z, v, d, now, HOUR_MS, p, y, cw, h - y - p); return; }
  const [a, b] = twoCharts(y, h - p, p * 0.6);   // upright: the hour, then its last 15 minutes up close
  hourChart(g, T, Z, v, d, now, HOUR_MS, p, a.y, cw, a.h);
  hourChart(g, T, Z, v, d, now, TREND_MAX_MS, p, b.y, cw, b.h);
}

// The last `days` days as bars from each day's min to its max, a tick at its average.
function dayChart(g, T, Z, v, d, days, x0, y, cw, chh) {
  const today = Date.parse(`${d.today || new Date().toISOString().slice(0, 10)}T00:00:00Z`), byDay = new Array(days).fill(null);
  for (const x of d.rows) {
    const k = Math.round((today - Date.parse(`${x.day}T00:00:00Z`)) / DAY_MS);
    if (k >= 0 && k < days) byDay[k] = x;
  }
  const held = byDay.filter(Boolean), vals = held.flatMap((x) => [v.conv(x.min), v.conv(x.max)]);
  const r = niceRange(vals, v.minSpan) || { lo: v.ch.min, hi: v.ch.max, step: (v.ch.max - v.ch.min) / 2 };
  const { slots, breaks } = collapseGaps(byDay.map(Boolean), DAY_MS), n = slots.length, span = n + 1;   // each day owns a slot; missing days are one small mark
  trace(g, T, x0, y, cw, chh, { span: Math.max(2, span), lo: r.lo, hi: r.hi, grid: grid(r), gridLabel: gridText(r), breaks,
    timeLabel: held.length ? `${held.length} day${held.length === 1 ? '' : 's'} of data` : '',
    series: [] });
  const { P } = axes(x0, y, cw, chh, Math.max(2, span), r.lo, r.hi, breaks), bar = n ? Math.max(3, Math.min(48, ((cw - breaks.length * GAP_PX) / n) * 0.6)) : 0;
  const tips = [];
  slots.forEach((k, q) => {
    const x = byDay[k];
    tips.push([P(q + 0.5, 0)[0], [dayText(x.day), `Max ${valText(v.ch, v.conv(x.max))}`, `Avg ${valText(v.ch, v.conv(x.avg))}`, `Min ${valText(v.ch, v.conv(x.min))}`]]);
    const c0 = q + 0.5, [a, b] = P(c0, v.conv(x.min)), [c, e] = P(c0, v.conv(x.max)), [m, o] = P(c0, v.conv(x.avg));
    g.save(); g.globalAlpha = 0.4; line(g, a, b, c, e, T.fg, bar); g.restore();
    line(g, m - bar / 2, o, m + bar / 2, o, T.fg, 3);
  });
  addTip(g.canvas, { x: x0, y, w: cw, h: chh }, (mx) => nearest(tips, mx));
  if (!held.length) note(g, T, Z, x0, y, cw, chh, d.loaded ? 'No data' : 'Loading');
}
// "Tue Nov 24" for a day's "2026-11-24" (the day as stored, not moved by the time zone).
const dayText = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).replace(',', '');

function drawDays(g, w, h, T, key, p, Z) {
  const v = view(key), d = trendData('days', key), s = summarizeDays(d.rows);
  const trend = runTrend(d.rows.map((x) => [Date.parse(`${x.day}T00:00:00Z`), x.avg]), { minMove: v.span / 4, minPoints: 2, minMs: DAY_MS });
  const y = header(g, T, Z, v, p, w, h, nowText(key, v.ch, null), s, trend, DAY_MS, 'd'), cw = w - 2 * p;
  if (h <= w * 1.2) { dayChart(g, T, Z, v, d, DAYS, p, y, cw, h - y - p); return; }
  const [a, b] = twoCharts(y, h - p, p * 0.6);   // upright: 30 days, then the last 7 up close
  dayChart(g, T, Z, v, d, DAYS, p, a.y, cw, a.h);
  dayChart(g, T, Z, v, d, 7, p, b.y, cw, b.h);
}

// Full screen level 1 (the last hour) or 2 (the last 30 days).
export function drawHistory(g, w, h, level, T, key) {
  const p = Math.round(Math.min(w, h) * 0.05) + 6, Z = typeScale(w, h);
  (level === 1 ? drawHour : drawDays)(g, w, h, T, key, p, Z);
}

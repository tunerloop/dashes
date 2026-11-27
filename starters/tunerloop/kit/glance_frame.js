// kit/glance_frame.js: the app's kit/glance_frame.js as forked with tunerloop-dash. Yours to change.
// The glance pages' look (trend_views.js draws the data into it; compass_views.js shares its top): two
// numbers in big type over an amber window with a chart, the dashed level lines from the dash's zones,
// the reading now as a tag on the line's newest point, and what each kind of channel leads with.
import { hist } from './hist.js';
import { CHANNELS, shown, warmAt } from './channels.js';
import { steadyText } from './steady.js';
import { prep, themeOf, typeScale, font, text, label, fixed, fixedWidth, trace } from './kit.js';
import { niceRange } from './trend_rules.js';

const nan = (v) => (v === null || v === undefined ? NaN : v);   // a missing value as a gap in a line

// A channel's display conversions, its least chart height, and the grid inside a range.
export function view(key) {
  const base = CHANNELS[key], ch = shown(base), conv = (v) => nan(ch.value(v));
  const delta = (d) => conv(base.min + d) - conv(base.min);
  const span = base.trend?.span ?? (base.max - base.min) / 4;   // a dash's ranges give it; else a quarter of the scale
  return { base, ch, conv, delta, span, minSpan: Math.abs(delta(span)) };
}
export function grid(r) {
  const out = [];
  for (let v = r.lo + r.step; v < r.hi - r.step * 0.01; v += r.step) out.push(v);
  return out;
}
export const gridText = (r) => (v) => v.toFixed(r.step < 1 ? 1 : 0);

// A reading with its unit, for the mouse's label (canvas_tip.js).
export const valText = (ch, v) => `${v.toFixed(ch.dp ?? 0)}${ch.unit ? ` ${ch.unit}` : ''}`;

// What a channel's glance pages lead with, by kind (the dash's ranges may name one with glance.style):
// recent and stored, the two numbers on top ([stat, name]); recentEdge and edge, the side drawn
// dashed (a bin's or bucket's max or min). A temperature leads with how fast it climbs (drawGlance)
// and its highest; a pressure, where low is the danger, with its lowest; revs with their peak.
const STYLES = {
  temperature: { recent: [['max', 'Max']], stored: [['max', 'Max'], ['avg', 'Avg']], recentEdge: null, edge: 'max' },
  pressure: { recent: [['min', 'Min'], ['max', 'Max']], stored: [['min', 'Min'], ['avg', 'Avg']], recentEdge: 'min', edge: 'min' },
  speed: { recent: [['max', 'Max'], ['avg', 'Avg']], stored: [['max', 'Max'], ['avg', 'Avg']], recentEdge: null, edge: 'max' },
  peak: { recent: [['max', 'Peak'], ['avg', 'Avg']], stored: [['max', 'Peak'], ['avg', 'Avg']], recentEdge: 'max', edge: 'max' },
  range: { recent: [['min', 'Min'], ['max', 'Max']], stored: [['min', 'Min'], ['max', 'Max']], recentEdge: null, edge: 'min' },
  mixture: { recent: [['avg', 'Bank 1'], ['alsoAvg', 'Bank 2']], stored: [['avg', 'Bank 1'], ['alsoAvg', 'Bank 2']], recentEdge: null, edge: null },   // both banks' averages (glance.also)
};
export const glanceStyle = (base) => STYLES[base.glance?.style] || STYLES[base.kind] || STYLES.range;
export const isTemp = (base) => base.kind === 'temperature';
export function cell(k, v, x) { return [k, x === null || x === undefined || !Number.isFinite(x) ? '-' : x.toFixed(v.ch.dp ?? 0), v.ch.unit]; }
// The widest a channel's number gets in display units, as 8s, so the size step holds still.
export function widestText(v) { return [v.base.min, v.base.max].map((x) => Math.abs(v.conv(x)).toFixed(v.ch.dp ?? 0)).sort((a, b) => b.length - a.length)[0].replace(/\d/g, '8'); }

// The dashed lines across a glance chart, from the dash's zones: a temperature's warm-up point
// (Warm), a shift point (Shift), and each red zone's edge: Low where it starts at the bottom of the
// scale, else Hot (a temperature), High, or the dash's own name for it (glance.redLabel: Redline).
// While warming up only Warm shows.
export function zoneLines(v, T, warming = false) {
  const { base, conv, ch } = v, out = [], fmt = (x) => conv(x).toFixed(ch.dp ?? 0), warm = isTemp(base) ? warmAt(base) : null;
  if (warm !== null) out.push({ v: conv(warm), color: T.cold, label: `Warm ${fmt(warm)}` });
  if (warming) return out;
  if (Number.isFinite(base.shift)) out.push({ v: conv(base.shift), color: T.warn || T.cold, label: `Shift ${fmt(base.shift)}` });
  if (base.glance?.warnLine) for (const [lo, hi] of base.warn || []) if (lo <= base.min + 1e-9) out.push({ v: conv(hi), color: T.warn || T.cold, label: `${base.glance.warnLine} ${fmt(hi)}` });   // e.g. Rich
  for (const [lo, hi] of base.red || []) {
    if (lo <= base.min + 1e-9) out.push({ v: conv(hi), color: T.red, label: `Low ${fmt(hi)}` });
    else out.push({ v: conv(lo), color: T.red, label: `${base.glance?.redLabel || (isTemp(base) ? 'Hot' : 'High')} ${fmt(lo)}` });
  }
  return out;
}

// The frame the glance pages share. o: { cells: [[label, text, unit, 'cold'?]], widest (each cell's widest
// text, so the size step holds still as they change), warming, span, vals (for the range), at(k) (the
// line, newest first), under(k)? (a thin dashed line), breaks, timeLabel, tip, now (the newest
// point's value, null for none), note? (said across an empty chart) }.
// The glance pages' top: two numbers in big type over the window, each with its name above and its
// unit under (cells: [[name, text, unit, 'cold'?]]; widest: each one's widest text, so the size step
// holds still). Returns where the window starts and the pad and number size: { p, top, size }. The
// compass pages (compass_views.js) share it.
export function glanceHead(cv, g, w, h, T, Z, cells, widest) {
  const num = T.chartNum || T.fg, p = Math.max(8, Math.min(w, h) * 0.05), cw = (w - p) / 2, lbl = Math.min(Z.lbl, cw * 0.14);   // the columns reach half a pad into the sides
  const step = ['big', 'value', 'small'].find((n) => Z[n] <= h * 0.3 && widest.every((t) => fixedWidth(g, t, font(T, Z[n])) <= cw * 0.9)) ?? 'small';
  const size = Z[step];
  cv.dataset.step = step;   // the size step, for scripts/browser/glance.mjs
  const numY = p + lbl * 1.4 + size * 0.82, band = numY + lbl * 1.6 - p;
  cells.forEach(([k, t, unit, tone], i) => {
    const cx = p / 2 + cw * i + cw / 2, color = tone === 'cold' ? T.cold : num;
    label(g, T, k, cx, p + lbl, lbl, T.label, 'center');
    g.save(); g.shadowColor = T.chartLine || color; g.shadowBlur = T.chartGlow;
    fixed(g, t, cx, numY, font(T, size), color, 0, 'center');
    g.restore();
    if (unit) label(g, T, unit, cx, numY + lbl * 1.5, lbl, T.label, 'center');
  });
  return { p, top: p + band + p * 0.6, size };
}

export function glanceFrame(cv, key, o) {
  const c = prep(cv); if (!c) return;
  const [g, w, h] = c, T = themeOf(cv), Z = typeScale(w, h), v = view(key), { ch, conv } = v;
  const { p, top: cy, size } = glanceHead(cv, g, w, h, T, Z, o.cells, o.widest);
  cv.dataset.span = o.seconds ?? o.span;   // the span shown (seconds for the 15 minutes), for scripts/browser/glance.mjs
  const cwid = w - 2 * p, chh = h - cy - p, levels = zoneLines(v, T, o.warming);
  const r = niceRange([...o.vals, ...levels.map((l) => l.v)], v.minSpan) || { lo: ch.min, hi: ch.max, step: (ch.max - ch.min) / 2 };
  const line = T.chartLine || T.fg, series = [{ fn: o.at, color: line, w: 2.5, fill: T.chartFill || T.fg, alpha: T.chartFillAlpha ?? 0.08, glow: T.chartGlow }];
  if (o.under) series.push({ fn: o.under, color: line, w: 1.2, dash: [3, 4] });
  for (const e of o.extra || []) series.push({ ...e, color: T[e.color] || e.color });   // a theme colour by name (red, cold, label)
  if (o.second) {   // another channel on its own scale, drawn across the same height
    const { at: at2, lo: lo2, hi: hi2 } = o.second;
    series.push({ fn: (k) => r.lo + (Math.min(hi2, Math.max(lo2, at2(k))) - lo2) / (hi2 - lo2) * (r.hi - r.lo), color: T.cold, w: 1.5 });
  }
  const { P } = trace(g, T, p, cy, cwid, chh, { breaks: o.breaks, span: o.span, lo: r.lo, hi: r.hi, grid: grid(r), timeLabel: o.timeLabel, levels, levelsLeft: true, tip: o.tip, series, tight: o.tight });
  if (o.note) note(g, T, Z, p, cy, cwid, chh, o.note);
  const keys = [...(o.mainLabel ? [[o.mainLabel, line]] : []), ...(o.extra || []).filter((e) => e.label).map((e) => [e.label, T[e.color] || e.color]), ...(o.second ? [[o.second.label, T.cold]] : [])];
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

// A word across an empty chart.
function note(g, T, Z, x, y, w, h, s) { text(g, s, x + w / 2, y + h / 2, font(T, Z.small, 600), T.label, 'center'); }

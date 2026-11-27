// kit/kit.js: the app's kit/kit.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// Canvas drawing for the Car tab's detail views: the theme's colours and font (themes.css --d-*),
// sizing a canvas for the screen, and the few shapes every detail view draws (text, labels, round
// boxes, lines, a chart of a history ring). Shared so each view stays short.
import { gapText } from './trend_rules.js';
import { addTip, clearTips, nearest } from './canvas_tip.js';

// The theme as colours: read from the element's computed CSS variables.
export function themeOf(el) {
  const cs = getComputedStyle(el), v = (n, d) => cs.getPropertyValue(n).trim() || d;
  return {
    face: v('--d-face', '#141416'), fg: v('--d-value', '#fff'), label: v('--d-label', '#8d8d96'), grid: v('--d-grid', 'rgba(255,255,255,0.08)'),
    ok: v('--d-ok', '#5fe3a1'), rich: v('--d-rich', '#4aa8ff'), lean: v('--d-lean', '#ff8a3d'), warn: v('--d-warn', '#f0b429'), red: v('--d-red', '#e5484d'),
    b2: v('--d-b2', '#c6a3ff'), lcd: v('--d-lcd', ''), cold: v('--d-cold', '#e8c33a'), track: v('--d-track', 'rgba(255,255,255,0.07)'), font: v('--d-font', 'system-ui, sans-serif'),
    // a chart's own look where the theme sets one (themes.css --d-chart-*): line, the fill under it and how
    // strong, the plot's background, a glow on the line in px (the amber LCD graph), the numbers over
    // a chart, and the ink on the tag that rides the line's newest point
    chartLine: v('--d-chart-line', ''), chartFill: v('--d-chart-fill', ''), chartFillAlpha: +v('--d-chart-fill-alpha', '0') || null,
    chartBg: v('--d-chart-bg', 'rgba(0,0,0,0.25)'), chartNum: v('--d-chart-num', ''), chartTagInk: v('--d-chart-tag-ink', ''), chartGlow: +v('--d-chart-glow', '0') || 0,
  };
}

// Size a canvas to its box at the screen's pixel ratio; returns [ctx, w, h] in CSS px, or null when hidden.
export function prep(cv) {
  const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(3, devicePixelRatio || 1);
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  clearTips(cv);   // the mouse's label regions are added again as the charts are painted
  return [g, w, h];
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// The type scale (the same steps as boxes.css --t-*): label, small, value, big and hero, in px for a w x h canvas.
export function typeScale(w, h) {
  const m = Math.min(w, h) / 100;   // the shorter side: a square panel and full screen either way up get the same sizes
  return { lbl: clamp(m * 3.6, 11, 16), small: m * 7, value: m * 11, big: m * 17, hero: m * 28 };
}
export const font = (T, px, wt = 700) => `${wt} ${px}px ${T.font}`;
export function text(g, s, x, y, f, color, align = 'left') { g.font = f; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); }
export function label(g, T, s, x, y, size, color = T.label, align = 'left') {
  g.save(); if ('letterSpacing' in g) g.letterSpacing = `${(size * 0.1).toFixed(1)}px`;
  text(g, s.toUpperCase(), x, y, font(T, size, 600), color, align); g.restore();
}
// Text with every digit in a slot as wide as the widest digit, right-aligned in a box `slots` digits
// wide (when given), so the number never shifts or resizes as it changes. Returns the box's width.
function slotWidths(g, s, f) {
  g.font = f; let dw = 0; for (const c of '0123456789') dw = Math.max(dw, g.measureText(c).width);
  const cw = (c) => (/[0-9]/.test(c) ? dw : g.measureText(c).width);
  let nat = 0; for (const c of s) nat += cw(c);
  return { dw, cw, nat };
}
export const fixedWidth = (g, s, f) => slotWidths(g, s, f).nat;   // how wide fixed() draws s
export function fixed(g, s, x, y, f, color, slots = 0, align = 'left') {
  const { dw, cw, nat } = slotWidths(g, s, f);
  const box = Math.max(nat, slots * dw);
  let x0 = (align === 'right' ? x - box : align === 'center' ? x - box / 2 : x) + box - nat;
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const c of s) { g.fillText(c, x0 + cw(c) / 2, y); x0 += cw(c); }
  return box;
}
// Font size so s fits maxW wide with digits about maxCap tall.
export function fit(g, T, s, maxW, maxCap, wt = 700) { g.font = font(T, 100, wt); const w = g.measureText(s).width || 1; return Math.max(6, Math.min(maxCap / 0.7, 100 * maxW / w)); }
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
export function line(g, x0, y0, x1, y1, color, w = 1, dash) { g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); }
export const signed = (v, dp = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(dp);

// How wide a gap's mark is on a chart: room for its length ("3 min"), however long the gap was.
export const GAP_PX = 54;
// Where a history sample lands in a chart box: time runs left to right with the newest on the right,
// the value up, whichever way the phone is held. breaks: [{k, ms}] newest first, each a fixed-width
// mark just older than sample k (k -1: right of the newest). P(k, v) -> [x, y]; base(k) is the point at
// the bottom of the value range (where a fill closes); marks: each break's [x0, x1] and ms.
export function axes(x, y, w, h, span, lo, hi, breaks = []) {
  const G = breaks.length ? Math.min(GAP_PX, w * 0.5 / breaks.length) : 0, dataW = w - G * breaks.length;
  const f = (v) => (clamp(v, lo, hi) - lo) / (hi - lo), along = (k) => k / (span - 1) * dataW;
  const before = (k) => { let c = 0; for (const b of breaks) if (b.k < k) c++; return c; };
  const P = (k, v) => [x + w - along(k) - before(k) * G, y + h - f(v) * h];
  const marks = breaks.map((b, j) => { const r = x + w - along(Math.max(0, b.k)) - j * G; return { x0: r - G, x1: r, ms: b.ms }; });
  return { P, base: (k) => P(k, lo), marks };
}
// Diagonal lines across a box: the mark for a stretch of time with no data.
export function hatch(g, x, y, w, h, color, gap = 9, lineW = 1.2) {
  if (w <= 0 || h <= 0) return;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = color; g.globalAlpha = 0.38; g.lineWidth = lineW; g.beginPath();
  for (let d = -h; d < w; d += gap) { g.moveTo(x + d, y + h); g.lineTo(x + d + h, y); }
  g.stroke(); g.restore();
}
// A gap's mark: diagonal lines with its length across the middle.
export function markGap(g, T, { x0, x1, ms }, y, h) {
  const len = x1 - x0;
  hatch(g, x0, y, len, h, T.label);
  const s = gapText(ms), fs = 12; g.font = font(T, fs, 600);
  const tw = g.measureText(s).width + 6;
  if (len < tw) return;
  const cx = x0 + len / 2, cy = y + h / 2;
  g.fillStyle = T.face; g.fillRect(cx - tw / 2, cy - fs * 0.8, tw, fs * 1.6);
  text(g, s, cx, cy + fs * 0.35, font(T, fs, 600), T.label, 'center');
}
// A chart of history rings, newest on the right. o: { span (samples), lo, hi, grid: [values], gridLabel(v),
// series: [{ fn(k) | ring, color, w, fill, dash, alpha }], cut (a ring of 0/1 to hatch), seconds, timeLabel,
// breaks (see axes), sparse }. A line stops at each break. A dropout of a few samples is drawn across, a
// longer one left empty; sparse: samples are far apart, so only the breaks stop the line.
export function trace(g, T, x, y, w, h, o) {
  const span = o.span, breaks = o.breaks || [], { P, base, marks } = axes(x, y, w, h, span, o.lo, o.hi, breaks), minGap = Math.max(2, Math.ceil(span * 0.05));
  g.save(); rr(g, x, y, w, h, 8); g.clip();
  g.fillStyle = T.chartBg; g.fillRect(x, y, w, h);
  for (const gv of o.grid || []) { const [a, b] = P(0, gv), [c, d] = P(span - 1, gv); line(g, a, b, c, d, T.grid, 1); }
  if (o.cut) {
    g.fillStyle = T.grid; const step = w / span;
    for (let k = 0; k < span; k++) if (o.cut.at(k) > 0.5) { const [px] = P(k, o.lo); g.fillRect(px - step, y, step + 1, h); }
  }
  for (const s of o.series) {
    const val = (k) => (s.fn ? s.fn(k) : s.ring.at(k));
    const path = new Path2D(), runs = [];   // each unbroken run of samples: filled on its own, so a fill never crosses a gap
    let run = null;
    for (let k = 0; k < span; k++) {
      const v = val(k);
      if (v === null || Number.isNaN(v) || v === undefined) continue;
      const broke = run && (breaks.some((q) => run.last <= q.k && k > q.k) || (!o.sparse && k - run.last > minGap));
      if (broke) run = null;
      const [px, py] = P(k, v);
      if (!run) { path.moveTo(px, py); run = { first: k, last: k, pts: [[px, py]] }; runs.push(run); } else { path.lineTo(px, py); run.last = k; run.pts.push([px, py]); }
    }
    if (s.fill) {
      g.save(); g.globalAlpha = s.alpha ?? 0.18; g.fillStyle = s.fill;
      for (const r of runs) {
        g.beginPath(); r.pts.forEach(([px, py], q) => (q ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.lineTo(...base(r.last)); g.lineTo(...base(r.first)); g.closePath(); g.fill();
      }
      g.restore();
    }
    if (s.color) {
      g.save();
      if (s.glow) { g.shadowColor = s.color; g.shadowBlur = s.glow; }
      g.strokeStyle = s.color; g.lineWidth = s.w || 2.5; g.lineJoin = 'round'; if (s.dash) g.setLineDash(s.dash); g.stroke(path);
      g.restore();
    }
  }
  for (const m of marks) markGap(g, T, m, y, h);
  for (const l of o.levels || []) { const [, ly] = P(0, l.v); line(g, x, ly, x + w, ly, l.color, 1.5, [6, 5]); }   // dashed marks across, e.g. warm-up and max
  g.restore();
  const lx = o.levelsLeft ? x + 5 : x + w - 5;   // the levels' labels: right, or left where something else sits on the right
  for (const l of o.levels || []) if (l.label) { const [, ly] = P(0, l.v), fl = clamp(Math.min(w, h) * 0.07, 9, 12); text(g, l.label, lx, ly + (ly - y < fl * 1.6 ? fl + 3 : -4), font(T, fl, 600), l.color, o.levelsLeft ? 'left' : 'right'); }
  const fs = clamp(Math.min(w, h) * 0.08, 9, 13), secs = o.timeLabel ?? `${o.seconds ?? Math.round(span / 25)} s`;
  for (const gv of o.grid || []) if (o.gridLabel) { const [, b] = P(span - 1, gv); text(g, o.gridLabel(gv), x + 5, b - 3, font(T, fs, 500), T.label); }
  text(g, secs, x + 5, y + h - 5, font(T, fs, 600), T.label);
  if (o.tip && o.series[0]) {   // the mouse over the first series: tip(k, v) gives the label's rows
    const s = o.series[0], val = (k) => (s.fn ? s.fn(k) : s.ring.at(k));
    addTip(g.canvas, { x, y, w, h }, (mx) => {
      const pts = [];
      for (let k = 0; k < span; k++) { const v = val(k); if (Number.isFinite(v)) pts.push([P(k, v)[0], k, v]); }
      const hit = nearest(pts.map(([px], i) => [px, i]), mx);
      return hit && { x: hit.x, lines: o.tip(pts[hit.lines][1], pts[hit.lines][2]) };
    });
  }
  return { P };
}

// A tall box split into two charts stacked one over the other, so neither stretches: [{y, h}, {y, h}].
export function twoCharts(top, bottom, gap) {
  const h = (bottom - top - gap) / 2;
  return [{ y: top, h }, { y: top + h + gap, h }];
}

// Coloured name swatches across the top of a chart.
export function legend(g, T, items, x, y, fs) {
  for (const [name, color] of items) {
    g.fillStyle = color; g.fillRect(x, y - fs * 0.45, fs * 1.1, 3); x += fs * 1.4;
    label(g, T, name, x, y, fs, color); g.font = font(T, fs, 600); x += g.measureText(name).width + fs * 1.8;
  }
}

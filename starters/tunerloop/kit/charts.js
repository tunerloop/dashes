// kit/charts.js: the app's kit/charts.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The Car tab's chart boxes, drawn with uPlot (packages/uplot, vendored): the live chart (the last
// minute, scrolling with the playback clock) and the trend chart (2 hours of heartbeats). View
// only: no zoom or drag, because a sideways swipe changes the box. The mouse (never a finger) over a
// chart shows a line at that moment and a label with its time and each line's value (hoverTip). Colours and font come
// from the theme's CSS variables; a theme change rebuilds the chart. Values and the key's unit
// labels are in the chosen display units (units.js); a units change makes a new chart (the dash builds its panels again).
import uPlot from './uplot.js';
import { CHANNELS, CHARTS, shown } from './channels.js';
import { clock12 } from './time.js';
import { hatch, GAP_PX } from './kit.js';
import { collapseTimes, gapText, niceRange } from './trend_rules.js';

// A break longer than this is a gap: no line across it, diagonal lines instead.
const GAP_MS = { live: 3000, trend: 90_000 };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// uPlot's data with an empty point in each gap, so no line is drawn across it.
function withBreaks(xs, cols, gaps) {
  if (!gaps.length) return [xs, ...cols];
  const outX = [], outC = cols.map(() => []);
  let g = 0;
  xs.forEach((x, i) => {
    while (g < gaps.length && gaps[g].to <= x) { outX.push((gaps[g].from + gaps[g].to) / 2); outC.forEach((c) => c.push(null)); g++; }
    outX.push(x); outC.forEach((c, n) => c.push(cols[n][i]));
  });
  return [outX, ...outC];
}

export function makeChart(which, spanS) {
  const spec = CHARTS[which], live = which === 'live';
  const view = spec.series.map(([k]) => shown(CHANNELS[k]));
  const keyText = (ch) => (ch.unit && !ch.label.startsWith(ch.unit) ? `${ch.label} ${ch.unit}` : ch.label);   // "AFR 1", not "AFR 1 AFR"
  const el = document.createElement('div');
  el.className = 'box chart-box';
  el.innerHTML = `<div class="chart-head"><span class="chart-title">${esc(spec.title)}</span>
    ${spec.series.map((_, i) => `<span class="key"><i class="sw sw-${spec.series[i][2]}"></i>${esc(keyText(view[i]))}</span>`).join('')}</div>
    <div class="chart-plots"><div class="chart-plot"></div><div class="chart-plot"></div></div>`;
  const hosts = [...el.querySelectorAll('.chart-plot')];
  let plots = [], groups = [], upright = null, data = null, xRange = null, gaps = [], axisText = (s) => `${s}`;
  const partOf = (idx) => (data ? [data[0], ...idx.map((i) => data[i + 1])] : [[], ...idx.map(() => [])]);

  function makePlot(host, idx) {
    const css = getComputedStyle(el);
    const v = (name) => css.getPropertyValue(name).trim();
    const font = `15px ${v('--d-font') || 'sans-serif'}`;
    const axis = { stroke: v('--d-num'), font, grid: { stroke: v('--d-grid'), width: 1 }, ticks: { stroke: v('--d-grid'), width: 1 } };
    const used = [...new Set(idx.map((i) => spec.series[i][1]))];   // each y scale this chart shows: the first on the left
    const { width, height } = host.getBoundingClientRect();
    return new uPlot({
      width: Math.max(50, width), height: Math.max(50, height),
      cursor: { show: false }, select: { show: false }, legend: { show: false },
      scales: { x: { time: false, range: () => xRange || [0, 1] }, ...Object.fromEntries(used.map((s) => [s, { auto: true, range: (u, lo, hi) => {   // round ends, and a nearly flat line doesn't zoom in on noise
        const r = niceRange([lo, hi], live && s === 'l' ? 500 : live ? 5 : 10);
        return r ? [r.lo, r.hi] : [0, 1];
      } }])) },
      hooks: { ready: [(u) => hoverTip(u, idx)], setData: [(u) => u.tipShow?.()], draw: [(u) => {   // the gaps, in canvas pixels
        const { top, height: bh } = u.bbox, r = devicePixelRatio || 1;
        for (const q of gaps) {
          const x0 = u.valToPos(q.from, 'x', true), x1 = u.valToPos(q.to, 'x', true);
          hatch(u.ctx, x0, top, x1 - x0, bh, v('--d-label'), 9 * r, 1.2 * r);
          const s = gapText(q.ms), c = u.ctx, fs = 12 * r;
          c.save(); c.font = `600 ${fs}px ${v('--d-font') || 'sans-serif'}`;
          const tw = c.measureText(s).width + 6 * r, cx = (x0 + x1) / 2, cy = top + bh / 2;
          if (x1 - x0 >= tw) {
            c.fillStyle = v('--d-face'); c.fillRect(cx - tw / 2, cy - fs * 0.8, tw, fs * 1.6);
            c.fillStyle = v('--d-label'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, cx, cy);
          }
          c.restore();
        }
      }] },
      axes: [
        { ...axis, space: live ? 60 : 110, values: (u, vals) => vals.map(axisText) },
        ...used.map((s, n) => (n ? { ...axis, scale: s, side: 1, size: 40, grid: { show: false } } : { ...axis, scale: s, size: live && s === 'l' ? 64 : 46 })),
      ],
      series: [{}, ...idx.map((i) => ({ label: view[i].label, scale: spec.series[i][1], stroke: v(`--d-s-${spec.series[i][2]}`), width: 2, points: { show: false } }))],
    }, partOf(idx), host);
  }

  // The mouse over a plot: a line at the nearest reading and a label with its time and values.
  function hoverTip(u, idx) {
    const tip = document.createElement('div'), hair = document.createElement('div');
    tip.className = 'chart-tip'; hair.className = 'chart-hair';
    tip.hidden = hair.hidden = true;
    u.over.append(hair, tip);
    let at = null;   // the pointer's place in the plot, kept so new readings move the label along
    const hide = () => { at = null; tip.hidden = hair.hidden = true; };
    const show = () => {
      if (!at || !data) return hide();
      const k = u.posToIdx(at.x), xs = u.data[0];
      if (k == null || k < 0 || k >= xs.length) return hide();
      const px = u.valToPos(xs[k], 'x');
      if (Math.abs(px - at.x) > 40) return hide();   // no reading near the mouse (before the first, or in a gap)
      const vals = idx.map((i, n) => [i, u.data[n + 1][k]]);
      const rows = vals.filter(([, v]) => v != null && Number.isFinite(v))
        .map(([i, v]) => `<span><i class="sw sw-${spec.series[i][2]}"></i>${esc(view[i].label)} <b>${esc(v.toFixed(view[i].dp ?? 0))}${view[i].unit ? ` ${esc(view[i].unit)}` : ''}</b></span>`);
      tip.innerHTML = `<span class="chart-tip-t">${esc(axisText(xs[k]))}</span>${rows.length ? rows.join('') : '<span>No data</span>'}`;
      hair.style.left = `${px}px`;
      tip.hidden = hair.hidden = false;
      const w = u.over.clientWidth, tw = tip.offsetWidth;
      tip.style.left = `${Math.max(0, Math.min(w - tw, px + (px + 12 + tw <= w ? 12 : -12 - tw)))}px`;   // right of the line, left of it near the right edge
    };
    u.over.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;   // a finger swipes the box
      const r = u.over.getBoundingClientRect();
      at = { x: e.clientX - r.left };
      show();
    });
    u.over.addEventListener('pointerleave', hide);
    u.tipShow = () => { if (at) show(); };   // new readings: the label follows the moment under the mouse
  }

  // One chart with every series, or two near-square ones when the box is held upright.
  function build() {
    plots.forEach((p) => p.destroy());
    groups = upright ? spec.split : [spec.series.map((_, i) => i)];
    plots = groups.map((idx, n) => makePlot(hosts[n], idx));
  }

  // rows: [{t, key: value}] oldest first, tms: their times in ms. endMs: the live chart's right
  // edge (the playback clock); the trend chart spans its rows.
  function set(rows, tms, endMs) {
    const col = (part) => spec.series.map(([k], n) => part.map((r) => view[n].value(r[k])));
    const plotPx = Math.max(120, (hosts[0].clientWidth || 300) - 90), mark = { px: GAP_PX, plotPx };   // each gap: a small mark
    if (live) {
      const spanMs = spanS * 1000, c = collapseTimes(tms, GAP_MS.live, { ...mark, activeMs: spanMs }), n = tms.length;
      const xEnd = n ? c.xs[n - 1] - (tms[n - 1] - endMs) : 0, t0 = xEnd - spanMs;   // the last minute of data, not of the clock
      let i = 0;
      while (i < n && c.xs[i] < t0) i++;
      let j = n;
      while (j > i && c.xs[j - 1] > xEnd) j--;
      const rel = (x) => (x - xEnd) / 1000;
      gaps = c.gaps.filter((q) => q.to > t0 && q.from < xEnd).map((q) => ({ from: rel(q.from), to: rel(q.to), ms: q.ms }));
      data = withBreaks(c.xs.slice(i, j).map(rel), col(rows.slice(i, j)), gaps);
      xRange = [-spanS, 0];
      axisText = (s) => { const d = Math.round((c.real(s * 1000 + xEnd) - endMs) / 1000); return Math.abs(d) >= 90 ? `${Math.round(d / 60)} min` : `${d} s`; };
    } else {
      const c = collapseTimes(tms, GAP_MS.trend, mark), sec = (t) => t / 1000, xs = c.xs.map(sec);
      gaps = c.gaps.map((q) => ({ from: sec(q.from), to: sec(q.to), ms: q.ms }));
      data = withBreaks(xs, col(rows), gaps);
      let end = xs.length ? Math.max(xs[0] + 60, xs[xs.length - 1]) : 0;
      const idle = tms.length ? Date.now() - tms[tms.length - 1] : 0;
      if (idle > GAP_MS.trend) { gaps.push({ from: end, to: end + sec(c.width), ms: idle }); end += sec(c.width); }   // nothing coming in now
      xRange = xs.length ? [xs[0], end] : null;
      axisText = (s) => clock12(c.real(s * 1000));
    }
    plots.forEach((p, n) => p.setData(partOf(groups[n])));
  }

  const sizer = new ResizeObserver(() => {
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const up = box.width / box.height <= 5 / 7;
    if (up !== upright || !plots.length) { upright = up; build(); return; }
    plots.forEach((p, n) => { const r = hosts[n].getBoundingClientRect(); if (r.width && r.height) p.setSize({ width: r.width, height: r.height }); });
  });
  sizer.observe(el);
  hosts.forEach((h) => sizer.observe(h));

  const destroy = () => { sizer.disconnect(); plots.forEach((p) => p.destroy()); plots = []; };
  return { el, set, rebuild: () => { if (plots.length) build(); }, destroy, frame() {} };
}

// kit/gauge.js: the app's kit/gauge.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The Car tab's boxes that show one channel: a round dial with a needle, and a big number with its
// icon and its last minute as a graph. Both take a value with set() and move towards it on each animation frame (frame(dt)), so
// readings arriving 5 a second still sweep smoothly. Colours and fonts come from the theme's CSS
// variables (themes.css), so one drawing serves every theme. Numbers, units, ticks and zone arcs
// are in the chosen display units (units.js); a units change rebuilds the boxes (the dash builds its panels again).
import { CHANNELS, zoneOf, reading, shown, maxChars } from './channels.js';
import { icon } from './icons.js';
import { steadyText, holdAngle } from './steady.js';
import { VDO_DIGITS } from './vdo-digits.js';
import { drawRecent, drawGlance } from './trend_views.js';

// Where the light comes from in Vintage 3D, in the dial's degrees (0 up, clockwise): the needle's
// lit bevel is the side facing it. light.js moves it with the phone's tilt.
let lightAt = -35;
export const setLightAt = (deg) => { lightAt = deg; };
const SWEEP = 135;                                   // degrees either side of straight up
const pt = (r, a) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
const f1 = (n) => n.toFixed(1);
// A dial number in the traced VDO digits, centred on (x, y) like the font's .num text: shown by the
// Vintage styles instead of the font (boxes.css). null when a character has no traced digit.
const DIGIT_H = 11.5, DIGIT_GAP = 0.13;                // height in dial units; gap in digit heights
// Longer labels print smaller and sit further in, so 150 clears its tick like 4 does on the tach.
const LABEL_FIT = { 1: [1, 60], 2: [0.86, 58], 3: [0.72, 55.5] };   // digits: [height factor, radius]
const labelFit = (label) => LABEL_FIT[Math.min(3, String(label).length)];
function vdoNumber(label, x, y) {
  const ds = [...String(label)].map((c) => VDO_DIGITS[c]);
  if (ds.some((g) => !g)) return null;
  const H = DIGIT_H * labelFit(label)[0];
  const s = H / 1000, gap = DIGIT_GAP * 1000;
  const w = ds.reduce((t, g) => t + g.w, 0) + gap * (ds.length - 1);
  let at = 0;
  const paths = ds.map((g) => { const p = `<path transform="translate(${at} 0)" d="${g.d}"/>`; at += g.w + gap; return p; }).join('');
  return `<g transform="translate(${f1(x - w * s / 2)} ${f1(y - H / 2)}) scale(${s})">${paths}</g>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function arc(r, a0, a1) {
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
  return `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`;
}

// Smoothing: the shown value closes most of the gap to the target in about 3 x tauMs (0.2 s for the
// hub's 5 readings a second; Direct's 20 a second need far less, config.directSmoothMs).
const ease = (cur, target, dtMs, tauMs = 70) => (cur === null || tauMs <= 0 ? target : cur + (target - cur) * (1 - Math.exp(-dtMs / tauMs)));

export function makeGauge(key) {
  const base = CHANNELS[key];
  const ch = shown(base);
  const ang = (v) => -SWEEP + (Math.min(ch.max, Math.max(ch.min, v)) - ch.min) / (ch.max - ch.min) * 2 * SWEEP;
  const { step, scale } = ch.dial;
  const note = ch.dial.note || ch.note;            // x1000 on the tach; which cylinders on a lambda dial
  let ticks = '', nums = '', vdo = '';
  const within = (zs, v) => (zs || []).some(([lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9);
  const inZone = (v) => within(ch.warn, v) || within(ch.red, v);
  const minor = step / 5;
  for (let i = 0, v = ch.min; v <= ch.max + 1e-9; i++, v = ch.min + i * minor) {
    const major = i % 5 === 0;
    // minor ticks are drawn 12 long; each theme shows as much of a tick as it wants (stroke-dasharray, boxes.css)
    const [x0, y0] = pt(88, ang(v)), [x1, y1] = pt(major ? 73 : 76, ang(v));
    const hot = inZone(v) ? ' hot' : within(ch.cold, v) ? ' cold' : '';   // in a warn or red zone, or still cold: Vintage colours the tick instead of drawing the arc
    ticks += `<line class="${major ? 'tk' : 'tm'}${hot}" x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}"/>`;
    if (major) {
      const label = +(v / scale).toFixed(2);
      const [x, y] = pt(labelFit(label)[1], ang(v));
      const bare = ch.dial.bare?.includes(label) || (ch.dial.bareFirst && i === 0) ? ' bare' : '';   // boxes.css leaves these off in Vintage 3D
      nums += `<text class="num${bare}" x="${f1(x)}" y="${f1(y)}">${label}</text>`;
      vdo = vdo === null ? null : (() => { const g = vdoNumber(label, x, y); return g ? `${vdo}<g class="${bare.trim()}">${g}</g>` : null; })();
    }
  }
  const zones = [...(ch.cold || []).map((z) => ['cold', z]), ...(ch.warn || []).map((z) => ['warn', z]), ...(ch.red || []).map((z) => ['red', z])]
    .map(([c, [lo, hi]]) => `<path class="zone ${c}" d="${arc(84, ang(lo), ang(hi))}"/>`).join('');
  // dialLabel: the name on the face, with {unit} where the unit goes; then the LCD shows the number alone
  const unitOnFace = !!ch.dialLabel?.includes('{unit}'), lcdUnit = unitOnFace ? '' : ch.unit;
  const faceLabel = (ch.dialLabel || ch.label).replace('{unit}', ch.unit).trim();
  const valW = maxChars(base) * 12.5, unitW = lcdUnit.length * 6.5, valX = -(valW + 3 + unitW) / 2 + valW;   // nothing moves as digits change
  // The digits' ink sits left of and above their text box (glyph side bearing, baseline under the
  // cap height): these nudges centre the readout in the LCD window (rect y 51..76).
  const inkX = 2, valY = 71;
  const el = document.createElement('div');
  el.className = 'box gauge';
  el.innerHTML = `<svg viewBox="-100 -100 200 200" role="img" aria-label="${esc(ch.label)}">
    <circle class="face" r="97"/><circle class="lip" r="100" clip-path="url(#d3-faceclip)" filter="url(#d3-blur)"/>
    <circle class="ring" r="97"/><g class="print${vdo ? ' has-vdo' : ''}">${zones}${ticks}${nums}${vdo ? `<g class="numg">${vdo}</g>` : ''}
    <text class="lbl" y="-30">${esc(faceLabel)}</text>${note ? `<text class="note" y="-17">${esc(note)}</text>` : ''}</g>
    <rect class="lcd" x="${f1(valX - valW - 7)}" y="51" width="${f1(valW + 3 + unitW + 14)}" height="25" rx="3"/>
    <text class="val end" x="${f1(valX + inkX)}" y="${valY}"><tspan class="v">-</tspan></text><text class="vu" x="${f1(valX + inkX + 3)}" y="${valY}">${esc(lcdUnit)}</text>
    <g class="nwrap"><g class="needle"><path class="nl" d="M-3.5 12L-1.2 -86L0 -88L0 12Z"/><path class="nr" d="M0 12L0 -88L1.2 -86L3.5 12Z"/></g><circle class="hub" r="9"/></g>
    <circle class="glass" r="93"/><path class="rim" d="${arc(96, -100, -10)}"/></svg>`;
  const needle = el.querySelector('.needle');
  const nwrap = el.querySelector('.nwrap');          // needle and cap: the cap sits outside the turn so its highlight stays with the light
  const vEl = el.querySelector('.v');
  const steady = steadyText(ch);
  let raw = null, target = null, cur = null, text = '', held = null;
  return {
    el,
    set(v) { raw = reading(base, v); target = ch.value(v); },
    frame(dt, tauMs) {
      if (target === null) {                         // no reading: no needle, and "-"
        if (text !== '-') { vEl.textContent = '-'; text = '-'; el.dataset.zone = ''; nwrap.style.display = 'none'; cur = null; held = null; }
        return;
      }
      if (text === '-') nwrap.style.display = '';   // back: the needle starts where the reading is
      cur = ease(cur, target, dt, tauMs);
      const a = holdAngle(held, ang(cur));            // still unless it would move more than a hair
      if (a !== held) { held = a; needle.setAttribute('transform', `rotate(${a.toFixed(2)})`); needle.classList.toggle('flip', !(a > lightAt && a < lightAt + 180)); }   // which bevel faces the light
      const t = steady(raw);
      if (t !== text) { vEl.textContent = t; text = t; el.dataset.zone = zoneOf(base, raw); }
    },
  };
}

// A channel marked vdo (channels.js) also carries a VDO dial built like the tach: Vintage 3D shows
// the dial in place of the big number, with the graphs in recessed windows beside it (boxes.css).
export function makeBig(key) {
  const base = CHANNELS[key];
  const ch = shown(base);
  const el = document.createElement('div');
  el.className = 'box big';
  el.style.setProperty('--w', maxChars(base));
  el.innerHTML = `<div class="big-k">${icon(ch.icon)}<span>${esc(ch.label)}</span></div>
    <div class="big-v"><span class="v">-</span><span class="u">${esc(ch.unit)}</span></div>
    <div class="big-win"><canvas class="big-graph"></canvas></div><div class="big-win big-win2"><canvas class="big-graph big-graph2"></canvas></div>`;   // the second shows only when upright (boxes.css)
  const dial = base.vdo ? makeGauge(key) : null;
  if (dial) { el.classList.add('has-dial'); dial.el.classList.add('big-dial'); el.prepend(dial.el); }
  const vEl = el.querySelector('.big-v .v'), graph = el.querySelector('.big-graph'), graph2 = el.querySelector('.big-graph2');
  const steady = steadyText(ch);
  let last = '', drawnAt = 0, drawnW = 0, drawnH = 0;
  return {
    el,
    set(v) {
      dial?.set(v);
      const text = steady(v);
      if (text === last) return;
      vEl.textContent = text;
      last = text;
      el.dataset.zone = zoneOf(base, v);
    },
    frame(dt, tauMs) {                               // the graph gains a point a second; redrawn then, or when resized
      if (dial && dial.el.offsetWidth) dial.frame(dt, tauMs);   // the dial only where the theme shows it
      const now = performance.now(), w = graph.clientWidth, h = graph.clientHeight;
      if (now - drawnAt < 1000 && w === drawnW && h === drawnH) return;
      drawnAt = now; drawnW = w; drawnH = h;
      drawRecent(graph, key, 60, '1 min');
      drawRecent(graph2, key, 900, '15 min');
    },
    rebuild() { drawnAt = 0; },
  };
}

// A dial box's graphs page (the dash's pages.js): its trend and its warm-up time or highest over its last
// 15 minutes, the reading now riding the line, with Warm and Hot lines, in one window (trend_views.js drawGlance; boxes.css styles it an amber LCD in
// the Vintage themes). It reads the history, so set() is only there to fit the box shape.
export function makeGlance(key) {
  const el = document.createElement('div');
  el.className = 'box glance';
  el.innerHTML = '<div class="glance-win"><canvas class="glance-cv"></canvas></div>';
  const cv = el.querySelector('canvas');
  let drawnAt = 0, drawnW = 0, drawnH = 0;
  return {
    el,
    set() {},
    frame() {                                         // a point a second: redrawn then, or when resized
      const now = performance.now(), w = cv.clientWidth, h = cv.clientHeight;
      if (now - drawnAt < 1000 && w === drawnW && h === drawnH) return;
      drawnAt = now; drawnW = w; drawnH = h;
      drawGlance(cv, key);
    },
    rebuild() { drawnAt = 0; },
  };
}

// Every channel the car sends, as a grid of numbers.
export function makeGrid(keys) {
  const view = Object.fromEntries(keys.map((k) => [k, shown(CHANNELS[k])]));
  const el = document.createElement('div');
  el.className = 'box grid';
  // A table: labels flush left, numbers flush right against a unit slot as wide as the column's
  // longest unit, so down a column every number ends, and every unit starts, at the same x, and
  // nothing moves when a value grows a digit.
  const COLS = 3, unitW = [0, 0, 0];
  keys.forEach((k, i) => { unitW[i % COLS] = Math.max(unitW[i % COLS], view[k].unit.length); });
  el.innerHTML = keys.map((k, i) => `<div class="cell" data-k="${k}" style="--uw:${unitW[i % COLS]}"><div class="k">${esc(view[k].short || view[k].label)}</div>
    <div class="n"><span class="v">-</span><span class="u">${esc(view[k].unit)}</span></div></div>`).join('');
  const cells = keys.map((k) => [k, el.querySelector(`[data-k="${k}"]`), el.querySelector(`[data-k="${k}"] .v`)]);
  return {
    el,
    set(reading) {
      for (const [k, cell, v] of cells) {
        const text = view[k].text(reading?.[k]);
        if (v.textContent !== text) { v.textContent = text; cell.dataset.zone = zoneOf(CHANNELS[k], reading?.[k]); }
      }
    },
    frame() {},
  };
}

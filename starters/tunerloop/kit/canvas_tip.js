// kit/canvas_tip.js: the app's kit/canvas_tip.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// The mouse over a chart drawn on a canvas (trend_views.js): a line at the nearest reading and a label
// with its time and value, like the line charts' (charts.js hoverTip). A drawer adds a region per chart
// each time it paints (prep in kit.js clears them), so the label follows the moment under the mouse as
// the line scrolls. Mouse only, with no button down: a finger swipes and taps the panel as before.
const NEAR_PX = 40;   // farther than this from any reading (before the first, or in a gap): no label

const state = new WeakMap();   // canvas -> { regions, at, tip, hair, queued }

// Forget a canvas's regions before it is painted again.
export function clearTips(cv) {
  const s = state.get(cv);
  if (s) s.regions = [];
}

// box: the chart's {x, y, w, h} in canvas pixels. near(mx): the reading nearest mx as
// { x, lines } (lines: the label's rows, the first the time), or null.
export function addTip(cv, box, near) {
  const s = state.get(cv) || wire(cv);
  s.regions.push({ box, near });
  if (s.at && !s.queued) { s.queued = true; queueMicrotask(() => { s.queued = false; show(cv, s); }); }
}

// The reading nearest mx among points [[px, lines]], within NEAR_PX.
export function nearest(points, mx) {
  let best = null, d = NEAR_PX;
  for (const [px, lines] of points) { const e = Math.abs(px - mx); if (e <= d) { d = e; best = { x: px, lines }; } }
  return best;
}

function wire(cv) {
  const tip = document.createElement('div'), hair = document.createElement('div');
  tip.className = 'chart-tip canvas-tip'; hair.className = 'chart-hair canvas-hair';
  tip.hidden = hair.hidden = true;
  document.body.append(hair, tip);
  const s = { regions: [], at: null, tip, hair, queued: false };
  state.set(cv, s);
  const hide = () => { s.at = null; tip.hidden = hair.hidden = true; };
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return hide();
    const r = cv.getBoundingClientRect();
    s.at = { x: e.clientX - r.left, y: e.clientY - r.top };
    show(cv, s);
  });
  cv.addEventListener('pointerleave', hide);
  cv.addEventListener('pointerdown', hide);
  return s;
}

function show(cv, s) {
  const { at, tip, hair } = s;
  const hide = () => { tip.hidden = hair.hidden = true; };
  if (!at || !cv.isConnected) return hide();
  const reg = s.regions.find(({ box: b }) => at.x >= b.x && at.x <= b.x + b.w && at.y >= b.y && at.y <= b.y + b.h);
  const hit = reg && reg.near(at.x);
  if (!hit) return hide();
  const r = cv.getBoundingClientRect(), b = reg.box, px = r.left + hit.x;
  tip.replaceChildren(...hit.lines.map((t, i) => {
    const el = document.createElement(i ? 'b' : 'span');
    if (!i) el.className = 'chart-tip-t';
    el.textContent = t;
    return el;
  }));
  Object.assign(hair.style, { left: `${px}px`, top: `${r.top + b.y}px`, height: `${b.h}px` });
  const css = getComputedStyle(cv);   // the theme's font and colours: the page's body has none of them
  tip.style.fontFamily = css.getPropertyValue('--d-font') || 'system-ui, sans-serif';
  hair.style.background = css.getPropertyValue('--d-label') || 'rgba(255, 255, 255, 0.6)';
  tip.hidden = hair.hidden = false;
  const tw = tip.offsetWidth, x0 = r.left + b.x, x1 = Math.min(r.left + b.x + b.w, document.documentElement.clientWidth);
  tip.style.left = `${Math.max(Math.max(0, x0), Math.min(x1 - tw, px + (px + 12 + tw <= x1 ? 12 : -12 - tw)))}px`;   // right of the line, left of it near the chart's right edge
  tip.style.top = `${Math.max(0, r.top + b.y + 4)}px`;
}

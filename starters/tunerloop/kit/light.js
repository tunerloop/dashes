// kit/light.js: the app's kit/light.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The light in Vintage 3D follows the phone's tilt: the dial's gradients, the needle's shadow and the
// glass's reflection move with it. Runs inside the dash's frame (dashes/tunerloop-dash/index.js); the tilt comes with each
// reading (tilt_x, tilt_y from the phone's sensors, added by the app's js/dash/car_tab.js).
import { setLightAt } from './gauge.js';

let at = 0;
export function moveLight(root, r, now) {
  if (now - at < 100) return;
  at = now;
  const cl = (v) => Math.max(-0.95, Math.min(0.95, v));
  const lx = cl(-0.45 + (r?.tilt_x ?? 0) * 1.2), ly = cl(-0.65 - (r?.tilt_y ?? 0) * 1.2), pct = (v, k) => `${(50 + v * k).toFixed(1)}%`;
  const set = (id, attrs) => { const el = root.querySelector(`#${id}`); if (el) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); };
  set('d3-face', { cx: pct(lx, 22), cy: pct(ly, 22) });
  set('d3-cap', { cx: pct(lx, 33), cy: pct(ly, 33) });
  set('d3-glass', { cx: pct(lx, 55), cy: pct(ly, 55) });
  set('d3-bezel', { x1: 0.5 + lx * 0.5, y1: 0.5 + ly * 0.5, x2: 0.5 - lx * 0.5, y2: 0.5 - ly * 0.5 });
  const sh = root.querySelector('#d3-shadow feDropShadow');
  if (sh) { sh.setAttribute('dx', (-lx * 6).toFixed(2)); sh.setAttribute('dy', (-ly * 6).toFixed(2)); }
  const pr = root.querySelector('#d3-print feDropShadow'), len = Math.hypot(lx, ly) || 1;   // the print's thin shadow, away from the light
  if (pr) { pr.setAttribute('dx', (-lx / len * 0.6).toFixed(2)); pr.setAttribute('dy', (-ly / len * 0.6).toFixed(2)); }
  root.style.setProperty('--d3-lx', `${(lx * 6).toFixed(1)}px`); root.style.setProperty('--d3-ly', `${(ly * 6).toFixed(1)}px`);
  const deg = Math.atan2(lx, -ly) * 180 / Math.PI;
  root.style.setProperty('--d3-turn', `${(deg + 35).toFixed(1)}deg`);   // the glass's reflected arc turns with the light (drawn for -35)
  setLightAt(deg);
}

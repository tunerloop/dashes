// kit/phone_boxes.js: the app's kit/phone_boxes.js as forked with tunerloop-dash. Yours to change.
// Car tab boxes fed by the phone (sensors.js), not the car: the G meter (accelerometer)
// and the Pull view the Hard acceleration mode shows (RPM, speed and the 0-60 / 50-70 timer from
// runs.js). They take the whole reading, which the app's Car tab (js/dash/car_tab.js) extends with speed_kmh, g_lat, g_long and
// run (the timer state). Colours come from the theme (themes.css --d-*).
import { CHANNELS, shown } from './channels.js';
import { steadyText } from './steady.js';
import { prep } from './kit.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function makeG() {
  const el = document.createElement('div');
  el.className = 'box gmeter';
  el.innerHTML = '<canvas></canvas><div class="gm-read"><span class="gm-t">-</span><span class="gm-k">g</span></div>';
  const cv = el.querySelector('canvas'), tEl = el.querySelector('.gm-t');
  const trail = [], peak = { l: 0, r: 0, a: 0, b: 0 };
  let now = { x: null, y: null };
  return {
    el,
    set(r) {
      const x = num(r?.g_lat), y = num(r?.g_long);
      now = { x, y };
      if (x === null || y === null) { tEl.textContent = '-'; return; }
      const t = performance.now();
      trail.push({ t, x, y }); while (trail.length && t - trail[0].t > 2000) trail.shift();
      peak.r = Math.max(peak.r, x); peak.l = Math.max(peak.l, -x); peak.a = Math.max(peak.a, y); peak.b = Math.max(peak.b, -y);
      tEl.textContent = Math.hypot(x, y).toFixed(2);
    },
    frame() {
      const p = prep(cv);
      if (!p) return;
      const [g, w, h] = p, css = getComputedStyle(el), c = (n) => css.getPropertyValue(n).trim();
      const R = Math.min(w, h) * 0.44, cx = w / 2, cy = h / 2, k = R / 1.2;
      const P = (gx, gy) => [cx + Math.max(-1.2, Math.min(1.2, gx)) * k, cy - Math.max(-1.2, Math.min(1.2, gy)) * k];
      g.strokeStyle = c('--d-grid'); g.lineWidth = 1.5;
      for (const rr of [0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(cx, cy, rr * k, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
      g.fillStyle = c('--d-warn');
      for (const [px, py] of [[-peak.l, 0], [peak.r, 0], [0, peak.a], [0, -peak.b]]) { const [a, b] = P(px, py); g.beginPath(); g.arc(a, b, 4, 0, 7); g.fill(); }
      g.strokeStyle = c('--d-label'); g.lineWidth = 3; g.beginPath();
      trail.forEach((p, i) => { const [a, b] = P(p.x, p.y); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
      if (now.x !== null && now.y !== null) {
        const gt = Math.hypot(now.x, now.y), [a, b] = P(now.x, now.y);
        g.fillStyle = gt > 0.8 ? c('--d-red') : gt > 0.5 ? c('--d-warn') : c('--d-value');
        g.beginPath(); g.arc(a, b, Math.max(6, R * 0.08), 0, 7); g.fill();
      }
    },
  };
}

// The Pull view: big RPM, speed, and the timer (or the result for 5 s after the run).
export function makePull() {
  const rpm = shown(CHANNELS.rpm), spd = shown(CHANNELS.speed_kmh), rpmText = steadyText(rpm), spdText = steadyText(spd);
  const el = document.createElement('div');
  el.className = 'box pull';
  el.innerHTML = `<div class="pl-bar"><i></i></div><div class="pl-rpm"><span class="v">-</span><span class="u">rpm</span></div>
    <div class="pl-cells"><div><div class="pl-k">Speed</div><div class="pl-n pl-spd">-</div></div><div><div class="pl-k pl-tn"></div><div class="pl-n pl-t">-</div></div>
    <div><div class="pl-k">Leanest</div><div class="pl-n pl-lean fx3">-</div></div></div>`;
  const q = (s) => el.querySelector(s);
  const rEl = q('.pl-rpm .v'), sEl = q('.pl-spd'), tnEl = q('.pl-tn'), tEl = q('.pl-t'), lEl = q('.pl-lean'), barEl = q('.pl-bar i');
  const spdUnit = spd.unit;
  return {
    el,
    set(r) {
      const rv = num(r?.rpm);
      rEl.textContent = rpmText(rv); el.dataset.shift = rv !== null && rv >= (CHANNELS.rpm.shift ?? Infinity) ? '1' : '';
      barEl.style.width = `${rv === null ? 0 : Math.min(100, rv / 80)}%`;   // the rev bar fills to 8000
      sEl.innerHTML = `<span class="fx3">${spdText(r?.speed_kmh)}</span><small>${spdUnit}</small>`;
      const run = r?.run, live = run?.live, last = run?.last, fresh = last && Date.now() - last.at < 6000;
      if (live) { tnEl.textContent = live.name; tEl.textContent = live.t.toFixed(1); el.dataset.timing = '1'; }
      else if (fresh) { tnEl.textContent = last.name; tEl.textContent = `${last.time.toFixed(2)} s`; el.dataset.timing = ''; }
      else { tnEl.textContent = 'Timer'; tEl.textContent = num(r?.speed_kmh) === null ? 'No GPS' : 'Ready'; el.dataset.timing = ''; }
      const e = live?.leanest ?? (fresh ? last.leanest : null);
      lEl.textContent = e === null || e === undefined ? '' : `${e >= 0 ? '+' : '−'}${Math.abs(e * 100).toFixed(0)}%`;
      lEl.dataset.st = e > 0.05 ? 'red' : e > 0.03 ? 'warn' : '';
    },
    frame() {},
  };
}

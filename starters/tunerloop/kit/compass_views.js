// kit/compass_views.js: the app's kit/compass_views.js as forked with tunerloop-dash. Yours to change.
// The compass pages in the glance look (trend_views.js glanceHead: two big numbers over an amber
// window), for the dash's pages.js (kit/gauge.js makeGlance views 'mix' and 'g'):
//  - mixture (mix): both banks against the target. Up and down is the banks together (the fuel
//    table), left and right is them disagreeing (a leak or an injector on one side). Rings at 3, 6
//    and 9 %, the last 2 s as a trail, the last 30 s as a faint cloud, the dot now coloured by how far
//    off it is, and in a line what it means when something wants attention.
//  - g: the phone's lateral and long g, rings at 0.5 and 1.0 g, the last 10 s as a fading trail, and
//    this drive's peaks marked on each axis (hist.peak).
// Both read the 25-a-second rings (hist.fast); the numbers on top are the newest, steadied over a
// moment so they read at a glance.
import { hist, FAST_HZ } from './hist.js';
import { CHANNELS } from './channels.js';
import { prep, themeOf, typeScale, font, text, line, signed } from './kit.js';
import { glanceHead } from './glance_frame.js';

const F = hist.fast, clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// The banks' error from the target, averaged over 0.4 s from sample k: [together, split] as
// fractions (0.05 = 5 % lean), or null while there is no reading or the injectors are cut.
export function bankErr(k, f = F, cut = hist.cut) {
  let n = 0, a = 0, b = 0;
  for (let q = k; q < k + 10; q++) {
    const t = f.lambda_target.at(q) || 1, x = f.lambda1.at(q), y = f.lambda2.at(q);
    if (cut.at(q) > 0.5 || Number.isNaN(x) || Number.isNaN(y)) continue;
    n++; a += x / t - 1; b += y / t - 1;
  }
  return n && cut.at(k) < 0.5 ? [(a + b) / (2 * n), (b - a) / n] : null;
}

// What a mixture error means, in a line, or '' when it's on target (like a race dash: only what
// needs attention). e: [together, split]; null is overrun.
export function mixVerdict(e) {
  if (!e) return 'Overrun, fuel cut';
  const which = (key) => (CHANNELS[key]?.note ? `, ${CHANNELS[key].note}` : '');
  if (Math.abs(e[1]) > 0.04) return e[1] > 0 ? `Bank 2 leaner: leak or injector${which('lambda2')}` : `Bank 1 leaner: leak or injector${which('lambda1')}`;
  if (Math.abs(e[0]) > 0.03) return e[0] > 0 ? 'Both lean: fuel table' : 'Both rich: fuel table';
  return '';
}

// The window under the numbers, and the largest circle in it: { x, y, w, h, cx, cy, r }.
function windowAt(g, T, w, h, p, top) {
  const x = p, y = top, ww = w - 2 * p, hh = h - top - p;
  g.save(); g.beginPath(); g.roundRect(x, y, ww, hh, 8); g.fillStyle = T.chartBg; g.fill(); g.restore();
  const r = Math.max(10, Math.min(ww, hh) / 2 - Math.max(14, Math.min(ww, hh) * 0.08));
  return { x, y, w: ww, h: hh, cx: x + ww / 2, cy: y + hh / 2, r };
}
const small = (T, Z) => font(T, Math.max(10, Math.min(13, Z.lbl * 1.05)), 600);

export function drawMixCompass(cv) {
  const c = prep(cv); if (!c) return;
  const [g, w, h] = c, T = themeOf(cv), Z = typeScale(w, h), now = bankErr(0), pct = (x) => `${signed(x * 100, 1)}%`;
  const { p, top } = glanceHead(cv, g, w, h, T, Z, [['Together', now ? pct(now[0]) : '-', 'lean +'], ['Split', now ? pct(now[1]) : '-', 'bank 2 +']], ['+88.8%']);
  const W = windowAt(g, T, w, h, p, top), rng = 0.1, k = W.r / rng, ink = T.chartLine || T.fg;
  const P = (e) => [W.cx + clamp(e[1], -rng, rng) * k, W.cy - clamp(e[0], -rng, rng) * k];
  g.save(); g.beginPath(); g.arc(W.cx, W.cy, W.r, 0, 7); g.clip();
  for (const r of [0.03, 0.06, 0.09]) { g.strokeStyle = r === 0.03 ? ink : T.grid; g.globalAlpha = r === 0.03 ? 0.5 : 1; g.lineWidth = 1.5; g.beginPath(); g.arc(W.cx, W.cy, r * k, 0, 7); g.stroke(); }
  g.globalAlpha = 1;
  line(g, W.cx - W.r, W.cy, W.cx + W.r, W.cy, T.grid); line(g, W.cx, W.cy - W.r, W.cx, W.cy + W.r, T.grid);
  g.fillStyle = ink; g.globalAlpha = 0.22;                                   // the last 30 s
  for (let q = 0; q < F.lambda1.len - 10; q += 3) { const e = bankErr(q); if (e) { const [x, y] = P(e); g.fillRect(x - 1.5, y - 1.5, 3, 3); } }
  g.globalAlpha = 1;
  let prev = null;                                                            // the last 2 s
  for (let q = 2 * FAST_HZ; q >= 0; q -= 2) { const e = bankErr(q); if (!e) { prev = null; continue; } const pt = P(e); if (prev) line(g, prev[0], prev[1], pt[0], pt[1], ink, 2.5); prev = pt; }
  if (now) {
    const [x, y] = P(now), worst = Math.max(Math.abs(now[0]), Math.abs(now[1]) / 1.3);
    g.save(); g.shadowColor = ink; g.shadowBlur = T.chartGlow; g.fillStyle = worst > 0.06 ? T.red : worst > 0.03 ? (T.warn || ink) : ink;
    g.beginPath(); g.arc(x, y, Math.max(5, W.r * 0.07), 0, 7); g.fill(); g.restore();
  }
  g.restore();
  const f = small(T, Z), fs = Math.max(10, Math.min(13, Z.lbl * 1.05));
  for (const r of [0.03, 0.06, 0.09]) text(g, `${r * 100}%`, W.cx + r * k + 3, W.cy - 3, font(T, Math.max(9, fs - 2), 600), T.label, 'left');   // the rings' scale
  text(g, 'Both lean', W.cx, W.cy - W.r - 4, f, T.label, 'center');
  text(g, 'Both rich', W.cx, W.cy + W.r + fs + 2, f, T.label, 'center');
  text(g, 'Bank 1 leaner', W.x + 5, W.y + fs + 3, f, T.label, 'left');
  text(g, 'Bank 2 leaner', W.x + W.w - 5, W.y + fs + 3, f, T.label, 'right');
  const say = mixVerdict(now);
  if (say) text(g, say, W.x + 5, W.y + W.h - 6, font(T, fs, 700), now ? (T.warn || ink) : T.label, 'left');
}

export function drawGCompass(cv) {
  const c = prep(cv); if (!c) return;
  const [g, w, h] = c, T = themeOf(cv), Z = typeScale(w, h), steady = (ring) => { let s = 0, n = 0; for (let q = 0; q < 8; q++) { const x = ring.at(q); if (!Number.isNaN(x)) { s += x; n++; } } return n ? s / n : null; };
  const lat = steady(F.g_lat), lon = steady(F.g_long), gs = (x) => (x === null ? '-' : Math.abs(x).toFixed(2));
  const side = (x, neg, pos) => (x === null || Math.abs(x) < 0.05 ? 'g' : `g ${x < 0 ? neg : pos}`);
  const { p, top } = glanceHead(cv, g, w, h, T, Z, [['Lateral', gs(lat), side(lat, 'left', 'right')], ['Long', gs(lon), side(lon, 'braking', 'accel')]], ['8.88']);
  const W = windowAt(g, T, w, h, p, top), max = 1.2, k = W.r / max, ink = T.chartLine || T.fg;
  const P = (x, y) => [W.cx + clamp(x, -max, max) * k, W.cy - clamp(y, -max, max) * k];
  g.save(); g.beginPath(); g.arc(W.cx, W.cy, W.r, 0, 7); g.clip();
  for (const r of [0.5, 1]) { g.strokeStyle = T.grid; g.lineWidth = 1.5; g.beginPath(); g.arc(W.cx, W.cy, r * k, 0, 7); g.stroke(); }
  line(g, W.cx - W.r, W.cy, W.cx + W.r, W.cy, T.grid); line(g, W.cx, W.cy - W.r, W.cx, W.cy + W.r, T.grid);
  const span = 10 * FAST_HZ; let prev = null;                                // the last 10 s, fading
  for (let q = span; q >= 0; q -= 2) {
    const x = F.g_lat.at(q), y = F.g_long.at(q); if (Number.isNaN(x) || Number.isNaN(y)) { prev = null; continue; }
    const pt = P(x, y); if (prev) { g.globalAlpha = 0.12 + 0.88 * (1 - q / span); line(g, prev[0], prev[1], pt[0], pt[1], ink, 3); } prev = pt;
  }
  g.globalAlpha = 1;
  const pk = hist.peak;                                                       // this drive's peaks
  g.fillStyle = T.red; for (const [x, y] of [[-pk.l, 0], [pk.r, 0], [0, pk.a], [0, -pk.b]]) { if (!(Math.abs(x) + Math.abs(y))) continue; const [a, b] = P(x, y); g.beginPath(); g.arc(a, b, 3.5, 0, 7); g.fill(); }
  if (lat !== null && lon !== null) { const [x, y] = P(lat, lon); g.save(); g.shadowColor = ink; g.shadowBlur = T.chartGlow; g.fillStyle = ink; g.beginPath(); g.arc(x, y, Math.max(5, W.r * 0.07), 0, 7); g.fill(); g.restore(); }
  g.restore();
  const f = small(T, Z), fs = Math.max(10, Math.min(13, Z.lbl * 1.05));
  for (const r of [0.5, 1]) text(g, `${r.toFixed(1)} g`, W.cx + r * k + 3, W.cy - 3, font(T, Math.max(9, fs - 2), 600), T.label, 'left');   // the rings' scale
  text(g, 'Accel', W.cx, W.cy - W.r - 4, f, T.label, 'center');
  text(g, 'Braking', W.cx, W.cy + W.r + fs + 2, f, T.label, 'center');
  text(g, `Peaks  L ${pk.l.toFixed(2)}  R ${pk.r.toFixed(2)}`, W.x + 5, W.y + fs + 3, f, T.label, 'left');
  text(g, `A ${pk.a.toFixed(2)}  B ${pk.b.toFixed(2)}`, W.x + W.w - 5, W.y + fs + 3, f, T.label, 'right');
  text(g, '10 s trail', W.x + 5, W.y + W.h - 6, f, T.label, 'left');
}

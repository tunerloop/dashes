// kit/details.js: the app's kit/details.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The detail levels of the Car tab's gauges: what swipe up shows in full screen. Level 0 is the
// gauge's own box; DETAILS[id].levels names every level and draw(g, w, h, level, T, r) paints
// levels 1 and up on a canvas from the live history (hist.js). The Oil Envelope is a canvas at
// every level (makeOil). Every view sizes its type from one scale (kit.js typeScale): labels,
// small values, values and the hero number.
import { hist, FAST_HZ } from './hist.js';
import { CHANNELS, shown, zoneOf, maxChars } from './channels.js';
import { steadyText } from './steady.js';
import { oilMin, oilTop } from './oil.js';
import { drawHistory } from './trend_views.js';
import { prep, themeOf, clamp, font, text, label, rr, line, trace, legend, signed, typeScale, fixed, axes, markGap, twoCharts } from './kit.js';

const F = hist.fast, S = hist.slow;
const pad = (w, h) => Math.round(Math.min(w, h) * 0.05) + 6;
// Portrait full screen (the phone held upright): the views stack their parts, and where one chart would
// stretch tall they show two, each about as tall as it is wide. Time always runs left to right.
const tall = (w, h) => h > w * 1.2;
// A chart's legend, inside its top edge, clear of the value labels.
const chartKey = (g, T, Z, items, x, y) => legend(g, T, items, x + 52, y + Z.lbl * 1.6, Z.lbl);
const unitOf = (key) => shown(CHANNELS[key]);
const NaNs = (v) => (v === null || v === undefined ? NaN : v);
// Steady text for a value shown in a view (no flicker): one per view and channel.
const steadies = {};
const steady = (id, key, v) => (steadies[`${id}:${key}`] ??= steadyText(shown(CHANNELS[key])))(v);

// ---------------------------------------------------------------- lambda: charts, stats, compass
function lambdaChart(g, w, h, T, secs, stats) {
  const p = pad(w, h), Z = typeScale(w, h), ch = shown(CHANNELS.lambda1), conv = (v) => NaNs(ch.value(v));
  let y = p;
  if (stats) {
    let n = 0, inb = 0, s1 = 0, s2 = 0;
    for (let k = 0; k < F.lambda1.len; k++) {
      const t = F.lambda_target.at(k) || 1, a = F.lambda1.at(k), b = F.lambda2.at(k);
      if (hist.cut.at(k) > 0.5 || Number.isNaN(a) || Number.isNaN(b)) continue;
      n++; const e1 = a / t - 1, e2 = b / t - 1; s1 += e1; s2 += e2; if (Math.abs(e1) < 0.03 && Math.abs(e2) < 0.03) inb++;
    }
    const cells = [['On target', n ? `${Math.round(100 * inb / n)}%` : '-', T.ok], ['Bank 1 avg', n ? `${signed(100 * s1 / n)}%` : '-', T.fg], ['Bank 2 avg', n ? `${signed(100 * s2 / n)}%` : '-', T.b2]];
    const cw = (w - 2 * p) / 3, vs = tall(w, h) ? Z.small : Z.value;   // three across fit a phone's width at the small step
    cells.forEach(([k, v, c], i) => { label(g, T, k, p + i * cw, y + Z.lbl, Z.lbl); fixed(g, v, p + i * cw, y + Z.lbl + vs * 0.95, font(T, vs), c, 4); });
    y += Z.lbl + vs + p * 0.6;
  }
  const x = p, cw = w - 2 * p;
  if (!tall(w, h)) { lambdaTrace(g, T, Z, ch, conv, x, y, cw, h - y - p, secs); return; }
  const [a, b] = twoCharts(y, h - p, p * 0.6);   // portrait: the mixture over the revs that made it
  lambdaTrace(g, T, Z, ch, conv, x, a.y, cw, a.h, secs);
  rpmTrace(g, T, Z, x, b.y, cw, b.h, secs);
}
function lambdaTrace(g, T, Z, ch, conv, x, y, cw, chh, secs) {
  const lo = conv(0.75), hi = conv(1.25), grid = [0.8, 0.9, 1.0, 1.1, 1.2].map(conv);
  trace(g, T, x, y, cw, chh, { breaks: hist.breaks('fast', secs * FAST_HZ), span: secs * FAST_HZ, lo, hi, grid, gridLabel: (v) => v.toFixed(ch.dp > 1 ? 1 : 0), cut: hist.cut, seconds: secs,
    series: [{ fn: (k) => conv(F.lambda_target.at(k)), color: T.ok, w: 1.5, dash: [5, 4] },
      { fn: (k) => (hist.cut.at(k) > 0.5 ? NaN : conv(F.lambda1.at(k))), color: T.fg, w: 2.5 },
      { fn: (k) => (hist.cut.at(k) > 0.5 ? NaN : conv(F.lambda2.at(k))), color: T.b2, w: 2.5 }] });
  chartKey(g, T, Z, [['Bank 1', T.fg], ['Bank 2', T.b2], ['Target', T.ok]], x, y);
}
// Bank compass: up and down is both banks together (the fuel table), left and right is the banks
// disagreeing (a leak or injector on one side). Averaged over 0.4 s so the dot doesn't jitter.
function bankErr(k) {
  let n = 0, a = 0, b = 0;
  for (let q = k; q < k + 10; q++) {
    const t = F.lambda_target.at(q) || 1, x = F.lambda1.at(q), y = F.lambda2.at(q);
    if (hist.cut.at(q) > 0.5 || Number.isNaN(x) || Number.isNaN(y)) continue;
    n++; a += x / t - 1; b += y / t - 1;
  }
  return n && hist.cut.at(k) < 0.5 ? [(a + b) / (2 * n), (b - a) / n] : null;
}
function compass(g, w, h, T, cloud) {
  const p = pad(w, h), Z = typeScale(w, h), up = tall(w, h);   // portrait: the circle on top, the numbers under it
  const side = up ? Math.min(w - 2 * p, h * 0.55) : Math.min(h - 2 * p, (w - 2 * p) * 0.55), cx = up ? w / 2 : p + side / 2, cy = up ? p + side / 2 : h / 2, rng = 0.1, k = side / 2 / rng;
  const P = (e) => [cx + clamp(e[1], -rng, rng) * k, cy - clamp(e[0], -rng, rng) * k];
  g.save(); g.beginPath(); g.arc(cx, cy, side / 2, 0, 7); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); g.clip();
  g.fillStyle = T.track; g.fillRect(cx - 0.04 * k, cy - side / 2, 0.08 * k, side);
  for (const r of [0.03, 0.06, 0.09]) { g.strokeStyle = r === 0.03 ? T.ok : T.grid; g.lineWidth = r === 0.03 ? 2 : 1.5; g.beginPath(); g.arc(cx, cy, r * k, 0, 7); g.stroke(); }
  line(g, cx - side / 2, cy, cx + side / 2, cy, T.grid); line(g, cx, cy - side / 2, cx, cy + side / 2, T.grid);
  label(g, T, 'Both lean', cx, cy - side / 2 + Z.lbl * 2, Z.lbl, T.lean, 'center'); label(g, T, 'Both rich', cx, cy + side / 2 - Z.lbl, Z.lbl, T.rich, 'center');
  if (cloud) { g.fillStyle = T.label; g.globalAlpha = 0.25; for (let q = 0; q < F.lambda1.len - 10; q += 3) { const e = bankErr(q); if (e) { const [x, y] = P(e); g.fillRect(x - 2, y - 2, 4, 4); } } g.globalAlpha = 1; }
  let prev = null;
  for (let q = 50; q >= 0; q -= 2) { const e = bankErr(q); if (!e) { prev = null; continue; } const pt = P(e); if (prev) line(g, prev[0], prev[1], pt[0], pt[1], T.label, 3); prev = pt; }
  const now = bankErr(0);
  if (now) { const [x, y] = P(now), worst = Math.max(Math.abs(now[0]), Math.abs(now[1]) / 1.3); g.fillStyle = worst > 0.06 ? T.red : worst > 0.03 ? T.warn : T.ok; g.beginPath(); g.arc(x, y, side * 0.045, 0, 7); g.fill(); }
  else text(g, 'FUEL CUT', cx, cy + Z.small * 0.35, font(T, Z.small), T.label, 'center');
  g.restore();
  const e = now || [0, 0];
  // the two numbers: beside the circle in landscape, side by side under it in portrait
  const at = up ? (i) => [p + i * (w - 2 * p) / 2, p + side + p] : (i) => [p + side + p * 1.4, p + i * (h - 2 * p) / 3];
  [['Together', e[0], Math.abs(e[0]) > 0.03 ? (e[0] > 0 ? T.lean : T.rich) : T.ok], ['Split', e[1], Math.abs(e[1]) > 0.04 ? T.warn : T.ok]].forEach(([n, v, c], i) => {
    const [x, y] = at(i);
    label(g, T, n, x, y + Z.lbl, Z.lbl); fixed(g, now ? `${signed(v * 100)}%` : '-', x, y + Z.lbl + Z.value, font(T, Z.value), now ? c : T.label, 4);
  });
  if (up) {   // portrait: the two numbers over time fill the rest
    const ty = p + side + p * 1.6 + Z.lbl + Z.value, secs = cloud ? 30 : 10, items = [['Together', T.fg], ['Split', T.warn]];
    trace(g, T, p, ty, w - 2 * p, h - ty - p, { breaks: hist.breaks('fast', secs * FAST_HZ), span: secs * FAST_HZ, lo: -10, hi: 10, grid: [-5, 0, 5], gridLabel: (v) => `${v > 0 ? '+' : ''}${v}%`, seconds: secs,
      series: [{ fn: (q) => bankErr(q)?.[0] * 100 ?? NaN, color: T.fg, w: 2.5 }, { fn: (q) => bankErr(q)?.[1] * 100 ?? NaN, color: T.warn, w: 2.5 }] });
    chartKey(g, T, Z, items, p, ty);
    return;   // what it means needs room the chart uses; the colours say it
  }
  let verdict = '';   // nothing when on target, like a race dash: only what needs attention
  const which = (key) => (CHANNELS[key].note ? `, ${CHANNELS[key].note}` : '');   // the bank's cylinders, when the dash's ranges name them
  if (!now) verdict = 'Overrun, fuel cut'; else if (Math.abs(e[1]) > 0.04) verdict = e[1] > 0 ? `Bank 2 leaner: leak or injector${which('lambda2')}` : `Bank 1 leaner: leak or injector${which('lambda1')}`; else if (Math.abs(e[0]) > 0.03) verdict = e[0] > 0 ? 'Both lean: fuel table' : 'Both rich: fuel table';
  if (!verdict) return;
  const [vx, vy] = up ? [p, p + side + p * 2 + Z.lbl + Z.value] : [p + side + p * 1.4, p + 2 * (h - 2 * p) / 3];
  label(g, T, 'What it means', vx, vy + Z.lbl, Z.lbl);
  wrapText(g, verdict, vx, vy + Z.lbl + Z.small * 1.1, (up ? w : w - vx) - p, font(T, Z.small, 600), T.fg, Z.small * 1.15);
}

// Text broken into lines that fit maxW.
function wrapText(g, s, x, y, maxW, f, color, lh) {
  g.font = f; let lineS = '';
  for (const word of s.split(' ')) {
    const t = lineS ? `${lineS} ${word}` : word;
    if (lineS && g.measureText(t).width > maxW) { text(g, lineS, x, y, f, color); y += lh; lineS = word; } else lineS = t;
  }
  if (lineS) text(g, lineS, x, y, f, color);
}

// ---------------------------------------------------------------- rpm
function rpmTrace(g, T, Z, x, y, cw, chh, secs) {
  trace(g, T, x, y, cw, chh, { breaks: hist.breaks('fast', secs * FAST_HZ), span: secs * FAST_HZ, lo: 0, hi: 8000, grid: [2000, 4000, 6000], gridLabel: (v) => `${v / 1000}k`, seconds: secs,
    series: [{ fn: (k) => F.tps_pct.at(k) * 80, fill: T.rich, alpha: 0.25 }, { ring: F.rpm, color: T.fg, w: 3 }] });
  chartKey(g, T, Z, [['RPM', T.fg], ['Throttle', T.rich]], x, y);
}
// Throttle (%) and manifold pressure (kPa) on one 0 to 110 scale.
function loadTrace(g, T, Z, x, y, cw, chh, secs) {
  trace(g, T, x, y, cw, chh, { breaks: hist.breaks('fast', secs * FAST_HZ), span: secs * FAST_HZ, lo: 0, hi: 110, grid: [25, 50, 75, 100], gridLabel: (v) => `${v}`, seconds: secs,
    series: [{ ring: F.tps_pct, color: T.rich, w: 2.5 }, { ring: F.map_kpa, color: T.warn, w: 2.5 }] });
  chartKey(g, T, Z, [['Throttle %', T.rich], ['MAP kPa', T.warn]], x, y);
}
function rpmChart(g, w, h, T, secs) {
  const p = pad(w, h), Z = typeScale(w, h), cw = w - 2 * p;
  if (!tall(w, h)) { rpmTrace(g, T, Z, p, p, cw, h - 2 * p, secs); return; }
  const [a, b] = twoCharts(p, h - p, p * 0.6);
  rpmTrace(g, T, Z, p, a.y, cw, a.h, secs);
  loadTrace(g, T, Z, p, b.y, cw, b.h, secs);
}

// ---------------------------------------------------------------- speed: the 30 s chart, its peaks and its accelerations
// Turning points of a smoothed speed history (k = 0 newest): [{ k, v, kind: 'peak' | 'dip' }], only
// those that rise or fall at least `min` km/h from the last one, so small wobbles don't count.
export function turningPoints(at, n, min = 8) {
  const out = []; let dir = 0, hi = null, lo = null, ext = null;
  for (let k = n - 1; k >= 0; k--) {   // oldest first; a smaller k is more recent
    const v = at(k); if (Number.isNaN(v)) continue;
    if (dir === 0) {                   // until the first real move, track both ends
      if (!hi || v > hi.v) hi = { k, v };
      if (!lo || v < lo.v) lo = { k, v };
      if (hi.v - lo.v >= min) {
        if (hi.k < lo.k) { out.push({ ...lo, kind: 'dip' }); dir = 1; ext = hi; } else { out.push({ ...hi, kind: 'peak' }); dir = -1; ext = lo; }
      }
    } else if (dir === 1) {
      if (v > ext.v) ext = { k, v }; else if (ext.v - v >= min) { out.push({ ...ext, kind: 'peak' }); dir = -1; ext = { k, v }; }
    } else if (v < ext.v) ext = { k, v }; else if (v - ext.v >= min) { out.push({ ...ext, kind: 'dip' }); dir = 1; ext = { k, v }; }
  }
  return out;
}
function speedChart(g, w, h, T) {
  const p = pad(w, h), Z = typeScale(w, h), cw = w - 2 * p;
  if (!tall(w, h)) { speedTrace(g, T, Z, p, p, cw, h - 2 * p); return; }
  const [a, b] = twoCharts(p, h - p, p * 0.6);   // portrait: the speed over the g that changed it
  speedTrace(g, T, Z, p, a.y, cw, a.h);
  gTrace(g, T, Z, p, b.y, cw, b.h, 30);
}
function gTrace(g, T, Z, x, y, cw, chh, secs) {
  trace(g, T, x, y, cw, chh, { breaks: hist.breaks('fast', secs * FAST_HZ), span: secs * FAST_HZ, lo: -1, hi: 1, grid: [-0.5, 0, 0.5], gridLabel: (v) => v.toFixed(1), seconds: secs,
    series: [{ ring: F.g_lat, color: T.fg, w: 2.5 }, { ring: F.g_long, color: T.ok, w: 2.5 }] });
  chartKey(g, T, Z, [['Cornering', T.fg], ['Accel', T.ok]], x, y);
}
function speedTrace(g, T, Z, x, y, cw, chh) {
  const ch = unitOf('speed_kmh'), span = 30 * FAST_HZ;
  const hi = Math.ceil(NaNs(ch.value(Math.max(120, ...[...Array(span).keys()].map((k) => F.speed_kmh.at(k)).filter((v) => !Number.isNaN(v)))) * 1.15) / 20) * 20 || 100;
  const breaks = hist.breaks('fast', span), { P } = axes(x, y, cw, chh, span, 0, hi, breaks);
  trace(g, T, x, y, cw, chh, { breaks, span, lo: 0, hi, grid: [hi / 4, hi / 2, hi * 3 / 4], gridLabel: (v) => `${Math.round(v)}`, seconds: 30,
    series: [{ fn: (k) => NaNs(ch.value(F.speed_kmh.at(k))), color: T.fg, w: 3, fill: T.fg, alpha: 0.06 }] });
  chartKey(g, T, Z, [[`Speed ${ch.unit}`, T.fg]], x, y);
  // smoothed speed, its turning points labelled where they are (they scroll left with the chart)
  const sm = (k) => { let s = 0, c = 0; for (let q = Math.max(0, k - 6); q <= k + 6 && q < span; q++) { const v = F.speed_kmh.at(q); if (!Number.isNaN(v)) { s += v; c++; } } return c ? s / c : NaN; };
  const pts = turningPoints(sm, Math.min(span, F.speed_kmh.len)), now = { k: 0, v: sm(0) };
  const ends = [...pts, now].filter((e) => !Number.isNaN(e.v));
  for (const e of pts) {
    const [px, py] = P(e.k, NaNs(ch.value(e.v))), up = e.kind === 'peak';
    g.fillStyle = T.fg; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill();
    // the speed beside its point, on the side away from the line
    text(g, `${ch.text(e.v)}`, clamp(px, x + 16, x + cw - 16), clamp(up ? py - Z.lbl * 0.9 : py + Z.lbl * 1.8, y + Z.lbl * 1.2, y + chh - 4), font(T, Z.small * 0.7), T.fg, 'center');
  }
  // the average g of each stretch between turning points, mid-way along it
  for (let i = 1; i < ends.length; i++) {
    const a = ends[i - 1], b = ends[i], secs = (a.k - b.k) / FAST_HZ;
    if (secs < 1.5 || breaks.some((q) => b.k <= q.k && a.k > q.k)) continue;   // not across a gap in the data
    const gAvg = (b.v - a.v) / 3.6 / secs / 9.81, mk = (a.k + b.k) / 2, mv = (a.v + b.v) / 2;
    if (Math.abs(gAvg) < 0.05) continue;
    const s = `${signed(gAvg, 2)} g`, [px, py] = P(mk, NaNs(ch.value(mv)));
    g.font = font(T, Z.lbl, 700); const tw = g.measureText(s).width + 12;
    rr(g, px - tw / 2, py - Z.lbl, tw, Z.lbl * 1.6, 6); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill();
    text(g, s, px, py + Z.lbl * 0.35, font(T, Z.lbl, 700), gAvg > 0 ? T.ok : T.red, 'center');
  }
}

// ---------------------------------------------------------------- G: the 10 s trail with the peaks beside it
function gDetail(g, w, h, T) {
  const p = pad(w, h), Z = typeScale(w, h), up = tall(w, h);   // portrait: the circle on top, the peaks under it
  const side = up ? Math.min(w - 2 * p, h * 0.55) : Math.min(h - 2 * p, (w - 2 * p) * 0.55), cx = up ? w / 2 : p + side / 2, cy = up ? p + Z.lbl * 1.5 + side / 2 : h / 2, k = side / 2 / 1.2;
  const P = (x, y) => [cx + clamp(x, -1.2, 1.2) * k, cy - clamp(y, -1.2, 1.2) * k];
  g.save(); g.beginPath(); g.arc(cx, cy, side / 2, 0, 7); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); g.restore();
  for (const r of [0.25, 0.5, 0.75, 1]) { g.strokeStyle = T.grid; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * k, 0, 7); g.stroke(); }
  line(g, cx - side / 2, cy, cx + side / 2, cy, T.grid); line(g, cx, cy - side / 2, cx, cy + side / 2, T.grid);
  const span = 10 * FAST_HZ; let prev = null;
  for (let q = span; q >= 0; q -= 2) {
    const x = F.g_lat.at(q), y = F.g_long.at(q); if (Number.isNaN(x) || Number.isNaN(y)) { prev = null; continue; }
    const pt = P(x, y); if (prev) { g.globalAlpha = 0.15 + 0.8 * (1 - q / span); line(g, prev[0], prev[1], pt[0], pt[1], T.rich, 4); g.globalAlpha = 1; } prev = pt;
  }
  const pk = hist.peak;
  g.fillStyle = T.warn; for (const [x, y] of [[-pk.l, 0], [pk.r, 0], [0, pk.a], [0, -pk.b]]) { const [a, b] = P(x, y); g.beginPath(); g.arc(a, b, 4, 0, 7); g.fill(); }
  label(g, T, 'Accel', cx, cy - side / 2 + Z.lbl * 1.8, Z.lbl, T.ok, 'center'); label(g, T, 'Brake', cx, cy + side / 2 - Z.lbl * 0.8, Z.lbl, T.red, 'center');
  label(g, T, '10 s trail', p, p + Z.lbl, Z.lbl);
  // peaks this drive, beside the circle
  const rx = up ? p : p + side + p * 1.4, ry = up ? cy + side / 2 + p : p, cw = (w - rx - p) / 2, rh = up ? Z.lbl * 1.4 + Z.value * 1.3 : (h - 2 * p - Z.lbl * 2) / 2;
  label(g, T, 'Peaks this drive', rx, ry + Z.lbl, Z.lbl);
  [['Left', pk.l, T.fg], ['Right', pk.r, T.fg], ['Accel', pk.a, T.ok], ['Braking', pk.b, T.red]].forEach(([n, v, c], i) => {
    const x = rx + (i % 2) * cw, y = ry + Z.lbl * 2 + Math.floor(i / 2) * rh;
    label(g, T, n, x, y + Z.lbl, Z.lbl, c); fixed(g, `${v.toFixed(2)} g`, x, y + Z.lbl + Z.value, font(T, Z.value), T.fg);
  });
  if (!up) return;
  const ty = ry + Z.lbl * 2 + 2 * rh;   // portrait: both g's over the last 10 s
  gTrace(g, T, Z, p, ty, w - 2 * p, h - ty - p, 10);
}

// ---------------------------------------------------------------- temperatures: trends and the shock-cooling check
function ratePerMin(ring, wanted = 60) {
  const stop = hist.breaks('slow', wanted).find((q) => q.k >= 0), n = stop ? stop.k + 1 : wanted;   // never measured across a gap
  let sx = 0, sy = 0, sxy = 0, sxx = 0, c = 0;
  for (let k = 0; k < Math.min(n, ring.len); k++) { const y = ring.at(k); if (Number.isNaN(y)) continue; const x = -k; sx += x; sy += y; sxy += x * y; sxx += x * x; c++; }
  return c < 5 ? 0 : 60 * (c * sxy - sx * sy) / (c * sxx - sx * sx);
}
// A temperature's outlook: rate in deg C/min. Head temp also warns when the heads cool too fast
// (air-cooled aircraft monitors' shock-cooling limit: Lycoming says under 50 deg F, 27.8 deg C, a minute).
function outlook(key, v, rate, T) {
  const ch = CHANNELS[key], warn = ch.warn?.[0]?.[0], red = ch.red?.[0]?.[0];
  if (red !== undefined && v >= red) return ['In the red', T.red];
  if (ch.cooling && rate < -ch.cooling[1]) return ['Shock cooling', T.red];
  if (ch.cooling && rate < -ch.cooling[0]) return ['Cooling fast', T.warn];
  if (rate > 0.4 && warn !== undefined) { const to = v < warn ? warn : red, mins = (to - v) / rate; if (mins < 15) return [`${v < warn ? 'Amber' : 'Red'} in ${Math.floor(mins)}:${String(Math.floor((mins % 1) * 60)).padStart(2, '0')}`, v < warn ? T.warn : T.red]; }
  if (rate > 0.4) return ['Rising', T.fg];
  if (rate < -0.4) return ['Cooling', T.rich];
  return ['Steady', T.label];
}
// One temperature: the number and its outlook on the left, its trend on the right (or below, stacked).
function tempTrend(g, T, Z, key, x0, y0, tw, th, mins, stack) {
  const ch = shown(CHANNELS[key]), base = CHANNELS[key], ring = S[key], v = ring.avg(5);
  const rate = ratePerMin(ring), [ot, oc] = v === null ? ['-', T.label] : outlook(key, v, rate, T), dRate = NaNs(ch.value(rate)) - NaNs(ch.value(0));
  const z = zoneOf(base, v), col = z === 'red' ? T.red : z === 'warn' ? T.warn : T.fg;
  const leftW = tw * 0.42, numSize = Z.value;
  label(g, T, ch.label, x0, y0 + Z.lbl, Z.lbl);
  const bw = fixed(g, v === null ? '-' : steady('t', key, v), x0, y0 + Z.lbl + numSize * 0.92, font(T, numSize), col, maxChars(base));
  text(g, '°', x0 + bw, y0 + Z.lbl + numSize * 0.92, font(T, numSize), col);
  // rate and outlook just past the number's fixed box, so they never move
  const rx = x0 + bw + numSize * 0.45 + Z.small, ry = y0 + Z.lbl + Z.small * 0.9;
  text(g, `${signed(dRate)}°/min`, rx, ry, font(T, Z.small, 600), T.fg);
  text(g, ot, rx, ry + Z.small * 1.15, font(T, Z.small * 0.85), oc);
  g.font = font(T, Z.small, 600); const textW = Math.max(g.measureText(`${signed(dRate)}°/min`).width, g.measureText(ot).width);
  const cx = stack ? x0 : Math.max(x0 + leftW, rx + textW + p8()), cy = stack ? y0 + Z.lbl + Math.max(numSize, Z.small * 2.2) + p8() : y0 + Z.lbl * 0.4, cw = stack ? tw : x0 + tw - cx, chh = stack ? th - (cy - y0) : th - Z.lbl * 0.4;
  const redAt = base.red?.[0]?.[0] ?? base.max, lo = Math.max(base.min, (v ?? redAt) - 70), hi = Math.min(base.max, Math.max(redAt + 15, (v ?? 0) + 25));
  const span = mins * 60, breaks = hist.breaks('slow', span), { P, marks } = axes(cx, cy, cw, chh, span, lo, hi, breaks);
  g.save(); rr(g, cx, cy, cw, chh, 8); g.clip(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx, cy, cw, chh);
  for (const [zone, c] of [[base.warn?.[0], T.warn], [base.red?.[0], T.red]]) if (zone) { const [a, b] = P(0, zone[0]), [c2, d] = P(span - 1, zone[0]); line(g, a, b, c2, d, c, 1.5, [6, 5]); }
  g.beginPath(); let pen = false;
  for (let k = 0; k < Math.min(span, ring.len); k++) { const t = ring.at(k); if (Number.isNaN(t)) { pen = false; continue; } const [a, b] = P(k, t); pen ? g.lineTo(a, b) : g.moveTo(a, b); pen = !breaks.some((q) => q.k === k); }
  g.strokeStyle = T.fg; g.lineWidth = 2; g.stroke();
  for (const m of marks) markGap(g, T, m, cy, chh);
  g.restore();
  text(g, `${mins} min`, cx + 6, cy + chh - 6, font(T, Z.lbl, 600), T.label);
}
const p8 = () => 8;

// ---------------------------------------------------------------- the map
const VALUE_LEVELS = ['Last minute', 'Last hour', 'Last 30 days'];   // a value panel: the box, then trend_views.js
export const DETAILS = {
  lambda: { levels: ['Twin', '10 s', '30 s + stats', 'Compass', 'Compass 30 s'],
    draw: (g, w, h, l, T) => (l === 1 ? lambdaChart(g, w, h, T, 10, false) : l === 2 ? lambdaChart(g, w, h, T, 30, true) : compass(g, w, h, T, l === 4)) },
  rpm: { levels: ['Dial', '10 s', '30 s'], draw: (g, w, h, l, T) => rpmChart(g, w, h, T, l === 1 ? 10 : 30),
    under: (g, w, h, T, Z, p) => rpmTrace(g, T, Z, p, 0, w - 2 * p, h - p, 30) },
  speed: { levels: ['Speed', '30 s'], draw: (g, w, h, l, T) => speedChart(g, w, h, T),
    under: (g, w, h, T, Z, p) => speedTrace(g, T, Z, p, 0, w - 2 * p, h - p) },
  g: { levels: ['Now', 'Trail and peaks'], draw: (g, w, h, l, T) => gDetail(g, w, h, T),
    under: (g, w, h, T, Z, p) => gTrace(g, T, Z, p, 0, w - 2 * p, h - p, 30) },
  oil: { levels: ['Envelope', '30 s'], draw: (g, w, h, l, T, r) => drawOil(g, w, h, l, T, r) },
  ect: { levels: [...VALUE_LEVELS, 'All temps'], draw: (g, w, h, l, T) => {
    if (l < 3) return drawHistory(g, w, h, l, T, 'ect_c');
    const p = pad(w, h), Z = typeScale(w, h), rh = (h - 2 * p) / 3;
    ['ect_c', 'oil_temp_c', 'iat_c'].forEach((k, i) => tempTrend(g, T, Z, k, p, p + i * rh, w - 2 * p, rh - 8, 10, tall(w, h)));
  } },
  oilt: { levels: VALUE_LEVELS, draw: (g, w, h, l, T) => drawHistory(g, w, h, l, T, 'oil_temp_c') },
  battery: { levels: VALUE_LEVELS, draw: (g, w, h, l, T) => drawHistory(g, w, h, l, T, 'battery_v') },
};

// Which detail map a panel box uses (null: no levels).
export function detailOf(spec) {
  if (spec.kind === 'twin') return 'lambda';
  if (spec.kind === 'speed' || spec.kind === 'g' || spec.kind === 'oil') return spec.kind;
  if (spec.kind === 'gauge' && spec.key === 'rpm') return 'rpm';
  if (spec.kind === 'big' && spec.key === 'ect_c') return 'ect';
  if (spec.kind === 'big' && spec.key === 'oil_temp_c') return 'oilt';
  if (spec.kind === 'big' && spec.key === 'battery_v') return 'battery';
  return null;
}

// ---------------------------------------------------------------- the Oil Envelope box
// Oil pressure against what's normal for the revs: the number and verdict, and the envelope (pressure
// up, rpm across) with the normal band, the low zone, the current rpm marked and the last 3 s as a
// trail. Square: number on top, envelope below. Wide (full screen): number beside the envelope, and
// level 1 adds the last 30 s against the minimum under it.
function envelope(g, T, Z, x, y, pw, ph, rpm, v, vc) {
  const MAX = 700, X = (q) => x + q / 7500 * pw, Y = (kp) => y + ph - clamp(kp, 0, MAX) / MAX * ph;
  g.save(); rr(g, x, y, pw, ph, 10); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); g.clip();
  g.beginPath(); for (let q = 0; q <= 7500; q += 250) g.lineTo(X(q), Y(oilMin(q))); g.lineTo(X(7500), y + ph); g.lineTo(x, y + ph); g.globalAlpha = 0.16; g.fillStyle = T.red; g.fill();
  g.beginPath(); for (let q = 0; q <= 7500; q += 250) g.lineTo(X(q), Y(oilTop(q))); for (let q = 7500; q >= 0; q -= 250) g.lineTo(X(q), Y(oilMin(q)));
  g.globalAlpha = 0.18; g.fillStyle = T.ok; g.fill(); g.globalAlpha = 1;
  g.beginPath(); for (let q = 0; q <= 7500; q += 250) g.lineTo(X(q), Y(oilMin(q))); g.strokeStyle = T.ok; g.lineWidth = 2; g.stroke();
  for (let q = 1000; q < 7500; q += 1000) line(g, X(q), y, X(q), y + ph, T.grid);
  line(g, X(rpm), y, X(rpm), y + ph, T.label, 1.5, [4, 4]);
  for (let k = 75; k > 0; k--) { const a = F.rpm.at(k), b = F.oil_kpa.at(k), c = F.rpm.at(k - 1), d = F.oil_kpa.at(k - 1); if ([a, b, c, d].some(Number.isNaN)) continue; g.globalAlpha = 0.6 * (1 - k / 75); line(g, X(a), Y(b), X(c), Y(d), T.fg, 3); }
  g.globalAlpha = 1;
  if (v !== null) { g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = vc; g.beginPath(); g.arc(X(rpm), Y(v), Math.max(7, ph * 0.035), 0, 7); g.fill(); g.restore(); }
  g.restore();
  for (let q = 1000; q < 7500; q += 1000) text(g, `${q / 1000}k`, X(q), y + ph - 6, font(T, Z.lbl, 600), T.label, 'center');
}
function drawOil(g, w, h, lvl, T) {
  const p = pad(w, h), Z = typeScale(w, h), ch = unitOf('oil_kpa'), v = F.oil_kpa.avg(6), rpm = F.rpm.avg(6) ?? 0;
  const lo = oilMin(rpm), hi = oilTop(rpm);
  const vc = v === null ? T.label : v < lo ? T.red : v > hi ? T.warn : T.fg;   // white when normal, like a race dash
  const num = v === null ? '-' : steady('oil', 'oil_kpa', v);
  const numberBlock = (x, y, maxW) => {   // the number at hero size, or smaller if its widest value wouldn't fit maxW
    const size = Math.min(Z.hero, (maxW - Z.small * 2) / (maxChars(CHANNELS.oil_kpa) * 0.62));
    label(g, T, 'Oil pressure', x, y + Z.lbl, Z.lbl);
    const bw = fixed(g, num, x, y + Z.lbl + size * 0.85, font(T, size), vc, maxChars(CHANNELS.oil_kpa));
    text(g, ch.unit, x + bw + 8, y + Z.lbl + size * 0.85, font(T, Z.small, 600), T.label);
  };
  const dot = vc === T.fg ? T.ok : vc;
  if (h > w * 0.8) {   // square or portrait: the number on top, the envelope below
    numberBlock(p, p, w - 2 * p);
    const y = p + Z.lbl + Z.hero + p * 0.5, rest = h - y - p, cw = w - 2 * p, upright = tall(w, h);
    // upright, the envelope stays about square and the pressure over time fills the rest (10 s, or 30 s a level up)
    const eh = upright ? Math.min(cw, rest * (lvl === 1 ? 0.5 : 0.62)) : lvl === 1 ? rest * 0.42 : rest;
    envelope(g, T, Z, p, y, cw, eh, rpm, v, dot);
    if (upright || lvl === 1) oilTrace(g, T, Z, ch, p, y + eh + p, cw, rest - eh - p, lvl === 1 ? 30 : 10);
    return;
  }
  // wide: the number in a left column; envelope (and the 30 s trace) on the right
  const lw = (w - 2 * p) * 0.3, rx = p + lw + p, rw = w - rx - p, trendH = lvl === 1 ? (h - 2 * p) * 0.4 : 0;
  numberBlock(p, p, lw);
  envelope(g, T, Z, rx, p, rw, h - 2 * p - (trendH ? trendH + p * 0.5 : 0), rpm, v, dot);
  if (lvl === 1) oilTrace(g, T, Z, ch, rx, h - p - trendH, rw, trendH, 30);
}
// The last secs of oil pressure against the minimum for the revs.
function oilTrace(g, T, Z, ch, x, y, cw, chh, secs) {
  const conv = (kp) => NaNs(ch.value(kp));
  trace(g, T, x, y, cw, chh, { breaks: hist.breaks('fast', secs * FAST_HZ), span: secs * FAST_HZ, lo: 0, hi: conv(700), seconds: secs,
    series: [{ fn: (k) => conv(oilMin(F.rpm.at(k))), color: T.red, w: 1.5, dash: [5, 4] }, { fn: (k) => conv(F.oil_kpa.at(k)), color: T.fg, w: 3 }] });
  chartKey(g, T, Z, [['Pressure', T.fg], ['Minimum for rpm', T.red]], x, y);
}

export function makeOil() {
  const el = document.createElement('div');
  el.className = 'box canvas-box';
  el.innerHTML = '<canvas></canvas>';
  const cv = el.querySelector('canvas');
  return {
    el,
    set() {},
    frame() { const c = prep(cv); if (c) drawOil(c[0], c[1], c[2], 0, themeOf(el)); },
  };
}

// The chart under a dial or number held upright in full screen (DETAILS[id].under), so the page is full.
export function drawUnder(cv, id) {
  const c = prep(cv); if (!c) return;
  DETAILS[id].under(c[0], c[1], c[2], themeOf(cv), typeScale(c[1], c[2]), pad(c[1], c[2]));
}

// Paint one detail level on a canvas.
export function drawDetail(cv, id, level, r) {
  const c = prep(cv); if (!c) return;
  DETAILS[id].draw(c[0], c[1], c[2], level, themeOf(cv), r);
}

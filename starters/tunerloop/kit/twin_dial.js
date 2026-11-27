// kit/twin_dial.js: the app's kit/twin_dial.js as forked with tunerloop-dash. Yours to change.
// The dual lambda dial (Steve, 2026-11-27, after the Porsche oil temperature and pressure gauge): one
// face, two needles from pivots near the centre, bank 1 (cyl 1-3) on the left and bank 2 (cyl 4-6) on
// the right, each on its own arc from rich (0.7, bottom) to lean (1.3, top). A blue marker on each arc
// is the ECU's target, so a needle on its marker is a bank on target. Two LCDs the size of a VDO
// dial's: bank 1 at the top with "1-3" on its left, bank 2 at the bottom with "4-6" on its right, and
// the name under the hubs. A long tick every 0.1, a short one every 0.05 (an exception to the dials'
// three small ticks: the arcs are short), numbers at 0.8, 1.0 and 1.2; the dash's lean and rich zones
// colour their ticks. On overrun (fuel cut, the widebands read air) a bank's LCD says CUT. It draws in
// the dials' own classes (boxes.css, themes.css), so every gauge style dresses it like the others.
import { CHANNELS, shown, reading } from './channels.js';
import { steadyText, holdAngle, ease } from './steady.js';
import { esc, f1 } from './html.js';
import { overrun } from './hist.js';

const LO = 0.7, HI = 1.3, SWEEP = 116, FROM = 148, R = 70, P = 22;   // FROM: rich's angle off straight up

// A bank's needle angle (degrees, 0 straight up, clockwise) for a lambda: side -1 left, 1 right.
export function twinAngle(side, v) {
  const a = FROM - (Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO) * SWEEP;
  return side < 0 ? -a : a;
}
const pt = (side, r, v) => { const a = twinAngle(side, v) * Math.PI / 180; return [side * P + r * Math.sin(a), -r * Math.cos(a)]; };

export function makeTwinDial() {
  const ch = shown(CHANNELS.lambda1), base = CHANNELS.lambda1;
  const within = (zs, v) => (zs || []).some(([lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9);
  let print = '';
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 12; i++) {
      const v = LO + i * 0.05, major = i % 2 === 0, [x0, y0] = pt(s, R, v), [x1, y1] = pt(s, major ? R - 15 : R - 12, v);
      const hot = within(base.warn, v) || within(base.red, v) ? ' hot' : '';
      print += `<line class="${major ? 'tk' : 'tm'}${hot}" x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}"/>`;
      if (i % 4 === 2) { const [x, y] = pt(s, R - 30, v); print += `<text class="num" x="${f1(x)}" y="${f1(y)}">${esc(ch.value(v).toFixed(1))}</text>`; }
    }
  }
  const lcdW = 58, lcd = (y, tag, side) => `<rect class="lcd" x="${-lcdW / 2}" y="${y}" width="${lcdW}" height="25" rx="3"/>
    <text class="val" x="0" y="${y + 20}"><tspan class="v">-</tspan></text>
    <text class="bank" x="${side * (lcdW / 2 + 4)}" y="${y + 16}" style="fill:var(--d-label);font-size:9px;font-weight:600;letter-spacing:0.05em;text-anchor:${side < 0 ? 'end' : 'start'}">${tag}</text>`;
  const needle = (s) => `<g transform="translate(${s * P} 0)"><g class="needle n${s < 0 ? 1 : 2}"><path class="nl" d="M-3.2 9L-1.1 -64L0 -66L0 9Z"/><path class="nr" d="M0 9L0 -66L1.1 -64L3.2 9Z"/></g><circle class="hub" r="9" style="r:9px"/></g>`;   // two caps: smaller than a one-needle dial's
  const bug = (s) => `<g transform="translate(${s * P} 0)"><polygon class="bug b${s < 0 ? 1 : 2}" points="-4.5,${-(R + 9)} 4.5,${-(R + 9)} 0,${-(R + 2)}" style="fill:#4aa8ff"/></g>`;   // blue in every style (Vintage's own cold colour is VDO yellow)
  const el = document.createElement('div');
  el.className = 'box gauge twin-dial';
  el.innerHTML = `<svg viewBox="-100 -100 200 200" role="img" aria-label="Lambda, both banks">
    <circle class="face" r="97"/><circle class="lip" r="100" clip-path="url(#d3-faceclip)" filter="url(#d3-blur)"/><circle class="ring" r="97"/>
    <g class="print">${print}<text class="lbl" y="34">${esc(ch.label.replace(/ \d+$/, '').toUpperCase())}</text></g>
    ${bug(-1)}${bug(1)}${lcd(-76, '1-3', -1)}${lcd(51, '4-6', 1)}${needle(-1)}${needle(1)}
    <circle class="glass" r="93"/></svg>`;
  const parts = [-1, 1].map((s, i) => ({
    s, key: i ? 'lambda2' : 'lambda1', needle: el.querySelector(`.n${i + 1}`), bug: el.querySelector(`.b${i + 1}`),
    v: el.querySelectorAll('.v')[i], steady: steadyText(ch), raw: null, cur: null, held: null, text: '',
  }));
  let tgt = null, cut = false, bugAt = null;
  return {
    el,
    set(r) {
      cut = overrun(r);
      for (const p of parts) p.raw = reading(CHANNELS[p.key], r?.[p.key]);
      tgt = reading(CHANNELS.lambda_target, r?.lambda_target);
    },
    frame(dt, tauMs) {
      for (const p of parts) {
        const t = cut ? 'CUT' : p.raw === null ? '-' : p.steady(p.raw);   // steadyText takes the reading in base units
        if (t !== p.text) { p.v.textContent = t; p.text = t; }
        p.needle.style.display = p.raw === null || cut ? 'none' : '';
        if (p.raw === null || cut) { p.cur = null; continue; }
        p.cur = ease(p.cur, p.raw, dt, tauMs);
        const a = holdAngle(p.held, twinAngle(p.s, p.cur));
        if (a !== p.held) { p.held = a; p.needle.setAttribute('transform', `rotate(${a.toFixed(2)})`); }
      }
      const b = tgt === null ? null : +tgt.toFixed(3);
      if (b !== bugAt) {
        bugAt = b;
        for (const p of parts) {
          p.bug.style.display = b === null ? 'none' : '';
          if (b !== null) p.bug.setAttribute('transform', `rotate(${twinAngle(p.s, b).toFixed(2)})`);
        }
      }
    },
  };
}

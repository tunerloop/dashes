// kit/twin.js: the app's kit/twin.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The Lambda Twin box: both banks on one scale centred on the target, so the driver reads the error,
// not two numbers. Bars grow left for rich and right for lean (+-15 % full scale), with the +-3 %
// target band shaded. A SPLIT note appears when the banks differ by more than 0.04. On overrun
// (throttle shut above 1500 rpm, where the injectors cut and the widebands read air) it says CUT
// instead of showing a scary lean number. Numbers are in the chosen mixture unit (units.js).
import { CHANNELS, shown, reading } from './channels.js';
import { steadyText } from './steady.js';

const RANGE = 0.15, BAND = 0.03, SPLIT = 0.04;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Fuel cut on overrun: throttle closed with the revs up. (A Link fuel-cut channel would be better
// when the live block carries one.)
export const overrun = (r) => (r?.tps_pct ?? 100) < 2 && (r?.rpm ?? 0) > 1500;

// 'ok' | 'rich' | 'lean' | 'danger' | 'cut' | '' for one bank: e is the error (0.05 = 5 % lean).
export function bankState(e, cut) {
  if (cut) return 'cut';
  if (e === null) return '';
  return e > 0.08 ? 'danger' : e > BAND ? 'lean' : e < -BAND ? 'rich' : 'ok';
}

// Where a bank's bar sits, in % of the track width: { left, width, tick }.
export function barGeom(e) {
  const x = Math.max(-RANGE, Math.min(RANGE, e)) / RANGE * 50;
  return { left: 50 + Math.min(0, x), width: Math.abs(x), tick: 50 + x };
}

export function makeTwin() {
  const banks = [['lambda1', 'Bank 1'], ['lambda2', 'Bank 2']].map(([key, name]) => {
    const ch = shown(CHANNELS[key]);
    return { key, name: ch.note ? `${name} \u00b7 ${ch.note}` : name, ch, text: steadyText(ch) };   // its note (the dash's ranges): which cylinders it reads
  });
  const tgt = shown(CHANNELS.lambda_target);
  const el = document.createElement('div');
  el.className = 'box twin';
  el.innerHTML = `<div class="tw-head"><span>${esc(banks[0].ch.label.replace(/ 1$/, ''))}</span><span class="tw-split" hidden></span><span class="tw-tgt"></span></div>
    ${banks.map((b) => `<div class="tw-row"><div class="tw-k">${esc(b.name)}</div><div class="tw-n">-</div>
      <div class="tw-bar"><i class="tw-band"></i><i class="tw-fill"></i><i class="tw-tick"></i><span class="tw-cut">Fuel cut</span></div></div>`).join('')}
    <div class="tw-scale"><span class="rich">Rich</span><span>&minus;5%</span><span>+5%</span><span class="lean">Lean</span></div>`;
  const rows = [...el.querySelectorAll('.tw-row')].map((row) => ({ row, n: row.querySelector('.tw-n'), fill: row.querySelector('.tw-fill'), tick: row.querySelector('.tw-tick') }));
  const tgtEl = el.querySelector('.tw-tgt'), splitEl = el.querySelector('.tw-split');
  el.style.setProperty('--tw-band-l', `${50 - BAND / RANGE * 50}%`);
  el.style.setProperty('--tw-band-w', `${BAND / RANGE * 100}%`);
  return {
    el,
    // r: the whole reading (base units), since the box needs both banks, the target and the throttle.
    set(r) {
      const t = reading(CHANNELS.lambda_target, r?.lambda_target);
      const target = t ?? 1;
      tgtEl.textContent = t === null ? 'Target -' : `Target ${tgt.text(t)}`;
      const cut = overrun(r);
      const vals = banks.map((b) => reading(CHANNELS[b.key], r?.[b.key]));
      banks.forEach((b, i) => {
        const v = vals[i], e = v === null ? null : v / target - 1, st = bankState(e, cut), g = rows[i];
        g.row.dataset.st = st;
        g.n.textContent = cut ? 'CUT' : b.text(v);
        if (e === null || cut) { g.fill.style.width = '0'; g.tick.hidden = true; return; }
        const { left, width, tick } = barGeom(e);
        g.fill.style.left = `${left}%`; g.fill.style.width = `${width}%`;
        g.tick.hidden = false; g.tick.style.left = `${tick}%`;
      });
      const split = !cut && vals[0] !== null && vals[1] !== null && Math.abs(vals[0] - vals[1]) > SPLIT + 1e-9;
      splitEl.hidden = !split;
      if (split) splitEl.textContent = `Split ${Math.abs(vals[0] - vals[1]).toFixed(2)}`;
    },
    frame() {},
  };
}

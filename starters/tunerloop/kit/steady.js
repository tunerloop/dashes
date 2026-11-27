// kit/steady.js: the app's kit/steady.js as forked with tunerloop-dash. Yours to change.
// Numbers that don't flicker. The shown value moves only when the reading passes 3/4 of a step
// beyond it (hysteresis), at most maxHz times a second, and the step widens while the value sweeps
// fast (RPM in 250s during a pull, 50s when steady). Digits stay put because the dash font's
// figures are tabular (css font-variant-numeric).

// How often the digits may change at most, for every Steady at once while set (Direct's readings come
// 20 a second, so the Car tab lets them change faster then); null: each its own maxHz.
let hzOverride = null;
export const setSteadyHz = (hz) => { hzOverride = hz || null; };

// A needle that doesn't twitch: it keeps its angle until the reading would move it more than band
// degrees (1.5: about 45 RPM on the tach, 4 to 5 px at the tip of a phone-sized dial; 0.6 still
// jittered at idle in the car, 2026-11-21), then goes straight to the new angle.
export const holdAngle = (held, a, band = 1.5) => (held === null || Math.abs(a - held) > band ? a : held);

export class Steady {
  constructor({ step = 1, fastStep = step, fastRate = Infinity, maxHz = 5 } = {}) {
    Object.assign(this, { step, fastStep, fastRate, maxHz });
    this.shown = null; this.prev = null; this.tPrev = 0; this.tChange = -Infinity; this.rate = 0;
  }

  // v: the reading in display units (null for none); now: ms. Returns the value to show, or null.
  update(v, now) {
    if (v === null || v === undefined || !Number.isFinite(v)) { this.shown = null; this.prev = null; return null; }
    const dt = (now - this.tPrev) / 1000;
    if (this.prev !== null && dt > 0.001) this.rate += (Math.abs(v - this.prev) / dt - this.rate) * Math.min(1, dt * 4);
    if (dt > 0.001) { this.prev = v; this.tPrev = now; }
    const step = this.rate > this.fastRate ? this.fastStep : this.step;
    const snap = Math.round(v / step) * step;
    if (this.shown === null) { this.shown = snap; this.tChange = now; }
    else if (Math.abs(v - this.shown) > step * 0.75 && now - this.tChange >= 1000 / (hzOverride || this.maxHz)) { this.shown = snap; this.tChange = now; }
    return this.shown;
  }
}

// A text function for a channel as shown (channels.js shown()): base reading in, steady text out
// ('-' for none). The step is the channel's last shown digit unless the channel sets its own.
export function steadyText(ch, opts = {}) {
  const s = new Steady({ step: 10 ** -ch.dp, ...(ch.steady || {}), ...opts });
  return (v, now = Date.now()) => {
    const x = s.update(ch.value(v), now);
    return x === null ? '-' : x.toFixed(ch.dp);
  };
}

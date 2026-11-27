// kit/gesture.js: the app's kit/gesture.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// Touch decisions as plain functions (no DOM), for touch.js and any dash: which box is next, and what
// a pointer's movement was. Checked by tests/unit/gesture.test.js.

// The next box in a panel of n boxes, looping: dir 1 (swipe left) or -1 (swipe right).
export const cycle = (i, n, dir) => (n ? (((i + dir) % n) + n) % n : 0);

// A swipe or a tap from a pointer's movement: 'next', 'prev', 'up', 'down', 'tap' or '' (a drag that
// went neither way clearly, or not far enough). w, h: the panel's size. A swipe has to cover share of
// the panel that way (sideways: the width, up and down: the height), or flickShare within flickMs.
export function gesture(dx, dy, ms, w, h, { share = 0.4, flickShare = 0.2, flickMs = 200 } = {}) {
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && ms < 400) return 'tap';
  const far = (d, size) => Math.abs(d) >= size * (ms <= flickMs ? flickShare : share);
  if (Math.abs(dx) > 1.5 * Math.abs(dy) && far(dx, w)) return dx < 0 ? 'next' : 'prev';
  if (Math.abs(dy) > 1.5 * Math.abs(dx) && far(dy, h)) return dy < 0 ? 'up' : 'down';
  return '';
}

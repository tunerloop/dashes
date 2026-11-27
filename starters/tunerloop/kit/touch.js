// kit/touch.js: the app's kit/touch.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// A panel's touches as intents, so the dash never handles pointer events itself:
//   tap()                     a short touch that did not move
//   longPress()               held still for LONG_PRESS_MS (the box menu)
//   twoFingerTap()            a second finger down and both up quickly (the units)
//   drag(axis, dx, dy)        moving, locked to one axis ('x' or 'y') from the first 8 px
//   release(axis, g, dx, dy)  the finger up after a drag; g is the gesture (gesture.js gesture:
//                             'next', 'prev', 'up', 'down' or '' when it was not far enough)
//   cancel()                  the drag is off (a second finger came down)
// busy() true: new touches are ignored (a page still sliding).
import { gesture } from './gesture.js';

const LONG_PRESS_MS = 500;

export function listen(el, h) {
  let start = null, pressTimer = 0;
  el.addEventListener('contextmenu', (e) => e.preventDefault());   // Android's long-press menu
  el.addEventListener('pointerdown', (e) => {
    if (start && e.pointerId !== start.id && !start.long && performance.now() - start.t < 400) {   // a second finger
      start.multi = true; clearTimeout(pressTimer);
      if (start.axis) h.cancel();
      return;
    }
    if (start || h.busy()) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, long: false, multi: false, axis: null };
    el.setPointerCapture(e.pointerId);
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { if (start && !start.axis) { start.long = true; h.longPress(); } }, LONG_PRESS_MS);
  });
  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id || start.long || start.multi) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) >= 10) clearTimeout(pressTimer);
    if (!start.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 8) start.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    if (start.axis) h.drag(start.axis, dx, dy);
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    clearTimeout(pressTimer);
    const s = start, dx = e.clientX - s.x, dy = e.clientY - s.y, ms = performance.now() - s.t;
    start = null;
    if (s.long) return;                              // the finger that opened the menu lifting
    if (s.multi) { if (Math.hypot(dx, dy) < 20 && ms < 600) h.twoFingerTap(); return; }
    const g = e.type === 'pointercancel' ? '' : gesture(dx, dy, ms, el.clientWidth, el.clientHeight);
    if (s.axis) h.release(s.axis, g, dx, dy);
    else if (g === 'tap') h.tap();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

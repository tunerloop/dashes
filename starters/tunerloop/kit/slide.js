// kit/slide.js: the app's kit/slide.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// Pages moving with the finger: the page on screen (from) and the one coming in (to) move together
// along one axis, the incoming one a page behind on side dir (1: below or right, -1: above or left),
// with a groove between them naming it (up and down only). With nothing coming in, the page moves a
// little against the finger and springs back. The same slide moves a page inside a panel, inside the
// full screen layer, or the whole panels grid against the full screen layer.
//   const s = makeSlide({ axis: 'y', dir: 1, from: [a], to: [b], ref: slot, label: 'Oil temp · Graphs' });
//   s.move(dy);  ...  const went = await s.finish(go);  /* change state */  s.clear();
const MS = 180, STRETCH = 0.35;
let sepEl = null;

function separator(root) {
  if (!sepEl) {
    sepEl = document.createElement('div');
    sepEl.className = 'pagesep';
    sepEl.innerHTML = '<span></span>';
  }
  if (sepEl.parentNode !== root) root.append(sepEl);
  return sepEl;
}

// ref: an element that does not move, the size of one page: the slide's frame.
export function makeSlide({ axis, dir, from, to, ref, label = '' }) {
  const r = ref.getBoundingClientRect(), size = axis === 'y' ? r.height : r.width;
  const shift = (v) => (axis === 'y' ? `translateY(${v}px)` : `translateX(${v}px)`);
  const sep = label && axis === 'y' && to.length ? separator(ref.closest('.dash') || document.body) : null;
  if (sep) {
    sep.querySelector('span').textContent = label;
    Object.assign(sep.style, { left: `${r.left}px`, width: `${r.width}px` });
    sep.hidden = false;
  }
  // Where everything sits for an offset: from at it, to a page behind, the groove where they meet.
  const targets = (off) => {
    const at = to.length ? off : off * STRETCH, out = [];
    for (const e of from) out.push([e, shift(at)]);
    for (const e of to) out.push([e, shift(at + dir * size)]);
    if (sep) out.push([sep, `translateY(${r.top + at + (dir > 0 ? size : 0)}px) translateY(-50%)`]);
    return out;
  };
  let offset = 0;
  const slide = {
    size, dir, from, to,
    move(off) { offset = off; for (const [e, t] of targets(off)) e.style.transform = t; },
    // Animate to the end (go and something comes in) or back to the start. Resolves true when it went.
    async finish(go) {
      const went = go && to.length > 0, end = targets(went ? -dir * size : 0);
      const now = targets(offset);
      await Promise.all(end.map(([e, t], k) => {
        e.style.transform = t;
        return e.animate([{ transform: now[k][1] }, { transform: t }], { duration: MS, easing: 'ease-out' }).finished.catch(() => {});
      }));
      return went;
    },
    // Every element back to where it lays out on its own.
    clear() {
      for (const e of [...from, ...to]) e.style.transform = '';
      if (sep) sep.hidden = true;
    },
  };
  slide.move(0);
  return slide;
}

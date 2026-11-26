// Big numbers: four readings the person picks in Settings, each filling a quarter of the screen,
// in their display units. Uses only the raw dash API (no kit), so the whole dash is this file and
// big-numbers.css. Readings arrive in base units (kPa, °C, km/h, lambda); units.js turns them into
// the person's.
import { LABELS, show } from './units.js';

export default function mount(api) {
  const keys = ['a', 'b', 'c', 'd'].map((k) => api.settings[k]);
  api.root.innerHTML = `<div class="grid">${keys.map((k) => `<div class="cell"><div class="num">-</div><div class="lbl"></div></div>`).join('')}</div>`;
  const cells = [...api.root.querySelectorAll('.cell')];
  let units = api.units, last = {}, dim = false, dirty = true;

  const label = (k) => {
    const unit = show(k, null, units).unit;
    return `${LABELS[k] || k}${unit ? ` · ${unit}` : ''}`;
  };
  const relabel = () => { keys.forEach((k, i) => { cells[i].querySelector('.lbl').textContent = label(k); }); dirty = true; };
  relabel();

  api.on('reading', (v, t, m) => { last = v; dim = !!m.dim; dirty = true; });
  api.on('units', (u) => { units = u; relabel(); });

  // Numbers change at most 4 times a second, so they can be read, drawn on the screen's own clock.
  let shownAt = 0;
  (function frame(now) {
    if (dirty && now - shownAt > 250) {
      keys.forEach((k, i) => { cells[i].querySelector('.num').textContent = show(k, last[k], units).text; });
      api.root.classList.toggle('dim', dim);
      dirty = false; shownAt = now;
    }
    requestAnimationFrame(frame);
  })(0);

  // The tab bar: a tap anywhere hides it or brings it back.
  api.root.addEventListener('click', () => (api.nav.shown ? api.nav.hide() : api.nav.show()));
}

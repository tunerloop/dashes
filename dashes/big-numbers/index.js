// Big numbers: four readings the person picks, each filling a quarter of the screen, in their
// display units. Uses only the raw dash API (no kit), so the whole dash is this file, units.js and
// big-numbers.css. Readings arrive in base units (kPa, °C, km/h, lambda); units.js turns them into
// the person's.
//
// Its settings are its own: the app's gear (api.on('settings')) opens a panel with one picker per
// quarter, and the picks are kept in the dash's store.
import { LABELS, show } from './units.js';

const DEFAULTS = ['rpm', 'oil_temp_c', 'oil_kpa', 'lambda1'];

export default function mount(api) {
  const saved = api.store.get('keys');   // untrusted: four known reading keys, else the defaults
  let keys = Array.isArray(saved) && saved.length === 4 && saved.every((k) => Object.hasOwn(LABELS, k)) ? saved : DEFAULTS;
  api.root.innerHTML = `<div class="grid">${keys.map(() => '<div class="cell"><div class="num">-</div><div class="lbl"></div></div>').join('')}</div>`;
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

  // The settings: a picker per quarter, applied as soon as one changes.
  api.on('settings', () => {
    api.root.querySelector('.set')?.remove();
    api.nav.hide();
    const el = document.createElement('div');
    el.className = 'set';
    const names = ['Top left', 'Top right', 'Bottom left', 'Bottom right'];
    el.innerHTML = keys.map((k, i) => `<label>${names[i]}<select data-i="${i}">${Object.entries(LABELS).map(([key, name]) => `<option value="${key}"${key === k ? ' selected' : ''}>${name}</option>`).join('')}</select></label>`).join('')
      + '<button type="button">Done</button>';
    el.addEventListener('change', (e) => {
      keys = keys.map((k, i) => (i === Number(e.target.dataset.i) ? e.target.value : k));
      api.store.set('keys', keys);
      relabel();
    });
    el.querySelector('button').addEventListener('click', () => el.remove());
    api.root.append(el);
  });

  // The tab bar: a tap anywhere (but the settings) hides it or brings it back.
  api.root.addEventListener('click', (e) => { if (!e.target.closest('.set')) api.nav.shown ? api.nav.hide() : api.nav.show(); });
}

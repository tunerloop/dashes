// The TunerLoop dash's own settings: the gauge style and the four automatic modes, kept in its store
// (api.store 'settings') and opened by the app's gear (api.on('settings')), a panel over the whole
// dash. A change applies at once. The redline isn't one of them: it follows the car's tune (index.js).
import { THEMES } from './box_list.js';
import { esc } from './kit/html.js';

export const DEFAULTS = { style: 'vintage3d', auto_pull: true, auto_corner: true, auto_stop: true, auto_warm: true };
const AUTOS = [['auto_pull', 'Hard acceleration'], ['auto_corner', 'Cornering'], ['auto_stop', 'Stoplight'], ['auto_warm', 'Warm-up']];

// The saved settings, each one checked, defaults for the rest.
export function loadSettings(store) {
  const saved = store.get('settings') || {}, out = { ...DEFAULTS };
  if (THEMES.some(([k]) => k === saved.style)) out.style = saved.style;
  for (const [k] of AUTOS) if (typeof saved[k] === 'boolean') out[k] = saved[k];
  return out;
}

// The panel. s: the settings now; redline: { rpm, fromTune } for the line under them; onChange(s).
export function openSettings(root, api, s, redline, onChange) {
  root.querySelector('.dset')?.remove();
  api.nav.hide();   // the tab bar would cover the panel's last row
  const el = document.createElement('div');
  el.className = 'dset';
  const btn = (attr, on, text) => `<button ${attr}${on ? ' class="on"' : ''}>${esc(text)}</button>`;
  const draw = () => {
    el.innerHTML = `<h4>Gauge style</h4><div class="row">${THEMES.map(([k, name]) => btn(`data-style="${k}"`, s.style === k, name)).join('')}</div>
      <h4>Automatic modes</h4><div class="row">${AUTOS.map(([k, name]) => btn(`data-auto="${k}"`, s[k], name)).join('')}</div>
      <p>Redline ${redline().rpm} rpm${redline().fromTune ? ', from the tune' : ''}</p>
      <button class="done">Done</button>`;
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('done')) { el.remove(); return; }
    if (b.dataset.style) s = { ...s, style: b.dataset.style };
    if (b.dataset.auto) s = { ...s, [b.dataset.auto]: !s[b.dataset.auto] };
    api.store.set('settings', s);
    onChange(s);
    draw();
  });
  draw();
  root.append(el);
}

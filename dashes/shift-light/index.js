// Shift light: a whole dash with one job. A row of lights that fill with the revs, green then amber
// then red, and all flash at the shift point; the best RPM this phone has seen underneath; a tap
// anywhere puts the app's tab bar away, and the next brings it back. Uses only the raw API (no kit), to show how little a dash
// needs. Its look is its own (shift-light.css, in its manifest's styles); the type is a font the app
// gives every dash.
//
// Its settings are its own: the shift point follows the car's tune (800 rpm under the rev limit, from
// api.tune, the tune feed in dash.json) unless the driver sets one, and the lights start 2500 rpm
// before it unless set too. Both are kept in its store and set in its panel, which the app's gear
// opens (api.on('settings')).
const LIGHTS = 10, BEFORE_LIMIT = 800, SPAN = 2500, NO_TUNE_SHIFT = 6500;

export default function mount(api) {
  api.root.innerHTML = `<div class="sl"><div class="row">${Array.from({ length: LIGHTS }, (_, i) => `<i class="${i < 6 ? 'g' : i < 8 ? 'a' : 'r'}"></i>`).join('')}</div>
    <div class="n">-</div><div class="best"></div></div>`;
  const row = api.root.querySelector('.row'), lights = [...row.children], num = api.root.querySelector('.n'), bestEl = api.root.querySelector('.best');
  let rpm = null, best = api.store.get('best') || 0, savedAt = 0;
  const showBest = () => { bestEl.textContent = best ? `Best ${Math.round(best)} rpm` : ''; };
  showBest();

  // The driver's numbers (null: automatic), and the points they give.
  let mine = { shift: num0(api.store.get('shift')), start: num0(api.store.get('start')) };
  const auto = () => (Number.isFinite(api.tune?.rev_limit) ? api.tune.rev_limit - BEFORE_LIMIT : NO_TUNE_SHIFT);
  const shiftAt = () => mine.shift ?? auto();
  const startAt = () => Math.min(mine.start ?? shiftAt() - SPAN, shiftAt() - 100);

  api.on('reading', (v) => { rpm = typeof v?.rpm === 'number' ? v.rpm : null; });
  api.root.addEventListener('click', (e) => { if (!e.target.closest('.sl-set')) api.nav.shown ? api.nav.hide() : api.nav.show(); });   // this dash's way to the tab bar
  api.on('settings', openPanel);

  function openPanel() {
    api.root.querySelector('.sl-set')?.remove();
    api.nav.hide();
    const el = document.createElement('div');   // not a form: the frame's sandbox blocks submitting one
    el.className = 'sl-set';
    const field = (k, label, ph) => `<label>${label}<input name="${k}" type="number" inputmode="numeric" min="1000" max="12000" step="50" placeholder="${ph}" value="${mine[k] ?? ''}"></label>`;
    el.innerHTML = field('shift', 'Shift at', `${auto()} (${api.tune?.rev_limit ? 'from the tune' : 'auto'})`)
      + field('start', 'First light at', `${shiftAt() - SPAN} (auto)`) + '<p>Leave blank for automatic.</p><button type="button">Done</button>';
    el.querySelector('button').addEventListener('click', () => {
      const val = (k) => el.querySelector(`[name="${k}"]`).value;
      mine = { shift: num0(val('shift')), start: num0(val('start')) };
      api.store.set('shift', mine.shift ?? undefined);
      api.store.set('start', mine.start ?? undefined);
      el.remove();
    });
    api.root.append(el);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const shift = shiftAt(), start = startAt();
    num.textContent = rpm === null ? '-' : String(Math.round(rpm / 50) * 50);
    const lit = rpm === null ? 0 : Math.round(Math.max(0, Math.min(1, (rpm - start) / (shift - start))) * LIGHTS);
    lights.forEach((el, i) => el.classList.toggle('on', i < lit));
    row.classList.toggle('flash', rpm !== null && rpm >= shift && Math.floor(t / 90) % 2 === 0);
    if (rpm !== null && rpm > best + 50) {
      best = rpm;
      showBest();
      if (t - savedAt > 2000) { api.store.set('best', best); savedAt = t; }   // the store is small and kept by the app: not every frame
    }
  }
  requestAnimationFrame(frame);
}

// A whole rpm from a box or the store, else null (automatic).
function num0(v) {
  const n = typeof v === 'string' ? (v.trim() ? Number(v) : NaN) : v;
  return Number.isFinite(n) && n >= 1000 && n <= 12000 ? Math.round(n) : null;
}

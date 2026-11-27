// The TunerLoop dash: the Car tab's built-in dash (../../../../ecuai/docs/plan-dashes.md). Two panels
// of boxes and a full screen layer, each box a row of pages (panels.js), the automatic modes, the
// alarm banner, and the light in Vintage 3D following the phone's tilt. Fork it
// (scripts/fork_dash.mjs), give dash.json a new id, change what you like.
//
// Its limits (zones, valid ranges, the oil envelope, the warm-up point) are its own, in ranges.js; its
// alarm rules in alarms.js. The redline follows the car's tune (api.tune.rev_limit). Its settings
// (gauge style, automatic modes) are its own too, in settings.js, opened by the app's gear.
//
// Data comes from the app: each reading (base units, with the phone's speed, g and tilt and the 0-60
// timer); the phone's recent history at start; stored history on request (kit/trend_data.js).
import { hist } from './kit/hist.js';
import { useUnits } from './kit/units.js';
import { useChannels } from './kit/channels.js';
import { useOil } from './kit/oil.js';
import { setSteadyHz } from './kit/steady.js';
import { setTrendSource } from './kit/trend_data.js';
import { autoStep } from './kit/automodes.js';
import { showAlarms } from './kit/alarm_banner.js';
import { moveLight } from './kit/light.js';
import { D3_DEFS } from './kit/d3defs.js';
import { createPanels } from './panels.js';
import { startFrom } from './start.js';
import { RANGES, OIL, WARM_BELOW_C } from './ranges.js';
import { ALARMS } from './alarms.js';
import { loadSettings, openSettings } from './settings.js';


export default function mount(api) {
  const root = api.root, start = startFrom(api.params);
  let s = loadSettings(api.store);
  root.dataset.theme = start?.theme || s.style;
  root.insertAdjacentHTML('beforeend', D3_DEFS);
  // Before anything is drawn: this dash's ranges, the redline from the tune when the app has it.
  const redline = () => redlineFrom(api.tune);
  useChannels(RANGES);
  useChannels(redlineRanges(redline().rpm));
  useOil(OIL);
  useUnits(api.units);
  setTrendSource({ call: (name, body) => api.request('trend', { name, body }), bridge: () => api.bridge });
  if (api.history) hist.restore(api.history);
  const panels = createPanels(root, api, start);
  // Under a test address the automatic modes are off unless it asks for them (auto=1): the simulated
  // drive keeps setting them off.
  const autosFrom = (x) => (start && !start.auto ? {} : { pull: x.auto_pull, corner: x.auto_corner, stop: x.auto_stop, warm: x.auto_warm, warmBelow: WARM_BELOW_C });
  let autoOn = autosFrom(s);
  api.on('settings', () => openSettings(root, api, s, redline, (next) => {
    const restyle = next.style !== s.style && !start?.theme;
    s = next;
    autoOn = autosFrom(s);
    if (restyle) { root.dataset.theme = s.style; panels.rebuild(); }
  }));
  // A new tune read: the redline moves with it.
  api.on('tune', () => { useChannels(redlineRanges(redline().rpm)); panels.rebuild(); });

  let value = null, smooth = 70, autoSt = {};
  api.on('reading', (v, t, m) => {
    value = v;
    smooth = m.smoothMs ?? 70;
    setSteadyHz(m.digitsHz);
    root.dataset.mode = m.dim ? 'dim' : '';
    hist.tick(t);
    if (!m.dim) hist.push(v, t);   // late readings aren't charted: the charts stop until new ones come
  });
  api.on('units', (u) => { useUnits(u); panels.rebuild(); });
  api.on('fonts', panels.rebuildViews);   // charts drew before the theme fonts arrived

  let last = 0;
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(250, now - last) : 16;
    last = now;
    if (root.dataset.theme === 'vintage3d') moveLight(root, value, now);
    const auto = autoStep(autoSt, value, Date.now(), autoOn);
    autoSt = auto.st;
    panels.draw({ value, dt, smoothMs: smooth, now }, [auto.left, auto.right]);
    showAlarms(root, value, now, ALARMS);
  });
}

// The redline: the tune's rev limit, else the one in ranges.js. Red from there to the end of
// the scale; the Pull view's shift light 800 rpm before it.
const AS_FOUND = RANGES.rpm.red[0][0];
export function redlineFrom(tune) {
  const rpm = tune?.rev_limit;
  return Number.isFinite(rpm) && rpm >= 2000 && rpm <= 20000 ? { rpm, fromTune: true } : { rpm: AS_FOUND, fromTune: false };
}
export function redlineRanges(rpm) {
  const top = Math.max(RANGES.rpm.red[0][1], Math.ceil((rpm + 500) / 1000) * 1000);
  return { rpm: { red: [[rpm, top]], shift: rpm - 800 } };
}

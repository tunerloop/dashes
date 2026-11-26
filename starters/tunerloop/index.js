// The TunerLoop dash: the Car tab's built-in dash (../../../../ecuai/docs/plan-dashes.md). Two panels
// of boxes and a full screen layer, each box a row of pages (panels.js), the automatic modes, the
// alarm banner, and the light in Vintage 3D following the phone's tilt. Fork it
// (scripts/fork_dash.mjs), give dash.json a new id, change what you like.
//
// Its limits (zones, valid ranges, the oil envelope, the warm-up point) are its own, in ranges.js; its
// alarm rules in alarms.js.
//
// Data comes from the app: each reading (base units, with the phone's speed, g and tilt and the 0-60
// timer), the live chart's rows and the 2-hour trend; the phone's recent history at start.
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

const KEEP_ROWS = 3000, CHART_EVERY_MS = 100;   // the live chart shows the last minute: keep what the app keeps

export default function mount(api) {
  const root = api.root, s = api.settings, start = startFrom(api.params);
  root.dataset.theme = start?.theme || s.style;
  root.insertAdjacentHTML('beforeend', D3_DEFS);
  // Before anything is drawn: this dash's ranges.
  useChannels(RANGES);
  useOil(OIL);
  useUnits(api.units);
  setTrendSource({ call: (name, body) => api.request('trend', { name, body }), bridge: () => api.bridge });
  if (api.history) hist.restore(api.history);
  const panels = createPanels(root, api, start);
  // Under a test address the automatic modes are off unless it asks for them (auto=1): the simulated
  // drive keeps setting them off.
  const autoOn = start && !start.auto ? {} : { pull: s.auto_pull, corner: s.auto_corner, stop: s.auto_stop, warm: s.auto_warm, warmBelow: WARM_BELOW_C };

  let value = null, smooth = 70, autoSt = {};
  const feed = { rows: [], tms: [], end: null, trend: [] };
  api.on('reading', (v, t, m) => {
    value = v;
    smooth = m.smoothMs ?? 70;
    setSteadyHz(m.digitsHz);
    root.dataset.mode = m.dim ? 'dim' : '';
    hist.tick(t);
    if (!m.dim) hist.push(v, t);   // late readings aren't charted: the charts stop until new ones come
  });
  api.on('rows', (m) => {
    if (m.reset) { feed.rows = []; feed.tms = []; }
    for (const r of m.rows) { feed.rows.push(r); feed.tms.push(new Date(r.t).getTime()); }
    if (feed.rows.length > KEEP_ROWS) { feed.rows.splice(0, feed.rows.length - KEEP_ROWS); feed.tms.splice(0, feed.tms.length - KEEP_ROWS); }
    feed.end = m.end;
  });
  api.on('trend', (rows) => { feed.trend = rows; });
  api.on('units', (u) => { useUnits(u); panels.rebuild(); });
  api.on('fonts', panels.rebuildViews);   // charts drew before the theme fonts arrived

  let last = 0, lastChart = 0;
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(250, now - last) : 16;
    last = now;
    if (root.dataset.theme === 'vintage3d') moveLight(root, value, now);
    const auto = autoStep(autoSt, value, Date.now(), autoOn);
    autoSt = auto.st;
    const chartDue = now - lastChart > CHART_EVERY_MS;
    panels.draw({ value, dt, smoothMs: smooth, now, chartDue, fast: feed.rows, fastTms: feed.tms, playhead: feed.end, trend: feed.trend }, [auto.left, auto.right]);
    if (chartDue) lastChart = now;
    showAlarms(root, value, now, ALARMS);
  });
}

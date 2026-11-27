// A box's pages: what a panel can show of one box, in order, a dot each, the panel pages first, then
// the full screen pages. A VDO dial box (oil temp, oil pressure, battery, head temp, the tach, speed,
// Lambda's dual dial): its dial, its graphs in the panel look (kit/gauge.js makeGlance; Lambda also the
// banks' compass), then its graphs full screen for the last 15 minutes, today, and the last 30 days.
// The G meter: the meter, then its compass. Any other box (All numbers): itself, then itself full
// screen. pageList() is pure; makePageView() builds one page's element, which the panels show, slide
// and feed readings (update) like any other.
import { CHANNELS } from './kit/channels.js';
import { makeGlance } from './kit/gauge.js';
import { WHOLE } from './box_list.js';
import { makeBox } from './boxes.js';

const GLANCES = [['recent', 'Last 15 min'], ['today', 'Today'], ['days', 'Last 30 days']];

// [{ where: 'panel'|'full', kind: 'box'|'graphs', level, view?, name }] for a box spec.
export function pageList(spec) {
  if (spec.kind === 'g') {   // the G meter, then its compass (kit/compass_views.js), in a panel and full screen
    return [
      { where: 'panel', kind: 'box', level: null, name: 'G meter' },
      { where: 'panel', kind: 'graphs', level: null, view: 'g', name: 'Compass' },
      { where: 'full', kind: 'graphs', level: 0, view: 'g', name: 'Compass' },
    ];
  }
  if (spec.kind === 'twindial' || ((spec.kind === 'big' || spec.kind === 'gauge') && CHANNELS[spec.key]?.vdo)) {   // a VDO dial: oil temp's row of pages
    const glances = CHANNELS[spec.key].phone ? GLANCES.slice(0, 1) : GLANCES;   // the hub keeps no history of the phone's own readings
    return [
      { where: 'panel', kind: 'box', level: null, name: 'Dial' },
      ...(spec.kind === 'twindial' ? [{ where: 'panel', kind: 'graphs', level: null, view: 'mix', name: 'Compass' }] : []),   // the banks' compass second
      { where: 'panel', kind: 'graphs', level: null, view: 'recent', name: 'Graphs' },
      ...glances.map(([view, name], level) => ({ where: 'full', kind: 'graphs', level, view, name })),
    ];
  }
  if (spec.kind === 'grid' && spec.keys?.length > GRID_PAGE) {   // All numbers: 3 by 3 a panel page, every one full screen
    const parts = [];
    for (let i = 0; i < spec.keys.length; i += GRID_PAGE) parts.push(spec.keys.slice(i, i + GRID_PAGE));
    return [
      ...parts.map((keys, i) => ({ where: 'panel', kind: 'box', level: null, name: `${spec.name} ${i + 1}`, keys })),
      { where: 'full', kind: 'box', level: 0, name: spec.name, keys: spec.keys },
    ];
  }
  return [
    { where: 'panel', kind: 'box', level: null, name: spec.name || '' },
    { where: 'full', kind: 'box', level: 0, name: spec.name || '' },
  ];
}
const GRID_PAGE = 9;

// Hand a box its share of this frame's readings. ctx: { value, dt, smoothMs }.
export function feed(box, spec, ctx) {
  box.set(WHOLE.has(spec.kind) ? ctx.value : ctx.value?.[spec.key]);
  box.frame(ctx.dt, ctx.smoothMs);
}

// One page as an element: { el, page, box, update(ctx), rebuild(), destroy() }. Each view has its own
// box (boxes.js), so views never share an element.
export function makePageView(spec, page) {
  const el = document.createElement('div');
  el.className = `page page-${page.kind}`;
  el.hidden = true;
  const box = page.kind === 'graphs' ? makeGlance(spec.key, page.view) : makeBox(page.keys ? { ...spec, keys: page.keys } : spec);
  box.el.hidden = false;
  el.append(box.el);
  return {
    el, page, box,
    update(ctx) { feed(box, spec, ctx); },
    rebuild() { box.rebuild?.(); },
    destroy() { box.destroy?.(); },
  };
}

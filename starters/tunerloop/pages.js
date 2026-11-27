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
const GRID_PAGE = 9;   // All numbers: 3 by 3 a panel page (Steve, 2026-11-27)
const panel = (kind, name, more = {}) => ({ where: 'panel', kind, level: null, name, ...more });
const full = (kind, name, level, more = {}) => ({ where: 'full', kind, level, name, ...more });

// Each kind of row (box_list.js row), from a box spec: [{ where, kind: 'box'|'graphs', level, view?, keys?, name }].
const ROWS = {
  dial: (spec) => [   // the hub keeps no history of the phone's own readings, so speed has only its 15 minutes
    panel('box', 'Dial'),
    ...(spec.compass ? [panel('graphs', 'Compass', { view: spec.compass })] : []),
    panel('graphs', 'Graphs', { view: 'recent' }),
    ...GLANCES.slice(0, CHANNELS[spec.key]?.phone ? 1 : GLANCES.length).map(([view, name], level) => full('graphs', name, level, { view })),
  ],
  g: () => [panel('box', 'G meter'), panel('graphs', 'Compass', { view: 'g' }), full('graphs', 'Compass', 0, { view: 'g' })],
  grid: (spec) => {
    const parts = [];
    for (let i = 0; i < spec.keys.length; i += GRID_PAGE) parts.push(spec.keys.slice(i, i + GRID_PAGE));
    return [...parts.map((keys, i) => panel('box', parts.length > 1 ? `${spec.name} ${i + 1}` : spec.name, { keys })), full('box', spec.name, 0, { keys: spec.keys })];
  },
  one: (spec) => [panel('box', spec.name || ''), full('box', spec.name || '', 0)],
};
export const pageList = (spec) => (ROWS[spec.row] || ROWS.one)(spec);

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

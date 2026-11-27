// A box's pages: what a panel can show of one box, in order, a dot each. First the panel pages (the
// glance; a VDO dial box also its graphs), then the full screen pages. A VDO dial box's are its graphs
// three ways, each the panel graphs' look full size (kit/gauge.js makeGlance): the last 15 minutes,
// today, and the last 30 days. Any other box's are one per detail level (details.js DETAILS): level 0
// the box itself, full size (held upright, with its chart under it where it has one); higher levels
// the detail canvases. pageList() is pure; makePageView() builds
// one page's element, which the panels show, slide and feed readings (update) like any other.
import { CHANNELS } from './kit/channels.js';
import { makeGlance } from './kit/gauge.js';
import { DETAILS, detailOf, drawDetail, drawUnder } from './kit/details.js';
import { WHOLE } from './box_list.js';
import { makeBox } from './boxes.js';
import { rowTimes } from './kit/time.js';

const GLANCES = [['recent', 'Last 15 min'], ['today', 'Today'], ['days', 'Last 30 days']];

// [{ where: 'panel'|'full', kind: 'box'|'graphs'|'detail', level, view?, name }] for a box spec.
export function pageList(spec) {
  if ((spec.kind === 'big' || spec.kind === 'gauge') && CHANNELS[spec.key]?.vdo) {   // a VDO dial: oil temp's row of pages
    const glances = CHANNELS[spec.key].phone ? GLANCES.slice(0, 1) : GLANCES;   // the hub keeps no history of the phone's own readings
    return [
      { where: 'panel', kind: 'box', level: null, name: 'Dial' },
      { where: 'panel', kind: 'graphs', level: null, view: 'recent', name: 'Graphs' },
      ...glances.map(([view, name], level) => ({ where: 'full', kind: 'graphs', level, view, name })),
    ];
  }
  const id = detailOf(spec), levels = id ? DETAILS[id].levels : [spec.name || ''];
  return [
    { where: 'panel', kind: 'box', level: null, name: levels[0] },
    ...levels.map((name, level) => ({ where: 'full', kind: level ? 'detail' : 'box', level, name })),
  ];
}

// Hand a box its share of this frame's readings. ctx: { value, dt, smoothMs, now, chartDue, fast,
// fastTms, playhead, trend }.
export function feed(box, spec, ctx) {
  if (spec.kind === 'chart') {
    if (spec.chart === 'live' && ctx.chartDue) {
      const tms = ctx.fastTms || rowTimes(ctx.fast);
      box.set(ctx.fast, tms, ctx.playhead ?? (tms.length ? tms[tms.length - 1] : Date.now()));
    } else if (spec.chart === 'trend' && (box.shownRows !== ctx.trend || ctx.now - (box.shownAt ?? 0) > 30_000)) {
      box.set(ctx.trend, rowTimes(ctx.trend)); box.shownRows = ctx.trend; box.shownAt = ctx.now;   // and now and then, for how long nothing has come in
    }
    return;
  }
  box.set(WHOLE.has(spec.kind) ? ctx.value : ctx.value?.[spec.key]);
  box.frame(ctx.dt, ctx.smoothMs);
}

function canvas(cls) { const c = document.createElement('canvas'); c.className = cls; return c; }

// One page as an element: { el, page, box?, update(ctx), rebuild(), destroy() }. Each view has its own
// box (boxes.js), so views never share an element.
export function makePageView(spec, page) {
  const el = document.createElement('div');
  el.className = `page page-${page.kind}`;
  el.hidden = true;
  const id = detailOf(spec);
  if (page.kind === 'detail') {
    const cv = canvas('detail');
    el.append(cv);
    return { el, page, update: (ctx) => drawDetail(cv, id, page.level, ctx.value), rebuild() {}, destroy() {} };
  }
  const box = page.kind === 'graphs' ? makeGlance(spec.key, page.view) : makeBox(spec);
  box.el.hidden = false;
  el.append(box.el);
  // Full screen held upright: the box takes the top half and its chart the bottom (DETAILS[id].under).
  const under = page.where === 'full' && page.kind === 'box' && DETAILS[id]?.under ? canvas('under') : null;   // not under a graphs page
  if (under) el.append(under);
  return {
    el, page, box,
    update(ctx) {
      feed(box, spec, ctx);
      if (!under) return;
      const upright = el.clientHeight > el.clientWidth * 1.2;
      under.hidden = !upright;
      box.el.classList.toggle('half', upright);
      if (upright) drawUnder(under, id);
    },
    rebuild() { box.rebuild?.(); },
    destroy() { box.destroy?.(); },
  };
}

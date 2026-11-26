// Making the TunerLoop dash's boxes (the list: box_list.js), each drawn by a kit module.
import { CHANNELS } from './kit/channels.js';
import { makeGauge, makeBig, makeGrid } from './kit/gauge.js';
import { makeTwin } from './kit/twin.js';
import { makeSpeed, makeG, makePull } from './kit/phone_boxes.js';
import { makeOil } from './kit/details.js';
import { makeChart } from './kit/charts.js';
import { LIVE_CHART_S } from './box_list.js';

export function makeBox(spec) {
  if (spec.kind === 'gauge') return makeGauge(spec.key);
  if (spec.kind === 'big') return makeBig(spec.key);
  if (spec.kind === 'twin') return makeTwin();
  if (spec.kind === 'speed') return makeSpeed();
  if (spec.kind === 'g') return makeG();
  if (spec.kind === 'oil') return makeOil();
  if (spec.kind === 'pull') return makePull();
  if (spec.kind === 'chart') return makeChart(spec.chart, LIVE_CHART_S);
  return makeGrid(spec.keys || Object.keys(CHANNELS));
}

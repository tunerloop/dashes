// Making the TunerLoop dash's boxes (the list: box_list.js), each drawn by a kit module.
import { CHANNELS } from './kit/channels.js';
import { makeGauge, makeBig, makeGrid } from './kit/gauge.js';
import { makeTwinDial } from './kit/twin_dial.js';
import { makeG, makePull } from './kit/phone_boxes.js';

export function makeBox(spec) {
  if (spec.kind === 'gauge') return makeGauge(spec.key);
  if (spec.kind === 'big') return makeBig(spec.key);
  if (spec.kind === 'twindial') return makeTwinDial();
  if (spec.kind === 'g') return makeG();
  if (spec.kind === 'pull') return makePull();
  return makeGrid(spec.keys || Object.keys(CHANNELS));
}

// The layout a test address asks for (api.params, from the app's test mode: index.html?test&...):
//   left=speed&right=oilt        the box each panel starts on (box_list.js BOXES ids); top and bottom too
//   right=oilt:2                 and on which page (its dots, from 1; past the panel's pages: full screen)
//   full=left|right&level=1      a panel full screen, at a detail level (0 the box itself)
//   theme=vintage3d              the gauge style (box_list.js THEMES)
//   auto=1                       let the automatic modes take over panels (off under a test address:
//                                the simulated drive keeps setting them off)
// null without parameters: the dash opens as the phone left it. Pure: also run by the unit tests.
import { BOXES, THEMES } from './box_list.js';

const PANEL = { left: 0, right: 1, top: 0, bottom: 1 };

export function startFrom(params) {
  if (!params || !Object.keys(params).length) return null;
  const pick = (k) => {                              // 'oilt' or 'oilt:2'
    const [id, n] = String(params[k] ?? '').split(':');
    return BOXES.some((b) => b.id === id) ? { id, page: Math.max(0, Math.floor(+n || 1) - 1) } : null;
  };
  const boxes = [pick('left') ?? pick('top'), pick('right') ?? pick('bottom')];
  return {
    boxes: boxes.map((b) => b?.id ?? null),
    pages: boxes.map((b) => b?.page ?? 0),
    full: Object.hasOwn(PANEL, params.full) ? PANEL[params.full] : null,
    level: Math.max(0, Math.floor(+params.level || 0)),
    theme: THEMES.some(([k]) => k === params.theme) ? params.theme : null,
    auto: params.auto === '1',
  };
}

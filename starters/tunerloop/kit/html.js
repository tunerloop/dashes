// kit/html.js: the app's kit/html.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Text put into HTML: the one escape every page and box uses for names, labels and messages.
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// A count with its noun: plural(1, 'cell', 'cells') -> '1 cell', plural(3, 'cell', 'cells') -> '3 cells'.
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

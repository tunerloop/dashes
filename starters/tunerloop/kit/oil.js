// kit/oil.js: the app's kit/oil.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The oil pressure envelope: the least oil pressure that's normal for the revs, in kPa. The default is
// a common rule of thumb, about 10 psi (69 kPa) per 1000 rpm, flat from 5000 rpm; a dash sets its own
// with useOil. The Oil Envelope (details.js) draws it and a dash's alarm may use it; the upper edge is
// twice that plus band, for the drawing only.
let env = { kpaPer1000: 69, flatFrom: 5000, band: 150 };
export function useOil(o) { env = { ...env, ...o }; }
export const oilMin = (rpm) => env.kpaPer1000 * Math.min(Math.max(rpm, 0), env.flatFrom) / 1000;
export const oilTop = (rpm) => oilMin(rpm) * 2 + env.band;

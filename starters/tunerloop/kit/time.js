// kit/time.js: the app's kit/time.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Each row's time (its t) in ms, worked out once per rows array.
const times = new WeakMap();
export function rowTimes(rows) {
  let t = times.get(rows);
  if (!t) { t = rows.map((r) => new Date(r.t).getTime()); times.set(rows, t); }
  return t;
}

// "9:41 pm": clock times in 12-hour form, local time.
export function clock12(d) {
  const t = new Date(d);
  const h = t.getHours() % 12 || 12;
  return `${h}:${String(t.getMinutes()).padStart(2, '0')} ${t.getHours() < 12 ? 'am' : 'pm'}`;
}

// A promise that gives up after ms: it rejects with "<what> took over N s" when the answer hasn't come
// by then (a request that never answers would otherwise wait for ever).
export function within(promise, ms, what = 'request') {
  let timer;
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} took over ${Math.round(ms / 1000)} s`)), ms); });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

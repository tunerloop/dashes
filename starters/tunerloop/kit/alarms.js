// kit/alarms.js: the app's kit/alarms.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// The alarm engine: a pure check of each live reading against a dash's rules, MoTeC/AiM style. A rule
// fires only when its condition holds for holdMs, and only under its qualifier (engine running, revs
// up, under load), so start-up and idle don't cry wolf. It clears at a separate, gentler level
// (hysteresis), so a reading sitting on the limit doesn't flicker the banner. Red alarms take the
// banner and are spoken; amber ones show in a strip (alarm_banner.js). Values are base units.
// The rules are a dash's own (the built-in dash's alarms.js): { id, sev: 'red'|'warn', key (the channel
// the banner quotes), text, holdMs, on(r), off(r) }.

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// The leaner bank's error against the target (0.05 = 5 % lean), or null without readings. max: a
// wideband reading at or past it is a parked controller, not a mixture.
export function leanest(r, max = Infinity) {
  const t = num(r?.lambda_target) ?? 1, ls = [num(r?.lambda1), num(r?.lambda2)].filter((x) => x !== null && x < max);
  return ls.length ? Math.max(...ls) / t - 1 : null;
}

// One step. state: { [id]: { since, active } } from the last call ({} to start); r: the reading
// (base units); now: ms. Returns { state, active } with active the firing alarms, red first, and
// within a channel only the most severe (a red head temp hides the amber one).
export function checkAlarms(state, r, now, rules) {
  const next = {}, active = [];
  for (const a of rules) {
    const was = state[a.id] || { since: null, active: false };
    let { since, active: on } = was;
    if (!r) { since = null; on = false; }
    else if (on) { if (a.off(r)) { on = false; since = null; } }
    else if (a.on(r)) { since = since ?? now; if (now - since >= a.holdMs) on = true; }
    else since = null;
    next[a.id] = { since, active: on };
    if (on) active.push(a);
  }
  const rank = (a) => (a.sev === 'red' ? 0 : 1);
  active.sort((x, y) => rank(x) - rank(y));
  const seen = new Set();
  return { state: next, active: active.filter((a) => (seen.has(a.key) ? false : seen.add(a.key))) };
}

// kit/automodes.js: the app's kit/automodes.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Automatic modes: for a while a Car tab panel shows what the moment needs, then hands back.
//   Hard acceleration: full throttle and pulling -> the Pull view (RPM, speed, 0-60 or 50-70 timer).
//   Cornering: past 0.5 g -> the G meter, held 6 s after the last big g.
//   Stoplight: stopped 3 s -> oil pressure, oil temp, head temp, battery; back above 8 km/h (5 mph).
//   Warm-up: oil under the dash's warm-up point (on.warmBelow, deg C) -> oil temp on the right panel.
// Hard acceleration beats Cornering beats Stoplight (all left panel); Warm-up is the right panel.
// Which are on, and the warm-up point, are the dash's (its settings and ranges). autoStep is pure,
// so it is tested without a page.

// st: last state ({} to start); r: the reading (speed_kmh, g_lat, g_long from the phone; tps_pct,
// oil_temp_c from the car); now: ms; on: { pull, corner, stop, warm } and warmBelow.
// Returns { st, left, right }: a mode key or null for each panel.
export function autoStep(st, r, now, on) {
  const s = { stillSince: null, stopped: false, cornerUntil: -1, pullOff: null, pulling: false, holdPull: -1, ...st };
  const v = r?.speed_kmh, gl = r?.g_lat, ga = r?.g_long;
  // stoplight: still for 3 s; clears above 8 km/h
  if (typeof v === 'number') {
    if (v < 1.6) { s.stillSince = s.stillSince ?? now; if (now - s.stillSince >= 3000) s.stopped = true; }
    else { s.stillSince = null; if (v > 8) s.stopped = false; }
  } else { s.stillSince = null; s.stopped = false; }
  // cornering: total g past 0.5
  if (typeof gl === 'number' && typeof ga === 'number' && Math.hypot(gl, ga) > 0.5) s.cornerUntil = now + 6000;
  // hard acceleration: throttle over 85 % and pulling (phone g when there is one); ends 1 s after lifting, result shown 5 s
  const pullingNow = (r?.tps_pct ?? 0) > 85 && (typeof ga === 'number' ? ga > 0.25 : (r?.rpm ?? 0) > 2500);
  if (pullingNow) { s.pulling = true; s.pullOff = null; }
  else if (s.pulling) { s.pullOff = s.pullOff ?? now; if (now - s.pullOff > 1000) { s.pulling = false; s.holdPull = now + 5000; } }
  let left = null;
  if (on.pull && (s.pulling || now < s.holdPull)) left = 'pull';
  else if (on.corner && now < s.cornerUntil) left = 'corner';
  else if (on.stop && s.stopped) left = 'stop';
  const right = on.warm && typeof r?.oil_temp_c === 'number' && r.oil_temp_c < on.warmBelow ? 'warm' : null;
  return { st: s, left, right };
}

// kit/alarm_banner.js: the app's kit/alarm_banner.js (web app 1.4.194) as forked with tunerloop-dash 1.0.0. Yours to change.
// The alarm banner: runs the alarm check (alarms.js) with a dash's rules on each frame and shows the
// worst firing alarm in words, with the reading, across the bottom of the dash. Red fills the
// banner and is spoken once; amber is a slimmer strip. A tap snoozes that alarm for a minute (it
// comes back if it is still true). Speech needs one tap first on iPhone, so the first touch on the
// dash unlocks it.
import { checkAlarms } from './alarms.js';
import { CHANNELS, shown } from './channels.js';

const SNOOZE_MS = 60000, CHECK_MS = 200;
let state = {}, lastCheck = 0, el = null, showing = null, spokeAt = {}, voiceOn = false;
const snoozed = {};

// The banner text: what, and the reading in the chosen unit.
function alarmText(a, r) {
  if (a.lean) { const e = a.lean(r); return e === null ? a.text : `${a.text} · +${(e * 100).toFixed(0)}%`; }
  const ch = shown(CHANNELS[a.key]), t = ch.text(r?.[a.key]);
  return t === '-' ? a.text : `${a.text} · ${t}${ch.unit ? ' ' + ch.unit : ''}`;
}

function speak(text) {
  if (!voiceOn || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/·.*/, '').toLowerCase())); } catch { /* no voice */ }
}

function ensure(root) {
  if (el) return el;
  el = document.createElement('button');
  el.type = 'button'; el.className = 'alarm'; el.hidden = true;
  el.addEventListener('click', () => { if (showing) snoozed[showing.id] = Date.now() + SNOOZE_MS; el.hidden = true; showing = null; });
  root.append(el);
  root.addEventListener('pointerdown', () => {   // unlock speech on the first touch (iPhone)
    if (voiceOn || !window.speechSynthesis) return;
    try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); voiceOn = true; } catch { /* no voice */ }
  }, { once: false });
  return el;
}

// r: the live reading (base units, or null); now: ms (performance.now or Date.now: only differences
// matter); rules: the dash's alarm rules (alarms.js).
export function showAlarms(root, r, now, rules) {
  const b = ensure(root);
  if (now - lastCheck < CHECK_MS) return;
  lastCheck = now;
  const out = checkAlarms(state, r, now, rules);
  state = out.state;
  const wall = Date.now();
  const top = out.active.find((a) => !(snoozed[a.id] > wall));
  if (!top) { if (!b.hidden) b.hidden = true; showing = null; return; }
  const text = alarmText(top, r);
  if (b.textContent !== text) b.textContent = text;
  b.dataset.sev = top.sev;
  b.hidden = false;
  if (top.sev === 'red' && !(spokeAt[top.id] > wall - SNOOZE_MS)) { spokeAt[top.id] = wall; speak(top.text); }
  showing = top;
}

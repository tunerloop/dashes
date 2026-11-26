// kit/store.js: the app's kit/store.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Per-device settings in localStorage. Reads and writes never throw: in private mode, with site
// data blocked, or outside a browser, a read gives null and a write is dropped.
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

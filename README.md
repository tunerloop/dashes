# TunerLoop dashes

Dashes for the [TunerLoop](https://app.tunerloop.com) app's Car tab, and everything you need to make your own.

A **dash** is a small web page that gets the whole Car tab: every touch and the car's live readings (RPM, pressures, temperatures, lambda, the phone's speed and G). It decides everything about the screen, alarms included. The app ships two built in (TunerLoop, and Shift light); the ones here are extras, and yours can be anything: one giant tach, a bar graph of both lambda banks, a game.

Every dash runs walled off in a sandbox: it can't reach the network, your account, or your ECU. The worst a broken one can do is fail to draw, and the app then goes back to its own.

## Use one

In the app: **Settings, Car tab dash, More dashes**, then **Add**. The Car tab runs it at once; pick TunerLoop again there any time. The dashes listed are the ones under [`dashes/`](dashes) on `main`, each reviewed before it was merged.

## Make one with Claude Code

1. **Fork this repo** on GitHub (it must stay public: the app reads it without signing in to GitHub), and clone your fork.
2. **Start from a starter.** Copy `starters/empty/` (two files, the smallest dash there is) or any dash under `dashes/` into `dashes/` under a new name.
3. **Give it its own `id` and `name`** in its `dash.json`.
4. **Open the repo in Claude Code** and say what you want. `CLAUDE.md` tells Claude the rules.
5. **Pack and push:** `node tools/pack.mjs` checks the dash the way the app will and writes its `dash.bundle.json`, the one file the app fetches. Commit both and push.
6. **Point your phone at it:** in the app, **Settings, Car tab dash, Building a dash**, paste your dash folder's GitHub address (like `https://github.com/you/dashes/tree/main/dashes/my-dash`), and tap **Use**.

Then keep going: ask Claude for a change, pack, push, and open the Car tab again (or reload the app). Each time the Car tab opens it checks for a newer commit and runs it, keeping the settings you chose. That's the whole loop.

To share it, open a pull request against this repo. Once it's merged it shows up in everyone's **More dashes**.

## The rules

- A dash is a folder: `dash.json`, an entry module (`index.js`), any other `.js` modules, and `.css` files. No images or fonts (the app gives every dash its fonts; see Imports).
- It imports only its own files, by relative path. No CDN scripts, no npm packages, nothing from the network.
- At most 64 files and 1.5 MB.
- `node tools/pack.mjs` must pass, and `dash.bundle.json` must be committed with the source it came from. The repo's check runs `node tools/pack.mjs --check` on every push and pull request.
- A branch name with a `/` in it can't be told apart from the folder in an address: use one without.

## Imports

Modules import each other by relative path only (`./panels.js`, `./kit/gauge.js`). There are no bare names and no import map. An import that leaves the dash's folder is refused, with the reason. The app's own modules change with every release; a dash that leaned on them would change or break with it, which is why a starter carries its own copy of everything it uses.

**Fonts** are the one thing the app gives every dash: `Oxanium` 600 and 700, `Saira` 600 and 700, `"Saira VF"` (variable weight and width), and `"Barlow Condensed"` 500 and 700, sent to the frame shortly after it starts. Use them by name in your CSS; text drawn on a canvas should be redrawn on `api.on('fonts', fn)`, which fires once they are in.

## A package

```
my-dash/
  dash.json     the manifest
  index.js      the entry module: export default function mount(api) { ... }
  *.js          any other modules, imported by relative path
  *.css         styles, listed in the manifest's "styles"
```

`dash.json`:

| field | |
|---|---|
| `id` | lowercase letters, digits, and dashes, 2 to 40; not a built-in dash's (`tunerloop-dash`, `shift-light`) |
| `name` | up to 40 characters; what Settings shows |
| `version` | `major.minor.build` |
| `api` | required: the dash API it was written for, a whole number; this app's is `1`. A dash asking for a newer one than the app has is refused ("needs a newer app") rather than started half-working |
| `author`, `license`, `description` | optional text |
| `entry` | default `index.js` |
| `styles` | up to 8 `.css` files in the package, in this order |
| `basedOn` | `{ "id", "version" }` of the dash you copied, or leave it out |
| `settings` | up to 12, shown in Settings under the dash: `{ "name": { "type": "channel" \| "channels" \| "number" \| "text" \| "boolean" \| "choice", "label", "default", "min", "max", "options", "labels" } }` |
| `feeds` | extra data: `history` (the phone's recent readings at start), `rows` (the live chart's readings), `trend` (the last 2 hours) |

`tools/manifest.js` (the app's own check, copied) is the exact check; `node tools/pack.mjs` runs it. The limits on a package: 64 files and 1.5 MB in all; only `dash.json`, `.js`, and `.css` files are read.

## The API

`mount(api)` is called once. Draw into `api.root`, a `<div class="dash">` filling the frame. Nothing is sent to your dash until `mount` has returned (or its promise has resolved), so handlers you register there miss nothing: the newest reading, the units, and the tab bar's state come then, and with the feeds the whole live chart (`reset: true`) and the trend. Until your dash has had its first reading and a frame to paint it in, the app keeps its checklist over your frame ("Gauges", turning), so you need no loading screen of your own.

| | |
|---|---|
| `api.root` | The element to draw in. It gets every touch. |
| `api.settings` | The person's settings for this dash, defaults filled in. Changing one in Settings starts the dash again. |
| `api.units`, `api.on('units', (units) => ...)` | The person's display units (`{ pressure: 'psi', temperature: 'f', speed: 'mph', mixture: 'lambda' }`), and when they change. |
| `api.setUnit(kind, key)` | Ask the app to change a display unit (ours: a two-finger tap on a box). Kinds and keys: `pressure` (`kpa`, `bar`, `psi`), `temperature` (`c`, `f`), `speed` (`kmh`, `mph`), `mixture` (`lambda`, `afr`). The app checks it against its own table and answers with a `units` event. |
| `api.bridge` | The chosen Bridge's name. |
| `api.params` | Launch parameters from a test address (see Try it), `{ name: text }`, or `null`. A dash reads its own; ours reads `left`, `right`, `full`, `level`, `theme`, and `auto` (`start.js`). |
| `api.history` | With feed `history`: the phone's recent readings, for the kit's `hist.restore`. `null` without the feed. |
| `api.on('reading', (v, t, m) => ...)` | Every reading: `v` in base units (kPa, °C, km/h, lambda), `t` its time in ms. `m.dim` is true while readings are late; `m.smoothMs`, how long a needle should take to ease to a new value; `m.digitsHz`, how often a number may change, or `null` for the kit's default. |
| `api.on('rows', (m) => ...)` | With feed `rows`: `{ rows, reset, end }`, the live chart's new rows since the last, oldest first, at most every 100 ms. `reset: true` means drop what you have and start from these. `end` is the app's playback clock (ms): the chart's right edge. A row: `{ t, rpm, map_kpa, ... }`, `t` an ISO time. |
| `api.on('trend', (rows) => ...)` | With feed `trend`: the 2-hour trend, the whole list each time (when it changes, and every 30 s), oldest first. A row: `{ t, ect_c, iat_c, oil_temp_c, ... }`, `t` an ISO time. |
| `api.on('fonts', fn)` | The app's fonts have arrived: redraw anything drawn on a canvas. |
| `api.nav.shown`, `api.on('nav', (shown) => ...)` | Whether the app's tab bar is up, and when that changes. |
| `api.nav.show()`, `api.nav.hide()` | Bring the app's tab bar up, or put it away. You pick the gestures (ours: the first tap hides it). While it is hidden the app draws a small handle over your dash, on the edge the bar hid behind (bottom centre upright, right centre sideways, about 96 by 28 px), that brings it back; keep that spot clear. After `show()` the app hides it again after a few seconds. |
| `api.on('outside', fn)` | A press in the app outside your frame (the tab bar), or the Car tab left: close a menu you opened. |
| `api.request('trend', { name: 'trends', body: { minutes, fields } })` | Stored history, a promise: `{ rows }` for the last `minutes` (1 to 1440) of up to 13 channels, or with `{ name: 'trend_days', body: { key, lo, hi } }` 30 days of one channel by day, `{ today, days }`. Read-only. The kit's `trend_data.js` does this for you (`setTrendSource`, as ours does in `index.js`). |
| `api.store.get(k)`, `api.store.set(k, v)` | A small store kept on the phone for this dash: plain JSON values, up to 64 keys (names up to 40 characters) and 16 KB in all; `set(k, undefined)` removes a key. Treat what you read back as untrusted (check its type) so your dash always starts. It belongs to this exact set of files: a new version of an installed dash starts with a fresh store and settings. |

Reading keys: `rpm`, `map_kpa`, `tps_pct`, `ect_c`, `iat_c`, `lambda1`, `lambda2`, `lambda_target`, `battery_v`, `oil_kpa`, `fuel_kpa`, `ign_deg`, `oil_temp_c`, and from the phone `speed_kmh`, `g_lat`, `g_long`, `tilt_x`, `tilt_y`, and `run` (the acceleration timers). A value the car doesn't have is `null` or missing.

Draw on your own `requestAnimationFrame`, not on each reading. Everything else is your call: alarms (ours has a banner), when the tab bar hides, whether a game runs while the car moves (read `speed_kmh`).

## What a dash can't do

- It runs in a sandboxed frame with no network: no `fetch`, sockets, images, or fonts from the internet, no `localStorage` (use `api.store`), no access to the app, its account, or the ECU. Nothing a dash can send leads to a plan, an approval, a command, or a write.
- No WebRTC (`RTCPeerConnection` and `navigator.mediaDevices` are `undefined`).
- It may not navigate its page: the app blocks it and stops the dash.
- Keep the bridge quiet. More than 50 messages a second (after a burst of 300) stops the dash. History requests run one at a time, at most 20 a minute, a repeat within 30 s answered from a cache. Unit changes: 2 a second.
- A dash whose `mount` throws is stopped, with the error shown in its place and a way back to ours. So is a dash that stops answering for 5 seconds while it is on screen (time the app itself was stalled doesn't count).
- If the app freezes or dies while an installed dash runs, the next start runs ours and asks whether to try that dash again; the second time, it stays off until it is picked again in Settings.

The frame sits inside the phone's safe area: the app keeps it clear of the notch and the home bar, so a dash needs no insets of its own.

For developers: opening the app with `?safe` runs ours whatever was picked, with an empty store of its own.

## License

MIT, unless a dash's own `dash.json` says otherwise.

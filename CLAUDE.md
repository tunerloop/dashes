# TunerLoop dashes

This repo holds dashes for the TunerLoop app's Car tab: each folder under `dashes/` is one (a starter to copy is in `starters/`). README.md is the full guide, the dash API included; read it before changing a dash. The rules that matter most:

- `dash.json` is the manifest; the entry module (`index.js`) exports `default function mount(api)`. Keep `dash.json` valid: `id` lowercase with dashes, its own (never `tunerloop-dash` or `shift-light`, and not another dash's here), `version` `major.minor.build` (raise it when you change the dash), `api: 1`, and the feeds it uses (`tune` for values from the car's tune). CSS files go in `styles`.
- **Settings are the dash's own.** For anything the person might want to change (a shift point, a style, which readings to show): `api.on('settings', fn)` puts the app's gear over the dash; on a tap, draw your own panel (no `<form>`: the sandbox blocks submitting one) and keep the values in `api.store`. Prefer a default from the tune where there is one (`api.tune.rev_limit`, feed `tune`), with the driver's number overriding it.
- **Everything is in the dash's folder.** Import only by relative path (`./gauge.js`). No npm packages, no CDN, no network, no images or fonts in the package: the app gives every dash its fonts (`Oxanium`, `Saira`, `"Saira VF"`, `"Barlow Condensed"`).
- Draw into `api.root` (it fills the screen) with plain DOM, SVG, or canvas, and paint your own background. Animate on `requestAnimationFrame`, not on each reading.
- Readings come in base units (kPa, °C, km/h, lambda) through `api.on('reading', (v, t, m) => ...)`; a missing value is `null`: show `-`. Convert to the person's units (`api.units`, `api.on('units')`) for display.
- Register handlers in `mount`: nothing is sent until it returns.
- Always give the person a gesture that brings the app's tab bar back (`api.nav.show()`), or they can't leave the Car tab.
- No `localStorage` (use `api.store`: plain JSON, 64 keys, 16 KB; check what you read back). Never navigate the page. Keep messages to the app few.

## The loop

After every change:

1. `node tools/pack.mjs`: it checks every dash the way the app will and writes each `dash.bundle.json` and `index.json`. Fix anything it reports.
2. Commit the source and the bundles together, and push.
3. Tell the person to open the Car tab again (or reload the app): with this folder set as the dev source in Settings, it runs the new commit.

If you change `tools/pack.mjs`, run its tests: `node --test tools/pack.test.mjs`.

Never edit `dash.bundle.json`, `index.json`, `tools/manifest.js`, or `tools/imports.js` by hand.

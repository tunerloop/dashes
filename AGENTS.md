# Building a TunerLoop dash

You are building a **dash** for the TunerLoop app: a small web page that gets the whole Live tab of the app on someone's phone, in their car. It gets every touch and the car's live readings (RPM, pressures, temperatures, lambda, the phone's speed and G) and decides everything about the screen.

Each dash is a folder under `dashes/` (a starter to copy is under `starters/`). `API.md` is the full reference: read it before you change a dash.

## The loop

The person tells you what they want and looks at their phone. You do everything else. After every change:

1. **Change the dash's files.** Make the smallest change that does what was asked.
2. **Check it:** `node tools/pack.mjs`. It checks every dash the way the app will and writes each `dash.bundle.json` (the one file the app fetches) and `index.json`. Fix anything it reports.
3. **Look at it:** `node tools/preview.mjs dashes/<id>` writes `preview.html`, one file that runs the dash exactly as the app does (the same sandbox, at phone size, on a simulated drive). Open it in a browser, wait three seconds, and take a picture. With Playwright: `npx playwright screenshot --viewport-size=760,880 --wait-for-timeout=3000 "file://$PWD/preview.html" shot.png`. The panel beside the dash must say **Running** with no errors; the page's title says the same (`Dash preview: running`), and `tlPreview` in the page has it as data. Look at the picture: is it what was asked for, readable at a glance, nothing cut off? Fix and repeat until it is. Add `?sideways` to the address for a phone on its side (`--viewport-size=1200,440`), and check both if the dash should work both ways. Add `?settings` to see the dash's own settings panel open.
4. **Push it:** raise `version` in `dash.json`, commit the source with `dash.bundle.json` and `index.json`, and push to the branch the phone follows (`main` unless told otherwise).
5. **Tell the person** what changed, in a sentence. Their phone shows the new commit by itself within about 15 seconds while the app is open on Live.

If you have no browser, skip step 3 and say so: the person's phone is then the only look anyone gets.

**Never ask the person to edit a file, run a command, or copy a file.** The one thing to ask for is what their phone says when something is wrong: the app shows a note with a **Copy** button when a commit couldn't be loaded, when the dash stopped, or when its code threw an error. Ask them to tap Copy and paste it to you.

**The first time,** tell the person the one thing they do themselves: in the app, **Settings, Dash, Build your own**, paste this repo's GitHub address, and tap **Add**. The repo must be public. From then on the app follows it.

## The rules

- `dash.json` is the manifest; the entry module (`index.js`) exports `default function mount(api)`. Keep `dash.json` valid: `id` lowercase with dashes and the dash's own (never `tunerloop-dash`), `version` `major.minor.build`, `api: 1`. CSS files go in `styles`.
- **Everything is in the dash's folder.** Import only by relative path (`./gauge.js`). No npm packages, no CDN, no network, no images or fonts in the package: the app gives every dash its fonts (`Oxanium`, `Saira`, `"Saira VF"`, `"Barlow Condensed"`).
- Draw into `api.root` (it fills the screen) with plain DOM, SVG, or canvas, and paint your own background. Animate on `requestAnimationFrame`, not on each reading.
- Readings come in base units (kPa, °C, km/h, lambda) through `api.on('reading', (v, t, m) => ...)`; a missing value is `null`: show `-`. Convert to the person's units (`api.units`, `api.on('units')`) for display.
- Register handlers in `mount`: nothing is sent until it returns.
- Always give the person a gesture that brings the app's tab bar back (`api.nav.show()`), or they can't leave the Live tab.
- **A dash owns its settings.** Anything the person might want to change (a shift point, a style, which readings to show) is kept in `api.store` and set in a panel the dash draws itself, opened on `api.on('settings', fn)` (the app's gear). The app has no settings for a dash.
- No `localStorage` (use `api.store`: plain JSON, 64 keys, 16 KB; check what you read back). Never navigate the page. Keep messages to the app few.
- It is read in a moving car: big type, high contrast, nothing that needs a careful look. Red means stop now.

Never edit `dash.bundle.json`, `index.json`, `tools/manifest.js`, `tools/imports.js`, or `tools/preview-host.json` by hand. If you change `tools/pack.mjs` or `tools/preview.mjs`, run their tests: `node --test tools/*.test.mjs`.

## Where to start

- "Like the TunerLoop dash, but ...": start from the copy of it (`starters/tunerloop/` in tunerloop/dashes; in a repo made from the template it is already `dashes/my-dash/`). It is about 44 files, the kit included; `API.md` says what each part does. Limits and redline are in `ranges.js`, labels in `kit/channels.js`, alarms in `alarms.js`.
- Something new: start from `starters/empty/` (two files), and look at `dashes/shift-light/` and `dashes/big-numbers/` in [tunerloop/dashes](https://github.com/tunerloop/dashes) for small whole dashes, each with its own settings panel.
- A new dash gets its own folder under `dashes/` and its own `id` and `name`.

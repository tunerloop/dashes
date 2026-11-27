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

**The first time,** tell the person the one thing they do themselves: in the app, **Settings, ECU, Advanced, Build your own**, paste this repo's GitHub address, and tap **Add**. The repo must be public. From then on the app follows it.

## Every dash is someone's

Most people start from a dash that exists (the TunerLoop dash, or one in the gallery) and want it changed: "the TunerLoop dash, but no lambda and a boost gauge". Their dash is then a copy in their own repo, and you change its **code**: there is no settings layer to configure, so edit the files.

- **Making the copy:** a repo made from [tunerloop/dash-template](https://github.com/tunerloop/dash-template) already holds a copy of the TunerLoop dash as `dashes/my-dash`. For a gallery dash, copy its folder from `dashes/` in tunerloop/dashes into the repo instead, give it its own `id` and `name`, and set `"basedOn": {"id": "<its id>", "version": "<its version>"}` in `dash.json`. Keep `basedOn` in every copy: it is how a later version of the original gets merged in. The app's **Make it yours** (on a dash's row in Settings) gives the person a text to paste to you that says the same.
- **Where the changes go:** make each change where the dash already keeps that kind of thing (in the TunerLoop dash: which boxes in `box_list.js`, limits and zones in `ranges.js`, labels in `kit/channels.js`), and change no more lines than you need. Small, local changes merge cleanly when the original moves on.

## Taking a newer version of the original

When the original a copy was made from has a newer version, the app says so on the dash's row in Settings ("TunerLoop 1.0.9 is out") and gives the person a text to paste to you. Then:

1. `node tools/update-base.mjs dashes/<id>` (if `tools/update-base.mjs` isn't in the repo, copy it from tunerloop/dashes first). It reads tunerloop/dashes, finds the original at the copy's `basedOn` version and at the newest, and merges the difference into the copy file by file, the way git merges: the person's changes and the original's both stay, and `basedOn` moves to the new version.
2. **Resolve every conflict it lists** (`<<<<<<< yours`, `=======`, `>>>>>>> new base`): keep what the person changed, unless the new version needs it otherwise. Remove the markers. Look at each `decide:` line too (a file one side deleted that the other changed).
3. Then the loop as usual: `node tools/pack.mjs`, look at the preview, raise the version, push, and tell the person in a sentence what came in.

Never copy the new original over the person's files: that throws their changes away.

## The rules

- `dash.json` is the manifest; the entry module (`index.js`) exports `default function mount(api)`. Keep `dash.json` valid: `id` lowercase with dashes and the dash's own (never `tunerloop-dash`), `version` `major.minor.build`, `api: 1`. CSS files go in `styles`.
- **Everything is in the dash's folder.** Import only by relative path (`./gauge.js`). No npm packages, no CDN, no network, no images or fonts in the package: the app gives every dash its fonts (`Oxanium`, `Saira`, `"Saira VF"`, `"Barlow Condensed"`).
- Draw into `api.root` (it fills the screen) with plain DOM, SVG, or canvas, and paint your own background. Animate on `requestAnimationFrame`, not on each reading.
- Readings come in base units (kPa, °C, km/h, lambda) through `api.on('reading', (v, t, m) => ...)`; a missing value is `null`: show `-`. Convert to the person's units (`api.units`, `api.on('units')`) for display.
- Register handlers in `mount`: nothing is sent until it returns.
- Always give the person a gesture that brings the app's tab bar back (`api.nav.show()`), or they can't leave the Live tab.
- While the tab bar is hidden, the app's handle takes every touch in the bottom 60 px (the right 60 px with the phone sideways): keep buttons, a settings panel's included, out of that strip.
- **A dash owns its settings.** Anything the person might want to change (a shift point, a style, which readings to show) is kept in `api.store` and set in a panel the dash draws itself, opened on `api.on('settings', fn)` (the app's gear). The app has no settings for a dash.
- No `localStorage` (use `api.store`: plain JSON, 64 keys, 16 KB; check what you read back). Never navigate the page. Keep messages to the app few.
- It is read in a moving car: big type, high contrast, nothing that needs a careful look. Red means stop now.

Never edit `dash.bundle.json`, `index.json`, `tools/manifest.js`, `tools/imports.js`, or `tools/preview-host.json` by hand. If you change `tools/pack.mjs` or `tools/preview.mjs`, run their tests: `node --test tools/*.test.mjs`.

## Where to start

- "Like the TunerLoop dash, but ...": start from the copy of it (`starters/tunerloop/` in tunerloop/dashes; in a repo made from the template it is already `dashes/my-dash/`). It is about 44 files, the kit included; `API.md` says what each part does. Limits and redline are in `ranges.js`, labels in `kit/channels.js`, alarms in `alarms.js`.
- Something new: start from `starters/empty/` (two files), and look at `dashes/shift-light/` and `dashes/big-numbers/` in [tunerloop/dashes](https://github.com/tunerloop/dashes) for small whole dashes, each with its own settings panel.
- A new dash gets its own folder under `dashes/` and its own `id` and `name`.

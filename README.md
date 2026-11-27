# TunerLoop dashes

Dashes for the [TunerLoop](https://app.tunerloop.com) app's Live tab, and everything you need to make your own.

A **dash** is a small web page that gets the whole Live tab: every touch and the car's live readings (RPM, pressures, temperatures, lambda, the phone's speed and G). It decides everything about the screen, alarms included. The app comes with one, the TunerLoop dash. The ones here are extras, and yours can be anything: one giant tach, a bar graph of both lambda banks, a game.

Every dash runs walled off in a sandbox: it can't reach the network, your account, or your ECU. The worst a broken one can do is fail to draw, and the app then goes back to its own.

Every dash comes from a GitHub repo, and the app treats them all the same. The ones under [`dashes/`](dashes) here are simply the ones listed in the app's gallery, each reviewed before it was merged.

## Use one

In the app: **Settings, Dash, More dashes**, then **Add**. Live runs it at once; pick TunerLoop again there any time. A dash from the gallery stays at the commit you added until you tap **Update**.

## Make your own, with an AI

You need a GitHub account and an AI that can work in a repo and push to it: Claude Code, Codex, or ChatGPT's agent.

1. **Make your repo:** open [tunerloop/dash-template](https://github.com/tunerloop/dash-template) and choose **Use this template**. Keep it public: the app reads it without signing in to GitHub.
2. **Point your phone at it:** in the app, **Settings, Dash, Build your own**, paste your repo's address (like `https://github.com/you/my-dash`), and tap **Add**. It starts as a copy of the TunerLoop dash.
3. **Tell your AI what you want,** in your repo: "make the tach bigger", "call oil temp OEL", "a bar graph of both lambda banks that turns red past 1.1".
4. **Watch your phone.** Each push shows on Live by itself, within about 15 seconds, keeping the settings you chose. Say what to change next.

Your AI reads `AGENTS.md` (the rules and the loop) and `API.md` (the dash API) in your repo. Before each push it checks the dash and looks at it in its own browser, in a preview that runs the dash exactly as the app does. If your phone ever shows a note that the dash stopped or wasn't loaded, tap **Copy** and paste it to your AI.

To share your dash, open a pull request that adds its folder under `dashes/` here. Once it's merged it shows in everyone's **More dashes**.

## This repo

- [`dashes/`](dashes): the gallery. Big numbers and Shift light are small whole dashes to learn from.
- [`starters/`](starters): `tunerloop/`, a complete copy of the app's own dash, kit included, and `empty/`, the smallest dash there is.
- [`tools/`](tools): `pack.mjs` (the app's checks, and the files the app reads), `preview.mjs` (the preview), and `template.mjs` (writes the template repo from this one). `manifest.js`, `imports.js`, and `preview-host.json` are the app's own code, copied here by the app's `scripts/dash_tools.mjs`.
- `node tools/pack.mjs` must pass, and each `dash.bundle.json` and `index.json` must be committed with the source they came from. The repo's check runs `node tools/pack.mjs --check` on every push and pull request.

## License

MIT, unless a dash's own `dash.json` says otherwise.

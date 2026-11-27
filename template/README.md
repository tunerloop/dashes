# My TunerLoop dash

A dash for the [TunerLoop](https://app.tunerloop.com) app's Live tab, built with an AI. It starts as a copy of the TunerLoop dash.

## How to use this

1. **Make your repo:** choose **Use this template** on GitHub. Keep the repo public: the app reads it without signing in to GitHub.
2. **Point your phone at it:** in the app, **Settings, Dash, Build your own**, paste your repo's address (like `https://github.com/you/my-dash`), and tap **Add**.
3. **Tell your AI what you want,** in this repo (Claude Code, Codex, or ChatGPT's agent): "make the tach bigger", "call oil temp OEL", "a bar graph of both lambda banks that turns red past 1.1", or "start over from the empty starter and make a shift light".
4. **Watch your phone.** Each push shows on Live by itself, within about 15 seconds, keeping the settings you chose. Say what to change next.

If your phone shows a note that the dash stopped or wasn't loaded, tap **Copy** and paste it to your AI.

## What's here

- `dashes/my-dash/`: your dash. It runs walled off in a sandbox on the phone: it can't reach the network, your account, or your ECU.
- `starters/empty/`: the smallest dash there is, for starting something new.
- `AGENTS.md`: the rules and the loop your AI follows. `API.md`: everything a dash can use.
- `tools/`: the checks the app makes (`pack.mjs`) and a preview that runs the dash exactly as the app does (`preview.mjs`), so your AI can look at it before it pushes.

More dashes to learn from, and the place to share yours: [tunerloop/dashes](https://github.com/tunerloop/dashes).

## License

MIT.

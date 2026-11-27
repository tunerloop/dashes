// See a dash before you push it: writes preview.html, one file that runs the dash the way the
// TunerLoop app does (the same sandboxed frame, at phone size, on a simulated drive) with whether it
// started, the errors it threw, its paint lag and its frame rate beside it. No server and no
// network: open the file in a browser, or take a picture of it with a headless one.
//   node tools/preview.mjs [dash folder]     default: the one dash under dashes/
//   then open preview.html                   add ?sideways for a phone on its side; ?cold, ?cooling or
//                                            ?fresh for another drive; any other parameter goes to
//                                            the dash as api.params
// The page's title says how it went ("Dash preview: running", or "stopped: <why>"), and
// `tlPreview` in the page holds the same with the errors, for a script.
// tools/preview-host.json is the app's own code for running a dash (written by the app's
// scripts/dash_tools.mjs): never edit it.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFolder, problems } from './pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// JSON for an inline script: no "<" in it, so nothing in a dash's text can end the script.
const inline = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// The preview page for a dash's files ({path: text}) and the host (tools/preview-host.json). Pure.
export function previewHtml(files, host) {
  // The host's modules as blob: URLs, each import token swapped for the URL of the module it names
  // (they come dependencies first), then the last one, the preview itself, is run.
  const boot = `const H = ${inline({ modules: host.modules })}, urls = [];
for (const m of H.modules) {
  let code = m.code;
  for (const [at, n] of [...m.imports].reverse()) code = code.slice(0, at) + urls[n] + code.slice(at + ('tl-mod:' + n).length);
  urls.push(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
}
import(urls[urls.length - 1]).catch((e) => { document.title = 'Dash preview: stopped: ' + e.message; document.getElementById('status').textContent = 'Stopped: ' + e.message; });`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dash preview: loading</title>
</head>
<body>
${host.page}
<script>globalThis.TL_PREVIEW = ${inline({ files, app: host.app })};</script>
<script type="module">
${boot}
</script>
</body>
</html>
`;
}

// The dash folder to show: the one named, or the only one under dashes/.
function dashDir(arg) {
  if (arg) return arg;
  const top = join(ROOT, 'dashes');
  const all = existsSync(top) ? readdirSync(top).filter((n) => existsSync(join(top, n, 'dash.json'))) : [];
  if (all.length !== 1) throw new Error(`name the dash's folder: node tools/preview.mjs dashes/<id>${all.length ? ` (here: ${all.join(', ')})` : ''}`);
  return join(top, all[0]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const dir = dashDir(process.argv[2]);
    if (!existsSync(join(dir, 'dash.json'))) throw new Error(`${dir}: no dash.json there`);
    const files = readFolder(dir);
    const wrong = problems(files);
    if (wrong.length) console.log(`the app would refuse this dash (the preview shows why too):\n${wrong.map((x) => `    ${x}`).join('\n')}`);
    const out = join(ROOT, 'preview.html');
    writeFileSync(out, previewHtml(files, JSON.parse(readFileSync(join(ROOT, 'tools/preview-host.json'), 'utf8'))));
    console.log(`${relative(process.cwd(), out) || out}: ${relative(process.cwd(), dir)} as the app runs it. Open it in a browser.`);
    process.exit(wrong.length ? 1 : 0);
  } catch (e) {
    console.error(`preview: ${e.message}`);
    process.exit(2);
  }
}

// Write the template repo (github.com/tunerloop/dash-template, the one people start their own dash
// from) out of this one, so its tools, rules and starters are always this repo's:
//   node tools/template.mjs <an empty folder>
// It gets the tools, AGENTS.md, CLAUDE.md, API.md, the license and the check, the template's own
// README (template/README.md), starters/empty, and starters/tunerloop as dashes/my-dash (id
// my-dash), packed.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AS_IS = ['AGENTS.md', 'CLAUDE.md', 'API.md', 'LICENSE', '.gitignore', '.github/workflows/check.yml',
  'tools/pack.mjs', 'tools/pack.test.mjs', 'tools/preview.mjs', 'tools/preview.test.mjs', 'tools/manifest.js', 'tools/imports.js', 'tools/preview-host.json'];
const NOT_COPIED = (src) => !src.endsWith('dash.bundle.json');

export function writeTemplate(out) {
  if (existsSync(out) && readdirSync(out).some((n) => n !== '.git')) throw new Error(`${out} is not empty`);
  for (const path of AS_IS) {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), readFileSync(join(ROOT, path)));
  }
  writeFileSync(join(out, 'README.md'), readFileSync(join(ROOT, 'template/README.md')));
  cpSync(join(ROOT, 'starters/empty'), join(out, 'starters/empty'), { recursive: true, filter: NOT_COPIED });
  cpSync(join(ROOT, 'starters/tunerloop'), join(out, 'dashes/my-dash'), { recursive: true, filter: NOT_COPIED });
  // The starter under its new name; the empty starter must not share its id.
  const rename = (path, id, name) => {
    const m = JSON.parse(readFileSync(join(out, path), 'utf8'));
    writeFileSync(join(out, path), `${JSON.stringify({ ...m, id, name }, null, 2)}\n`);
  };
  rename('dashes/my-dash/dash.json', 'my-dash', 'My dash');
  rename('starters/empty/dash.json', 'my-empty-dash', 'My dash');
  execFileSync('node', [join(out, 'tools/pack.mjs')], { stdio: 'inherit' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  if (!out) { console.log('usage: node tools/template.mjs <an empty folder>'); process.exit(2); }
  try { writeTemplate(out); console.log(`the template is in ${out}`); } catch (e) { console.error(`template: ${e.message}`); process.exit(1); }
}

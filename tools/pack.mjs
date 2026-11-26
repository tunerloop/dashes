// Check every dash in this repo the way the TunerLoop app will, and write what the app reads:
// each dash's dash.bundle.json (all its files as one, so a phone fetches it in one request) and
// index.json (the gallery's list: the dashes under dashes/). Run it before every commit; the
// repo's check (.github/workflows/check.yml) runs it with --check on every push and pull request.
//   node tools/pack.mjs           check, and write the bundles and index.json
//   node tools/pack.mjs --check   check, and fail if a bundle or index.json is out of date
// A dash is a folder holding dash.json, under dashes/ (listed in the gallery) or starters/ (copy
// one to begin; not listed).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest } from './manifest.js';
import { scanImports } from './imports.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIMITS = { files: 64, bytes: 1_500_000 };   // the app's (src/js/dash/loader.js LIMITS)
const BUILTIN = ['tunerloop-dash', 'shift-light'];  // ids the app's own dashes have: a package can't
const CHECK = process.argv.includes('--check');

// A dash folder's files as the app takes them: dash.json, .js and .css, by path in the folder.
function readFolder(dir, prefix = '', out = {}) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'dash.bundle.json') continue;
    const path = prefix + name, full = join(dir, name);
    if (statSync(full).isDirectory()) readFolder(full, `${path}/`, out);
    else if (path === 'dash.json' || /\.(js|css)$/.test(name)) out[path] = readFileSync(full, 'utf8');
  }
  return out;
}

// What is wrong with a dash's files, as a list (empty: the app will take it).
function problems(files) {
  const out = [];
  const paths = Object.keys(files);
  if (paths.length > LIMITS.files) out.push(`${paths.length} files: a dash has at most ${LIMITS.files}`);
  const bytes = paths.reduce((t, p) => t + files[p].length, 0);
  if (bytes > LIMITS.bytes) out.push(`${bytes} bytes: a dash has at most ${LIMITS.bytes}`);
  let json;
  try { json = JSON.parse(files['dash.json']); } catch (e) { return [...out, `dash.json is not JSON: ${e.message}`]; }
  const { ok, errors, manifest } = checkManifest(json);
  if (!ok) return [...out, ...errors.map((e) => `dash.json: ${e}`)];
  if (BUILTIN.includes(manifest.id)) out.push(`dash.json: id '${manifest.id}' is one of the app's own dashes: give yours its own id`);
  for (const p of [manifest.entry, ...manifest.styles]) if (!(p in files)) out.push(`no ${p} in the folder`);
  // Every import, from the entry on, is a relative path to a file in the folder.
  const seen = new Set(), todo = [manifest.entry];
  while (todo.length) {
    const path = todo.pop();
    if (seen.has(path) || !(path in files)) continue;
    seen.add(path);
    for (const { spec } of scanImports(files[path])) {
      if (!/^\.\.?\//.test(spec)) { out.push(`${path}: can't import '${spec}': a dash imports only its own files, by relative path`); continue; }
      const to = posix.normalize(posix.join(posix.dirname(path), spec));
      if (to.startsWith('../')) out.push(`${path}: can't import '${spec}': it is outside the dash's folder`);
      else if (!(to in files)) out.push(`${path}: imports '${spec}', which isn't in the folder`);
      else todo.push(to);
    }
  }
  return out;
}

const dashDirs = (top) => (existsSync(join(ROOT, top)) ? readdirSync(join(ROOT, top)).sort().map((n) => `${top}/${n}`)
  .filter((d) => existsSync(join(ROOT, d, 'dash.json'))) : []);
const write = (path, text, stale) => {
  const full = join(ROOT, path);
  const now = existsSync(full) ? readFileSync(full, 'utf8') : null;
  if (now === text) return;
  if (CHECK) stale.push(path); else writeFileSync(full, text);
};

let bad = 0;
const stale = [], listed = [], ids = new Map();
for (const dir of [...dashDirs('dashes'), ...dashDirs('starters')]) {
  const files = readFolder(join(ROOT, dir));
  const p = problems(files);
  const m = p.length ? null : checkManifest(JSON.parse(files['dash.json'])).manifest;
  if (m && ids.has(m.id)) p.push(`id '${m.id}' is also ${ids.get(m.id)}'s`);
  if (m) ids.set(m.id, dir);
  if (p.length) { bad++; console.log(`✕ ${dir}\n${p.map((x) => `    ${x}`).join('\n')}`); continue; }
  write(`${dir}/dash.bundle.json`, `${JSON.stringify({ files })}\n`, stale);
  if (dir.startsWith('dashes/')) listed.push({ dir, id: m.id, name: m.name, version: m.version, author: m.author, description: m.description });
  console.log(`✓ ${dir}: ${m.name} ${m.version}, ${Object.keys(files).length} files`);
}
write('index.json', `${JSON.stringify({ dashes: listed }, null, 2)}\n`, stale);
if (stale.length) console.log(`out of date (run node tools/pack.mjs and commit): ${stale.join(', ')}`);
process.exit(bad || stale.length ? 1 : 0);

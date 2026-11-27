// Take a newer version of what a dash was copied from (its base), keeping your changes:
//   node tools/update-base.mjs <your dash's folder> [--gallery <path or URL>] [--to <version>]
// Your dash.json's "basedOn" ({id, version}) names the base: "tunerloop-dash" is the app's own dash
// (starters/tunerloop in tunerloop/dashes), any other id a gallery dash (its folder under dashes/).
// The tool reads tunerloop/dashes (cloned to a temporary folder, or --gallery: a local clone or
// another URL), finds the commit where the base was at your version and the newest one (or --to),
// and merges what changed between the two into your folder, file by file, the way git merges
// (git merge-file): your changes and the base's both stay, and where both changed the same lines it
// leaves conflict markers (<<<<<<< yours, ======= , >>>>>>> new base) and lists the file.
//   - a file the base added is added; one it deleted goes if you never changed it;
//   - dash.json: each key takes the base's new value unless you changed it (so your id, name and
//     version stay yours), and basedOn moves to the new version;
//   - files only you have are left alone; dash.bundle.json is never merged (pack.mjs writes it).
// It needs no shared git history with tunerloop/dashes, so it works in a repo made from the template.
// Afterwards: resolve any conflicts, run node tools/pack.mjs, look at the preview, raise your version
// and push (AGENTS.md). Exit code 0: merged cleanly; 1: conflicts to resolve; 2: nothing done.
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const GALLERY = 'https://github.com/tunerloop/dashes';
export const APP_DASH = 'tunerloop-dash';
const SKIP = new Set(['dash.bundle.json']);

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
const gitOr = (cwd, ...args) => { try { return git(cwd, ...args); } catch { return null; } };
const readOr = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

// -1, 0 or 1 for two major.minor.build versions.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  return 0;
}

// The base's folder in the gallery and the version a dash.json there says it is.
function baseFolder(gallery, id) {
  if (id === APP_DASH) return { folder: 'starters/tunerloop', versionOf: (m) => m.basedOn?.id === APP_DASH ? m.basedOn.version : null };
  for (const name of (gitOr(gallery, 'ls-tree', '--name-only', 'HEAD', 'dashes/') || '').split('\n').filter(Boolean)) {
    const m = JSON.parse(gitOr(gallery, 'show', `HEAD:${name}/dash.json`) || '{}');
    if (m.id === id) return { folder: name, versionOf: (x) => (x.id === id ? x.version : null) };
  }
  throw new Error(`no dash with id "${id}" in the gallery`);
}

// Each version of the base: [{version, commit}], the newest commit at each version (a later fix
// that didn't raise it included).
export function baseVersions(gallery, id) {
  const { folder, versionOf } = baseFolder(gallery, id);
  const out = [];
  for (const commit of git(gallery, 'log', '--format=%H', '--', folder).split('\n').filter(Boolean)) {
    let m;
    try { m = JSON.parse(git(gallery, 'show', `${commit}:${folder}/dash.json`)); } catch { continue; }
    const version = versionOf(m);
    if (version && !out.some((v) => v.version === version)) out.push({ version, commit });
  }
  return { folder, versions: out };
}

// A folder's files at a commit, as {path: text} relative to the folder.
function filesAt(gallery, commit, folder) {
  const out = {};
  for (const path of git(gallery, 'ls-tree', '-r', '--name-only', commit, `${folder}/`).split('\n').filter(Boolean)) {
    const rel = path.slice(folder.length + 1);
    if (!SKIP.has(rel)) out[rel] = git(gallery, 'show', `${commit}:${path}`);
  }
  return out;
}

// A three-way merge of one text file (git merge-file): {text, conflicts}.
export function mergeText(mine, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), 'tl-merge-'));
  try {
    const [m, b, t] = ['mine', 'base', 'theirs'].map((n) => join(dir, n));
    writeFileSync(m, mine); writeFileSync(b, base); writeFileSync(t, theirs);
    const r = spawnSync('git', ['merge-file', '-p', '-L', 'yours', '-L', 'old base', '-L', 'new base', m, b, t], { encoding: 'utf8', maxBuffer: 64 << 20 });
    if (r.status < 0 || r.status === null || r.error) throw new Error(`git merge-file failed: ${r.error?.message || r.stderr}`);
    return { text: r.stdout, conflicts: r.status };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// A three-way merge of dash.json: each key the base's new value unless yours differs from the old
// base's; basedOn the new version. Returns {text, conflicts: [keys both changed differently]}.
export function mergeManifest(mine, base, theirs, basedOn) {
  const [m, b, t] = [mine, base, theirs].map((x) => JSON.parse(x));
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const out = {}, conflicts = [];
  for (const k of new Set([...Object.keys(m), ...Object.keys(t)])) {
    if (k === 'basedOn') continue;
    if (same(m[k], b[k])) { if (t[k] !== undefined) out[k] = t[k]; }      // you left it: the base's new value (or gone)
    else {
      if (m[k] !== undefined) out[k] = m[k];                             // you changed it: yours
      if (!same(t[k], b[k]) && !same(t[k], m[k])) conflicts.push(k);     // and so did the base, differently
    }
  }
  out.basedOn = basedOn;
  return { text: `${JSON.stringify(out, null, 2)}\n`, conflicts };
}

// Merge the base's change from one version to another into a dash folder. Returns
// {from, to, changed: [paths], added, removed, conflicts: [{path, why}], kept: [{path, why}]}.
export function updateBase(dashDir, { gallery, to = null }) {
  const manifestPath = join(dashDir, 'dash.json');
  const mine = JSON.parse(readOr(manifestPath) ?? 'null');
  if (!mine) throw new Error(`no dash.json in ${dashDir}`);
  const b = mine.basedOn;
  if (!b?.id || !b?.version) throw new Error(`${dashDir}/dash.json has no "basedOn" ({"id", "version"}): this tool merges a newer base into a copy, and can't tell what this one is a copy of`);
  const { folder, versions } = baseVersions(gallery, b.id);
  const from = versions.find((v) => v.version === b.version);
  if (!from) throw new Error(`the gallery has no ${b.id} ${b.version} (it has ${versions.map((v) => v.version).join(', ') || 'none'})`);
  const target = to ? versions.find((v) => v.version === to) : versions.reduce((a, v) => (compareVersions(v.version, a.version) > 0 ? v : a), from);
  if (!target) throw new Error(`the gallery has no ${b.id} ${to}`);
  const res = { id: b.id, from: from.version, to: target.version, changed: [], added: [], removed: [], conflicts: [], kept: [] };
  if (compareVersions(target.version, from.version) <= 0) return res;
  const oldFiles = filesAt(gallery, from.commit, folder), newFiles = filesAt(gallery, target.commit, folder);
  for (const path of [...new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)])].sort()) {
    const full = join(dashDir, path), m = readOr(full), o = oldFiles[path] ?? null, n = newFiles[path] ?? null;
    if (path === 'dash.json') {
      const r = mergeManifest(m, o ?? m, n ?? m, { id: b.id, version: target.version });
      if (r.text !== m) { writeFileSync(full, r.text); res.changed.push(path); }
      for (const k of r.conflicts) res.conflicts.push({ path, why: `"${k}": you and the new base both changed it; yours is kept` });
      continue;
    }
    if (n === o) continue;                                                  // the base didn't change it
    if (n === null) {                                                       // the base deleted it
      if (m === null) continue;
      if (m === o) { unlinkSync(full); res.removed.push(path); } else res.kept.push({ path, why: 'the new base deleted it, but you changed it: kept' });
      continue;
    }
    if (m === null && o !== null) { res.kept.push({ path, why: 'the new base changed it, but you deleted it: left deleted' }); continue; }
    const r = m === null ? { text: n, conflicts: 0 } : mergeText(m, o ?? '', n);
    if (r.text === m) continue;
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, r.text);
    (m === null ? res.added : res.changed).push(path);
    if (r.conflicts) res.conflicts.push({ path, why: `${r.conflicts} conflict${r.conflicts > 1 ? 's' : ''}: look for <<<<<<< yours` });
  }
  return res;
}

// The gallery as a local git folder: the one given, or a fresh clone of a URL (cleaned up by done()).
function openGallery(spec) {
  if (spec && existsSync(spec)) return { gallery: resolve(spec), done() {} };
  const dir = mkdtempSync(join(tmpdir(), 'tl-gallery-'));
  execFileSync('git', ['clone', '--quiet', '--filter=blob:none', spec || GALLERY, dir], { stdio: ['ignore', 'ignore', 'inherit'] });
  return { gallery: dir, done() { rmSync(dir, { recursive: true, force: true }); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
  const dir = args.find((a, i) => !a.startsWith('--') && !['--gallery', '--to'].includes(args[i - 1]));
  if (!dir) { console.log('usage: node tools/update-base.mjs <your dash folder> [--gallery <path or URL>] [--to <version>]'); process.exit(2); }
  let g, code = 2;
  try {
    g = openGallery(opt('--gallery'));
    const r = updateBase(resolve(dir), { gallery: g.gallery, to: opt('--to') });
    if (compareVersions(r.to, r.from) <= 0) console.log(`${dir} is already a copy of ${r.id} ${r.from}, the newest: nothing to merge`);
    else {
      console.log(`merged ${r.id} ${r.from} -> ${r.to} into ${dir}`);
      for (const k of ['changed', 'added', 'removed']) if (r[k].length) console.log(`  ${k}: ${r[k].join(', ')}`);
      for (const x of r.kept) console.log(`  decide: ${x.path}: ${x.why}`);
      for (const x of r.conflicts) console.log(`  CONFLICT ${x.path}: ${x.why}`);
      console.log(r.conflicts.length ? 'Resolve each conflict, then run node tools/pack.mjs.' : 'Now run node tools/pack.mjs, look at the preview, raise your version and push.');
      code = r.conflicts.length ? 1 : 0;
    }
  } catch (e) { console.error(`update-base: ${e.message}`); } finally { g?.done(); }
  process.exit(code);
}

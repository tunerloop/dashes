// The base update tool (node --test tools/update-base.test.mjs): a newer version of what a dash was
// copied from merges into the copy, keeping the copy's changes, with no shared git history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { updateBase, baseVersions, mergeManifest, compareVersions } from './update-base.mjs';

const lines = (...xs) => `${xs.join('\n')}\n`;
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;
function write(root, files) {
  for (const [path, text] of Object.entries(files)) {
    if (text === null) { rmSync(join(root, path), { force: true }); continue; }
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' });
// A gallery repo: each step is {files} committed in turn.
function gallery(steps) {
  const dir = mkdtempSync(join(tmpdir(), 'tl-gal-test-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 't@t'); git(dir, 'config', 'user.name', 't');
  for (const files of steps) { write(dir, files); git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'step'); }
  return dir;
}
const starter = (version, more = {}) => json({ id: 'my-tunerloop-dash', name: 'My TunerLoop dash', version: '1.0.0', api: 1, description: 'Base.', ...more, basedOn: { id: 'tunerloop-dash', version } });
const RANGES_1 = lines('export const RED = 7500;', 'export const AMBER = 7000;', 'export const OIL = 60;');
const RANGES_2 = lines('export const RED = 7500;', 'export const AMBER = 7000;', 'export const OIL = 65;');   // the base raised OIL

test('versions compare by number', () => {
  assert.equal(compareVersions('1.0.9', '1.0.10'), -1);
  assert.equal(compareVersions('1.1.0', '1.0.99'), 1);
});

test("the app's own dash: a clean merge keeps your change and takes the base's", () => {
  const gal = gallery([
    { 'starters/tunerloop/dash.json': starter('1.0.0'), 'starters/tunerloop/ranges.js': RANGES_1, 'starters/tunerloop/index.js': lines('export default () => {};'), 'starters/tunerloop/old.js': lines('old') },
    { 'starters/tunerloop/dash.json': starter('1.0.1', { feeds: ['tune'] }), 'starters/tunerloop/ranges.js': RANGES_2, 'starters/tunerloop/kit/new.js': lines('new'), 'starters/tunerloop/old.js': null,
      'starters/tunerloop/dash.bundle.json': '{}' },
  ]);
  assert.deepEqual(baseVersions(gal, 'tunerloop-dash').versions.map((v) => v.version), ['1.0.1', '1.0.0']);
  const mine = mkdtempSync(join(tmpdir(), 'tl-mine-'));
  write(mine, {
    'dash.json': json({ id: 'my-dash', name: 'Steve dash', version: '1.0.4', api: 1, description: 'Base.', basedOn: { id: 'tunerloop-dash', version: '1.0.0' } }),
    'ranges.js': lines('export const RED = 6800;', 'export const AMBER = 7000;', 'export const OIL = 60;'),   // you lowered RED
    'index.js': lines('export default () => {};'), 'old.js': lines('old'), 'mine.js': lines('only mine'),
  });
  const r = updateBase(mine, { gallery: gal });
  assert.equal(r.to, '1.0.1');
  assert.deepEqual(r.conflicts, []);
  assert.equal(readFileSync(join(mine, 'ranges.js'), 'utf8'), lines('export const RED = 6800;', 'export const AMBER = 7000;', 'export const OIL = 65;'), 'both changes');
  assert.ok(existsSync(join(mine, 'kit/new.js')), 'a file the base added is added');
  assert.ok(!existsSync(join(mine, 'old.js')), 'a file the base deleted goes, as you never changed it');
  assert.ok(!existsSync(join(mine, 'dash.bundle.json')), 'the bundle is never merged');
  assert.equal(readFileSync(join(mine, 'mine.js'), 'utf8'), lines('only mine'));
  const m = JSON.parse(readFileSync(join(mine, 'dash.json'), 'utf8'));
  assert.deepEqual([m.id, m.name, m.version, m.feeds, m.basedOn], ['my-dash', 'Steve dash', '1.0.4', ['tune'], { id: 'tunerloop-dash', version: '1.0.1' }], 'yours kept, the new key taken, basedOn moved');
  assert.equal(updateBase(mine, { gallery: gal }).to, '1.0.1', 'run again: already the newest');
});

test('where you and the base changed the same lines, conflict markers and a list', () => {
  const gal = gallery([
    { 'starters/tunerloop/dash.json': starter('1.0.0'), 'starters/tunerloop/ranges.js': RANGES_1 },
    { 'starters/tunerloop/dash.json': starter('1.0.1'), 'starters/tunerloop/ranges.js': RANGES_2 },
  ]);
  const mine = mkdtempSync(join(tmpdir(), 'tl-mine-'));
  write(mine, { 'dash.json': json({ id: 'my-dash', name: 'Mine', version: '1.0.0', api: 1, basedOn: { id: 'tunerloop-dash', version: '1.0.0' } }),
    'ranges.js': lines('export const RED = 7500;', 'export const AMBER = 7000;', 'export const OIL = 50;') });
  const r = updateBase(mine, { gallery: gal });
  assert.deepEqual(r.conflicts.map((c) => c.path), ['ranges.js']);
  const t = readFileSync(join(mine, 'ranges.js'), 'utf8');
  assert.ok(t.includes('<<<<<<< yours') && t.includes('OIL = 50') && t.includes('OIL = 65') && t.includes('>>>>>>> new base'));
});

test('a gallery dash as the base: found by its id, matched by its version', () => {
  const big = (version, label) => ({ 'dashes/big-numbers/dash.json': json({ id: 'big-numbers', name: 'Big numbers', version, api: 1 }), 'dashes/big-numbers/index.js': lines(`const LABEL = '${label}';`, 'export default () => {};') });
  const gal = gallery([big('1.1.0', 'RPM'), big('1.1.1', 'Revs')]);
  const mine = mkdtempSync(join(tmpdir(), 'tl-mine-'));
  write(mine, { 'dash.json': json({ id: 'my-big', name: 'My big', version: '1.0.0', api: 1, basedOn: { id: 'big-numbers', version: '1.1.0' } }),
    'index.js': lines("const LABEL = 'RPM';", 'export default () => {};', '// mine') });
  const r = updateBase(mine, { gallery: gal });
  assert.equal(r.to, '1.1.1');
  assert.equal(readFileSync(join(mine, 'index.js'), 'utf8'), lines("const LABEL = 'Revs';", 'export default () => {};', '// mine'));
});

test('a dash that is not a copy, or of a version the gallery never had, is refused with why', () => {
  const gal = gallery([{ 'starters/tunerloop/dash.json': starter('1.0.0') }]);
  const mine = mkdtempSync(join(tmpdir(), 'tl-mine-'));
  write(mine, { 'dash.json': json({ id: 'my-dash', name: 'Mine', version: '1.0.0', api: 1 }) });
  assert.throws(() => updateBase(mine, { gallery: gal }), /no "basedOn"/);
  write(mine, { 'dash.json': json({ id: 'my-dash', name: 'Mine', version: '1.0.0', api: 1, basedOn: { id: 'tunerloop-dash', version: '0.9.0' } }) });
  assert.throws(() => updateBase(mine, { gallery: gal }), /no tunerloop-dash 0\.9\.0 \(it has 1\.0\.0\)/);
});

test('dash.json: a key both changed differently keeps yours and is listed', () => {
  const r = mergeManifest(json({ a: 1, b: 'mine' }), json({ a: 1, b: 'old' }), json({ a: 2, b: 'new' }), { id: 'x', version: '1.0.1' });
  assert.deepEqual(JSON.parse(r.text), { a: 2, b: 'mine', basedOn: { id: 'x', version: '1.0.1' } });
  assert.deepEqual(r.conflicts, ['b']);
});

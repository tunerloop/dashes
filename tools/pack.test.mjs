// The pack tool's checks (node --test tools/): what the app would refuse is caught here first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problems, readFolder } from './pack.mjs';

const manifest = (more = {}) => JSON.stringify({ id: 'my-dash', name: 'My dash', version: '1.0.0', api: 1, ...more });
const dash = (files) => ({ 'dash.json': manifest(), 'index.js': 'export default () => {};', ...files });

test('a good dash has no problems', () => {
  assert.deepEqual(problems(dash({ 'index.js': "import { a } from './parts/a.js';\nexport default () => a;", 'parts/a.js': "import './b.js'; export const a = 1;", 'parts/b.js': '' })), []);
});

test('the manifest is checked as the app checks it', () => {
  assert.match(problems({ 'dash.json': '{', 'index.js': '' })[0], /dash\.json is not JSON/);
  assert.ok(problems({ 'dash.json': manifest({ version: '1' }), 'index.js': '' }).some((p) => /dash\.json: .*version/.test(p)));
  assert.match(problems(dash({ 'dash.json': manifest({ id: 'shift-light' }) })).join(), /one of the app's own dashes/);
  assert.match(problems({ 'dash.json': manifest() }).join(), /no index\.js in the folder/);
  assert.match(problems(dash({ 'dash.json': manifest({ styles: ['a.css'] }) })).join(), /no a\.css in the folder/);
});

test('every import is a relative path to a file in the folder', () => {
  assert.match(problems(dash({ 'index.js': "import x from 'uplot';" })).join(), /can't import 'uplot'.*relative path/);
  assert.match(problems(dash({ 'index.js': "import x from 'https://cdn.example.com/x.js';" })).join(), /can't import/);
  assert.match(problems(dash({ 'index.js': "import x from '../other/x.js';" })).join(), /outside the dash's folder/);
  assert.match(problems(dash({ 'index.js': "import x from './parts/../../x.js';" })).join(), /outside the dash's folder/);
  assert.match(problems(dash({ 'index.js': "import x from './missing.js';" })).join(), /isn't in the folder/);
  assert.match(problems(dash({ 'index.js': "import './a.js';", 'a.js': "export const y = import('../x.js');" })).join(), /a\.js: can't import '\.\.\/x\.js'/, 'reached through another module, and import()');
  assert.deepEqual(problems(dash({ 'index.js': "const s = \"import x from 'nope'\"; export default () => s;" })), [], 'an import in a string is text');
});

test('the limits are the app\'s', () => {
  const many = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`m${i}.js`, '']));
  assert.match(problems(dash(many)).join(), /66 files/);
  assert.match(problems(dash({ 'big.js': 'x'.repeat(1_500_001) })).join(), /bytes: a dash has at most/);
});

test('a folder is read as the app takes it: dash.json, .js and .css, no bundle, no dot files', () => {
  const files = readFolder(new URL('../dashes/big-numbers', import.meta.url).pathname);
  assert.ok('dash.json' in files && 'index.js' in files && 'big-numbers.css' in files);
  assert.ok(!('dash.bundle.json' in files));
});

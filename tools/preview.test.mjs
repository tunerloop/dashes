// The preview tool (node --test tools/preview.test.mjs): the page it writes holds the dash and the
// app's host, and nothing in a dash's text can break out of the script it is carried in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewHtml } from './preview.mjs';

const host = JSON.parse(readFileSync(new URL('./preview-host.json', import.meta.url), 'utf8'));

test("the app's host is here whole: its modules in order, the page, and the dash fonts", () => {
  assert.match(host.version, /^\d+\.\d+\.\d+$/);
  assert.ok(host.modules.length > 10 && host.page.includes('id="stage"'));
  // every import token points at a module that comes before it
  host.modules.forEach((m, i) => { for (const [at, n] of m.imports) { assert.ok(n < i); assert.equal(m.code.slice(at, at + `tl-mod:${n}`.length), `tl-mod:${n}`); } });
  assert.ok(Object.keys(host.app.bytes).some((p) => p.endsWith('.woff2')) && 'kit/themes.css' in host.app.text);
});

test("the page carries the dash's files, and a dash can't end the script that holds them", () => {
  const files = { 'dash.json': '{"id":"x"}', 'index.js': 'export default () => "</script><script>alert(1)</script>";' };
  const html = previewHtml(files, host);
  assert.equal(html.match(/<\/script>/g).length, 2, 'only the two scripts the page itself has');
  const carried = JSON.parse(html.match(/globalThis\.TL_PREVIEW = (.*);<\/script>/)[1]);
  assert.deepEqual(carried.files, files);
  assert.ok(html.includes('<title>Dash preview: loading</title>'));
});

// manifest.js: the TunerLoop app's own (web app 1.4.194), written by its scripts/dash_tools.mjs. Don't edit.
// A dash package's manifest (dash.json), checked before a dash runs (../ecuai/docs/plan-dashes.md, "The manifest"). Everything here is untrusted text
// from a package: checked for type and size, unknown keys dropped. Pure: also run by the unit tests.

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const PATH = /^(?!\/)(?!.*\.\.)[\w./-]{1,120}\.js$/;
const CSS = /^(?!\/)(?!.*\.\.)[\w./-]{1,120}\.css$/;
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/;
const FEEDS = ['history', 'rows', 'trend', 'tune'];
// The dash API this app speaks (the bridge, api, the reading and feed shapes; dash-kit/README.md). A
// package names the version it was written for; one asking for a newer one than this app has is
// refused rather than started half-working. Raised only for a change an old dash would break on.
export const API = 1;

const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);

// { ok, errors: [text], manifest } with defaults filled in.
export function checkManifest(raw) {
  const errors = [], m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const need = (name, v, why) => { if (v === null || v === undefined) errors.push(`${name}: ${why}`); return v; };
  const out = {
    id: need('id', ID.test(m.id ?? '') ? m.id : null, 'lowercase letters, digits and dashes, 2 to 40'),
    name: need('name', str(m.name, 40) || null, 'text up to 40 characters'),
    version: need('version', VERSION.test(m.version ?? '') ? m.version : null, 'major.minor.build'),
    api: need('api', Number.isInteger(m.api) && m.api >= 1 && m.api <= 999 ? m.api : null, `the dash API it was written for, a whole number (this app: ${API})`),
    author: str(m.author, 60) ?? '',
    license: str(m.license, 30) ?? '',
    description: str(m.description, 200) ?? '',
    entry: need('entry', PATH.test(m.entry ?? 'index.js') ? (m.entry ?? 'index.js') : null, 'a .js path inside the package'),
    styles: [],
    basedOn: null,
    feeds: [],
  };
  if (out.api > API) errors.push(`api: needs a newer app (this dash is for dash API ${out.api}, this app has ${API}): update the app`);
  const styles = m.styles ?? [];
  if (!Array.isArray(styles) || styles.length > 8 || !styles.every((p) => CSS.test(p))) errors.push('styles: up to 8 .css paths inside the package');
  else out.styles = [...styles];
  // A fork names the dash it came from, so it shows how far behind that dash it is.
  if (m.basedOn != null) {
    if (ID.test(m.basedOn?.id ?? '') && VERSION.test(m.basedOn?.version ?? '')) out.basedOn = { id: m.basedOn.id, version: m.basedOn.version };
    else errors.push('basedOn: { id, version } of the dash it was copied from');
  }
  const feeds = m.feeds ?? [];
  if (!Array.isArray(feeds) || !feeds.every((f) => FEEDS.includes(f))) errors.push(`feeds: any of ${FEEDS.join(', ')}`);
  else out.feeds = [...new Set(feeds)];
  return { ok: !errors.length, errors, manifest: out };
}

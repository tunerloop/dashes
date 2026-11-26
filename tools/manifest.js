// Copied from the TunerLoop app (src/js/dash/manifest.js, web app 1.4.187) so tools/pack.mjs checks a dash the
// way the app will. Don't edit it here: take a fresh copy when the app changes it.
// A dash package's manifest (dash.json) and the settings the person chose for it, checked before a
// dash runs (the app's dash plugin design, "The manifest"). Everything here is untrusted text
// from a package: checked for type and size, unknown keys dropped. Pure: also run by the unit tests.

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const KEY = /^[a-z0-9_]{1,40}$/;
const PATH = /^(?!\/)(?!.*\.\.)[\w./-]{1,120}\.js$/;
const CSS = /^(?!\/)(?!.*\.\.)[\w./-]{1,120}\.css$/;
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/;
const FEEDS = ['history', 'rows', 'trend'];
// The dash API this app speaks (the bridge, api, the reading and feed shapes; dash-kit/README.md). A
// package names the version it was written for; one asking for a newer one than this app has is
// refused rather than started half-working. Raised only for a change an old dash would break on.
export const API = 1;
const SETTING_TYPES = ['channel', 'channels', 'number', 'text', 'boolean', 'choice'];
const MAX_SETTINGS = 12;

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
    settings: {},
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
  const settings = m.settings ?? {};
  const names = settings && typeof settings === 'object' ? Object.keys(settings) : null;
  if (!names || names.length > MAX_SETTINGS) errors.push(`settings: an object of at most ${MAX_SETTINGS} settings`);
  else for (const name of names) {
    const s = settings[name];
    if (!KEY.test(name) || !s || !SETTING_TYPES.includes(s.type)) { errors.push(`settings.${name}: type one of ${SETTING_TYPES.join(', ')}`); continue; }
    const def = { type: s.type, label: str(s.label, 40) ?? name };
    if (s.type === 'choice') {
      if (!Array.isArray(s.options) || !s.options.length || s.options.length > 20 || !s.options.every((o) => str(o, 40))) { errors.push(`settings.${name}: options, 1 to 20 texts`); continue; }
      def.options = [...s.options];
      def.labels = Array.isArray(s.labels) && s.labels.length === s.options.length && s.labels.every((l) => str(l, 40)) ? [...s.labels] : [...s.options];
    }
    if (s.type === 'number') { def.min = Number.isFinite(s.min) ? s.min : -1e9; def.max = Number.isFinite(s.max) ? s.max : 1e9; }
    const d = settingValue(def, s.default);
    def.default = d === undefined ? emptyOf(def) : d;
    out.settings[name] = def;
  }
  return { ok: !errors.length, errors, manifest: out };
}

const emptyOf = (def) => ({ channel: '', channels: [], number: 0, text: '', boolean: false, choice: def.options?.[0] ?? '' }[def.type]);

// A setting's value if it fits its definition, else undefined.
export function settingValue(def, v) {
  switch (def.type) {
    case 'channel': return typeof v === 'string' && KEY.test(v) ? v : undefined;
    case 'channels': return Array.isArray(v) && v.length <= 40 && v.every((k) => KEY.test(k)) ? [...v] : undefined;
    case 'number': return typeof v === 'number' && Number.isFinite(v) && v >= def.min && v <= def.max ? v : undefined;
    case 'text': return str(v, 200) ?? undefined;
    case 'boolean': return typeof v === 'boolean' ? v : undefined;
    case 'choice': return def.options.includes(v) ? v : undefined;
    default: return undefined;
  }
}

// The settings a dash gets: each defined setting from the person's choices when it fits, else its default.
export function settingsFor(manifest, values = {}) {
  return Object.fromEntries(Object.entries(manifest.settings).map(([name, def]) => {
    const v = settingValue(def, values?.[name]);
    return [name, v === undefined ? def.default : v];
  }));
}

// The readings this dash knows, their labels, and how each shows in the person's units.
export const LABELS = {
  rpm: 'RPM', map_kpa: 'MAP', tps_pct: 'Throttle', ect_c: 'Head temp', iat_c: 'Intake temp', oil_temp_c: 'Oil temp',
  oil_kpa: 'Oil press', fuel_kpa: 'Fuel press', lambda1: 'Lambda 1', lambda2: 'Lambda 2', lambda_target: 'Lambda target',
  battery_v: 'Battery', ign_deg: 'Ignition', speed_kmh: 'Speed', g_lat: 'G lateral', g_long: 'G long',
};
const KIND = { map_kpa: 'pressure', oil_kpa: 'pressure', fuel_kpa: 'pressure', ect_c: 'temperature', iat_c: 'temperature', oil_temp_c: 'temperature',
  speed_kmh: 'speed', lambda1: 'mixture', lambda2: 'mixture', lambda_target: 'mixture' };
const PLAIN = { rpm: ['', 0], tps_pct: ['%', 0], battery_v: ['V', 1], ign_deg: ['°', 1], g_lat: ['g', 2], g_long: ['g', 2] };
const CONVERT = {
  pressure: { kpa: ['kPa', 0, (x) => x], bar: ['bar', 2, (x) => x / 100], psi: ['psi', 0, (x) => x * 0.1450377] },
  temperature: { c: ['°C', 0, (x) => x], f: ['°F', 0, (x) => x * 9 / 5 + 32] },
  speed: { kmh: ['km/h', 0, (x) => x], mph: ['mph', 0, (x) => x * 0.6213712] },
  mixture: { lambda: ['λ', 2, (x) => x], afr: ['AFR', 1, (x) => x * 14.7] },
};

// {text, unit} for a reading in base units (null: none), in the person's units.
export function show(key, v, units) {
  const kind = KIND[key];
  const [unit, dp, f] = kind ? (CONVERT[kind][units?.[kind]] || Object.values(CONVERT[kind])[0]) : [...(PLAIN[key] || ['', 1]), (x) => x];
  return { unit, text: typeof v === 'number' && Number.isFinite(v) ? f(v).toFixed(dp) : '-' };
}

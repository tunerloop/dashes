// Where a panel is on a box's row of pages (pages.js pageList), as plain functions (no DOM), checked
// by tests/unit/pages.test.js.

// The panel page that sits under full screen: the last one before the full screen pages.
export const underPage = (pages) => Math.max(0, pages.findIndex((p) => p.where === 'full') - 1);
// Swiping sideways to another box: where you last left it, in a panel or in full screen (last:
// { panel, full }, the box's page in each); the first time, in a panel its glance, and in full screen
// the same detail level (or its last).
export function pageAcross(fromPages, at, toPages, last = {}) {
  const where = fromPages[at]?.where === 'full' ? 'full' : 'panel', back = last[where];
  if (toPages[back]?.where === where) return back;
  if (where === 'panel') return 0;
  const from = fromPages[at], full = toPages.map((p, k) => [p, k]).filter(([p]) => p.where === 'full');
  return (full.find(([p]) => p.level === from.level) || full[full.length - 1])[1];
}
// The page for a full screen detail level (test mode, the saved view): its index in the row (past
// the last level: the last page).
export function fullPage(pages, level) {
  const full = pages.map((p, k) => [p, k]).filter(([p]) => p.where === 'full');
  if (!full.length) return 0;
  const at = full.find(([p]) => p.level === level);
  return (at || full[full.length - 1])[1];
}

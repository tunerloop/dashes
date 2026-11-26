// kit/icons.js: the app's kit/icons.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Line icons for the big-number boxes (24 x 24, drawn in the box's label colour). Original
// drawings in the style of dashboard warning symbols.
const P = {
  oilp: '<path d="M3 10h4l2-2h6l5 3-3 6H8l-1-3H3z"/><path d="M15 8V6h-3"/><path d="M20.5 11.5c0 1.2.8 2 .8 2.8a.8.8 0 0 1-1.6 0c0-.8.8-1.6.8-2.8z"/>',
  oil: '<path d="M2 13h3l1.5-1.5h5L16 14l-2 4H6.5l-1-2.5H2z"/><path d="M19 3v10"/><circle cx="19" cy="16" r="2.5"/><path d="M19 5.5h2M19 8.5h2"/>',
  head: '<path d="M12 3v11"/><circle cx="12" cy="17" r="3"/><path d="M12 6h3M12 9h3M12 12h3"/><path d="M3 20c1.5-1 3-1 4.5 0M16.5 20c1.5-1 3-1 4.5 0"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  battery: '<rect x="3" y="7" width="18" height="12" rx="1.5"/><path d="M7 7V5h3v2M14 7V5h3v2"/><path d="M6.5 13h3M15 13h3M16.5 11.5v3"/>',
  tach: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><path d="M6.5 11.5l1 .8M12 7v1.3M17.5 11.5l-1 .8"/>',
  lambda: '<path d="M7 4h2l8 16"/><path d="M12 11l-5 9"/>',
  throttle: '<path d="M7 21l3-14a2 2 0 0 1 4 0l3 14"/><path d="M8 15h8"/>',
  gauge: '<circle cx="12" cy="13" r="8"/><path d="M12 13l3-4"/>',
};
export const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.gauge}</svg>`;

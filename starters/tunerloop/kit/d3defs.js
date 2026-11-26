// kit/d3defs.js: the app's kit/d3defs.js (web app 1.4.189) as forked with tunerloop-dash 1.0.0. Yours to change.
// Gradients and filters the Vintage 3D style draws with, shared by every dial (light from the upper left).
// Filters use the dial's own units (userSpaceOnUse): sized to an element's box, a perfectly vertical
// tick has a zero-wide box and the filter would erase it (the missing mark at 4).
export const D3_DEFS = `<svg class="d3-defs" aria-hidden="true" focusable="false"><defs>
  <radialGradient id="d3-face" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#282828"/><stop offset=".75" stop-color="#181818"/><stop offset="1" stop-color="#0c0c0c"/></radialGradient>
  <linearGradient id="d3-bezel" x1=".15" y1=".1" x2=".85" y2=".9"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".4" stop-color="#1a1a1a"/><stop offset="1" stop-color="#060606"/></linearGradient>
  <radialGradient id="d3-cap" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#616161"/><stop offset=".35" stop-color="#1e1e1e"/><stop offset="1" stop-color="#030303"/></radialGradient>
  <radialGradient id="d3-glass" cx="25%" cy="18%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".5" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="d3-lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150703"/><stop offset=".35" stop-color="#2a120a"/><stop offset="1" stop-color="#32170c"/></linearGradient>
  <linearGradient id="d3-lcdedge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>
  <filter id="d3-glow" filterUnits="userSpaceOnUse" x="-110" y="-110" width="220" height="220"><feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="d3-glare" filterUnits="userSpaceOnUse" x="-110" y="-110" width="220" height="220"><feGaussianBlur stdDeviation="1.3"/></filter>
  <clipPath id="d3-faceclip"><circle r="93"/></clipPath>
  <filter id="d3-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="d3-shadow" filterUnits="userSpaceOnUse" x="-110" y="-110" width="220" height="220"><feDropShadow dx="3" dy="4" stdDeviation="2.2" flood-color="#000" flood-opacity=".7"/></filter>
  <!-- Screen-printed ink, not vector edges: softened a hair (the paint's edge) with a thin shadow
       where the print sits on the face. Applied once to a dial's whole print layer. -->
  <filter id="d3-print" filterUnits="userSpaceOnUse" x="-110" y="-110" width="220" height="220">
    <feGaussianBlur in="SourceGraphic" stdDeviation="0.15" result="ink"/>
    <feDropShadow in="ink" dx="0" dy="0.6" stdDeviation="0.45" flood-color="#000" flood-opacity=".85"/>
  </filter>
</defs></svg>`;

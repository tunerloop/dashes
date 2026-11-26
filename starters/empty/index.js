// My dash: what it shows and how, in a line or two. It fills the Car tab and gets every touch.
export default function mount(api) {
  // Its look is its own: the app gives a dash no styles, only its fonts (Oxanium, Saira, "Saira VF",
  // "Barlow Condensed"). A bigger dash puts this in a .css file listed in dash.json's styles.
  api.root.innerHTML = `<style>
    .dash { background: #000; }
    .g { position: absolute; inset: 0; display: grid; place-items: center; font-family: Oxanium, sans-serif; color: #fff; font-size: 30vmin; font-weight: 700; }
  </style><div class="g">-</div>`;
  // The app's tab bar is this dash's call: a tap puts it away, the next brings it back.
  api.root.addEventListener('click', () => (api.nav.shown ? api.nav.hide() : api.nav.show()));
  const el = api.root.querySelector('.g');
  let rpm = null;
  api.on('reading', (v) => { rpm = v?.rpm ?? null; });
  (function frame() {
    requestAnimationFrame(frame);
    el.textContent = rpm === null ? '-' : String(Math.round(rpm));
  })();
}

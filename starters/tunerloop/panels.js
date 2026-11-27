// The TunerLoop dash's panels: two (stacked in portrait, side by side in landscape) and a full screen
// layer over them. Each panel shows one box at a time; sideways swipes change the box, looping. Each
// box is a row of pages (pages.js): its panel pages, then its full screen pages. A tap steps to the
// next page (from the last, back to the first); swipes up and down step without looping, the pages
// following the finger (kit/slide.js). The full screen layer shows the page of the panel that went
// full screen; going in or out, the panels grid and the layer slide as two pages. A long press opens
// a menu of every box; a two-finger tap changes the box's units. An automatic mode (kit/automodes.js)
// can take over a panel for a while. Which box and page each panel shows is kept in the dash's store,
// so it opens as it was left.
import { UNITS, units } from './kit/units.js';
import { CHANNELS } from './kit/channels.js';
import { cycle } from './kit/gesture.js';
import { makeSlide } from './kit/slide.js';
import { listen } from './kit/touch.js';
import { esc } from './kit/html.js';
import { underPage, pageAcross, fullPage } from './page_rules.js';
import { pageList, makePageView } from './pages.js';
import { BOXES, START, AUTO_BOXES, WHOLE } from './box_list.js';
import { makeBox } from './boxes.js';

const DOTS_MS = 1000;                   // the page dots fade this long after a page stops moving

// root: the dash's element; api: the dash API (store, nav, setUnit); start: a test address's layout
// (start.js) or null. Returns what the dash's loop calls: draw(ctx, autos), rebuild(), rebuildViews().
export function createPanels(root, api, start) {
  const host = document.createElement('div');
  host.className = 'panels';
  root.append(host);
  let panels = [];           // see buildPanels
  let layer = null;          // the full screen layer: { el, slot, dots, lvdots, lvname }
  let fullPanel = null;      // the panel whose page is on the full screen layer, or null
  let slide = null;          // the slide under way: { panel, s (slide.js), onEnd(went) }
  let lastCtx = null;        // the newest frame's readings, for drawing a page the moment it appears
  let navShown = api.nav.shown;
  api.on('nav', (shown) => { navShown = shown; });
  // What the store holds is checked before it is used: a store this dash can't make sense of means it
  // opens as new, never that it fails to start.
  const known = new Set(BOXES.map((b) => b.id));
  const save = (k, v) => { if (JSON.stringify(api.store.get(k)) !== JSON.stringify(v)) api.store.set(k, v); };

  // ------------------------------------------------------------ panels, the layer and their pages

  // A surface is where pages show: a panel, or the full screen layer. Both have a slot for the pages,
  // the box dots along the bottom and the page's name.
  function surface(el) {
    el.innerHTML = '<div class="slot"></div><div class="dots"></div><div class="lvname"></div>';
    const q = (c) => el.querySelector(c);
    return { el, slot: q('.slot'), dots: q('.dots'), lvname: q('.lvname') };
  }
  // A panel's page dots stay where the panel sits on screen, outside everything that slides: while
  // its pages move up and down, and while it is full screen, only the lit dot changes. Placed over
  // the panel's own box (its layout box, never its slide), and again whenever the panels resize.
  function pageDots(panel) {
    const el = document.createElement('div');
    el.className = 'pagedots';
    el.innerHTML = '<div class="lvdots"></div>';
    root.append(el);
    const place = () => Object.assign(el.style, { left: `${panel.el.offsetLeft}px`, top: `${panel.el.offsetTop}px`, width: `${panel.el.offsetWidth}px`, height: `${panel.el.offsetHeight}px` });
    new ResizeObserver(place).observe(panel.el);
    place();
    return { el, lvdots: el.firstChild };
  }

  // Each panel: { p, ...surface, boxes: [{ spec, pages, views, last }], i (the box), page (its page),
  // auto, autoOff, autoBoxes }; a box's last is where it was left, { panel, full } (page_rules.js
  // pageAcross). A panel keeps its state when it rebuilds (a units change), and the store keeps it (saveView).
  function buildPanels() {
    if (slide) { slide.s.clear(); slide = null; root.classList.remove('sliding'); }
    const was = panels.map((p) => ({ i: p.i, page: p.page, last: lastPages(p) })), wasFull = fullPanel?.p ?? null;
    for (const p of panels) { destroyViews(p); p.pageDots.el.remove(); }
    host.innerHTML = '';
    if (!layer) {
      const el = document.createElement('div');
      el.className = 'panel dash-full';
      el.hidden = true;
      root.append(el);
      layer = surface(el);
      gestures(layer, () => fullPanel);
    }
    layer.slot.innerHTML = '';
    const saved = panels.length ? null : startView();
    panels = [BOXES, BOXES].map((specs, p) => {
      const el = document.createElement('div');
      el.className = 'panel';
      host.append(el);
      const last = was[p]?.last ?? saved?.last?.[p] ?? {};
      const panel = { p, ...surface(el), boxes: specs.map((spec) => ({ spec, pages: pageList(spec), views: [], last: { ...last[spec.id] } })), i: 0, page: 0, auto: null, autoOff: null, autoBoxes: {} };
      panel.pageDots = pageDots(panel);
      panel.i = was[p]?.i ?? startBox(specs, p);
      panel.page = Math.min(was[p]?.page ?? saved?.pages[p] ?? 0, entry(panel).pages.length - 1);
      gestures(panel, () => panel);
      return panel;
    });
    fullPanel = panels[saved ? saved.full : wasFull] ?? null;
    if (fullPanel && pageOf(fullPanel).where !== 'full') fullPanel = null;
    for (const p of panels) if (p !== fullPanel && pageOf(p).where === 'full') p.page = underPage(entry(p).pages);
    render();
  }
  function destroyViews(panel) {
    for (const e of panel.boxes) for (const v of e.views) v?.destroy();
    for (const b of Object.values(panel.autoBoxes)) b.destroy?.();
  }

  const entry = (panel, i = panel.i) => panel.boxes[i];
  const pageOf = (panel, i = panel.i, k = panel.page) => entry(panel, i).pages[k];
  const surfaceOf = (panel) => (fullPanel === panel ? layer : panel);
  const pageLabel = (panel, i, k) => [entry(panel, i).spec.name, pageOf(panel, i, k).name].filter(Boolean).join(' · ');

  // Page k of box i, made the first time it is needed, in the panel or the layer as the page says.
  function viewOf(panel, i = panel.i, k = panel.page) {
    const e = entry(panel, i);
    if (!e.views[k]) {
      const v = makePageView(e.spec, e.pages[k]);
      (e.pages[k].where === 'full' ? layer : panel).slot.append(v.el);
      if (lastCtx) v.update({ ...lastCtx, dt: 16 });   // drawn before it shows: nothing blinks in empty
      e.views[k] = v;
    }
    return e.views[k];
  }
  // The view a panel shows in its own slot: its page, or under full screen its last panel page.
  const panelView = (panel) => viewOf(panel, panel.i, pageOf(panel).where === 'full' ? underPage(entry(panel).pages) : panel.page);

  // Show exactly what the state says: each panel's view (or its automatic mode), the layer with the
  // full screen page, the dots and names. Everything shown is fed readings each frame (frame).
  let onScreen = [];
  function render() {
    const keep = new Set();
    for (const panel of panels) {
      if (fullPanel === panel || pageOf(panel).where === 'panel') entry(panel).last[pageOf(panel).where] = panel.page;   // where this box was left
      const auto = panel.auto && panel.autoBoxes[panel.auto];
      for (const [k, b] of Object.entries(panel.autoBoxes)) b.el.hidden = k !== panel.auto;
      if (auto && auto.el.parentNode !== surfaceOf(panel).slot) surfaceOf(panel).slot.append(auto.el);   // over full screen when the panel is
      if (!auto || fullPanel === panel) keep.add(panelView(panel));   // under full screen it stays ready for the slide out
      if (fullPanel === panel && !auto) keep.add(viewOf(panel));
    }
    for (const v of slide?.views || []) keep.add(v);   // a page sliding in stays on screen
    for (const panel of panels) for (const e of panel.boxes) for (const v of e.views) if (v) v.el.hidden = !keep.has(v);
    layer.el.hidden = !fullPanel && !slide?.layer;
    root.toggleAttribute('data-full', !!fullPanel);
    onScreen = [...keep];
    for (const panel of panels) paintDots(panel);
    if (fullPanel) paintDots(fullPanel, layer);
    for (const panel of panels) panel.pageDots.el.hidden = !!fullPanel && fullPanel !== panel;
    saveView();
  }

  // The box dots and page name on a surface, and the panel's page dots (where it sits) with its page
  // lit. They show while a page moves (flashDots), then fade.
  function paintDots(panel, s = panel) {
    const n = panel.boxes.length, pages = entry(panel).pages;
    s.dots.innerHTML = n > 1 ? panel.boxes.map((_, k) => `<i class="${k === panel.i ? 'on' : ''}"></i>`).join('') : '';
    s.lvname.textContent = s === layer && !panel.auto ? pageOf(panel).name : '';
    panel.pageDots.lvdots.innerHTML = pages.length > 1 && !panel.auto ? pages.map((_, k) => `<i class="${k === panel.page ? 'on' : ''}"></i>`).join('') : '';
  }
  // Light up a panel's dots while its pages move (hold: until the finger lifts), then fade them.
  function flashDots(panel, hold = false) {
    for (const t of [surfaceOf(panel), panel.pageDots]) {
      t.el.classList.add('dots-on');
      clearTimeout(t.dotsTimer);
      if (!hold) t.dotsTimer = setTimeout(() => t.el.classList.remove('dots-on'), DOTS_MS);
    }
  }

  // The box each panel starts on, and its page: a test address's layout, else as the store has them.
  function savedBoxes() { const v = api.store.get('boxes'); return [0, 1].map((p) => (Array.isArray(v) && known.has(v[p]) ? v[p] : null)); }
  function startBox(specs, p) {
    for (const id of [start?.boxes[p], savedBoxes()[p], START[p]]) { const k = specs.findIndex((s) => s.id === id); if (k >= 0) return k; }
    return 0;
  }
  function startView() {
    if (start) {                                      // a test address: full=left|right, level=N, or a page per panel (right=oilt:2)
      const rows = [0, 1].map((p) => pageList(BOXES[startBox(BOXES, p)]));
      const pages = rows.map((row, p) => (p === start.full ? fullPage(row, start.level) : Math.min(start.pages?.[p] ?? 0, row.length - 1)));
      const full = start.full ?? [0, 1].find((p) => rows[p]?.[pages[p]]?.where === 'full') ?? null;
      return { pages, full };
    }
    const v = api.store.get('view'), page = (n) => (Number.isInteger(n) && n >= 0 && n < 20 ? n : 0);
    if (!v || !Array.isArray(v.pages)) return { pages: [], full: null };
    const last = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([id]) => known.has(id))
      .map(([id, l]) => [id, Object.fromEntries(['panel', 'full'].filter((w) => Number.isInteger(l?.[w])).map((w) => [w, page(l[w])]))]));
    return { pages: [0, 1].map((p) => page(v.pages[p])), full: v.full === 0 || v.full === 1 ? v.full : null, last: [0, 1].map((p) => last(v.last?.[p])) };
  }
  // A panel's boxes' last pages by box id, for the store: { tach: { panel: 0, full: 3 }, ... }.
  const lastPages = (panel) => Object.fromEntries(panel.boxes.filter((e) => Object.keys(e.last).length).map((e) => [e.spec.id, e.last]));
  function saveView() {
    save('boxes', panels.map((p) => entry(p).spec.id));
    save('view', { pages: panels.map((p) => p.page), full: fullPanel?.p ?? null, last: panels.map(lastPages) });
  }

  // ------------------------------------------------------------ moving between pages and boxes

  // Go to page k of the panel's box at once (no slide).
  function goPage(panel, k) {
    panel.page = k;
    if (pageOf(panel).where === 'full') fullPanel = panel; else if (fullPanel === panel) fullPanel = null;
    render();
    flashDots(panel);
  }
  // Box i in a panel at once, on the page it opens on (pages.js, page_rules.js pageAcross).
  function goBox(panel, i) {
    panel.page = pageAcross(entry(panel).pages, panel.page, entry(panel, i).pages, entry(panel, i).last);
    panel.i = i;
    render();
    flashDots(panel);
  }

  // The slide from where a panel is to the next page up or down (dir 1: the next page, from below)
  // or the next box sideways (dir 1: the next box, from the right). Pages on the same surface slide in
  // its slot; from a panel page to full screen the panels grid and the layer slide as the two pages.
  function startSlide(panel, axis, dir) {
    const s0 = surfaceOf(panel), from = viewOf(panel);
    if (axis === 'x') {
      const i = cycle(panel.i, panel.boxes.length, dir), k = pageAcross(entry(panel).pages, panel.page, entry(panel, i).pages, entry(panel, i).last);
      const to = viewOf(panel, i, k);
      to.el.hidden = false;
      return { panel, s: makeSlide({ axis, dir, from: [from.el], to: [to.el], ref: s0.slot }), onEnd: (went) => went && goBox(panel, i), views: [to] };
    }
    const k = panel.page + dir, pages = entry(panel).pages;
    if (k < 0 || k >= pages.length) return { panel, s: makeSlide({ axis, dir, from: [from.el], to: [], ref: s0.slot }), onEnd: () => {}, views: [] };
    const to = viewOf(panel, panel.i, k), label = pageLabel(panel, panel.i, k);
    const onEnd = (went) => went && goPage(panel, k);
    to.el.hidden = false;
    if (pages[k].where === pageOf(panel).where) return { panel, s: makeSlide({ axis, dir, from: [from.el], to: [to.el], ref: s0.slot, label }), onEnd, views: [to] };
    layer.el.hidden = false;                           // the layer comes in (or goes out) as one page
    for (const p of panels) if (p !== panel) p.pageDots.el.hidden = true;   // the other panel slides away under it
    if (dir > 0) { paintDots(panel, layer); layer.lvname.textContent = pages[k].name; }   // the layer as it will be
    root.classList.add('sliding');
    const s = makeSlide({ axis, dir, from: [dir > 0 ? host : layer.el], to: [dir > 0 ? layer.el : host], ref: root, label });
    return { panel, s, layer: true, onEnd: (went) => { root.classList.remove('sliding'); if (went) goPage(panel, k); }, views: [to] };
  }
  // The finger moved: start the slide (or start it again the other way) and move it.
  function dragTo(panel, axis, delta) {
    const dir = delta < 0 ? 1 : -1;
    if (slide && (slide.panel !== panel || slide.axis !== axis || slide.dir !== dir)) dropSlide();
    if (!slide) { beginSlide(panel, axis, dir); flashDots(panel, true); }
    slide.s.move(delta);
  }
  function beginSlide(panel, axis, dir) {
    slide = { ...startSlide(panel, axis, dir), axis, dir };
    onScreen = [...new Set([...onScreen, ...slide.views])];
  }
  // The finger lifted (or a tap played the slide): finish it, or put it back, then show the new state.
  async function endSlide(go) {
    const sl = slide;
    if (!sl) return;
    sl.ending = true;
    const went = await sl.s.finish(go);
    if (slide !== sl) return;                          // the panels were rebuilt meanwhile (a units change)
    sl.s.clear();
    slide = null;
    sl.onEnd(went);
    if (!went) render();
    flashDots(sl.panel);
  }
  function dropSlide() {
    if (!slide || slide.ending) return;
    slide.s.clear();
    slide.onEnd(false);
    slide = null;
    render();
  }

  // A tap: over an automatic mode, sends it away (until it ends by itself) and shows the page it covered.
  // Otherwise the first one only hides the tab bar; then each steps to the next page with the same
  // slide a drag makes, and from the last page jumps back to the first.
  function tap(panel) {
    if (panel.auto) { api.nav.hide(); sendAway(panel); return; }   // back to the page it covered
    if (navShown) { api.nav.hide(); return; }
    if (panel.page + 1 >= entry(panel).pages.length) { goPage(panel, 0); return; }
    beginSlide(panel, 'y', 1);
    endSlide(true);
  }

  // A panel's (or the layer's) touches; panelOf() says whose pages they move.
  function gestures(s, panelOf) {
    listen(s.slot, {
      busy: () => !!slide?.ending,
      tap: () => { const p = panelOf(); if (p) tap(p); },
      longPress: () => { const p = panelOf(); if (p) openJump(p, s); },
      twoFingerTap: () => { const p = panelOf(); if (p && !p.auto) nextUnits(p); },
      cancel: dropSlide,
      drag(axis, dx, dy) {
        const p = panelOf();
        if (!p) return;
        if (axis === 'y' && p.auto) return;            // an automatic mode has no pages to drag through
        if (axis === 'x') {
          if (p.boxes.length < 2) return;
          // A sideways swipe over an automatic mode sends it away (until that mode ends by itself)
          // and gives the panel back, so the same swipe goes on to the next box.
          sendAway(p);
        }
        dragTo(p, axis, axis === 'x' ? dx : dy);
      },
      release(axis, g) {
        if (!slide) return;
        const want = axis === 'x' ? (slide.dir > 0 ? 'next' : 'prev') : (slide.dir > 0 ? 'up' : 'down');
        endSlide(g === want);
      },
    });
  }

  // A two-finger tap on a panel steps its box to the next units (°F to °C, psi to bar to kPa, mph to
  // km/h, lambda to AFR): tucked away, but quick. It is the same setting as in Settings, so every box
  // of that kind follows: the dash asks the app, and the panels rebuild where they were when it answers.
  function nextUnits(panel) {
    const { spec } = entry(panel), kind = spec.units || CHANNELS[spec.key]?.kind, opts = Object.keys(UNITS[kind]?.options || {});
    if (opts.length < 2) return;
    api.setUnit(kind, opts[(opts.indexOf(units()[kind]) + 1) % opts.length]);
  }

  // A long press: a menu of every box, A to Z, filling the surface, to jump straight to one.
  let jumpEl = null;
  function closeJump() { jumpEl?.remove(); jumpEl = null; }
  function openJump(panel, s) {
    closeJump();
    api.nav.hide();                                    // the tab bar would cover the menu's last row (or column)
    jumpEl = document.createElement('div');
    jumpEl.className = 'jump';
    const name = (k) => panel.boxes[k].spec.name || panel.boxes[k].spec.kind;
    const order = panel.boxes.map((_, k) => k).sort((a, b) => name(a).localeCompare(name(b)));
    jumpEl.innerHTML = order.map((k) => `<button data-k="${k}"${k === panel.i ? ' class="on"' : ''}>${esc(name(k))}</button>`).join('') + '<button data-k="">Close</button>';
    jumpEl.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      closeJump();
      if (b.dataset.k === '') return;
      sendAway(panel);
      goBox(panel, Number(b.dataset.k));
    });
    s.el.append(jumpEl);
  }
  document.addEventListener('pointerdown', (e) => { if (jumpEl && !jumpEl.contains(e.target)) closeJump(); }, true);   // a press outside the menu
  api.on('outside', closeJump);                        // a press in the app outside this frame, or the Car tab left

  // ------------------------------------------------------------ the automatic modes

  // Show mode k in place of a panel's page, on the panel or over full screen (null: give the page back).
  function showAuto(panel, k) {
    if (k === panel.auto) return;
    if (k && !panel.autoBoxes[k]) { const b = makeBox(AUTO_BOXES[k]); b.el.hidden = true; panel.slot.append(b.el); panel.autoBoxes[k] = b; }
    panel.auto = k;
    if (slide?.panel === panel) dropSlide();
    render();
  }
  // Send a panel's automatic mode away until it ends by itself, giving the page back (no mode: nothing).
  function sendAway(panel) {
    if (!panel.auto) return;
    panel.autoOff = panel.auto;
    showAuto(panel, null);
  }

  // ------------------------------------------------------------ each animation frame

  // ctx: this frame's readings for the views (pages.js feed): { value, dt, smoothMs, now }; autos: [left
  // mode, right mode] (kit/automodes.js).
  function draw(ctx, autos) {
    lastCtx = ctx;
    autos.forEach((k, p) => {
      const panel = panels[p];
      if (!panel) return;
      if (panel.autoOff && panel.autoOff !== k) panel.autoOff = null;   // that mode ended: it may come back next time
      showAuto(panel, k === panel.autoOff ? null : k);
    });
    for (const panel of panels) {
      const b = panel.auto && panel.autoBoxes[panel.auto];
      if (!b) continue;
      const spec = AUTO_BOXES[panel.auto];
      b.set(WHOLE.has(spec.kind) ? ctx.value : ctx.value?.[spec.key]);
      b.frame(ctx.dt, ctx.smoothMs);
    }
    for (const v of onScreen) v.update(ctx);
  }

  const everyView = () => panels.flatMap((p) => [...p.boxes.flatMap((e) => e.views.filter(Boolean)), ...Object.values(p.autoBoxes).map((box) => ({ rebuild: () => box.rebuild?.() }))]);
  buildPanels();
  return { draw, rebuild: buildPanels, rebuildViews() { for (const v of everyView()) v.rebuild(); } };
}

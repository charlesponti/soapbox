/* deck-build — shared build helpers (SYSTEM.md §10). The per-deck script writes
   only its own play functions; the mechanics live here so pacing and reduced
   motion can't drift between decks.

   Usage (in a deck page's <script slot="script">):
     const { seq, pulse, count, cycle } = window.deckBuild;
     function playDemo() { seq('#thing .node'); }
     const builders = { demo: playDemo };
     document.querySelectorAll('[data-replay]').forEach(b =>
       b.onclick = () => builders[b.dataset.replay]?.());

   The stage invokes each scene's `data-build` / `[data-replay]` builder on
   entry and on R, so nothing else is needed to wire up navigation or replay. */
(function () {
  const reduced = !!window.DECK_REDUCED;
  const beat = () => window.DECK_BEAT || 900;
  const M = window.Motion || null;

  window.deckBuilds = window.deckBuilds || {};
  window.deckBuild = {
    reduced,
    Motion: M,

    /* decks register their play functions here; the stage resolves them by
       [data-replay] / [data-build] name. */
    register(obj) { Object.assign(window.deckBuilds, obj); },

    /* reveal a group one item per beat (the progressive beat, §4) */
    seq(sel, cls) {
      const items = [...document.querySelectorAll(sel)];
      const c = cls || 'on';
      items.forEach((el) => el.classList.remove(c));
      items.forEach((el, i) => setTimeout(() => el.classList.add(c), reduced ? 0 : beat() * i));
    },

    /* a single highlight/entrance nudge */
    pulse(id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (M && !reduced) M.animate(el, { opacity: [.35, 1], x: [-8, 0] }, { duration: .5, ease: [.22, 1, .36, 1] });
    },

    /* count a number (and optionally sweep a bar) */
    count(id, to, opts = {}) {
      const el = document.getElementById(id);
      if (!el) return;
      const fmt = opts.format || ((v) => v.toFixed(1));
      if (M && !reduced) {
        M.animate(0, to, { duration: opts.duration || 1.6, ease: 'easeOut', onUpdate: (v) => { el.textContent = fmt(v); } });
      } else {
        el.textContent = fmt(to);
      }
      if (opts.bar) {
        const bar = document.getElementById(opts.bar);
        if (bar) {
          if (M && !reduced) M.animate(bar, { scaleX: [1, opts.barTo ?? .18] }, { duration: opts.duration || 1.6, ease: 'easeOut' });
          else bar.style.transform = 'scaleX(' + (opts.barTo ?? .18) + ')';
        }
      }
    },

    /* a cycling highlight; call with a state object to reset/stop it */
    cycle(sel, state = {}) {
      const nodes = [...document.querySelectorAll(sel)];
      if (!nodes.length) return state;
      clearInterval(state.timer);
      state.i = 0;
      const step = () => { nodes.forEach((el, k) => el.classList.toggle('on', k === state.i)); state.i = (state.i + 1) % nodes.length; };
      step();
      if (!reduced) state.timer = setInterval(step, beat());
      return state;
    }
  };
})();

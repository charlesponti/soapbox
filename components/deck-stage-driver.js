/* deck-stage-driver — opt-in capture driver (Phase 4 / poc).
   A built deck becomes capturable when the page is opened with ?stage: the
   driver hides the presenter chrome, freezes scrolling, and exposes the same
   window.__pocStart / window.__marks contract the PoC capture scripts already
   poll. It is a no-op on normal views, so it is safe to ship everywhere.

   Contract:
     window.__pocStart({ scene, atMs, doneAtMs })
       scene   — a scene id, or an index (number). Default: first scene.
       atMs    — ms after start to fire that scene's [data-replay] build.
       doneAtMs — ms after start to set window.__marks.done.
     window.__marks — { t0, jump, replayCalled, done } (performance.now() values).

   Drive a built deck (serve dist/ first, e.g. `npm run preview`):
     POC_URL='http://localhost:4321/soapbox/next-token/?stage' \
     POC_OPTS='{"scene":"s2","atMs":17832,"doneAtMs":46500}' \
     node poc/capture.mjs
*/
(function () {
  if (!/[?&]stage\b/.test(location.search)) return;

  const style = document.createElement('style');
  style.textContent = 'nav,.cues,.scrollcue{display:none!important}html{scroll-behavior:auto!important}';
  document.head.appendChild(style);

  window.__marks = {};
  window.__pocStart = function (opts) {
    opts = opts || {};
    const stage = document.querySelector('deck-stage');
    const scenes = stage ? stage.scenes : [];
    const idx = typeof opts.scene === 'number'
      ? Math.max(0, Math.min(scenes.length - 1, opts.scene))
      : Math.max(0, scenes.findIndex((s) => s.id === opts.scene));
    const atMs = opts.atMs != null ? opts.atMs : 0;
    const doneAtMs = opts.doneAtMs != null ? opts.doneAtMs : atMs + 2000;

    window.__marks.t0 = performance.now();
    const scene = scenes[idx];
    if (scene) {
      scene.scrollIntoView({ behavior: 'instant' });
      window.__marks.jump = performance.now();
      setTimeout(() => {
        const build = scene.querySelector('[data-replay]');
        window.__marks.replayCalled = performance.now();
        if (build) build.click();
      }, atMs);
    }
    setTimeout(() => { window.__marks.done = performance.now(); }, doneAtMs);
    return 'started';
  };
})();

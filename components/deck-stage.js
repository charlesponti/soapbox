/* <deck-stage> — YouTube Slide System presenter harness (SYSTEM.md §10).
   Wraps a deck's scenes and owns everything that used to be copy-pasted into
   every deck: the chrome (brand mark, counter, speaker-cues toggle, prev/next,
   progress bar), the keyboard, the scene observer, the entrance reveal, and the
   ONE progressive beat published as window.DECK_BEAT (SYSTEM.md §4).

   Usage:
     <deck-stage brand="NEXT TOKEN" series="EPISODE 01 — THE BUILD">
       <deck-cue time="STEP 0 · 00:00" title="The question">talk track…</deck-cue>
       <section class="scene" id="s1">…</section>
     </deck-stage>

   Scenes must be DIRECT children of the stage; cues (one per scene, in
   document order) are <deck-cue> children. Attributes: brand, series, beat
   (ms, default 900 — the value published as window.DECK_BEAT), mark="false"
   to hide the accent mark.

   A scene's build animation is defined by its own [data-replay] button — the
   single source of truth: the stage clicks it on first view (so the scene
   assembles as it enters) and again on R. Decks wire those buttons to their
   play functions; they no longer re-implement navigation or the beat.

   prefers-reduced-motion: no entrance, no stepping — every scene renders its
   final state immediately, and the shared beat is still published. */
(function(){
  if (customElements.get('deck-stage')) return;
  const DEFAULT_BEAT = 900;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  class DeckStage extends HTMLElement {
    connectedCallback(){
      if (this._ready) return; this._ready = true;

      // SYSTEM.md §4: the ONE progressive beat, declared here and published for
      // every component and deck to read rather than redeclare.
      this.beat = parseInt(this.getAttribute('beat') || '', 10) || DEFAULT_BEAT;
      this.reduced = reducedMotion;
      window.DECK_BEAT = this.beat;
      window.DECK_REDUCED = this.reduced;

      this.scenes = [...this.querySelectorAll(':scope > section.scene')];
      this.scenes.forEach((s, i) => { if (!s.id) s.id = 'scene' + (i + 1); });   // every scene gets a shareable id
      this.cues = [...this.querySelectorAll(':scope > deck-cue')];
      this.active = 0;
      this._entered = new Set();

      if (this.reduced || !window.Motion) document.documentElement.classList.add('no-motion');

      this._buildChrome();
      this._wire();
      // deep link: open straight at the hash's scene, else the first scene.
      const start = this._sceneFromHash();
      this.update(start >= 0 ? start : 0);
      if (start >= 0) this.scenes[start].scrollIntoView({ behavior: 'instant' });

      // reduced motion: settle every scene to its final state up front. Deferred
      // one macrotask because the deck wires its [data-replay] handlers in a
      // script that runs after this element upgrades.
      if (this.reduced) setTimeout(() => this.scenes.forEach(sc => this._enter(sc, true)), 0);
    }

    /* ---------- chrome ---------- */
    _buildChrome(){
      const showMark = this.getAttribute('mark') !== 'false';
      const nav = document.createElement('nav');
      nav.innerHTML =
        '<div class="brand">' + (showMark ? '<span class="mark"></span>' : '') +
          '<span data-brand></span> <b>/</b> <span data-series></span></div>' +
        '<div class="navright">' +
          '<span class="count" data-counter></span>' +
          '<button data-cues>SPEAKER CUES</button>' +
          '<button data-prev aria-label="Previous slide"><deck-icon name="arrow-up">↑</deck-icon></button>' +
          '<button data-next aria-label="Next slide">NEXT <deck-icon name="arrow-down">↓</deck-icon></button>' +
        '</div>' +
        '<div class="progress" data-progress></div>';
      // set text via textContent so brand/series can never inject markup.
      nav.querySelector('[data-brand]').textContent = this.getAttribute('brand') || '';
      nav.querySelector('[data-series]').textContent = this.getAttribute('series') || '';
      this.prepend(nav);

      this._nav = nav;
      this._counter = nav.querySelector('[data-counter]');
      this._progress = nav.querySelector('[data-progress]');
      this._cuesPanel = document.createElement('div');
      this._cuesPanel.className = 'cues';
      this._cuesPanel.innerHTML = '<div class="cue-time"></div><strong></strong><p></p>';
      this.append(this._cuesPanel);

      nav.querySelector('[data-cues]').addEventListener('click', () => this._toggleCues());
      nav.querySelector('[data-prev]').addEventListener('click', () => this.goto(this.active - 1));
      nav.querySelector('[data-next]').addEventListener('click', () => this.goto(this.active + 1));
    }

    /* ---------- behaviour ---------- */
    _wire(){
      const io = new IntersectionObserver(es => {
        const best = es.filter(e => e.isIntersecting)
          .sort((a, c) => c.intersectionRatio - a.intersectionRatio)[0];
        if (best) this.update(this.scenes.indexOf(best.target));
      }, { threshold: [.3, .5, .7] });
      this.scenes.forEach(sc => io.observe(sc));
      this._io = io;

      if (window.Motion && !this.reduced) {
        window.Motion.scroll(progress => {
          this._progress.style.transform = 'scaleX(' + (progress || 0) + ')';
        });
        this.scenes.forEach(sc => {
          window.Motion.inView(sc, () => this._enter(sc, false), { amount: .35 });
        });
      } else {
        addEventListener('scroll', () => {
          const h = document.documentElement;
          this._progress.style.transform = 'scaleX(' + (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) + ')';
        }, { passive: true });
      }

      document.addEventListener('keydown', e => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); this.goto(this.active + 1); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); this.goto(this.active - 1); }
        if (e.key.toLowerCase() === 'r') this.replayActive();
        if (e.key.toLowerCase() === 'c') this._toggleCues();
      });

      // deep links: pasted hashes and #anchor links jump to that scene
      addEventListener('hashchange', () => this._applyHash());
    }

    /* Entrance (fires once) + the scene's own build, run by clicking its
       [data-replay] button — the same control the presenter sees. */
    _enter(scene, immediate){
      if (this._entered.has(scene)) return; this._entered.add(scene);
      const rises = scene.querySelectorAll('.rise');
      if (window.Motion && !this.reduced && !immediate) {
        window.Motion.animate(rises, { opacity: [0, 1], y: [24, 0] }, { duration: .6, delay: window.Motion.stagger(.08), ease: [.22, 1, .36, 1] });
      } else {
        rises.forEach(el => { el.style.opacity = 1; });
      }
      const build = scene.querySelector('[data-replay]');
      if (build) build.click();
    }

    goto(n){
      const i = Math.max(0, Math.min(this.scenes.length - 1, n));
      this.scenes[i].scrollIntoView({ behavior: this.reduced ? 'instant' : 'smooth' });
    }

    update(n){
      this.active = n;
      this._counter.textContent = String(n + 1).padStart(2, '0') + ' / ' + String(this.scenes.length).padStart(2, '0');
      const cue = this.cues[n];
      if (cue){
        this._cuesPanel.querySelector('.cue-time').textContent = cue.getAttribute('time') || '';
        this._cuesPanel.querySelector('strong').textContent = cue.getAttribute('title') || '';
        this._cuesPanel.querySelector('p').textContent = cue.textContent.trim();
      }
      this._syncHash();
    }

    /* ---------- shareable URLs (#scene-id) ---------- */
    _sceneFromHash(){
      const id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
      if (!id) return -1;
      return this.scenes.findIndex(s => s.id === id);
    }
    _syncHash(){
      const scene = this.scenes[this.active];
      if (!scene || !scene.id) return;
      const want = '#' + scene.id;
      if (location.hash === want) return;
      try { history.replaceState(null, '', want); }
      catch (e) { location.hash = scene.id; }
    }
    _applyHash(){
      const i = this._sceneFromHash();
      if (i < 0 || i === this.active) return;
      this.scenes[i].scrollIntoView({ behavior: 'instant' });
      this.update(i);
    }

    replayActive(){
      const scene = this.scenes[this.active];
      const build = scene && scene.querySelector('[data-replay]');
      if (build) build.click();
    }

    _toggleCues(){
      const on = this._cuesPanel.classList.toggle('on');
      this._nav.querySelector('[data-cues]').textContent = on ? 'HIDE CUES' : 'SPEAKER CUES';
    }
  }

  customElements.define('deck-stage', DeckStage);
})();

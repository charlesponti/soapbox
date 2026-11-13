/* <deck-scene> — the scene wrapper (SYSTEM.md §10). Loads BEFORE <deck-stage>
   so the stage finds the rendered scenes.

   <deck-scene id="s4" title="THE CONVERSATION" layout="split|full">
     …one column (split) or one block (full)…
   </deck-scene>

   It renders the `.scene` / `.scene-inner` frame, injects the eyebrow with the
   step number and total computed from its siblings (so "STEP n / N" can never
   drift), and passes the id through to the section for shareable links. */
(function () {
  if (customElements.get('deck-scene')) return;
  class DeckScene extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      const stage = this.closest('deck-stage');
      const siblings = stage ? [...stage.querySelectorAll('deck-scene')] : [this];
      const step = Math.max(0, siblings.indexOf(this));
      const total = siblings.length;
      const title = this.getAttribute('title') || '';
      const layout = this.getAttribute('layout') || 'split';

      const section = document.createElement('section');
      section.className = 'scene';
      const id = this.getAttribute('id');
      if (id) section.id = id;
      const build = this.getAttribute('data-build');
      if (build) section.dataset.build = build;

      const inner = document.createElement('div');
      inner.className = 'scene-inner' + (layout === 'full' ? '' : ' layout');

      const eyebrow = document.createElement('div');
      eyebrow.className = 'eyebrow rise';
      eyebrow.textContent = this.hasAttribute('cover')
        ? title                                   // cover: no "STEP n / N"
        : 'STEP ' + step + ' / ' + total + (title ? ' · ' + title : '');

      const frag = document.createDocumentFragment();
      while (this.firstChild) frag.appendChild(this.firstChild);
      inner.appendChild(frag);

      // eyebrow goes at the top of the first column (split) or of the frame (full)
      const host = (layout !== 'full' && inner.firstElementChild) ? inner.firstElementChild : inner;
      host.prepend(eyebrow);

      section.appendChild(inner);
      this.appendChild(section);
    }
  }
  customElements.define('deck-scene', DeckScene);
})();

;
/* <deck-icon> — the icon component (SYSTEM.md §10). The ONLY way an icon may
   appear in a deck: no icon font, no CDN runtime, no second library.

   Lucide geometry, inlined (lucide-static v1.59.0, ISC). Icons are monochrome —
   stroke="currentColor", so they take the deck's ink/grey tokens and can never
   introduce a hue. They size to the surrounding font (1em), so they sit on the
   type scale instead of fighting it.

   Usage:
     <deck-icon name="arrow-right"></deck-icon>
     <deck-icon name="arrow-up" label="Previous slide"></deck-icon>

   Adding an icon: copy the <path>/<circle>/… children from
   https://unpkg.com/lucide-static/icons/<name>.svg into ICONS below, keyed by
   the Lucide name. Do not invent geometry and do not inline raw SVG in a deck.

   Progressive enhancement: a fallback glyph authored between the tags
   (<deck-icon name="arrow-down">↓</deck-icon>) shows if this script is absent;
   the component replaces it with the SVG when it upgrades. */
(function(){
  if (customElements.get('deck-icon')) return;
  const ICONS = {
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    'send-horizontal': '<path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/>'
  };

  class DeckIcon extends HTMLElement {
    static get observedAttributes(){ return ['name', 'label']; }
    connectedCallback(){ this._render(); }
    attributeChangedCallback(){ if (this.isConnected) this._render(); }
    _render(){
      const name = this.getAttribute('name') || '';
      const body = ICONS[name];
      if (!body){
        if (!this.textContent.trim()) console.warn('<deck-icon>: no geometry for "' + name + '" (see components/deck-icon.js)');
        return;
      }
      this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
      const label = this.getAttribute('label');
      if (label){ this.setAttribute('role', 'img'); this.setAttribute('aria-label', label); }
      else { this.removeAttribute('role'); this.removeAttribute('aria-label'); }
    }
  }

  customElements.define('deck-icon', DeckIcon);
})();

;
/* <deck-stage> — YouTube Slide System presenter harness (SYSTEM.md §10).
   Owns the chrome, the keyboard, the scene observer, the entrance reveal, the
   shareable URL hash, and the ONE progressive beat.

   Usage:
     <deck-stage brand="NEXT TOKEN" series="EPISODE 01 — THE BUILD">
       <deck-cue time="…" title="…">talk track…</deck-cue>
       <deck-scene id="s1" title="…">…</deck-scene>
     </deck-stage>

   Scenes are any `.scene` (a <deck-scene> renders one). Their build animation
   is declared by the scene's own [data-replay] button or a `data-build` name
   resolved against window.deckBuilds — the stage fires it on first view and
   on R. A deck may use a visible R hint without replay buttons.

   Modes / keys: ↑↓ ←→ or Space advance · C cues · R replay · O overview ·
   B blackout · P presenter window. ?play auto-advances · ?present is the
   presenter view · #s4@1200 deep-links to a beat. */
(function () {
  if (customElements.get('deck-stage')) return;
  const DEFAULT_BEAT = 900;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const query = new URLSearchParams(location.search);

  class DeckStage extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;

      this.beat = parseInt(this.getAttribute('beat') || '', 10) || DEFAULT_BEAT;
      this.reduced = reducedMotion;
      window.DECK_BEAT = this.beat;
      window.DECK_REDUCED = this.reduced;
      window.deckStage = this;

      this.scenes = [...this.querySelectorAll('.scene')];
      this.scenes.forEach((s, i) => { if (!s.id) s.id = 'scene' + (i + 1); });
      this.cues = [...this.querySelectorAll(':scope > deck-cue')];
      this.active = 0;
      this._entered = new Set();

      if (this.reduced || !window.Motion) document.documentElement.classList.add('no-motion');

      if (query.has('present')) {
        this._present = true;
        document.documentElement.classList.add('deck-presenter');
        this._buildPresenter();
        this.update(0);
        this._pollPresenter();
        return;
      }

      this._buildChrome();
      this._wire();
      const start = this._sceneFromHash();
      this.update(start >= 0 ? start : 0);
      if (start >= 0) this.scenes[start].scrollIntoView({ behavior: 'instant' });
      const beat = this._hashBeat();
      if (beat) setTimeout(() => this._fireBuild(this.scenes[start]), beat);
      if (query.has('play')) this._startPlay();

      if (this.reduced) {
        // settle AFTER every script has run — a setTimeout(0) here can fire
        // while the parser is still fetching the component scripts, before the
        // deck has registered its builds (window.deckBuilds).
        const settle = () => this.scenes.forEach((sc) => this._enter(sc, true));
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle, { once: true });
        else settle();
      }
    }

    /* ---------- chrome ---------- */
    _buildChrome() {
      const showMark = this.getAttribute('mark') !== 'false';
      const nav = document.createElement('nav');
      nav.innerHTML =
        '<div class="brand">' + (showMark ? '<svg class="mark" width="15" height="15" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="4" width="26" height="24" rx="6" fill="#E4181B" stroke="#262626" stroke-width="2.5"/><circle cx="10.8" cy="13.5" r="4.2" fill="#fff"/><circle cx="21.2" cy="13.5" r="4.2" fill="#fff"/><circle cx="11.8" cy="12.5" r="2.2" fill="#262626"/><circle cx="22.2" cy="12.5" r="2.2" fill="#262626"/></svg>' : '') +
          '<span data-brand></span> <b>/</b> <span data-series></span></div>' +
        '<div class="deck-dots" data-dots></div>' +
        '<div class="navright">' +
          '<span class="count" data-counter></span>' +
          (this.hasAttribute('replay-hint') ? '<span class="deck-replay-key"><kbd>R</kbd> REPLAY</span>' : '') +
          '<button data-cues>SPEAKER CUES</button>' +
          '<button data-prev aria-label="Previous slide"><deck-icon name="arrow-up">↑</deck-icon></button>' +
          '<button data-next class="deck-next" aria-label="Next slide">' +
            '<span class="deck-nstate n-next">NEXT <deck-icon name="arrow-down">↓</deck-icon></span>' +
            '<span class="deck-nstate n-restart">RESTART <deck-icon name="rotate-ccw">↻</deck-icon></span>' +
          '</button>' +
        '</div>' +
        '<div class="progress" data-progress></div>';
      nav.querySelector('[data-brand]').textContent = this.getAttribute('brand') || '';
      nav.querySelector('[data-series]').textContent = this.getAttribute('series') || '';
      this.prepend(nav);
      this._nav = nav;
      this._counter = nav.querySelector('[data-counter]');
      this._progress = nav.querySelector('[data-progress]');

      const dots = nav.querySelector('[data-dots]');
      this.scenes.forEach((sc, i) => {
        const dot = document.createElement('button');
        dot.className = 'deck-dot';
        dot.setAttribute('aria-label', 'Scene ' + (i + 1));
        dot.addEventListener('click', () => this.goto(i));
        dots.appendChild(dot);
      });
      this._dots = [...dots.children];

      this._cuesPanel = document.createElement('div');
      this._cuesPanel.className = 'cues';
      this._cuesPanel.innerHTML = '<div class="cue-time"></div><strong></strong><p></p>';
      this.append(this._cuesPanel);

      this._blank = document.createElement('div');
      this._blank.className = 'deck-blank';
      this.append(this._blank);
      this._overlay = document.createElement('div');
      this._overlay.className = 'deck-overlay';
      this._buildOverview();
      this.append(this._overlay);

      nav.querySelector('[data-cues]').addEventListener('click', () => this._toggleCues());
      nav.querySelector('[data-prev]').addEventListener('click', () => this.goto(this.active - 1));
      nav.querySelector('[data-next]').addEventListener('click', () => {
        this.goto(this.active >= this.scenes.length - 1 ? 0 : this.active + 1);
      });
    }

    _buildOverview() {
      const grid = document.createElement('div');
      grid.className = 'deck-overview-grid';
      this.scenes.forEach((sc, i) => {
        const b = document.createElement('button');
        const eyebrow = sc.querySelector('.eyebrow');
        const title = (eyebrow ? eyebrow.textContent : '').replace(/^STEP\s*\d+\s*\/\s*\d+\s*/, '').replace(/^·\s*/, '');
        b.innerHTML = '<span class="n"></span><span class="t"></span>';
        b.children[0].textContent = String(i + 1).padStart(2, '0');
        b.children[1].textContent = title || sc.id;
        b.addEventListener('click', () => { this._toggleOverview(false); this.goto(i); });
        grid.appendChild(b);
      });
      this._overlay.innerHTML = '<div class="deck-overlay-head"><span>SCENES</span><span>O TO CLOSE</span></div>';
      this._overlay.appendChild(grid);
    }

    /* ---------- behaviour ---------- */
    _wire() {
      this._placeReplays();
      /* Replay buttons are moved into their visual cards above. Keep their
         action declarative in data-replay and resolve it through the same
         registry used for scene entry and the R key. */
      this.addEventListener('click', (event) => {
        const button = event.composedPath().find((node) => node instanceof Element && node.matches('[data-replay]'));
        if (!button || !this.contains(button)) return;
        const name = button.dataset.replay;
        const build = (window.deckBuilds || {})[name];
        if (typeof build === 'function') build();
      });
      const io = new IntersectionObserver((es) => {
        const best = es.filter((e) => e.isIntersecting).sort((a, c) => c.intersectionRatio - a.intersectionRatio)[0];
        if (best) this.update(this.scenes.indexOf(best.target));
      }, { threshold: [.3, .5, .7] });
      this.scenes.forEach((sc) => io.observe(sc));
      this._io = io;

      if (window.Motion && !this.reduced) {
        window.Motion.scroll((p) => { this._progress.style.transform = 'scaleX(' + (p || 0) + ')'; });
        this.scenes.forEach((sc) => window.Motion.inView(sc, () => this._enter(sc, false), { amount: .35 }));
      } else {
        addEventListener('scroll', () => {
          const h = document.documentElement;
          this._progress.style.transform = 'scaleX(' + (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) + ')';
        }, { passive: true });
      }

      document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        const k = e.key.toLowerCase();
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          if (k === ' ' && this._playing) { this._togglePlay(); } else { e.preventDefault(); this.goto(this.active + 1); }
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.goto(this.active - 1); }
        if (e.key === 'Home') { e.preventDefault(); this.goto(0); }
        if (e.key === 'End') { e.preventDefault(); this.goto(this.scenes.length - 1); }
        if (k === 'r') this.replayActive();
        if (k === 'c') this._toggleCues();
        if (k === 'o') this._toggleOverview();
        if (k === 'b') this._blank.classList.toggle('on');
        if (k === 'p') this._openPresenter();
      });

      addEventListener('hashchange', () => this._applyHash());
    }

    _enter(scene, immediate) {
      if (this._entered.has(scene)) return; this._entered.add(scene);
      const rises = scene.querySelectorAll('.rise');
      if (window.Motion && !this.reduced && !immediate) {
        window.Motion.animate(rises, { opacity: [0, 1], y: [24, 0] }, { duration: .6, delay: window.Motion.stagger(.08), ease: [.22, 1, .36, 1] });
      } else {
        rises.forEach((el) => { el.style.opacity = 1; });
      }
      this._fireBuild(scene);
    }

    /* the replay control belongs with the scene's visual: inside its .diagram
       card when there is one, otherwise right after the visual block. */
    _placeReplays() {
      this.scenes.forEach((scene) => {
        const btn = scene.querySelector('[data-replay]');
        if (!btn || btn.closest('.diagram-action')) return;
        const card = scene.querySelector('.diagram');
        const visual = card || scene.querySelector('deck-compare, deck-grid, deck-flow, deck-chat, deck-verdict');
        if (!visual) return;
        const action = document.createElement('div');
        action.className = 'diagram-action';
        action.appendChild(btn);
        if (card) card.appendChild(action);
        else {
          const wrap = document.createElement('div');
          wrap.className = 'visual-stack';
          visual.parentNode.insertBefore(wrap, visual);
          wrap.append(visual, action);
        }
      });
    }

    _fireBuild(scene) {
      if (!scene) return;
      const btn = scene.querySelector('[data-replay]');
      const name = scene.getAttribute('data-build') || (btn && btn.dataset.replay);
      const reg = window.deckBuilds || {};
      if (name && typeof reg[name] === 'function') { reg[name](); return; }
      if (btn) btn.click();
    }

    goto(n) {
      const i = Math.max(0, Math.min(this.scenes.length - 1, n));
      this.scenes[i].scrollIntoView({ behavior: this.reduced ? 'instant' : 'smooth' });
    }

    update(n) {
      this.active = n;
      this._counter && (this._counter.textContent = String(n + 1).padStart(2, '0') + ' / ' + String(this.scenes.length).padStart(2, '0'));
      if (this._dots) this._dots.forEach((d, i) => d.classList.toggle('on', i === n));
      const nextBtn = this._nav && this._nav.querySelector('[data-next]');
      if (nextBtn) {
        const last = n >= this.scenes.length - 1;
        nextBtn.classList.toggle('is-restart', last);
        nextBtn.setAttribute('aria-label', last ? 'Restart deck' : 'Next slide');
      }
      const cue = this.cues[n];
      if (cue && this._cuesPanel) {
        this._cuesPanel.querySelector('.cue-time').textContent = cue.getAttribute('time') || '';
        this._cuesPanel.querySelector('strong').textContent = cue.getAttribute('title') || '';
        this._cuesPanel.querySelector('p').textContent = cue.textContent.trim();
      }
      this._syncHash();
    }

    replayActive() { this._fireBuild(this.scenes[this.active]); }

    _toggleCues() {
      const on = this._cuesPanel.classList.toggle('on');
      const t = this._nav && this._nav.querySelector('[data-cues]');
      if (t) t.textContent = on ? 'HIDE CUES' : 'SPEAKER CUES';
    }

    _toggleOverview(force) {
      const on = force === undefined ? !this._overlay.classList.contains('on') : force;
      this._overlay.classList.toggle('on', on);
    }

    /* ---------- play mode ---------- */
    _startPlay() {
      this._playing = true;
      const badge = document.createElement('div');
      badge.className = 'deck-playing';
      badge.textContent = '▶ PLAYING · SPACE TO PAUSE';
      this.append(badge);
      this._playBadge = badge;
      const ms = parseInt(this.getAttribute('play-interval') || '', 10) || 12000;
      this._playTimer = setInterval(() => {
        if (this.active >= this.scenes.length - 1) { this._togglePlay(); return; }
        this.goto(this.active + 1);
      }, ms);
      this._playBadge.classList.add('on');
    }
    _togglePlay() {
      if (this._playing) { clearInterval(this._playTimer); this._playing = false; this._playBadge.textContent = '❚❚ PAUSED · SPACE TO RESUME'; }
      else { this._playing = true; this._playBadge.textContent = '▶ PLAYING · SPACE TO PAUSE'; this._playTimer = setInterval(() => this.goto(this.active + 1), parseInt(this.getAttribute('play-interval') || '', 10) || 12000); }
    }

    /* ---------- presenter ---------- */
    _openPresenter() {
      const url = location.pathname + '?present';
      this._presenterWin = window.open(url, 'soapbox-presenter', 'width=520,height=720');
    }
    _buildPresenter() {
      const el = document.createElement('div');
      el.className = 'deck-presenter-panel';
      el.innerHTML =
        '<div class="dp-row"><span class="dp-now"></span><span class="dp-clock"></span></div>' +
        '<div class="dp-cue"><div class="cue-time"></div><strong></strong><p></p></div>' +
        '<div class="dp-next"><span>NEXT</span><span class="dp-next-title"></span></div>' +
        '<div class="dp-btns"><button data-pprev>↑ PREV</button><button data-pnext>NEXT ↓</button></div>' +
        '<div class="dp-hint"></div>';
      this.append(el);
      this._panel = el;
      el.querySelector('[data-pprev]').addEventListener('click', () => this._send('prev'));
      el.querySelector('[data-pnext]').addEventListener('click', () => this._send('next'));
      this._send = () => {};   // replaced once the opener is found
    }
    _pollPresenter() {
      const openerStage = () => {
        try { return window.opener && window.opener.deckStage; } catch (e) { return null; }
      };
      const st = openerStage();
      if (st) {
        this._send = (dir) => st.goto(st.active + (dir === 'next' ? 1 : -1));
        this._panel.querySelector('.dp-hint').textContent = 'Controlling the deck window';
      } else {
        this._panel.querySelector('.dp-hint').textContent = 'Open from the deck window and press P.';
      }
      setInterval(() => {
        const s = openerStage();
        const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this._panel.querySelector('.dp-clock').textContent = clock;
        if (!s) return;
        const i = s.active;
        this._panel.querySelector('.dp-now').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(s.scenes.length).padStart(2, '0');
        const cue = s.cues[i] || null;
        const cueEl = this._panel.querySelector('.dp-cue');
        if (cue) {
          cueEl.querySelector('.cue-time').textContent = cue.getAttribute('time') || '';
          cueEl.querySelector('strong').textContent = cue.getAttribute('title') || '';
          cueEl.querySelector('p').textContent = cue.textContent.trim();
        }
        const next = s.cues[i + 1] || null;
        this._panel.querySelector('.dp-next-title').textContent = next ? next.getAttribute('title') : '— end —';
      }, 500);
    }

    /* ---------- shareable URLs (#scene-id, #scene-id@ms) ---------- */
    _hashParts() {
      const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
      const [id, ms] = raw.split('@');
      return { id, ms: ms ? parseInt(ms, 10) : 0 };
    }
    _sceneFromHash() { const { id } = this._hashParts(); return id ? this.scenes.findIndex((s) => s.id === id) : -1; }
    _hashBeat() { return this._hashParts().ms || 0; }
    _syncHash() {
      const scene = this.scenes[this.active];
      if (!scene || !scene.id) return;
      const want = '#' + scene.id;
      if (location.hash === want) return;
      try { history.replaceState(null, '', want); } catch (e) { location.hash = scene.id; }
    }
    _applyHash() {
      const i = this._sceneFromHash();
      if (i < 0 || i === this.active) return;
      this.scenes[i].scrollIntoView({ behavior: 'instant' });
      this.update(i);
      const beat = this._hashBeat();
      if (beat) setTimeout(() => this._fireBuild(this.scenes[i]), beat);
    }
  }

  customElements.define('deck-stage', DeckStage);
})();

;
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

;
/* <deck-parts> — the diagram vocabulary as custom elements (SYSTEM.md §6/§10).
   Each element renders the shared class names (`.node`, `.flowbox`, `.badge`,
   `.mpart` …) that deck build scripts already target, so migrating a scene to a
   component never changes its build code.

   scene · machine + part · flow + step · stack + node · code · compare + col ·
   chips + chip · grid + cell · verdict + case · cycle + node · counter ·
   tiles + tile · metrics + row · trace · mark

   Load AFTER deck-icon (the flow inserts <deck-icon> arrows). */
(function () {
  const def = (name, cls) => { if (!customElements.get(name)) customElements.define(name, cls); };
  const stateClass = (el, map) => { const s = el.getAttribute('state'); if (s) el.classList.add(map[s] || s); };
  const inner = (el, html) => { el.innerHTML = html; return el; };

  /* machine + part */
  class DeckPart extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('mpart');
      stateClass(this, { installed: 'newp' });
      const state = this.getAttribute('state');
      const left = inner(document.createElement('div'), '<strong></strong><small></small>');
      left.querySelector('strong').textContent = this.getAttribute('name') || '';
      left.querySelector('small').textContent = this.getAttribute('note') || '—';
      const right = document.createElement('span');
      right.className = 'st';
      right.textContent = this.getAttribute('step') || (!state || state === 'ghost' ? 'NOT YET' : '');
      this.append(left, right);
    }
  }
  class DeckMachine extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('machine');
      const parts = [...this.querySelectorAll(':scope > deck-part')];
      let status = this.getAttribute('status');
      if (!status) {
        const installed = parts.filter((p) => { const s = p.getAttribute('state'); return s && s !== 'ghost'; }).length;
        status = installed === 0 ? '0 PARTS INSTALLED' : installed + ' / ' + parts.length + ' PARTS';
      }
      const head = inner(document.createElement('div'), '<span></span><span></span>');
      head.className = 'mlabel';
      head.children[0].textContent = this.getAttribute('label') || 'THE MACHINE';
      head.children[1].textContent = status;
      this.prepend(head);
    }
  }

  /* flow + step (inserts the arrows) */
  class DeckStep extends HTMLElement {
    connectedCallback() { this.classList.add('flowbox'); if (this.hasAttribute('hot')) this.classList.add('hot'); }
  }
  class DeckFlow extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('flow');
      const steps = [...this.children];
      steps.forEach((s, i) => {
        if (i >= steps.length - 1) return;
        const icon = document.createElement('deck-icon');
        icon.className = 'flowarr';
        icon.setAttribute('name', 'arrow-right');
        s.after(icon);
      });
    }
  }

  /* stack + node (inserts the connectors) */
  class DeckNode extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('node');
      const left = inner(document.createElement('div'), '<strong></strong><small></small>');
      left.querySelector('strong').textContent = this.getAttribute('label') || '';
      left.querySelector('small').textContent = this.getAttribute('note') || '';
      const b = document.createElement('b');
      b.textContent = this.getAttribute('tag') || '';
      this.append(left, b);
    }
  }
  class DeckStack extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('stack');
      const nodes = [...this.children];
      nodes.forEach((n, i) => {
        if (i >= nodes.length - 1) return;
        const c = document.createElement('div'); c.className = 'connector';
        n.after(c);
      });
    }
  }

  /* leaf parts — host carries the shared class */
  class DeckCode extends HTMLElement { connectedCallback() { this.classList.add('code'); } }
  class DeckChips extends HTMLElement { connectedCallback() { this.classList.add('badges'); } }
  class DeckChip extends HTMLElement { connectedCallback() { this.classList.add('badge'); } }
  class DeckGrid extends HTMLElement { connectedCallback() { this.classList.add('blocks'); } }
  class DeckCell extends HTMLElement { connectedCallback() { this.classList.add('block'); stateClass(this, { installed: 'on' }); } }
  class DeckCompare extends HTMLElement { connectedCallback() { this.classList.add('cols'); } }
  class DeckCol extends HTMLElement { connectedCallback() { this.classList.add('col'); stateClass(this, {}); } }
  class DeckVerdict extends HTMLElement { connectedCallback() { this.classList.add('verdict'); } }
  class DeckCase extends HTMLElement { connectedCallback() { this.classList.add('v'); stateClass(this, {}); } }
  class DeckCycle extends HTMLElement { connectedCallback() { this.classList.add('loop'); } }
  class DeckCycleNode extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('loopnode');
      const note = this.getAttribute('note');
      if (note) { const s = document.createElement('small'); s.textContent = note; this.appendChild(s); }
    }
  }
  class DeckTiles extends HTMLElement { connectedCallback() { this.classList.add('tiles'); } }
  class DeckTile extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      this.classList.add('tile');
      const b = document.createElement('b'); b.textContent = this.getAttribute('k') || '';
      const s = document.createElement('span'); s.textContent = this.getAttribute('v') || '';
      this.append(b, s);
    }
  }
  class DeckMetrics extends HTMLElement { connectedCallback() { this.classList.add('metrics'); } }
  class DeckTrace extends HTMLElement { connectedCallback() { this.classList.add('metrics'); } }
  class DeckRow extends HTMLElement { connectedCallback() { this.classList.add('mrow'); if (this.hasAttribute('head')) this.classList.add('head'); } }
  class DeckMark extends HTMLElement { connectedCallback() { this.classList.add('mark'); if (this.getAttribute('inline') !== null) this.style.margin = '0 0 0 8px'; } }

  /* counter */
  class DeckCounter extends HTMLElement {
    connectedCallback() {
      if (this._ready) return; this._ready = true;
      const num = document.createElement('div'); num.className = 'bignum';
      const span = document.createElement('span');
      span.id = this.getAttribute('num-id') || '';
      span.textContent = this.getAttribute('value') || '0.0';
      num.append(span, document.createTextNode(this.getAttribute('suffix') || ''));
      this.appendChild(num);
      if (this.hasAttribute('bar')) {
        const bar = document.createElement('div'); bar.className = 'jobbar';
        bar.id = this.getAttribute('bar-id') || '';
        const lab = inner(document.createElement('div'), '<span></span><span></span>');
        lab.className = 'joblabel';
        lab.children[0].textContent = this.getAttribute('bar-left') || '';
        lab.children[1].textContent = this.getAttribute('bar-right') || '';
        this.append(bar, lab);
      }
    }
  }

  def('deck-part', DeckPart);
  def('deck-machine', DeckMachine);
  def('deck-step', DeckStep);
  def('deck-flow', DeckFlow);
  def('deck-node', DeckNode);
  def('deck-stack', DeckStack);
  def('deck-code', DeckCode);
  def('deck-chips', DeckChips);
  def('deck-chip', DeckChip);
  def('deck-grid', DeckGrid);
  def('deck-cell', DeckCell);
  def('deck-compare', DeckCompare);
  def('deck-col', DeckCol);
  def('deck-verdict', DeckVerdict);
  def('deck-case', DeckCase);
  def('deck-cycle', DeckCycle);
  def('deck-cycle-node', DeckCycleNode);
  def('deck-tiles', DeckTiles);
  def('deck-tile', DeckTile);
  def('deck-metrics', DeckMetrics);
  def('deck-trace', DeckTrace);
  def('deck-row', DeckRow);
  def('deck-mark', DeckMark);
  def('deck-counter', DeckCounter);
})();

;
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

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
        '<div class="brand">' + (showMark ? '<span class="mark"></span>' : '') +
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

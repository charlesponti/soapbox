/* <deck-chat> — the CORE chat component (SYSTEM.md §9). The ONLY way a
   conversation OR a message lifecycle may appear in a deck.

   A phone conversation whose messages animate on the progressive beat
   (window.DECK_BEAT, SYSTEM.md §4). Autoplays when scrolled into view;
   .replay() (or the deck's R key) runs it again; prefers-reduced-motion
   renders the final state immediately.

   Children (declarative, in document order):
     <chat-in>            incoming message — left, grey bubble
     <chat-out>           outgoing message — right, white bubble
                            state="confirmed"  optimistic → Sending… → at
                            state="sending"    optimistic → Sending… (holds)
                            state="lost"       appears, then disappears
                            state="failed"     looks sent, then fails (OFFLINE)
                            at="10:42"         the confirmed timestamp
     <chat-think>         a thinking bubble (2 beats)
   Aliases kept for back-compat:
     <chat-msg from="ai">   = <chat-in>
     <chat-msg from="user"> = <chat-out>

   Attributes on <deck-chat>: label, meta (the mono header row above the phone),
   title (phone contact), signal (ONLINE / OFFLINE / …), composer (adds a locked
   composer bar).

   Usage:
     <deck-chat title="THE MODEL" label="A CONVERSATION" meta="THE GOTCHA">
       <chat-out>How many Rs are in "strawberry"?</chat-out>
       <chat-think></chat-think>
       <chat-in>2</chat-in>
       <chat-out>You can't count!</chat-out>
     </deck-chat>

   Lifecycle usage:
     <deck-chat title="Care chat" signal="ONLINE">
       <chat-in>How can I help today?</chat-in>
       <chat-out state="confirmed" at="10:42">I need to change my address</chat-out>
     </deck-chat>
*/
(function(){
  if (customElements.get('deck-chat')) return;
  const DEFAULT_BEAT = 900;
  const isReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beat = () => window.DECK_BEAT || DEFAULT_BEAT;
  const MESSAGE_TAGS = ['CHAT-IN', 'CHAT-OUT', 'CHAT-THINK', 'CHAT-MSG'];

  class DeckChat extends HTMLElement {
    connectedCallback(){
      if (this._ready) return; this._ready = true;
      this._later = [];
      const kids = [...this.children].filter(el => MESSAGE_TAGS.includes(el.tagName));
      this._build(kids);
      this._plan = kids.map(el => ({ el, beats: this._beats(el) }));
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { this.play(); io.disconnect(); }
      }, { threshold: .35 });
      io.observe(this);
      this._bindTilt();
    }

    /* ---------- beats each step occupies on the shared beat ---------- */
    _beats(el){
      if (el.tagName === 'CHAT-THINK') return 2;
      if (this._isOut(el)){
        const s = (el.getAttribute('state') || '').toLowerCase();
        if (s === 'confirmed' || s === 'failed') return 3;
        if (s === 'sending' || s === 'lost') return 2;
      }
      return 1;
    }
    _isOut(el){ return el.tagName === 'CHAT-OUT' || (el.tagName === 'CHAT-MSG' && el.getAttribute('from') === 'user'); }

    /* ---------- build the phone around the declared messages ---------- */
    _build(kids){
      const label = this.getAttribute('label'), meta = this.getAttribute('meta');
      if (label || meta){
        const head = document.createElement('div');
        head.className = 'chat-head';
        const a = document.createElement('span'); a.textContent = label || 'A CONVERSATION';
        const b = document.createElement('span'); b.textContent = meta || '';
        head.append(a, b);
        this.append(head);
      }
      const phone = document.createElement('div'); phone.className = 'deck-phone';
      const head = document.createElement('div'); head.className = 'phone-head';
      const av = document.createElement('span'); av.className = 'avatar';
      const name = document.createElement('span'); name.className = 'phone-name';
      name.textContent = this.getAttribute('title') || label || 'Chat';
      const sig = document.createElement('span'); sig.className = 'signal';
      head.append(av, name, sig);
      this._signal = sig;
      this._setSignal(this.getAttribute('signal') || 'ONLINE');

      const body = document.createElement('div'); body.className = 'phone-body';
      this._body = body;
      kids.forEach(el => {
        el.classList.add('pending');
        if (el.tagName === 'CHAT-THINK') return;   // transient: injected during play
        if (this._isOut(el)){
          el.classList.add('out');
          const text = el.textContent.trim();
          const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
          const status = document.createElement('div'); status.className = 'status';
          el.textContent = ''; el.append(bubble, status);
          el._status = status;
        } else {
          el.classList.add('in');
        }
        body.appendChild(el);
      });
      phone.append(head, body);
      if (this.hasAttribute('composer')){
        const c = document.createElement('div'); c.className = 'phone-composer';
        c.innerHTML = '<span class="composer-input">Message…</span><span class="composer-send"><deck-icon name="send-horizontal">➤</deck-icon></span>';
        phone.append(c);
      }
      this.append(phone);
      this._phone = phone;
    }

    _setSignal(text){
      this._signal.textContent = '● ' + text;
      this._signal.classList.toggle('off', /OFFLINE|UNSTABLE|LOADING|FAILED/i.test(text));
    }

    /* ---------- the run ---------- */
    play(){
      clearTimeout(this._timer);
      this._later.forEach(clearTimeout); this._later.length = 0;
      this._think(false);
      this._plan.forEach(({ el }) => {
        if (el.tagName === 'CHAT-THINK') return;
        el.classList.add('pending');
        el.classList.remove('lost', 'failed');
        if (el._status){ el._status.textContent = ''; el._status.classList.remove('sending'); }
      });
      this._setSignal(this.getAttribute('signal') || 'ONLINE');

      if (isReduced()){
        this._plan.forEach(({ el }) => {
          if (el.tagName === 'CHAT-THINK') return;   // thinking is transient — absent in the final state
          el.classList.remove('pending'); this._settle(el);
        });
        return;
      }
      let i = 0;
      const step = () => {
        if (i >= this._plan.length) return;
        const { el, beats } = this._plan[i++];
        if (el.tagName === 'CHAT-THINK'){
          this._think(true);
          this._timer = setTimeout(() => { this._think(false); step(); }, beats * beat());
          return;
        }
        el.classList.remove('pending');
        this._lifecycle(el);
        this._timer = setTimeout(step, beats * beat());
      };
      this._timer = setTimeout(step, 350);
    }

    /* transient thinking bubble — shown for its 2 beats, then removed */
    _think(show){
      if (show && !this._thinkEl){
        const t = document.createElement('div');
        t.className = 'think'; t.innerHTML = '<i></i><i></i><i></i>';
        this._body.appendChild(t); this._thinkEl = t;
      } else if (!show && this._thinkEl){
        this._thinkEl.remove(); this._thinkEl = null;
      }
    }

    _lifecycle(el){
      if (!this._isOut(el)) return;
      const s = (el.getAttribute('state') || '').toLowerCase();
      const at = el.getAttribute('at') || 'Sent';
      const status = el._status;
      const setStatus = (txt, sending) => { if (!status) return; status.textContent = txt; status.classList.toggle('sending', !!sending); };
      if (s === 'confirmed'){
        this._after(1, () => setStatus('Sending…', true));
        this._after(2, () => setStatus(at, false));
      } else if (s === 'sending'){
        this._after(1, () => setStatus('Sending…', true));
      } else if (s === 'lost'){
        this._after(1, () => el.classList.add('lost'));
      } else if (s === 'failed'){
        this._after(1, () => this._setSignal('OFFLINE'));
        this._after(2, () => el.classList.add('failed'));
      }
    }

    _settle(el){
      if (!this._isOut(el)) return;
      const s = (el.getAttribute('state') || '').toLowerCase();
      const at = el.getAttribute('at') || 'Sent';
      if (s === 'confirmed'){ el._status.textContent = at; }
      else if (s === 'sending'){ el._status.textContent = 'Sending…'; el._status.classList.add('sending'); }
      else if (s === 'lost'){ el.classList.add('lost'); }
      else if (s === 'failed'){ el.classList.add('failed'); this._setSignal('OFFLINE'); }
    }

    _after(n, fn){ this._later.push(setTimeout(fn, n * beat())); }

    /* Pointer-tracking 3D tilt (the streamchat affordance). An interaction, not
       auto-motion: fine pointers only, Motion only, off under reduced motion. */
    _bindTilt(){
      const phone = this._phone;
      const M = window.Motion;
      if (!phone || isReduced() || !M || typeof M.animate !== 'function') return;
      if (!matchMedia('(pointer: fine)').matches) return;
      let raf = 0;
      phone.addEventListener('mousemove', e => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = phone.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          M.animate(phone, { rotateX: -py * 7, rotateY: px * 9, transformPerspective: 900 }, { duration: .25, ease: 'easeOut' });
        });
      });
      phone.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        M.animate(phone, { rotateX: 0, rotateY: 0 }, { duration: .45, ease: [.22, 1, .36, 1] });
      });
    }

    replay(){ this.play(); }
  }

  customElements.define('deck-chat', DeckChat);
})();

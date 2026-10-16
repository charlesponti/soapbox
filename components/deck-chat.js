/* <deck-chat> — YouTube Slide System component (SYSTEM.md §9).
   The ONLY way a conversation-style example may appear in a deck.
   Usage:
     <deck-chat label="A CONVERSATION" meta="LIVE">
       <chat-msg from="user">How many Rs are in "strawberry"?</chat-msg>
       <chat-think></chat-think>
       <chat-msg from="ai">2</chat-msg>
       <chat-msg from="user">You can't count!</chat-msg>
     </deck-chat>
   Behaviour: messages reveal one per DECK BEAT (window.DECK_BEAT, default
   900ms — SYSTEM.md §4 progressive beat). A <chat-think> step shows the
   thinking bubble for 2 beats, then the sequence continues. Autoplays when
   scrolled into view; call .replay() (or the deck's R key) to run it again.
   prefers-reduced-motion: everything renders final-state immediately. */
(function(){
  if (customElements.get('deck-chat')) return;
  const beat = () => window.DECK_BEAT || 900;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  class DeckChat extends HTMLElement {
    connectedCallback(){
      if (this._ready) return; this._ready = true;
      this.classList.add('deck-chat');
      const head = document.createElement('div');
      head.className = 'chat-head';
      head.innerHTML = '<span>' + (this.getAttribute('label') || 'A CONVERSATION') + '</span><span>' + (this.getAttribute('meta') || '') + '</span>';
      this.prepend(head);
      this._steps = [...this.querySelectorAll('chat-msg, chat-think')];
      this._steps.forEach(el => {
        if (el.tagName === 'CHAT-MSG') {
          const who = document.createElement('span');
          who.className = 'who';
          who.textContent = el.getAttribute('from') === 'user' ? 'YOU' : (el.getAttribute('name') || 'THE MODEL');
          el.prepend(who);
          el.classList.add('pending');
        }
      });
      this._thinkEl = null;
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { this.play(); io.disconnect(); }
      }, { threshold: .35 });
      io.observe(this);
    }
    _showThink(){
      this._hideThink();
      const t = document.createElement('div');
      t.className = 'think'; t.innerHTML = '<i></i><i></i><i></i>';
      this.appendChild(t); this._thinkEl = t;
    }
    _hideThink(){ if (this._thinkEl) { this._thinkEl.remove(); this._thinkEl = null; } }
    play(){
      clearTimeout(this._timer); this._hideThink();
      const steps = this._steps;
      steps.forEach(el => { if (el.tagName === 'CHAT-MSG') el.classList.add('pending'); });
      if (reduced()) { steps.forEach(el => { if (el.tagName === 'CHAT-MSG') el.classList.remove('pending'); }); return; }
      let i = 0;
      const next = () => {
        if (i >= steps.length) return;
        const el = steps[i++];
        if (el.tagName === 'CHAT-THINK') {
          this._showThink();
          this._timer = setTimeout(() => { this._hideThink(); this._timer = setTimeout(next, beat()); }, beat() * 2);
        } else {
          el.classList.remove('pending');
          this._timer = setTimeout(next, beat());
        }
      };
      this._timer = setTimeout(next, 350);
    }
    replay(){ this.play(); }
  }
  customElements.define('deck-chat', DeckChat);
})();

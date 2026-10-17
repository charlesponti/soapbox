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

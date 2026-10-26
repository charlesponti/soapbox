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

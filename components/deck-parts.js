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

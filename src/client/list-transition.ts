/**
 * client/list-transition.ts — freeze the index controls while only the essay
 * list morphs during a same-document filter change.
 *
 * The freeze names are applied ONLY around list transitions. Always-on
 * `view-transition-name`s leak into cross-document navigation (Astro
 * ClientRouter): named snapshots always composite above the root capture, so
 * the index's hero/search/list froze on top of the incoming essay header.
 * By scoping the names to the transition, filter changes keep the "only the
 * list moves" behavior while page navigation returns to a clean root
 * crossfade.
 */

const FREEZE: Record<string, string> = {
  "#hero": "hero",
  "#search-input": "search",
  "#topics-trigger": "topics",
  "#badges-bar": "badges",
  "#count-line": "count",
  "#list": "essay-list",
};

export function freezeControls(): void {
  // .list-vt silences the root crossfade for the transition's duration — the
  // only thing that should move is the named essay-list (see global.css).
  document.documentElement.classList.add("list-vt");
  for (const [sel, name] of Object.entries(FREEZE)) {
    (document.querySelector(sel) as HTMLElement | null)?.style.setProperty(
      "view-transition-name",
      name,
    );
  }
  // The popover/sheet panel, when open, must also be named — otherwise the
  // (named) count/badges would paint above it and intercept its clicks.
  (document.querySelector(".dropdown-panel") as HTMLElement | null)?.style.setProperty(
    "view-transition-name",
    "topics-pop",
  );
}

export function unfreezeControls(): void {
  document.documentElement.classList.remove("list-vt");
  for (const sel of Object.keys(FREEZE)) {
    (document.querySelector(sel) as HTMLElement | null)?.style.removeProperty(
      "view-transition-name",
    );
  }
  (document.querySelector(".dropdown-panel") as HTMLElement | null)?.style.removeProperty(
    "view-transition-name",
  );
}

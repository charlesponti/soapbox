/**
 * client/palette.ts — the ⌘K palette. Framework-free: one <script> in the
 * Shell, so it runs on the essays side AND the deck-index side with zero
 * React. The Pagefind index loads lazily on first open; queries debounce
 * 150ms; results group by category.
 *
 * ClientRouter survival: Astro re-executes this script after every body swap.
 * Element listeners bind per root (guarded by root.dataset), while the global
 * key handler binds ONCE and always calls through the window indirection —
 * so it reaches the current root's functions, never a swapped-out closure.
 */
interface PalApi {
  __palKeys?: boolean;
  __palShow?: () => void;
  __palHide?: () => void;
  __palIsOpen?: () => boolean;
}

(() => {
  const w = window as unknown as PalApi;
  if (!w.__palKeys) {
    w.__palKeys = true;
    document.addEventListener("keydown", (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (w.__palIsOpen?.()) w.__palHide?.();
        else w.__palShow?.();
        return;
      }
      if (e.key === "/" && !inField && !w.__palIsOpen?.()) {
        e.preventDefault();
        w.__palShow?.();
        return;
      }
      if (e.key === "Escape" && w.__palIsOpen?.()) w.__palHide?.();
    });
  }

  // Wire the current root. Runs on initial load AND on every
  // astro:page-load (ClientRouter swaps replace the root node; bundled module
  // scripts evaluate once per URL, so without this the palette dies after the
  // first client-side navigation — same pattern as progress.ts).
  function wire() {
    const root = document.querySelector<HTMLElement>("[data-pal]");
    if (!root || root.dataset.palBound === "1") return;
    root.dataset.palBound = "1";
    bind(root);
  }

  function bind(root: HTMLElement) {
  const input = root.querySelector<HTMLInputElement>("[data-pal-input]");
  const list = root.querySelector<HTMLOListElement>("[data-pal-list]");
  if (!input || !list) return;

  const base = (() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const m = link?.href.match(/^(.*\/)favicon\.svg$/);
    const dir = m?.[1] ?? "/";
    return new URL(dir, location.origin).pathname;
  })();

  let pf: Promise<Pagefind> | null = null;
  const getPagefind = (): Promise<Pagefind> => {
    if (!pf) {
      pf = import(/* @vite-ignore */ `${base}pagefind/pagefind.js`).then(
        async (mod: unknown) => {
          const api = mod as Pagefind;
          await api.init();
          return api;
        },
      );
    }
    return pf;
  };

  let items: PagefindResultData[] = [];
  let cursor = -1;
  let timer = 0;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function paint() {
    if (!items.length) {
      list!.innerHTML =
        input!.value.trim() === ""
          ? `<li class="pal-empty">Type to search essays, decks, diagrams.</li>`
          : `<li class="pal-empty">No matches.</li>`;
      return;
    }
    let lastGroup = "";
    let html = "";
    items.forEach((r, i) => {
      const c = r.filters.category;
      const group = Array.isArray(c) ? (c[0] ?? "Elsewhere") : (c ?? "Elsewhere");
      if (group !== lastGroup) {
        lastGroup = group;
        html += `<li class="pal-group" aria-hidden="true">${esc(group)}</li>`;
      }
      html += `<li><a href="${esc(r.url)}" data-pal-item="${i}" class="${i === cursor ? "on" : ""}">` +
        `<span class="pal-t">${esc(r.meta.title ?? r.url)}</span>` +
        (r.excerpt ? `<span class="pal-x">${esc(r.excerpt.slice(0, 90))}</span>` : "") +
        `</a></li>`;
    });
    list!.innerHTML = html;
  }

  async function query(q: string) {
    const needle = q.trim();
    if (!needle) {
      items = [];
      cursor = -1;
      paint();
      return;
    }
    try {
      const api = await getPagefind();
      const { results } = await api.search(needle);
      const data = await Promise.all(results.slice(0, 12).map((r) => r.data()));
      if (input!.value.trim() !== needle) return; // stale
      items = data;
      cursor = data.length ? 0 : -1;
      paint();
    } catch {
      items = [];
      cursor = -1;
      list!.innerHTML = `<li class="pal-empty">Search index isn't built in dev — try a preview build.</li>`;
    }
  }

  function isOpen(): boolean {
    return !root!.hidden;
  }
  function show() {
    input!.value = "";
    items = [];
    cursor = -1;
    paint();
    root!.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => input!.focus());
  }
  function hide() {
    root!.hidden = true;
    document.body.style.overflow = "";
    window.clearTimeout(timer);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  // Current-root API for the once-bound global keys above.
  w.__palShow = show;
  w.__palHide = hide;
  w.__palIsOpen = isOpen;

  document.querySelectorAll("[data-pal-open]").forEach((b) => {
    if ((b as HTMLElement).dataset.palOpenBound) return;
    (b as HTMLElement).dataset.palOpenBound = "1";
    b.addEventListener("click", show);
  });
  root.addEventListener("click", (e) => {
    if (e.target === root) hide();
  });
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => query(input!.value), 150);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length) cursor = (cursor + 1) % items.length;
      paint();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) cursor = (cursor - 1 + items.length) % items.length;
      paint();
    } else if (e.key === "Enter") {
      const pick = items[cursor] ?? items[0];
      if (pick) location.href = pick.url;
    } else if (e.key === "Escape") {
      hide();
    }
  });
  list.addEventListener("mousemove", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-pal-item]");
    if (a) {
      cursor = Number(a.dataset.palItem);
      list.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
      a.classList.add("on");
    }
  });
  } // end bind()

  wire();
  document.addEventListener("astro:page-load", wire);
})();

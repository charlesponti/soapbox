/**
 * components/EssayList.tsx — the interactive index as an Astro client island.
 *
 * - Empty query: topic multiselect + pagination over the embedded metadata
 * - Non-empty query: Pagefind full-text search over essay bodies, composed
 *   with the active topic set via category filters; ranked results with
 *   highlighted excerpts
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import TopicSelect from "./TopicSelect";
import { freezeControls, unfreezeControls } from "../client/list-transition";

export interface EssayMeta {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  pubDate: string | null;
  words: number;
}

const PER_PAGE = 10;
const MAX_RESULTS = 30;

const mins = (words: number) => Math.max(1, Math.round(words / 200));

/** Load the Pagefind runtime via dynamic import. The built bundle is a pure
 *  ES module with named exports (init/search/…) — no window global — so the
 *  module namespace IS the API. Only present in a built/previewed site:
 *  `npm run dev` serves no index, so search needs `npm run build` +
 *  `npm run preview` (or a deployed build). */
async function loadPagefind(): Promise<Pagefind> {
  // Runtime artifact emitted at build time. The specifier must stay non-literal
  // so Vite's import-analysis leaves it alone: dev serves no /pagefind/ index,
  // so this import must fail at runtime (→ searchError state) rather than at
  // transform time.
  const bundle = "/pagefind/" + "pagefind.js";
  const mod: unknown = await import(/* @vite-ignore */ bundle);
  const pf = mod as Pagefind;
  await pf.init();
  return pf;
}

let pfPromise: Promise<Pagefind> | null = null;
function getPagefind(): Promise<Pagefind> {
  if (pfPromise) return pfPromise;
  const p = loadPagefind();
  pfPromise = p;
  return p;
}

/** Numbered window with ellipses: 1 … 4 5 6 … 35 */
function pageNumbers(cur: number, total: number): (number | "…")[] {
  const set = new Set([1, total, cur - 1, cur, cur + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

const pagerBtn =
  "press rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground/40 hover:text-foreground";
const pagerBtnOff = "opacity-35 pointer-events-none";

/** Memoized search field — re-renders only when the query text changes. */
const SearchField = memo(function SearchField({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="relative flex flex-1 items-center gap-2.5">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        spellCheck={false}
        autoComplete="off"
        placeholder="Search essays…"
        value={value}
        ref={inputRef}
        onChange={(e) => {
          // Deliberately NOT wrapped in listVT: flushSync on a controlled
          // input write during the same event breaks React's value tracker
          // and drops the keystroke. Normal batching here.
          onChange(e.target.value);
        }}
        id="search-input"
        className="w-full bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
      />
      <kbd className="pointer-events-none hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
        /
      </kbd>
    </div>
  );
});

export default function EssayList({ essays }: { essays: EssayMeta[] }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<PagefindResultData[] | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [pending, setPending] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const reduce =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* "/" anywhere focuses search (unless already in a field); Escape blurs. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** Morph ONLY the essay list: applies the freeze names for the duration of
   *  the transition (they must NOT persist — see list-transition.ts), so
   *  cross-document navigation stays a clean root crossfade. */
  const listVT = useCallback(
    (fn: () => void) => {
      if (!document.startViewTransition || reduce) {
        fn();
        return;
      }
      freezeControls();
      const t = document.startViewTransition(() => flushSync(fn));
      if (t.finished) {
        t.finished.catch(() => undefined).finally(unfreezeControls);
      } else {
        unfreezeControls();
      }
    },
    [reduce],
  );

  /* Pagefind query, debounced 200ms; re-runs when topics change */
  useEffect(() => {
    let cancelled = false;
    const needle = q.trim();
    if (!needle) {
      setResults(null);
      setSearchError(false);
      setPending(false);
      return;
    }
    setPending(true);
    const t = window.setTimeout(async () => {
      try {
        const pf = await getPagefind();
        const filters = active.size ? { category: [...active] } : undefined;
        const { results: found } = await pf.search(needle, { filters });
        const data = await Promise.all(found.slice(0, MAX_RESULTS).map((r) => r.data()));
        if (!cancelled) {
          listVT(() => {
            setResults(data);
            setSearchError(false);
            setPending(false);
          });
        }
      } catch {
        if (!cancelled) {
          listVT(() => {
            setSearchError(true);
            setPending(false);
          });
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, active, listVT]);

  const searching = pending || results !== null || searchError;

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of essays) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [essays]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return essays.filter((e) => {
      if (active.size && !active.has(e.category)) return false;
      if (!needle) return true;
      return [e.title, e.description, e.category, e.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [essays, q, active]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, totalPages);
  const rows = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const anyFilter = active.size > 0 || q.trim().length > 0;

  const go = useCallback(
    (p: number) => {
      listVT(() => setPage(p));
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }),
      );
    },
    [listVT],
  );

  const onClear = useCallback(
    () =>
      listVT(() => {
        setQ("");
        setActive(new Set());
        setPage(1);
        setResults(null);
        setSearchError(false);
        setPending(false);
      }),
    [listVT],
  );

  const toggleTopic = useCallback(
    (t: string) =>
      listVT(() => {
        const next = new Set(active);
        if (next.has(t)) next.delete(t);
        else next.add(t);
        setActive(next);
        setPage(1);
      }),
    [active, listVT],
  );

  /** Apply a full topic set (mobile sheet Done) inside a list transition. */
  const setTopics = useCallback(
    (next: Set<string>) =>
      listVT(() => {
        setActive(new Set(next));
        setPage(1);
      }),
    [listVT],
  );

  const onQuery = useCallback((v: string) => {
    setQ(v);
    setPage(1);
  }, []);

  const resultCategory = (r: PagefindResultData): string | null => {
    const c = r.filters.category;
    return Array.isArray(c) ? (c[0] ?? null) : (c ?? null);
  };

  return (
    <section aria-label="Search and filters" className="mb-9">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1.5 focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-ring/40 transition-colors">
        <SearchField value={q} onChange={onQuery} inputRef={searchRef} />
        <div className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
        <TopicSelect
          topics={topics}
          active={active}
          onToggle={toggleTopic}
          onSetTopics={setTopics}
        />
      </div>
      <p
        aria-live="polite"
        id="count-line"
        className="mt-4 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
      >
        <span>
          {pending && !searchError
            ? "Searching…"
            : searching
              ? `${results?.length ?? 0} result${results?.length === 1 ? "" : "s"}`
              : `${filtered.length} essay${filtered.length === 1 ? "" : "s"}`}
        </span>
        {anyFilter && (
          <button
            type="button"
            className="press tracking-[0.18em] text-foreground/60 hover:text-foreground"
            onClick={onClear}
          >
            clear
          </button>
        )}
      </p>

      {searchError && (
        <p className="mt-6 text-sm text-muted-foreground">
          Search index not built — run `npm run build` and serve it with `npm run preview`.
        </p>
      )}
      {!pending && !searchError && results && results.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No essays match “{q.trim()}”.</p>
      )}

      {results && results.length > 0 && (
        <ol id="list" className="divide-y divide-border/60">
          {results.map((r) => {
            const cat = resultCategory(r);
            return (
              <li key={r.url}>
                <a
                  href={r.url}
                  className="group -mx-3 flex items-baseline justify-between gap-6 rounded-md px-3 py-4"
                >
                  <span className="min-w-0">
                    <span className="row-title block text-[17px] font-medium leading-snug tracking-[-0.01em]">
                      {r.meta.title}
                    </span>
                    {r.excerpt_with_markup && (
                      <span
                        className="mt-1 block truncate text-sm leading-relaxed text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: r.excerpt_with_markup }}
                      />
                    )}
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                    {[cat, `${mins(r.word_count)} min`].filter(Boolean).join(" · ")}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}

      {!searching && (
        <>
          <ol id="list" className="divide-y divide-border/60">
            {rows.map((e) => {
              return (
                <li key={e.slug}>
                  <a
                    href={`/essays/${e.slug}/`}
                    className="group -mx-3 flex items-baseline justify-between gap-6 rounded-md px-3 py-4"
                  >
                    <span className="min-w-0">
                      <span className="row-title block text-[17px] font-medium leading-snug tracking-[-0.01em]">
                        {e.title}
                      </span>
                      {e.description && (
                        <span className="mt-1 block truncate text-sm leading-relaxed text-muted-foreground">
                          {e.description}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                      {mins(e.words)} min
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>

          <nav className="mt-9 flex items-center justify-between gap-3" aria-label="Pagination">
            <button
              type="button"
              className={cur <= 1 ? `${pagerBtn} ${pagerBtnOff}` : pagerBtn}
              onClick={() => go(cur - 1)}
            >
              ← Prev
            </button>
            <div className="flex items-center gap-1">
              {pageNumbers(cur, totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`…${i}`} className="px-1.5 py-1 text-xs text-muted-foreground/60">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === cur ? "page" : "false"}
                    className={
                      n === cur
                        ? "rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                        : pagerBtn
                    }
                    onClick={() => go(n)}
                  >
                    {n}
                  </button>
                ),
              )}
            </div>
            <button
              type="button"
              className={cur >= totalPages ? `${pagerBtn} ${pagerBtnOff}` : pagerBtn}
              onClick={() => go(cur + 1)}
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

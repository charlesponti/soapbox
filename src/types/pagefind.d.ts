/**
 * Ambient types for Pagefind's browser runtime (dist/pagefind/pagefind.js).
 * Script-style .d.ts on purpose: no imports/exports, so everything below is
 * global — the island and the runtime module declaration both pick it up.
 */

interface Pagefind {
  init(options?: unknown): Promise<void>;
  search(
    query: string,
    options?: { filters?: Record<string, string | string[]> },
  ): Promise<PagefindSearchResponse>;
  debouncedSearch(
    query: string,
    options?: { filters?: Record<string, string | string[]> },
  ): Promise<PagefindSearchResponse>;
  options(options: Record<string, unknown>): Promise<void>;
}

interface PagefindSearchResponse {
  results: PagefindResultApi[];
  total_result_count?: number;
}

interface PagefindResultApi {
  id(): Promise<string>;
  data(): Promise<PagefindResultData>;
  score(): Promise<number>;
}

interface PagefindResultData {
  url: string;
  content: string;
  word_count: number;
  meta: { title?: string };
  excerpt: string;
  excerpt_with_markup: string;
  filters: Record<string, string | string[]>;
}

interface Window {
  Pagefind?: Pagefind;
}

/** The runtime bundle emitted by `pagefind --site dist` (built at build time).
 *  Bare specifier on purpose: tsc matches it via ambient declaration, and the
 *  browser resolves it relative to the page (island lives on / only). */
declare module "pagefind/pagefind.js" {
  const api: Pagefind;
  export default api;
}

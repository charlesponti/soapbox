/**
 * loaders/essays.ts — Astro content-layer loader ("vault-essays").
 *
 * Ingest source: the filekit `stage` output (staged/*.md, slug-named essay
 * copies). Unlike the built-in glob loader, this normalizes frontmatter at
 * load time (title/H1 fallback, ISO dates, word count, duplicate-H1 strip)
 * so the collection schema can stay strict.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import matter from "gray-matter";
import type { Loader, LoaderContext } from "astro/loaders";

const stagedDir = new URL("../../staged/", import.meta.url);

const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : v ? String(v) : null;

export function vaultEssays(): Loader {
  return {
    name: "vault-essays",
    async load({ store, logger, parseData, renderMarkdown }: LoaderContext) {
      // Full re-staging each run: drop stale entries so essays removed from
      // the stage output (e.g. by the status gate) don't persist in the
      // content store across builds.
      store.clear();
      // No staged/ (e.g. CI, which never sees the vault): build with zero essays.
      if (!existsSync(stagedDir)) {
        logger.warn("staged/ not found — building with no essays");
        return;
      }
      let count = 0;
      for (const file of readdirSync(stagedDir)) {
        if (!file.endsWith(".md")) continue;
        const raw = readFileSync(new URL(file, stagedDir), "utf8");
        const { data, content } = matter(raw);

        const slug = String(data.slug ?? file.replace(/\.md$/, ""));
        const firstH1 = content.match(/^\s*#\s+(.+)/m)?.[1]?.trim();
        const humanize = (s: string) =>
          s
            .split(/[._-]+/)
            .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
            .join(" ");
        const title = String(data.title ?? firstH1 ?? humanize(slug));

        let body = content;
        const head = content.match(/^\s*(#\s+[^\n]+)\n*/);
        if (
          head &&
          head[1]!.replace(/^#\s+/, "").trim().toLowerCase() === title.trim().toLowerCase()
        ) {
          body = content.slice(head[0].length); // drop duplicate title H1
        }

        const entryData = {
          slug,
          title,
          category: String(data.category ?? "uncategorized"),
          description: data.description ? String(data.description) : "",
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          pubDate: iso(data.pubDate),
          updated: iso(data.updated),
          words: body.trim().split(/\s+/).length,
        };

        const parsed = await parseData({ id: slug, data: entryData });
        // Custom loaders render markdown themselves — pass `rendered` so
        // render(entry) has HTML (runs the configured Sätteri processor + shiki).
        const fileURL = new URL(file, stagedDir);
        const rendered = await renderMarkdown(body.trimStart(), { fileURL });
        store.set({ id: slug, data: parsed, body: body.trimStart(), rendered });
        count++;
      }
      logger.info(`vault-essays: loaded ${count} essays from filekit stage`);
    },
  };
}

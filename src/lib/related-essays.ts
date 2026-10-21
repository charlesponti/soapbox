import type { CollectionEntry } from "astro:content";

export type EssayEntry = CollectionEntry<"essays">;

/** Build-time related essays: score by shared tags (weight 2 each), then
 *  shared category (weight 1); highest score wins; tiebreak by title. Returns
 *  at most `n` entries, never the current one. Purely computed — no vault. */
export function relatedTo(entry: EssayEntry, all: EssayEntry[], n = 3): EssayEntry[] {
  const tags = new Set(entry.data.tags);
  return all
    .filter((e) => e.data.slug !== entry.data.slug)
    .map((e) => {
      const sharedTags = e.data.tags.filter((t: string) => tags.has(t)).length;
      const score = sharedTags * 2 + (e.data.category === entry.data.category ? 1 : 0);
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.data.title.localeCompare(b.e.data.title))
    .slice(0, n)
    .map((x) => x.e);
}

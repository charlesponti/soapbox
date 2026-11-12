/**
 * lib/registry.ts — the ONE listing layer. The essays index used to merge
 * three sources inline (vault collection + content.json + hardcoded card
 * arrays) with its own comparator; the home page carried a second copy of
 * the comparator. Everything listing-shaped now flows through here:
 * card arrays, the vault+registry merge, and the newest-first sort.
 */
import type { EssayMeta } from "../components/EssayList";
import registryFile from "../../content.json";

export interface Dated {
  title: string;
  pubDate: string | null;
}

/** Newest first; undated sorts after dated, then alphabetically by title. */
export function compareNewest(a: Dated, b: Dated): number {
  if (!a.pubDate && !b.pubDate) return a.title.localeCompare(b.title);
  if (!a.pubDate) return 1;
  if (!b.pubDate) return -1;
  return b.pubDate.localeCompare(a.pubDate);
}

interface RegistryEntry {
  route: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  pubDate: string | null;
  kind: string;
}

/**
 * Vault essays + hand-built registry: every page is content, newest first.
 * `base` is the site base URL (trailing slash) used to build absolute paths.
 */
export function siteIndex(
  vault: Array<{ data: { slug: string; title: string; description: string; category: string; tags: string[]; pubDate: string | null; words: number } }>,
  base: string,
): EssayMeta[] {
  const vaultMeta: EssayMeta[] = vault.map((e) => ({
    slug: e.data.slug,
    title: e.data.title,
    description: e.data.description,
    category: e.data.category,
    tags: e.data.tags,
    pubDate: e.data.pubDate,
    words: e.data.words,
    url: `${base}essays/${e.data.slug}/`,
    kind: "essay",
  }));
  const registeredMeta: EssayMeta[] = (registryFile.content as RegistryEntry[]).map((c) => ({
    slug: c.route,
    title: c.title,
    description: c.description,
    category: c.category,
    tags: c.tags,
    pubDate: c.pubDate,
    url: `${base}${c.route}`,
    kind: c.kind,
  }));
  return [...vaultMeta, ...registeredMeta].sort(compareNewest);
}

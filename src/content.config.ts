import { defineCollection } from "astro:content";
import { z } from "zod";
import { vaultEssays } from "./loaders/essays";

const essays = defineCollection({
  // Custom loader: ingests the filekit `stage` output (staged/*.md) and
  // normalizes frontmatter at load time.
  loader: vaultEssays(),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    category: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    pubDate: z.string().nullable(),
    updated: z.string().nullable(),
    words: z.number(),
  }),
});

export const collections = { essays };

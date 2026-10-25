import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { satteri } from "@astrojs/markdown-satteri";
import { cp, rm, mkdir } from "node:fs/promises";

// Decks not yet migrated to Astro — copied into the build output so the
// published site stays a SUPERSET and nothing drops on deploy.
const LEGACY_DECKS = ["stage-poc.html", "streamchat-offline.html"];

// components/ stays the canonical library — the root static decks reference it
// too — so Astro must not own it. This mirrors it into public/ at config time:
// Astro then serves it at /components/* in dev and copies it into dist/ on
// build. One source, one generated mirror (public/components is gitignored).
const soapbox = {
  name: "soapbox-sync",
  hooks: {
    "astro:config:setup": async () => {
      await mkdir("public", { recursive: true });
      await rm("public/components", { recursive: true, force: true });
      await cp("components", "public/components", { recursive: true });
    },
    "astro:build:done": async ({ dir }) => {
      for (const f of LEGACY_DECKS) await cp(f, new URL(f, dir));
    },
  },
};

// One site: essays at / (from the local vault) and decks under /decks/.
export default defineConfig({
  site: "https://web-production-02a47.up.railway.app",
  integrations: [react(), soapbox],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    // Sätteri is Astro 7's default processor.
    processor: satteri(),
    shikiConfig: {
      // Site is strictly monochrome — map shiki tokens to grays via CSS vars.
      theme: "css-variables",
    },
  },
});

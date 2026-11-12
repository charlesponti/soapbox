import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { satteri } from "@astrojs/markdown-satteri";
import { cp, rm, mkdir, readFile, writeFile } from "node:fs/promises";

// Decks not yet migrated to Astro — copied into the build output so the
// published site stays a SUPERSET and nothing drops on deploy.
const LEGACY_DECKS = ["stage-poc.html", "streamchat-offline.html"];

// The always-loaded deck runtime, in load order. deck-chat.js stays separate
// (only decks with chat pay for it). Every file is IIFE-wrapped, so plain
// concatenation with newline separators is safe — no bundler needed.
const RUNTIME_PARTS = [
  "deck-scene.js",
  "deck-icon.js",
  "deck-stage.js",
  "deck-build.js",
  "deck-parts.js",
  "deck-stage-driver.js",
];

// components/ stays the canonical library — the root static decks reference it
// too — so Astro must not own it. This mirrors it into public/ at config time:
// Astro then serves it at /components/* in dev and copies it into dist/ on
// build. One source, one generated mirror (public/components is gitignored).
// The mirror also gains deck-runtime.js (concatenated RUNTIME_PARTS): one
// request instead of six, identical execution order and timing.
const soapbox = {
  name: "soapbox-sync",
  hooks: {
    "astro:config:setup": async () => {
      await mkdir("public", { recursive: true });
      await rm("public/components", { recursive: true, force: true });
      await cp("components", "public/components", { recursive: true });
      const parts = await Promise.all(
        RUNTIME_PARTS.map((f) => readFile(new URL(`components/${f}`, import.meta.url), "utf8")),
      );
      await writeFile(
        new URL("public/components/deck-runtime.js", import.meta.url),
        parts.join("\n;\n"),
      );
    },
    "astro:build:done": async ({ dir }) => {
      for (const f of LEGACY_DECKS) await cp(f, new URL(f, dir));
    },
  },
};

// One site: essays at / (from the local vault) and decks under /decks/.
export default defineConfig({
  site: "https://charlesponti.github.io",
  base: "/soapbox/",
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

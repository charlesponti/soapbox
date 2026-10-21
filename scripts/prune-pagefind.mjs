#!/usr/bin/env node
/**
 * prune-pagefind.mjs — strip unused Pagefind runtime files from a bundle.
 *
 * Pagefind 1.5.x always emits its Default UI, Component UI, Modular UI, and
 * highlighter modules into the bundle. lexicon's search UI is a custom React
 * island that imports only `/pagefind/pagefind.js` (the raw API), so every
 * UI bundle is dead weight. The `wasm.unknown.*` fallback is also unused
 * because every page declares `lang="en"` (BaseLayout).
 *
 * Verified against the 1.5.2 output: pagefind.js / pagefind-worker.js contain
 * no reference to the UI modules or the highlighter, and only load
 * `wasm.<lang>.pagefind` for the active language.
 *
 * Usage: node scripts/prune-pagefind.mjs <bundle-dir>
 *   (build) node scripts/prune-pagefind.mjs dist/pagefind
 */
import { rmSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DEAD = [
  "pagefind-ui.js",
  "pagefind-ui.css",
  "pagefind-component-ui.js",
  "pagefind-component-ui.css",
  "pagefind-modular-ui.js",
  "pagefind-modular-ui.css",
  "pagefind-highlight.js",
  // Language-unknown WASM fallback — every page is lang="en", never used.
  "wasm.unknown.pagefind",
];

const REQUIRED = [
  "pagefind.js",
  "pagefind-worker.js",
  "pagefind-entry.json",
  // The emitted entry only lists `en`, so the en wasm is the active runtime.
  "wasm.en.pagefind",
];

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/prune-pagefind.mjs <bundle-dir>");
  process.exit(1);
}

const missing = REQUIRED.filter((f) => !existsSync(join(dir, f)));
if (missing.length > 0) {
  // Version-drift guard: if Pagefind stops emitting a file we depend on, fail
  // loudly instead of silently shipping a broken search bundle.
  console.error(`prune-pagefind: required file(s) missing from ${dir}: ${missing.join(", ")}`);
  console.error("  (Pagefind output format may have changed — re-check the DEAD list)");
  process.exit(1);
}

let removed = 0;
let bytes = 0;
for (const f of DEAD) {
  const p = join(dir, f);
  if (!existsSync(p)) continue;
  bytes += statSync(p).size;
  rmSync(p);
  removed++;
}

console.log(
  `prune-pagefind: removed ${removed} unused file(s) (${(bytes / 1024).toFixed(0)} KB) from ${dir}`,
);

// check-decks — build-time lint of the SYSTEM.md invariants (Phase 2).
// Run after `astro build`; it reads dist/ and fails (exit 1) on any violation.
//   node scripts/check-decks.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const fail = [];
const note = (m) => console.log('  ' + m);

if (!existsSync(DIST)) { console.error('check-decks: no dist/ — run `npm run build` first.'); process.exit(1); }

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'components') walk(p, out); }
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
};
const strip = (s, re) => s.replace(re, '');

// The icon registry — the single set of names a deck may use.
const registrySrc = readFileSync(join(ROOT, 'components/deck-icon.js'), 'utf8');
const ICONS = new Set([...registrySrc.matchAll(/'([a-z0-9-]+)'\s*:\s*'</g)].map((m) => m[1]));

// The series manifest.
const manifest = JSON.parse(readFileSync(join(ROOT, 'decks.json'), 'utf8'));
for (const d of manifest.decks) {
  for (const k of ['slug', 'title', 'brand', 'series', 'migrated']) {
    if (d[k] === undefined || d[k] === '') fail.push(`decks.json: "${d.slug || '?'}" missing ${k}`);
  }
}

const files = walk(DIST);
let scanned = 0;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  if (!raw.includes('<deck-stage')) continue;
  scanned++;
  const rel = relative(DIST, file);
  note(rel);

  // `markup` = structure only (no comments, script bodies or style bodies);
  // `body` keeps script text so build-function wiring can be checked.
  const body = strip(raw, /<!--[\s\S]*?-->/g);
  const markup = strip(strip(strip(body, /<script\b[^>]*>[\s\S]*?<\/script>/gi), /<style\b[^>]*>[\s\S]*?<\/style>/gi), /<!--[\s\S]*?-->/g);

  const stageTags = (markup.match(/<deck-stage\b/g) || []).length;
  const scenes = (markup.match(/<section class="scene"/g) || []).length;
  const cues = (markup.match(/<deck-cue\b/g) || []).length;
  const ids = [...markup.matchAll(/<section class="scene"[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);

  if (stageTags !== 1) fail.push(`${rel}: needs exactly one <deck-stage> (found ${stageTags})`);
  if (ids.length !== scenes) fail.push(`${rel}: every .scene needs an id (${scenes} scenes, ${ids.length} ids)`);
  if (new Set(ids).size !== ids.length) fail.push(`${rel}: duplicate scene ids`);
  if (cues && cues !== scenes) fail.push(`${rel}: ${scenes} scenes vs ${cues} <deck-cue>`);

  if (/cdn\.jsdelivr\.net\/npm\/motion/.test(markup)) fail.push(`${rel}: Motion must be vendored, not the CDN`);
  if (markup.includes('↻')) fail.push(`${rel}: replay must use <deck-icon name="rotate-ccw">, not "↻"`);

  for (const m of markup.matchAll(/<deck-icon\b[^>]*\bname="([^"]+)"/g)) {
    if (!ICONS.has(m[1])) fail.push(`${rel}: <deck-icon name="${m[1]}"> is not in the registry (components/deck-icon.js)`);
  }
  for (const m of markup.matchAll(/data-replay="([^"]+)"/g)) {
    if (!new RegExp(`\\b${m[1]}\\s*:`).test(body)) fail.push(`${rel}: [data-replay="${m[1]}"] has no build function`);
  }
}

console.log(`\ncheck-decks: scanned ${scanned} deck(s), ${ICONS.size} icons in the registry.`);
if (fail.length) { console.error('\nFAILED:\n' + fail.map((f) => '  ✗ ' + f).join('\n') + '\n'); process.exit(1); }
console.log('check-decks: OK\n');

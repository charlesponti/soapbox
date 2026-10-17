# YouTube Slide System — v1 (15 Oct 2026)

The standard deck for ALL of Chase's YouTube videos. He talks over the slides;
the slides never talk over him. Adapted from the Stream Chat deck he supplied
(`index.html`, JOY-2476): same presenter machinery — full-screen scenes,
counter + progress, speaker-cues panel, keyboard navigation, replayable
diagrams — reskinned and re-ruled below.

Reference build: `next-token.html` in this folder (the flagship video's deck).
Every new video deck starts as a copy of that file.

## 1. Design law — minimal, black & white

- Background is **pure black `#000000`**. Text is white `#FFFFFF` and the grey
  scale only: `#A1A1A1` (secondary), `#666666` (tertiary), hairlines `#262626`.
- **No gradients. No coloured panels. No shadows for decoration.** Depth comes
  from hairlines, spacing, and type weight — never from colour or glow.
- One idea per scene. Maximum ~30 visible words per scene besides diagram
  labels. If a sentence matters, it belongs in the speaker cues, not on screen.

## 2. The accent law

There is exactly one accent colour in the system: **Monotone Red `#E4181B`**.
Colour may appear ONLY in these sanctioned components:

1. **Monotone himself** — his mark / character when he is the subject of a
   scene (in practice: a red square glyph on the cover and the close, and his
   generated imagery when used).
2. **One semantic state per deck** — a single true/false, pass/fail, or
   alive/dead distinction the argument genuinely needs and monochrome cannot
   carry. Chosen in advance, named in the deck's header comment, used nowhere
   else.

Nothing else gets colour: not progress bars (white), not buttons, not links,
not "the important word" in a headline, not data. Emphasis is weight, size,
serif-vs-sans, or opacity — never a new hue.
Every deck ends with an **accent audit** (HTML comment at the foot of the
file): list each coloured component and its sanction. If a component isn't in
the audit, it isn't coloured.

## 3. Typography — Geist family only

| Role | Font | Used for |
|---|---|---|
| Sans | **Geist** (Google Fonts) | Headlines, body, ledes, buttons — the default voice |
| Serif | **Geist Serif** role — stack `"Geist Serif", Georgia, serif` | Thesis statements, pull-quotes, the closing question. The editorial voice |
| Mono | **Geist Mono** (Google Fonts) | Eyebrows, counters, timestamps, diagram labels, data, code-like values |

Honest note on the serif: as of Oct 2026 Vercel ships Geist Sans, Geist Mono,
and Geist Pixel — there is no official Geist Serif cut on Google Fonts or
Fontsource (verified 15 Oct 2026). The system therefore names the serif ROLE
`--font-serif: "Geist Serif", Georgia, "Times New Roman", serif`. Georgia
carries the role today; the day a Geist Serif is installed locally or ships,
every deck adopts it with zero changes. Do not substitute a random display
serif and call it Geist.

Type rules: headlines tight (`letter-spacing:-0.04em` or tighter, line-height
~1.0), eyebrows mono uppercase tracked `0.18em`, body never below 15px at
deck scale, tabular numbers for counters and data.

## 4. Motion — the Motion library

Animations run on **Motion** (motion.dev, the Framer Motion successor) via CDN:
`https://cdn.jsdelivr.net/npm/motion@11.11.17/dist/motion.js`
(global `Motion`: `animate`, `inView`, `scroll`, `stagger`). No other
animation library. CSS transitions only for button hovers.

Sanctioned motion patterns — these four, nothing decorative:
1. **Scene entrance** — on first view, the scene's children rise 24px and
   fade in, staggered 0.08s, 0.6s, ease `[0.22, 1, 0.36, 1]`. Fires once.
2. **Diagram builds** — stacks, flows, and cycles assemble piece by piece on
   first view (nodes slide, connectors draw by scaleY, arrows fade last).
3. **Counters** — numbers count with `animate(0, target)` when a data scene
   enters; tabular mono so nothing jitters.
4. **Replayable simulations** — a scene whose point is a process (the loop
   cycling, a message lifecycle) gets a Replay control; `R` replays the
   active scene. Simulations loop their highlight, never their layout.

Rules: nothing moves while Chase is mid-sentence unless he triggered it;
`prefers-reduced-motion` disables all of it (entrances render final-state);
the progress bar is driven by Motion's `scroll()` and is white, 2px.
Pointer-driven affordances — button hovers, and `<deck-chat>`'s pointer-
tracking phone tilt — are interactions (the presenter is driving them), not
auto-motion, and are allowed; they are also disabled under reduced motion.

**The progressive beat (Chase's call, 16 Oct 2026).** Every automated
sequence that steps through items one by one — a cycle highlighting its
nodes in turn, badges lighting up in sequence, word tiles landing, machine
parts installing — uses the SAME step interval everywhere, declared once
in the deck as `const BEAT = 900` (milliseconds). No scene may hardcode
its own step value; if the pacing ever changes, it changes in that one
constant and changes everywhere. The deck publishes that one value as
`window.DECK_BEAT`; components read it rather than declaring their own step, so
a sequence that crosses the deck/component boundary stays on the same beat. The
80ms entrance stagger and the
scoreboard counter's total duration are not progressive sequences and are
exempt.

## 5. Presenter machinery (inherited from the supplied deck, kept)

- Fixed top bar: brand (series / video), scene counter `01 / 10`
  (zero-padded `NN / NN`, total = the deck's scene count), Speaker
  cues toggle, Prev / Next.
- Speaker cues panel: per scene — time range, segment title, and the talk
  track (condensed from the video script; the full script lives in the video
  plan, cues are what he needs at a glance).
- Keyboard: `↑/↓` or `←/→` navigate, `C` toggles cues, `R` replays the active
  scene's simulation.
- Scroll-snap scenes, IntersectionObserver-driven counter/cues, 16:9-first
  layout (design at 1920×1080; scenes are `min-height:100svh`).

## 6. Scene types (the catalogue — build from these, don't invent)

1. **Statement** — one headline, one lede. The default.
2. **Quote / Thesis** — serif, oversized, almost nothing else on screen.
3. **Word-object** — one word or object manipulated (sliced, weighed, priced).
4. **Stack** — layered architecture nodes with connectors (routing, layers).
5. **Flow** — 3–5 boxes with arrows (propose → pause → decide → execute).
6. **Cycle** — 4 nodes whose highlight rotates (the loop).
7. **Counter** — one huge mono number that counts on entry (Goodhart, funnel).
8. **Compare** — two monochrome panels, before/after, same geometry.
9. **Close** — the question the video leaves behind + what comes next.

## 7. Building a deck for a new video

1. Copy `next-token.html`; strip its scenes and `cueData`.
2. From the video plan, take one scene per script segment (merge short
   neighbours; a 26-minute video lands at 8–12 scenes, not 13+).
3. Assign each scene a type from §6. Write its visible text under the 30-word
   ceiling; put the talk track in `cueData` with the plan's timestamps.
4. Choose the deck's single semantic accent (§2) in advance — or none.
5. Run the checks: no colour outside the audit · Geist stacks on every text
   element · every diagram replays with `R` · reduced-motion renders clean ·
   counter total matches scene count.

## 8. Narrative decks — the build-order pattern (added 16 Oct 2026)

For explainer videos (a teacher laying a system out step by step), the deck
is not a sequence of illustrations; it is ONE accumulating diagram. Rules:

- A single persistent component — **the machine** — appears in every scene
  from the cold open onward, starting empty (all parts ghosted, dashed,
  "NOT YET").
- Each scene installs exactly the part(s) its script step builds. Installed
  parts stay installed, in build order, for the rest of the deck. The
  scene's new part is highlighted by white-on-black inversion (the loop-node
  device), never by a new colour.
- Parts the argument later reveals (a hidden scoreboard, a missing ledger)
  enter the stack when the script reveals them, labelled with their story
  ("WAS THERE ALL ALONG" / "USUALLY ABSENT").
- The closing scene shows the complete assembly next to the opening image.
- Script-side, the same law: steps in build order, no part introduced
  before the previous part fails to explain something, each step ending on
  the question the next step answers. The reference build is
  `next-token.html` v2 with plan v2 (goal: first-episode flagship).

## 9. Components — the library, and the conversation rule (added 16 Oct 2026)

Reusable scene pieces live as real web components in
`components/` (`deck.css` + one JS file per
component). This exists so agents never hand-roll a styled element: **if a
component exists for it, use the component as-is; if a needed piece doesn't
exist, add it to the library first, then use it.** Components are light DOM
on purpose — they inherit the deck's tokens and Geist stacks, so they cannot
drift off-system. Decks include them with two tags:
`<link rel="stylesheet" href="components/deck.css">` and
`<script src="components/<name>.js"></script>`.

**The conversation rule (Chase's call, 16 Oct 2026; the component became the
phone, 17 Oct 2026).** Any example that is a conversation — a user/model
exchange, a dialogue, a chat transcript, a support thread — MUST be rendered
with the `<deck-chat>` component. Never as a headline quote, a bullet list, or
prose. `<deck-chat>` is a phone conversation whose messages animate on the
progressive beat (§4).

Children, in order: `<chat-in>` (incoming, left), `<chat-out>` (outgoing,
right), `<chat-think>` (a 2-beat thinking bubble). An outgoing message animates
its lifecycle: `state="confirmed"` does optimistic → *Sending…* → its `at`
timestamp; `state="sending"` holds pending; `state="lost"` appears then
disappears; `state="failed"` looks sent then fails (the signal flips OFFLINE).
`<chat-msg from="ai">` / `<chat-msg from="user">` remain as aliases. The
component autoplays in view and replays via `.replay()` / the deck's `R` key;
reduced-motion renders the final state immediately.

```html
<deck-chat title="THE MODEL" label="A CONVERSATION" meta="THE GOTCHA">
  <chat-out>How many Rs are in "strawberry"?</chat-out>
  <chat-think></chat-think>
  <chat-in>2</chat-in>
  <chat-out>You can't count!</chat-out>
</deck-chat>

<!-- the message lifecycle: optimistic → Sending… → confirmed at 10:42 -->
<deck-chat title="Care chat" signal="ONLINE">
  <chat-in>How can I help today?</chat-in>
  <chat-out state="confirmed" at="10:42">I need to change my address</chat-out>
</deck-chat>
```

Library so far: `deck-chat` (conversations and message lifecycles, as a phone).
Candidates as scenes need them: loop, stack, scoreboard, machine panel —
extracted from the reference deck the same way, never forked per deck.

## 10. The stage and the component inventory (added 17 Oct 2026)

**The problem this closes.** Every deck had been copying ~120 lines of
identical shell — tokens, nav, the cues panel, the presenter JS, the entrance
reveal — plus a bespoke `replayActive()` routing chain. Three decks were three
copies of the same file. §9's rule ("use the component as-is; if it doesn't
exist, add it first") now applies to the shell itself.

**Two tiers.** A deck is now *scenes + cues + its own build functions*. Everything
identical in every presentation lives in the library.

### Tier 1 — the stage (every deck, always)

`<deck-stage>` (`components/deck-stage.js`) wraps a deck's scenes and owns:

- the chrome — accent mark, `brand`/`series`, the zero-padded `NN / NN`
  counter, prev/next, the speaker-cues toggle, the white 2px progress bar;
- the keyboard — `↑/↓ ←/→`, `R` replay, `C` cues;
- the scene `IntersectionObserver`;
- the entrance reveal (§4 pattern 1, fires once) and the reduced-motion final
  state — in one place;
- the ONE progressive beat, published as `window.DECK_BEAT` (§4). Decks and
  components read it; nobody redeclares it;
- the URL hash — every scene is a shareable link (`…#s3`, or any scene `id`).
  The stage writes the current scene's id as you move and opens at a pasted
  hash (scenes are given a fallback id if the deck did not set one).

Attributes: `brand`, `series`, `beat` (ms, default 900), `mark="false"` to drop
the accent mark. Scenes are **direct children**; one `<deck-cue>` per scene, in
document order, carries the talk track (`time`, `title`, inner text) that used
to be a per-deck `cueData` array.

**The build-button law.** A scene's build animation is defined by its own
`[data-replay]` button — the same control the presenter sees. The stage clicks
it on first view (so the scene assembles as it enters) and again on `R`. A deck
therefore writes no navigation, no observers, and no replay router: it writes
play functions and wires them to its buttons.

```html
<deck-stage brand="THE TOOL CALL" series="EPISODE 02 — THE CONTRACT">
  <deck-cue time="STEP 0 · 00:00" title="The gap">Open on the mistake…</deck-cue>
  <section class="scene" id="s1">…</section>
</deck-stage>
<script src="components/deck-stage.js"></script>
<script>/* this deck's play functions + [data-replay] wiring only */</script>
```

### Shared CSS — `components/deck.css`

deck.css now carries the tokens (`:root`), the base (`html`/`body`), the whole
scene frame and base typography (`.scene`, `.scene-inner`, `.eyebrow`, `h1`/`h2`,
`.serif`, `.lede`, `.layout`, `.diagram`, `.dlabel`, `.note`, `.finish`,
`.replay`, `.scrollcue`), the entrance `.rise`, the cue panel, and the stage
chrome. A deck's inline `<style>` holds **only its scene primitives** — the
diagram classes for the scenes it actually uses.

### Tier 2 — scene primitives (the inventory)

Map §6's catalogue to components as scenes need them. Shipped so far:

| Component | Scene type (§6) | Status |
|---|---|---|
| `<deck-stage>` | the shell | shipped (§10) |
| `<deck-icon>` | icons | shipped (§10) |
| `<deck-chat>` | conversation / message lifecycle | shipped (§9) |

**Icons (added 17 Oct 2026).** There is no icon font and no runtime icon CDN.
Every icon is `<deck-icon name="…">` — Lucide geometry inlined by
`deck-icon.js`. Icons are stroke-set, `currentColor`, sized to `1em`, so they
take the deck's ink/greys and sit on the type scale; they can never introduce a
hue or a second visual language. To add one, copy its children from
`lucide-static/icons/<name>.svg` into the component's `ICONS` registry. A deck
never inlines raw SVG or a glyph for a real icon.

Proposed, extracted on first reuse — in priority order:

| Component | Scene type | Replaces | Used by |
|---|---|---|---|
| machine panel + part | accumulating build (§8) | `.machine`/`.mpart` | both narrative decks |
| `<deck-stack>` | Stack | `.stack`/`.node`/`.connector` | routing, decisions, rejections |
| `<deck-flow>` | Flow | `.flow`/`.flowbox`/`.flowarr` | propose→pause→decide→execute |
| `<deck-chips>` | sequence / badges | `.badges`/`.badge` | failure classes, badges |
| `<deck-compare>` | Compare | `.cols`/`.col` | before/after, exemption |
| `<deck-code>` | code / plan object | `.code` | plan, dependency, guard |
| `<deck-verdict>` | gate (the semantic accent) | `.verdict`/`.v` | tool guard, confirmation episode |
| `<deck-counter>` | Counter | `.bignum`/`.jobbar` | Goodhart, evals |
| `<deck-cycle>` | Cycle | `.loop`/`.loopnode` | the loop, capability flywheel |
| `<deck-tiles>` | Word-object | `.tiles`/`.tile` | token slicing |
| `<deck-funnel>` | — | `.funnel`/`.frow` | election, evals |
| `<deck-grid>` | — | `.blocks`/`.block` | owners, four decisions |
| `<deck-trace>` | — (new) | — | tool-call trace, eval trace, observability |
| `<deck-phone>` / message | message lifecycle | `.phone`/`.bubble`/`.composer` | the supplied deck |

Rule for tier 2: when a primitive appears in a **second** deck, extract it into
the library — never let a third copy exist. Next extractions: the machine panel
(already in two decks), then stack, flow, chips.

### What is NOT a component

Headlines, ledes, notes, the accent *choice*, cue text, and one-off layouts stay
in the deck — they are per-deck writing, not shared behaviour. A component per
headline is over-abstraction; a component per diagram that recurs is not.

### The rules that hold it together

1. Light DOM; inherit tokens and Geist stacks (§9) — a component cannot drift.
2. One `BEAT`, owned by the stage, read everywhere (§4).
3. Every animated piece exposes a `[data-replay]` button; the stage wires `R`.
4. Reduced motion renders every scene's final state, from one place.
5. Colour lives only in accent-sanctioned components (§2) and the stage's mark —
   enforced by the component boundary, not by the audit comment alone.

## 11. Repo layout and build (added 17 Oct 2026)

Each presentation is its own page, built by Astro. The shell is shared; a deck
file is cues + scenes + build functions, nothing else.

- **`decks.json`** — the series manifest (slug, title, brand, series, accent,
  `migrated`). One source for the index page, the checks and the video pipeline.
- **`src/layouts/Deck.astro`** — the head (fonts, favicon, `components/deck.css`,
  the vendored Motion) and the `<deck-stage>` wrapper. A deck supplies
  `<style slot="head">` (its scene primitives) and `<script slot="script">`
  (its build functions).
- **`src/pages/<slug>.astro`** — one page per presentation; `index.astro` is the
  series index.
- **`components/`** — the canonical library, **not owned by Astro**. A config
  hook mirrors it to `public/components` (dev) and `dist/components` (build).

Commands: `npm run dev` · `npm run build` · `npm run preview`.

Rules:
1. New decks are Astro pages. A deck never repeats the head or the
   `<deck-stage>` wrapper — that is `Deck.astro`'s job.
2. The component library lives in `components/`; never fork it into a deck.
3. The published site is a **superset** — Astro pages plus any not-yet-migrated
   root `*.html` decks (copied into `dist/` by the same hook), so migrating one
   deck at a time never drops a live URL.
4. The base path is `/soapbox` (Pages project site). Build asset URLs from
   `import.meta.env.BASE_URL`; never hardcode a leading `/`.

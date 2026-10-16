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

- Fixed top bar: brand (series / video), scene counter `01 / 09`, Speaker
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

**The conversation rule (Chase's call, 16 Oct 2026).** Any example that is a
conversation — a user/model exchange, a dialogue, a chat transcript, a
support thread — MUST be rendered with the `<deck-chat>` component. Never
as a headline quote, a bullet list, or prose. Sequence: messages reveal one
per progressive beat (§4); a `<chat-think>` step shows the thinking bubble
for 2 beats before the model's answer lands; the component autoplays in
view and replays via `.replay()` / the deck's `R` key; reduced-motion shows
the full transcript immediately.

```html
<deck-chat label="A CONVERSATION" meta="THE GOTCHA">
  <chat-msg from="user">How many Rs are in "strawberry"?</chat-msg>
  <chat-think></chat-think>
  <chat-msg from="ai">2</chat-msg>
  <chat-msg from="user">You can't count!</chat-msg>
</deck-chat>
```

Library so far: `deck-chat` (conversations). Candidates as scenes need them:
loop, stack, scoreboard, machine panel — extracted from the reference deck
the same way, never forked per deck.

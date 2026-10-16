# Soapbox — the YouTube Slide System

The standard slide system for all of Chase's YouTube videos — full-screen
HTML scenes the presenter talks over. Black & white, Geist, Motion library.

- **`SYSTEM.md`** — the spec: design law, accent law, typography, motion
  patterns + the progressive beat, presenter machinery, scene catalogue,
  the narrative build-order pattern, and the component/conversation rules.
  Read this first.
- **`next-token.html`** — the reference deck (flagship video, narrative v2).
  Every new deck starts as a copy of this file. Open it in a browser and
  scroll; `C` toggles speaker cues, `R` replays the active scene.
- **`components/`** — the reusable web-component library (`deck.css` +
  `deck-chat.js`). Conversation-style examples must use `<deck-chat>`;
  see SYSTEM.md §9.

Published deck: https://charlesponti.github.io/soapbox/next-token

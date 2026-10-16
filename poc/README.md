# Sync PoC — slides that perform themselves, in time with the narration

Proves the Soapbox production pipeline: a deck scene advances its own
animations on a timing manifest derived from the narration audio, is
captured in a browser, and is muxed with the audio into a video — no human
presenting, no manual sync.

Built and verified 16 Oct 2026 (Wyatt's VM). Reference output: a 46-second
clip of scene 2 ("Its Eyes") where the STRAWBERRY → straw/ber/ry slice
animation fires exactly under the spoken line "'Strawberry' comes apart
into three pieces".

## How it works

1. **Timing by construction.** The narration is synthesized in
   sentence-level chunks. Each chunk's duration is *measured* (ffprobe), so
   cumulative offsets give the exact start time of every line
   (`manifest.json`). The map cannot drift, because the final audio is
   assembled from those same chunks.
2. **The stage deck.** `../stage-poc.html` is `next-token.html` with two
   surgical changes: scene 2's autoplay is suppressed, and a stage driver
   (`window.__pocStart`) jumps to the scene and fires `playSlices()` at the
   manifest offset (17.832s). Driver timing landed within 4ms of target.
3. **Capture + mux.** `capture.mjs` drives headless Chrome over CDP,
   screenshot-records the performance with wall-clock timestamps, and the
   frames are assembled with ffmpeg (concat demuxer, per-frame durations)
   and muxed with the narration.

## Run it

Prereqs: Node 20+, ffmpeg, a Chrome/Chromium binary (`CHROME_BIN` env var
if it isn't in a standard location). No network needed — Motion is vendored
at `../components/motion-11.11.17.js` (headless Chrome in the test VM could
not reach the CDN; local is the repeatable choice anyway).

```bash
node poc/capture.mjs          # writes poc/frames/ (frames.json + JPEGs)
# assemble (durations come from frames.json) and mux with poc/step1-audio.mp3
# — see the ffmpeg concat pattern in the session notes; a build script is
# the obvious next step when this graduates from PoC to pipeline.
```

Narration chunks for the reference run live in `audio/` (`c1`–`c5.mp3`,
concatenated into `step1-audio.mp3`).

## Findings (measured, not vibes)

- **Real-time capture in the test VM caps at ~10–14fps** by both CDP
  methods: screenshot loop ≈11–14fps; `capture60.mjs` (screencast probe)
  ≈10–12fps during motion, median frame interval 119ms. That VM has 2
  cores and software rendering. **On a GPU machine this cap does not
  apply** — and the deterministic alternative below removes it entirely.
- **The route to guaranteed 60fps is frame-stepping** (Chrome virtual
  time, the Remotion method): set the page clock to frame N's exact
  timestamp, screenshot, advance. Frame-exact at any fps, zero jitter,
  ~90ms/frame at 1600×900 in the VM; parallelizes across cores.
- **Write script lines for the ear.** The TTS read the bare token IDs
  "1082. 497. 831." digit-by-digit with dramatic pauses — one chunk
  ballooned to 68s. The deck shows the numbers; the narration doesn't need
  to recite them. The shipped chunk drops the recital.
- Deck animations are discrete JS functions (`playSlices`, `startLoop`,
  `playScore`, `playBadges`, chat `replay`) on the shared `BEAT` — the deck
  was already steppable; the stage driver is a small addition, not a fork.

## Next steps toward production

- Generalize the driver from one cue to a full event timeline (all scenes).
- A `build.mjs` that takes a script + manifest and emits the finished MP4
  in one command (chunk render → measure → stage → step/capture → mux).
- Apply to the 7-scene YouTube re-cut of the deck.

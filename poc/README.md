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
   manifest offset (17.832s; injected from `manifest.json` by the capture
   scripts, with that value only as a standalone fallback). Driver timing landed
   within 4ms of target.
3. **Capture + mux.** `capture.mjs` drives headless Chrome over CDP,
   screenshot-records the performance with wall-clock timestamps, and the
   frames are assembled with ffmpeg (concat demuxer, per-frame durations)
   and muxed with the narration.

## Run it

Prereqs: Node 20+, ffmpeg, a Chrome/Chromium binary (`CHROME_BIN` env var if it
isn't in a standard location). No network needed — Motion is vendored at
`../components/motion-11.11.17.js` (headless Chrome in the test VM could not
reach the CDN; local is the repeatable choice anyway).

Both capture scripts read the cue offset from `manifest.json` and inject it into
`stage-poc.html`'s driver, so the timing lives in exactly one place.

```bash
node poc/capture.mjs            # writes poc/frames/ (frames.json + JPEGs)
node poc/capture60.mjs          # screencast probe: measures during-motion fps
# assemble (durations come from frames.json) and mux with poc/step1-audio.mp3
# — see the ffmpeg concat pattern in the session notes; a build script is
# the obvious next step when this graduates from PoC to pipeline.
```

`POC_SLEEP_MS` tunes the screenshot loop's inter-frame pause (default 30; `0`
roughly doubles throughput).

Narration chunks for the reference run (`c1`–`c5.mp3`, concatenated into
`step1-audio.mp3`) and the proof MP4 are media, so they are NOT in git —
they live in Wyatt's workspace (`youtube-slide-system/poc/`) and regenerate
from the episode script in `../..`-adjacent goal files. The manifest above
is the durable artifact: re-render the five lines, measure, and the offsets
must match it.

## Findings (measured, not vibes)

- **Two things — not the GPU — were capping the committed scripts** (measured
  16 Oct 2026 on a GPU Mac, Chrome 155, 1600×900):
  1. **Renderer backgrounding.** Chrome throttles a page it treats as
     backgrounded/occluded. With the original flags `capture60.mjs`'s screencast
     captured **zero frames during the slice animation** — the one thing it
     exists to measure. The standard anti-throttling flags
     (`--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`,
     `--disable-background-timer-throttling`,
     `--disable-features=CalculateNativeWinOcclusion`) fix it. (The
     `--disable-frame-rate-limit` / `--disable-gpu-vsync` /
     `--run-all-compositor-stages-before-draw` trio that early experiments
     added actually *starves* the headless screencast — it is not in the fixed
     script.)
  2. **A needless `sleep(30)` in the screenshot loop.** Each
     `Page.captureScreenshot` is a synchronous CDP round-trip (~40ms here) and
     the sleep adds on top: 30ms → **~14fps**, 0ms → **~24fps** (`POC_SLEEP_MS=0`).
- **Measured on this GPU Mac:** screenshot loop ≈14fps (≈24fps with the sleep
  removed); screencast ≈**34fps average / 61fps peak during motion** once
  un-throttled. The earlier VM figure — "≈11–14fps by both methods, and a GPU
  machine lifts the cap" — was **throttling, misread as a hardware limit**: the
  GPU does lift it, and the caps were in the flags.
- **Screencast is damage-driven, so its cadence follows the content.** It emits
  frames only when the page repaints and none while the deck is idle — bursty
  and non-uniform (dense during a build, silent between). The screenshot loop is
  uniform but round-trip-bound.
- **A guaranteed, uniform 60fps still means frame-stepping** (Chrome virtual
  time, the Remotion method): set the page clock to frame N's exact timestamp,
  screenshot, advance. Frame-exact at any fps, zero jitter, ~90ms/frame at
  1600×900 in the VM; parallelizes across cores. Real-time capture now gets
  *close* on a fast machine, but only frame-stepping is deterministic — and for
  a recorded master that is what you want.
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

// Soapbox sync PoC — screencast probe (diagnostic, the 60fps question).
// Loads stage-poc.html (repo root) in headless Chrome, starts the stage
// timeline, and records the CDP screencast frame stream. Reports how many
// frames actually land DURING the "Its Eyes" slice animation — the number that
// matters, because screencast is damage-driven and stalls whenever the page is
// not producing fresh frames.
//
// Measured note (16 Oct 2026, GPU Mac, Chrome 155): without the
// anti-throttling flags below, Chrome background-throttles the renderer and
// this probe captures ZERO frames during the slice animation; with them it
// captures ~34fps average / ~61fps peak during motion. See poc/README.md.
//
// Prereqs: Node 20+, a Chrome/Chromium binary. Set CHROME_BIN if yours is
// not in a standard location.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const POC = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(POC);
const STAGE = 'file://' + join(ROOT, 'stage-poc.html');
const PORT = 9334;
const CANDIDATES = [
  process.env.CHROME_BIN,
  '/opt/meta-chromium/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome', 'chromium', 'chromium-browser',
].filter(Boolean);
const CHROME = CANDIDATES.find(c => c.includes('/') ? existsSync(c) : true);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The cue the PoC scene animates on — single-sourced from the durable timing
// artifact (poc/manifest.json), same as capture.mjs. No hand-synced numbers.
const manifest = JSON.parse(readFileSync(join(POC, 'manifest.json'), 'utf8'));
const sliceAtMs = Math.round(manifest.find(m => m.chunk === 'c3.mp3').start * 1000);
const doneAtMs = Math.round(manifest.find(m => m.total != null).total * 1000) + 1500;

const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/pocchrome60', '--window-size=1600,900',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--mute-audio',
  // Do NOT let Chrome throttle a background/occluded window: that is exactly
  // what starves the screencast of frames during the animation. (Note: the
  // --disable-frame-rate-limit / --disable-gpu-vsync /
  // --run-all-compositor-stages-before-draw trio, used in early experiments,
  // actually starves the headless screencast — leave it out.)
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
  'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = L.find(t => t.type === 'page'); } catch (e) {}
    if (!target) await sleep(300);
  }
  if (!target) throw new Error('no page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const frames = []; let loadFired = false;
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Page.screencastFrame') { frames.push(m.params.metadata.timestamp);
      send('Page.screencastFrameAck', { sessionId: m.params.sessionId }); }
    else if (m.method === 'Page.loadEventFired') { loadFired = true; } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: STAGE });
  for (let i = 0; i < 40 && !loadFired; i++) await sleep(250);
  let motion = false; for (let i = 0; i < 20 && !motion; i++) { motion = await evaluate('!!window.Motion'); if (!motion) await sleep(500); }
  console.log('Motion:', motion);
  await send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1600, maxHeight: 900, everyNthFrame: 1 });
  await sleep(300);
  console.log('start ->', await evaluate(`window.__pocStart(${JSON.stringify({ sliceAtMs, doneAtMs })})`));
  for (let i = 0; i < 50; i++) { await sleep(1000); if (await evaluate('window.__marks.done||0')) break; }
  await sleep(1000);
  await send('Page.stopScreencast');
  const marks = await evaluate('window.__marks');
  console.log('marks:', JSON.stringify(marks));
  console.log('total screencast frames:', frames.length);
  if (frames.length > 2) {
    const sliceRel = (marks.sliceCalled - marks.t0) / 1000;
    const t0 = frames[0], ts = frames.map(t => t - t0).sort((a, b) => a - b);
    const span = ts[ts.length - 1];
    let best = 0, bestAt = 0;
    for (let i = 0; i < ts.length; i++) { let c = 1; for (let j = i + 1; j < ts.length && ts[j] - ts[i] <= 1; j++) c++; if (c > best) { best = c; bestAt = ts[i]; } }
    const inSlice = ts.filter(t => t >= sliceRel && t <= sliceRel + 2).length;
    console.log('span s:', span.toFixed(2), '| overall fps:', (frames.length / span).toFixed(1));
    console.log('during-motion: peak', best, 'fps in any 1s window (at', bestAt.toFixed(1) + 's)',
      '| slice window (2s):', inSlice, 'frames ≈', (inSlice / 2).toFixed(1), 'fps');
  }
} finally { try { ws && ws.close(); } catch (e) {} chrome.kill('SIGKILL'); }

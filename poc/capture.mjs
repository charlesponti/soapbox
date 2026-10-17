// Soapbox sync PoC — real-time capture driver.
// Loads stage-poc.html (repo root) in headless Chrome, starts the stage
// timeline (window.__pocStart), and records the performance as a folder of
// timestamped JPEG frames (frames/frames.json + fNNNNN.jpg). Assemble with
// ffmpeg per poc/README.md.
//
// Prereqs: Node 20+, a Chrome/Chromium binary. Set CHROME_BIN if yours is
// not in a standard location. On a GPU machine you can also drive a headed
// browser the same way — the CDP calls are identical.
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const POC = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(POC);
// Target page: the bespoke stage-poc.html by default, or any built deck opened
// with ?stage (Phase 4). Drive a built deck with:
//   POC_URL='http://localhost:4321/soapbox/next-token/?stage' \
//   POC_OPTS='{"scene":"s2","atMs":17832,"doneAtMs":46500}' node poc/capture.mjs
const URL = process.env.POC_URL || 'file://' + join(ROOT, 'stage-poc.html');
const OUT = join(POC, 'frames');
const PORT = 9333;
// Inter-frame pause. The loop is round-trip-bound (each captureScreenshot is a
// synchronous CDP call, ~40ms here); this sleep adds on top of that. Measured
// on a GPU Mac (16 Oct 2026): 30ms -> ~14fps, 0ms -> ~24fps. Override with
// POC_SLEEP_MS to trade throughput for lower CPU.
const SLEEP_MS = Number(process.env.POC_SLEEP_MS ?? 30);
// Single-source the cue offset from the durable timing artifact instead of
// hardcoding it: the slice fires on the start of chunk c3 (poc/manifest.json).
const manifest = JSON.parse(readFileSync(join(POC, 'manifest.json'), 'utf8'));
const pocOpts = process.env.POC_OPTS ? JSON.parse(process.env.POC_OPTS) : {
  sliceAtMs: Math.round(manifest.find(m => m.chunk === 'c3.mp3').start * 1000),
  doneAtMs: Math.round(manifest.find(m => m.total != null).total * 1000) + 1500,
};
const CANDIDATES = [
  process.env.CHROME_BIN,
  '/opt/meta-chromium/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome', 'chromium', 'chromium-browser',
].filter(Boolean);
const CHROME = CANDIDATES.find(c => c.includes('/') ? existsSync(c) : true);
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/soapbox-poc-chrome',
  '--window-size=1600,900', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--mute-audio',
  // Keep the renderer unthrottled so the deck's animations run at full rate
  // between captures (Chrome otherwise background-throttles the page).
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
  'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    try { const L = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = L.find(t => t.type === 'page'); } catch (e) {}
    if (!target) await sleep(300);
  }
  if (!target) throw new Error('no page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); let loadFired = false;
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Page.loadEventFired') { loadFired = true; } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id;
    pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => { const r = await send('Runtime.evaluate',
    { expression: expr, returnByValue: true }); return r.result?.result?.value; };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 40 && !loadFired; i++) await sleep(250);
  // Motion is vendored (components/motion-11.11.17.js) so no network is needed,
  // but give fonts a moment if they are reachable.
  let motion = false;
  for (let i = 0; i < 20 && !motion; i++) { motion = await evaluate('!!window.Motion');
    if (!motion) await sleep(500); }
  console.log('Motion loaded:', motion, '| fonts:', await evaluate('document.fonts.status'));

  const shots = []; const tStart = Date.now();
  console.log('start ->', await evaluate(`window.__pocStart(${JSON.stringify(pocOpts)})`));
  let done = 0, n = 0, lastPoll = 0;
  while (true) {
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const d = r.result?.data;
    if (d) { const name = `f${String(n).padStart(5, '0')}.jpg`;
      writeFileSync(join(OUT, name), Buffer.from(d, 'base64'));
      shots.push({ file: name, t: Date.now() - tStart }); n++; }
    const now = Date.now();
    if (now - lastPoll > 1500) { lastPoll = now;
      done = await evaluate('window.__marks.done||0'); if (done) break; }
    if (now - tStart > 70000) break;
    await sleep(SLEEP_MS);
  }
  writeFileSync(join(OUT, 'frames.json'), JSON.stringify(shots));
  console.log('marks:', JSON.stringify(await evaluate('window.__marks')));
  console.log('screenshots:', shots.length);
} finally { try { ws && ws.close(); } catch (e) {} chrome.kill('SIGKILL'); }

import { spawn } from 'node:child_process';
const CHROME=process.env.CHROME_BIN||'/opt/meta-chromium/chrome', PORT=9334;
const URL='file://'+new URL('../stage-poc.html', import.meta.url).pathname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn(CHROME,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  `--remote-debugging-port=${PORT}`,'--user-data-dir=/tmp/pocchrome60','--window-size=1600,900',
  '--hide-scrollbars','--force-device-scale-factor=1','--mute-audio',
  '--disable-frame-rate-limit','--disable-gpu-vsync','--run-all-compositor-stages-before-draw','about:blank'],
  {stdio:'ignore'});
let ws;
try{
  let target=null;
  for(let i=0;i<50&&!target;i++){ try{ const L=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target=L.find(t=>t.type==='page'); }catch(e){} if(!target) await sleep(300); }
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res; ws.onerror=rej;});
  let id=0; const pending=new Map(); const frames=[]; let loadFired=false;
  ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); }
    else if(m.method==='Page.screencastFrame'){ frames.push(m.params.metadata.timestamp);
      send('Page.screencastFrameAck',{sessionId:m.params.sessionId}); }
    else if(m.method==='Page.loadEventFired'){ loadFired=true; } };
  const send=(method,params={})=>new Promise(res=>{ const i=++id; pending.set(i,res);
    ws.send(JSON.stringify({id:i,method,params})); });
  const evaluate=async expr=>{ const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});
    return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:URL});
  for(let i=0;i<40&&!loadFired;i++) await sleep(250);
  let motion=false; for(let i=0;i<20&&!motion;i++){ motion=await evaluate('!!window.Motion'); if(!motion) await sleep(500); }
  console.log('Motion:', motion);
  await send('Page.startScreencast',{format:'jpeg',quality:70,maxWidth:1600,maxHeight:900,everyNthFrame:1});
  await sleep(300);
  console.log('start ->', await evaluate('window.__pocStart()'));
  let done=0; for(let i=0;i<20&&!done;i++){ await sleep(2000); done=await evaluate('window.__marks.sliceCalled||0'); } await sleep(5000);
  await send('Page.stopScreencast');
  console.log('marks:', JSON.stringify(await evaluate('window.__marks')));
  console.log('total screencast frames:', frames.length);
  if(frames.length>2){
    const t0=frames[0], span=frames[frames.length-1]-t0;
    console.log('span s:', span.toFixed(2), '| overall fps:', (frames.length/span).toFixed(1));
    // bucket frames per 0.5s of elapsed screencast time; report the busiest buckets
    const buckets={};
    frames.forEach(t=>{ const b=Math.floor((t-t0)*2)/2; buckets[b]=(buckets[b]||0)+1; });
    const top=Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0,6);
    console.log('busiest 0.5s buckets [start_s, frames, fps]:', top.map(([s,c])=>[s, c, c*2]));
    const gaps=[]; for(let i=1;i<frames.length;i++) gaps.push(frames[i]-frames[i-1]);
    gaps.sort((a,b)=>a-b);
    console.log('median frame interval ms:', (gaps[Math.floor(gaps.length/2)]*1000).toFixed(1));
  }
} finally { try{ws&&ws.close()}catch(e){} chrome.kill('SIGKILL'); }

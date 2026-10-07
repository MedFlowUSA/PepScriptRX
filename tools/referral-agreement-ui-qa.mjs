import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
const browserPath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!browserPath) throw new Error('Chrome or Edge is required.');
const output = resolve('artifacts/referral-agreements');
mkdirSync(output, { recursive: true });
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9741', `--user-data-dir=${resolve('node_modules/.cache/referral-browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let target;
  for (let i = 0; i < 40; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9741/json')).json()).find(x => x.type === 'page'); } catch { /* browser starting */ }
    if (target) break;
    await new Promise(r => setTimeout(r, 250));
  }
  if (!target) throw new Error('Browser failed to start.');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { resolve: done, reject, timer } = pending.get(m.id); clearTimeout(timer); pending.delete(m.id); if (m.error) reject(m.error); else done(m.result); }
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((done, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: done, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  // This QA never contacts Auth, sends a code, or writes to the production backend.
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*supabase.in*'] });
  for (const [label, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await send('Page.navigate', { url: `${base}/referral-agreement/00000000-0000-0000-0000-000000000000#token=qa-not-real` });
    let text = '';
    for (let i = 0; i < 40; i++) {
      text = await evaluate('document.body.innerText');
      if (text?.includes('Send verification code')) break;
      await new Promise(r => setTimeout(r, 250));
    }
    assert.match(text, /Private referral agreement/, JSON.stringify({ exceptions, url: await evaluate('location.href'), html: await evaluate('document.body.innerHTML.slice(0,1000)') }));
    assert.ok(!text.includes('50%') && !text.includes('Parties:'));
    assert.equal(await evaluate('document.querySelector(\'meta[name="robots"]\').content'), 'noindex,nofollow,noarchive');
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(output, `signing-${label}.png`), Buffer.from(shot.data, 'base64'));
  }
  await send('Page.navigate', { url: `${base}/admin/referral-agreements` });
  let path;
  for (let i = 0; i < 40; i++) {
    path = await evaluate('location.pathname');
    if (path === '/login') break;
    await new Promise(r => setTimeout(r, 250));
  }
  assert.equal(path, '/login');
  assert.deepEqual(exceptions, []);
  console.log('Desktop/mobile signing privacy, no overflow, noindex, and unauthenticated admin redirect passed. No email sent.');
} finally { ws?.close(); browser.kill(); }

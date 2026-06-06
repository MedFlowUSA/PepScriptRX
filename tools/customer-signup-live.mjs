import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app';
const OUT = resolve('qa-artifacts');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9722 + Math.floor(Math.random() * 300);
mkdirSync(OUT, { recursive: true });

const email = `qa.customer.${Date.now()}@gmail.com`;
const password = `QaPass${Date.now()}!`;
const browser = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.qa-edge-profile-customer')}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let ws;
let id = 0;
const pending = new Map();
const result = { email, startedAt: new Date().toISOString() };

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      payload.error ? reject(new Error(JSON.stringify(payload.error))) : resolve(payload.result);
    }
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `${BASE}/patient/signup?brand=aactivated` });
  await sleep(1400);
  await evalPage((values) => {
    const inputs = [...document.querySelectorAll('input')];
    const [name, phone, emailInput, passwordInput] = inputs;
    const set = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    };
    set(name, values.name);
    set(phone, values.phone);
    set(emailInput, values.email);
    set(passwordInput, values.password);
    document.querySelector('button[type="submit"], button')?.click();
  }, { name: 'QA Customer Test', phone: '5555550100', email, password });
  await sleep(6000);
  Object.assign(result, await evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    title: document.title,
    text: document.body.innerText.slice(0, 600),
  })));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(OUT, 'customer-signup-live-result.png'), Buffer.from(shot.data, 'base64'));
} finally {
  result.finishedAt = new Date().toISOString();
  writeFileSync(resolve(OUT, 'customer-signup-live-result.json'), JSON.stringify(result, null, 2));
  ws?.close();
  browser.kill();
  console.log(JSON.stringify(result, null, 2));
}

async function evalPage(fn, arg) {
  const expression = `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

function send(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(callId, { resolve, reject });
    setTimeout(() => {
      if (pending.has(callId)) {
        pending.delete(callId);
        reject(new Error(`Timed out waiting for ${method}`));
      }
    }, 15000);
  });
}

async function waitForJson(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(250);
  }
  throw new Error(`Could not connect to browser at ${url}`);
}

async function waitForPageTarget() {
  for (let i = 0; i < 40; i++) {
    const targets = await waitForJson(`http://127.0.0.1:${PORT}/json`);
    const page = targets.find((target) => target.type === 'page');
    if (page?.webSocketDebuggerUrl) return page;
    await sleep(250);
  }
  throw new Error('Could not find page target');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

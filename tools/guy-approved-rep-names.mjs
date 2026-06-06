import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app';
const EMAIL = process.env.GUY_ADMIN_EMAIL;
const PASSWORD = process.env.GUY_ADMIN_PASSWORD;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = resolve('.qa-edge-profile-guy-list');
const PORT = 9555 + Math.floor(Math.random() * 500);
if (!EMAIL || !PASSWORD) throw new Error('Set GUY_ADMIN_EMAIL and GUY_ADMIN_PASSWORD.');

const browser = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let ws;
let id = 0;
const pending = new Map();

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', (message) => {
    const payload = JSON.parse(message.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolve(payload.result);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await goto('/login?portal=admin');
  await setInput('input[type="email"]', EMAIL);
  await setInput('input[type="password"]', PASSWORD);
  await clickByText('Sign In');
  await sleep(2000);
  await goto('/admin/rep-requests');
  await sleep(1200);
  await clickByText('Approved Reps');
  await sleep(1000);
  const result = await evalPage(() => {
    const listText = [...document.querySelectorAll('.card, .card-body, tr, button')]
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
    const wanted = ['Wendy', 'Kaylee', 'Caylee', 'Poway', 'Powers', 'Juwan', 'Billy', 'William'];
    return {
      matches: wanted.filter((name) => listText.toLowerCase().includes(name.toLowerCase())),
      excerpt: listText.slice(0, 2200),
    };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  ws?.close();
  browser.kill();
  await sleep(500);
  rmSync(PROFILE, { recursive: true, force: true });
}

async function setInput(selector, value) {
  return evalPage(({ selector, value }) => {
    const input = document.querySelector(selector);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input?.dispatchEvent(new Event('change', { bubbles: true }));
  }, { selector, value });
}

async function clickByText(text) {
  return evalPage((needle) => {
    const exact = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const el = [...document.querySelectorAll('button, a')]
      .find((node) => exact(node.textContent).toLowerCase().includes(String(needle).toLowerCase()));
    el?.click();
    return Boolean(el);
  }, text);
}

async function goto(path) {
  await send('Page.navigate', { url: path.startsWith('http') ? path : `${BASE}${path}` });
  await sleep(1400);
}

async function evalPage(expression, arg) {
  const source = typeof expression === 'function'
    ? `(${expression.toString()})(...${JSON.stringify(arg === undefined ? [] : [arg])})`
    : expression;
  const result = await send('Runtime.evaluate', { expression: source, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const nextId = ++id;
    pending.set(nextId, { resolve, reject });
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });
}

async function waitForPageTarget() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const pages = await res.json();
      const target = pages.find((page) => page.type === 'page');
      if (target) return target;
    } catch {}
    await sleep(250);
  }
  throw new Error('Timed out waiting for Edge CDP target.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

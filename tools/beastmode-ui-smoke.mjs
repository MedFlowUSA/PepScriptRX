import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const BROWSER_PATH = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9800 + Math.floor(Math.random() * 400);
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'pepscriptrx-beastmode-'));
const summary = {
  base: BASE,
  checkedAt: new Date().toISOString(),
  checks: [],
  consoleErrors: [],
  warnings: [],
};

if (!BROWSER_PATH) {
  summary.warnings.push('No supported Chrome/Edge browser found. Promo browser check skipped.');
  finish(1);
}

const browser = spawn(BROWSER_PATH, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
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
  ws.addEventListener('message', onMessage);
  await onceOpen(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await setViewport(1365, 900);

  await runEligibleProductCheck();
  await runWrongProductCheck();
} finally {
  ws?.close();
  browser.kill();
  await removeProfileDir();
}

finish(hasFailures() ? 1 : 0);

async function runEligibleProductCheck() {
  await goto('/start');
  await clickProductCard('Wolverine');
  await setPromo('beastmode');
  const state = await pageState();
  const text = state.visibleText.replace(/\s+/g, ' ');
  record('main Wolverine BEASTMODE checkout', (
    /BEASTMODE applied — Wolverine Stack is now \$99\./.test(text)
    && /Subtotal\s+\$149\.00/.test(text)
    && /Promo adjustment \(BEASTMODE\)\s+-\$50\.00/.test(text)
    && /Checkout total before shipping\s+\$99\.00/.test(text)
  ), text);
}

async function runWrongProductCheck() {
  await goto('/start');
  await clickProductCard('Semaglutide');
  await setPromo('BeastMode');
  const state = await pageState();
  const text = state.visibleText.replace(/\s+/g, ' ');
  record('wrong product BEASTMODE rejection', (
    /BEASTMODE only applies to Wolverine Stack\./.test(text)
    && !/Promo adjustment \(BEASTMODE\)/.test(text)
  ), text);
}

function record(label, ok, text) {
  summary.checks.push({
    label,
    ok,
    sample: text.slice(0, 220),
  });
}

async function clickProductCard(needle) {
  const ok = await evalPage((text) => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const button = [...document.querySelectorAll('button.product-select-card, button')]
      .find((node) => normalize(node.textContent).toLowerCase().includes(text.toLowerCase()));
    if (!button) return false;
    button.click();
    return true;
  }, needle);
  if (!ok) throw new Error(`Could not find product card containing ${needle}`);
  await sleep(700);
}

async function setPromo(code) {
  const ok = await evalPage((nextCode) => {
    const input = [...document.querySelectorAll('input')]
      .find((node) => /promo code/i.test(node.closest('.form-group')?.textContent || '') || /promo/i.test(node.placeholder || ''));
    if (!input) return false;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, nextCode);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextCode }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const card = input.closest('.card') || document;
    const button = [...card.querySelectorAll('button')].find((node) => /apply/i.test(node.textContent || ''));
    if (!button) return false;
    button.click();
    return true;
  }, code);
  if (!ok) throw new Error('Could not apply promo code');
  await sleep(700);
}

async function goto(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  await send('Page.navigate', { url });
  await sleep(1200);
}

async function pageState() {
  return await evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    title: document.title,
    visibleText: document.body.innerText || '',
  }));
}

async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
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
      if (!pending.has(callId)) return;
      pending.delete(callId);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 15000);
  });
}

function onMessage(message) {
  const payload = JSON.parse(message.data);
  if (payload.id && pending.has(payload.id)) {
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolve(payload.result);
    return;
  }
  if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
    summary.consoleErrors.push(payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '));
  }
}

async function waitForPageTarget() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('Could not find a browser DevTools target.');
}

function onceOpen(socket) {
  return new Promise((resolveOpen) => socket.addEventListener('open', resolveOpen, { once: true }));
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((candidate) => existsSync(candidate)) || '';
}

function hasFailures() {
  return summary.checks.some((item) => !item.ok) || summary.consoleErrors.length > 0;
}

function finish(code) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeProfileDir() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 7) {
        summary.warnings.push(`Could not remove temp browser profile: ${String(error?.message || error)}`);
        return;
      }
      await sleep(250);
    }
  }
}

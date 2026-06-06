import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9810 + Math.floor(Math.random() * 300);
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'psrx-checkout-sem10-'));

if (!BROWSER) throw new Error('No supported Chrome/Edge browser found.');

const browser = spawn(BROWSER, [
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
const consoleErrors = [];

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', onMessage);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1365,
    height: 1400,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await goto('/start?discount=PEP10&source=main&product=semaglutide-10');
  await fillCheckoutForm();

  const invalid = await evalPage(() => [...document.querySelectorAll('input,select,textarea')]
    .filter((el) => !el.checkValidity())
    .map((el) => ({
      name: el.name,
      id: el.id,
      type: el.type,
      value: el.value,
      required: el.required,
      message: el.validationMessage,
    })));
  if (invalid.length > 0) {
    throw new Error(`Checkout form still has invalid fields: ${JSON.stringify(invalid)}`);
  }

  await evalPage(() => {
    const button = [...document.querySelectorAll('button')]
      .find((btn) => /Continue to Checkout/i.test(btn.textContent || ''));
    button?.click();
    return Boolean(button);
  });

  let state = {};
  for (let i = 0; i < 60; i += 1) {
    state = await pageState();
    if (state.pathname.startsWith('/pay/') || /Submission failed/i.test(state.visibleText)) break;
    await sleep(500);
  }

  const ok = state.pathname.startsWith('/pay/');
  console.log(JSON.stringify({ ok, state, consoleErrors }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  ws?.close();
  browser.kill();
  try {
    rmSync(PROFILE_DIR, { recursive: true, force: true });
  } catch {}
}

async function fillCheckoutForm() {
  await evalPage(() => {
    function setField(name, value) {
      const el = document.querySelector(`[name="${name}"]`);
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT'
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, value);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    setField('full_name', 'Codex Browser Checkout Test');
    setField('email', 'codex.browser.checkout@example.com');
    setField('phone', '555-0100');
    setField('state', 'California');
    setField('date_of_birth', '1981-03-22');
    setField('shipping_address', '123 Test St');
    setField('shipping_city', 'Redlands');
    setField('shipping_state', 'California');
    setField('shipping_zip', '92374');

    const standard = [...document.querySelectorAll('input[name="shipping_speed"]')]
      .find((input) => input.value === 'standard');
    if (standard) {
      standard.checked = true;
      standard.dispatchEvent(new Event('change', { bubbles: true }));
    }

    [...document.querySelectorAll('input[type="checkbox"][required]')].forEach((input) => {
      if (!input.checked) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
        setter?.call(input, true);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

async function goto(path) {
  await send('Page.navigate', { url: path.startsWith('http') ? path : `${BASE}${path}` });
  await sleep(1800);
  for (let i = 0; i < 30; i += 1) {
    if (await evalPage(() => document.readyState === 'complete').catch(() => false)) return;
    await sleep(250);
  }
}

async function pageState() {
  return evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    visibleText: document.body.innerText.slice(0, 800),
  }));
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

function onMessage(message) {
  const payload = JSON.parse(message.data);
  if (payload.id && pending.has(payload.id)) {
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolve(payload.result);
    return;
  }
  if (payload.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(payload.params.type)) {
    consoleErrors.push(payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '));
  }
}

async function waitForPageTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const pages = await res.json();
      const target = pages.find((page) => page.type === 'page');
      if (target) return target;
    } catch {}
    await sleep(250);
  }
  throw new Error('Timed out waiting for browser DevTools target.');
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

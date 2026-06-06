import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app';
const OUT = resolve('qa-artifacts');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9333 + Math.floor(Math.random() * 700);

mkdirSync(OUT, { recursive: true });

if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.qa-edge-profile-card')}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let ws;
let id = 0;
const pending = new Map();
const results = [];

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (message) => {
    const payload = JSON.parse(message.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolve(payload.result);
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844, mobile: true },
  ]) {
    await setViewport(viewport);
    await goto('/AACTIVATED');
    await evalPage(() => {
      for (const key of [...Object.keys(localStorage), ...Object.keys(sessionStorage)]) {
        if (key.startsWith('pepscriptrx_portal_age')) {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        }
      }
    });
    await goto('/AACTIVATED');
    await sleep(1200);
    const ageGateReport = await evalPage(() => {
      const gate = document.querySelector('.portal-age-gate');
      return {
        visible: Boolean(gate),
        contactFieldsVisible: gate?.querySelectorAll('input:not([type="checkbox"])').length ?? 0,
        optionalCopyVisible: Boolean(gate?.textContent?.includes('Optional')),
        continueWithoutContactVisible: Boolean(gate?.textContent?.includes('Confirm Age and Continue')),
      };
    });
    await screenshot(`aactivated-age-gate-${viewport.name}`);
    await dismissGate();
    await evalPage(() => document.querySelector('.aactivated-product-card')?.scrollIntoView({ block: 'center' }));
    await sleep(600);
    const collisionReport = await evalPage(() => {
      return [...document.querySelectorAll('.aactivated-product-card')].slice(0, 6).map((card, index) => {
        const badge = card.querySelector('.aactivated-verify-badge-card');
        const title = card.querySelector('.aactivated-card-title')?.textContent?.trim() || `card-${index}`;
        const targets = [...card.querySelectorAll('.aactivated-card-category, .aactivated-card-title, .aactivated-card-image-shell, .aactivated-card-image')];
        if (!badge) return { index, title, collisions: ['missing-badge'] };
        const a = badge.getBoundingClientRect();
        const collisions = targets.filter((target) => {
          const b = target.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        }).map((target) => target.className || target.tagName);
        return { index, title, collisions };
      });
    });
    await screenshot(`aactivated-product-card-${viewport.name}`);

    const detailOpened = await evalPage(() => {
      const details = [...document.querySelectorAll('.aactivated-product-card button')]
        .find((button) => /details/i.test(button.textContent || ''));
      details?.click();
      return Boolean(details);
    });
    await sleep(350);
    const detailModalVisible = await evalPage(() => Boolean(document.querySelector('[aria-label="Close details"]')));
    await evalPage(() => document.querySelector('[aria-label="Close details"]')?.click());

    await evalPage(() => {
      const input = document.querySelector('input[type="search"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'definitely-not-a-product');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await sleep(350);
    const noResultsVisible = await evalPage(() => document.body.innerText.includes('No products found'));
    await evalPage(() => {
      const clear = [...document.querySelectorAll('button')].find((button) => /clear search and filters/i.test(button.textContent || ''));
      clear?.click();
    });
    await sleep(350);

    await evalPage(() => {
      const add = [...document.querySelectorAll('.aactivated-product-card button')]
        .find((button) => /add to cart/i.test(button.textContent || ''));
      add?.click();
    });
    await sleep(350);
    await evalPage(() => {
      const viewCart = [...document.querySelectorAll('button')].find((button) => /view cart/i.test(button.textContent || ''));
      viewCart?.click();
    });
    await sleep(350);
    const clearCartVisible = await evalPage(() => [...document.querySelectorAll('button')].some((button) => /clear cart/i.test(button.textContent || '')));
    await evalPage(() => {
      const clear = [...document.querySelectorAll('button')].find((button) => /clear cart/i.test(button.textContent || ''));
      clear?.click();
    });
    await sleep(350);
    const cartCleared = await evalPage(() => document.body.innerText.includes('Your cart is empty'));

    results.push({
      viewport: viewport.name,
      ageGateReport,
      collisionReport,
      detailOpened,
      detailModalVisible,
      noResultsVisible,
      clearCartVisible,
      cartCleared,
    });
  }
} finally {
  writeFileSync(resolve(OUT, 'aactivated-card-qa.json'), JSON.stringify(results, null, 2));
  ws?.close();
  browser.kill();
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const nextId = ++id;
    pending.set(nextId, { resolve, reject });
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });
}

async function goto(path) {
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(1200);
}

async function dismissGate() {
  await evalPage(() => {
    const gate = document.querySelector('.portal-age-gate');
    if (!gate) return;
    const checkbox = gate.querySelector('input[type="checkbox"]');
    checkbox?.click();
    const confirm = [...gate.querySelectorAll('button')].find((button) => /confirm age and continue/i.test(button.textContent || ''));
    confirm?.click();
  });
  await sleep(500);
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function setViewport(viewport) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: Boolean(viewport.mobile),
  });
}

async function evalPage(expression, arg) {
  const source = typeof expression === 'function'
    ? `(${expression.toString()})(...${JSON.stringify(arg === undefined ? [] : [arg])})`
    : expression;
  const result = await send('Runtime.evaluate', { expression: source, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
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
  throw new Error('Timed out waiting for browser CDP target.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const OUT = resolve('qa-artifacts');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9910 + Math.floor(Math.random() * 500);
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'pepscriptrx-aactivated-catalog-'));

const expectedProducts = [
  { label: 'Wolverine', search: 'Wolverine', category: 'Recovery / Repair', pattern: /wolverine/i },
  { label: 'Glow', search: 'Glow', category: 'Recovery / Repair', pattern: /glow/i },
  { label: 'Klow', search: 'Klow', category: 'Recovery / Repair', pattern: /klow/i },
  { label: 'IGF-1', search: 'IGF', category: 'Growth / Performance', pattern: /igf/i },
  { label: 'Semaglutide', search: 'Semaglutide', category: 'GLP / Weight Management', pattern: /semaglutide/i },
  { label: 'Tesamorelin', search: 'Tesamorelin', category: 'Growth / Performance', pattern: /tesamorelin/i },
  { label: 'MOTS-C', search: 'MOTS', category: 'Longevity / Wellness', pattern: /mots/i },
  { label: 'NAD+', search: 'NAD', category: 'Longevity / Wellness', pattern: /nad/i },
  { label: 'HGH', search: 'HGH', category: 'Growth / Performance', pattern: /hgh/i },
  { label: 'GHK-Cu', search: 'GHK', category: 'Recovery / Repair', pattern: /ghk/i },
  { label: 'CJC + Ipamorelin', search: 'CJC', category: 'Growth / Performance', pattern: /cjc|ipamorelin/i },
  { label: 'Retatrutide', search: 'Retatrutide', category: 'GLP / Weight Management', pattern: /retatrutide/i },
  { label: 'Tirzepatide', search: 'Tirzepatide', category: 'GLP / Weight Management', pattern: /tirzepatide/i },
];

mkdirSync(OUT, { recursive: true });
if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');

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
const summary = {
  base: BASE,
  startedAt: new Date().toISOString(),
  topSellers: [],
  fullCatalog: [],
  searchChecks: [],
  categoryChecks: [],
  screenshots: [],
  consoleErrors: [],
};

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', onMessage);
  await onceOpen(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  await clearOrigin();
  await goto('/AACTIVATED');
  await dismissAgeGate();
  await waitForProducts();
  await screenshot('aactivated-catalog-top-sellers');
  summary.topSellers = await collectCards();

  await browseAllProducts();
  await waitForProducts();
  await screenshot('aactivated-catalog-full');
  summary.fullCatalog = await collectCards();

  for (const expected of expectedProducts) {
    await runSearch(expected.search);
    await waitForSearchSettled();
    const cards = await collectCards();
    summary.searchChecks.push({
      label: expected.label,
      search: expected.search,
      ok: cards.some((card) => expected.pattern.test(card.text) && card.hasAddToCart),
      matches: cards.map((card) => ({ title: card.title, category: card.category, hasAddToCart: card.hasAddToCart })).slice(0, 8),
    });
  }

  await runSearch('');
  const categories = [...new Set(expectedProducts.map((product) => product.category))];
  for (const category of categories) {
    await chooseCategory(category);
    await waitForProducts();
    const cards = await collectCards();
    const expectedInCategory = expectedProducts.filter((product) => product.category === category);
    summary.categoryChecks.push({
      category,
      ok: expectedInCategory.every((expected) => cards.some((card) => expected.pattern.test(card.text) && card.hasAddToCart)),
      expected: expectedInCategory.map((product) => product.label),
      visible: cards.map((card) => ({ title: card.title, category: card.category, hasAddToCart: card.hasAddToCart })),
    });
  }
} finally {
  summary.finishedAt = new Date().toISOString();
  writeSummary();
  ws?.close();
  browser.kill();
  await removeProfileDir();
}

const failedSearches = summary.searchChecks.filter((check) => !check.ok);
const failedCategories = summary.categoryChecks.filter((check) => !check.ok);
const missingTopSellers = ['Semaglutide', 'Glow', 'Klow', 'IGF-1'].filter((label) => {
  const expected = expectedProducts.find((product) => product.label === label);
  return expected && !summary.topSellers.some((card) => expected.pattern.test(card.text));
});

console.log(JSON.stringify(summary, null, 2));
process.exit(failedSearches.length || failedCategories.length || missingTopSellers.length || summary.consoleErrors.length ? 1 : 0);

async function dismissAgeGate() {
  await evalPage(() => {
    const gate = document.querySelector('.portal-age-gate');
    if (!gate) return;
    gate.querySelector('input[type="checkbox"]')?.click();
    [...gate.querySelectorAll('button')].find((button) => /Confirm Age and Continue/i.test(button.textContent || ''))?.click();
  }).catch(() => {});
  await sleep(900);
}

async function waitForProducts() {
  for (let i = 0; i < 40; i += 1) {
    const ok = await evalPage(() => document.querySelectorAll('.aactivated-product-card').length > 0).catch(() => false);
    if (ok) return;
    await sleep(250);
  }
  throw new Error('Timed out waiting for AACTIVATED products.');
}

async function waitForSearchSettled() {
  for (let i = 0; i < 28; i += 1) {
    const settled = await evalPage(() => {
      const hasCards = document.querySelectorAll('.aactivated-product-card').length > 0;
      const text = document.body.innerText || '';
      return hasCards || /no products|no results|try another search/i.test(text);
    }).catch(() => false);
    if (settled) return;
    await sleep(250);
  }
}

async function browseAllProducts() {
  const ok = await evalPage(() => {
    const button = [...document.querySelectorAll('button')].find((node) => /Full Catalog|Catalog Options/i.test(node.textContent || ''));
    button?.click();
    setTimeout(() => {
      [...document.querySelectorAll('button')].find((node) => /Browse All Products|Browse Full Catalog/i.test(node.textContent || ''))?.click();
    }, 50);
    return Boolean(button);
  });
  if (!ok) throw new Error('Could not open catalog menu.');
  await sleep(600);
}

async function runSearch(value) {
  await evalPage((nextValue) => {
    const input = document.querySelector('input[type="search"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, nextValue);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextValue }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    [...document.querySelectorAll('button')].find((button) => /^Search$/i.test((button.textContent || '').trim()))?.click();
    return true;
  }, value);
  await sleep(450);
}

async function chooseCategory(category) {
  const ok = await evalPage((label) => {
    const button = [...document.querySelectorAll('button')].find((node) => (node.textContent || '').includes(label));
    button?.click();
    return Boolean(button);
  }, category);
  if (!ok) throw new Error(`Could not choose category ${category}.`);
  await sleep(450);
}

async function collectCards() {
  return evalPage(() => [...document.querySelectorAll('.aactivated-product-card')].map((card) => {
    const title = card.querySelector('.aactivated-card-title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const category = card.querySelector('.aactivated-card-category strong')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const buttons = [...card.querySelectorAll('button')].map((button) => (button.textContent || '').replace(/\s+/g, ' ').trim());
    const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      title,
      category,
      hasAddToCart: buttons.some((button) => /Add to Cart/i.test(button)),
      text,
    };
  }));
}

async function goto(path) {
  await send('Page.navigate', { url: `${BASE}${path}` });
  await sleep(1400);
}

async function clearOrigin() {
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => {});
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = resolve(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  summary.screenshots.push(file);
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
  return new Promise((resolveSend, reject) => {
    pending.set(callId, { resolve: resolveSend, reject });
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
    const { resolve: resolveSend, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolveSend(payload.result);
    return;
  }
  if (payload.method === 'Runtime.exceptionThrown') {
    summary.consoleErrors.push(payload.params?.exceptionDetails?.text ?? 'Runtime exception');
  }
}

function onceOpen(socket) {
  return new Promise((resolveOpen) => socket.addEventListener('open', resolveOpen, { once: true }));
}

async function waitForPageTarget() {
  const endpoint = `http://127.0.0.1:${PORT}/json/version`;
  for (let i = 0; i < 80; i += 1) {
    try {
      await fetch(endpoint);
      const pages = await fetch(`http://127.0.0.1:${PORT}/json`).then((res) => res.json());
      const page = pages.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Could not find a browser DevTools target.');
}

function writeSummary() {
  writeFileSync(resolve(OUT, 'aactivated-catalog-visibility-summary.json'), JSON.stringify(summary, null, 2));
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
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function removeProfileDir() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 7) {
        summary.cleanupWarning = String(error?.message || error);
        writeSummary();
        return;
      }
      await sleep(250);
    }
  }
}

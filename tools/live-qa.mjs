import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.QA_BASE_URL || 'https://pepscriptrx.com';
const OUT = resolve('qa-artifacts');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9222 + Math.floor(Math.random() * 1000);
const allStores = [
  { key: 'AACTIVATED', path: '/AACTIVATED', brand: 'AACTIVATED' },
  { key: 'Empire', path: '/EmpireHealth&Wellness', brand: 'Empire' },
  { key: 'Zenora', path: '/zenora', brand: 'ZENORA' },
  { key: 'Rock Phorm', path: '/rockphorm', brand: 'Rock Phorm' },
  { key: 'Ronin', path: '/ronin', brand: 'Ronin' },
];
const storeFilter = (process.env.QA_STORES || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
const stores = storeFilter.length
  ? allStores.filter((store) => storeFilter.includes(store.key.toLowerCase()) || storeFilter.includes(store.path.toLowerCase().replace(/^\//, '')))
  : allStores;
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

mkdirSync(OUT, { recursive: true });
rmSync(resolve(OUT, 'latest-summary.json'), { force: true });

if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.qa-edge-profile')}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let ws;
let id = 0;
const pending = new Map();
const events = [];
const summary = {
  base: BASE,
  startedAt: new Date().toISOString(),
  stores: [],
  checks: [],
  screenshots: [],
  consoleErrors: [],
  networkFailures: [],
};

function note(name, status, details = {}) {
  summary.checks.push({ name, status, ...details });
  writeSummary();
  console.log(`${status.toUpperCase()} ${name}`, Object.keys(details).length ? JSON.stringify(details) : '');
}

async function main() {
  try {
    const target = await waitForPageTarget();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.addEventListener('message', (message) => {
      const payload = JSON.parse(message.data);
      if (payload.id && pending.has(payload.id)) {
        const { resolve, reject } = pending.get(payload.id);
        pending.delete(payload.id);
        if (payload.error) reject(new Error(JSON.stringify(payload.error)));
        else resolve(payload.result);
      } else {
        events.push(payload);
        if (payload.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(payload.params.type)) {
          summary.consoleErrors.push({
            type: payload.params.type,
            text: payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '),
          });
        }
        if (payload.method === 'Network.loadingFailed') {
          summary.networkFailures.push(payload.params);
        }
      }
    });
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    for (const viewport of viewports) {
      await setViewport(viewport);
      await auditAgeGate(viewport);
    }

    for (const store of stores) {
      for (const viewport of viewports) {
        await setViewport(viewport);
        await auditStore(store, viewport);
      }
    }

    await auditPublicForms();
  } finally {
    summary.finishedAt = new Date().toISOString();
    writeSummary();
    ws?.close();
    browser.kill();
  }
}

async function auditAgeGate(viewport) {
  await clearStorage();
  await goto('/AACTIVATED');
  const before = await pageState();
  await screenshot(`age-gate-before-${viewport.name}`);
  const clicked = await clickByText('I confirm that I am 21 years of age or older');
  await sleep(250);
  const continued = await clickByText('Confirm Age and Continue') || await clickByText('Confirm and Continue');
  await sleep(900);
  const after = await pageState();
  await screenshot(`age-gate-after-${viewport.name}`);
  note(`Age gate ${viewport.name}`, clicked && continued && after.pathname === '/AACTIVATED' && !/login|approval|rep-intake/i.test(after.href) && !/Age Confirmation/i.test(after.visibleText) ? 'pass' : 'fail', {
    before: before.href,
    after: after.href,
    clicked,
    continued,
    text: after.visibleText.slice(0, 180),
  });
}

async function auditStore(store, viewport) {
  const row = { store: store.key, viewport: viewport.name };
  await clearStorage();
  await goto(store.path);
  await dismissGate();
  await waitForProducts();
  const home = await pageState();
  row.home = home.href;
  row.brandVisible = home.visibleText.toLowerCase().includes(store.brand.toLowerCase()) || home.title.toLowerCase().includes(store.brand.toLowerCase());
  row.priceSample = await evalPage(() => [...document.querySelectorAll('body *')]
    .map((el) => el.textContent || '')
    .find((text) => /\$\d/.test(text))?.match(/\$\d[\d,.]*/)?.[0] || null);
  await screenshot(`${safe(store.key)}-${viewport.name}-home`);

  if (store.path === '/AACTIVATED') {
    await auditSearch(viewport);
  }

  await auditCart(store, viewport);
  await auditLogoRoutes(store, viewport);
  await auditBadgesAndContrast(store, viewport);
  await auditCheckoutScope(store, viewport);
  summary.stores.push(row);
}

async function auditSearch(viewport) {
  await goto('/AACTIVATED');
  await dismissGate();
  await waitForProducts();
  const beforeCount = await productCount();
  const beforeScroll = await evalPage(() => window.scrollY);
  await typeSearch('TB-500');
  await sleep(500);
  const tbCount = await productCount();
  const hasTb = await textIncludes('TB-500');
  const afterScroll = await evalPage(() => window.scrollY);
  const scrollState = await evalPage(() => ({
    scrollY: Math.round(window.scrollY),
    maxScroll: Math.max(0, Math.round(document.documentElement.scrollHeight - innerHeight)),
  }));
  await screenshot(`aactivated-search-tb500-${viewport.name}`);
  await typeSearch('');
  await sleep(500);
  const restoredCount = await productCount();
  const logoOk = await clickLogoExpect('/AACTIVATED');
  const didNotForceBottom = afterScroll <= beforeScroll + 80 || scrollState.scrollY < scrollState.maxScroll - 200;
  note(`Search TB-500 ${viewport.name}`, tbCount > 0 && hasTb && restoredCount >= beforeCount && logoOk && didNotForceBottom ? 'pass' : 'fail', {
    beforeCount,
    tbCount,
    restoredCount,
    beforeScroll,
    afterScroll,
    scrollState,
    logoOk,
  });
}

async function auditCart(store, viewport) {
  await goto(store.path);
  await dismissGate();
  await waitForProducts();
  const addClicked = await clickByText('Add to Cart') || await clickByText('+ Add to Cart');
  await sleep(600);
  const modal = await textIncludes('Added to cart');
  await screenshot(`${safe(store.key)}-${viewport.name}-cart-modal`);
  const viewCart = await clickByText('View Cart');
  await sleep(500);
  const cartVisible = await textIncludes('Your Cart') || await textIncludes('Your Order') || await textIncludes('Order Summary');
  const compact = await evalPage(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"], .cart-float-bar, body *')]
      .find((el) => /Your Cart|Your Order|Order Summary|Checkout Now|Proceed to Checkout/.test(el.textContent || ''));
    if (!dialog) return null;
    const r = dialog.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), viewport: { width: innerWidth, height: innerHeight } };
  });
  await screenshot(`${safe(store.key)}-${viewport.name}-cart-view`);
  const checkoutClicked = await clickByText('Checkout Now') || await clickByText('Proceed to Checkout');
  await sleep(700);
  const checkoutUrl = await pageState();
  await goto(store.path);
  await dismissGate();
  await waitForProducts();
  await clickByText('Add to Cart') || await clickByText('+ Add to Cart');
  await sleep(400);
  const continueClicked = await clickByText('Continue Shopping');
  await sleep(400);
  const modalGone = !(await textIncludes('Added to cart'));
  note(`Cart UX ${store.key} ${viewport.name}`, addClicked && modal && viewCart && cartVisible && checkoutClicked && /\/start|\/checkout/.test(checkoutUrl.pathname) && continueClicked && modalGone ? 'pass' : 'fail', {
    modal,
    viewCart,
    cartVisible,
    checkoutUrl: checkoutUrl.href,
    continueClicked,
    modalGone,
    compact,
  });
}

async function auditLogoRoutes(store, viewport) {
  const routes = ['library', 'mixing', 'terms', 'privacy', 'certificates', 'rep-intake'];
  for (const route of routes) {
    await goto(`${store.path}/${route}`);
    await dismissGate();
    await sleep(700);
    const ok = await clickLogoExpect(store.path);
    await screenshot(`${safe(store.key)}-${viewport.name}-logo-${route}`);
    note(`Logo route ${store.key} ${route} ${viewport.name}`, ok ? 'pass' : 'fail', { expected: store.path, actual: (await pageState()).href });
  }
}

async function auditBadgesAndContrast(store, viewport) {
  await goto(store.path);
  await dismissGate();
  await waitForProducts();
  const result = await evalPage(() => {
    const aactivatedBadgeCollisions = [...document.querySelectorAll('.aactivated-product-card')].map((card, index) => {
      const badge = card.querySelector('.aactivated-verify-badge-card');
      const targets = [...card.querySelectorAll('.aactivated-card-category, .aactivated-card-title, .aactivated-card-image-shell, .aactivated-card-image')];
      if (!badge) return { index, collisions: [] };
      const a = badge.getBoundingClientRect();
      const collisions = targets.filter((target) => {
        const b = target.getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      }).map((target) => target.className || target.tagName);
      return { index, collisions };
    }).filter((row) => row.collisions.length > 0);
    const els = [...document.querySelectorAll('.badge, button, a.btn, input, [class*="product"], [class*="card"]')];
    let overlaps = 0;
    for (let i = 0; i < Math.min(els.length, 120); i++) {
      const a = els[i].getBoundingClientRect();
      if (!a.width || !a.height) continue;
      for (let j = i + 1; j < Math.min(els.length, 120); j++) {
        const b = els[j].getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const intersects = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (intersects && Math.min(a.width * a.height, b.width * b.height) > 100 && !els[i].contains(els[j]) && !els[j].contains(els[i])) overlaps++;
      }
    }
    const lowContrast = [...document.querySelectorAll('button, a.btn, input, .badge')].slice(0, 80).filter((el) => {
      const cs = getComputedStyle(el);
      const fg = parseColor(cs.color);
      const bg = parseColor(cs.backgroundColor) || parseColor(getComputedStyle(el.parentElement || document.body).backgroundColor);
      if (!fg || !bg) return false;
      return contrast(fg, bg) < 3;
    }).map((el) => ({ text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), tag: el.tagName }));
    function parseColor(value) {
      const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    }
    function lum([r, g, b]) {
      return [r, g, b].map((v) => {
        v /= 255;
        return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
      }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    }
    function contrast(a, b) {
      const la = lum(a), lb = lum(b);
      return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05);
    }
    return { overlaps, lowContrast, aactivatedBadgeCollisions };
  });
  const badgeCollisionCount = result.aactivatedBadgeCollisions?.length ?? 0;
  note(`Badge/contrast ${store.key} ${viewport.name}`, badgeCollisionCount === 0 && result.overlaps < 8 && result.lowContrast.length === 0 ? 'pass' : 'warn', result);
}

async function auditCheckoutScope(store, viewport) {
  await goto(store.path);
  await dismissGate();
  await waitForProducts();
  await clickByText('Add to Cart') || await clickByText('+ Add to Cart');
  await sleep(500);
  await clickByText('Checkout Now');
  await sleep(800);
  const state = await evalPage(() => ({
    href: location.href,
    cart: sessionStorage.getItem('pepscriptrx_portal_cart'),
    title: document.title,
    text: document.body.innerText.slice(0, 600),
  }));
  const pathname = state.href.startsWith('chrome-error:') ? '' : new URL(state.href).pathname;
  const scoped = state.cart?.toLowerCase().includes(store.key.toLowerCase().replace(/\s+/g, '')) ||
    state.text.toLowerCase().includes(store.brand.toLowerCase());
  note(`Checkout scope ${store.key} ${viewport.name}`, /\/start|\/checkout/.test(pathname) && scoped ? 'pass' : 'warn', state);
}

async function auditPublicForms() {
  await goto('/patient/signup?brand=aactivated');
  await sleep(700);
  await screenshot('customer-signup-page');
  note('Customer signup page loads', await textIncludes('Create your') ? 'pass' : 'fail', await pageState());

  await goto('/AACTIVATED/rep-intake');
  await dismissGate();
  await sleep(700);
  await screenshot('rep-intake-page');
  note('Rep intake page loads', await textIncludes('Approval') || await textIncludes('Submit your information') ? 'pass' : 'fail', await pageState());
}

async function clickLogoExpect(expectedPath) {
  await evalPage(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(200);
  const clicked = await evalPage(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const link = document.querySelector('.pub-nav-brand');
    if (!link) return false;
    link.click();
    return true;
  });
  await sleep(700);
  const state = await pageState();
  return clicked && normalizePath(state.pathname) === normalizePath(expectedPath) && state.scrollY < 80;
}

async function dismissGate() {
  await clickByText('I confirm that I am 21 years of age or older');
  await sleep(250);
  await clickByText('Confirm Age and Continue');
  await sleep(500);
}

async function waitForProducts() {
  for (let i = 0; i < 20; i++) {
    if ((await productCount()) > 0 || await textIncludes('Add to Cart')) return;
    await sleep(250);
  }
}

async function productCount() {
  return await evalPage(() => [...document.querySelectorAll('button')].filter((button) => /Add to Cart/.test(button.textContent || '')).length);
}

async function typeSearch(value) {
  await evalPage((next) => {
    const input = [...document.querySelectorAll('input[type="search"], input')].find((el) => /Search/i.test(el.placeholder || ''));
    if (!input) return false;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, next);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: next }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, value);
}

async function clickByText(text) {
  return await evalPage((needle) => {
    const exact = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const candidates = [...document.querySelectorAll('button, a, label, input[type="checkbox"]')];
    let el = candidates.find((node) => exact(node.textContent).includes(needle) || exact(node.getAttribute('aria-label')).includes(needle));
    if (!el && needle.includes('21')) {
      el = candidates.find((node) => /21|older|confirm/i.test(exact(node.textContent) + exact(node.getAttribute('aria-label'))));
    }
    if (!el) return false;
    if (el.tagName === 'LABEL') {
      const input = el.querySelector('input') || document.getElementById(el.getAttribute('for') || '');
      if (input) input.click();
    }
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, text);
}

async function textIncludes(text) {
  return await evalPage((needle) => document.body.innerText.toLowerCase().includes(String(needle).toLowerCase()), text);
}

async function goto(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  await send('Page.navigate', { url });
  await waitLoad();
}

async function waitLoad() {
  await sleep(1200);
  for (let i = 0; i < 20; i++) {
    const ready = await evalPage(() => document.readyState === 'complete').catch(() => false);
    if (ready) return;
    await sleep(250);
  }
}

async function clearStorage() {
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => {});
}

async function pageState() {
  return await evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    scrollY: Math.round(window.scrollY),
    title: document.title,
    visibleText: document.body.innerText.slice(0, 600),
  }));
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = resolve(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  summary.screenshots.push(file);
  writeSummary();
}

async function setViewport(viewport) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: Boolean(viewport.mobile),
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
    try {
      const targets = await waitForJson(`http://127.0.0.1:${PORT}/json`);
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('Could not find a browser DevTools target');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(path) {
  return path.replace(/\/+$/, '').toLowerCase() || '/';
}

function safe(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function writeSummary() {
  writeFileSync(resolve(OUT, 'latest-summary.json'), JSON.stringify(summary, null, 2));
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

main().catch((error) => {
  console.error(error);
  summary.fatal = String(error?.stack || error);
  writeFileSync(resolve(OUT, 'latest-summary.json'), JSON.stringify(summary, null, 2));
  browser.kill();
  process.exit(1);
});

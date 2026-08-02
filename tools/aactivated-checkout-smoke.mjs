import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const DIRECT_PRODUCT_ID = process.env.QA_PRODUCT_ID || '';
const DIRECT_PRODUCT_SKU = process.env.QA_PRODUCT_SKU || '';
const DIRECT_PRODUCT_NAME = process.env.QA_PRODUCT_NAME || 'Retatrutide';
const DIRECT_PRODUCT_STRENGTH = process.env.QA_PRODUCT_STRENGTH || '20mg';
const DIRECT_PRODUCT_PRICE = Number(process.env.QA_PRODUCT_PRICE || 350);
const DIRECT_PROMO_CODE = process.env.QA_PROMO_CODE || '';
const QA_REP = process.env.QA_REP || 'WIGG25';
const QA_SCOPE = process.env.QA_SCOPE || QA_REP;
const QA_ADD_COUNT = Math.max(1, Number(process.env.QA_ADD_COUNT || 1));
const QA_CART_ITEMS = process.env.QA_CART_ITEMS ? JSON.parse(process.env.QA_CART_ITEMS) : null;
const OUT = resolve('qa-artifacts');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9880 + Math.floor(Math.random() * 400);
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'psrx-aactivated-checkout-'));

if (!BROWSER) throw new Error('No supported Chrome/Edge browser found.');
mkdirSync(OUT, { recursive: true });

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
const consoleEvents = [];
const networkFailures = [];
const rpcResponses = [];

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', onMessage);
  await onceOpen(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: true,
  });

  await clearOrigin();
  if (QA_CART_ITEMS || DIRECT_PRODUCT_ID) {
    await seedDirectAactivatedCart();
    await goto(`/start?scope=${encodeURIComponent(QA_SCOPE)}&source=guy-portal&rep=${encodeURIComponent(QA_REP)}&brand=aactivated`);
  } else {
    await goto(`/AACTIVATED?rep=${encodeURIComponent(QA_REP)}`);
    await dismissAgeGate();
    await waitForProducts();
    await clickProductAddToCart(QA_ADD_COUNT);
    await clickAnyText(['Continue to Secure Checkout', 'Checkout Now', 'Proceed to Checkout', 'Checkout Available']);
    await waitForPath('/start');
  }
  await sleep(1200);
  if (DIRECT_PROMO_CODE) {
    await setPromoCode(DIRECT_PROMO_CODE);
    await clickAnyText(['Apply']);
    await sleep(1200);
  }
  await fillCheckoutForm();

  const beforeSubmit = await pageState();
  const invalid = await invalidFields();
  if (invalid.length > 0) {
    throw new Error(`Checkout form still has invalid fields: ${JSON.stringify(invalid)}`);
  }

  await submitCheckoutForm();

  let afterSubmit = {};
  for (let i = 0; i < 80; i += 1) {
    afterSubmit = await pageState();
    if (afterSubmit.pathname.startsWith('/pay/') || /Submission failed|Unable to continue/i.test(afterSubmit.visibleText)) break;
    await sleep(500);
  }

  const ok = afterSubmit.pathname.startsWith('/pay/');
  await screenshot('aactivated-checkout-smoke');
  const summary = {
    ok,
    base: BASE,
    beforeSubmit,
    afterSubmit,
    consoleEvents,
    rpcResponses,
    networkFailures,
  };
  writeFileSync(resolve(OUT, 'aactivated-checkout-smoke.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
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

    setField('full_name', 'Codex AACTIVATED Checkout Test');
    setField('email', 'codex.aactivated.checkout@example.com');
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

async function seedDirectAactivatedCart() {
  await goto('/AACTIVATED');
  await evalPage((cart) => {
    sessionStorage.setItem('pepscriptrx_portal_cart', JSON.stringify(cart));
  }, {
    rep: QA_REP,
    scope_code: QA_SCOPE,
    discount_code: '',
    discount_amount: 0,
    bundle_discount_amount: 0,
    bundle_discounts: [],
    promo_title: '',
    promo_slug: '',
    promo_product_id: '',
    distributor: 'guy',
    source_portal: 'VITALITYINS',
    source_route: `/aactivated?rep=${QA_REP}`,
    store_slug: 'guy',
    store_name: 'AACTIVATED-RX',
    account_type: 'rep',
    items: QA_CART_ITEMS || [{
      id: DIRECT_PRODUCT_ID,
      sku: DIRECT_PRODUCT_SKU,
      name: DIRECT_PRODUCT_NAME,
      strength: DIRECT_PRODUCT_STRENGTH,
      technical_name: DIRECT_PRODUCT_NAME,
      category: 'GLP / Weight Management',
      price: DIRECT_PRODUCT_PRICE,
      qty: 1,
      inventory_status_at_purchase: 'in_stock',
      inventory_status_label_at_purchase: 'Checkout Available',
      was_special_order: false,
      estimated_fulfillment_days_at_purchase: 14,
      bundle_group_key: null,
      bundle_group_name: null,
    }],
    total: QA_CART_ITEMS
      ? QA_CART_ITEMS.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || item.quantity || 1)), 0)
      : DIRECT_PRODUCT_PRICE,
    capturedAt: new Date().toISOString(),
  });
}

async function setPromoCode(code) {
  const ok = await evalPage((nextCode) => {
    const input = [...document.querySelectorAll('input')]
      .find((node) => /Promo code/i.test(node.closest('.form-group')?.textContent || '') || /Enter promo|customer discount/i.test(node.getAttribute('placeholder') || ''));
    if (!input) return false;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, nextCode);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextCode }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, code);
  if (!ok) throw new Error('Could not find promo input.');
}

async function invalidFields() {
  return evalPage(() => [...document.querySelectorAll('input,select,textarea')]
    .filter((el) => !el.checkValidity())
    .map((el) => ({
      name: el.name,
      id: el.id,
      type: el.type,
      value: el.value,
      required: el.required,
      message: el.validationMessage,
    })));
}

async function dismissAgeGate() {
  await evalPage(() => {
    const gate = document.querySelector('.portal-age-gate');
    if (!gate) return;
    gate.querySelector('input[type="checkbox"]')?.click();
    [...gate.querySelectorAll('button')]
      .find((button) => /Confirm Age and Continue/i.test(button.textContent || ''))
      ?.click();
  }).catch(() => {});
  await sleep(900);
}

async function waitForProducts() {
  for (let i = 0; i < 32; i += 1) {
    const ok = await evalPage(() => [...document.querySelectorAll('.aactivated-product-card button')]
      .some((button) => /Add to Cart/i.test(button.textContent || ''))).catch(() => false);
    if (ok) return;
    await sleep(250);
  }
  throw new Error('Timed out waiting for AACTIVATED products.');
}

async function clickProductAddToCart(count) {
  const available = await evalPage(() => {
    return [...document.querySelectorAll('.aactivated-product-card button')]
      .filter((node) => /Add to Cart/i.test(node.textContent || ''))
      .map((button) => (button.closest('.aactivated-product-card')?.textContent || '').replace(/\s+/g, ' ').slice(0, 160));
  });
  if (!available?.length) throw new Error('No AACTIVATED product cards have Add to Cart buttons.');
  const clicked = await evalPage((nextCount) => {
    const buttons = [...document.querySelectorAll('.aactivated-product-card button')]
      .filter((node) => /Add to Cart/i.test(node.textContent || ''));
    buttons.slice(0, nextCount).forEach((button) => button.click());
    return buttons.slice(0, nextCount).map((button) => {
      const card = button.closest('.aactivated-product-card');
      return (card?.textContent || '').replace(/\s+/g, ' ').slice(0, 160);
    });
  }, count);
  if (clicked.length < count) throw new Error(`Only clicked ${clicked.length} of ${count} requested products.`);
  await sleep(500);
}

async function clickAnyText(labels) {
  const ok = await evalPage((needles) => {
    const normalizedNeedles = needles.map((needle) => String(needle).toLowerCase());
    const target = [...document.querySelectorAll('button, a')]
      .find((node) => {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return normalizedNeedles.some((needle) => text.includes(needle));
      });
    target?.click();
    return Boolean(target);
  }, labels);
  if (!ok) throw new Error(`Could not click any of: ${labels.join(', ')}`);
  await sleep(900);
}

async function submitCheckoutForm() {
  const ok = await evalPage(() => {
    const submit = document.querySelector('button[type="submit"]');
    submit?.click();
    return Boolean(submit);
  });
  if (!ok) {
    const state = await pageState().catch(() => ({}));
    throw new Error(`Could not find checkout submit button. State: ${JSON.stringify(state)}`);
  }
  await sleep(900);
}

async function goto(path) {
  await send('Page.navigate', { url: path.startsWith('http') ? path : `${BASE}${path}` });
  await sleep(1800);
  for (let i = 0; i < 30; i += 1) {
    if (await evalPage(() => document.readyState === 'complete').catch(() => false)) return;
    await sleep(250);
  }
}

async function waitForPath(path) {
  for (let i = 0; i < 40; i += 1) {
    const reached = await evalPage((nextPath) => location.pathname === nextPath, path).catch(() => false);
    if (reached) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function pageState() {
  return evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    visibleText: document.body.innerText.slice(0, 1200),
    cart: JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart') || 'null'),
  }));
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(result.data, 'base64'));
}

async function clearOrigin() {
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => {});
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
  return new Promise((resolveSend, reject) => {
    const nextId = ++id;
    pending.set(nextId, { resolve: resolveSend, reject });
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
    consoleEvents.push(payload.params.args?.map((arg) => ({
      value: arg.value,
      description: arg.description,
      unserializableValue: arg.unserializableValue,
      preview: arg.preview,
    })));
  }
  if (payload.method === 'Network.responseReceived' && /create_public_patient_submission|create-aactivated-cart-submission/i.test(payload.params.response?.url || '')) {
    void send('Network.getResponseBody', { requestId: payload.params.requestId })
      .then((body) => {
        rpcResponses.push({
          url: payload.params.response.url,
          status: payload.params.response.status,
          statusText: payload.params.response.statusText,
          body: body.body,
        });
      })
      .catch((error) => {
        rpcResponses.push({
          url: payload.params.response.url,
          status: payload.params.response.status,
          statusText: payload.params.response.statusText,
          bodyError: error.message,
        });
      });
  }
  if (payload.method === 'Network.loadingFailed') {
    networkFailures.push(payload.params);
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
  return candidates.find((candidate) => existsSync(candidate));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

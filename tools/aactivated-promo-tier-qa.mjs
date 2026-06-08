import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const OUT = resolve('qa-artifacts');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9810 + Math.floor(Math.random() * 500);

const cases = [
  { rep: 'ADONIS', code: 'ADONIS15' },
  { rep: 'ADONIS', code: 'ADONIS20' },
  { rep: 'ADONIS', code: 'ADONIS25' },
  { rep: 'ADONIS', code: 'ADONIS30' },
  { rep: 'OMGBILLY', code: 'OMGBILLY15' },
  { rep: 'OMGBILLY', code: 'OMGBILLY20' },
  { rep: 'OMGBILLY', code: 'OMGBILLY25' },
  { rep: 'OMGBILLY', code: 'OMGBILLY30' },
  { rep: 'WENDYCREATES54', code: 'WENDY20' },
  { rep: 'JUJUAN', code: 'JUJUAN25' },
];

mkdirSync(OUT, { recursive: true });
if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.qa-edge-profile-promo-tier')}`,
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
  checks: [],
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

  for (const testCase of cases) {
    await auditCode(testCase);
  }
} finally {
  summary.finishedAt = new Date().toISOString();
  writeSummary();
  ws?.close();
  browser.kill();
}

const failed = summary.checks.filter((check) => !check.ok);
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length || summary.consoleErrors.length ? 1 : 0);

async function auditCode(testCase) {
  await clearOrigin();
  await goto(`/AACTIVATED?rep=${encodeURIComponent(testCase.rep)}`);
  await dismissAgeGate();
  await waitForProducts();
  const firstCardReport = await evalPage(() => {
    const card = document.querySelector('.aactivated-product-card');
    const buttons = [...(card?.querySelectorAll('button') ?? [])].map((button) => (button.textContent || '').replace(/\s+/g, ' ').trim());
    return {
      hasCard: Boolean(card),
      buttons,
      hasAddToCart: buttons.some((text) => /Add to Cart/i.test(text)),
    };
  });
  await clickFirstAddToCart();
  await sleep(500);
  await clickByText('Checkout Now');
  await waitForPath('/start');
  await sleep(600);
  const blankBeforeApply = await evalPage(() => {
    const input = [...document.querySelectorAll('input')]
      .find((node) => /Promo code/i.test(node.closest('.form-group')?.textContent || '') || /SAVE-ADONIS|Enter promo/i.test(node.getAttribute('placeholder') || ''));
    return input ? input.value === '' : false;
  });
  await setPromoCode(testCase.code);
  await clickByText('Apply');
  await sleep(1000);
  const state = await evalPage((code) => {
    const text = document.body.innerText;
    return {
      href: location.href,
      applied: text.includes(`${code} applied`) || text.includes(`Discount (${code})`),
      textSample: text.slice(0, 800),
    };
  }, testCase.code);
  await screenshot(`aactivated-promo-${testCase.code.toLowerCase()}`);
  summary.checks.push({
    ...testCase,
    ok: firstCardReport.hasAddToCart && blankBeforeApply && state.applied,
    firstCardReport,
    blankBeforeApply,
    state,
  });
  writeSummary();
}

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
  for (let i = 0; i < 28; i += 1) {
    const ok = await evalPage(() => [...document.querySelectorAll('.aactivated-product-card button')].some((button) => /Add to Cart/i.test(button.textContent || ''))).catch(() => false);
    if (ok) return;
    await sleep(250);
  }
}

async function clickFirstAddToCart() {
  const ok = await evalPage(() => {
    const card = document.querySelector('.aactivated-product-card');
    const button = [...(card?.querySelectorAll('button') ?? [])].find((node) => /Add to Cart/i.test(node.textContent || ''));
    button?.click();
    return Boolean(button);
  });
  if (!ok) throw new Error('First AACTIVATED card has no Add to Cart button.');
}

async function setPromoCode(code) {
  const ok = await evalPage((nextCode) => {
    const input = [...document.querySelectorAll('input')]
      .find((node) => /Promo code/i.test(node.closest('.form-group')?.textContent || '') || /SAVE-ADONIS|Enter promo/i.test(node.getAttribute('placeholder') || ''));
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

async function clickByText(text) {
  const ok = await evalPage((needle) => {
    const button = [...document.querySelectorAll('button, a')]
      .find((node) => (node.textContent || '').replace(/\s+/g, ' ').trim().includes(needle));
    button?.click();
    return Boolean(button);
  }, text);
  if (!ok) throw new Error(`Could not click: ${text}`);
}

async function waitForPath(path) {
  for (let i = 0; i < 40; i += 1) {
    const reached = await evalPage((nextPath) => location.pathname === nextPath, path).catch(() => false);
    if (reached) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${path}`);
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

function writeSummary() {
  writeFileSync(resolve(OUT, 'aactivated-promo-tier-summary.json'), JSON.stringify(summary, null, 2));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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

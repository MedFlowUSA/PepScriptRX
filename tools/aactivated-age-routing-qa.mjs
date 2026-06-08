import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const OUT = resolve('qa-artifacts');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9460 + Math.floor(Math.random() * 500);

const paths = [
  '/AACTIVATED',
  '/aactivated',
  '/AACTIVATED?rep=ADONIS',
  '/AACTIVATED?rep=AAMIR',
  '/AACTIVATED?rep=2LEGIT',
  '/AACTIVATED?rep=WENDYCREATES54',
  '/AACTIVATED?rep=JUJUAN',
  '/AACTIVATED?rep=POWERS',
  '/AACTIVATED?promo=test-promo',
  '/r/ADONIS',
  '/r/AAMIR',
  '/r/2LEGIT',
  '/r/WENDYCREATES54',
  '/r/JUJUAN',
  '/r/POWERS',
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000, mobile: false },
  { name: 'iphone-safari-size', width: 390, height: 844, mobile: true },
  { name: 'android-chrome-size', width: 412, height: 915, mobile: true },
];

mkdirSync(OUT, { recursive: true });

if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.qa-edge-profile-age-routing')}`,
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

  for (const viewport of viewports) {
    await setViewport(viewport);
    for (const path of paths) {
      await auditPath(path, viewport);
    }
  }
} finally {
  summary.finishedAt = new Date().toISOString();
  writeSummary();
  ws?.close();
  browser.kill();
}

const failed = summary.checks.filter((check) => !check.ok);
if (failed.length || summary.consoleErrors.length) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(summary, null, 2));

async function auditPath(path, viewport) {
  await goto(path);
  await resetClientStorage();
  await goto(path);
  await sleep(800);
  const before = await pageState();
  const gateVisible = await evalPage(() => Boolean(document.querySelector('.portal-age-gate')));
  const confirmed = await dismissAgeGate();
  await waitForCatalog();
  const after = await pageState();
  const badRoute = /\/start|\/checkout|\/login|rep-intake|start-rep|approval|apply/i.test(after.href);
  const catalogVisible = await evalPage(() => Boolean(document.getElementById('aactivated-top-sellers')) && /Add to Cart|Top sellers|Full catalog/i.test(document.body.innerText));
  const productButtons = await evalPage(() => [...document.querySelectorAll('button')].filter((button) => /Add to Cart/i.test(button.textContent || '')).length);
  const screenshotName = `aactivated-age-routing-${viewport.name}-${safe(path)}`;
  await screenshot(screenshotName);
  summary.checks.push({
    path,
    viewport: viewport.name,
    ok: gateVisible && confirmed && after.pathname === '/AACTIVATED' && !badRoute && catalogVisible && productButtons > 0,
    before: before.href,
    after: after.href,
    gateVisible,
    confirmed,
    catalogVisible,
    productButtons,
    scrollY: after.scrollY,
  });
  writeSummary();
}

async function dismissAgeGate() {
  const clicked = await evalPage(() => {
    const gate = document.querySelector('.portal-age-gate');
    if (!gate) return false;
    const checkbox = gate.querySelector('input[type="checkbox"]');
    checkbox?.click();
    return true;
  });
  await sleep(250);
  const continued = await evalPage(() => {
    const gate = document.querySelector('.portal-age-gate');
    if (!gate) return false;
    const confirm = [...gate.querySelectorAll('button')].find((button) => /Confirm Age and Continue/i.test(button.textContent || ''));
    confirm?.click();
    return Boolean(confirm);
  });
  await sleep(900);
  return Boolean(clicked && continued);
}

async function waitForCatalog() {
  for (let i = 0; i < 24; i += 1) {
    const ok = await evalPage(() => Boolean(document.getElementById('aactivated-top-sellers')) && /Add to Cart/i.test(document.body.innerText)).catch(() => false);
    if (ok) return;
    await sleep(250);
  }
}

async function goto(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  await send('Page.navigate', { url });
  await sleep(1200);
  for (let i = 0; i < 20; i += 1) {
    const ready = await evalPage(() => document.readyState === 'complete').catch(() => false);
    if (ready) return;
    await sleep(250);
  }
}

async function pageState() {
  return await evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    hash: location.hash,
    scrollY: Math.round(window.scrollY),
    title: document.title,
    visibleText: document.body.innerText.slice(0, 220),
  }));
}

async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = resolve(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  summary.screenshots.push(file);
}

async function setViewport(viewport) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: Boolean(viewport.mobile),
  });
}

async function clearStorage() {
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => {});
}

async function resetClientStorage() {
  await clearStorage();
  await evalPage(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((cookie) => {
      const eq = cookie.indexOf('=');
      const name = (eq > -1 ? cookie.slice(0, eq) : cookie).trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  }).catch(() => {});
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
    const { resolve: resolvePending, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else resolvePending(payload.result);
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
  writeFileSync(resolve(OUT, 'aactivated-age-routing-summary.json'), JSON.stringify(summary, null, 2));
}

function safe(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'root';
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

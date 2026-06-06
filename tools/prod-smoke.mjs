import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const BROWSER_PATH = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9700 + Math.floor(Math.random() * 500);
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'pepscriptrx-smoke-'));
const RUN_ADMIN = Boolean(process.env.GUY_ADMIN_EMAIL && process.env.GUY_ADMIN_PASSWORD);

const publicChecks = [
  { path: '/', label: 'main platform', pattern: /PepScriptRX|Already Prescribed|Start/i },
  { path: '/AACTIVATED', label: 'AACTIVATED storefront', pattern: /AACTIVATED|AACTIVATEDRX|Products|Top Sellers/i },
  { path: '/patient', label: 'patient portal', pattern: /Customer login|Patient|Sign In|Dashboard/i, allowRedirect: true },
  { path: '/rep', label: 'rep portal', pattern: /Rep login|Rep Portal|Sign In|Dashboard/i, allowRedirect: true },
];

const adminChecks = [
  { path: '/admin', label: 'admin dashboard', pattern: /Dashboard|Admin Dashboard|Orders|Rep Requests/i },
  { path: '/admin/submissions', label: 'orders page', pattern: /Orders|Patient|Medication|Status|No submissions/i },
  { path: '/admin/analytics', label: 'analytics page', pattern: /Analytics|Revenue|Orders|No submission data/i },
];

const summary = {
  base: BASE,
  checkedAt: new Date().toISOString(),
  http: [],
  browser: [],
  consoleErrors: [],
  warnings: [],
};

await runHttpChecks();

if (!BROWSER_PATH) {
  summary.warnings.push('No supported Chrome/Edge browser found. Browser-render checks skipped.');
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

  for (const check of publicChecks) {
    await browserCheck(check);
  }

  if (RUN_ADMIN) {
    await loginAsGuyAdmin();
    for (const check of adminChecks) {
      await browserCheck(check, { rejectLogin: true });
    }
  } else {
    summary.warnings.push('GUY_ADMIN_EMAIL/GUY_ADMIN_PASSWORD not set. Credentialed admin page checks skipped.');
  }
} finally {
  ws?.close();
  browser.kill();
  await removeProfileDir();
}

finish(hasFailures() ? 1 : 0);

async function runHttpChecks() {
  for (const check of [...publicChecks, ...adminChecks]) {
    const url = `${BASE}${check.path}`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      summary.http.push({
        path: check.path,
        status: res.status,
        ok: res.ok && text.includes('id="root"'),
      });
    } catch (error) {
      summary.http.push({ path: check.path, status: 0, ok: false, error: String(error?.message || error) });
    }
  }
}

async function browserCheck(check, options = {}) {
  await goto(check.path);
  await dismissAgeGate();
  const state = await pageState();
  const body = state.visibleText;
  const ok = check.pattern.test(body)
    && (check.allowRedirect || state.pathname === check.path)
    && !/Application error|Something went wrong|This page could not be found/i.test(body)
    && !(options.rejectLogin && /Sign In|Admin login/i.test(body));
  summary.browser.push({
    label: check.label,
    path: check.path,
    url: state.href,
    ok,
    sample: body.slice(0, 120).replace(/\s+/g, ' '),
  });
}

async function loginAsGuyAdmin() {
  await clearStorage();
  await goto('/login?portal=admin&brand=aactivated');
  await dismissAgeGate();
  await setInput('input[type="email"]', process.env.GUY_ADMIN_EMAIL);
  await setInput('input[type="password"]', process.env.GUY_ADMIN_PASSWORD);
  await clickSelector('button[type="submit"]');
  await waitForPath('/admin', 15000);
}

async function dismissAgeGate() {
  await evalPage(() => {
    const gate = document.querySelector('.portal-age-gate');
    if (!gate) return;
    const checkbox = gate.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const confirm = [...gate.querySelectorAll('button')].find((button) => /confirm|continue/i.test(button.textContent || ''));
    confirm?.click();
  }).catch(() => {});
  await sleep(500);
}

async function setInput(selector, value) {
  const ok = await evalPage((args) => {
    const input = document.querySelector(args.selector);
    if (!input) return false;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, args.value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: args.value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { selector, value });
  if (!ok) throw new Error(`Missing input: ${selector}`);
}

async function clickSelector(selector) {
  const ok = await evalPage((nextSelector) => {
    const el = document.querySelector(nextSelector);
    if (!el) return false;
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, selector);
  if (!ok) throw new Error(`Missing clickable selector: ${selector}`);
}

async function clickByText(text) {
  return await evalPage((needle) => {
    const exact = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const candidates = [...document.querySelectorAll('button, a, label, input[type="checkbox"]')];
    let el = candidates.find((node) => exact(node.textContent).includes(needle) || exact(node.getAttribute('aria-label')).includes(needle));
    if (!el && /21|confirm/i.test(needle)) {
      el = candidates.find((node) => /21|older|confirm/i.test(exact(node.textContent) + exact(node.getAttribute('aria-label'))));
    }
    if (!el) return false;
    if (el.tagName === 'LABEL') {
      const input = el.querySelector('input') || document.getElementById(el.getAttribute('for') || '');
      if (input) input.click();
    }
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, text);
}

async function goto(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const expected = new URL(url);
  const before = await pageState().catch(() => null);
  await send('Page.navigate', { url });
  await waitLoad(expected, before?.href);
  const after = await pageState().catch(() => null);
  const authRedirect = ['/patient', '/rep', '/admin'].includes(expected.pathname) && after?.pathname === '/login';
  if (after?.pathname !== expected.pathname && !authRedirect) {
    await evalPage((nextUrl) => { window.location.assign(nextUrl); }, url);
    await waitLoad(expected, after?.href);
  }
}

async function waitLoad(expectedUrl, previousHref) {
  await sleep(900);
  for (let i = 0; i < 24; i += 1) {
    const state = await evalPage(() => ({
      ready: document.readyState === 'complete',
      href: location.href,
      pathname: location.pathname,
    })).catch(() => null);
    if (state?.ready) {
      const reachedRequestedPath = state.pathname === expectedUrl.pathname;
      const reachedAuthRedirect = ['/patient', '/rep', '/admin'].includes(expectedUrl.pathname) && state.pathname === '/login';
      const changedPage = previousHref && state.href !== previousHref;
      if (reachedRequestedPath || reachedAuthRedirect || changedPage) return;
    }
    await sleep(250);
  }
}

async function waitForPath(path, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await pageState();
    if (state.pathname === path) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function clearStorage() {
  await send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => {});
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
    const { resolve: finishResolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(JSON.stringify(payload.error)));
    else finishResolve(payload.result);
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
  return summary.http.some((item) => !item.ok)
    || summary.browser.some((item) => !item.ok)
    || summary.consoleErrors.length > 0;
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

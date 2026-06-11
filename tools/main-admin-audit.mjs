import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const EMAIL = process.env.MAIN_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const PASSWORD = process.env.MAIN_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const OUT = resolve('qa-artifacts', 'main-admin-audit');
const PORT = 9800 + Math.floor(Math.random() * 500);
const PROFILE_DIR = mkdtemp();

const routes = [
  { path: '/admin', label: 'Dashboard', pattern: /Dashboard|Admin Dashboard|Orders|Revenue|Rep Requests/i },
  { path: '/admin/submissions', label: 'Orders', pattern: /Orders|Patient|Medication|Status|No submissions/i },
  { path: '/admin/analytics', label: 'Analytics', pattern: /Analytics|Revenue|Orders|No submission data/i },
  { path: '/admin/products', label: 'Products', pattern: /Products|Product|Catalog|SKU/i },
  { path: '/admin/inventory', label: 'Inventory', pattern: /Inventory|SKU|Product|Stock/i },
  { path: '/admin/operations/product-intelligence', label: 'Product Intelligence', pattern: /Product Intelligence|Access|Product/i, optional: true },
  { path: '/admin/rx-plus', label: 'Rx+', pattern: /Rx\+|RX Plus|Distributor|Product/i },
  { path: '/admin/aactivated-promos', label: 'Promo Links', pattern: /Promo|AACTIVATED|Discount|Code/i },
  { path: '/admin/leads', label: 'Leads', pattern: /Leads|Lead|Captured/i },
  { path: '/admin/zelle-payments', label: 'Zelle Payments', pattern: /Zelle|Payment|Pending|Receipt/i },
  { path: '/admin/rep-requests', label: 'Rep Requests', pattern: /Rep Requests|Approval|Pending|Approved/i },
  { path: '/admin/reps', label: 'Reps', pattern: /Reps|Representatives|Commission/i },
  { path: '/admin/rep-store-manager', label: 'Rep Store Manager', pattern: /Rep Store|Store Manager|Rep/i },
  { path: '/admin/commission-center', label: 'Commission Center', pattern: /Commission|Payout|Rep/i },
  { path: '/admin/product-lists', label: 'Product Lists', pattern: /Product List|Products|Catalog/i },
  { path: '/admin/pricing', label: 'Pricing Manager', pattern: /Pricing|Price|Discount/i },
  { path: '/admin/payouts', label: 'Payouts', pattern: /Payout|PayPal|Commission/i },
  { path: '/admin/scope-codes', label: 'Scope Codes', pattern: /Scope|Code|Store/i },
  { path: '/admin/payment-audit', label: 'PayPal Audit', pattern: /Payment|PayPal|Audit/i },
  { path: '/admin/fulfillment', label: 'Fulfillment', pattern: /Fulfillment|Orders|Shipment/i },
  { path: '/admin/rep-performance', label: 'Rep Performance', pattern: /Performance|Rep|Leaderboard/i },
  { path: '/admin/customer-activity', label: 'Customer Activity', pattern: /Customer|Activity|Orders/i },
  { path: '/admin/product-performance', label: 'Product Performance', pattern: /Product Performance|Product|Sales/i },
  { path: '/admin/store-settings', label: 'Store Settings', pattern: /Store Settings|Store|Brand/i },
  { path: '/admin/feature-requests', label: 'Feature Requests', pattern: /Feature|Request|Priority/i },
];

const expectedFullAdminNav = routes.map((route) => route.label);
const summary = {
  base: BASE,
  account: EMAIL ? maskEmail(EMAIL) : null,
  startedAt: new Date().toISOString(),
  login: null,
  role: null,
  nav: null,
  desktopRoutes: [],
  mobileChecks: [],
  screenshots: [],
  consoleMessages: [],
  networkFailures: [],
  findings: [],
};

if (!EMAIL || !PASSWORD) throw new Error('Set MAIN_ADMIN_EMAIL/MAIN_ADMIN_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD.');
if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');
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

try {
  const target = await waitForPageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', onMessage);
  await onceOpen(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  await setViewport(1440, 1000, false);
  await login();
  await auditNav();
  for (const route of routes) {
    await auditRoute(route);
  }

  await setViewport(390, 844, true);
  await auditMobileShell();
} catch (error) {
  summary.findings.push({ severity: 'fail', area: 'harness', message: String(error?.message || error) });
} finally {
  summary.finishedAt = new Date().toISOString();
  writeSummary();
  ws?.close();
  browser.kill();
  await removeProfileDir();
}

const failed = summary.findings.some((finding) => finding.severity === 'fail')
  || summary.desktopRoutes.some((route) => route.status === 'fail')
  || summary.login?.status === 'fail';
console.log(JSON.stringify(summary, null, 2));
process.exit(failed ? 1 : 0);

async function login() {
  await clearStorage();
  await goto('/login?portal=admin');
  await waitForRenderedText(/Admin login|Sign In/i, 12000);
  await setInput('input[type="email"]', EMAIL);
  await setInput('input[type="password"]', PASSWORD);
  await clickSelector('button[type="submit"]');
  await waitForNotBusy(20000);
  try {
    await waitForPath('/admin', 20000);
  } catch (error) {
    const state = await pageState().catch(() => null);
    if (state) {
      summary.login = {
        status: 'fail',
        pathname: state.pathname,
        title: state.title,
        sample: sampleText(state.visibleText),
      };
      await screenshot('00-login-failed').catch(() => {});
    }
    throw error;
  }
  await sleep(1600);
  await screenshot('01-admin-dashboard');
  const state = await pageState();
  const profile = await getProfileText();
  summary.role = profile.role;
  summary.login = {
    status: state.pathname === '/admin' && !/Sign In|Admin login/i.test(state.visibleText) ? 'pass' : 'fail',
    pathname: state.pathname,
    title: state.title,
    profile: profile.display,
    sample: sampleText(state.visibleText),
  };
}

async function auditNav() {
  const nav = await evalPage(() => [...document.querySelectorAll('.dash-sidebar-link')].map((link) => ({
    text: (link.textContent || '').replace(/\s+/g, ' ').trim().replace(/^\d+\s*/, ''),
    href: link.getAttribute('href'),
  })));
  const labels = nav.map((item) => item.text);
  const missing = expectedFullAdminNav.filter((label) => !labels.includes(label));
  const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
  const scopedPartnerLike = labels.length > 0 && missing.length >= 5;
  summary.nav = {
    status: labels.length && duplicates.length === 0 ? 'pass' : 'fail',
    count: labels.length,
    labels,
    missingFullAdminLabels: missing,
    duplicates,
  };
  if (scopedPartnerLike) {
    summary.findings.push({
      severity: 'warn',
      area: 'navigation',
      message: 'This login appears to expose a scoped admin navigation set rather than every full admin route.',
      missingFullAdminLabels: missing,
    });
  }
}

async function auditRoute(route) {
  const beforeConsole = summary.consoleMessages.length;
  const beforeNetwork = summary.networkFailures.length;
  await goto(route.path);
  await waitForNotBusy(14000);
  await waitForRenderedText(route.pattern, 12000).catch(() => {});
  await sleep(800);
  const state = await pageState();
  const controls = await controlAudit();
  const pathMatches = state.pathname === route.path;
  const stillLoggedIn = !/Sign In|Admin login/i.test(state.visibleText);
  const hasExpectedText = route.pattern.test(state.visibleText);
  const hasAppError = /Application error|Something went wrong|This page could not be found/i.test(state.visibleText);
  const status = pathMatches && stillLoggedIn && hasExpectedText && !hasAppError ? 'pass' : route.optional ? 'warn' : 'fail';
  await screenshot(`${String(summary.desktopRoutes.length + 2).padStart(2, '0')}-${slug(route.label)}`);
  const item = {
    label: route.label,
    path: route.path,
    status,
    finalPath: state.pathname,
    title: state.title,
    sample: sampleText(state.visibleText),
    controls,
    newConsoleMessages: summary.consoleMessages.slice(beforeConsole),
    newNetworkFailures: summary.networkFailures.slice(beforeNetwork),
  };
  summary.desktopRoutes.push(item);
  if (status === 'fail') {
    summary.findings.push({
      severity: 'fail',
      area: route.label,
      message: 'Admin route did not render the expected authenticated page.',
      path: route.path,
      finalPath: state.pathname,
      sample: item.sample,
    });
  }
}

async function auditMobileShell() {
  await goto('/admin');
  await waitForNotBusy(12000);
  await sleep(800);
  const before = await pageState();
  const opened = await clickSelector('.dash-hamburger').then(() => true).catch(() => false);
  await sleep(600);
  const state = await evalPage(() => ({
    bodyOverflow: getComputedStyle(document.body).overflow,
    sidebarOpen: Boolean(document.querySelector('.dash-sidebar.mobile-open')),
    topbarHeight: document.querySelector('.dash-topbar')?.getBoundingClientRect().height ?? 0,
    firstContentTop: document.querySelector('.dash-content')?.getBoundingClientRect().top ?? 0,
    visibleText: document.body.innerText || '',
  }));
  await screenshot('99-mobile-admin-nav');
  const status = opened && state.sidebarOpen && /Dashboard|Orders/i.test(state.visibleText) ? 'pass' : 'fail';
  summary.mobileChecks.push({
    label: 'Mobile admin shell opens navigation',
    status,
    beforePath: before.pathname,
    bodyOverflow: state.bodyOverflow,
    topbarHeight: state.topbarHeight,
    firstContentTop: state.firstContentTop,
  });
  if (status === 'fail') {
    summary.findings.push({ severity: 'fail', area: 'mobile admin shell', message: 'Mobile admin navigation did not open reliably.' });
  }
}

async function controlAudit() {
  return await evalPage(() => {
    const interactive = [...document.querySelectorAll('button, a, input, select, textarea')];
    const lowContrast = [];
    const unlabeled = [];
    for (const el of interactive) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
      if (!text && ['button', 'a', 'select'].includes(tag)) {
        unlabeled.push({ tag, html: el.outerHTML.slice(0, 120) });
      }
      const styles = getComputedStyle(el);
      const contrast = contrastRatio(styles.color, effectiveBackground(el));
      if (contrast !== null && contrast < 3) {
        lowContrast.push({ tag, text: text.slice(0, 40), contrast: Number(contrast.toFixed(2)) });
      }
    }
    return {
      interactiveCount: interactive.length,
      lowContrast: lowContrast.slice(0, 8),
      unlabeled: unlabeled.slice(0, 8),
    };

    function effectiveBackground(el) {
      const colors = [];
      let node = el;
      while (node) {
        const color = parseColor(getComputedStyle(node).backgroundColor);
        if (color && color.a > 0) colors.push(color);
        node = node.parentElement;
      }
      const base = el.closest('.dash-sidebar') ? { r: 7, g: 17, b: 31, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
      const composite = colors.reverse().reduce((background, color) => blend(color, background), base);
      return `rgb(${composite.r},${composite.g},${composite.b})`;
    }

    function contrastRatio(foreground, background) {
      const fg = parseColor(foreground);
      let bg = parseColor(background);
      if (!fg) return null;
      if (!bg || bg.a === 0) bg = { r: 255, g: 255, b: 255, a: 1 };
      const blended = blend(fg, bg);
      const l1 = luminance(blended);
      const l2 = luminance(bg);
      const light = Math.max(l1, l2);
      const dark = Math.min(l1, l2);
      return (light + 0.05) / (dark + 0.05);
    }

    function parseColor(value) {
      const match = String(value).match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(',').map((part) => Number(part.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
    }

    function blend(fg, bg) {
      const alpha = fg.a + bg.a * (1 - fg.a);
      return {
        r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / alpha),
        g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / alpha),
        b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / alpha),
      };
    }

    function luminance(color) {
      const [r, g, b] = [color.r, color.g, color.b].map((value) => {
        const srgb = value / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
  });
}

async function getProfileText() {
  return await evalPage(() => {
    const user = document.querySelector('.dash-sidebar-user');
    const sub = document.querySelector('.dash-sidebar-brand-sub');
    return {
      role: (sub?.textContent || '').replace(/\s+/g, ' ').trim(),
      display: (user?.textContent || '').replace(/\s+/g, ' ').trim(),
    };
  }).catch(() => ({ role: null, display: null }));
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

async function goto(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  await send('Page.navigate', { url });
  await waitLoad(new URL(url));
}

async function waitLoad(expectedUrl) {
  await sleep(800);
  for (let i = 0; i < 40; i += 1) {
    const state = await evalPage(() => ({
      ready: document.readyState === 'complete',
      pathname: location.pathname,
    })).catch(() => null);
    if (state?.ready && (state.pathname === expectedUrl.pathname || state.pathname === '/login')) return;
    await sleep(250);
  }
}

async function waitForRenderedText(pattern, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = (await pageState().catch(() => null))?.visibleText ?? '';
    if (text.trim().length > 0 && pattern.test(text)) return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for text: ${pattern}`);
}

async function waitForNotBusy(timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = (await pageState().catch(() => null))?.visibleText ?? '';
    if (!/Loading|Signing in/i.test(text.slice(0, 500))) return;
    await sleep(300);
  }
}

async function waitForPath(path, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await pageState();
    if (state.pathname === path) return;
    await sleep(300);
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

async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
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
    }, 20000);
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
  if (payload.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(payload.params.type)) {
    summary.consoleMessages.push({
      type: payload.params.type,
      text: payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '),
    });
  }
  if (payload.method === 'Network.loadingFailed') {
    summary.networkFailures.push({
      errorText: payload.params.errorText,
      canceled: payload.params.canceled,
      type: payload.params.type,
    });
  }
}

async function waitForPageTarget() {
  for (let i = 0; i < 70; i += 1) {
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
  writeFileSync(resolve(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
}

function sampleText(text) {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 300);
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function maskEmail(value) {
  const [local, domain] = String(value).split('@');
  if (!domain) return 'redacted';
  return `${local.slice(0, 2)}***@${domain}`;
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

function mkdtemp() {
  return mkdtempSync(join(tmpdir(), 'pepscriptrx-main-admin-'));
}

async function removeProfileDir() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true });
      return;
    } catch {
      await sleep(250);
    }
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

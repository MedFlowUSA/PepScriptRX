import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const BASE = (process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app').replace(/\/+$/, '');
const OUT_DIR = resolve('qa-artifacts', 'deep-platform-audit');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9900 + Math.floor(Math.random() * 500);
const PROFILE_DIR = mkdtempSync(join(tmpdir(), 'pepscriptrx-deep-audit-'));
const CDP_TIMEOUT_MS = numberEnv('QA_CDP_TIMEOUT_MS', 10000);
const NAVIGATION_TIMEOUT_MS = numberEnv('QA_NAVIGATION_TIMEOUT_MS', 8000);

const storefronts = [
  { path: '/', label: 'Main PepScriptRX', brand: 'PepScriptRX', checkoutScope: null },
  { path: '/rockphorm', label: 'Rock Phorm', brand: 'Rock Phorm', checkoutScope: 'ROCKPHORM' },
  { path: '/EmpireHealth&Wellness', label: 'Empire Health & Wellness', brand: 'Empire Health', checkoutScope: 'MARK65' },
  { path: '/EHWSUB', label: 'EHWSUB', brand: 'PepScriptRX', checkoutScope: 'EHWSUB' },
  { path: '/ehwsub', label: 'ehwsub', brand: 'PepScriptRX', checkoutScope: 'EHWSUB' },
  { path: '/aactivated', label: 'aactivated lowercase', brand: 'AACTIVATED', checkoutScope: 'GUY60', finalPath: '/AACTIVATED' },
  { path: '/AACTIVATED', label: 'AACTIVATED', brand: 'AACTIVATED', checkoutScope: 'GUY60' },
  { path: '/guy', label: 'Guy', brand: 'AACTIVATED', checkoutScope: 'GUY60' },
  { path: '/warxlabz', label: 'WarXlabz', brand: 'WarXlabz', checkoutScope: 'ROBERT' },
  { path: '/peakform', label: 'Peak Form', brand: 'Peak Form', checkoutScope: 'SCOTTB' },
  { path: '/alphapride', label: 'Alpha Pride', brand: 'Alpha Pride', checkoutScope: 'ALPHAPRIDE' },
  { path: '/optimax-peptide-therapy', label: 'Optimax', brand: 'Optimax', checkoutScope: 'GABE50' },
  { path: '/ronin', label: 'Ronin', brand: 'Ronin', checkoutScope: 'MGT1111' },
  { path: '/agprimelab', label: 'AG Prime Lab', brand: 'AG Prime', checkoutScope: 'AGPRIME45' },
  { path: '/vyigenix', label: 'Vyigenix', brand: 'Vyigenix', checkoutScope: 'VYIGENIX' },
  { path: '/aurora', label: 'Aurora Labs', brand: 'Aurora Labs', checkoutScope: 'AURORA' },
  { path: '/zenora', label: 'ZENORA', brand: 'ZENORA', checkoutScope: 'JESS8' },
  { path: '/PhysioPeptides', label: 'PhysioPeptides', brand: 'PhysioPeptides', checkoutScope: 'PHYSIOPEPTIDES' },
  { path: '/ginto', label: 'Ginto Wellness Labs', brand: 'Ginto', checkoutScope: 'GINTO' },
  { path: '/anatolia', label: 'Anatolia Wellness Labs', brand: 'Anatolia', checkoutScope: 'MAIN' },
  { path: '/glow', label: 'GLOW', brand: 'GLOW', checkoutScope: 'GLOW' },
];

const legalRoutes = [
  '/privacy', '/terms', '/certificates',
  '/aactivated/privacy', '/aactivated/terms', '/aactivated/certificates',
  '/alphapride/privacy', '/alphapride/terms', '/alphapride/certificates',
  '/ronin/privacy', '/ronin/terms', '/ronin/certificates',
  '/agprimelab/privacy', '/agprimelab/terms', '/agprimelab/certificates',
  '/vyigenix/privacy', '/vyigenix/terms', '/vyigenix/certificates',
  '/rockphorm/privacy', '/rockphorm/terms', '/rockphorm/certificates',
  '/aurora/privacy', '/aurora/terms', '/aurora/certificates',
  '/zenora/privacy', '/zenora/terms', '/zenora/certificates',
  '/PhysioPeptides/privacy', '/PhysioPeptides/terms', '/PhysioPeptides/certificates',
  '/ginto/privacy', '/ginto/terms', '/ginto/certificates',
  '/anatolia/privacy', '/anatolia/terms', '/anatolia/certificates',
  '/glow/privacy', '/glow/terms', '/glow/certificates',
];

const referralRoutes = ['/rick', '/mark', '/gabriel', '/dennis', '/jerry', '/r/ADONIS'];
const protectedRoutes = ['/login', '/patient', '/rep', '/admin'];
const badCopyPatterns = [/research purposes/i, /lorem ipsum/i, /coming soon/i, /pepscriptrx\.app/i];

mkdirSync(OUT_DIR, { recursive: true });

if (!BROWSER) {
  throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH.');
}

const summary = {
  base: BASE,
  checkedAt: new Date().toISOString(),
  storefronts: [],
  legalRoutes: [],
  referrals: [],
  protectedRoutes: [],
  consoleErrors: [],
  networkFailures: [],
};

const browser = spawn(BROWSER, [
  '--headless=new',
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--disable-background-networking',
  '--disable-extensions',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });
let browserStartupFailure = null;
browser.once('error', (error) => {
  browserStartupFailure = new Error(`Could not launch browser: ${error.message}`);
});
browser.once('exit', (code, signal) => {
  browserStartupFailure = new Error(`Browser exited before DevTools was ready: code=${code ?? 'null'} signal=${signal ?? 'null'}`);
});

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

  for (const route of storefronts) {
    await auditStep(summary.storefronts, {
      label: route.label,
      path: route.path,
      run: () => auditStorefront(route),
    });
  }

  for (const path of legalRoutes) {
    await auditStep(summary.legalRoutes, {
      path,
      run: () => auditSimpleRoute(path, /(Privacy|Terms|Certificate|Quality|COA|PepScriptRX|AACTIVATED|Rock Phorm|Ronin|Vyigenix|Alpha Pride|AG Prime)/i),
    });
  }

  for (const path of referralRoutes) {
    await auditStep(summary.referrals, {
      path,
      run: () => auditReferral(path),
    });
  }

  for (const path of protectedRoutes) {
    await auditStep(summary.protectedRoutes, {
      path,
      run: () => auditSimpleRoute(path, /(Login|Customer Portal|Rep|Admin|Dashboard|Sign In|PepScriptRX)/i),
    });
  }
} finally {
  summary.finishedAt = new Date().toISOString();
  delete summary.currentCheck;
  writeSummary();
  ws?.close();
  browser.kill();
  await removeProfileDir();
}

console.log(JSON.stringify(summary, null, 2));
process.exit(hasFailure() ? 1 : 0);

async function auditStorefront(route) {
  await clearStorage();
  await goto(route.path);
  await dismissGate();
  await sleep(900);
  const state = await pageState();
  const text = state.visibleText;
  const addButtons = await countButtons(/add to cart/i);
  const priceCount = await countText(/\$\d/);
  const productSignal = addButtons > 0 || /catalog|products|refill|start/i.test(text);
  const badCopy = badCopyPatterns.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
  const brandOk = text.toLowerCase().includes(route.brand.toLowerCase()) || state.title.toLowerCase().includes(route.brand.toLowerCase());
  const routeOk = !route.finalPath || state.pathname === route.finalPath;
  const checkout = route.checkoutScope && addButtons > 0 ? await auditCheckout(route) : null;

  return {
    label: route.label,
    path: route.path,
    finalUrl: state.href,
    status: brandOk && routeOk && productSignal && badCopy.length === 0 && (!checkout || checkout.ok) ? 'pass' : 'warn',
    brandOk,
    routeOk,
    productSignal,
    addButtons,
    priceCount,
    badCopy,
    checkout,
    sample: text.slice(0, 260).replace(/\s+/g, ' '),
  };
}

async function auditStep(collection, step) {
  summary.currentCheck = {
    label: step.label ?? step.path,
    path: step.path,
    startedAt: new Date().toISOString(),
  };
  writeSummary();
  try {
    collection.push(await step.run());
  } catch (error) {
    collection.push({
      label: step.label,
      path: step.path,
      status: 'warn',
      error: String(error?.message || error),
      sample: '',
    });
  } finally {
    delete summary.currentCheck;
    writeSummary();
  }
}

async function auditCheckout(route) {
  await clickByText(/add to cart/i);
  await sleep(600);
  await clickByText(/checkout now|proceed to checkout|checkout available/i);
  await sleep(900);
  const state = await evalPage(() => ({
    href: location.href,
    text: document.body.innerText.slice(0, 900),
    cart: sessionStorage.getItem('pepscriptrx_portal_cart'),
  }));
  const cart = readJson(state.cart);
  const haystack = `${state.href} ${state.text} ${state.cart}`.toUpperCase();
  const scopeOk = haystack.includes(String(route.checkoutScope).toUpperCase());
  const checkoutPathOk = /\/start|\/checkout/.test(new URL(state.href).pathname);
  return {
    ok: scopeOk && checkoutPathOk,
    href: state.href,
    scopeOk,
    checkoutPathOk,
    scopeCode: cart?.scope_code ?? null,
    rep: cart?.rep ?? null,
    storeName: cart?.store_name ?? null,
    firstItem: cart?.items?.[0]?.name ?? null,
    total: cart?.total ?? null,
  };
}

async function auditSimpleRoute(path, pattern) {
  await clearStorage();
  await goto(path);
  await dismissGate();
  await sleep(650);
  const state = await pageState();
  const badCopy = badCopyPatterns.filter((badPattern) => badPattern.test(state.visibleText)).map((badPattern) => String(badPattern));
  return {
    path,
    finalUrl: state.href,
    status: pattern.test(state.visibleText) && badCopy.length === 0 ? 'pass' : 'warn',
    badCopy,
    sample: state.visibleText.slice(0, 220).replace(/\s+/g, ' '),
  };
}

async function auditReferral(path) {
  await clearStorage();
  await goto(path);
  await dismissGate();
  await sleep(900);
  const state = await evalPage(() => ({
    href: location.href,
    text: document.body.innerText.slice(0, 700),
    referral: localStorage.getItem('pepscriptrx_referral') || sessionStorage.getItem('pepscriptrx_referral'),
  }));
  const referral = readJson(state.referral);
  const ok = !/Application error|could not be found/i.test(state.text)
    && state.href.startsWith(BASE)
    && Boolean(referral?.repSlug || /\/rockphorm|\/start|\/AACTIVATED|\/EmpireHealth|\/optimax/i.test(state.href));
  return {
    path,
    finalUrl: state.href,
    status: ok ? 'pass' : 'warn',
    repSlug: referral?.repSlug ?? null,
    discountCode: referral?.discountCode ?? null,
    portalPath: referral?.portalPath ?? null,
    sample: state.text.replace(/\s+/g, ' ').slice(0, 220),
  };
}

async function dismissGate() {
  await clickByText(/21 years|21\+|older/i);
  await sleep(200);
  await clickByText(/confirm age|continue/i);
  await sleep(500);
}

async function clickByText(pattern) {
  return await evalPage((source) => {
    const regex = new RegExp(source, 'i');
    const candidates = [...document.querySelectorAll('button, a, label, input[type="checkbox"]')];
    const target = candidates.find((node) => regex.test(node.textContent || node.getAttribute('aria-label') || ''));
    if (!target) return false;
    if (target.tagName === 'LABEL') {
      const input = target.querySelector('input') || document.getElementById(target.getAttribute('for') || '');
      input?.click();
    }
    target.click?.();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, pattern.source);
}

async function countButtons(pattern) {
  return await evalPage((source) => {
    const regex = new RegExp(source, 'i');
    return [...document.querySelectorAll('button, a')].filter((node) => regex.test(node.textContent || '')).length;
  }, pattern.source);
}

async function countText(pattern) {
  return await evalPage((source) => {
    const regex = new RegExp(source, 'i');
    return (document.body.innerText.match(regex) || []).length;
  }, pattern.source);
}

async function goto(path) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const expected = new URL(url);
  const before = await pageState().catch(() => null);
  await send('Page.navigate', { url }, NAVIGATION_TIMEOUT_MS).catch(async () => {
    await evalPage((nextUrl) => { window.location.assign(nextUrl); }, url).catch(() => {});
  });
  await waitLoad(expected, before?.href);
  const after = await pageState().catch(() => null);
  const pathOk = after?.pathname === expected.pathname || after?.href === url;
  if (!pathOk) {
    await evalPage((nextUrl) => { window.location.assign(nextUrl); }, url);
    await waitLoad(expected, after?.href);
  }
}

async function waitLoad(expectedUrl, previousHref) {
  await sleep(900);
  for (let i = 0; i < 40; i += 1) {
    const state = await evalPage(() => ({
      ready: document.readyState === 'complete',
      href: location.href,
      pathname: location.pathname,
    })).catch(() => null);
    if (state?.ready) {
      const changedPage = previousHref && state.href !== previousHref;
      if (state.pathname === expectedUrl.pathname || changedPage) return;
    }
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
    title: document.title,
    visibleText: document.body.innerText || '',
  }));
}

async function evalPage(fn, arg) {
  const expression = `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

function send(method, params = {}, timeoutMs = CDP_TIMEOUT_MS) {
  const callId = ++id;
  return new Promise((resolveSend, rejectSend) => {
    pending.set(callId, { resolveSend, rejectSend });
    try {
      ws.send(JSON.stringify({ id: callId, method, params }));
    } catch (error) {
      pending.delete(callId);
      rejectSend(error);
      return;
    }
    setTimeout(() => {
      if (!pending.has(callId)) return;
      pending.delete(callId);
      rejectSend(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
  });
}

function onMessage(message) {
  const payload = JSON.parse(message.data);
  if (payload.id && pending.has(payload.id)) {
    const { resolveSend, rejectSend } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) rejectSend(new Error(JSON.stringify(payload.error)));
    else resolveSend(payload.result);
    return;
  }
  if (payload.method === 'Runtime.consoleAPICalled' && payload.params.type === 'error') {
    summary.consoleErrors.push(payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '));
  }
  if (payload.method === 'Network.loadingFailed') {
    summary.networkFailures.push(payload.params);
  }
}

async function waitForPageTarget() {
  for (let i = 0; i < 80; i += 1) {
    if (browserStartupFailure) throw browserStartupFailure;
    const page = await fetchPageTarget().catch(() => null);
    if (page?.webSocketDebuggerUrl) return page;
    await sleep(250);
  }
  throw new Error('Could not find browser DevTools target.');
}

async function fetchPageTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  const targets = await res.json();
  return targets.find((target) => target.type === 'page');
}

function onceOpen(socket) {
  return new Promise((resolveOpen) => socket.addEventListener('open', resolveOpen, { once: true }));
}

function readJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasFailure() {
  return [...summary.storefronts, ...summary.legalRoutes, ...summary.referrals, ...summary.protectedRoutes].some((item) => item.status !== 'pass')
    || summary.consoleErrors.length > 0;
}

function writeSummary() {
  writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function numberEnv(name, defaultValue) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
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

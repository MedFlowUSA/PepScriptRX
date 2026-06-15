import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = (process.env.QA_BASE_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const OUT = resolve('qa-artifacts', 'product-card-layout');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9800 + Math.floor(Math.random() * 500);
const PROFILE = resolve('.qa-product-card-layout-profile');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'iphone', width: 390, height: 844, mobile: true },
  { name: 'android', width: 412, height: 915, mobile: true },
];

mkdirSync(OUT, { recursive: true });

if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
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
  route: '/start?discount=PEP10&source=main',
  checkedAt: new Date().toISOString(),
  screenshots: [],
  viewports: [],
};

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

  for (const viewport of VIEWPORTS) {
    await setViewport(viewport);
    await goto(summary.route);
    await sleep(1400);
    const report = await evalPage(() => {
      const intersects = (a, b) => {
        if (!a || !b) return false;
        return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      };
      const rect = (node) => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      };
      const cards = [...document.querySelectorAll('.product-select-card')].slice(0, 12).map((card) => {
        const content = card.querySelector('[data-product-card-content]');
        const image = card.querySelector('[data-product-card-image]');
        const chevron = card.querySelector('[data-product-card-chevron]');
        const productName = content?.querySelector('div')?.textContent?.trim() || 'unknown product';
        const contentRect = rect(content);
        const imageRect = rect(image);
        const chevronRect = rect(chevron);
        const cardRect = rect(card);
        return {
          productName,
          contentRect,
          imageRect,
          chevronRect,
          cardRect,
          contentImageOverlap: intersects(contentRect, imageRect),
          contentChevronOverlap: intersects(contentRect, chevronRect),
          imageChevronOverlap: intersects(imageRect, chevronRect),
          imageTooLarge: Boolean(imageRect && imageRect.width > 96 && window.innerWidth > 700) || Boolean(imageRect && imageRect.width > 72 && window.innerWidth <= 700),
          horizontalOverflow: Boolean(cardRect && (cardRect.left < -1 || cardRect.right > window.innerWidth + 1)),
        };
      });
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        cardCount: cards.length,
        cards,
      };
    });

    const failures = report.cards.filter((card) => (
      card.contentImageOverlap
      || card.contentChevronOverlap
      || card.imageChevronOverlap
      || card.imageTooLarge
      || card.horizontalOverflow
    ));
    if (report.cardCount === 0) {
      failures.push({ productName: 'product-card-list', reason: 'No product cards found on the rendered page.' });
    }
    const screenshot = await captureScreenshot(`start-product-cards-${viewport.name}`);
    summary.viewports.push({ ...viewport, ok: failures.length === 0, failures, cardCount: report.cardCount });
    summary.screenshots.push(screenshot);
  }

  writeFileSync(resolve(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  finish(summary.viewports.every((viewport) => viewport.ok) ? 0 : 1);
} catch (error) {
  console.error(error);
  finish(1);
}

async function setViewport(viewport) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    mobile: Boolean(viewport.mobile),
  });
}

async function goto(path) {
  await send('Page.navigate', { url: `${BASE}${path}` });
  await waitForLoad(path);
}

async function waitForLoad(path) {
  let lastState = null;
  for (let i = 0; i < 160; i += 1) {
    lastState = await evalPage(() => ({
      readyState: document.readyState,
      href: window.location.href,
      cardCount: document.querySelectorAll('.product-select-card').length,
      text: document.body?.innerText?.slice(0, 160) || '',
    }));
    if (lastState.readyState === 'complete' && lastState.href.includes(path.split('?')[0]) && lastState.cardCount > 0) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for page load: ${JSON.stringify(lastState)}`);
}

async function captureScreenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = resolve(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(result.data, 'base64'));
  return file;
}

async function evalPage(fn) {
  const result = await send('Runtime.evaluate', {
    expression: `(${fn})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

function send(method, params = {}) {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(messageId)) return;
      pending.delete(messageId);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 15000);
  });
}

async function waitForPageTarget() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await response.json();
      const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
      // Browser still starting.
    }
    await sleep(250);
  }
  throw new Error('Could not find a browser DevTools target.');
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

function finish(code) {
  try {
    ws?.close();
  } catch {
    // Ignore shutdown errors.
  }
  browser.kill();
  process.exit(code);
}

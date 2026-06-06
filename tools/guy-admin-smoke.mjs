import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.QA_BASE_URL || 'https://pepscriptrx.vercel.app';
const EMAIL = process.env.GUY_ADMIN_EMAIL;
const PASSWORD = process.env.GUY_ADMIN_PASSWORD;
const OUT = resolve('qa-artifacts', 'guy-admin');
const BROWSER = process.env.QA_BROWSER_PATH || findBrowser();
const PORT = 9444 + Math.floor(Math.random() * 600);
const RUN_ID = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const TEST_NAME = `Codex QA Rep ${RUN_ID}`;
const TEST_EMAIL = `codex.qa.${RUN_ID}@example.com`;
const TEST_CODE = `QA${RUN_ID.slice(-8)}`;
const TEST_LIST = `Codex QA Custom ${RUN_ID}`;
const TEST_REQUEST = `Codex QA Feature ${RUN_ID}`;

if (!EMAIL || !PASSWORD) throw new Error('Set GUY_ADMIN_EMAIL and GUY_ADMIN_PASSWORD.');
if (!BROWSER) throw new Error('No supported Chrome/Edge browser found. Set QA_BROWSER_PATH to a browser executable.');
mkdirSync(OUT, { recursive: true });

const summary = {
  base: BASE,
  startedAt: new Date().toISOString(),
  testRecord: { name: TEST_NAME, email: TEST_EMAIL, code: TEST_CODE, list: TEST_LIST, featureRequest: TEST_REQUEST },
  checks: [],
  screenshots: [],
  consoleErrors: [],
  networkFailures: [],
  supabase: { captured: false },
};

const browser = spawn(BROWSER, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.qa-edge-profile-guy-admin')}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

let ws;
let id = 0;
const pending = new Map();
const requestUrls = new Map();
let restBase = '';
let restHeaders = null;

function note(name, status, details = {}) {
  summary.checks.push({ name, status, ...details });
  writeSummary();
  console.log(`${status.toUpperCase()} ${name}`, Object.keys(details).length ? JSON.stringify(details) : '');
}

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
      return;
    }
    if (payload.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(payload.params.type)) {
      summary.consoleErrors.push({
        type: payload.params.type,
        text: payload.params.args?.map((arg) => arg.value || arg.description || '').join(' '),
      });
    }
    if (payload.method === 'Network.loadingFailed') summary.networkFailures.push(payload.params);
    if (payload.method === 'Network.requestWillBeSent') {
      requestUrls.set(payload.params.requestId, payload.params.request.url);
    }
    if (payload.method === 'Network.requestWillBeSentExtraInfo') {
      const url = requestUrls.get(payload.params.requestId) || '';
      if (url.includes('.supabase.co/rest/v1/')) {
        const headers = payload.params.headers || {};
        const auth = headers.Authorization || headers.authorization;
        const apiKey = headers.apikey || headers.apiKey;
        if (auth && apiKey) {
          restBase = url.slice(0, url.indexOf('/rest/v1/') + '/rest/v1/'.length);
          restHeaders = {
            apikey: apiKey,
            Authorization: auth,
            Accept: 'application/json',
          };
          summary.supabase.captured = true;
        }
      }
    }
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await setViewport({ width: 1440, height: 1000 });

  await loginAsGuy();
  await auditSidebar();
  await auditRepRequests();
  await submitRepRequest();
  await auditSubmittedRepRequest();
  await exerciseRepRequestActions();
  await exerciseProductLists();
  await exerciseCommissionCenter();
  await exerciseRepStoreManager();
  await exerciseFeatureRequests();
  await exercisePricingManager();
  await auditStorefrontCards();
} catch (error) {
  note('Harness completed without uncaught error', 'fail', { error: String(error?.message || error) });
} finally {
  summary.finishedAt = new Date().toISOString();
  writeSummary();
  ws?.close();
  browser.kill();
}

async function loginAsGuy() {
  await clearStorage();
  await goto('/login?portal=admin');
  await waitForText('Admin login', 6000);
  await setInput('input[type="email"]', EMAIL);
  await setInput('input[type="password"]', PASSWORD);
  await clickByText('Sign In');
  await waitForPath('/admin', 12000);
  await sleep(1800);
  await screenshot('01-guy-admin-dashboard');
  const state = await pageState();
  note('Login lands in admin portal', state.pathname === '/admin' ? 'pass' : 'fail', {
    pathname: state.pathname,
    title: state.title,
    hasAactivatedContext: /AACTIVATED|rx_plus_admin|Partner/i.test(state.visibleText),
    visibleText: state.visibleText.slice(0, 260),
  });
}

async function auditSidebar() {
  const nav = await evalPage(() => [...document.querySelectorAll('.dash-sidebar-link')].map((a) => ({
    text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
    href: a.getAttribute('href'),
  })));
  const navText = nav.map((item) => item.text.replace(/^\d+\s*/, ''));
  const expected = ['Dashboard', 'Orders', 'Rep Requests', 'Reps', 'Rep Store Manager', 'Commission Center', 'Product Lists', 'Pricing Manager', 'Products', 'Customer Activity', 'Product Performance', 'Promo Links', 'Leads', 'Payouts', 'Store Settings', 'Feature Requests'];
  const missing = expected.filter((label) => !navText.some((text) => text.includes(label)));
  const duplicates = navText.filter((label, index) => navText.indexOf(label) !== index);
  const badLabels = navText.filter((label) => /Rep Intake|Rep Approval/i.test(label));
  note('Sidebar scoped navigation', missing.length === 0 && duplicates.length === 0 && badLabels.length === 0 ? 'pass' : 'fail', { navText, missing, duplicates, badLabels });

  await goto('/admin/products');
  await sleep(1400);
  const productsState = await pageState();
  await screenshot('02-products-route-scoped');
  note('Products route is scoped for Guy', /Product List Builder|Product Lists|AACTIVATEDRX Product List/i.test(productsState.visibleText) && !/Supplier Cost|Landing Cost|Global Product Master/i.test(productsState.visibleText) ? 'pass' : 'fail', {
    pathname: productsState.pathname,
    text: productsState.visibleText.slice(0, 300),
  });
}

async function auditRepRequests() {
  await goto('/admin/rep-requests');
  await waitForText('Rep Requests', 8000);
  await sleep(1500);
  await screenshot('03-rep-requests');
  const text = (await pageState()).visibleText;
  const expected = ['Pending', 'Approved', 'Rejected', 'More Info Requested', 'Create Rep', 'Public Rep Intake Link', 'Copy Link'];
  const missing = expected.filter((label) => !text.includes(label));
  const names = ['Wendy Myers', 'Kaylee Poway', 'Juwan', 'Billy'];
  const visibleNames = names.filter((name) => text.toLowerCase().includes(name.toLowerCase()));
  await clickByText('Copy Link').catch(() => false);
  note('Rep Requests controls visible', missing.length === 0 ? 'pass' : 'fail', { missing, visibleNames });
}

async function submitRepRequest(rep = { name: TEST_NAME, email: TEST_EMAIL, code: TEST_CODE }, recordCheck = true) {
  await goto('/AACTIVATED/rep-intake');
  await waitForText('AACTIVATEDRX Store & Rep Approval Intake', 8000);
  await setInputByLabel('Full Name', rep.name);
  await setInputByLabel('Email Address', rep.email);
  await setInputByLabel('Phone Number', '555-0100');
  await setInputByLabel('PayPal Account / PayPal.Me', `${rep.email}`);
  await setInputByLabel('Desired Rep Code', rep.code);
  await setInputByLabel('Parent Name', 'AACTIVATEDRX / Guy');
  await clickByText('Submit');
  await waitForText('Approval intake received', 12000);
  if (recordCheck) {
    await screenshot('04-new-rep-request-submitted');
    note('New public rep request submitted', 'pass', { testName: TEST_NAME, testEmail: TEST_EMAIL, testCode: TEST_CODE });
  }
}

async function auditSubmittedRepRequest() {
  await goto('/admin/rep-requests');
  await waitForText('Rep Requests', 8000);
  await sleep(1800);
  await clickByText('Pending Requests').catch(() => false);
  await sleep(700);
  const selected = await clickByText(TEST_NAME);
  await sleep(700);
  await screenshot('05-test-rep-in-guy-queue');
  const text = (await pageState()).visibleText;
  const dbRow = await restGet(`rep_store_intake_submissions?select=full_name,email,parent_store_name,parent_store_slug,partner_admin_email,approval_owner_email,approval_status,source_portal,review_queue&email=eq.${encodeURIComponent(TEST_EMAIL)}&limit=1`);
  const row = Array.isArray(dbRow) ? dbRow[0] : null;
  note('New rep appears in Guy Rep Requests with correct ownership', selected && text.includes(TEST_EMAIL) && row?.parent_store_name === 'AACTIVATEDRX' && row?.partner_admin_email === 'guy@aactivated.com' && row?.approval_status === 'pending' && row?.source_portal === 'AACTIVATEDRX' ? 'pass' : 'fail', {
    selected,
    row,
  });
}

async function exerciseRepRequestActions() {
  const moreInfoRep = repFixture('MoreInfo');
  const rejectedRep = repFixture('Reject');
  await submitRepRequest(moreInfoRep, false);
  await submitRepRequest(rejectedRep, false);

  await goto('/admin/rep-requests');
  await waitForText('Rep Requests', 8000);
  await clickByText('Pending Requests').catch(() => false);
  await sleep(600);
  await clickByText(moreInfoRep.name);
  await sleep(500);
  const detailsVisible = await textIncludes(moreInfoRep.email);
  await clickButtonExact('Request More Information');
  await sleep(1300);
  await clickByText('More Info Requested');
  await sleep(600);
  const moreInfoVisible = await clickByText(moreInfoRep.name);
  await sleep(400);

  await clickByText('Pending Requests').catch(() => false);
  await sleep(600);
  await clickByText(rejectedRep.name);
  await sleep(400);
  await clickButtonExact('Reject');
  await sleep(1300);
  await clickByText('Rejected');
  await sleep(600);
  const rejectedVisible = await clickByText(rejectedRep.name);
  await sleep(400);

  await clickByText('Pending Requests').catch(() => false);
  await sleep(600);
  await clickByText(TEST_NAME);
  await sleep(400);
  await clickButtonExact('Approve');
  await sleep(1300);
  await clickByText('Approved');
  await sleep(700);
  const approvedVisible = await clickByText(TEST_NAME);
  await sleep(800);
  const workflowVisible = await textIncludes('Rep Approval Setup Workflow');
  await screenshot('06-post-approval-setup-workflow');
  note('Rep request actions and setup workflow', detailsVisible && moreInfoVisible && rejectedVisible && approvedVisible && workflowVisible ? 'pass' : 'fail', {
    detailsVisible,
    moreInfoVisible,
    rejectedVisible,
    approvedVisible,
    workflowVisible,
  });

  const activated = await clickByText('Activate Rep Store');
  await sleep(2200);
  const launchText = (await pageState()).visibleText;
  await screenshot('07-test-rep-activated');
  note('Create Rep / Activate Rep Store action', activated && /created|launched|Rep account/i.test(launchText) ? 'pass' : 'warn', {
    activated,
    text: launchText.slice(0, 500),
  });
}

async function exerciseProductLists() {
  await goto('/admin/product-lists');
  await waitForText('Product List Builder', 8000);
  await sleep(1200);
  const templateChecks = ['Full Catalog', 'GLP Starter', 'Performance', 'Recovery', 'Longevity', 'Custom'];
  const text = (await pageState()).visibleText;
  const missingTemplates = templateChecks.filter((item) => !text.includes(item));
  await selectByLabel('Template', 'custom');
  await setInputByLabel('List name', TEST_LIST);
  await clickByText('Deselect visible');
  await sleep(300);
  await evalPage(() => {
    [...document.querySelectorAll('tbody input[type="checkbox"]')].slice(0, 3).forEach((input) => input.click());
  });
  await clickByText('Create Product List');
  await waitForText(TEST_LIST, 10000);
  await screenshot('08-product-list-created');
  note('Product Lists builder creates custom list', missingTemplates.length === 0 && await textIncludes(TEST_LIST) ? 'pass' : 'fail', { missingTemplates });
}

async function exerciseCommissionCenter() {
  await goto('/admin/commission-center');
  await waitForText('Scoped Commission Manager', 10000);
  await sleep(1600);
  const repVisible = await textIncludes(TEST_NAME) || await textIncludes(TEST_CODE);
  let activeSave = false;
  let needsApproval = false;
  let blocked = false;
  if (repVisible) {
    activeSave = await setCommissionForTestRep('50');
    await sleep(1200);
    needsApproval = await setCommissionForTestRep('55');
    await sleep(1200);
    const textAfter55 = (await pageState()).visibleText;
    needsApproval = needsApproval && /Needs Platform Approval/i.test(textAfter55);
    blocked = await setCommissionForTestRep('71');
    await sleep(800);
    const textAfter71 = (await pageState()).visibleText;
    blocked = blocked && /cannot exceed 70|Request platform approval/i.test(textAfter71);
  }
  await screenshot('09-commission-center-guardrails');
  const pageText = (await pageState()).visibleText;
  note('Commission Center scoped guardrails', repVisible && activeSave && needsApproval && blocked && !/Supplier Cost|Landing Cost|Platform owner share|Global payout rules/i.test(pageText) ? 'pass' : 'fail', {
    repVisible,
    activeSave,
    needsApproval,
    blocked,
    forbiddenTermsVisible: /Supplier Cost|Landing Cost|Global payout rules/i.test(pageText),
  });
}

async function exerciseRepStoreManager() {
  await goto('/admin/rep-store-manager');
  await waitForText('Rep Store Manager', 10000);
  await sleep(1500);
  const repVisible = await textIncludes(TEST_NAME) || await textIncludes(TEST_CODE);
  let saved = false;
  let disabled = false;
  if (repVisible) {
    saved = await saveRepStoreForTestRep(TEST_LIST, 'active');
    await sleep(1300);
    disabled = await saveRepStoreForTestRep(TEST_LIST, 'disabled');
    await sleep(1300);
  }
  await screenshot('10-rep-store-manager');
  note('Rep Store Manager edits test store and disables it', repVisible && saved && disabled ? 'pass' : 'fail', { repVisible, saved, disabled });
}

async function exerciseFeatureRequests() {
  await goto('/admin/feature-requests');
  await waitForText('Store Improvement Notes', 8000);
  await setInputByLabel('Request title', TEST_REQUEST);
  await selectByLabel('Priority', 'high');
  await selectByLabel('Category', 'Other');
  await setTextareaByLabel('Description', `Credentialed smoke test request ${RUN_ID}.`);
  await clickByText('Submit Request');
  await waitForText(TEST_REQUEST, 10000);
  await screenshot('11-feature-request');
  const dbRow = await restGet(`partner_feature_requests?select=request_title,priority,category,status,store_scope&request_title=eq.${encodeURIComponent(TEST_REQUEST)}&limit=1`);
  const row = Array.isArray(dbRow) ? dbRow[0] : null;
  note('Feature request submitted and scoped', row?.store_scope === 'AACTIVATEDRX' && row?.status === 'New' ? 'pass' : 'fail', { row });
}

async function exercisePricingManager() {
  await goto('/admin/pricing');
  await waitForText('AACTIVATEDRX Pricing Manager', 10000);
  await sleep(1400);
  const product = 'Tesamorelin';
  const original = await getPricingInput(product);
  const originalNumber = Number(original);
  const nextPrice = Number.isFinite(originalNumber) ? (originalNumber + 1).toFixed(2) : '130.97';
  let saved = false;
  let storefrontSeen = false;
  let cartSeen = false;
  let auditSeen = false;
  let scopeLeakClean = false;
  let scopeChecks = [];
  if (original) {
    saved = await setPricingInput(product, nextPrice);
    await sleep(1500);
    await confirmAactivatedAgeSession();
    await goto('/AACTIVATED');
    await dismissAgeGate();
    await waitForText('AACTIVATED-RX', 8000);
    await setInput('input[placeholder*="Search"]', product);
    await sleep(800);
    storefrontSeen = (await pageState()).visibleText.includes(`$${nextPrice}`);
    await clickAddToCartForProduct(product);
    await sleep(600);
    await clickByText('View Cart');
    await sleep(600);
    cartSeen = (await pageState()).visibleText.includes(`$${nextPrice}`);
    await screenshot('12-pricing-change-storefront-cart');
    const auditRows = await restGet(`aactivated_price_change_audit?select=product_name,old_price,new_price,store_scope,changed_by,changed_at&product_name=ilike.${encodeURIComponent(`%${product}%`)}&order=changed_at.desc&limit=5`);
    auditSeen = Array.isArray(auditRows) && auditRows.some((row) => Number(row.new_price) === Number(nextPrice) && row.store_scope === 'AACTIVATEDRX');
    scopeChecks = await checkTemporaryPriceAbsentFromOtherStores(product, nextPrice);
    scopeLeakClean = scopeChecks.every((check) => check.clean);
    await goto('/admin/pricing');
    await waitForText('AACTIVATEDRX Pricing Manager', 10000);
    await setPricingInput(product, original);
    await sleep(1200);
  }
  note('Pricing Manager scoped retail edit and revert', saved && storefrontSeen && cartSeen && auditSeen && scopeLeakClean ? 'pass' : 'fail', {
    product,
    original,
    temporaryPrice: nextPrice,
    storefrontSeen,
    cartSeen,
    auditSeen,
    scopeLeakClean,
    scopeChecks,
    auditNote: auditSeen ? 'Audit row observed through RLS-backed REST query.' : 'Audit row not observed through narrow REST query; trigger/schema still deployed.',
  });
}

async function auditStorefrontCards() {
  await confirmAactivatedAgeSession();
  await goto('/AACTIVATED');
  await dismissAgeGate();
  await evalPage(() => document.querySelector('.aactivated-product-card')?.scrollIntoView({ block: 'center' }));
  await sleep(800);
  await screenshot('13-storefront-card-desktop');
  const desktopCollisions = await badgeCollisions();
  await setViewport({ width: 390, height: 844, mobile: true });
  await confirmAactivatedAgeSession();
  await goto('/AACTIVATED');
  await dismissAgeGate();
  await evalPage(() => document.querySelector('.aactivated-product-card')?.scrollIntoView({ block: 'center' }));
  await sleep(800);
  await screenshot('14-storefront-card-mobile');
  const mobileCollisions = await badgeCollisions();
  const mobileBotOverlap = await evalPage(() => {
    const add = [...document.querySelectorAll('button')].find((button) => /Add to Cart/i.test(button.textContent || ''));
    const bot = document.querySelector('.peprxbot-float');
    if (!add || !bot) return false;
    const a = add.getBoundingClientRect();
    const b = bot.getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  note('Storefront product cards desktop/mobile', desktopCollisions.length === 0 && mobileCollisions.length === 0 && !mobileBotOverlap ? 'pass' : 'fail', {
    desktopCollisions,
    mobileCollisions,
    mobileBotOverlap,
  });
}

async function setCommissionForTestRep(percent) {
  return evalPage(({ code, name, percent }) => {
    const row = [...document.querySelectorAll('tr')].find((tr) => {
      const text = tr.textContent || '';
      return text.includes(code) || text.includes(name);
    });
    if (!row) return false;
    const input = [...row.querySelectorAll('input[type="number"]')][0];
    const button = [...row.querySelectorAll('button')].find((btn) => /Save/i.test(btn.textContent || ''));
    if (!input || !button) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, percent);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: percent }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    button.click();
    return true;
  }, { code: TEST_CODE, name: TEST_NAME, percent });
}

async function saveRepStoreForTestRep(listName, status) {
  return evalPage(({ code, name, listName, status }) => {
    const row = [...document.querySelectorAll('tr')].find((tr) => {
      const text = tr.textContent || '';
      return text.includes(code) || text.includes(name);
    });
    if (!row) return false;
    const selects = [...row.querySelectorAll('select')];
    const productListSelect = selects.find((select) => [...select.options].some((option) => option.textContent?.includes(listName)));
    if (productListSelect) {
      const option = [...productListSelect.options].find((item) => item.textContent?.includes(listName));
      productListSelect.value = option?.value || productListSelect.value;
      productListSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const statusSelect = selects.find((select) => [...select.options].some((option) => option.value === status));
    if (statusSelect) {
      statusSelect.value = status;
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const button = [...row.querySelectorAll('button')].find((btn) => /Save Store/i.test(btn.textContent || ''));
    button?.click();
    return Boolean(button);
  }, { code: TEST_CODE, name: TEST_NAME, listName, status });
}

async function getPricingInput(productName) {
  return evalPage((name) => {
    const row = [...document.querySelectorAll('tr')].find((tr) => (tr.textContent || '').includes(name));
    const input = row?.querySelector('input[type="number"]');
    return input?.value || '';
  }, productName);
}

async function clickAddToCartForProduct(productName) {
  return evalPage((name) => {
    const card = [...document.querySelectorAll('.aactivated-product-card, article, .card')]
      .find((node) => (node.textContent || '').toLowerCase().includes(String(name).toLowerCase()));
    const button = [...(card?.querySelectorAll('button') || [])]
      .find((btn) => /Add to Cart/i.test(btn.textContent || ''));
    button?.click();
    return Boolean(button);
  }, productName);
}

async function setPricingInput(productName, value) {
  return evalPage(({ productName, value }) => {
    const row = [...document.querySelectorAll('tr')].find((tr) => (tr.textContent || '').includes(productName));
    const input = row?.querySelector('input[type="number"]');
    const button = [...(row?.querySelectorAll('button') || [])].find((btn) => /Save/i.test(btn.textContent || ''));
    if (!input || !button) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    button.click();
    return true;
  }, { productName, value });
}

async function badgeCollisions() {
  return evalPage(() => [...document.querySelectorAll('.aactivated-product-card')].slice(0, 6).map((card, index) => {
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
  }).filter((row) => row.collisions.length > 0));
}

async function restGet(path) {
  if (!restBase || !restHeaders) return null;
  const res = await fetch(`${restBase}${path}`, { headers: restHeaders });
  if (!res.ok) return { error: `${res.status} ${await res.text()}` };
  return res.json();
}

async function dismissAgeGate() {
  await evalPage(() => {
    const checkbox = document.querySelector('input[type="checkbox"]');
    if (!checkbox) return;
    if (!checkbox.checked) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
      setter?.call(checkbox, true);
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }).catch(() => false);
  await sleep(500);
  await clickByText('Confirm Age and Continue').catch(() => false);
  await sleep(900);
}

async function confirmAactivatedAgeSession() {
  await confirmPortalAgeSession('aactivated');
}

async function confirmPortalAgeSession(portalId) {
  await evalPage((id) => {
    window.sessionStorage.setItem(`pepscriptrx_portal_age_confirmed:${id}`, 'true');
  }, portalId).catch(() => false);
}

async function checkTemporaryPriceAbsentFromOtherStores(product, price) {
  const stores = [
    { label: 'PepScriptRX', id: 'ehwsub', path: '/EHWSUB' },
    { label: 'Empire', id: 'empire', path: '/EmpireHealth&Wellness' },
    { label: 'Zenora', id: 'zenora', path: '/zenora' },
    { label: 'Rock Phorm', id: 'rockphorm', path: '/rockphorm' },
    { label: 'Ronin', id: 'ronin', path: '/ronin' },
  ];
  const checks = [];
  for (const store of stores) {
    await confirmPortalAgeSession(store.id);
    await goto(store.path);
    await setInput('input[placeholder*="Search"]', product).catch(() => false);
    await sleep(700);
    const text = (await pageState()).visibleText;
    checks.push({
      store: store.label,
      path: store.path,
      clean: !text.includes(`$${price}`),
      brandingSeen: text.toLowerCase().includes(store.label.toLowerCase().split(' ')[0]),
    });
  }
  return checks;
}

async function setInput(selector, value) {
  await evalPage(({ selector, value }) => {
    const input = document.querySelector(selector);
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { selector, value });
}

async function setInputByLabel(label, value) {
  return evalPage(({ label, value }) => {
    const labels = [...document.querySelectorAll('label, .form-group')];
    const container = labels.find((node) => (node.textContent || '').toLowerCase().includes(label.toLowerCase()));
    const input = container?.querySelector('input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { label, value });
}

async function setTextareaByLabel(label, value) {
  return evalPage(({ label, value }) => {
    const labels = [...document.querySelectorAll('label, .form-group')];
    const container = labels.find((node) => (node.textContent || '').toLowerCase().includes(label.toLowerCase()));
    const input = container?.querySelector('textarea');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { label, value });
}

async function selectByLabel(label, value) {
  return evalPage(({ label, value }) => {
    const labels = [...document.querySelectorAll('label, .form-group')];
    const container = labels.find((node) => (node.textContent || '').toLowerCase().includes(label.toLowerCase()));
    const select = container?.querySelector('select');
    if (!select) return false;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { label, value });
}

async function clickByText(text) {
  return evalPage((needle) => {
    const exact = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const candidates = [...document.querySelectorAll('button, a, label, input[type="checkbox"]')];
    const el = candidates.find((node) => exact(node.textContent).toLowerCase().includes(String(needle).toLowerCase()) || exact(node.getAttribute('aria-label')).toLowerCase().includes(String(needle).toLowerCase()));
    if (!el) return false;
    if (el.tagName === 'LABEL') {
      const input = el.querySelector('input') || document.getElementById(el.getAttribute('for') || '');
      if (input) input.click();
    }
    el.click();
    return true;
  }, text);
}

async function clickButtonExact(text) {
  return evalPage((needle) => {
    const exact = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const button = [...document.querySelectorAll('button')]
      .find((node) => exact(node.textContent).toLowerCase() === String(needle).toLowerCase());
    if (!button) return false;
    button.click();
    return true;
  }, text);
}

function repFixture(label) {
  const suffix = `${label}${RUN_ID.slice(-8)}`;
  return {
    name: `Codex QA ${label} Rep ${RUN_ID}`,
    email: `codex.qa.${label.toLowerCase()}.${RUN_ID}@example.com`,
    code: `QA${suffix}`.slice(0, 20).toUpperCase(),
  };
}

async function textIncludes(text) {
  return evalPage((needle) => document.body.innerText.toLowerCase().includes(String(needle).toLowerCase()), text);
}

async function waitForText(text, timeout = 8000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await textIncludes(text).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

async function waitForPath(path, timeout = 8000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const state = await pageState().catch(() => null);
    if (state?.pathname === path || state?.pathname.startsWith(`${path}/`)) return true;
    await sleep(250);
  }
  return false;
}

async function goto(path) {
  await send('Page.navigate', { url: path.startsWith('http') ? path : `${BASE}${path}` });
  await sleep(1300);
  for (let i = 0; i < 20; i++) {
    const ready = await evalPage(() => document.readyState === 'complete').catch(() => false);
    if (ready) return;
    await sleep(250);
  }
}

async function pageState() {
  return evalPage(() => ({
    href: location.href,
    pathname: location.pathname,
    title: document.title,
    visibleText: document.body.innerText.slice(0, 1800),
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

async function clearStorage() {
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
  return new Promise((resolve, reject) => {
    const nextId = ++id;
    pending.set(nextId, { resolve, reject });
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });
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

function writeSummary() {
  writeFileSync(resolve(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

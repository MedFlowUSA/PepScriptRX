import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out = resolve('artifacts/pure-pettides'); mkdirSync(out, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!exe) throw new Error('Local QA browser unavailable');
const vite = resolve('../node_modules/vite/bin/vite.js');
const server = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '5207', '--strictPort'], { stdio: 'inherit', windowsHide: true });
const browser = spawn(exe, ['--headless=new', '--no-proxy-server', '--remote-debugging-port=9907', `--user-data-dir=${resolve(out, 'browser-profile')}`, '--no-first-run', '--disable-sync', '--disable-extensions', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0, reviewed = false, role = 'admin', shuttingDown = false; const pending = new Map(), errors = [], writes = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 20000); pending.set(id, { resolve: r => { clearTimeout(timer); resolve(r); }, reject, cancel: () => clearTimeout(timer) }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function until(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); } throw new Error('Failed: ' + expression); }
async function goto(path, selector = '.ppt') { await send('Page.navigate', { url: 'http://127.0.0.1:5207' + path }); await until(`document.readyState==='complete' && !!document.querySelector(${JSON.stringify(selector)})`); }
const userId = '00000000-0000-4000-8000-000000000001';
const products = [['bpc-157', 'BPC-157', 129], ['tb-500', 'TB-500', 139], ['wolverine-blend', 'Wolverine Blend', 199], ['nad-plus', 'NAD+', 159]].map(([slug, name, price]) => ({ slug, name, description: 'QA concept description only.', image: '/brands/pettides/' + slug + '.jpg', article_slug: slug + '-benefits-evidence', public_price: null, provisional_price: price, price_reviewed: false, show_price: false, active: false, purchasable: false, launch_checklist: {}, launch_review_notes: '' }));
const article = { slug: 'bpc-157-benefits-evidence', title: 'QA reviewed research fixture', category: 'Understanding Research', body: 'Test-only educational content. [1]', sources: ['https://pubmed.ncbi.nlm.nih.gov/21030672/'], status: 'published', reviewed_by: userId, reviewed_at: '2026-10-29T00:00:00Z', source_verified: true };
try {
  let target;
  for (let i = 0; i < 50; i++) { try { if (!(await fetch('http://127.0.0.1:5207/pure-pettides')).ok) continue; const r = await fetch('http://127.0.0.1:9907/json/new?about:blank', { method: 'PUT' }); if (r.ok) { target = await r.json(); break; } } catch {} await sleep(200); }
  if (!target) throw new Error('Local preview/browser did not start');
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', async e => {
    if (shuttingDown) return; const m = JSON.parse(e.data); if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params; const url = new URL(request.url); let body = [], code = 200;
      if (url.pathname.endsWith('/pure_pettides_public_concepts')) body = products;
      if (url.pathname.endsWith('/pure_pettides_library')) body = reviewed ? [article] : [];
      if (url.pathname.endsWith('/pure_pettides_concepts')) body = products;
      if (url.pathname.endsWith('/pettides_public_concepts')) body = products.map(p => ({ ...p, public_price: p.provisional_price, purchasable: true }));
      if (url.pathname.endsWith('/pettides_articles')) body = [article];
      if (url.pathname.endsWith('/reps')) { const rep = { rep_name: 'Lily Graham', rep_slug: 'LILY60', commission_rate: .65, override_percent: 0, platform_percent: .35, parent_rep_id: null, parent_brand_id: null }; body = Object.entries(request.headers).some(([k,v])=>k.toLowerCase()==='accept'&&v.includes('vnd.pgrst.object')) ? rep : [rep]; }
      if (url.pathname.endsWith('/checkout_scopes')) body = { account_id: 'LILY60', parent_account_id: null, is_active: false, default_commission_rate: .65 };
      if (url.pathname.endsWith('/profiles')) body = [{ id: userId, auth_user_id: userId, email: 'fixture@example.invalid', role, full_name: 'QA fixture', brand_id: role === 'admin' ? null : 'purepeptidelabs', store_slug: role === 'admin' ? null : 'purepeptidelabs', admin_scope: role === 'admin' ? null : 'PUREPEPTIDELABS', partner_access_level: role === 'admin' ? null : 'limited' }];
      if (request.method === 'POST' || request.method === 'PATCH') { writes.push({ path: url.pathname, method: request.method, body: request.postData }); if (url.pathname.endsWith('/pure_pettides_join_interest')) body = null; }
      await send('Fetch.fulfillRequest', { requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,apikey,content-type,x-client-info,prefer,accept,accept-profile,content-profile' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    }
  });
  await send('Page.enable'); await send('Runtime.enable');
  // All backend calls are intercepted. No live credentials or requests.
  await send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co/*' }] });
  await goto('/pure-pettides'); await evaluate(`localStorage.removeItem('pepscriptrx-auth-session')`);
  const report = { liveWrites: false, backend: 'intercepted local fixtures', viewports: [], checks: [] };
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844], ['small-mobile', 320, 760]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }); await goto('/pure-pettides');
    await until(`document.querySelectorAll('.ppt-concept').length===4 && document.querySelector('.ppt-contact button').disabled===false`);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false);
    assert.equal(await evaluate(`[...document.querySelectorAll('.ppt-concept button')].every(b=>b.disabled)`), true);
    assert.equal(await evaluate(`/\\$129|\\$139|\\$199|\\$159/.test(document.body.innerText)`), false);
    assert.equal(await evaluate(`document.querySelectorAll('a[href*="/start"],a[href*="mixing"],a[href*="calculator"],a[href*="/patient"],a[href*="/pay/"]').length`), 0);
    await until(`[...document.querySelectorAll('.ppt-hero-art img,.ppt-brand-pair img')].every(i=>i.complete&&i.naturalWidth>0)`);
    let shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(out, name + '.png'), Buffer.from(shot.data, 'base64'));
    await evaluate(`document.querySelector('#concepts').scrollIntoView({behavior:'instant'})`); await until(`[...document.querySelectorAll('.ppt-vial img')].every(i=>i.complete&&i.naturalWidth>0)`); await until(`scrollY>500`);
    shot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(out, name + '-concepts.png'), Buffer.from(shot.data, 'base64'));
    report.viewports.push({ name, width, height });
  }
  await goto('/pure-pettides/concepts/nad-plus'); assert.equal(await evaluate(`document.querySelector('.ppt-detail button').disabled`), true);
  await goto('/pure-pettides/library'); await until(`document.body.innerText.includes('Resources are awaiting recorded')`);
  await goto('/pure-pettides/library/draft'); assert.equal(await evaluate(`document.body.innerText.includes('not available here until')`), true);
  reviewed = true; await goto('/pure-pettides/library'); await until(`document.querySelectorAll('.ppt-resources>a').length===1`);
  await evaluate(`document.querySelector('.ppt-resources>a').click()`); await until(`!!document.querySelector('.ppt-article')`);
  assert.equal(await evaluate(`document.querySelector('.ppt-article a').href`), article.sources[0]);
  await goto('/pure-pettides#contact'); await evaluate(`const f=document.querySelector('.ppt-contact form');f.elements.namedItem('email').value='fixture@example.invalid';f.elements.namedItem('consent').checked=true;f.requestSubmit()`);
  await until(`document.body.innerText.includes('Your interest has been recorded')`);
  assert.equal(writes.filter(w => w.path.endsWith('/pure_pettides_join_interest')).length, 1);
  await goto('/pure-pettides/checkout'); await until(`location.pathname==='/pure-pettides'`);
  // Existing storefronts render with their original components and availability.
  await goto('/pettides', '.pt-site'); await until(`document.querySelectorAll('.pt-card').length===4 && !document.querySelector('.pt-card button').disabled`);
  assert.equal(await evaluate(`document.querySelector('.pt-card button').disabled`), false);
  await goto('/purepeptidelabs', '.ppl'); assert.equal(await evaluate(`document.title.includes('Pure')`), true);
  await send('Page.navigate', { url: 'http://127.0.0.1:5207/admin/pure-pettides' }); await until(`location.pathname==='/login'`);
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 7200 }, 'fixture'].map(x => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url')).join('.');
  const session = { access_token: token, refresh_token: 'fixture-only', expires_at: Math.floor(Date.now() / 1000) + 7200, expires_in: 7200, token_type: 'bearer', user: { id: userId, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } };
  await evaluate(`localStorage.setItem('pepscriptrx-auth-session',${JSON.stringify(JSON.stringify(session))})`);
  await send('Page.navigate', { url: 'http://127.0.0.1:5207/admin/pure-pettides' }); await until(`document.body.innerText.includes('Concept products and launch review')`);
  await until(`document.body.innerText.includes('Local backend configuration matches')`);
  assert.equal(await evaluate(`!!document.querySelector('a[href="/admin/pure-pettides"]')`), true);
  assert.equal(await evaluate(`document.querySelectorAll('fieldset').length`), 4);
  assert.equal(await evaluate(`document.querySelectorAll('fieldset input[type=checkbox]').length`), 28);
  assert.equal(await evaluate(`document.body.innerText.includes('Lily $52.00')`), true);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const adminShot = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(resolve(out, 'admin.png'), Buffer.from(adminShot.data, 'base64'));
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Save concept and review notes').click()`);
  await until(`document.body.innerText.includes('Saved. Preview restrictions remain enforced.')`);
  const conceptSave = writes.find(w=>w.method==='PATCH'&&w.path.endsWith('/pure_pettides_concepts'));
  assert(conceptSave); assert.equal(JSON.parse(conceptSave.body).provisional_price, 129);
  assert.equal(writes.some(w=>w.method==='PATCH'&&w.path.endsWith('/pettides_concepts')),false);
  role = 'partner_admin_limited'; await send('Page.navigate', { url: 'http://127.0.0.1:5207/admin/pure-pettides' }); await until(`location.pathname==='/admin' && document.readyState==='complete'`);
  assert.equal(writes.some(w => /create_public_patient_submission|stripe|paypal|zelle|fulfill/.test(w.path)), false);
  assert.equal(errors.length, 0, JSON.stringify(errors));
  report.checks = ['four viewport layouts without overflow', 'all seven reused brand and product images load', 'four concepts with hidden prices and disabled purchases', 'no human portal or dosing features', 'draft and owner-only content hidden by shared-library contract', 'reviewed published fixture and source links', 'scoped minimal contact form', 'checkout route redirects without commerce', 'existing Pure and PetTides render; PetTides purchase actions unchanged', 'unauthenticated admin redirected to login', 'platform admin navigation and 28 product checklist controls', 'admin save targets only the new concepts table', 'Lily limited admin denied platform settings', 'no orders or payments submitted', 'no browser exceptions'];
  writeFileSync(resolve(out, 'verification.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { shuttingDown = true; for (const p of pending.values()) p.cancel(); pending.clear(); ws?.close(); browser.kill(); server.kill(); }

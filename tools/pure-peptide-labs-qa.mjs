import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5188';
const out = resolve('artifacts/purepeptidelabs');
mkdirSync(out, { recursive: true });
const browserPath = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!browserPath) throw new Error('Chrome or Edge is required');
const port = 9887;
const browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(out,'edge-profile')}`, '--no-first-run', '--disable-extensions', '--disable-gpu', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let ws, seq = 0, mode = 'empty';
const pending = new Map();
const errors = [];
const networkLog = [];
const report = { mockedBackend: true, liveWrites: false, viewports: [], checks: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r,ms));
const send = (method, params={}) => new Promise((resolve,reject) => {
  const id = ++seq;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); },15000);
  pending.set(id,{ resolve: (r) => { clearTimeout(timer); resolve(r); }, reject });
  ws.send(JSON.stringify({ id,method,params }));
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate',{ expression,returnByValue:true,awaitPromise:true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for(let i=0;i<80;i++) { if(await evaluate(expression)) return; await sleep(150); }
  throw new Error(`Page condition failed: ${expression}`);
}
async function goto(path) {
  await send('Page.navigate',{url:base+path});
  await until(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(path.split('?')[0])}`);
  await sleep(450);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(resolve(out,name+'.png'),Buffer.from(shot.data,'base64'));
}
const fixture = { id:'fixture-assignment',distributor_id:'fixture-store',product_id:'00000000-0000-4000-8000-000000000001',is_enabled:true,enabled:true,custom_price:125,custom_retail_price:125,featured:true,
  product:{id:'00000000-0000-4000-8000-000000000001',sku:'QA-ONLY',product_name:'Catalog verification item',strength:'QA fixture',category:'Verification category',active:true,visibility_type:'rx_plus',description:'Test-only catalog description. This record is never published.'}};
try {
  let target;
  for(let i=0;i<60;i++){ try { target=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t)=>t.type==='page'); if(target)break; } catch {} await sleep(200); }
  if(!target) throw new Error('Browser did not start');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message',async (event)=>{
    const msg=JSON.parse(event.data);
    if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}return;}
    if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
    if(msg.method==='Log.entryAdded') networkLog.push(msg.params.entry.text);
    if(msg.method==='Fetch.requestPaused') {
      const {requestId,request}=msg.params;
      const url=new URL(request.url);
      networkLog.push(`${request.method} ${url.pathname}`);
      let data=[];
      if(url.pathname.endsWith('/distributor_products')) data=mode==='catalog'?[fixture]:[];
      if(url.pathname.endsWith('/public_inventory_status')) data=[{catalog_source:'rx_plus_products',product_id:fixture.product_id,sku:'QA-ONLY',active:true,sellable:true,customer_visible:true,quantity_on_hand:10,stock_status:'in_stock',checkout_allowed:true}];
      if(url.pathname.includes('validate_checkout_scope')) data={valid:true,scope_code:'PUREPEPTIDELABS',display_name:'Pure Peptide Labs',account_type:'rep',account_id:'LILY60'};
      // All Supabase traffic is fulfilled locally, including any attribution POST.
      await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'apikey,authorization,x-client-info,content-type,accept-profile,content-profile,x-supabase-api-version,prefer,range'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }
  });
  await new Promise((r)=>ws.addEventListener('open',r,{once:true}));
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*supabase.co/*'}]});
  await goto('/purepeptidelabs');
  await evaluate('localStorage.clear(); sessionStorage.clear()');
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844},{name:'small-mobile',width:320,height:760}]) {
    await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.width<600});
    mode='empty';
    await goto('/purepeptidelabs');
    if(viewport.name==='desktop') {
      await until(`!!document.querySelector('.portal-age-gate')`);
      assert.equal(await evaluate(`document.querySelector('.portal-age-gate').innerText.includes('10%')`),false);
      assert.equal(await evaluate(`document.querySelector('.portal-age-gate-actions button').disabled`),true);
      await screenshot('desktop-age-gate');
      await evaluate(`document.querySelector('.portal-age-gate-check input').click()`);
      await evaluate(`document.querySelector('.portal-age-gate-actions button').click()`);
      await until(`!document.querySelector('.portal-age-gate')`);
    }
    await until(`document.body.innerText.includes('Something thoughtful is taking shape.')`);
    await until(`Array.from(document.querySelectorAll('.ppl-hero img')).every(i=>i.complete && i.naturalWidth>0)`);
    const measurements=await evaluate(`(()=>{const image=document.querySelector('.ppl-hero-image');const r=image.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,heroImage:{width:r.width,height:r.height,top:r.top,bottom:r.bottom},naturalWidth:image.naturalWidth,title:document.querySelector('h1').innerText,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}})()`);
    assert.equal(measurements.overflow,false);
    assert.equal(measurements.brokenImages.length,0);
    assert.match(measurements.title,/considered/);
    await screenshot(viewport.name+'-hero');
    await evaluate(`document.querySelector('#collection').scrollIntoView()`);await sleep(150);await screenshot(viewport.name+'-collection');
    await evaluate(`document.querySelector('#our-world').scrollIntoView()`);await sleep(150);await screenshot(viewport.name+'-story');
    report.viewports.push({...viewport,...measurements});
    mode='catalog';await goto('/purepeptidelabs');
    await until(`document.querySelectorAll('.ppl-card').length===1`);
    await evaluate(`document.querySelector('input[type="search"]').focus()`);
    await send('Input.insertText',{text:'no-match-qa'});
    await until(`document.querySelectorAll('.ppl-card').length===0`);
    await evaluate(`document.querySelector('input[type="search"]').select()`);
    await send('Input.insertText',{text:'Catalog'});
    await until(`document.querySelectorAll('.ppl-card').length===1`);
    await evaluate(`(()=>{const s=document.querySelector('.ppl-filters select');s.value='Verification category';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    assert.equal(await evaluate(`document.querySelectorAll('.ppl-card').length`),1);
    await evaluate(`document.querySelector('.ppl-card summary').click()`);
    assert.equal(await evaluate(`document.querySelector('.ppl-card details').open`),true);
    await evaluate(`document.querySelector('.ppl-card').scrollIntoView()`);await sleep(150);await screenshot(viewport.name+'-product-fixture');
    await evaluate(`document.querySelector('.ppl-card .ppl-button').click()`);
    await until(`!!document.querySelector('.ppl-bag')`);
    await evaluate(`document.querySelector('.ppl-bag button').click()`);
    await until(`location.pathname==='/start'`);
    const cart=await evaluate(`JSON.parse(sessionStorage.getItem('pepscriptrx_portal_cart'))`);
    assert.equal(cart.total,125);assert.equal(cart.scope_code,'PUREPEPTIDELABS');assert.equal(cart.parent_brand_id,null);assert.equal(cart.items[0].id,fixture.product_id);
    await until(`document.body.innerText.includes('Pure Peptide Labs')`);
    assert.equal(await evaluate(`document.body.innerText.includes('Purity Confidence Guarantee') || document.body.innerText.includes('FREE 3 mL')`),false);
    await screenshot(viewport.name+'-checkout-fixture');
    await goto('/purepeptidelabs');await until(`!!document.querySelector('.ppl-quantity')`);
    assert.equal(await evaluate(`document.querySelector('.ppl-quantity output').innerText`),'1');
    await evaluate(`document.querySelector('.ppl-quantity button').click()`);
    await until(`!document.querySelector('.ppl-bag')`);
    await evaluate(`sessionStorage.removeItem('pepscriptrx_portal_cart')`);
  }
  mode='empty';
  await goto('/start?scope=PUREPEPTIDELABS&brand=purepeptidelabs');
  await until(`document.body.innerText.includes('Your bag is empty.')`);
  assert.equal(await evaluate(`document.querySelectorAll('.product-select-card').length`),0);
  for(const path of ['/purepeptidelabs/privacy','/purepeptidelabs/terms','/login?portal=patient&brand=purepeptidelabs','/patient/signup?brand=purepeptidelabs']) {
    await goto(path);assert.equal(await evaluate(`document.body.innerText.includes('Page not found')`),false);
    report.checks.push(path);
  }
  assert.equal(errors.length,0);
  report.checks.push('age gate without discount','unpublished collection','fixture search/category/details','cart handoff and restore','empty checkout does not expose main catalog','no default purity/free-item promotion in checkout','desktop/mobile no horizontal overflow','no browser exceptions');
  writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch(error) {
  if(ws?.readyState===1) {
    await screenshot('failure');
    console.log(await evaluate('document.body.innerText'));
    console.log(networkLog);
  }
  throw error;
} finally { ws?.close();browser.kill(); }

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=resolve('artifacts/pettides'); mkdirSync(out,{recursive:true});
const exe=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if(!exe) throw new Error('Browser unavailable');
if(!existsSync(resolve(out,'fixture-dist/index.html')))throw new Error('Build the isolated fixture bundle as described in docs/pettides-handoff.txt first');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir',resolve(out,'fixture-dist'),'--host','127.0.0.1','--port','5198','--strictPort'],{stdio:'inherit',windowsHide:true});
const browser=spawn(exe,['--headless=new','--no-proxy-server','--remote-debugging-port=9898',`--user-data-dir=${resolve(out,'browser-profile-3')}`,'--no-first-run','--disable-sync','--disable-features=msEdgeSyncPromo','--disable-extensions','about:blank'],{stdio:'ignore',windowsHide:true});
let ws,seq=0,mode='draft'; const pending=new Map(),errors=[],writes=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject});ws.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error(expression);}
async function goto(path){await send('Page.navigate',{url:'http://127.0.0.1:5198'+path});await until(`document.readyState==='complete' && !!document.querySelector('.pt-site')`);await sleep(250);}
const article={slug:'test-published',title:'QA published resource',category:'Understanding Research',body:'Test fixture only. Not published to the live database.',sources:['https://example.com/research'],status:'published',reviewed_by:null,reviewed_at:null};
const userId='00000000-0000-4000-8000-000000000001';
try{
 let target;for(let i=0;i<30;i++){try{if(!(await fetch('http://127.0.0.1:5198/pettides',{signal:AbortSignal.timeout(2000)})).ok)continue;const r=await fetch('http://127.0.0.1:9898/json/new?about:blank',{method:'PUT',signal:AbortSignal.timeout(2000)});if(r.ok){target=await r.json();break;}}catch{}await sleep(200);}
 if(!target)throw new Error('Browser did not start');ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',async event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}return;}
  if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);
  if(msg.method==='Fetch.requestPaused'){const {requestId,request}=msg.params;let body=[],code=200;const url=new URL(request.url);
   if(url.pathname.endsWith('/pettides_public_concepts')){body={message:'QA uses fallback concepts'};code=404;}
   if(url.pathname.endsWith('/pettides_articles'))body=mode==='published'?[article]:[];
   if(url.pathname.endsWith('/profiles') && mode==='admin')body=[{id:userId,auth_user_id:userId,email:'qa@example.com',role:'admin',full_name:'QA platform admin',brand_id:null,store_slug:null,admin_scope:null}];
   if(request.method==='POST'){writes.push({path:url.pathname,body:request.postData});if(url.pathname.endsWith('/pettides_join_interest'))body=null;}
   await send('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
  }
 });
 console.log('QA browser connected');await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*supabase.co/*'}]});
 const report={liveWrites:false,backend:'intercepted fixtures',viewports:[],checks:[]};
 for(const size of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844},{name:'small-mobile',width:320,height:760}]){
  await send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<600});await goto('/pettides');await until(`document.querySelectorAll('.pt-card').length===4 && document.body.innerText.includes('Educational resources coming soon')`);
  await until(`document.querySelector('.pt-hero>img').complete`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
  assert.equal(await evaluate(`document.querySelectorAll('a[href*="/start"],a[href*="checkout"],a[href*="mixing"],a[href*="/patient"]').length`),0);
  assert.equal(await evaluate(`/\\$129|\\$139|\\$199|\\$159/.test(document.body.innerText)`),false);
  let shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,size.name+'.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('#concepts').scrollIntoView()`);await until(`[...document.querySelectorAll('.pt-card img')].every(i=>i.complete&&i.naturalWidth>0)`);
  shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,size.name+'-concepts.png'),Buffer.from(shot.data,'base64'));
  await goto('/pettides/concepts/bpc-157');assert.equal(await evaluate(`document.querySelector('.pt-detail button').disabled`),true);
  await goto('/pettides/library/bpc-157-dogs');await until(`document.body.innerText.includes('This resource is not published')`);
  report.viewports.push(size);
 }
 mode='published';await goto('/pettides/library');await until(`document.querySelectorAll('.pt-resource').length===1`);
 await evaluate(`document.querySelector('.pt-resource').click()`);await until(`document.querySelector('.pt-article')!==null`);
 await goto('/pettides#interest');await evaluate(`document.querySelector('input[name=email]').value='qa@example.com';document.querySelector('input[name=consent]').checked=true;document.querySelector('.pt-interest form').requestSubmit()`);await until(`document.body.innerText.includes('Your interest has been recorded')`);
 assert.equal(writes.filter(x=>x.path.endsWith('/pettides_join_interest')).length,1);
 await send('Page.navigate',{url:'http://127.0.0.1:5198/admin/pettides'});await until(`location.pathname==='/login'`);
 mode='admin';
 const token=[{alg:'HS256',typ:'JWT'},{sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 const session={access_token:token,refresh_token:'fixture-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:userId,email:'qa@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};
 await evaluate(`localStorage.setItem('pepscriptrx-auth-session',${JSON.stringify(JSON.stringify(session))})`);
 await send('Page.navigate',{url:'http://127.0.0.1:5198/admin/pettides'});await until(`document.body.innerText.includes('Product concepts & launch checklist')`);
 assert.equal(await evaluate(`!!document.querySelector('a[href="/admin/pettides"]')`),true);
 assert.equal(errors.length,0);
 report.checks=['3 viewport layouts without overflow','six supplied images load','no prices by default','no human portal links','purchase disabled','draft direct URL hidden','published fixture readable','interest form through existing contact RPC','unauthenticated admin blocked','platform admin page and main sidebar link with authenticated fixture','no live backend writes'];
 writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{ws?.close();browser.kill();server.kill();}

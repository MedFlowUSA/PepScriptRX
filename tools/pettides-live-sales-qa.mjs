import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const base='https://pepscriptrx.vercel.app',out=resolve('artifacts/pettides/live-sales');mkdirSync(out,{recursive:true});
const exe=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser=spawn(exe,['--headless=new','--remote-debugging-port=9899',`--user-data-dir=${resolve(out,'profile')}`,'--no-first-run','--disable-sync','--disable-extensions','about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,seq=0;const pending=new Map(),errors=[];
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const t=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},20000);pending.set(id,{resolve:r=>{clearTimeout(t);resolve(r)},reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(150);}throw new Error('Condition failed: '+expression);}
async function goto(path){await send('Page.navigate',{url:base+path});await until(`!!document.querySelector('.pt-site') && document.readyState==='complete'`);}
try{
 let target;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:9899/json/new?about:blank',{method:'PUT',signal:AbortSignal.timeout(2000)});if(r.ok){target=await r.json();break;}}catch{}await sleep(200);}
 if(!target)throw new Error('Live QA browser unavailable');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 await send('Page.enable');await send('Runtime.enable');
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await goto('/pettides');
  await until(`document.querySelectorAll('.pt-card').length===4 && document.body.innerText.includes('Educational resources coming soon')`);
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  assert.equal(await evaluate(`/\\$129|\\$139|\\$199|\\$159/.test(document.body.innerText)`),true);
  await until(`document.querySelector('.pt-hero>img').complete && document.querySelector('.pt-hero>img').naturalWidth>0`);
  const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,name+'.png'),Buffer.from(shot.data,'base64'));
 }
 await goto('/pettides/concepts/bpc-157');assert.equal(await evaluate(`document.querySelector('.pt-detail button').disabled`),false);
 await goto('/pettides');await evaluate("document.querySelector('.pt-card button').click()");await until("document.querySelectorAll('.pt-bag-row').length===1");await evaluate("document.querySelector('.pt-bag .pt-button').click()");await until("location.pathname==='/pettides/checkout' && !!document.querySelector('.pt-checkout')");assert.equal(await evaluate("document.querySelectorAll('input[name=date_of_birth],a[href*=mixing],a[href*=\"/patient\"]').length"),0);assert.equal(await evaluate("!!document.querySelector('select[name=shipping_state] option[value=CA]')"),true);
 await goto('/pettides/library/bpc-157-dogs');await until(`document.body.innerText.includes('This resource is not published')`);
 assert.equal(errors.length,0);
 const report={url:base+'/pettides',liveWrites:false,passed:true,checks:['desktop and mobile render','four concept cards','retail prices public','hero asset loaded','add to bag enabled','live server quote and checkout render','no order submitted','draft article inaccessible','no browser exceptions']};
 writeFileSync(resolve(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{ws?.close();browser.kill();}

// Tests HTTP assets and the generated service worker using a Node API harness, not a browser.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url));
const base='http://localhost:4176';
const server=spawn(process.execPath,['scripts/serve_release.mjs'],{cwd:root,env:{...process.env,DIMMINGLAB_PORT:'4176'},stdio:['ignore','pipe','pipe']});
try{
  let running=false;
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok){running=true;break;}}catch{}await delay(100);}
  assert.ok(running,'Release server failed to start.');
  const manifest=await(await fetch(base+'/offline-manifest.json')).json();
  assert.ok(manifest.assets.length>=10);
  for(const asset of manifest.assets){const response=await fetch(base+asset);assert.ok(response.ok,`Missing packaged asset: ${asset}`);}
  const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  const cacheMaps=new Map(),listeners=new Map();let offline=false,claimed=false,activated=false;
  const key=input=>new URL(typeof input==='string'?input:input.url,base).href;
  const cacheFor=name=>{
    if(!cacheMaps.has(name))cacheMaps.set(name,new Map());
    const entries=cacheMaps.get(name);
    return {
      match:async input=>entries.get(key(input))?.clone(),
      addAll:async requests=>{
        const responses=await Promise.all(requests.map(async request=>{const r=await fetch(request);assert.ok(r.ok);return r;}));
        requests.forEach((request,i)=>entries.set(key(request),responses[i]));
      },
    };
  };
  const storage={open:async name=>cacheFor(name),keys:async()=>[...cacheMaps.keys()],delete:async name=>cacheMaps.delete(name),
    match:async request=>{for(const entries of cacheMaps.values()){const r=entries.get(key(request));if(r)return r.clone();}}};
  class RelativeRequest extends Request{constructor(url,options){super(key(url),options);}}
  const self={location:{origin:base},addEventListener:(name,handler)=>listeners.set(name,handler),skipWaiting:async()=>{activated=true;},clients:{claim:async()=>{claimed=true;}}};
  vm.runInNewContext(source,{self,caches:storage,Request:RelativeRequest,Response,URL,
    fetch:async input=>{if(offline)throw new Error('Offline');return fetch(key(input));}});
  let installation;listeners.get('install')({waitUntil:promise=>{installation=promise;}});await installation;
  assert.ok(activated);assert.equal(cacheMaps.get(manifest.cacheName).size,manifest.assets.length);
  let activation;listeners.get('activate')({waitUntil:promise=>{activation=promise;}});await activation;assert.ok(claimed);
  offline=true;
  for(const asset of manifest.assets){
    let responsePromise;listeners.get('fetch')({request:{url:base+asset,method:'GET',mode:asset==='/'?'navigate':'cors'},respondWith:promise=>{responsePromise=promise;}});
    const response=await responsePromise;assert.ok(response.ok,`Offline resource failed: ${asset}`);
  }
  let crossOriginHandled=false;
  listeners.get('fetch')({request:{url:'https://other.invalid/assets/x.js',method:'GET',mode:'cors'},respondWith:()=>{crossOriginHandled=true;}});
  assert.equal(crossOriginHandled,false);
  console.log(JSON.stringify({status:'passed',scope:'HTTP resources and generated service-worker API harness; not a live browser',buildId:manifest.buildId,assets:manifest.assets.length,offlineResourcesVerified:manifest.assets.length,crossOriginIgnored:true},null,2));
}finally{server.kill();}

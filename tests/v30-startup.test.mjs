import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,Script} from 'node:vm';

class FakeElement{
 constructor({hidden=false,textContent=''}={}){this.hidden=hidden;this.textContent=textContent;this.attributes=new Map();this.listeners=new Map();}
 addEventListener(type,listener){this.listeners.set(type,listener);}
 click(){this.listeners.get('click')?.({currentTarget:this});}
 setAttribute(name,value=''){this.attributes.set(name,String(value));}
 removeAttribute(name){this.attributes.delete(name);}
 hasAttribute(name){return this.attributes.has(name);}
}

const settle=()=>new Promise(resolve=>setImmediate(resolve));

async function startupHarness({readyState='complete',failure=null,controlsCount=18,holdImport=false}={}){
 const source=await readFile(new URL('../dist/startup.js',import.meta.url),'utf8');
 const runnable=source.replace("import('./app.mjs?v=31')",'globalThis.__importApp()');
 assert.notEqual(runnable,source,'startup must import the versioned app entry');
 const status=new FakeElement(),message=new FakeElement({textContent:'상황실을 여는 중…'}),retry=new FakeElement({hidden:true});
 const governed=new FakeElement(),locks=[new FakeElement(),new FakeElement(),new FakeElement()];
 for(const lock of locks)lock.setAttribute('inert','');
 const documentListeners=new Map(),imports=[],errors=[];
 let controls=[],reloads=0,timerCalls=0,storageReads=0,releaseImport;
 const importGate=new Promise(resolve=>{releaseImport=resolve;});
 const body={classList:{removed:[],remove(name){this.removed.push(name);}},removeAttribute(name){this.removedAttribute=name;}};
 const document={
  readyState,body,
  addEventListener(type,listener){documentListeners.set(type,listener);},
  getElementById(id){return {"boot-status":status,"boot-message":message,"boot-retry":retry,"governed-name":governed}[id]??null;},
  querySelectorAll(selector){
   if(selector==='[data-boot-lock]')return locks;
   if(selector==='.map-site-target[data-country][data-site]')return controls;
   return [];
  }
 };
 const context=createContext({
  document,
  location:{reload(){reloads++;}},
  console:{error(...args){errors.push(args);}},
  setTimeout(){timerCalls++;throw new Error('startup must not schedule timers');},
  localStorage:new Proxy({}, {get(){storageReads++;throw new Error('startup must not read storage');}}),
  async __importApp(){
   imports.push('./app.mjs?v=31');
   if(holdImport)await importGate;
   if(failure)throw failure;
   governed.textContent='루멘 · 농업국';
   controls=Array.from({length:controlsCount},()=>new FakeElement());
  }
 });
 const script=new Script(runnable,{filename:'startup.js'});
 script.runInContext(context);
 return {
  body,status,message,retry,locks,imports,errors,
  releaseImport,
  dispatchDomReady(){documentListeners.get('DOMContentLoaded')?.();},
  async settle(){await settle();await settle();},
  counts(){return {reloads,timerCalls,storageReads};}
 };
}

test('startup waits for the DOM and initializes the app exactly once',async()=>{
 const app=await startupHarness({readyState:'loading'});
 assert.equal(app.imports.length,0);
 app.dispatchDomReady();
 app.dispatchDomReady();
 await app.settle();
 assert.deepEqual(app.imports,['./app.mjs?v=31']);
});

test('successful startup hides loading only after the rendered country and 18 controls exist',async()=>{
 const app=await startupHarness({holdImport:true});
 assert.equal(app.status.hidden,false);
 assert.ok(app.locks.every(lock=>lock.hasAttribute('inert')));
 app.releaseImport();
 await app.settle();
 assert.equal(app.status.hidden,true);
 assert.ok(app.locks.every(lock=>!lock.hasAttribute('inert')));
 assert.deepEqual(app.body.classList.removed,['boot-pending']);
 assert.equal(app.body.removedAttribute,'aria-busy');
});

test('failed startup shows a retry without timers or storage side effects',async()=>{
 const failure=new TypeError('module graph failed'),app=await startupHarness({failure});
 await app.settle();
 assert.equal(app.message.textContent,'게임을 불러오지 못했습니다.');
 assert.equal(app.retry.hidden,false);
 assert.ok(app.locks.every(lock=>lock.hasAttribute('inert')));
 assert.equal(app.errors.length,1);
 assert.equal(app.errors[0][0],'게임 시작 실패');
 assert.equal(app.errors[0][1],failure);
 assert.deepEqual(app.counts(),{reloads:0,timerCalls:0,storageReads:0});
 app.retry.click();
 assert.deepEqual(app.counts(),{reloads:1,timerCalls:0,storageReads:0});
});

test('resolved entry stays in the error boundary until all 18 controls are rendered',async()=>{
 const app=await startupHarness({controlsCount:17});
 await app.settle();
 assert.equal(app.status.hidden,false);
 assert.equal(app.message.textContent,'게임을 불러오지 못했습니다.');
 assert.equal(app.retry.hidden,false);
 assert.ok(app.locks.every(lock=>lock.hasAttribute('inert')));
 assert.match(app.errors[0][1].message,/준비 확인 실패/);
});

test('index provides a classic deferred startup boundary and an accessible initial state',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<link rel="stylesheet" href="startup\.css\?v=31">/);
 assert.match(html,/<script defer src="startup\.js\?v=31"><\/script>/);
 assert.doesNotMatch(html,/<script type="module" src="app\.mjs/);
 assert.match(html,/<body class="room-game boot-pending" aria-busy="true">/);
 assert.match(html,/id="boot-message"[^>]*>상황실을 여는 중…</);
 assert.match(html,/id="boot-retry"[^>]*hidden[^>]*>다시 연결</);
 assert.equal((html.match(/data-boot-lock inert/g)??[]).length,2);
});

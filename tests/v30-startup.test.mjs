import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,Script} from 'node:vm';

class FakeElement{
 constructor({hidden=false,textContent='',tagName=''}={}){this.hidden=hidden;this.textContent=textContent;this.tagName=tagName;this.attributes=new Map();this.listeners=new Map();}
 addEventListener(type,listener){this.listeners.set(type,listener);}
 click(){this.listeners.get('click')?.({currentTarget:this});}
 setAttribute(name,value=''){this.attributes.set(name,String(value));}
 removeAttribute(name){this.attributes.delete(name);}
 hasAttribute(name){return this.attributes.has(name);}
}

async function startupHarness({readyState='complete'}={}){
 const source=await readFile(new URL('../dist/startup.js',import.meta.url),'utf8');
 const status=new FakeElement(),message=new FakeElement({textContent:'상황실을 여는 중…'}),retry=new FakeElement({hidden:true});
 const governed=new FakeElement(),locks=[new FakeElement(),new FakeElement()];
 for(const lock of locks)lock.setAttribute('inert','');
 const documentListeners=new Map(),scripts=[],errors=[];
 let controls=[],reloads=0,timerCalls=0,storageReads=0;
 const body={classList:{removed:[],remove(name){this.removed.push(name);}},removeAttribute(name){this.removedAttribute=name;}};
 const document={
  readyState,body,
  head:{appendChild(element){scripts.push(element);return element;}},
  createElement(tagName){return new FakeElement({tagName});},
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
  localStorage:new Proxy({}, {get(){storageReads++;throw new Error('startup must not read storage');}})
 });
 new Script(source,{filename:'startup.js'}).runInContext(context);
 return {
  body,status,message,retry,locks,scripts,errors,
  dispatchDomReady(){documentListeners.get('DOMContentLoaded')?.();},
  render(controlsCount=18){governed.textContent='루멘 · 농업국';controls=Array.from({length:controlsCount},()=>new FakeElement());},
  load(){scripts[0].onload();},
  fail(error){scripts[0].onerror(error);},
  counts(){return {reloads,timerCalls,storageReads};}
 };
}

test('startup waits for the DOM and appends the native game bundle exactly once',async()=>{
 const app=await startupHarness({readyState:'loading'});
 assert.equal(app.scripts.length,0);
 app.dispatchDomReady();
 app.dispatchDomReady();
 assert.equal(app.scripts.length,1);
 assert.equal(app.scripts[0].tagName,'script');
 assert.equal(app.scripts[0].src,'./game.bundle.js?v=37');
});

test('bundle stays pending until native load confirms the rendered country and 18 controls',async()=>{
 const app=await startupHarness();
 assert.equal(app.scripts.length,1);
 assert.equal(app.status.hidden,false);
 assert.ok(app.locks.every(lock=>lock.hasAttribute('inert')));
 app.render();
 app.load();
 assert.equal(app.status.hidden,true);
 assert.ok(app.locks.every(lock=>!lock.hasAttribute('inert')));
 assert.deepEqual(app.body.classList.removed,['boot-pending']);
 assert.equal(app.body.removedAttribute,'aria-busy');
});

test('native bundle load failure logs the raw error and offers manual retry only',async()=>{
 const app=await startupHarness(),failure=new Error('https://example.test/game.bundle.js failed');
 failure.src='./game.bundle.js?v=37';
 app.fail(failure);
 app.fail(new Error('duplicate event'));
 assert.equal(app.message.textContent,'게임을 불러오지 못했습니다.');
 assert.equal(app.retry.hidden,false);
 assert.ok(app.locks.every(lock=>lock.hasAttribute('inert')));
 assert.deepEqual(app.errors,[['게임 시작 실패',failure]]);
 assert.deepEqual(app.counts(),{reloads:0,timerCalls:0,storageReads:0});
 app.retry.click();
 assert.deepEqual(app.counts(),{reloads:1,timerCalls:0,storageReads:0});
});

test('loaded bundle stays in the error boundary until all 18 controls are rendered',async()=>{
 const app=await startupHarness();
 app.render(17);
 app.load();
 assert.equal(app.status.hidden,false);
 assert.equal(app.message.textContent,'게임을 불러오지 못했습니다.');
 assert.equal(app.retry.hidden,false);
 assert.ok(app.locks.every(lock=>lock.hasAttribute('inert')));
 assert.match(app.errors[0][1].message,/준비 확인 실패/);
});

test('success settles once and ignores a later native error callback',async()=>{
 const app=await startupHarness();
 app.render();
 app.load();
 app.fail(new Error('late duplicate event'));
 assert.equal(app.status.hidden,true);
 assert.equal(app.errors.length,0);
});

test('index retains the external classic startup boundary and accessible initial state',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<link rel="stylesheet" href="startup\.css\?v=\d+">/);
 assert.match(html,/<script defer src="startup\.js\?v=37"><\/script>/);
 assert.doesNotMatch(html,/<script type="module" src="app\.mjs/);
 assert.match(html,/<body class="room-game boot-pending" aria-busy="true">/);
 assert.match(html,/id="boot-message"[^>]*>상황실을 여는 중…</);
 assert.match(html,/id="boot-retry"[^>]*hidden[^>]*>다시 연결</);
 assert.equal((html.match(/data-boot-lock inert/g)??[]).length,2);
});

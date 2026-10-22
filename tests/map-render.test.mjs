import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,PROFILES} from '../dist/engine.mjs';
import {updateMap} from '../dist/map.mjs';

// The mounted atlas and sidebar exist before an ordinary state refresh.
class MountedElement {
 constructor(){this.dataset={};this.style={};this.attributes=new Map();this.nodes=new Map();this.children=[];this.classList={toggle(){}};this.innerHTML='';}
 setAttribute(key,value){this.attributes.set(key,String(value));}
 getAttribute(key){return this.attributes.get(key)??null;}
 toggleAttribute(key,force){if(force??!this.attributes.has(key))this.setAttribute(key,'');else this.removeAttribute(key);}
 removeAttribute(key){this.attributes.delete(key);}
 querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new MountedElement());return this.nodes.get(selector);}
 querySelectorAll(){return [];}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
}

test('refreshing an existing atlas also renders all six world status cards without a scope error',()=>{
 const state=createGame('lumen'),before=structuredClone(state),svg=new MountedElement(),world=new MountedElement();
 const previous=globalThis.document;
 globalThis.document={querySelector:selector=>selector==='.world-map'?svg:selector==='#world-status'?world:null,createElementNS:()=>new MountedElement()};
 try{
  assert.doesNotThrow(()=>updateMap(state));
  assert.equal([...world.innerHTML.matchAll(/data-country-status=/g)].length,6);
  assert.match(world.innerHTML,/루멘/);
  assert.match(world.innerHTML,/공급 안정/);
  assert.match(world.innerHTML,/세라/);
  assert.deepEqual(state,before);
 }finally{globalThis.document=previous;}
});

test('world status notes separate city construction from the national facility',()=>{
 const state=advanceTurn(createGame('lumen'),'site:city:upgrade'),svg=new MountedElement(),world=new MountedElement(),previous=globalThis.document;
 globalThis.document={querySelector:selector=>selector==='.world-map'?svg:selector==='#world-status'?world:null,createElementNS:()=>new MountedElement()};
 try{updateMap(state);const own=world.innerHTML.split('data-country-status="lumen">')[1]?.split('</article>')[0]??'';assert.ok(!own.includes(PROFILES.lumen.facilityName+' 공사'));assert.ok(own.includes('1'));}
 finally{globalThis.document=previous;}
});

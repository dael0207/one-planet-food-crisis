import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapCamera} from '../dist/map-camera.mjs';

class Element {
 constructor(){this.attrs={};this.dataset={};this.listeners={};this.children=[];this.classList={add(){},remove(){}};this.captured=[];this.released=[];}
 setAttribute(name,value){this.attrs[name]=String(value);}
 addEventListener(name,callback){this.listeners[name]=callback;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 getBoundingClientRect(){return {width:900,height:620};}
 setPointerCapture(id){this.captured.push(id);}
 releasePointerCapture(id){this.released.push(id);}
}
const withCamera=run=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>new Element()};
 try{const svg=new Element(),controls=new Element(),camera=createMapCamera(svg,controls);run({svg,controls,camera});}
 finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
};
const keyEvent=(svg,key)=>({target:svg,key,preventDefault(){this.prevented=true;}});
const pointer=(x,y)=>({button:0,pointerId:7,clientX:x,clientY:y,preventDefault(){this.prevented=true;}});

test('mounted camera keyboard zoom, pan and reset keep native SVG view and controls synchronized',()=>withCamera(({svg,controls,camera})=>{
 const zoom=keyEvent(svg,'+');svg.listeners.keydown(zoom);
 assert.equal(camera.view.zoom,1.5);assert.equal(zoom.prevented,true);
 assert.equal(svg.attrs['data-camera-zoom'],'1.5');assert.equal(controls.children[1].textContent,'1.5×');
 const before=camera.view.x;svg.listeners.keydown(keyEvent(svg,'ArrowRight'));assert.ok(camera.view.x>before);
 svg.listeners.keydown(keyEvent(svg,'0'));assert.deepEqual(camera.view,{x:0,y:0,width:900,height:620,zoom:1});
 const page=keyEvent(svg,'ArrowDown');svg.listeners.keydown(page);assert.equal(page.prevented,undefined);
}));

test('mounted pointer adapter only pans in explicit mode past drag threshold and releases capture',()=>withCamera(({svg,controls,camera})=>{
 camera.zoomIn();const before=camera.view;
 svg.listeners.pointerdown(pointer(100,100));svg.listeners.pointermove(pointer(200,100));assert.deepEqual(camera.view,before);
 controls.listeners.click({target:{closest:()=>({dataset:{cameraAction:'pan-mode'}})}});
 svg.listeners.pointerdown(pointer(100,100));svg.listeners.pointermove(pointer(102,101));assert.deepEqual(camera.view,before);
 svg.listeners.pointermove(pointer(160,100));assert.ok(camera.view.x<before.x);assert.deepEqual(svg.captured,[7]);
 svg.listeners.pointerup(pointer(160,100));assert.deepEqual(svg.released,[7]);
 const click={preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};svg.listeners.click(click);
 assert.equal(click.prevented,true);assert.equal(click.stopped,true);
 camera.focusSite({countryId:'marin',kind:'port'});assert.equal(svg.attrs['data-camera-pan'],'false');assert.equal(camera.view.zoom,3);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFarmScene,updateFarmScene,FARM_LANDSCAPE_ASSETS} from '../dist/farm-map.mjs';

class Node{
 constructor(tag,attrs={}){this.tag=tag;this.attrs={...attrs};this.children=[];}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attrs[key]=String(value);}
 getAttribute(key){return String(this.attrs[key]??'');}
 querySelector(selector){return walk(this).find(node=>selector.startsWith('.')&&node.getAttribute('class').split(' ').includes(selector.slice(1)))??null;}
}
const make=(tag,attrs)=>new Node(tag,attrs);
const walk=node=>node.children.flatMap(child=>[child,...walk(child)]);
const landscape=phase=>({countryId:'lumen',phase,infrastructure:{siteLevel:3,nationalLevel:0,stage:'idle'}});

test('farm land use is masked material with one shared ground frame instead of three detached expansion sprites',()=>{
 const scene=buildFarmScene(make,'lumen'),all=walk(scene);
 const images=all.filter(node=>node.tag==='image');
 const base=scene.querySelector('.farm-landscape-base');
 assert.ok(base.getAttribute('mask').startsWith('url(#farm-ground-lumen-'));
 assert.equal(images.filter(node=>node.getAttribute('class').includes('farm-expansion')).length,3);
 for(const image of images){for(const key of ['x','y','width','height'])assert.equal(image.getAttribute(key),base.getAttribute(key));assert.ok(image.getAttribute('mask'));}
 const masks=all.filter(node=>node.tag==='mask');
 assert.equal(masks.length,4);
 assert.equal(new Set(masks.map(node=>node.getAttribute('id'))).size,4);
 assert.ok(all.some(node=>node.tag==='feGaussianBlur'));
});

test('completed expansion material follows actual climate without moving any land-use boundary',()=>{
 const scene=buildFarmScene(make,'lumen'),all=walk(scene);
 const geometry=all.filter(node=>node.tag==='mask').map(node=>node.children.map(child=>child.getAttribute('d')));
 for(const phase of ['healthy','drought','recovering']){
  updateFarmScene(scene,landscape(phase));
  assert.equal(scene.querySelector('.farm-landscape-base').getAttribute('href'),FARM_LANDSCAPE_ASSETS[phase]);
  for(const image of all.filter(node=>node.getAttribute('class').split(' ').includes('farm-expansion')))assert.equal(image.getAttribute('href'),FARM_LANDSCAPE_ASSETS[phase]);
  assert.deepEqual(all.filter(node=>node.tag==='mask').map(node=>node.children.map(child=>child.getAttribute('d'))),geometry);
 }
});

test('six countries use unique mask IDs to prevent SVG cross-country material leakage',()=>{
 const ids=['lumen','nord','cera','altia','marin','solis'].flatMap(id=>walk(buildFarmScene(make,id)).filter(node=>node.tag==='mask').map(node=>node.getAttribute('id')));
 assert.equal(ids.length,24);assert.equal(new Set(ids).size,ids.length);
});

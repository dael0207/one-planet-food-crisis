import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, advanceTurn} from '../dist/engine.mjs';
import {mapSiteModels} from '../dist/map-sites.mjs';
import {buildDevelopment, updateDevelopment, DEVELOPMENT} from '../dist/map-development.mjs';

class Node {
 constructor(tag, attributes = {}) { this.tag=tag;this.attributes=new Map(Object.entries(attributes).map(([k,v])=>[k,String(v)]));this.children=[]; }
 append(...children) { this.children.push(...children); }
 setAttribute(k,v) { this.attributes.set(k,String(v)); }
 getAttribute(k) { return this.attributes.get(k)??null; }
 querySelectorAll(selector) { return descendants(this).filter(node=>node.getAttribute('class')===selector.slice(1)); }
}
const descendants=root=>root.children.flatMap(child=>[child,...descendants(child)]);
const make=(tag,attrs)=>new Node(tag,attrs);
const viewFor=(state,kind,id='lumen')=>mapSiteModels(state).find(model=>model.countryId===id&&model.kind===kind).view;
const shown=(root,selector)=>root.querySelectorAll(selector).filter(node=>node.getAttribute('display')==='inline');

for(const kind of ['city','port']) {
 test(`${kind}: real upgrades reveal larger registered districts only after completion`,()=>{
  let state=createGame('lumen');
  const growth=buildDevelopment(make,kind,'lumen');
  for(let level=0;level<=3;level++) {
   const before=JSON.stringify(state);
   updateDevelopment(growth,viewFor(state,kind));
   assert.equal(JSON.stringify(state),before,'visual lookup is read only');
   assert.equal(shown(growth,'.map-development-region')[0].getAttribute('data-tier'),String(level));
   assert.equal(shown(growth,'.map-development-workzone').length,0);
   if(level===3)break;
   state=advanceTurn(state,`site:${kind}:upgrade`);
   updateDevelopment(growth,viewFor(state,kind));
   assert.equal(shown(growth,'.map-development-region')[0].getAttribute('data-tier'),String(level));
   assert.equal(shown(growth,'.map-development-workzone')[0].getAttribute('data-next'),String(level+1));
   state=advanceTurn(state,'maintain');
   updateDevelopment(growth,viewFor(state,kind));
   assert.equal(shown(growth,'.map-development-region')[0].getAttribute('data-tier'),String(level));
   state=advanceTurn(state,'maintain');
  }
  const images=descendants(growth).filter(node=>node.tag==='image');
  assert.equal(images.length,4);
  assert.equal(new Set(images.map(node=>['x','y','width','height','href'].map(key=>node.getAttribute(key)).join('|'))).size,1,'all tiers sample the same registered image at fixed scale');
  assert.equal(new Set(images.map(node=>node.getAttribute('mask'))).size,4);
 });
}

test('unobserved foreign and national infrastructure never fabricate local development tiers',()=>{
 const state=createGame('lumen'),growth=buildDevelopment(make,'city','cera');
 updateDevelopment(growth,{...viewFor(state,'city','cera'),aggregateInfrastructure:3,remaining:null});
 assert.equal(growth.getAttribute('data-development-level'),'unknown');
 assert.deepEqual(shown(growth,'.map-development-region').map(node=>node.getAttribute('data-tier')),['0']);
 assert.equal(shown(growth,'.map-development-workzone').length,0);
 const national=advanceTurn(state,'invest');
 updateDevelopment(growth,viewFor(national,'city'));
 assert.equal(growth.getAttribute('data-development-level'),'0');
});

test('district masks are nested, country-unique and retain high resolution through maximum zoom',()=>{
 const ids=[];
 for(const country of ['lumen','nord','cera','altia','marin','solis'])for(const kind of ['city','port']) {
  const root=buildDevelopment(make,kind,country);
  ids.push(...descendants(root).filter(node=>node.tag==='mask').map(node=>node.getAttribute('id')));
  const sizes=DEVELOPMENT[kind].bounds;
  for(let index=1;index<sizes.length;index++) {
   const [x,y,w,h]=sizes[index], [px,py,pw,ph]=sizes[index-1];
   assert.ok(x<=px&&y<=py&&x+w>=px+pw&&y+h>=py+ph);
   assert.ok(w*h>pw*ph);
  }
 }
 assert.equal(ids.length,48);assert.equal(new Set(ids).size,48);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutMapPins,renderMapAttentionHeader,renderMapPin} from '../dist/map-attention-ui.mjs';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderDecision} from '../dist/experience.mjs';
import {renderResultCauses} from '../dist/result-causes.mjs';

test('policy comparison maximum and maintenance cost stay with their numbers in narrow layouts',()=>{
 const opening=renderDecision(createGame('lumen'));
 assert.match(opening,/최대(?:&nbsp;|\u00a0)\+6/);
 const started=renderResultCauses(advanceTurn(createGame('lumen'),'site:farm:upgrade'));
 assert.match(started,/유지비(?:&nbsp;|\u00a0)1억/);
});

test('phone map pins remain readable within bounds and do not overlap at nearby facilities',()=>{
 const anchors=[{x:96,y:95},{x:103,y:107}],box={width:360,height:248},sizes=[{width:124,height:48},{width:124,height:48}];
 const placed=layoutMapPins(anchors,box,sizes);
 assert.equal(placed.length,2);
 for(const [index,pin] of placed.entries()){
  assert.equal(pin.hidden,false);assert.ok(pin.left>=8);assert.ok(pin.top>=8);
  assert.ok(pin.left+sizes[index].width<=box.width-8);assert.ok(pin.top+sizes[index].height<=box.height-8);
 }
 const [a,b]=placed;
 assert.ok(a.top+48<=b.top||b.top+48<=a.top||a.left+124<=b.left||b.left+124<=a.left);
 assert.deepEqual(anchors,[{x:96,y:95},{x:103,y:107}]);
});

test('zoomed-off-map anchors disappear instead of pointing at unrelated geography',()=>{
 const placed=layoutMapPins([{x:-3,y:120},{x:200,y:80}],{width:360,height:248},[{width:120,height:48},{width:120,height:48}]);
 assert.equal(placed[0].hidden,true);assert.equal(placed[1].hidden,false);
});

test('map result totals identify the quarter sum rather than claim policy causation',()=>{
 const html=renderMapAttentionHeader({mode:'result',heading:'농경지 <확장>',actionLabel:'결과 자세히',pins:[],metrics:[{key:'food',label:'식량',before:68,after:57,delta:-11},{key:'treasury',label:'국고',before:62,after:49,delta:-13}]});
 assert.match(html,/분기 총변화/);assert.match(html,/68 → 57/);assert.match(html,/[-−]11/);
 assert.match(html,/농경지 &lt;확장&gt;/);assert.match(html,/data-action="focus-order"/);
 assert.doesNotMatch(html,/직접 효과|정책 효과/);
});

test('map issue and result pins expose named native actions without choosing or executing commands',()=>{
 const pin={id:'priority:resource:lumen',countryId:'lumen',siteKind:null,label:'식량 부족',value:'식량 28',tone:'danger',icon:'alert',action:'inspect-priority',changeId:null};
 const html=renderMapPin(pin);
 assert.match(html,/<button type="button"/);assert.match(html,/식량 부족/);assert.match(html,/식량 28/);
 assert.match(html,/data-action="inspect-priority"/);assert.doesNotMatch(html,/submit|checked|advance-button/);
 assert.match(html,/aria-hidden="true"/);
});

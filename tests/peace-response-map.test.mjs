import test from 'node:test';
import assert from 'node:assert/strict';
import {peaceResponseMapLinks,peaceResponseGeometry,renderPeaceResponseMapKey} from '../dist/peace-response-map.mjs';
import {routeGeometry} from '../dist/map-geometry.mjs';

const fixture=()=>({turn:8,playerId:'lumen',peaceResponseStartTurn:1,peaceAccords:[{id:'peace-accord-cera-nord-5',principalIds:['cera','nord'],status:'violated',violation:{countryId:'cera'},foreignResponse:{kind:'sanction',initiatorId:'nord',targetId:'cera',memberIds:['nord','marin'],formedTurn:8,startsTurn:8,untilTurn:11,status:'active',reason:'협정 위반과 동맹 공동 대응'}}]});

test('map shows actual coalition commercial pairs without making the player a member',()=>{
 const state=fixture(),before=structuredClone(state);
 const links=peaceResponseMapLinks(state,'result');
 assert.deepEqual(links.map(item=>[item.fromId,item.toId]),[['nord','cera'],['marin','cera']]);
 assert.ok(links.every(item=>item.fromId!=='lumen'&&item.toId!=='lumen'&&item.untilTurn===11));
 assert.deepEqual(state,before);
 const html=renderPeaceResponseMapKey(state,'result');
 assert.match(html,/노르드/);assert.match(html,/마린/);assert.match(html,/세라/);
 assert.match(html,/상업 거래 제한/);assert.match(html,/10분기/);assert.match(html,/인도/);
 assert.doesNotMatch(html,/peace-accord-cera-nord-5/);
});

test('next-command expiry and settled or proposed response never leave a phantom embargo',()=>{
 const state=fixture();state.turn=10;
 assert.equal(peaceResponseMapLinks(state,'result').length,2);
 assert.deepEqual(peaceResponseMapLinks(state,'decision'),[]);
 state.turn=8;state.peaceAccords[0].foreignResponse.status='settled';
 assert.equal(renderPeaceResponseMapKey(state),'');
 state.peaceAccords[0].foreignResponse.kind='renegotiate';state.peaceAccords[0].foreignResponse.status='proposed';
 assert.deepEqual(peaceResponseMapLinks(state),[]);
});

test('legacy and fresh initial states have no enforcement decoration',()=>{
 assert.equal(renderPeaceResponseMapKey({turn:0,peaceAccords:[]}), '');
 const state=fixture();delete state.peaceResponseStartTurn;
 assert.deepEqual(peaceResponseMapLinks(state),[]);
});

test('enforcement water corridor clears the northern facility label',()=>{
 const ordinary=routeGeometry('lumen','cera');
 const enforcement=peaceResponseGeometry({fromId:'lumen',toId:'cera'});
 assert.ok(ordinary.y<270);
 assert.ok(enforcement.y>290&&enforcement.y<340);
 assert.notEqual(enforcement.d,ordinary.d);
 assert.ok(peaceResponseGeometry({fromId:'cera',toId:'lumen'}).y>290);
 const diagonal=peaceResponseGeometry({fromId:'altia',toId:'cera'});
 assert.ok(diagonal.y<385,'diagonal cross remains north of Marin labels');
});

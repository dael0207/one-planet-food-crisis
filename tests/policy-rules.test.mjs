import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction,getPolicies} from '../dist/engine.mjs';

test('V9 Lumen choices expose distinct costs, resources, trust and relations',()=>{
 // Keep the published V9 policy comparison independent of V29 foreign strategy choices.
 const start=createGame('lumen',{foreignStrategyStartTurn:999}),relation=start.relations['lumen:nord'];
 const metadata=getPolicies(start).find(action=>action.id==='balanced'),action=getAction(start,'balanced');
 assert.equal(metadata.name,'교역 신뢰 강화');assert.equal(metadata.cost,4);
 assert.equal(action.cost,4);assert.match(action.description,/기존.*수출|수출.*유지/);assert.match(action.forecast,/국고 −4/);
 const maintained=advanceTurn(start,'maintain'),balanced=advanceTurn(start,'balanced'),embargoed=advanceTurn(start,'embargo');
 assert.equal(balanced.history.at(-1).actionCost,4);assert.equal(maintained.history.at(-1).actionCost,0);
 assert.equal(balanced.countries.lumen.treasury,maintained.countries.lumen.treasury-4);
 assert.equal(balanced.countries.lumen.food,maintained.countries.lumen.food);
 assert.equal(balanced.countries.lumen.trust,maintained.countries.lumen.trust+4);
 assert.equal(balanced.relations['lumen:nord'],relation+6);
 assert.deepEqual(balanced.history.at(-1).policyRelationEffects,[{countryId:'nord',before:73,after:79,effect:6}]);
 assert.ok(embargoed.countries.lumen.food>balanced.countries.lumen.food);
 assert.ok(embargoed.countries.nord.food<balanced.countries.nord.food);
 assert.ok(embargoed.relations['lumen:nord']<maintained.relations['lumen:nord']);
 const keepEmbargo=getAction(embargoed,'maintain');assert.equal(keepEmbargo.name,'수출 제한 유지');assert.match(keepEmbargo.description,/수출 제한을 유지/);assert.match(keepEmbargo.forecast,/필수 인도만 유지/);
});

test('legacy policy boundary keeps old balanced metadata and effects',()=>{
 const legacy=createGame('lumen',{policyStartTurn:2}),relation=legacy.relations['lumen:nord'];
 const action=getAction(legacy,'balanced');assert.equal(action.name,'교역 유지');assert.equal(action.cost,0);
 const old=advanceTurn(legacy,'balanced');
 assert.equal(old.countries.lumen.trust,advanceTurn(legacy,'maintain').countries.lumen.trust+2);
 assert.equal(old.countries.nord.trust,advanceTurn(legacy,'maintain').countries.nord.trust+1);
 assert.equal(old.relations['lumen:nord'],relation);
 assert.deepEqual(old.history.at(-1).policyRelationEffects,[]);
 assert.equal(getAction(old,'balanced').name,'교역 신뢰 강화');assert.equal(getAction(old,'balanced').cost,4);
});

test('policy relation history reports the realized capped effect without mutating input',()=>{
 const start=createGame('lumen'),before=structuredClone(start);start.relations['lumen:nord']=98;before.relations['lumen:nord']=98;
 const next=advanceTurn(start,'balanced');assert.deepEqual(start,before);
 assert.equal(next.relations['lumen:nord'],100);
 assert.deepEqual(next.history.at(-1).policyRelationEffects,[{countryId:'nord',before:98,after:100,effect:2}]);
});

test('facility development records start, pending and completion without early benefit or input mutation',()=>{
 const initial=createGame('lumen'),before=structuredClone(initial),started=advanceTurn(initial,'invest');
 assert.deepEqual(initial,before);assert.equal(started.farmLevel,0);
 assert.deepEqual(started.history.at(-1).development,{levelBefore:0,levelAfter:0,started:[{type:'facility',countryId:'lumen',dueTurn:3}],completed:[],ongoing:[{type:'facility',countryId:'lumen',dueTurn:3}]});
 const control1=advanceTurn(createGame('lumen'),'maintain');assert.equal(started.countries.lumen.food,control1.countries.lumen.food);
 const pending=advanceTurn(started,'maintain'),control2=advanceTurn(control1,'maintain');
 assert.equal(pending.farmLevel,0);assert.equal(pending.countries.lumen.food,control2.countries.lumen.food);
 assert.deepEqual(pending.history.at(-1).development,{levelBefore:0,levelAfter:0,started:[],completed:[],ongoing:[{type:'facility',countryId:'lumen',dueTurn:3}]});
 const complete=advanceTurn(pending,'maintain'),control3=advanceTurn(control2,'maintain');
 assert.equal(complete.farmLevel,1);assert.equal(complete.countries.lumen.food,control3.countries.lumen.food+4);
 assert.deepEqual(complete.history.at(-1).development,{levelBefore:0,levelAfter:1,started:[],completed:[{type:'facility',countryId:'lumen',dueTurn:3}],ongoing:[]});
});

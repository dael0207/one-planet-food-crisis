import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,advanceTurn,createGame} from '../dist/engine.mjs';
import {farmLandscape} from '../dist/farm-landscape.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const quiet={networkStartTurn:99,policyStartTurn:99,objectiveStartTurn:99,worldGoalStartTurn:99,conflictStartTurn:99,mediationStartTurn:99,peaceOfferStartTurn:99,peaceComplianceStartTurn:99,peaceResponseStartTurn:99,foreignSiteStartTurn:99,jointStartTurn:99,foreignStrategyStartTurn:99};
const play=(state,turns,command='maintain')=>Array.from({length:turns}).reduce(current=>advanceTurn(current,command),state);

test('Given opening campaigns When farm landscapes are projected Then no drought is invented',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=createGame(playerId,quiet),model=farmLandscape(state,playerId);
  assert.equal(model.phase,'healthy');
  assert.equal(model.severity,0);
  assert.equal(model.lastDroughtTurn,null);
  assert.equal(model.climateImpact,null);
 }
});

test('Given the first completed drought quarter When all six landscapes are projected Then actual regional impacts determine severity',()=>{
 const state=advanceTurn(createGame('lumen',quiet),'maintain');
 const expected={lumen:[-8,3],nord:[-2,1],cera:[-2,1],altia:[-2,1],marin:[-1,1],solis:[-5,2]};
 for(const countryId of COUNTRY_IDS){
  const model=farmLandscape(state,countryId);
  assert.equal(model.phase,'drought');
  assert.equal(model.climateImpact,expected[countryId][0]);
  assert.equal(model.severity,expected[countryId][1]);
  assert.equal(model.droughtStartTurn,1);
  assert.equal(model.lastDroughtTurn,1);
  assert.equal(model.recoveryElapsed,0);
 }
});

test('Given the canonical crisis When subsequent quarters are actually played Then recovery progresses and clears after four quarters',()=>{
 let state=play(createGame('lumen',quiet),3);
 assert.deepEqual([farmLandscape(state,'lumen').phase,farmLandscape(state,'lumen').droughtStartTurn,farmLandscape(state,'lumen').lastDroughtTurn],['drought',1,3]);
 const recovery=[];
 for(let elapsed=1;elapsed<=4;elapsed+=1){state=advanceTurn(state,'maintain');const model=farmLandscape(state,'lumen');recovery.push([model.phase,model.severity,model.recoveryElapsed,model.climateImpact]);}
 assert.deepEqual(recovery,[['recovering',3,1,-5],['recovering',2,2,0],['recovering',2,3,8],['healthy',0,4,5]]);
 state=play(state,5);
 assert.equal(state.turn,12);
 assert.equal(farmLandscape(state,'lumen').phase,'healthy');
});

test('Given a recovered landscape and a later completed drought When projected Then recovery restarts from that event',()=>{
 const state=play(createGame('lumen',quiet),8),next=structuredClone(state);
 next.turn=9;
 next.history.push({turn:9,eventTitle:'가뭄 경보',foodBreakdown:[{label:'기후·수확',value:-6}]});
 const model=farmLandscape(next,'lumen');
 assert.equal(model.phase,'drought');
 assert.equal(model.severity,2);
 assert.equal(model.droughtStartTurn,9);
 assert.equal(model.lastDroughtTurn,9);
 assert.equal(model.climateImpact,-6);
});

test('Given a completed negative winter climate event When projected Then it does not create drought soil',()=>{
 const state=play(createGame('lumen',quiet),8),model=farmLandscape(state,'lumen');
 assert.equal(model.climateEvent,'짧은 한파');
 assert.equal(model.climateImpact,-3);
 assert.equal(model.phase,'healthy');
 assert.equal(model.severity,0);
});

test('Given a campaign beyond the history cap When all countries are projected Then old drought does not leak into current soil',()=>{
 const state=play(createGame('lumen',quiet),90);
 assert.equal(state.history.length,80);
 for(const countryId of COUNTRY_IDS){
  const model=farmLandscape(state,countryId);
  assert.equal(model.phase,'healthy');
  assert.equal(model.lastDroughtTurn,null);
 }
});

test('Given low exported stock after recovery When landscape is projected Then stock pressure does not manufacture drought',()=>{
 const state=play(createGame('cera',quiet),10);
 state.countries.cera.food=20;
 const model=farmLandscape(state,'cera');
 assert.equal(model.phase,'healthy');
 assert.equal(model.stockPressure,true);
 assert.equal(model.reason,'recovered-drought');
});

test('Given separate site and national investments When they build and complete Then their real levels and projects remain distinct',()=>{
 let state=advanceTurn(createGame('lumen',quiet),'site:farm:upgrade');
 let model=farmLandscape(state,'lumen');
 assert.equal(model.infrastructure.siteLevel,0);
 assert.equal(model.infrastructure.siteProject.level,1);
 assert.equal(model.infrastructure.siteDueTurn,3);
 assert.equal(model.infrastructure.nationalProject,null);
 assert.equal(model.infrastructure.expanded,false);
 state=advanceTurn(state,'invest');
 model=farmLandscape(state,'lumen');
 assert.equal(model.infrastructure.siteProject.level,1);
 assert.equal(model.infrastructure.nationalProject.dueTurn,4);
 assert.equal(model.infrastructure.nationalLevel,0);
 state=advanceTurn(state,'maintain');
 model=farmLandscape(state,'lumen');
 assert.equal(model.infrastructure.siteLevel,1);
 assert.equal(model.infrastructure.siteProject,null);
 assert.equal(model.infrastructure.expanded,true);
 assert.equal(model.infrastructure.nationalLevel,0);
 state=advanceTurn(state,'maintain');
 model=farmLandscape(state,'lumen');
 assert.equal(model.infrastructure.nationalLevel,1);
 assert.equal(model.infrastructure.nationalProject,null);
 assert.equal(model.infrastructure.irrigated,true);
 const foreign=farmLandscape(state,'nord').infrastructure;
 assert.equal(foreign.siteLevel,null);
 assert.equal(foreign.nationalLevel,null);
 assert.equal(foreign.irrigated,false);
});

test('Given replayed state When landscape is projected before and after save-load Then it is deterministic and immutable',()=>{
 const memory=new Map();
 globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
 const state=play(createGame('solis'),6),before=structuredClone(state),first=farmLandscape(state,'solis');
 assert.equal(saveGame(state),true);
 const loaded=loadGame('solis');
 assert.equal(loaded.status,'restored');
 assert.deepEqual(farmLandscape(loaded.state,'solis'),first);
 assert.deepEqual(state,before);
 delete globalThis.localStorage;
});

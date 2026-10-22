import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';

import {advanceTurn,COUNTRY_IDS,createGame,getAction,siteView} from '../dist/engine.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

const play=(state,commands)=>commands.reduce((current,command)=>advanceTurn(current,command),state);

test('foreign site activation is gated and never derives fake levels from national infrastructure',()=>{
 let state=createGame('lumen',{foreignSiteStartTurn:3});state.countries.cera.infrastructure=3;
 state=play(state,['maintain','maintain']);
 assert.equal(state.foreignSites,undefined);assert.ok(state.history.every(item=>item.foreignSiteDevelopment===undefined&&item.foreignSiteOperations===undefined));
 assert.equal(siteView(state,'cera','farm').level,null);
 state=advanceTurn(state,'maintain');
 assert.equal(state.foreignSites.cera.farm.level,0);assert.equal(siteView(state,'cera','farm').level,0);
 assert.equal(getAction(state,'site:cera:farm:upgrade'),null);
});

test('foreign construction takes two quarters and completed farms alone produce real food',()=>{
 let state=createGame('lumen');state=advanceTurn(state,'maintain');
 const start=state.history.at(-1).foreignSiteDevelopment.started[0];
 assert.equal(start.dueTurn,start.startTurn+2);
 const actor=start.countryId,kind=start.siteKind,before=state.foreignSites[actor][kind].level;
 state=advanceTurn(state,'maintain');assert.equal(state.foreignSites[actor][kind].level,before);
 state=advanceTurn(state,'maintain');
 assert.equal(state.foreignSites[actor][kind].level,before+1);
 assert.ok(state.history.at(-1).foreignSiteOperations.every(event=>event.source==='foreign_site'&&event.turn===state.turn&&event.reason&&event.text));
});

test('a reachable sanctions stance blocks only opposing developed ports and their player impact',()=>{
 const before=play(createGame('lumen'),Array(3).fill('maintain')),conflictId=before.goalConflicts[0].id;
 const open=advanceTurn(structuredClone(before),`stance:${conflictId}:neutral`),blocked=advanceTurn(before,`stance:${conflictId}:response`);
 const openTrade=open.history.at(-1).foreignSiteOperations.find(event=>event.operation==='trade'&&event.countryId==='marin'&&event.targetId==='lumen');
 assert.ok(openTrade);assert.deepEqual(openTrade.playerImpact,{food:openTrade.food,treasury:-openTrade.money});assert.equal(openTrade.shipmentFromId,'marin');assert.equal(openTrade.shipmentToId,'lumen');
 assert.equal(blocked.history.at(-1).foreignSiteOperations.some(event=>event.operation==='trade'&&event.countryId==='marin'&&event.targetId==='lumen'),false);
 assert.ok(open.history.at(-1).foodBreakdown.some(part=>part.value===openTrade.food&&part.label.includes('외국 항만')));
 assert.equal(blocked.history.at(-1).foodBreakdown.some(part=>part.label.includes('마린 외국 항만')),false);
});

test('autonomous decisions stay bounded across six campaigns and persist strict activation gates',()=>{
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  let state=createGame(playerId,{foreignSiteStartTurn:index+1});state=play(state,Array(36).fill('maintain'));
  const sites=Object.values(state.foreignSites);
  assert.equal(sites.length,5);assert.ok(sites.flatMap(country=>Object.values(country)).every(site=>site.level>=0&&site.level<=3));
  assert.ok(Object.values(state.countries).every(country=>country.treasury>=0&&country.treasury<=100));
  for(const record of state.history){
   const paid=(record.foreignSiteOperations??[]).filter(event=>['upgrade','manage'].includes(event.operation));
   const counts=new Map();for(const event of paid)counts.set(event.countryId,(counts.get(event.countryId)??0)+1);
   assert.ok([...counts.values()].every(count=>count<=1));
  }
  const managed=new Set(state.history.flatMap(record=>record.foreignSiteOperations??[]).filter(event=>event.operation==='manage').map(event=>event.kind));
  assert.deepEqual([...managed].sort(),['city','farm','port']);
  assert.equal(saveGame(state,{phase:'result',step:index%4}),true);assert.equal(loadGame(playerId).state.foreignSiteStartTurn,index+1);
 }
 for(const marker of [0,-1,1.5,'1',3]){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:{playerId:'nord',actions:['maintain'],foreignSiteStartTurn:marker,phase:'result',step:0}}}));
  assert.equal(loadGame('nord').status,'invalid');
 }
});

test('old slots activate after their command history without changing earlier replay state',()=>{
 const actions=['maintain','maintain','maintain'];
 const legacyOptions={networkStartTurn:4,policyStartTurn:4,objectiveStartTurn:4,worldGoalStartTurn:4,conflictStartTurn:4,mediationStartTurn:4,peaceOfferStartTurn:4,peaceComplianceStartTurn:4,peaceResponseStartTurn:4,foreignSiteStartTurn:4,jointStartTurn:4,foreignStrategyStartTurn:4};
 const expected=play(createGame('solis',legacyOptions),actions);
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'solis',games:{solis:{playerId:'solis',actions,phase:'result',step:0}}}));
 const loaded=loadGame('solis');
 assert.equal(loaded.status,'restored');assert.deepEqual(loaded.state,expected);assert.equal(loaded.state.foreignSiteStartTurn,4);assert.equal(loaded.state.foreignSites,undefined);
 const activated=advanceTurn(loaded.state,'maintain');assert.ok(activated.foreignSites);assert.ok(activated.history.at(-1).foreignSiteOperations.length>0);
});

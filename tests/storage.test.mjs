import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS,getAction} from '../dist/engine.mjs';
import {loadGame,saveGame,savedCountries} from '../dist/storage.mjs';
import {previewTreaty,treatyCommand} from '../dist/treaties.mjs';
const KEY='one-planet-food-crisis-v4';
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());
test('durable commitments, deliveries, breaks and observer reactions replay in each national slot',()=>{
 const campaigns=new Map();
 for(const playerId of COUNTRY_IDS){
  const start=createGame(playerId);
  const draft=COUNTRY_IDS.filter(id=>id!==playerId).map(targetId=>({targetId,kind:'trade_buy',food:1,money:3,duration:8})).sort((a,b)=>previewTreaty(start,b).score-previewTreaty(start,a).score)[0];
  let state=advanceTurn(start,treatyCommand(draft));
  assert.equal(state.treaties.at(-1).status,'active');
  state=advanceTurn(state,'maintain');
  saveGame(state,{phase:'result',step:2});assert.deepEqual(loadGame(playerId).state,state);
  const id=state.treaties.at(-1).id;state=advanceTurn(state,`break:${id}`);
  assert.equal(state.treaties.at(-1).status,'broken');assert.ok(state.lastTreatyEvents.some(event=>event.observers?.length===4));
  saveGame(state,{phase:'result',step:0});campaigns.set(playerId,state);
 }
 for(const [id,state]of campaigns)assert.deepEqual(loadGame(id).state,state);
});
test('outbound diplomacy and pending counters restore in six independent campaigns',()=>{
 const originals=new Map();
 for(const id of COUNTRY_IDS){
  const target=COUNTRY_IDS.find(other=>other!==id);
  const state=advanceTurn(createGame(id),`propose:${target}:sell:6:12`);
  originals.set(id,state);assert.equal(saveGame(state,{phase:'result',step:0}),true);
 }
 for(const id of COUNTRY_IDS)assert.deepEqual(loadGame(id).state,originals.get(id));
 const pending=[...originals.values()].find(state=>state.negotiations.some(record=>record.status==='countered'));
 assert.ok(pending,'at least one real counter is retained in save replay');
 const record=pending.negotiations.find(item=>item.status==='countered');
 const replied=advanceTurn(pending,`reply:${record.id}:decline`);saveGame(replied,{phase:'result',step:2});
 assert.deepEqual(loadGame(replied.playerId).state,replied);
});
test('all country campaigns keep independent resources commands and review phases',()=>{
 for(const [index,id]of COUNTRY_IDS.entries()){
  let state=createGame(id);for(let i=0;i<index+2;i++)state=advanceTurn(state,'maintain');
  assert.equal(saveGame(state,{phase:'result',step:index%4}),true);
 }
 for(const [index,id]of COUNTRY_IDS.entries()){
  const loaded=loadGame(id);assert.equal(loaded.state.playerId,id);assert.equal(loaded.state.turn,index+2);assert.equal(loaded.flow.step,index%4);
 }
 assert.equal(loadGame().state.playerId,'solis');
 assert.equal(Object.keys(savedCountries()).length,6);
});
test('long saves replay all commands rather than only bounded history',()=>{
 let state=createGame('nord');for(let i=0;i<100;i++)state=advanceTurn(state,'maintain');saveGame(state,{phase:'result',step:1});
 assert.deepEqual(loadGame().state,state);
});
test('previewing another nation does not replace the active saved campaign',()=>{
 const state=advanceTurn(createGame('altia'),'maintain');saveGame(state);
 const preview=loadGame('solis');assert.equal(preview.state.turn,0);assert.equal(loadGame().state.playerId,'altia');assert.equal(loadGame().state.turn,1);
});
test('a foreign request under review survives reload without spending',()=>{
 const state=createGame('marin'),requestId=state.requests[0].id;saveGame(state,{phase:'decision',step:0},requestId);
 assert.equal(loadGame().requestId,requestId);assert.equal(loadGame().state.playerId,'marin');assert.equal(loadGame().state.turn,0);
});
test('legacy Lumen is preserved when starting another country first',()=>{
 const legacy=JSON.stringify({actions:Array(10).fill('maintain'),phase:'ending',step:3});values.set('one-planet-food-crisis-v2',legacy);
 saveGame(advanceTurn(createGame('cera'),'maintain'));
 const loaded=loadGame('lumen');assert.equal(loaded.state.turn,10);assert.equal(loaded.state.playerId,'lumen');assert.equal(loaded.status,'migrated');assert.equal(loaded.flow.phase,'decision');assert.equal(values.get('one-planet-food-crisis-v2'),legacy);
});
test('resetting the selected slot keeps another country intact',()=>{
 saveGame(advanceTurn(createGame('nord'),'maintain'));saveGame(advanceTurn(createGame('solis'),'maintain'));saveGame(createGame('solis'));
 assert.equal(loadGame('solis').state.turn,0);assert.equal(loadGame('nord').state.turn,1);
});
test('pre-network campaigns replay old quarters before enabling the new world',()=>{
 let old=createGame('nord',{networkStartTurn:4,policyStartTurn:4,objectiveStartTurn:4,worldGoalStartTurn:4,foreignSiteStartTurn:4,foreignStrategyStartTurn:4});
 for(let i=0;i<3;i++)old=advanceTurn(old,'maintain');
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:{playerId:'nord',actions:old.commands,phase:'result',step:0}}}));
 const loaded=loadGame();
 assert.equal(loaded.status,'restored');assert.deepEqual(loaded.state.countries,old.countries);
 assert.equal(loaded.state.networkStartTurn,4);assert.equal(loaded.state.foreignTreaties.length,0);
 const next=advanceTurn(loaded.state,'maintain');assert.ok(next.foreignTreaties.length>0);
 saveGame(next);assert.deepEqual(loadGame().state,next);
});
test('invalid network activation boundaries cannot change replay rules',()=>{
 for(const networkStartTurn of [0,-1,2.5,99,'1']){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{playerId:'lumen',actions:['maintain'],networkStartTurn,phase:'decision',step:0}}}));
  assert.equal(loadGame().status,'invalid');
 }
});
test('old slots replay paid actions under legacy rules and switch future choices to current rules',()=>{
 const old=createGame('lumen',{policyStartTurn:3,objectiveStartTurn:3,worldGoalStartTurn:3,conflictStartTurn:3,mediationStartTurn:3,peaceOfferStartTurn:3,peaceComplianceStartTurn:3,peaceResponseStartTurn:3,foreignSiteStartTurn:3,jointStartTurn:3,foreignStrategyStartTurn:3});let expected=advanceTurn(old,'balanced');expected=advanceTurn(expected,'balanced');
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{playerId:'lumen',actions:['balanced','balanced'],networkStartTurn:1,phase:'result',step:0}}}));
 const loaded=loadGame('lumen');assert.equal(loaded.status,'restored');assert.deepEqual(loaded.state,expected);assert.equal(loaded.state.policyStartTurn,3);
 assert.equal(getAction(loaded.state,'balanced').cost,4);
 const continued=advanceTurn(loaded.state,'balanced');assert.equal(continued.history.at(-1).actionCost,4);
 saveGame(continued,{phase:'result',step:1});assert.deepEqual(loadGame('lumen').state,continued);
});
test('policy activation boundaries are validated and six slots persist them deterministically',()=>{
 for(const policyStartTurn of [0,-1,1.5,3,'1']){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{playerId:'lumen',actions:['maintain'],networkStartTurn:1,policyStartTurn,phase:'decision',step:0}}}));
  assert.equal(loadGame('lumen').status,'invalid');
 }
 values.clear();
 for(const [index,id] of COUNTRY_IDS.entries()){
  let state=createGame(id,{policyStartTurn:index+1});for(let turn=0;turn<index;turn++)state=advanceTurn(state,'maintain');
  saveGame(state,{phase:'decision',step:0});const loaded=loadGame(id);assert.equal(loaded.status,'restored');assert.deepEqual(loaded.state,state);
 }
 assert.equal(Object.keys(savedCountries()).length,6);
});
test('invalid country identity, actions and review indexes are rejected',()=>{
 for(const saved of [{playerId:'nord',actions:['license'],phase:'result',step:0},{playerId:'altia',actions:[],phase:'decision',step:0},{playerId:'nord',actions:['maintain'],phase:'result',step:99}]){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:saved}}));assert.equal(loadGame().status,'invalid');
 }
 values.set(KEY,'{bad');assert.equal(loadGame().state.turn,0);
});

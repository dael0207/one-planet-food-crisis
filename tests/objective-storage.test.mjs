import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,getAction,COUNTRY_IDS} from '../dist/engine.mjs';
import {saveGame,loadGame} from '../dist/storage.mjs';
const values=new Map(),KEY='one-planet-food-crisis-v4';
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

test('objective progress and unlocked commands survive reload and another national save',()=>{
 let state=createGame('lumen');
 for(const action of ['balanced','invest','maintain','maintain','mandate_lumen_1'])state=advanceTurn(state,action);
 saveGame(state,{phase:'result',step:0});
 saveGame(advanceTurn(createGame('nord'),'strategic_reserve'));
 const restored=loadGame('lumen');
 assert.deepEqual(restored.state,state);assert.ok(getAction(restored.state,'mandate_lumen_1'));
 assert.equal(loadGame('nord').state.objectives.completed.length,0);
});

test('old six-country slots retain resource outcomes and begin counting on their next quarter',()=>{
 for(const id of COUNTRY_IDS){
  let old=createGame(id,{objectiveStartTurn:5,worldGoalStartTurn:5,conflictStartTurn:5,mediationStartTurn:5,peaceOfferStartTurn:5,peaceComplianceStartTurn:5,peaceResponseStartTurn:5,foreignSiteStartTurn:5,jointStartTurn:5,foreignStrategyStartTurn:5});
  for(let i=0;i<4;i++)old=advanceTurn(old,'maintain');
  values.set(KEY,JSON.stringify({version:4,activePlayerId:id,games:{[id]:{playerId:id,actions:old.commands,networkStartTurn:1,policyStartTurn:1,phase:'result',step:0}}}));
  const restored=loadGame(id);
  assert.equal(restored.status,'restored');assert.deepEqual(restored.state,old);
  saveGame(advanceTurn(restored.state,'maintain'));
  const saved=JSON.parse(values.get(KEY)).games[id];
  assert.equal(saved.objectiveStartTurn,5);assert.equal(saved.worldGoalStartTurn,5);
 }
});

test('invalid objective activation boundaries cannot grant early unlocks during replay',()=>{
 for(const objectiveStartTurn of [0,-1,1.5,99,'1']){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{playerId:'lumen',actions:['maintain'],networkStartTurn:1,policyStartTurn:1,objectiveStartTurn,phase:'decision',step:0}}}));
  assert.equal(loadGame().status,'invalid');
 }
});

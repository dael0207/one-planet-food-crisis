import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';
import {previewProposal} from '../dist/negotiations.mjs';
import {marketContext} from '../dist/foreign-diplomacy.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v13-goal-world-replay.json',import.meta.url),'utf8'));
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const oldHash=state=>{const {version,worldGoalStartTurn,conflictStartTurn,goalConflicts,lastConflictEvents,conflictCooldownUntil,mediationStartTurn,mediations,lastMediationEvents,mediationOfferTurnByConflict,peaceOfferStartTurn,peaceOffers,lastPeaceOfferEvents,peaceComplianceStartTurn,peaceAccords,lastPeaceComplianceEvents,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,foreignGoals,lastGoalEvents,...old}=state;return createHash('sha256').update(JSON.stringify(sorted(old))).digest('hex');};
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};

test('six frozen V13 campaigns replay byte-equivalent state before world goal activation',()=>{
 for(const fixture of fixtures){
  let state=createGame(fixture.playerId,{worldGoalStartTurn:fixture.commands.length+1,conflictStartTurn:fixture.commands.length+1,foreignSiteStartTurn:fixture.commands.length+1,jointStartTurn:fixture.commands.length+1,foreignStrategyStartTurn:fixture.commands.length+1});
  for(const command of fixture.commands)state=advanceTurn(state,command);
  assert.equal(oldHash(state),fixture.expectedSha256,fixture.playerId);
  assert.ok(Object.values(state.foreignGoals).every(actor=>actor.lastAction===null));
 }
});

test('goal actors move the world while the player maintains and preserve exact food accounting',()=>{
 for(const playerId of COUNTRY_IDS){
  let state=createGame(playerId);const before=structuredClone(state),policyIds=new Set();
  for(let turn=0;turn<32;turn++){
   const prior=state;state=advanceTurn(state,'maintain');
   const record=state.history.at(-1);
   assert.equal(record.foodBreakdown.reduce((sum,item)=>sum+item.value,0),state.countries[playerId].food-prior.countries[playerId].food);
   for(const [id,actor] of Object.entries(state.foreignGoals)){
    assert.notEqual(id,playerId);if(actor.lastAction)policyIds.add(actor.lastAction.id);
    assert.ok(actor.objectives.completed.length>=(prior.foreignGoals[id]?.objectives.completed.length??0));
   }
   for(const country of Object.values(state.countries))for(const metric of ['food','treasury','approval','trust'])assert.ok(Number.isFinite(country[metric])&&country[metric]>=0&&country[metric]<=100);
  }
  assert.ok(policyIds.size>=4,playerId+' has distinct foreign policies');
  assert.ok(Object.values(state.foreignGoals).some(actor=>actor.objectives.completed.length>=2));
  assert.deepEqual(before,createGame(playerId));
 }
});

test('new actors, offers and relations persist in six independent slots and lean chronicles',()=>{
 storage.clear();
 for(const playerId of COUNTRY_IDS){
  let state=createGame(playerId);for(let turn=0;turn<85;turn++)state=advanceTurn(state,'maintain');
  assert.equal(saveGame(state,{phase:'result',step:0}),true);
  assert.deepEqual(loadGame(playerId).state,state);
  const model=buildChronicle(state);
  assert.equal(model.points.length,86);assert.deepEqual(model.points.at(-1).metrics.food,state.countries[playerId].food);
  assert.ok(model.points.some(point=>point.worldEvents.some(text=>text.includes('장기 목표'))));
 }
});

test('old slots enable goal actors only on a future executed quarter and validate the boundary',()=>{
 storage.clear();const fixture=fixtures[0],slot={playerId:'lumen',actions:fixture.commands,networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,phase:'result',step:0};
 storage.set('one-planet-food-crisis-v4',JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:slot}}));
 const loaded=loadGame();assert.equal(oldHash(loaded.state),fixture.expectedSha256);
 assert.equal(loaded.state.worldGoalStartTurn,fixture.commands.length+1);
 const next=advanceTurn(loaded.state,'maintain');assert.ok(Object.values(next.foreignGoals).some(actor=>actor.lastAction?.turn===next.turn));
 for(const boundary of [0,-1,1.5,'1',fixture.commands.length+2]){
  storage.set('one-planet-food-crisis-v4',JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{...slot,worldGoalStartTurn:boundary}}}));
  assert.equal(loadGame().status,'invalid');
 }
});

test('national intent changes a real proposal score with an explicit goal reason',()=>{
 let state=advanceTurn(createGame('lumen'),'maintain');
 const draft={targetId:'nord',kind:'sell',food:2,money:3};
 const enabled=previewProposal(state,draft),disabled=previewProposal({...state,worldGoalStartTurn:state.turn+2},draft);
 const context=marketContext(state,'nord','sell');
 assert.ok(context.reasons.some(reason=>reason.includes('목표')));
 assert.notEqual(enabled.score,disabled.score);
 assert.equal(enabled.valid,true);
});

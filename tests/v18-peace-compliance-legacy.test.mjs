import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {advanceTurn,COUNTRY_IDS,createGame,getAction,peaceComplianceCommand} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v17-peace-compliance-replay.json',import.meta.url),'utf8'));
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

const V17_ROOT_FIELDS=['activePolicy','agreements','commands','conflictCooldownUntil','conflictStartTurn','countries','farmLevel','foreignGoals','foreignPairCooldowns','foreignStrategyStartTurn','foreignTreaties','foreignTreatyHistory','goalConflicts','history','lastConflictEvents','lastForeignEvents','lastGoalEvents','lastMediationEvents','lastPeaceOfferEvents','lastRequestTurn','lastTreatyEvents','marketShare','mediationOfferTurnByConflict','mediationStartTurn','mediations','negotiations','networkStartTurn','objectiveStartTurn','objectives','peaceOfferStartTurn','peaceOffers','peaceResponseStartTurn','playerId','policyStartTurn','projects','relations','reliability','requests','treaties','turn','version','worldGoalStartTurn'];
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const v17Hash=state=>{
 const {version,peaceComplianceStartTurn,peaceAccords,lastPeaceComplianceEvents,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,...v17}=state;
 return createHash('sha256').update(JSON.stringify(sorted(v17))).digest('hex');
};
const oldSlot=(playerId,actions)=>({playerId,actions,networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,worldGoalStartTurn:1,conflictStartTurn:1,mediationStartTurn:1,peaceOfferStartTurn:1,phase:'result',step:0});
const replay=(fixture,options={})=>fixture.commands.reduce((state,command)=>advanceTurn(state,command),createGame(fixture.playerId,{foreignSiteStartTurn:fixture.commands.length+1,jointStartTurn:fixture.commands.length+1,foreignStrategyStartTurn:fixture.commands.length+1,...options}));

function naturallyViolatedState(){
 const commands=[...Array(24).fill('maintain'),'mediate:goal-conflict-cera-lumen-21:peace:mutual:8:6','maintain','maintain'];
 // This published V18 command sequence must not be preempted by V29 autonomous strategy.
 const state=commands.reduce((current,command)=>advanceTurn(current,command),createGame('nord',{foreignSiteStartTurn:commands.length+2,foreignStrategyStartTurn:commands.length+2}));
 const accord=state.peaceAccords.find(item=>item.status==='violated');assert.ok(accord,'the live V18 campaign produces a deterministic compliance violation');
 return {state,accord};
}

test('six published V17 campaigns remain byte-equivalent before compliance activates',()=>{
 for(const fixture of fixtures){
  const state=replay(fixture,{peaceComplianceStartTurn:fixture.commands.length+1});
  assert.equal(v17Hash(state),fixture.expectedSha256,`${fixture.playerId}: ${fixture.scenario}`);
  assert.deepEqual(state.peaceAccords,[]);assert.deepEqual(state.lastPeaceComplianceEvents,[]);
 }
});

test('V18 adds only the three canonical peace compliance root fields',()=>{
 const state=createGame('lumen'),newFields=Object.keys(state).filter(key=>!V17_ROOT_FIELDS.includes(key)).sort();
 assert.equal(state.version,13);assert.deepEqual(newFields,['foreignSiteStartTurn','jointStartTurn','lastPeaceComplianceEvents','peaceAccords','peaceComplianceStartTurn']);
 assert.equal(state.peaceComplianceStartTurn,1);assert.deepEqual(state.peaceAccords,[]);assert.deepEqual(state.lastPeaceComplianceEvents,[]);
});

test('a missing marker activates after old history and forged derived compliance state is ignored',()=>{
 const fixture=fixtures.find(item=>item.playerId==='lumen'),slot={...oldSlot('lumen',fixture.commands),peaceAccords:[{id:'forged'}],lastPeaceComplianceEvents:[{type:'forged'}]};
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:slot}}));
 const loaded=loadGame('lumen');
 assert.equal(loaded.status,'restored');assert.equal(loaded.state.peaceComplianceStartTurn,fixture.commands.length+1);
 assert.deepEqual(loaded.state.peaceAccords,[]);assert.deepEqual(loaded.state.lastPeaceComplianceEvents,[]);assert.equal(v17Hash(loaded.state),fixture.expectedSha256);
});

test('six slots retain independent activation markers and invalid boundaries cannot change replay',()=>{
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  let state=createGame(playerId,{peaceComplianceStartTurn:index+1});
  for(let turn=0;turn<index;turn++)state=advanceTurn(state,'maintain');
  assert.equal(saveGame(state,{phase:'result',step:index%4}),true);
 }
 const saved=JSON.parse(values.get(KEY));assert.deepEqual(Object.keys(saved.games).sort(),[...COUNTRY_IDS].sort());
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  assert.equal(saved.games[playerId].peaceComplianceStartTurn,index+1);assert.equal(loadGame(playerId).state.peaceComplianceStartTurn,index+1);
 }
 for(const marker of [0,-1,1.5,'1',3]){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:{...oldSlot('nord',['maintain']),peaceComplianceStartTurn:marker}}}));
  assert.equal(loadGame('nord').status,'invalid');
 }
});

test('a canonical compliance response command and long chronicle replay exactly after reload',()=>{
 const {state,accord}=naturallyViolatedState(),command=peaceComplianceCommand(accord.id,'sanction');
 assert.equal(typeof command,'string');assert.ok(command.length<160);assert.ok(getAction(state,command));
 const responded=advanceTurn(state,command);assert.equal(responded.commands.at(-1),command);
 const chronicle=buildChronicle(responded);assert.equal(saveGame(responded,{phase:'result',step:2}),true);
 const restored=loadGame(responded.playerId);assert.deepEqual(restored.state,responded);assert.deepEqual(buildChronicle(restored.state),chronicle);
});

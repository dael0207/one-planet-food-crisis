import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v15-mediation-replay.json',import.meta.url),'utf8'));
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const v15Hash=state=>{
 const {version,mediationStartTurn,mediations,lastMediationEvents,mediationOfferTurnByConflict,peaceOfferStartTurn,peaceOffers,lastPeaceOfferEvents,peaceComplianceStartTurn,peaceAccords,lastPeaceComplianceEvents,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,...v15}=state;
 return createHash('sha256').update(JSON.stringify(sorted(v15))).digest('hex');
};
const oldSlot=(playerId,actions)=>({playerId,actions,networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,worldGoalStartTurn:1,conflictStartTurn:1,phase:'result',step:0});

test('six V15 campaigns remain byte-equivalent before mediation activation',()=>{
 for(const fixture of fixtures){
  let state=createGame(fixture.playerId,{conflictStartTurn:1,mediationStartTurn:fixture.commands.length+1,peaceOfferStartTurn:fixture.commands.length+1,foreignSiteStartTurn:fixture.commands.length+1,jointStartTurn:fixture.commands.length+1,foreignStrategyStartTurn:fixture.commands.length+1});
  for(const command of fixture.commands)state=advanceTurn(state,command);
  assert.equal(v15Hash(state),fixture.expectedSha256,fixture.playerId);
  assert.deepEqual(state.mediations,[]);
  assert.deepEqual(state.lastMediationEvents,[]);
 }
});

test('V16 game state exposes canonical mediation storage fields',()=>{
 const state=createGame('lumen');
 assert.equal(state.version,13);
 assert.equal(state.mediationStartTurn,1);
 assert.deepEqual(state.mediations,[]);
 assert.deepEqual(state.lastMediationEvents,[]);
 assert.deepEqual(state.mediationOfferTurnByConflict,{});
});

test('old save activates mediation only after its restored command history',()=>{
 const actions=fixtures.find(item=>item.playerId==='lumen').commands;
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:oldSlot('lumen',actions)}}));

 const loaded=loadGame('lumen');

 assert.equal(loaded.status,'restored');
 assert.equal(loaded.state.mediationStartTurn,actions.length+1);
 assert.equal(loaded.state.mediations.length,0);
 assert.equal(v15Hash(loaded.state),fixtures.find(item=>item.playerId==='lumen').expectedSha256);
});

test('six save slots retain their own mediation activation boundaries',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=advanceTurn(createGame(playerId,{mediationStartTurn:2}),'maintain');
  assert.equal(saveGame(state,{phase:'result',step:0}),true);
 }

 const saved=JSON.parse(values.get(KEY));
 assert.deepEqual(Object.keys(saved.games).sort(),[...COUNTRY_IDS].sort());
 for(const playerId of COUNTRY_IDS){
  assert.equal(saved.games[playerId].mediationStartTurn,2);
  assert.equal(loadGame(playerId).state.mediationStartTurn,2);
 }
});

test('invalid mediation activation boundaries cannot alter canonical replay',()=>{
 for(const mediationStartTurn of [0,-1,1.5,'1',3]){
  const slot={...oldSlot('nord',['maintain']),mediationStartTurn};
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:slot}}));
  assert.equal(loadGame('nord').status,'invalid');
 }
});

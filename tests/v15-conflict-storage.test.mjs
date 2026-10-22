import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

test('six national slots replay conflict stance and multi-quarter aftermath',()=>{
 for(const playerId of COUNTRY_IDS){
  let state=createGame(playerId);for(let turn=0;turn<3;turn++)state=advanceTurn(state,'maintain');
  const conflict=state.goalConflicts[0];
  if(conflict)state=advanceTurn(state,`stance:${conflict.id}:neutral`);
  state=advanceTurn(state,'maintain');
  assert.equal(saveGame(state,{phase:'result',step:0}),true);
  assert.deepEqual(loadGame(playerId).state,state);
 }
});

test('old save starts its conflict runway only after restored history',()=>{
 const actions=['maintain','maintain','maintain'];
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:{playerId:'nord',actions,networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,worldGoalStartTurn:1,phase:'result',step:0}}}));
 const loaded=loadGame('nord');
 assert.equal(loaded.state.conflictStartTurn,actions.length+1);
 assert.equal(loaded.state.goalConflicts.length,0);
 let next=advanceTurn(loaded.state,'maintain');assert.equal(next.goalConflicts.length,0);
 next=advanceTurn(next,'maintain');assert.equal(next.goalConflicts.length,0);
 next=advanceTurn(next,'maintain');
 assert.ok(next.goalConflicts.some(conflict=>conflict.formedTurn===next.turn));
});

test('invalid conflict activation boundaries cannot alter replay rules',()=>{
 for(const conflictStartTurn of [0,-1,1.5,'1',3]){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:{playerId:'nord',actions:['maintain'],networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,worldGoalStartTurn:1,conflictStartTurn,phase:'result',step:0}}}));
  assert.equal(loadGame('nord').status,'invalid');
 }
});

test('forged saved conflict state is ignored in favor of canonical command replay',()=>{
 let state=createGame('nord');for(let turn=0;turn<3;turn++)state=advanceTurn(state,'maintain');
 const id=state.goalConflicts[0].id;
 state=advanceTurn(state,`stance:${id}:response`);
 saveGame(state,{phase:'result',step:0});
 const canonical=loadGame('nord').state,root=JSON.parse(values.get(KEY));
 root.games.nord.goalConflicts=[{id:'forged',status:'active',playerStance:'sanction'}];
 root.games.nord.conflictCooldownUntil=9999;
 root.games.nord.countries={nord:{food:100,treasury:100}};
 values.set(KEY,JSON.stringify(root));
 assert.deepEqual(loadGame('nord').state,canonical);
});

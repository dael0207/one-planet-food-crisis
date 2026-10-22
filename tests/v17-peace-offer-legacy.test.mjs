import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createGame,advanceTurn,COUNTRY_IDS,getAction} from '../dist/engine.mjs';
import {pendingPeaceOffers,peaceCounterCommand,peaceReplyCommand} from '../dist/peace-offers.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v16-peace-offer-replay.json',import.meta.url),'utf8'));
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const v16Hash=state=>{
 const {version,peaceOfferStartTurn,peaceOffers,lastPeaceOfferEvents,peaceComplianceStartTurn,peaceAccords,lastPeaceComplianceEvents,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,...v16}=state;
 return createHash('sha256').update(JSON.stringify(sorted(v16))).digest('hex');
};
const oldSlot=(playerId,actions)=>({playerId,actions,networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,worldGoalStartTurn:1,conflictStartTurn:1,mediationStartTurn:1,phase:'result',step:0});

function stateWithPendingOffer(playerId){
 let state=createGame(playerId);
 for(let turn=0;turn<24&&!pendingPeaceOffers(state).length;turn++)state=advanceTurn(state,'maintain');
 assert.ok(pendingPeaceOffers(state).length,`${playerId} receives a peace offer`);
 return state;
}
function validCounterCommand(state,offer){
 for(const goal of ['relief','peace'])for(const condition of ['mutual','target'])for(const food of [0,4,8])for(const money of [0,6,12]){
  const command=peaceCounterCommand({offerId:offer.id,conflictId:offer.conflictId,goal,condition,food,money});
  if(getAction(state,command))return command;
 }
 assert.fail(`${state.playerId}: expected a valid counter command`);
}

test('six published V16 mediation campaigns remain byte-equivalent before peace offers activate',()=>{
 for(const fixture of fixtures){
  let state=createGame(fixture.playerId,{peaceOfferStartTurn:fixture.commands.length+1,peaceComplianceStartTurn:fixture.commands.length+1,foreignSiteStartTurn:fixture.commands.length+1,jointStartTurn:fixture.commands.length+1,foreignStrategyStartTurn:fixture.commands.length+1});
  for(const command of fixture.commands)state=advanceTurn(state,command);
  assert.equal(v16Hash(state),fixture.expectedSha256,`${fixture.playerId}: ${fixture.scenario}`);
  assert.deepEqual(state.peaceOffers,[]);
  assert.deepEqual(state.lastPeaceOfferEvents,[]);
 }
});

test('V17 game state exposes only the canonical peace offer storage fields',()=>{
 const state=createGame('lumen');
 assert.equal(state.version,13);
 assert.equal(state.peaceOfferStartTurn,1);
 assert.deepEqual(state.peaceOffers,[]);
 assert.deepEqual(state.lastPeaceOfferEvents,[]);
});

test('old save activates incoming peace offers only after its restored command history',()=>{
 const fixture=fixtures.find(item=>item.playerId==='lumen');
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:oldSlot('lumen',fixture.commands)}}));

 const loaded=loadGame('lumen');

 assert.equal(loaded.status,'restored');
 assert.equal(loaded.state.peaceOfferStartTurn,fixture.commands.length+1);
 assert.deepEqual(loaded.state.peaceOffers,[]);
 assert.deepEqual(loaded.state.lastPeaceOfferEvents,[]);
 assert.equal(v16Hash(loaded.state),fixture.expectedSha256);
});

test('six save slots retain their own peace offer activation boundaries',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=advanceTurn(createGame(playerId,{peaceOfferStartTurn:2}),'maintain');
  assert.equal(saveGame(state,{phase:'result',step:0}),true);
 }

 const saved=JSON.parse(values.get(KEY));
 assert.equal(saved.version,4);
 assert.deepEqual(Object.keys(saved.games).sort(),[...COUNTRY_IDS].sort());
 for(const playerId of COUNTRY_IDS){
  assert.equal(saved.games[playerId].peaceOfferStartTurn,2);
  assert.equal(loadGame(playerId).state.peaceOfferStartTurn,2);
 }
});

test('invalid peace offer activation boundaries cannot alter canonical replay',()=>{
 for(const peaceOfferStartTurn of [0,-1,1.5,'1',3]){
  const slot={...oldSlot('nord',['maintain']),peaceOfferStartTurn};
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:slot}}));
  assert.equal(loadGame('nord').status,'invalid');
 }
});

test('incoming accept decline and counter commands replay alongside six independent slots',()=>{
 const responses={nord:'accept',cera:'decline',marin:'counter'},expected=new Map();
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  let state=responses[playerId]?stateWithPendingOffer(playerId):advanceTurn(createGame(playerId),'maintain');
  if(responses[playerId]){
   const offer=pendingPeaceOffers(state)[0],kind=responses[playerId];
   const command=kind==='counter'?validCounterCommand(state,offer):peaceReplyCommand(offer.id,kind);
   assert.ok(getAction(state,command),`${playerId}: ${kind} command is currently valid`);
   state=advanceTurn(state,command);
   assert.equal(state.commands.at(-1),command);
  }
  assert.equal(saveGame(state,{phase:'result',step:index%4}),true);
  expected.set(playerId,state);
 }
 assert.deepEqual(Object.keys(JSON.parse(values.get(KEY)).games).sort(),[...COUNTRY_IDS].sort());
 for(const [playerId,state] of expected)assert.deepEqual(loadGame(playerId).state,state,`${playerId} reload`);
});

import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {advanceTurn,COUNTRY_IDS,createGame,getAction} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v18-peace-response-replay.json',import.meta.url),'utf8'));
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());

const V18_ROOT_FIELDS=['activePolicy','agreements','commands','conflictCooldownUntil','conflictStartTurn','countries','farmLevel','foreignGoals','foreignPairCooldowns','foreignStrategyStartTurn','foreignTreaties','foreignTreatyHistory','goalConflicts','history','lastConflictEvents','lastForeignEvents','lastGoalEvents','lastMediationEvents','lastPeaceComplianceEvents','lastPeaceOfferEvents','lastRequestTurn','lastTreatyEvents','marketShare','mediationOfferTurnByConflict','mediationStartTurn','mediations','negotiations','networkStartTurn','objectiveStartTurn','objectives','peaceAccords','peaceComplianceStartTurn','peaceOfferStartTurn','peaceOffers','playerId','policyStartTurn','projects','relations','reliability','requests','treaties','turn','version','worldGoalStartTurn'];
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const v18Hash=state=>{
 const {version,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,...v18}=state;
 return createHash('sha256').update(JSON.stringify(sorted(v18))).digest('hex');
};
const oldSlot=(playerId,actions)=>({playerId,actions,networkStartTurn:1,policyStartTurn:1,objectiveStartTurn:1,worldGoalStartTurn:1,conflictStartTurn:1,mediationStartTurn:1,peaceOfferStartTurn:1,peaceComplianceStartTurn:1,phase:'result',step:0});
const replay=(fixture,options={})=>fixture.commands.reduce((state,command)=>advanceTurn(state,command),createGame(fixture.playerId,{foreignSiteStartTurn:fixture.commands.length+1,jointStartTurn:fixture.commands.length+1,foreignStrategyStartTurn:fixture.commands.length+1,...options}));
const play=(state,commands)=>commands.reduce((current,command)=>{
 assert.ok(getAction(current,command),`turn ${current.turn+1}: ${command}`);
 return advanceTurn(current,command);
},state);
const accordProjection=state=>state.peaceAccords.map(accord=>({id:accord.id,status:accord.status,revisionOf:accord.revisionOf??null,responseKind:accord.response?.kind??null}));

test('six published V18 campaigns remain byte-equivalent before peace responses activate',()=>{
 assert.deepEqual(fixtures.map(fixture=>fixture.playerId),COUNTRY_IDS);
 for(const fixture of fixtures){
  const state=replay(fixture,{peaceResponseStartTurn:fixture.commands.length+1});
  assert.equal(state.turn,fixture.expectedTurn);assert.deepEqual(accordProjection(state),fixture.expectedAccords);
  assert.equal(v18Hash(state),fixture.expectedSha256,`${fixture.playerId}: ${fixture.scenario}`);
 }
});

test('V19 adds only the canonical peace response activation marker',()=>{
 const state=createGame('lumen'),newFields=Object.keys(state).filter(key=>!V18_ROOT_FIELDS.includes(key)).sort();
 assert.equal(state.version,13);assert.deepEqual(newFields,['foreignSiteStartTurn','jointStartTurn','peaceResponseStartTurn']);assert.equal(state.peaceResponseStartTurn,1);
});

test('a missing marker activates after old history and forged derived response state is ignored',()=>{
 const fixture=fixtures.find(item=>item.playerId==='nord');
 const slot={...oldSlot('nord',fixture.commands),peaceAccords:[{id:'forged',foreignResponse:{kind:'sanction',memberIds:['nord']}}]};
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:slot}}));
 const loaded=loadGame('nord');
 assert.equal(loaded.status,'restored');assert.equal(loaded.state.peaceResponseStartTurn,fixture.commands.length+1);
 assert.deepEqual(accordProjection(loaded.state),fixture.expectedAccords);assert.equal(v18Hash(loaded.state),fixture.expectedSha256);
});

test('six slots retain independent response markers and reject noncanonical boundaries',()=>{
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  const state=play(createGame(playerId,{peaceResponseStartTurn:index+1}),Array(index).fill('maintain'));
  assert.equal(saveGame(state,{phase:'result',step:index%4}),true);
 }
 const saved=JSON.parse(values.get(KEY));assert.deepEqual(Object.keys(saved.games).sort(),[...COUNTRY_IDS].sort());
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  assert.equal(saved.games[playerId].peaceResponseStartTurn,index+1);assert.equal(loadGame(playerId).state.peaceResponseStartTurn,index+1);
 }
 for(const marker of [0,-1,1.5,'1',3]){
  values.set(KEY,JSON.stringify({version:4,activePlayerId:'nord',games:{nord:{...oldSlot('nord',['maintain']),peaceResponseStartTurn:marker}}}));
  assert.equal(loadGame('nord').status,'invalid');
 }
});

test('saved commands canonically derive a foreign response and ignore forged accord fields',()=>{
 const commands=[...Array(4).fill('maintain'),'peace-reply:peace-offer-goal-conflict-cera-lumen-3-4:accept','maintain','maintain'];
 // Preserve the published V19 response sequence independently of V29 autonomous strategy.
 const state=play(createGame('marin',{peaceResponseStartTurn:1,foreignSiteStartTurn:commands.length+1,foreignStrategyStartTurn:commands.length+1}),commands),accord=state.peaceAccords[0];
 assert.ok(accord.foreignResponse,'a canonical post-violation command must trigger the foreign response');
 assert.equal(saveGame(state,{phase:'result',step:2}),true);
 const root=JSON.parse(values.get(KEY));root.games.marin.peaceAccords=[{id:'forged',foreignResponse:{kind:'renegotiate',offerId:'forged'}}];values.set(KEY,JSON.stringify(root));
 const restored=loadGame('marin');assert.equal(restored.status,'restored');assert.deepEqual(restored.state,state);
});

test('lean chronicle replay retains the response marker beyond bounded history',()=>{
 const responseCommands=[...Array(4).fill('maintain'),'peace-reply:peace-offer-goal-conflict-cera-lumen-3-4:accept','maintain','maintain'];
 const responded=play(createGame('marin',{peaceResponseStartTurn:1,foreignSiteStartTurn:responseCommands.length+86,foreignStrategyStartTurn:responseCommands.length+86}),responseCommands),accord=responded.peaceAccords[0];
 assert.ok(accord.foreignResponse);const responseTurn=accord.foreignResponse.formedTurn;
 const expectedWorldEvents=responded.history.find(record=>record.turn===responseTurn).worldActions.map(item=>item.text).filter(Boolean);
 assert.ok(expectedWorldEvents.length>0);
 const long=play(responded,Array(85).fill('maintain')),before=structuredClone(long),chronicle=buildChronicle(long);
 assert.equal(long.history.length,80);assert.deepEqual(long,before);assert.equal(chronicle.points.length,long.commands.length+1);
 assert.deepEqual(chronicle.points[responseTurn].worldEvents,expectedWorldEvents);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {COUNTRY_IDS,advanceTurn,createGame} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v28-legacy-campaigns.json',import.meta.url),'utf8'));
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};

const legacyMarkers=['networkStartTurn','policyStartTurn','objectiveStartTurn','worldGoalStartTurn','conflictStartTurn','mediationStartTurn','peaceOfferStartTurn','peaceComplianceStartTurn','peaceResponseStartTurn','foreignSiteStartTurn','jointStartTurn'];
const withoutMarker=state=>{const {foreignStrategyStartTurn,...legacy}=state;return legacy;};
const sha256=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rootFor=(playerId,slot)=>JSON.stringify({version:4,activePlayerId:playerId,games:{[playerId]:slot}});
const slotFor=fixture=>({playerId:fixture.id,actions:fixture.commands,...Object.fromEntries(legacyMarkers.map(marker=>[marker,fixture.state[marker]])),phase:'result',step:0});

test('fresh games activate foreign strategy on turn one and reject invalid markers',()=>{
 assert.equal(createGame().foreignStrategyStartTurn,1);
 for(const foreignStrategyStartTurn of [0,-1,1.5,'1',NaN,Infinity])assert.throws(()=>createGame('lumen',{foreignStrategyStartTurn}),/전략/);
});

test('all twelve V28 golden campaigns load exactly without mutating their saved root',()=>{
 assert.equal(fixtures.length,12);
 assert.deepEqual(new Set(fixtures.map(({id})=>id)),new Set(COUNTRY_IDS));
 for(const fixture of fixtures){
  values.clear();
  const slot=slotFor(fixture);
  const raw=rootFor(fixture.id,slot);
  values.set('one-planet-food-crisis-v4',raw);

  const loaded=loadGame(fixture.id);

  assert.equal(loaded.status,'restored',`${fixture.id}:${fixture.path}`);
  assert.equal(loaded.state.foreignStrategyStartTurn,fixture.commands.length+1,`${fixture.id}:${fixture.path}`);
  assert.deepEqual(withoutMarker(loaded.state),fixture.state,`${fixture.id}:${fixture.path}`);
  assert.equal(sha256(withoutMarker(loaded.state)),fixture.hash,`${fixture.id}:${fixture.path}`);
  assert.equal(values.get('one-planet-food-crisis-v4'),raw,`${fixture.id}:${fixture.path}`);
 }
});

test('saved strategy markers validate against the replay boundary',()=>{
 const fixture=fixtures[0],slot=slotFor(fixture);
 for(const foreignStrategyStartTurn of [0,-1,1.5,'1',fixture.commands.length+2]){
  values.clear();
  values.set('one-planet-food-crisis-v4',rootFor(fixture.id,{...slot,foreignStrategyStartTurn}));
  assert.equal(loadGame(fixture.id).status,'invalid',String(foreignStrategyStartTurn));
 }
});

test('six independent slots persist their exact marker and chronicle the first new quarter coherently',()=>{
 values.clear();
 const campaigns=new Map();
 for(const [index,playerId] of COUNTRY_IDS.entries()){
  const foreignStrategyStartTurn=index+1;
  let state=createGame(playerId,{foreignStrategyStartTurn});
  for(let turn=0;turn<6;turn++)state=advanceTurn(state,'maintain');
  assert.equal(saveGame(state,{phase:'result',step:0}),true);
  campaigns.set(playerId,state);
 }

 for(const [playerId,expected] of campaigns){
  const loaded=loadGame(playerId);
  assert.equal(loaded.status,'restored');
  assert.deepEqual(loaded.state,expected);
  assert.equal(loaded.state.foreignStrategyStartTurn,expected.foreignStrategyStartTurn);
  const chronicle=buildChronicle(loaded.state),last=chronicle.points.at(-1);
  assert.equal(chronicle.totalTurns,loaded.state.turn);
  assert.deepEqual(last.metrics,Object.fromEntries(['food','treasury','price','trust','approval'].map(metric=>[metric,loaded.state.countries[playerId][metric]])));
  assert.deepEqual(last.relations,Object.fromEntries(COUNTRY_IDS.filter(id=>id!==playerId).map(id=>[id,loaded.state.relations[[id,playerId].sort().join(':')]])));
 }
 const root=JSON.parse(values.get('one-planet-food-crisis-v4'));
 for(const [playerId,state] of campaigns)assert.equal(root.games[playerId].foreignStrategyStartTurn,state.foreignStrategyStartTurn);
});

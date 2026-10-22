import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,PROFILES,createGame,getPolicies,getAction,advanceTurn} from '../dist/engine.mjs';

const exclusives={lumen:['balanced','embargo','reopen','aid'],nord:['secure_imports','strategic_reserve'],cera:['export_push','embargo','reopen'],altia:['research','license'],marin:['expand_routes','emergency_import'],solis:['ration','resilience']};

test('all six countries start with their own identity profile and foreign opening request',()=>{
 for(const id of COUNTRY_IDS){
  const state=createGame(id);assert.equal(state.playerId,id);assert.equal(state.version,13);assert.notEqual(state.requests[0].fromId,id);
  for(const field of ['tagline','challenge','difficulty','facilityName','investmentCost','policyLabel','openingTitle','openingDescription'])assert.ok(PROFILES[id][field]);
  const ids=getPolicies(state).map(policy=>policy.id);for(const actionId of [...exclusives[id],'subsidy','invest','maintain'])assert.ok(ids.includes(actionId));
 }
 assert.throws(()=>createGame('missing'),/국가/);
});

test('country-exclusive choices cannot be used while governing another country',()=>{
 for(const id of COUNTRY_IDS){const state=createGame(id);for(const [other,actions] of Object.entries(exclusives))if(other!==id)for(const actionId of actions.filter(actionId=>!['embargo','reopen'].includes(actionId)))assert.equal(getAction(state,actionId),null);}
 assert.equal(getAction(createGame('nord'),'embargo'),null);assert.equal(getAction(createGame('cera'),'secure_imports'),null);assert.equal(getAction(createGame('altia'),null),null);
});

test('each nation replays deterministically for 120 quarters with exact player food accounting',()=>{
 for(const id of COUNTRY_IDS){
  const initial=createGame(id),before=JSON.stringify(initial);let state=initial;
  for(let turn=0;turn<120;turn++){
   const next=advanceTurn(state,'maintain'),record=next.history.at(-1),playerBefore=state.countries[id].food;
   assert.equal(record.foodBreakdown.reduce((sum,item)=>sum+item.value,0),next.countries[id].food-playerBefore);
   assert.ok(record.worldActions.every(action=>action.countryId!==id||action.source!=='autonomous'));
   assert.ok(next.requests.every(request=>request.fromId!==id));state=next;
  }
  assert.equal(JSON.stringify(initial),before);let replay=createGame(id);for(const command of state.commands)replay=advanceTurn(replay,command);assert.deepEqual(replay,state);
 }
});

test('national choices transfer real resources and change the governed country',()=>{
 const nord=createGame('nord',{worldGoalStartTurn:999}),nordBase=advanceTurn(nord,'maintain'),nordImport=advanceTurn(nord,'secure_imports');
 assert.ok(nordImport.countries.nord.food>nordBase.countries.nord.food);assert.ok(nordImport.countries.cera.food<nordBase.countries.cera.food);assert.ok(nordImport.history.at(-1).worldActions.some(action=>action.source==='policy'&&action.targetId==='nord'));
 const marin=createGame('marin',{worldGoalStartTurn:999}),marinBase=advanceTurn(marin,'maintain'),marinImport=advanceTurn(marin,'emergency_import');
 assert.ok(marinImport.countries.marin.food>marinBase.countries.marin.food);assert.ok(marinImport.countries.cera.food<marinBase.countries.cera.food);
 const cera=createGame('cera',{worldGoalStartTurn:999}),open=advanceTurn(cera,'reopen'),closed=advanceTurn(cera,'embargo');
 assert.ok(closed.countries.cera.food>open.countries.cera.food);assert.ok(closed.countries.nord.food<open.countries.nord.food);assert.ok(closed.countries.cera.trust<open.countries.cera.trust);
});

test('facility investment uses the selected nation profile and locks while building',()=>{
 for(const id of COUNTRY_IDS){const state=createGame(id),action=getAction(state,'invest');assert.equal(action.cost,PROFILES[id].investmentCost);const building=advanceTurn(state,'invest');assert.equal(getAction(building,'invest'),null);const complete=advanceTurn(advanceTurn(building,'maintain'),'maintain');assert.equal(complete.farmLevel,1);}
});

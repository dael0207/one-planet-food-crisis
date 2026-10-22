import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,createGame,getAction,advanceTurn} from '../dist/engine.mjs';
import {getRelation,previewProposal,proposalCommand,pendingCounters} from '../dist/negotiations.mjs';

const draft=(targetId,kind,food=4,money=8)=>({targetId,kind,food,money});

test('all six players receive symmetric bilateral relations separate from global trust',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=createGame(playerId);
  for(const targetId of COUNTRY_IDS.filter(id=>id!==playerId)){
   assert.equal(getRelation(state,playerId,targetId),getRelation(state,targetId,playerId));
   assert.notEqual(getRelation(state,playerId,targetId),state.countries[targetId].trust);
  }
 }
});

test('relationship and partner conditions change the same proposal response',()=>{
 const state=createGame('lumen'),offer=draft('cera','buy',6,10);
 state.relations['cera:lumen']=25;
 const cold=previewProposal(state,offer);
 state.relations['cera:lumen']=85;
 const warm=previewProposal(state,offer);
 state.countries.cera.food=24;
 const scarce=previewProposal(state,offer);
 assert.ok(warm.score>cold.score);
 assert.notEqual(warm.response,cold.response);
 assert.ok(scarce.score<warm.score);
 assert.ok(warm.reasons.length>=2);
});

test('accepted spot transactions conserve resources for every player and proposal kind',()=>{
 for(const playerId of COUNTRY_IDS){
  for(const kind of ['buy','sell','aid_out','aid_in']){
   const state=createGame(playerId,{worldGoalStartTurn:999}),targetId=COUNTRY_IDS.find(id=>id!==playerId);
   state.relations[[playerId,targetId].sort().join(':')]=100;
   state.countries[playerId].food=80;state.countries[playerId].treasury=80;
   state.countries[targetId].food=80;state.countries[targetId].treasury=80;
   const food=kind==='aid_out'?6:3,money=kind.startsWith('aid')?0:6,command=proposalCommand(draft(targetId,kind,food,money));
   assert.equal(previewProposal(state,draft(targetId,kind,food,money)).response,'accept');
   const baseline=advanceTurn(state,'maintain'),next=advanceTurn(state,command),record=next.negotiations.at(-1),action=next.history.at(-1).worldActions.find(item=>item.source==='negotiation'&&['trade','aid'].includes(item.type));
   assert.equal(record.status,'accepted');
   assert.equal(record.settlement.foodDelta,kind==='sell'||kind==='aid_out'?-food:food);
   assert.equal(next.countries[playerId].food-baseline.countries[playerId].food,record.settlement.foodDelta);
   assert.equal(next.countries[targetId].food-baseline.countries[targetId].food,-record.settlement.foodDelta);
   assert.equal(record.settlement.moneyDelta,kind==='buy'?-money:kind==='sell'?money:kind==='aid_out'?-money:money);
   assert.ok(action);
   assert.equal(action.source,'negotiation');
   assert.equal(next.countries[playerId].treasury-baseline.countries[playerId].treasury,record.settlement.moneyDelta||0);
   assert.equal(next.countries[targetId].treasury-baseline.countries[targetId].treasury,-record.settlement.moneyDelta||0);
  }
 }
});

test('counteroffer is explicit, spends nothing, and accepting it transfers once',()=>{
 const state=createGame('lumen');state.relations['lumen:solis']=50;state.countries.lumen.food=30;state.countries.solis.food=80;
 const command=proposalCommand(draft('solis','aid_in',10,0)),preview=previewProposal(state,draft('solis','aid_in',10,0));
 assert.equal(preview.response,'counter');
 const countered=advanceTurn(state,command),record=countered.negotiations.at(-1);
 assert.equal(record.status,'countered');
 assert.equal(record.settlement,undefined);
 assert.deepEqual(countered.history.at(-1).foodBreakdown.filter(item=>item.label.includes('협상')),[]);
 assert.equal(pendingCounters(countered).length,1);
 const accepted=advanceTurn(countered,`reply:${record.id}:accept`),resolved=accepted.negotiations.find(item=>item.id===record.id);
 assert.equal(resolved.status,'accepted');
 assert.equal(resolved.settlement.terms.food,record.counterTerms.food);
 assert.equal(resolved.relationAfter-resolved.replyRelationBefore,3);
 assert.equal(accepted.commands.filter(item=>item===`reply:${record.id}:accept`).length,1);
});

test('declined and expired counters never transfer resources',()=>{
 const start=createGame('lumen');start.relations['lumen:solis']=50;start.countries.lumen.food=25;start.countries.solis.food=80;
 const countered=advanceTurn(start,proposalCommand(draft('solis','aid_in',10,0))),record=countered.negotiations.at(-1);
 const declined=advanceTurn(countered,`reply:${record.id}:decline`);
 assert.equal(declined.negotiations.find(item=>item.id===record.id).status,'declined');
 assert.equal(declined.negotiations.find(item=>item.id===record.id).settlement,undefined);
 let expired=countered;for(let index=0;index<3;index++)expired=advanceTurn(expired,'maintain');
 assert.equal(expired.negotiations.find(item=>item.id===record.id).status,'expired');
 assert.equal(getAction(expired,`reply:${record.id}:accept`),null);
});

test('malformed self-targeted and unaffordable proposals do not advance time',()=>{
 const state=createGame('lumen');state.countries.lumen.treasury=2;
 for(const command of ['propose:lumen:buy:2:2','propose:cera:buy:0:2','propose:cera:buy:2:0','propose:cera:wrong:2:2','propose:cera:buy:2:9']){
  assert.equal(getAction(state,command),null);
  assert.throws(()=>advanceTurn(state,command));
  assert.equal(state.turn,0);
 }
});

test('proposal and counter replies replay deterministically from command records',()=>{
 const initial=createGame('lumen');initial.relations['lumen:solis']=50;initial.countries.lumen.food=25;initial.countries.solis.food=80;
 const countered=advanceTurn(initial,proposalCommand(draft('solis','aid_in',10,0))),id=countered.negotiations.at(-1).id;
 const state=advanceTurn(countered,`reply:${id}:accept`);
 let replay=createGame('lumen');replay.relations['lumen:solis']=50;replay.countries.lumen.food=25;replay.countries.solis.food=80;
 for(const command of state.commands)replay=advanceTurn(replay,command);
 assert.deepEqual(replay,state);
});

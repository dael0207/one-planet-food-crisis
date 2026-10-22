import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,getAction,COUNTRY_IDS} from '../dist/engine.mjs';
import {activeConflicts,applyConflictChoice,conflictAction,conflictChoicePreview,tradeBlocked} from '../dist/goal-conflicts.mjs';
import {previewTreaty} from '../dist/treaties.mjs';
import {previewProposal} from '../dist/negotiations.mjs';
import {getScenario} from '../dist/scenarios.mjs';

function formed(playerId='lumen'){
 let state=createGame(playerId);while(!activeConflicts(state).length&&state.turn<12)state=advanceTurn(state,'maintain');
 assert.equal(activeConflicts(state).length,1);return state;
}

test('trade sanctions cannot be bought off by extreme treaty terms and preserve aid exemption',()=>{
 for(const playerId of COUNTRY_IDS){let state=formed(playerId),c=activeConflicts(state)[0];state=advanceTurn(state,`stance:${c.id}:response`);
  state.relations[[state.playerId,c.initiatorId].sort().join(':')]=100;state.reliability[state.playerId]=100;state.countries[c.initiatorId].food=100;
  for(const kind of ['trade_buy','trade_sell'])for(const food of [1,8])for(const money of [1,20]){
   const draft={targetId:c.initiatorId,kind,food,money,duration:4},preview=previewTreaty(state,draft);
   assert.equal(preview.response,'reject');assert.equal(preview.score,0);
   assert.equal(advanceTurn(state,preview.command).treaties.at(-1).status,'rejected');
  }
  assert.ok(!previewTreaty(state,{targetId:c.initiatorId,kind:'alliance',food:1,money:0,duration:4}).reasons.some(reason=>reason.includes('거래가 중단')));
 }
});

test('stance preview states actual clamped one-time relations and explicit recurring limits',()=>{
 const state=formed(),c=activeConflicts(state)[0];
 state.relations[[state.playerId,c.initiatorId].sort().join(':')]=99;state.relations[[state.playerId,c.targetId].sort().join(':')]=3;
 const action=conflictAction(state,`stance:${c.id}:sanction`),next=structuredClone(state);next.turn++;
 assert.deepEqual(action.relationChanges.map(item=>item.delta),[1,-3]);assert.match(action.description,/선언 즉시/);assert.match(action.forecast,/식량 최대 1 구매, 대금 최대 1 지급/);
 applyConflictChoice(next,action);for(const change of action.relationChanges){const key=[state.playerId,change.countryId].sort().join(':');assert.equal(next.relations[key]-state.relations[key],change.delta);}
 assert.equal(next.goalConflicts[0].commitment.recurringText,action.recurringText);
});

test('the last restriction execution is followed by an unrestricted proposal and treaty decision',()=>{
 let state=formed(),c=activeConflicts(state)[0];state=advanceTurn(state,`stance:${c.id}:response`);
 while(state.turn<c.endTurn-1)state=advanceTurn(state,'maintain');
 assert.equal(tradeBlocked(state,state.playerId,c.initiatorId),true);
 const input={targetId:c.initiatorId,kind:'buy',food:1,money:3},proposal=previewProposal(state,input);
 assert.ok(!proposal.reasons.some(reason=>reason.includes('거래가 중단')));
 const treaty=previewTreaty(state,{...input,kind:'trade_buy',duration:4});assert.ok(!treaty.reasons.some(reason=>reason.includes('거래가 중단')));
 const next=advanceTurn(state,'propose:'+c.initiatorId+':buy:1:3');assert.equal(tradeBlocked(next,next.playerId,c.initiatorId),false);assert.equal(next.negotiations.at(-1).status,{accept:'accepted',counter:'countered',reject:'rejected'}[proposal.response]);
});

test('a sanctioned inbound trade offer remains readable and can be deferred or declined',()=>{
 let state=formed(),c=activeConflicts(state)[0];state=advanceTurn(state,`stance:${c.id}:sanction`);
 state.requests.push({id:'blocked-supply',fromId:c.targetId,type:'trade',status:'pending',expiresTurn:state.turn+3,terms:{food:3,treasury:12,duration:4}});
 const scenario=getScenario(state,'blocked-supply');assert.match(scenario.title,/제재/);assert.equal(scenario.options.length,2);assert.ok(scenario.options.every(option=>getAction(state,option.id)));
 assert.equal(conflictChoicePreview(state,c.id,'neutral'),null);
});

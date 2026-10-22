import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction} from '../dist/engine.mjs';
import {mediationCommand,previewMediation,reliefActive} from '../dist/mediation.mjs';
import {tradeBlocked} from '../dist/goal-conflicts.mjs';

const conflict=(overrides={})=>({id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:8,duration:6,playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌',...overrides});
const stateWithConflict=(overrides={})=>{const state=createGame('nord');state.turn=2;state.goalConflicts=[conflict(overrides)];state.conflictCooldownUntil=10;return state;};

test('last-quarter relief promises only its one remaining execution',()=>{
 const state=stateWithConflict({endTurn:4});
 const draft={conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12};
 const preview=previewMediation(state,draft),next=advanceTurn(state,mediationCommand(draft));
 assert.equal(preview.reliefQuarters,1);
 assert.match(preview.description,/1분기 제재 완화/);
 assert.equal(next.goalConflicts[0].ceasefireUntil-next.turn,1);
});

test('a stance during relief forecasts paused executions and its actual resumption',()=>{
 const state=stateWithConflict();state.relations['cera:nord']=80;state.relations['lumen:nord']=80;
 const draft={conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12};
 const paused=advanceTurn(state,mediationCommand(draft)),id=paused.goalConflicts[0].id;
 const action=getAction(paused,`stance:${id}:response`),chosen=advanceTurn(paused,action.id);
 assert.equal(action.conflictPreview.pausedQuarters,1);
 assert.equal(action.conflictPreview.activeQuarters,3);
 assert.equal(action.conflictPreview.resumesTurn,5);
 assert.equal(tradeBlocked(chosen,'nord','cera'),false);
 assert.equal(chosen.history.at(-1).worldActions.some(item=>item.type==='conflict_support'),false);
 const resumed=advanceTurn(chosen,'maintain');
 assert.equal(tradeBlocked(resumed,'nord','cera'),true);
 assert.ok(resumed.history.at(-1).worldActions.some(item=>item.type==='conflict_support'));
 assert.ok(resumed.lastConflictEvents.some(item=>item.type==='ceasefire_ended'));
});

test('a stance under relief lasting until dispute end never promises a later restriction',()=>{
 const state=stateWithConflict({endTurn:5});state.relations['cera:nord']=80;state.relations['lumen:nord']=80;
 const paused=advanceTurn(state,mediationCommand({conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12}));
 const action=getAction(paused,`stance:${paused.goalConflicts[0].id}:sanction`);
 assert.equal(action.conflictPreview.pausedQuarters,1);assert.equal(action.conflictPreview.activeQuarters,0);
 assert.doesNotMatch(action.description,/교역 중단/);assert.doesNotMatch(action.forecast,/0분기 동안/);
 const last=advanceTurn(paused,action.id),ended=advanceTurn(last,'maintain');
 assert.equal(tradeBlocked(last,'nord','lumen'),false);assert.equal(tradeBlocked(ended,'nord','lumen'),false);
 assert.equal(ended.lastConflictEvents.some(item=>item.type==='ceasefire_ended'),false);
});

test('balanced relief is accepted and pauses the real trade ban for two execution quarters',()=>{
 const state=stateWithConflict(),draft={conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12};
 const preview=previewMediation(state,draft),next=advanceTurn(state,mediationCommand(draft)),item=next.goalConflicts[0];
 assert.equal(preview.outcome,'accepted');
 assert.equal(reliefActive(next,item),true);
 assert.equal(tradeBlocked(next,'cera','lumen'),false);
 assert.equal(item.ceasefireUntil-item.ceasefireStartTurn,2);
 assert.equal(next.mediations.at(-1).status,'accepted');
});

test('accepted peace resolves the conflict before its natural expiry and transfers only reviewed costs',()=>{
 const state=stateWithConflict();state.relations['cera:nord']=78;state.relations['lumen:nord']=78;
 const draft={conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:8,money:12},action=getAction(state,mediationCommand(draft));
 const baseline=advanceTurn(structuredClone(state),'maintain'),next=advanceTurn(state,action.id),record=next.mediations.at(-1);
 assert.equal(record.status,'accepted');
 assert.equal(next.goalConflicts[0].status,'resolved');
 assert.equal(next.countries.nord.food,baseline.countries.nord.food-action.foodCost);
 assert.equal(next.countries.nord.treasury,baseline.countries.nord.treasury-action.cost);
 assert.equal(record.costs.food,action.foodCost);
 assert.equal(record.costs.money,action.cost);
 assert.equal(tradeBlocked(next,'cera','lumen'),false);
});

test('marginal terms create an explicit counter that costs nothing until later acceptance',()=>{
 const state=stateWithConflict(),draft={conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:4,money:6};
 const before=structuredClone(state),offered=advanceTurn(state,mediationCommand(draft)),record=offered.mediations.at(-1);
 assert.equal(record.status,'countered');
 assert.equal(offered.countries.nord.food-advanceTurn(before,'maintain').countries.nord.food,0);
 assert.equal(offered.countries.nord.treasury-advanceTurn(before,'maintain').countries.nord.treasury,0);
 const accept=getAction(offered,`mediate-accept:${record.id}`);assert.ok(accept);
 const settled=advanceTurn(offered,accept.id);
 assert.equal(settled.mediations.find(item=>item.id===record.id).status,'accepted');
 assert.equal(settled.goalConflicts[0].status,'resolved');
});

test('a coercive empty offer escalates once and extends sanctions by at most two quarters',()=>{
 let state=stateWithConflict(),draft={conflictId:state.goalConflicts[0].id,goal:'peace',condition:'target',food:0,money:0};
 state=advanceTurn(state,mediationCommand(draft));
 assert.equal(state.mediations.at(-1).status,'escalated');
 assert.equal(state.goalConflicts[0].endTurn,10);
 const nextDraft={...draft,conflictId:state.goalConflicts[0].id};state=advanceTurn(state,mediationCommand(nextDraft));
 assert.equal(state.goalConflicts[0].endTurn,10);
 assert.equal(state.goalConflicts[0].extraQuarters,2);
});

test('invalid mediation commands and duplicate same-quarter offers are rejected',()=>{
 const state=stateWithConflict(),draft={conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12};
 assert.equal(getAction(state,'mediate:bad:peace:mutual:8:12'),null);
 state.mediationOfferTurnByConflict={[draft.conflictId]:state.turn+1};
 assert.equal(getAction(state,mediationCommand(draft)),null);
});

test('relief pauses coalition support and trade restrictions, then both resume at the exact boundary',()=>{
 const state=stateWithConflict({sanctionMembers:['cera','altia'],responseMembers:['lumen','solis']}),draft={conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12};
 let next=advanceTurn(state,mediationCommand(draft));
 assert.equal(next.history.at(-1).worldActions.some(action=>action.type==='conflict_support'),false);
 next=advanceTurn(next,'maintain');
 assert.equal(next.history.at(-1).worldActions.some(action=>action.type==='conflict_support'),false);
 next=advanceTurn(next,'maintain');
 assert.equal(tradeBlocked(next,'cera','lumen'),true);
 assert.equal(next.history.at(-1).worldActions.some(action=>action.type==='conflict_support'),true);
});

test('accepted aid is split equally, capped per recipient, and conserved',()=>{
 const state=stateWithConflict();state.countries.cera.food=99;state.countries.lumen.food=100;
 const draft={conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12},preview=previewMediation(state,draft);
 assert.equal(preview.costs.food,1);
 assert.deepEqual(preview.costs.foodShares.map(item=>item.amount),[1,0]);
 const beforeTotal=Object.values(state.countries).reduce((sum,country)=>sum+country.food,0),next=advanceTurn(state,mediationCommand(draft)),afterTotal=Object.values(next.countries).reduce((sum,country)=>sum+country.food,0);
 const baseline=advanceTurn(structuredClone(state),'maintain'),weatherDelta=Object.values(baseline.countries).reduce((sum,country)=>sum+country.food,0)-beforeTotal;
 assert.equal(afterTotal-beforeTotal,weatherDelta);
 assert.deepEqual(next.lastMediationEvents[0].transfers.foodShares.map(item=>item.amount),[1,0]);
});

test('an unanswered counter expires before its second execution boundary without charging resources',()=>{
 const state=stateWithConflict(),draft={conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:4,money:6};
 let next=advanceTurn(state,mediationCommand(draft)),record=next.mediations.at(-1);assert.equal(record.status,'countered');
 next=advanceTurn(next,'maintain');record=next.mediations.find(item=>item.id===record.id);
 assert.equal(record.status,'expired');
 assert.equal(getAction(next,`mediate-accept:${record.id}`),null);
 assert.ok(next.lastMediationEvents.some(event=>event.type==='mediation_expired'));
});

test('a counter is re-evaluated and charges nothing when relations collapse before acceptance',()=>{
 const state=stateWithConflict(),draft={conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:4,money:6};
 const offered=advanceTurn(state,mediationCommand(draft)),record=offered.mediations.at(-1);
 offered.relations['cera:nord']=5;offered.relations['lumen:nord']=5;
 const action=getAction(offered,`mediate-accept:${record.id}`);assert.ok(action);assert.equal(action.mediationPreview.outcome,'rejected');assert.equal(action.cost,0);assert.equal(action.foodCost,0);
 const baseline=advanceTurn(structuredClone(offered),'maintain'),next=advanceTurn(offered,action.id);
 assert.equal(next.countries.nord.food,baseline.countries.nord.food);
 assert.equal(next.countries.nord.treasury,baseline.countries.nord.treasury);
 assert.equal(next.mediations.find(item=>item.id===record.id).status,'rejected');
});

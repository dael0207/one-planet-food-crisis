import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,getAction} from '../dist/engine.mjs';
import {activeConflicts,conflictChoicePreview,tradeBlocked} from '../dist/goal-conflicts.mjs';
import {previewProposal} from '../dist/negotiations.mjs';

const sum=(state,key)=>Object.values(state.countries).reduce((total,country)=>total+country[key],0);
const conflict=(overrides={})=>({
 id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',
 sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:6,duration:4,
 playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌',...overrides,
});
const atConflict=(playerId='nord',overrides={})=>{
 const state=createGame(playerId);state.turn=1;state.goalConflicts=[conflict(overrides)];state.conflictCooldownUntil=10;return state;
};
const reachConflict=(playerId='nord')=>Array(3).fill('maintain').reduce(state=>advanceTurn(state,'maintain'),createGame(playerId));

test('goal rivalry autonomously creates one four-quarter sanctions conflict',()=>{
 const next=reachConflict('nord'),item=next.goalConflicts[0];
 assert.equal(item.type,'trade_sanctions');
 assert.equal(item.status,'active');
 assert.equal(item.startTurn,item.formedTurn+1);
 assert.equal(item.endTurn-item.startTurn,4);
 assert.ok(item.sanctionMembers.includes(item.initiatorId));
 assert.ok(item.responseMembers.includes(item.targetId));
 assert.equal(activeConflicts(next).length,1);
 assert.ok(next.history.at(-1).worldActions.some(action=>action.source==='goal_conflict'&&action.type==='conflict'));
});

test('player remains outside both blocs until choosing a stance',()=>{
 const formed=reachConflict('lumen'),item=formed.goalConflicts[0];
 assert.equal(item.playerStance,null);
 assert.equal(tradeBlocked({...formed,turn:item.startTurn},formed.playerId,item.initiatorId),false);
 assert.equal(tradeBlocked({...formed,turn:item.startTurn},formed.playerId,item.targetId),false);
});

test('sanctions stance applies its reviewed relations and persists trade restrictions',()=>{
 const state=atConflict(),preview=conflictChoicePreview(state,state.goalConflicts[0].id,'sanction');
 const next=advanceTurn(state,`stance:${state.goalConflicts[0].id}:sanction`),item=next.goalConflicts[0];
 assert.equal(item.playerStance,'sanction');
 assert.equal(item.stanceTurn,next.turn);
 for(const change of preview.relationChanges){
  const key=[state.playerId,change.countryId].sort().join(':');
  assert.equal(next.relations[key]-state.relations[key],change.delta);
 }
 assert.equal(tradeBlocked(next,state.playerId,item.targetId),true);
 assert.match(next.history.at(-1).worldActions.find(action=>action.type==='conflict_choice').text,/여파가 이어집니다/);
});

test('joint response transfers declared food and payment without creating resources',()=>{
 const state=atConflict(),baseline=advanceTurn(state,'maintain');
 const next=advanceTurn(state,`stance:${state.goalConflicts[0].id}:response`);
 const support=next.history.at(-1).worldActions.find(action=>action.source==='goal_conflict'&&action.type==='conflict_support'&&action.countryId===state.playerId);
 assert.ok(support.food>=1&&support.food<=2);
 assert.equal(support.money,1);
 assert.equal(next.countries.nord.food,baseline.countries.nord.food-support.food);
 assert.equal(next.countries.nord.treasury,baseline.countries.nord.treasury+support.money);
 assert.equal(next.countries.lumen.food,baseline.countries.lumen.food+support.food);
 assert.equal(next.countries.lumen.treasury,baseline.countries.lumen.treasury-support.money);
 assert.equal(sum(next,'food'),sum(baseline,'food'));
 assert.equal(sum(next,'treasury'),sum(baseline,'treasury'));
});

test('neutral stance leaves player trade open while both relations carry the reviewed cost',()=>{
 const state=atConflict(),preview=conflictChoicePreview(state,state.goalConflicts[0].id,'neutral');
 const next=advanceTurn(state,`stance:${state.goalConflicts[0].id}:neutral`),item=next.goalConflicts[0];
 assert.equal(item.playerStance,'neutral');
 assert.equal(tradeBlocked(next,state.playerId,item.initiatorId),false);
 assert.equal(tradeBlocked(next,state.playerId,item.targetId),false);
 assert.deepEqual(preview.relationChanges.map(change=>change.delta),[-2,-2]);
 assert.ok(!next.history.at(-1).worldActions.some(action=>action.type==='conflict_support'&&[action.countryId,action.targetId].includes(state.playerId)));
});

test('response restrictions change proposal outcome and execution matches its preview',()=>{
 let state=atConflict();state=advanceTurn(state,`stance:${state.goalConflicts[0].id}:response`);
 const draft={targetId:'cera',kind:'buy',food:2,money:6},preview=previewProposal(state,draft),before=structuredClone(state);
 const action=getAction(state,'propose:cera:buy:2:6');
 assert.equal(preview.response,'reject');
 assert.equal(action.preview.response,preview.response);
 const next=advanceTurn(state,action.id),record=next.negotiations.at(-1);
 assert.equal(record.status,'rejected');
 assert.deepEqual(record.reasons,preview.reasons);
 assert.equal(next.countries.nord.food-advanceTurn(before,'maintain').countries.nord.food,0);
});

test('sanctions suspend a blocked foreign treaty without breach or reliability loss',()=>{
 const state=atConflict('nord');state.foreignTreaties=[{id:'foreign-cera-lumen-1-trade_sell',playerId:'cera',targetId:'lumen',kind:'trade_sell',food:3,money:5,duration:4,status:'active',startTurn:2,endTurn:6,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]}];
 const reliability=structuredClone(state.reliability),next=advanceTurn(state,'maintain'),treaty=next.foreignTreaties.find(item=>item.id===state.foreignTreaties[0].id);
 assert.equal(treaty.lastOutcome.type,'suspended');
 assert.equal(treaty.breaches,0);
 assert.equal(treaty.streak,0);
 assert.deepEqual(next.reliability,reliability);
 assert.ok(next.lastForeignEvents.some(event=>event.type==='suspended'));
});

test('conflict effects last four executed quarters and then expire with cooldown intact',()=>{
 let state=atConflict();const id=state.goalConflicts[0].id;
 state=advanceTurn(state,`stance:${id}:response`);
 for(let turn=0;turn<4;turn++)state=advanceTurn(state,'maintain');
 const item=state.goalConflicts.find(entry=>entry.id===id);
 assert.equal(state.turn,6);
 assert.equal(item.status,'completed');
 assert.equal(item.resolvedTurn,6);
 assert.equal(tradeBlocked(state,'nord','cera'),false);
 assert.equal(state.conflictCooldownUntil,10);
 assert.equal(state.goalConflicts.filter(entry=>entry.status==='active').length,0);
 assert.ok(state.history.at(-1).worldActions.some(action=>action.source==='goal_conflict'&&action.type==='expiry'));
});

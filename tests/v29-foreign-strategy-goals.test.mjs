import test from 'node:test';
import assert from 'node:assert/strict';

import {initialCountries} from '../dist/country-data.mjs';
import {createForeignGoals,runForeignGoalPolicies} from '../dist/foreign-goals.mjs';
import {advanceTurn,createGame} from '../dist/engine.mjs';

const state=()=>({playerId:'lumen',turn:2,worldGoalStartTurn:1,countries:initialCountries(),foreignGoals:createForeignGoals('lumen'),foreignStrategies:{},relations:{},lastTreatyEvents:[],lastForeignEvents:[]});

test('active fiscal strategy takes priority through an existing real austerity action',()=>{
 const before=state();before.foreignStrategies.nord={mode:'fiscal'};before.countries.nord.treasury=40;const next=structuredClone(before),actions=[];
 runForeignGoalPolicies(next,before,[],actions);
 const action=actions.find(item=>item.actorId==='nord');assert.equal(action.type,'austerity');assert.equal(next.countries.nord.treasury,43);assert.equal(next.foreignGoals.nord.lastAction.id,'austerity');
});

test('completed goals stay active under strategy without double-applying a policy',()=>{
 const before=state(),actor=before.foreignGoals.altia;for(const id of Object.keys(before.foreignGoals))before.foreignStrategies[id]={mode:'fiscal'};actor.objectives.completed=[{stage:1,turn:1},{stage:2,turn:1},{stage:3,turn:1}];before.foreignStrategies.altia={mode:'development'};before.countries.altia.infrastructure=0;const next=structuredClone(before),actions=[];
 runForeignGoalPolicies(next,before,[],actions);
 assert.equal(next.countries.altia.infrastructure,1);assert.equal(next.countries.altia.treasury,before.countries.altia.treasury-12);assert.equal(actions.filter(item=>item.actorId==='altia').length,1);assert.equal(next.foreignGoals.altia.lastAction.id,'invest');
});

test('active strategy uses bilateral relations to select a real emergency supplier',()=>{
 const before=state();for(const id of Object.keys(before.foreignGoals))before.foreignStrategies[id]={mode:'fiscal'};before.foreignStrategies.nord={mode:'food'};before.countries.nord.food=40;before.countries.nord.treasury=50;before.countries.cera.food=80;before.countries.altia.food=80;before.relations['cera:nord']=35;before.relations['altia:nord']=90;const next=structuredClone(before),actions=[];
 runForeignGoalPolicies(next,before,[],actions);
 const trade=actions.find(item=>item.actorId==='nord'&&item.type==='trade');assert.equal(trade.countryId,'altia');assert.equal(trade.targetId,'nord');assert.equal(next.countries.altia.food,before.countries.altia.food-trade.food);
});

test('Cera does not repeat an unchanged export on consecutive active opening quarters',()=>{
 let current=state();current.playerId='lumen';current.foreignStrategies.cera={mode:'trade'};current.countries.cera.food=90;
 const first=structuredClone(current),firstActions=[];first.turn=3;runForeignGoalPolicies(first,current,[],firstActions);assert.equal(first.foreignGoals.cera.lastAction.id,'export_push');
 const second=structuredClone(first),secondActions=[];second.turn=4;runForeignGoalPolicies(second,first,[],secondActions);assert.notEqual(second.foreignGoals.cera.lastAction.id,'export_push');assert.ok(secondActions.some(item=>item.actorId==='cera'));
});

test('Cera completed goals alternate exports with a real fallback action',()=>{
 const before=state(),actor=before.foreignGoals.cera;actor.objectives.completed=[{stage:1,turn:1},{stage:2,turn:1},{stage:3,turn:1}];before.foreignStrategies.cera={mode:'trade'};before.countries.cera.food=90;
 const first=structuredClone(before),firstActions=[];first.turn=3;runForeignGoalPolicies(first,before,[],firstActions);assert.equal(first.foreignGoals.cera.lastAction.id,'export_push');
 const second=structuredClone(first),secondActions=[];second.turn=4;runForeignGoalPolicies(second,first,[],secondActions);assert.notEqual(second.foreignGoals.cera.lastAction.id,'export_push');assert.ok(secondActions.some(item=>item.actorId==='cera'));
});

test('canonical forty-quarter Cera history never repeats exports in adjacent quarters',()=>{
 let current=createGame('lumen');for(let turn=0;turn<40;turn++)current=advanceTurn(current,'maintain');
 const actions=current.history.map(record=>record.worldActions.find(item=>item.source==='national_goal'&&item.actorId==='cera')).filter(Boolean),lastEight=actions.slice(-8);assert.ok(lastEight.some(item=>item.type!=='trade'));
 for(let index=1;index<actions.length;index++)assert.ok(actions[index-1].type!=='trade'||actions[index].type!=='trade');
});

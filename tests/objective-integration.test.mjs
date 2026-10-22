import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,getAction} from '../dist/engine.mjs';
import {getDomesticOrders,getScenario} from '../dist/scenarios.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';

test('objective actions are country and achievement gated at the engine boundary',()=>{
 const start=createGame('lumen');
 const before=JSON.stringify(start);
 assert.equal(getAction(start,'mandate_lumen_1'),null);
 assert.equal(getAction(start,'mandate_nord_1'),null);
 assert.throws(()=>advanceTurn(start,'mandate_lumen_1'));
 assert.equal(JSON.stringify(start),before);
});

test('real Lumen development unlocks a usable policy and records exact cost and food accounting',()=>{
 let state=createGame('lumen');
 for(const command of ['balanced','invest','maintain','maintain'])state=advanceTurn(state,command);
 assert.equal(state.objectives.completed.length,1);
 assert.equal(state.history.at(-1).objectiveAchievements[0].stage,1);
 assert.ok(getDomesticOrders(state).some(order=>order.id==='mandate_lumen_1'));
 const action=getAction(state,'mandate_lumen_1');assert.ok(action);
 const next=advanceTurn(state,action.id),record=next.history.at(-1);
 assert.equal(next.turn,state.turn+1);assert.equal(record.actionCost,action.cost);
 assert.equal(record.foodBreakdown.reduce((n,part)=>n+part.value,0),next.countries.lumen.food-state.countries.lumen.food);
 assert.ok(record.foodBreakdown.some(part=>part.label.includes(action.name)));
 assert.equal(getAction(next,'mandate_cera_1'),null);
});

test('activation preserves old quarters and chronicle reconstructs objective commands beyond history cap',()=>{
 let state=createGame('lumen',{objectiveStartTurn:5});
 for(const command of ['balanced','invest','maintain','maintain'])state=advanceTurn(state,command);
 assert.equal(state.objectives.completed.length,0);
 assert.equal(state.objectives.counts.balanced??0,0);
 state=advanceTurn(state,'balanced');
 assert.equal(state.objectives.completed.length,1);
 state=advanceTurn(state,'mandate_lumen_1');
 for(let i=0;i<85;i++)state=advanceTurn(state,'maintain');
 const before=JSON.stringify(state),chronicle=buildChronicle(state);
 assert.equal(chronicle.totalTurns,state.turn);
 assert.deepEqual(chronicle.points.at(-1).metrics.food,state.countries.lumen.food);
 assert.equal(JSON.stringify(state),before);
});

test('second milestone opens one follow-up incident while its policy remains available afterward',()=>{
 let state=createGame('lumen',{foreignSiteStartTurn:999});
 for(const command of ['balanced','invest','maintain','maintain','mandate_lumen_1','mandate_lumen_1','invest'])state=advanceTurn(state,command);
 assert.equal(state.objectives.completed.length,2);
 const before=JSON.stringify(state),incident=getScenario(state);
 assert.equal(incident.title,state.objectives.pendingEvent.title);
 assert.equal(incident.options[0].id,'mandate_lumen_2');
 assert.equal(JSON.stringify(state),before);
 const next=advanceTurn(state,'maintain');
 assert.equal(next.objectives.pendingEvent,null);
 assert.notEqual(getScenario(next).title,incident.title);
 assert.ok(getDomesticOrders(next).some(order=>order.id==='mandate_lumen_2'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {resultCauses} from '../dist/result-causes.mjs';
import {mapConsequences} from '../dist/map-consequences.mjs';
const quiet={networkStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,foreignSiteStartTurn:999};
function alliance(playerDonates=true,donorMoney=80){
 const state=createGame('lumen',quiet);state.relations['lumen:nord']=100;state.reliability.nord=100;
 Object.assign(state.countries.lumen,{food:playerDonates?80:0,treasury:playerDonates?donorMoney:0});
 Object.assign(state.countries.nord,{food:playerDonates?0:80,treasury:playerDonates?0:donorMoney});
 return advanceTurn(state,'treaty:nord:alliance:4:6:4');
}
test('a player-funded alliance reports canonical food and money, including partial aid',()=>{
 for(const money of [80,13]){const state=alliance(true,money),event=state.lastTreatyEvents.find(item=>['fulfilled','breach'].includes(item.type)),model=resultCauses(state);
  assert.equal(event.actorId,'lumen');assert.equal(event.food,4);
  assert.equal(event.type,money===13?'breach':'fulfilled');assert.equal(event.money,money===13?1:6);
  assert.equal(model.action.actualCost,event.money);assert.equal(model.action.actualFood,event.food);
 }
});
test('aid received from the ally is not described as money or food paid by the player',()=>{
 const state=alliance(false),event=state.lastTreatyEvents.find(item=>['fulfilled','breach'].includes(item.type)),model=resultCauses(state);
 assert.equal(event.actorId,'nord');assert.equal(model.action.actualCost,0);assert.equal(model.action.actualFood,0);
});
test('a rejected long-term treaty never promises future fulfillment',()=>{
 const state=createGame('lumen',quiet);state.relations['lumen:solis']=0;state.reliability.solis=0;
 const next=advanceTurn(state,'treaty:solis:trade_buy:8:1:12'),model=resultCauses(next);
 assert.match(model.action.outcome,/거절/);assert.equal(model.action.actualCost,0);assert.equal(model.action.timing,null);
});
test('domestic facility construction keeps completion date and canonical future benefit together',()=>{
 const state=advanceTurn(createGame(),'site:farm:upgrade');
 assert.match(resultCauses(state).action.timing,/2031년 3분기.+식량 \+3/);
 assert.match(mapConsequences(state).find(item=>item.kind==='site-started').detail,/2031년 3분기.+식량 \+3/);
});
test('accepted foreign construction includes the conditional share and reviewed output bound',()=>{
 const state=advanceTurn(createGame(),'join:nord:farm:28:25:12');
 assert.match(resultCauses(state).action.timing,/2031년 3분기.+25%.+분기 최대 1/);
 assert.match(resultCauses(state).action.timing,/변동|중단/);
 assert.match(mapConsequences(state).find(item=>item.kind==='joint-started').detail,/25%.+분기 최대 1/);
});

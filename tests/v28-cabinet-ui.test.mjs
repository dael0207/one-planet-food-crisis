import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,currentAgenda} from '../dist/engine.mjs';
import {cabinetTerms,renderCabinetFollowthrough} from '../dist/cabinet-ui.mjs';
import {policyTradeoffs} from '../dist/policy-tradeoffs.mjs';
import {renderDecision,renderOutcome} from '../dist/experience.mjs';
import {resultCauses} from '../dist/result-causes.mjs';
import {quarterPriority} from '../dist/quarter-priority.mjs';
import {getDomesticOrders,getScenario} from '../dist/scenarios.mjs';
const ready=()=>advanceTurn(advanceTurn(createGame(),'maintain'),'maintain');
test('cabinet choices expose actual immediate costs and dated finite future amounts',()=>{
 const state=ready(),action=currentAgenda(state).options[0],terms=cabinetTerms(state,action);
 assert.match(terms.gain,/2031년 4분기/);
 assert.match(terms.gain,/3회.*식량 \+3/);
 assert.match(terms.sacrifice,/10억/);assert.match(terms.sacrifice,/식량 2/);assert.match(terms.sacrifice,/지지도 −2/);
 assert.deepEqual(policyTradeoffs(state,action),terms);
 const html=renderDecision(state);assert.match(html,/data-agenda-family="national:lumen"/);assert.match(html,/발생 배경/);
 assert.equal(quarterPriority(state).kind,'deadline');
 const withoutDeadline={...state,requests:[]};
 const priority=quarterPriority(withoutDeadline);assert.equal(priority.kind,'agenda');assert.equal(priority.commandId,action.id);
});
test('new command result distinguishes food invested now from dated follow-through',()=>{
 let state=ready();state=advanceTurn(state,currentAgenda(state).options[0].id);
 const cause=resultCauses(state);assert.equal(cause.action.actualCost,10);assert.equal(cause.action.actualFood,2);
 assert.match(cause.action.timing,/2031년 4분기/);assert.match(cause.action.timing,/2032년 2분기/);
 assert.match(renderOutcome(state),/실제 지출 식량 2 · 국고 10억/);
 assert.doesNotMatch(renderCabinetFollowthrough(state),/이번 분기 후속 조치/);
});
test('following quarter links the actual effect to original decision and pending dates',()=>{
 let state=ready();state=advanceTurn(state,currentAgenda(state).options[0].id);state=advanceTurn(state,'maintain');
 const result=renderCabinetFollowthrough(state);assert.match(result,/2031년 3분기 결정/);assert.match(result,/식량 \+3/);
 assert.match(result,/2032년 1분기/);assert.match(result,/남은 2회/);
 const decision=renderCabinetFollowthrough(state,'decision');assert.doesNotMatch(decision,/이번 분기 후속 조치/);assert.match(decision,/예정된 후속 효과/);
 state=advanceTurn(advanceTurn(state,'maintain'),'maintain');assert.equal(renderCabinetFollowthrough(state,'decision'),'');
});
test('presentation escapes recorded names and preserves a genuinely empty old campaign',()=>{
 assert.equal(renderCabinetFollowthrough(createGame()),'');
 let state=ready();state=advanceTurn(state,currentAgenda(state).options[0].id);state=advanceTurn(state,'maintain');
 state.history.at(-1).worldActions.find(e=>e.source==='cabinet').originatingName='<img src=x>';
 state.cabinetPlans[0].name='<script>bad</script>';
 const html=renderCabinetFollowthrough(state);assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);
});
test('a sustained shortage keeps immediate relief first while exposing a different longer-term tradeoff',()=>{
 const state=ready();state.countries.lumen.food=25;
 const options=getScenario(state).options.map(option=>option.id);
 assert.equal(options[0],'embargo');assert.match(options[1],/^cabinet:/);assert.ok(options.includes('maintain'));
});
test('new objective unlocks remain available without displacing either contextual tradeoff',()=>{
 let state=createGame();
 for(const command of [...Array(8).fill('maintain'),...Array(4).fill('balanced'),'cabinet:national:lumen:reserve','invest','cabinet:fiscal:austerity','maintain'])state=advanceTurn(state,command);
 const scenario=getScenario(state);assert.equal(scenario.agenda.family,'surplus');
 assert.deepEqual(scenario.options.map(option=>option.id),['cabinet:surplus:preserve','cabinet:surplus:dividend','maintain']);
 state=advanceTurn(advanceTurn(state,'cabinet:surplus:preserve'),'mandate_lumen_1');
 assert.ok(!getScenario(state).options.some(option=>option.id==='mandate_lumen_1'),'already exercised unlock stops crowding the primary choices');
 assert.ok(getDomesticOrders(state).some(option=>option.id==='mandate_lumen_1'),'manual repeat remains available');
});

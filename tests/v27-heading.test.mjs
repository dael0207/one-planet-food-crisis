import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderDecision,renderOutcome} from '../dist/experience.mjs';
test('long resource and construction headlines are concise without changing the selected commands',()=>{
 const critical=advanceTurn(advanceTurn(createGame(),'aid'),'aid');
 assert.match(renderDecision(critical),/>식량 비축 대응<\/h2>/);
 const building=advanceTurn(createGame(),'invest');
 assert.match(renderDecision(building),/>관개 시설 완공 준비<\/h2>/);
 assert.match(renderDecision(building),/name="policy"/);
});
test('compound facility and investment names stay in semantic heading units with escaped content',()=>{
 const state=advanceTurn(createGame(),'join:nord:port:28:25:12');
 const html=renderOutcome(state);
 assert.match(html,/<span class="heading-unit">국제 항만<\/span>/);
 assert.match(html,/<span class="heading-unit">공동 투자<\/span>/);
 state.history.at(-1).actionLabel='<img src=x> 국제 항만';
 assert.doesNotMatch(renderOutcome(state),/<img/);
});

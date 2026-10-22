import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {renderDecision,renderOutcome} from '../dist/experience.mjs';

test('decision dispatch keeps native orders and discloses secondary context',()=>{
 const html=renderDecision(createGame(),null);
 assert.match(html,/<form id="policy-form">/);
 const suggested=html.split('<details class="additional-orders"')[0];
 assert.equal((suggested.match(/type="radio" name="policy"/g)??[]).length,3);
 assert.equal((suggested.match(/class="policy-tradeoffs"/g)??[]).length,3);
 assert.match(html,/<details class="decision-context">/);
 assert.match(html,/id="forecast"/);
 assert.match(html,/id="advance-button"/);
 assert.match(html,/1분기/);
});

test('quarterly result is one stable report with facts and progressive detail',()=>{
 const state=advanceTurn(createGame(),'balanced');
 const first=renderOutcome(state,0),legacyStep=renderOutcome(state,3,'nord');
 const ledger=first.slice(first.indexOf('<details class="result-ledger">'),first.indexOf('<details class="result-details">'));
 assert.equal(legacyStep,first);
 assert.equal((first.match(/class="quarterly-report"/g)??[]).length,1);
 assert.equal((ledger.match(/data-metric=/g)??[]).length,4);
 assert.match(first,/class="quarterly-consequences"/);
 assert.match(first,/<details class="result-details">/);
 assert.match(first,/class="policy-comparison"/);
 assert.match(first,/class="food-accounting"/);
 assert.match(first,/data-action="next-quarter"/);
 assert.doesNotMatch(first,/review-tabs|data-action="review"/);
});

test('quarterly report surfaces actual construction milestone once',()=>{
 const state=advanceTurn(createGame(),'invest'),html=renderOutcome(state,2,'cera');
 assert.equal((html.match(/class="development-panel"/g)??[]).length,1);
 assert.match(html,/data-development-stage="started"/);
 assert.match(html,/2031년 3분기 · 3분기 결과/);
 assert.match(html,/이번 분기 실제 지출 <b>16억<\/b>/);
 assert.match(html,/완공 뒤 추가 생산 <b>\+4\/분기<\/b>/);
});

test('quiet quarters omit an empty consequence panel and do not claim time advances',()=>{
 const html=renderOutcome(advanceTurn(createGame(),'maintain'),0);
 assert.doesNotMatch(html,/class="quarterly-consequences"/);
 assert.match(html,/class="result-continuation-rail" data-next-year="2031" data-next-quarter="2"/);
 assert.equal((html.match(/data-action="next-quarter"/g)??[]).length,1);
 assert.doesNotMatch(html,/다음 명령 · 한 분기 진행/);
});

test('treaty consequence is concise in the report and exact in details',()=>{
 const state=advanceTurn(createGame(),'maintain');
 state.lastTreatyEvents=[{
  treatyId:'treaty-proof',targetId:'nord',type:'breach',actorId:'nord',
  text:'노르드가 약속한 식량 4 가운데 2만 보냈습니다.',
  promisedFood:4,actualFood:2,promisedMoney:8,actualMoney:4,
  relationBefore:73,relationAfter:68,reliabilityBefore:70,reliabilityAfter:62
 }];
 const html=renderOutcome(state,0);
 assert.match(html,/data-consequence="treaty"/);
 assert.match(html,/노르드가 약속한 식량 4 가운데 2만 보냈습니다/);
 assert.match(html,/class="treaty-results"/);
 assert.match(html,/약속<\/span><b>식량 4 · 국고 8억<\/b>/);
 assert.match(html,/실제 이동<\/span><b>식량 2 · 국고 4억<\/b>/);
});

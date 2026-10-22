import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {renderOutcome} from '../dist/experience.mjs';

test('result continuation follows outcomes and precedes optional exact evidence',()=>{
 // Given: a completed quarter with a real treaty consequence and exact fulfillment evidence.
 const state=advanceTurn(createGame(),'treaty:nord:trade_buy:3:6:4');
 const before=structuredClone(state);

 // When: the paused result is rendered.
 const html=renderOutcome(state,0);

 // Then: one continuation rail appears before optional world and accounting disclosures without mutating time.
 const consequenceIndex=html.indexOf('quarterly-consequences');
 const continuationIndex=html.indexOf('result-continuation-rail');
 const detailsIndex=html.indexOf('<details class="result-details">');
 assert.ok(continuationIndex<consequenceIndex);
 assert.ok(continuationIndex<detailsIndex);
 assert.equal((html.match(/data-action="next-quarter"/g)??[]).length,1);
 assert.deepEqual(state,before);
});

test('continuation reports the live project countdown and pending dispatch count',()=>{
 // Given: an investment quarter with one project due on turn three and two pending dispatches.
 const state=advanceTurn(createGame(),'invest');

 // When: the paused result is rendered.
 const html=renderOutcome(state,0);

 // Then: the rail uses the actual pending state and the investment result remains visible.
 assert.match(html,/관개 시설 완공까지 2분기 · 회신 대기 2건/);
 assert.match(html,/관개 시설 1단계 착공 완료/);
 assert.match(html,/이번 분기 실제 지출 <b>16억<\/b>/);
});

test('compact result keeps treaty fulfillment visible and exact accounting in the disclosure',()=>{
 // Given: a fulfilled treaty whose command also has the engine's exact food accounting.
 const state=advanceTurn(createGame(),'treaty:nord:trade_buy:3:6:4');

 // When: the paused result is rendered.
 const html=renderOutcome(state,0);

 // Then: treaty fulfillment stays visible before continuation while exact accounting remains disclosed.
 const details=html.slice(html.indexOf('<details class="result-details">'));
 const treaty=html.slice(0,html.indexOf('result-continuation-rail'));
 assert.match(details,/class="food-accounting"/);
 assert.match(treaty,/약속<\/span><b>식량 3 · 국고 6억<\/b>/);
 assert.match(treaty,/실제 이동<\/span><b>식량 3 · 국고 6억<\/b>/);
 assert.match(treaty,/노르드의 약속 신뢰도 70 → <strong>71<\/strong>/);
});

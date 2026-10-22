import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {renderDecision,renderOutcome} from '../dist/experience.mjs';

test('V20 command console keeps exact tradeoffs visible and moves prose into context disclosure',()=>{
 const html=renderDecision(createGame(),null);
 const context=html.match(/<details class="decision-context">([\s\S]*?)<\/details>/)?.[1]??'';
 assert.match(context,/event-description|<p>/);
 assert.equal((html.match(/data-command-row=/g)??[]).length>=3,true);
 assert.equal((html.match(/<b>효과<\/b>/g)??[]).length>=3,true);
 assert.equal((html.match(/<b>대가<\/b>/g)??[]).length>=3,true);
 assert.match(html,/id="forecast" aria-live="polite"/);
 assert.match(html,/명령 선택 · 1분기 실행/);
});

test('V20 result foregrounds direct and delayed effects before the next-quarter action',()=>{
 const html=renderOutcome(advanceTurn(createGame(),'invest'),0);
 const direct=html.indexOf('class="order-effect"');
 const delayed=html.indexOf('class="development-panel"');
 const next=html.indexOf('data-action="next-quarter"');
 const events=html.indexOf('<details class="result-events">');
 const ledger=html.indexOf('<details class="result-ledger">');
 const exact=html.indexOf('<details class="result-details">');
 assert.ok(direct>=0&&direct<delayed&&delayed<next);
 assert.ok(next<events&&events<ledger&&ledger<exact);
 assert.match(html,/이번 분기 실제 지출 <b>16억<\/b>/);
 assert.match(html,/완공 뒤 추가 생산 <b>\+4\/분기<\/b>/);
 assert.equal((html.match(/data-action="next-quarter"/g)??[]).length,1);
 assert.match(html.slice(0,next),/class="result-totals"/);
});

test('V20 keeps actual treaty movement visible before continuation and full metrics disclosed',()=>{
 const html=renderOutcome(advanceTurn(createGame(),'treaty:nord:trade_buy:3:6:4'),0);
 const next=html.indexOf('data-action="next-quarter"');
 assert.match(html.slice(0,next),/class="treaty-results"/);
 assert.match(html.slice(0,next),/실제 이동<\/span><b>식량 3 · 국고 6억<\/b>/);
 assert.ok(next<html.indexOf('<details class="result-ledger">'));
 assert.match(html,/class="quarterly-delta-strip"/);
});

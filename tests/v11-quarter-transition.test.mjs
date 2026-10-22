import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,eventForTurn} from '../dist/engine.mjs';
import {getWorldStatus} from '../dist/map.mjs';
import {renderOutcome} from '../dist/experience.mjs';

// V11 presentation fixtures freeze later strategy dispatches so their quarter/treaty copy stays isolated.

test('opening the next decision updates atlas climate while result keeps completed-quarter climate',()=>{
 let state=createGame('lumen',{foreignStrategyStartTurn:999});
 for(let completed=1;completed<=4;completed++){
  state=advanceTurn(state,'maintain');const before=JSON.stringify(state);
  assert.ok(getWorldStatus(state,'result').startsWith(eventForTurn(completed-1).title));
  assert.ok(getWorldStatus(state,'decision').startsWith(eventForTurn(completed).title),`decision ${completed+1} must show its current climate`);
  assert.equal(JSON.stringify(state),before);
 }
});
test('carried shipment and action facts identify their completed quarter in both phases',()=>{
 const state=advanceTurn(createGame('lumen',{foreignStrategyStartTurn:999}),'balanced');
 for(const phase of ['result','decision'])assert.match(getWorldStatus(state,phase),/1분기 완료 기록/);
 assert.match(getWorldStatus(createGame('lumen',{foreignStrategyStartTurn:999}),'decision'),/완료한 분기 없음/);
});
test('a treaty report does not repeat the partner name as consecutive subjects',()=>{
 const state=advanceTurn(createGame('lumen',{foreignStrategyStartTurn:999}),'treaty:nord:trade_buy:3:6:4');
 const text=renderOutcome(state,0).split('<details class="result-details">')[0].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 assert.doesNotMatch(text,/노르드\s+노르드/);
 assert.ok(text.includes(state.lastTreatyEvents[0].text));
});

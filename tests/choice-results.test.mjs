import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderDecision,renderOutcome} from '../dist/experience.mjs';

test('opening choices disclose gains and sacrifices, including the paid diplomatic alternative',()=>{
 const html=renderDecision(createGame(),null);
 const orders=(html.match(/name="policy"/g)??[]).length;
 assert.equal((html.match(/<b>효과<\/b>/g)??[]).length,orders);
 assert.equal((html.match(/<b>대가<\/b>/g)??[]).length,orders);
 assert.match(html,/교역 신뢰 강화/);assert.match(html,/국고 4억/);
 const restricted=renderDecision(advanceTurn(createGame(),'embargo'),null);
 assert.match(restricted,/수출 제한·대외 비용도 계속/);
});

test('result discloses actual bilateral gain and distinguishes the total quarter from the policy comparison',()=>{
 const state=advanceTurn(createGame(),'balanced'),html=renderOutcome(state,0);
 assert.match(html,/노르드 관계 73 → 79/);
 assert.match(html,/유지 대비 \+6/);assert.match(html,/국고 -4/);
 assert.match(html,/기후·생산·소비·교역을 모두 합친 변화/);
});

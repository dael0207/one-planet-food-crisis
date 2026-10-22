import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderDecision} from '../dist/experience.mjs';

test('domestic orders keep relief and investment reachable beyond the three suggested orders',()=>{
 const state=advanceTurn(createGame(),'embargo');
 const before=JSON.stringify(state);
 const html=renderDecision(state,'invest');
 assert.match(html,/<details class="additional-orders" open>/);
 assert.match(html,/그 밖의 국내 명령/);
 assert.match(html,/value="invest" checked/);
 assert.match(html,/관개 시설 투자/);
 const ids=[...html.matchAll(/name="policy" value="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length);
 assert.equal(JSON.stringify(state),before);
});

test('diplomatic reply remains a distinct three-response decision',()=>{
 let state=createGame();
 state=advanceTurn(state,'maintain');
 const request=state.requests.find(item=>item.status==='pending');assert.ok(request);
 const html=renderDecision(state,null,request.id);
 assert.doesNotMatch(html,/additional-orders/);
 assert.equal((html.match(/name="policy"/g)??[]).length,3);
});

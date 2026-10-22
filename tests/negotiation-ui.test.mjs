import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,COUNTRY_IDS} from '../dist/engine.mjs';
import {renderProposal,renderProposalPreview,renderProposalTerms,renderOutbound,renderNegotiationResult,renderNegotiationHistory} from '../dist/negotiation-ui.mjs';

test('proposal form exposes five targets and exact one-quarter transaction controls',()=>{
 const state=createGame('lumen');
 const html=renderProposal(state,{targetId:'nord',kind:'buy',food:5,money:10});
 assert.equal((html.match(/<option value="(?:lumen|nord|cera|altia|marin|solis)"/g)??[]).length,5);
 assert.ok(!html.includes('<option value="lumen"'));
 for(const name of ['targetId','kind','food','money'])assert.ok(html.includes(`name="${name}"`));
 assert.ok(html.includes('이번 분기 1회 조건'));
 assert.ok(html.includes('조건을 고치는 동안에는 시간이 흐르지 않습니다'));
 assert.ok(html.includes('양국 관계'));
 assert.ok(html.includes('예상 반응'));
 assert.ok(html.includes('id="send-proposal"'));
 assert.ok(html.includes('id="proposal-terms"'));
 assert.equal((html.match(/ required/g)??[]).length,2);
 assert.ok(renderProposalTerms({kind:'sell',food:3,money:7}).includes('식량 3 제공 · 국고 7억 확보'));
 assert.ok(renderProposalPreview(state,{targetId:'nord',kind:'buy',food:Number.NaN,money:8}).includes('조건을 조정해 주세요'));
 assert.equal(COUNTRY_IDS.length,6);
});

test('outbound counter controls use replayable reply metadata and respect result pause',()=>{
 const state=createGame('lumen');
 state.negotiations=[{id:'neg-1',playerId:'lumen',targetId:'nord',kind:'buy',terms:{food:8,money:4},counterTerms:{food:6,money:8},status:'countered',createdTurn:0,expiresTurn:3,reasons:['가격을 높여야 합니다.'],relationBefore:60,relationAfter:61}];
 const decision=renderOutbound(state,{phase:'decision'});
 assert.ok(decision.includes('data-action="open-proposal"'));
 assert.ok(decision.includes('data-action="negotiation-reply"'));
 assert.ok(decision.includes('data-id="neg-1"'));
 assert.ok(decision.includes('data-response="accept"'));
 assert.ok(decision.includes('data-response="decline"'));
 const result=renderOutbound(state,{phase:'result'});
 assert.ok(result.includes('결과 확인 후 제안 가능'));
});

test('result distinguishes negotiation settlement from ordinary quarterly change',()=>{
 const state=createGame('lumen');state.turn=2;
 state.negotiations=[{id:'neg-2',playerId:'lumen',targetId:'cera',kind:'buy',terms:{food:5,money:9},status:'rejected',createdTurn:2,resolvedTurn:2,reasons:['관계가 충분히 높지 않습니다.'],relationBefore:44,relationAfter:42}];
 const rejected=renderNegotiationResult(state);
 assert.ok(rejected.includes('협상 거래량 0'));
 assert.ok(rejected.includes('날씨·생산·타국 행동·기존 협정'));
 state.negotiations[0]={...state.negotiations[0],status:'accepted',settlement:{foodDelta:5,moneyDelta:-9,terms:{food:5,money:9}},relationAfter:47};
 const accepted=renderNegotiationResult(state);
 assert.ok(accepted.includes('실제 이행 조건'));
 assert.ok(accepted.includes('+5'));
 assert.ok(accepted.includes('-9억'));
 assert.ok(renderNegotiationHistory(state).includes('내가 먼저 보낸 외교 기록'));
});

test('current proposal takes precedence over an unrelated counter expiring in the same quarter',()=>{
 const state=createGame('lumen');state.turn=4;state.history=[{policyId:'propose:nord:buy:4:8'}];
 state.negotiations=[
  {id:'old',targetId:'cera',kind:'sell',status:'expired',createdTurn:1,resolvedTurn:4,terms:{food:3,money:7}},
  {id:'new',targetId:'nord',kind:'buy',status:'countered',createdTurn:4,terms:{food:4,money:8},counterTerms:{food:2,money:10},relationBefore:60,relationAfter:61}
 ];
 const html=renderNegotiationResult(state);assert.ok(html.includes('노르드: 역제안 도착'));assert.ok(!html.includes('세라: 기한 종료'));
 state.history=[{policyId:'reply:new:accept'}];state.negotiations[1]={...state.negotiations[1],status:'accepted',resolvedTurn:4,replyRelationBefore:61,relationAfter:64,settlement:{foodDelta:2,moneyDelta:-10,terms:{food:2,money:10}}};
 assert.ok(renderNegotiationResult(state).includes('양국 관계 61 →'));
});

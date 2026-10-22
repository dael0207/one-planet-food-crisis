import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../dist/engine.mjs';
import {previewProposal} from '../dist/negotiations.mjs';
import {proposalComparison} from '../dist/negotiation-insight.mjs';
import {renderNegotiationResult,renderProposalPreview} from '../dist/negotiation-ui.mjs';

const draft=money=>({targetId:'cera',kind:'buy',food:6,money});

test('trade preview states the deterministic score and both response thresholds',()=>{
 // Given a live proposal that the engine classifies as a counteroffer.
 const state=createGame('lumen'),terms=draft(9),canonical=previewProposal(state,terms);
 assert.equal(canonical.response,'counter');

 // When the proposal preview is rendered.
 const html=renderProposalPreview(state,terms);

 // Then it identifies the canonical score as readiness, not probability.
 assert.ok(html.includes(`협상 준비도 <b>${canonical.score}점</b>`));
 assert.ok(html.includes(`data-proposal-response="${canonical.response}"`));
 assert.ok(html.includes(`data-proposal-score="${canonical.score}"`));
 assert.ok(html.includes('수락 65점 이상'));
 assert.ok(html.includes('역제안 40–64점'));
 assert.ok(html.includes('확률이 아닌 현재 조건의 결정값'));
 assert.ok(!html.includes('수락 확률'));
});

test('counter preview distinguishes the proposed terms from the executable counter',()=>{
 // Given a live proposal that produces a canonical counteroffer.
 const state=createGame('lumen'),terms=draft(9),canonical=previewProposal(state,terms);

 // When the proposal preview is rendered.
 const html=renderProposalPreview(state,terms);

 // Then the exact changes and the separately accepted transfer are visible.
 assert.ok(html.includes('식량 6 → 4 (-2)'));
 assert.ok(html.includes('국고 9억 → 11억 (+2억)'));
 assert.ok(html.includes('현재 예상 이행 0'));
 assert.ok(html.includes('역제안을 나중에 수락하면'));
 assert.ok(html.includes('식량 +4 · 국고 -11억'));
 assert.ok(html.includes(canonical.reasons[0]));
});

test('rejected proposal shows the decision shortfall and no agreed transfer',()=>{
 // Given a live proposal below the counter threshold.
 const state=createGame('lumen'),terms=draft(1),canonical=previewProposal(state,terms);
 assert.equal(canonical.response,'reject');

 // When the proposal preview is rendered.
 const html=renderProposalPreview(state,terms);

 // Then the exact gap and non-transfer outcome are explicit.
 assert.ok(html.includes(`역제안까지 ${40-canonical.score}점 부족`));
 assert.ok(html.includes('현재 예상 이행 0'));
 assert.ok(html.includes('거절되면 식량과 국고는 이동하지 않습니다'));
 assert.ok(html.includes('이 조건이 수락되는 경우'));
});

test('same-negotiation edits compare canonical terms scores responses and costs without mutation',()=>{
 // Given two drafts for the same target and transaction kind.
 const state=createGame('lumen'),previous=draft(9),current=draft(18);
 const beforeState=structuredClone(state),beforePrevious=structuredClone(previous),beforeCurrent=structuredClone(current);

 // When the comparison and preview are rendered.
 const comparison=proposalComparison(state,current,previous);
 const html=renderProposalPreview(state,current,previous);

 // Then every delta comes from live canonical previews and inputs remain untouched.
 assert.deepEqual(comparison,{
  terms:{food:{before:6,after:6,delta:0},money:{before:9,after:18,delta:9}},
  score:{before:54,after:72,delta:18},
  response:{before:'counter',after:'accept'},
  playerEffect:{food:{before:6,after:6,delta:0},treasury:{before:-9,after:-18,delta:-9}}
 });
 assert.ok(html.includes('이전 조건과 비교'));
 assert.ok(html.includes('data-proposal-comparison'));
 assert.ok(html.includes('준비도 54 → 72 (+18점)'));
 assert.ok(html.includes('역제안 예상 → 수락 예상'));
 assert.ok(html.includes('국고 지출 9억 → 18억 (+9억)'));
 assert.deepEqual(state,beforeState);assert.deepEqual(previous,beforePrevious);assert.deepEqual(current,beforeCurrent);
});

test('comparison labels treasury income accurately for a sale',()=>{
 // Given two valid sale drafts for the same negotiation.
 const state=createGame('lumen');
 const previous={targetId:'cera',kind:'sell',food:4,money:8};
 const current={...previous,money:12};

 // When the current draft is compared with the prior one.
 const html=renderProposalPreview(state,current,previous);

 // Then the positive treasury effect is presented as income.
 assert.ok(html.includes('국고 수입 8억 → 12억 (+4억)'));
});

test('comparison resets when target or transaction kind changes',()=>{
 // Given prior drafts from another negotiation.
 const state=createGame('lumen'),current=draft(18);

 // When target or kind changes.
 const otherTarget=proposalComparison(state,current,{...current,targetId:'nord'});
 const otherKind=proposalComparison(state,current,{...current,kind:'aid_out'});

 // Then no unrelated comparison is produced.
 assert.equal(otherTarget,null);assert.equal(otherKind,null);
 assert.ok(!renderProposalPreview(state,current,{...current,targetId:'nord'}).includes('이전 조건과 비교'));
});

test('result keeps recorded reasons immediate while retaining the complete calculation',()=>{
 // Given a completed negotiation with the engine's recorded reasons.
 const state=createGame('lumen');state.turn=2;state.history=[{policyId:'propose:cera:buy:6:1'}];
 state.negotiations=[{id:'result',targetId:'cera',kind:'buy',status:'rejected',createdTurn:2,resolvedTurn:2,terms:{food:6,money:1},relationBefore:49,relationAfter:46,reasons:['관계 근거','자원 근거','가격 근거']}];

 // When the recorded result is rendered.
 const html=renderNegotiationResult(state);

 // Then two reasons stay visible and the full set remains inspectable.
 assert.ok(html.includes('<ul class="proposal-reasons">'));
 assert.ok(html.includes('관계 근거'));assert.ok(html.includes('자원 근거'));
 assert.ok(html.includes('판단 근거 전체 3개'));
 assert.ok(html.includes('가격 근거'));
});

test('compact reasons prioritize term sensitivity and real resource impediments',()=>{
 // Given a normal priced offer and another that the partner cannot execute.
 const state=createGame('lumen'),priced=renderProposalPreview(state,draft(9));
 const constrained=createGame('lumen');constrained.countries.cera.food=4;
 const blocked=renderProposalPreview(constrained,draft(9));

 // When compact reasons are read before opening details.
 const pricedDetails=priced.indexOf('<details'),blockedDetails=blocked.indexOf('<details');

 // Then the price lever and resource blocker are already visible.
 assert.ok(priced.indexOf('식량 1당 제안 대금')<pricedDetails);
 assert.ok(blocked.indexOf('보유량 또는 저장 여력')<blockedDetails);
});

test('real partner storage ceiling explains why paying more cannot buy acceptance',()=>{
 const state=createGame('lumen');state.countries.cera.treasury=95;
 const html=renderProposalPreview(state,{targetId:'cera',kind:'buy',food:6,money:9});
 assert.match(html,/세라 국고 95 → 104억/);
 assert.match(html,/보관 상한 100억 초과/);
});

// Live updates announce the changed decision once; full reasons stay available on demand.
test('trade edits expose one concise status without repeating the explanation',()=>{
 const state=createGame('lumen'),html=renderProposalPreview(state,draft(9),draft(18));
 const statuses=[...html.matchAll(/role="status"/g)];
 assert.equal(statuses.length,1);
 assert.equal([...html.matchAll(/aria-live=/g)].length,0);
 const summary=html.match(/<p class="sr-only" role="status" aria-atomic="true">([^<]+)<\/p>/)?.[1];
 assert.ok(summary,'a concise atomic announcement is available');
 assert.ok(summary.includes('세라'));
 assert.ok(summary.includes('식량 6'));
 assert.ok(summary.includes('국고 9억'));
 assert.ok(summary.includes('역제안 예상'));
 assert.ok(summary.includes('준비도'));
 assert.ok(summary.length<180);
 assert.ok(html.includes('판단 근거 전체'));
 assert.ok(html.includes('이전 조건과 비교'));
});

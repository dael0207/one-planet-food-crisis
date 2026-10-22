import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../dist/engine.mjs';
import {previewTreaty} from '../dist/treaties.mjs';
import {treatyComparison} from '../dist/treaty-insight.mjs';
import {renderTreatyForm,renderTreatyPreview} from '../dist/treaty-ui.mjs';

test('treaty composer header uses the shared campaign calendar and Korean label',()=>{
 // Given the fifth decision quarter.
 const state=createGame('lumen');state.turn=4;

 // When the treaty form is rendered.
 const html=renderTreatyForm(state,{targetId:'cera',kind:'trade_buy',food:3,money:6,duration:4});

 // Then the shared calendar date and direct Korean task label appear.
 assert.ok(html.includes('<span>장기 협정</span><span>2032년 1분기</span>'));
 assert.ok(!html.includes('LONG-TERM COMMITMENT'));
});

test('treaty readiness uses the authoritative 52 point acceptance boundary',()=>{
 // Given a live treaty exactly on the canonical acceptance boundary.
 const state=createGame('lumen'),draft={targetId:'cera',kind:'trade_buy',food:4,money:8,duration:12};
 const canonical=previewTreaty(state,draft);assert.equal(canonical.score,52);assert.equal(canonical.response,'accept');

 // When the treaty preview is rendered.
 const html=renderTreatyPreview(state,draft);

 // Then the deterministic score, threshold and period are explicit.
 assert.ok(html.includes('협정 준비도 <b>52점</b>'));
 assert.ok(html.includes('수락 기준 52점 이상'));
 assert.ok(html.includes('수락 기준 충족 · 0점 여유'));
 assert.ok(html.includes('약정 기간 12분기'));
 assert.ok(html.includes('확률이 아닌 현재 조건의 결정값'));
 assert.ok(html.includes('data-treaty-response="accept"'));
 assert.ok(html.includes('data-treaty-score="52"'));
 assert.ok(!html.includes('수락 확률'));
});

test('rejected treaty states the exact shortfall and no agreed obligation',()=>{
 // Given a live long export agreement below the acceptance boundary.
 const state=createGame('lumen'),draft={targetId:'marin',kind:'trade_sell',food:4,money:8,duration:12};
 const canonical=previewTreaty(state,draft);assert.equal(canonical.response,'reject');

 // When the preview is rendered.
 const html=renderTreatyPreview(state,draft);

 // Then the shortfall and non-transfer outcome are truthful.
 assert.ok(html.includes(`수락까지 ${52-canonical.score}점 부족`));
 assert.ok(html.includes('현재 예상 체결 없음 · 이행 0'));
 assert.ok(html.includes('조건과 기간에 비해 상대국의 이익이 충분하지 않습니다.'));
});

test('same treaty edits compare canonical score duration and per-quarter obligations without mutation',()=>{
 // Given two distinct drafts for the same counterpart and treaty kind.
 const state=createGame('lumen');
 const previous={targetId:'cera',kind:'trade_buy',food:4,money:8,duration:4};
 const current={targetId:'cera',kind:'trade_buy',food:5,money:10,duration:12};
 const beforeState=structuredClone(state),beforePrevious=structuredClone(previous),beforeCurrent=structuredClone(current);

 // When the helper and both renderer entry points compare them.
 const comparison=treatyComparison(state,current,previous);
 const preview=renderTreatyPreview(state,current,previous),form=renderTreatyForm(state,current,previous);

 // Then every readiness value comes from canonical previews and obligations are exact.
 assert.deepEqual(comparison,{
  terms:{food:{before:4,after:5,delta:1},money:{before:8,after:10,delta:2},duration:{before:4,after:12,delta:8}},
  score:{before:57,after:52,delta:-5},
  response:{before:'accept',after:'accept'}
 });
 for(const html of [preview,form]){
  assert.ok(html.includes('data-treaty-comparison'));
  assert.ok(html.includes('준비도 57 → 52 (-5점)'));
  assert.ok(html.includes('기간 4 → 12분기 (+8분기)'));
  assert.ok(html.includes('분기당 확보 식량 4 → 5 (+1)'));
  assert.ok(html.includes('분기당 지급 국고 8억 → 10억 (+2억)'));
 }
 assert.deepEqual(state,beforeState);assert.deepEqual(previous,beforePrevious);assert.deepEqual(current,beforeCurrent);
});

test('alliance comparison names crisis support limits instead of recurring transfers',()=>{
 // Given two same-country alliance drafts.
 const state=createGame('lumen');
 const previous={targetId:'nord',kind:'alliance',food:3,money:0,duration:4};
 const current={targetId:'nord',kind:'alliance',food:5,money:2,duration:8};

 // When the prior draft is compared.
 const html=renderTreatyPreview(state,current,previous);

 // Then it describes conditional maximums, not fictional quarterly movement.
 assert.ok(html.includes('위기 시 식량 한도 3 → 5 (+2)'));
 assert.ok(html.includes('지원금 한도 0억 → 2억 (+2억)'));
 assert.ok(!html.includes('분기당 제공 식량 3 → 5'));
});

test('treaty comparison resets across target or kind changes',()=>{
 // Given a valid current draft and unrelated prior drafts.
 const state=createGame('lumen'),current={targetId:'cera',kind:'trade_buy',food:4,money:8,duration:4};

 // When target or kind differs.
 const target=treatyComparison(state,current,{...current,targetId:'nord'});
 const kind=treatyComparison(state,current,{...current,kind:'alliance',money:0});

 // Then no unrelated comparison is rendered.
 assert.equal(target,null);assert.equal(kind,null);
 assert.ok(!renderTreatyPreview(state,current,{...current,targetId:'nord'}).includes('data-treaty-comparison'));
});

test('blocked trade reason is visible in the compact live treaty decision',()=>{
 // Given an active conflict that blocks the selected commercial route.
 const state=createGame('lumen');state.turn=2;
 state.goalConflicts=[{id:'blocked',status:'active',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],startTurn:1,endTurn:8,events:[]}];
 const draft={targetId:'cera',kind:'trade_buy',food:4,money:20,duration:4};
 const canonical=previewTreaty(state,draft);assert.equal(canonical.score,0);assert.equal(canonical.response,'reject');

 // When the treaty preview is rendered.
 const html=renderTreatyPreview(state,draft),details=html.indexOf('<details');

 // Then the engine's exact trade-block reason appears before the disclosure.
 const reason=canonical.reasons.find(item=>item.includes('거래가 중단'));
 assert.ok(reason);assert.ok(html.indexOf(reason)<details);
});

test('treaty edits announce current terms once without reading every reason',()=>{
 const state=createGame('lumen'),draft={targetId:'cera',kind:'trade_buy',food:4,money:8,duration:12};
 const html=renderTreatyPreview(state,draft,{...draft,duration:4});
 assert.equal([...html.matchAll(/role="status"/g)].length,1);
 assert.equal([...html.matchAll(/aria-live=/g)].length,0);
 const summary=html.match(/<p class="sr-only" role="status" aria-atomic="true">([^<]+)<\/p>/)?.[1];
 assert.ok(summary,'a concise atomic announcement is available');
 assert.ok(summary.includes('세라'));
 assert.ok(summary.includes('분기당 식량 4'));
 assert.ok(summary.includes('국고 8억'));
 assert.ok(summary.includes('12분기'));
 assert.ok(summary.includes('수락 예상'));
 assert.ok(summary.includes('52점'));
 assert.ok(summary.length<180);
 assert.ok(html.includes('판단 근거 전체'));
 assert.ok(html.includes('이전 조건과 비교'));
});

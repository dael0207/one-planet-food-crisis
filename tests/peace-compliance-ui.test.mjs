import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction,peaceComplianceCommand} from '../dist/engine.mjs';
import {mediationCommand} from '../dist/mediation.mjs';
import {createMediationController} from '../dist/mediation-controller.mjs';
import {renderConflictBrief,renderConflictResults,renderConflictWorld,conflictCountryLabel} from '../dist/conflict-ui.mjs';
import {renderMediationForm} from '../dist/mediation-ui.mjs';
import {pendingPeaceComplianceCount,renderPeaceAccordReview,renderPeaceComplianceBrief,renderPeaceComplianceResults,renderPeaceComplianceWorld,renderPeaceSanctionReview} from '../dist/peace-compliance-ui.mjs';

const dispute=()=>({id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:9,duration:7,playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌'});
const acceptedPeace=()=>{
 const state=createGame('nord',{peaceComplianceStartTurn:1});state.turn=2;state.goalConflicts=[dispute()];state.conflictCooldownUntil=12;state.relations['cera:nord']=84;state.relations['lumen:nord']=84;
 return advanceTurn(state,mediationCommand({conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:8,money:12}));
};
const breachedPeace=()=>{
 const state=acceptedPeace();state.countries.cera.food=8;state.countries.cera.price=190;state.reliability.cera=5;state.relations['cera:lumen']=8;state.relations['cera:nord']=10;
 return advanceTurn(state,'maintain');
};

test('opening stays unchanged and a real accord adds one compact review strip only after signature',()=>{
 const opening=createGame('nord',{peaceComplianceStartTurn:1});assert.equal(renderPeaceComplianceBrief(opening),'');
 const state=acceptedPeace(),html=renderConflictBrief(state,'decision');
 assert.match(html,/data-peace-accord-brief/);assert.match(html,/세라 · 루멘/);assert.match(html,/4분기 다음 점검/);
 assert.match(html,/data-action="review-peace-accord"/);assert.equal(pendingPeaceComplianceCount(state),0);
});

test('accord review is non-mutating and shows nested actor checks with actual relation and reliability values',()=>{
 const state=advanceTurn(acceptedPeace(),'maintain'),before=structuredClone(state),accord=state.peaceAccords[0],html=renderPeaceAccordReview(state,accord.id);
 assert.match(html,/상업 교역을 열어 둡니다/);assert.match(html,/data-compliance-check="fulfilled"/);
 assert.match(html,/세라 · 약속 이행/);assert.match(html,/상대국 관계 \d+ → \d+ · 약속 신뢰 \d+ → \d+/);
 assert.doesNotMatch(html,/우리의 대응은 자동으로 정해지지 않습니다/);assert.deepEqual(state,before);
});

test('a canonical breach exposes deliberate sanction review, exact finite horizon and active map role text',()=>{
 const state=breachedPeace(),accord=state.peaceAccords[0],review=renderPeaceAccordReview(state,accord.id),sanction=renderPeaceSanctionReview(state,accord.id);
 assert.equal(pendingPeaceComplianceCount(state),1);assert.match(review,/위반 교역 제한/);assert.match(review,/세라 · .* · 5분기부터 6분기까지 · 다음 명령부터 2회/);
 assert.match(review,/data-action="review-peace-sanction"/);assert.match(review,/data-action="renegotiate-peace-accord"/);
 assert.match(sanction,/id="peace-sanction-form"/);assert.match(sanction,new RegExp(`${state.turn+1}분기부터 ${state.turn+3}분기까지 · 총 3회`));
 assert.match(sanction,/식량 0 · 국고 0/);assert.match(sanction,/인도적 지원/);assert.equal(conflictCountryLabel(state,'cera'),'');
 assert.equal(conflictCountryLabel(advanceTurn(state,'maintain'),'cera'),'평화 위반 제재 대상 · 합의 위반 · 교역 제한');
});

test('an expiring automatic restriction is described as ended for the next command and offers no stale response',()=>{
 const state=breachedPeace(),accord=state.peaceAccords[0];state.turn=accord.violation.untilTurn-1;
 const brief=renderPeaceComplianceBrief(state,'decision'),review=renderPeaceAccordReview(state,accord.id),world=renderPeaceComplianceWorld(state,'result');
 assert.match(brief,/다음 명령부터 제한 종료/);assert.equal(pendingPeaceComplianceCount(state),0);
 assert.doesNotMatch(review,/data-action="review-peace-sanction"/);assert.doesNotMatch(review,/data-action="renegotiate-peace-accord"/);
 assert.match(world,/data-action="review-peace-accord"[^>]+disabled/);
});

test('renegotiation reuses the mediation composer with original-revised comparison and authoritative live reactions',()=>{
 const state=breachedPeace(),accord=state.peaceAccords[0];state.relations['cera:nord']=90;state.relations['lumen:nord']=90;
 const unchanged=renderMediationForm(state,{...accord.terms,conflictId:accord.conflictId,accordId:accord.id});assert.match(unchanged,/기존 조건으로 재협상합니다. 수락하면 새 이행 점검을 시작합니다/);assert.match(unchanged,/id="send-mediation" >수정안을 보내고 한 분기 진행/);
 const html=renderMediationForm(state,{...accord.terms,conflictId:accord.conflictId,accordId:accord.id,food:4});
 assert.match(html,new RegExp(`name="accordId" value="${accord.id}"`));assert.match(html,/위반 합의 재협상/);
 assert.match(html,/원래 합의/);assert.match(html,/새 수정안/);assert.match(html,/변경 항목 · 식량/);
 assert.match(html,/현재 조건의 예상 결과/);assert.match(html,/세라/);assert.match(html,/루멘/);assert.match(html,/수정안을 보내고 한 분기 진행/);
});

test('controller keeps V18 renegotiation executable after editing a field and returning to the original terms',()=>{
 const state=breachedPeace(),accord=state.peaceAccords[0];state.relations['cera:nord']=90;state.relations['lumen:nord']=90;
 const comparison={outerHTML:''},terms={innerHTML:''},preview={innerHTML:''},submit={disabled:true,firstChild:{textContent:''}},nodes={'#mediation-comparison':comparison,'#mediation-terms':terms,'#mediation-preview':preview,'#send-mediation':submit};
 const content={querySelector:selector=>nodes[selector]},form={values:{...accord.terms,conflictId:accord.conflictId,accordId:accord.id}};
 const OriginalFormData=globalThis.FormData;globalThis.FormData=class{constructor(target){this.target=target;}get(key){return this.target.values[key]??null;}};
 try{
  const controller=createMediationController({state:()=>state,resolveAction:command=>getAction(state,command),decisionContent:()=>content,clearCompeting(){},rerender(){},commit(){},focus(){}});
  controller.renegotiate(accord.id);form.values.food=4;controller.input({target:{closest:()=>form}});form.values.food=accord.terms.food;controller.input({target:{closest:()=>form}});
  assert.equal(submit.disabled,false);assert.match(submit.firstChild.textContent,/수정안을 보내고 한 분기 진행/);assert.match(comparison.outerHTML,/기존 조건으로 재협상합니다/);
 }finally{globalThis.FormData=OriginalFormData;}
});

test('compliance results and world history preserve direct effects separately from aggregate totals',()=>{
 const breached=breachedPeace(),accord=breached.peaceAccords[0],result=advanceTurn(breached,peaceComplianceCommand(accord.id,'sanction'));
 const resultHtml=renderPeaceComplianceResults(result),worldHtml=renderPeaceComplianceWorld(result);
 assert.match(resultHtml,/data-peace-compliance-event="accord_sanctioned"/);assert.match(resultHtml,/실제 효과 · \d+분기까지/);
 assert.match(resultHtml,/분기 최종 지표에는 생산·소비·기후·모든 교역/);assert.match(worldHtml,/평화 합의 이행 기록/);
 assert.match(worldHtml,/위반 1회/);assert.match(renderConflictResults(result),/평화 합의 이행 결과/);assert.match(renderConflictWorld(result),/평화 합의 이행 기록/);
});

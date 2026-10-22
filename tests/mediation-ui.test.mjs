import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../dist/engine.mjs';
import {conflictCountryLabel,renderConflictBrief,renderConflictResults,renderConflictWorld} from '../dist/conflict-ui.mjs';
import {defaultMediationDraft,renderMediationCounters,renderMediationForm,renderMediationPreview,renderMediationResults} from '../dist/mediation-ui.mjs';

const conflict=(overrides={})=>({id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:8,duration:6,playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌',...overrides});
const world=()=>{const state=createGame('nord');state.turn=2;state.goalConflicts=[conflict()];state.conflictCooldownUntil=10;return state;};

test('mediation composer progressively exposes exact terms and both principals reactions',()=>{
 const state=world(),draft=defaultMediationDraft(state.goalConflicts[0].id),html=renderMediationForm(state,draft);
 assert.match(html,/id="mediation-form"/);
 assert.match(html,/최대 2분기 교역 휴전/);
 assert.match(html,/합의 가능/);
 assert.match(html,/세라/);
 assert.match(html,/루멘/);
 assert.match(html,/실제 식량 배분/);
 assert.match(html,/편집하는 동안에는 시간이 흐르지 않습니다/);
 assert.equal(state.turn,2);
});

test('one-sided empty peace demand warns about real escalation before execution',()=>{
 const state=world(),html=renderMediationPreview(state,{conflictId:state.goalConflicts[0].id,goal:'peace',condition:'target',food:0,money:0});
 assert.match(html,/갈등 확대 위험/);
 assert.match(html,/자국에만 양보를 요구하는 조건입니다/);
 assert.match(html,/거절 · 38점/);
});

test('pending counter shows changed terms, deadline and a separate acceptance command',()=>{
 const state=world(),terms={conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:8,money:12};
 state.mediations=[{id:'mediation-goal-conflict-cera-lumen-1-2',conflictId:terms.conflictId,status:'countered',turn:2,expiresTurn:4,counterTerms:terms,costs:{food:0,money:0},reactions:[],terms,text:'역제안'}];
 const html=renderMediationCounters(state,'decision');
 assert.match(html,/양측의 역제안 1건/);
 assert.match(html,/식량 8 · 국고 12/);
 assert.match(html,/2분기 내 회신/);
 assert.match(html,/data-action="accept-mediation-counter"/);
 assert.doesNotMatch(html,/disabled/);
});

test('executed mediation result distinguishes outcome, actual transfers and relation changes',()=>{
 const state=world(),record={id:'mediation-goal-conflict-cera-lumen-1-3',conflictId:state.goalConflicts[0].id,status:'accepted',turn:3,expiresTurn:null,counterTerms:null,costs:{food:8,money:12},transfers:{foodShares:[{countryId:'cera',amount:4},{countryId:'lumen',amount:4}],moneyShares:[{countryId:'cera',amount:6},{countryId:'lumen',amount:6}]},relationChanges:[{a:'nord',b:'cera',before:50,after:57,delta:7}],observerChanges:[],reactions:[{countryId:'cera',score:70,attitude:'accept',reasons:['균형 조건']}],terms:{goal:'peace',condition:'mutual',food:8,money:12},text:'<script>합의</script>'};
 state.mediations=[record];state.lastMediationEvents=[{turn:3,type:'mediation_accepted',conflictId:record.conflictId,recordId:record.id,text:record.text}];
 const html=renderMediationResults(state);
 assert.match(html,/합의 성립/);
 assert.match(html,/실제 이행 · 식량 8, 국고 12/);
 assert.match(html,/세라 4 · 루멘 4/);
 assert.match(html,/관계 50 → <strong>57/);
 assert.doesNotMatch(html,/<script>/);
 state.lastMediationEvents=[{turn:3,type:'mediation_accepted',recordId:record.id,text:'중재안을 수용했습니다.'}];state.lastConflictEvents=[{turn:3,type:'mediation_accepted',text:'중재안을 수용했습니다.'}];
 assert.equal((renderConflictResults(state).match(/중재안을 수용했습니다/g)??[]).length,1);
});

test('conflict surfaces reveal mediation only after a real dispute and label an active ceasefire',()=>{
 const empty=createGame('nord');assert.equal(renderConflictBrief(empty),'');
 const state=world();
 assert.match(renderConflictBrief(state),/평화 협상/);
 assert.match(renderConflictWorld(state),/data-action="open-mediation"/);
 state.goalConflicts[0].ceasefireStartTurn=2;state.goalConflicts[0].ceasefireUntil=4;
 assert.match(renderConflictBrief(state,'result'),/교역 휴전 2분기 · 이번 분기 포함/);
 assert.match(renderConflictBrief(state,'decision'),/교역 휴전 1분기 · 다음 명령부터/);
 state.turn=3;
 assert.match(renderConflictBrief(state,'decision'),/다음 명령부터 제재 재개/);
 assert.doesNotMatch(renderConflictBrief(state,'decision'),/교역 휴전 1분기/);
 assert.equal(conflictCountryLabel(state,'cera'),'제재 연합 · 교역 휴전');
 state.lastMediationEvents=[{turn:2,type:'mediation_rejected',recordId:'missing',text:'협상 결렬'}];
 assert.match(renderConflictResults(state),/평화 협상 결과/);
});

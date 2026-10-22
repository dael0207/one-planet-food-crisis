import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction} from '../dist/engine.mjs';
import {createMediationController} from '../dist/mediation-controller.mjs';
import {renderConflictBrief,renderConflictResults} from '../dist/conflict-ui.mjs';
import {peaceComplianceCountryLabel,renderPeaceComplianceResults} from '../dist/peace-compliance-ui.mjs';
import {renderPeaceOfferBrief,renderPeaceOfferHistory,renderPeaceOfferReview} from '../dist/peace-offer-ui.mjs';
import {renderPeaceResponseBrief,renderPeaceResponseReview,renderPeaceResponseWorld} from '../dist/peace-response-ui.mjs';

const accord=response=>({id:'peace-accord-private-5',conflictId:'peace-compliance-private-5',principalIds:['cera','lumen'],createdTurn:2,startTurn:3,endTurn:7,status:'violated',terms:{goal:'peace',condition:'mutual',food:4,money:6},obligation:'양국은 상업 교역을 열어 둡니다.',checks:[],events:[],violation:{countryId:'lumen',turn:4,startsTurn:5,untilTurn:7,reason:'상업 거래를 닫았습니다.'},response:null,foreignResponse:response});
const sanctionState=()=>{
 const state=createGame('nord',{peaceResponseStartTurn:1});state.turn=5;
 state.peaceAccords=[accord({kind:'sanction',initiatorId:'cera',targetId:'lumen',memberIds:['cera','altia'],formedTurn:5,startsTurn:5,untilTurn:8,status:'active',offerId:null,reason:'낮은 양국 관계와 충돌하는 국가 목표를 근거로 선언했습니다.'})];
 state.foreignTreaties=[{id:'foreign-trade-cera-lumen',kind:'trade_sell',status:'active',playerId:'cera',targetId:'lumen',food:4,startTurn:1,endTurn:12}];return state;
};

test('foreign sanction strip and review name real leader, allies, target, reason and exact next-command horizon without mutating state',()=>{
 const state=sanctionState(),before=structuredClone(state),accordItem=state.peaceAccords[0],brief=renderPeaceResponseBrief(state,accordItem),review=renderPeaceResponseReview(state,accordItem);
 assert.match(brief,/data-peace-response="active"/);assert.match(brief,/세라 → 루멘/);assert.match(brief,/7분기까지 · 다음 명령부터 2회/);
 assert.match(review,/제재 주도국[\s\S]*세라/);assert.match(review,/합의 위반국[\s\S]*루멘/);assert.match(review,/실제 참여 동맹[\s\S]*알티아/);
 assert.match(review,/낮은 양국 관계와 충돌하는 국가 목표/);assert.match(review,/루멘 상업 협상 태도 -32/);
 assert.match(review,/자동 가입하지 않으며/);assert.match(review,/식량이나 국고를 내지 않습니다/);assert.doesNotMatch(review,/peace-accord-private-5/);assert.deepEqual(state,before);
 state.turn=7;assert.match(renderPeaceResponseBrief(state,accordItem,'decision'),/다음 명령부터 제한 종료/);assert.match(renderPeaceResponseBrief(state,accordItem,'result'),/이번 분기로 제한 종료/);
 assert.doesNotMatch(renderPeaceResponseReview(state,accordItem),/상업 협상 태도 -32/,'next-command review drops an expired commercial penalty');
});

test('foreign response country roles and archive use human labels only while preserving the player stance',()=>{
 const state=sanctionState(),html=renderPeaceResponseWorld(state,state.peaceAccords[0]);
 assert.equal(peaceComplianceCountryLabel(state,'cera'),'평화 대응 주도국');assert.equal(peaceComplianceCountryLabel(state,'altia'),'평화 제재 연대국');assert.equal(peaceComplianceCountryLabel(state,'lumen'),'평화 위반 제재 대상 · 합의 위반 · 교역 제한');assert.equal(peaceComplianceCountryLabel(state,'nord'),'');
 assert.match(html,/참여국 세라 · 알티아/);assert.match(html,/타국 상업 제재 · 시행 중/);assert.doesNotMatch(html,/peace-accord-private-5/);
});

test('completed foreign actions are separated from compliance events and report actual allied aid once',()=>{
 const state=sanctionState();state.lastPeaceComplianceEvents=[
  {turn:5,type:'peace_response_aid',source:'peace_response',accordId:state.peaceAccords[0].id,countryId:'altia',targetId:'cera',memberIds:['cera','altia'],food:2,money:1,text:'알티아가 세라에 실제 긴급 지원을 보냈습니다.'},
  {turn:5,type:'accord_breached',accordId:state.peaceAccords[0].id,countryId:'lumen',targetId:'cera',text:'루멘의 위반을 기록했습니다.'},
 ];
 const html=renderPeaceComplianceResults(state);
 assert.match(html,/타국의 자율 대응 결과/);assert.match(html,/실제 동맹 지원 · 식량 2, 국고 1/);assert.match(html,/평화 합의 이행 결과/);
 assert.equal((html.match(/data-peace-response-event="peace_response_aid"/g)??[]).length,1);assert.doesNotMatch(html,/data-peace-compliance-event="peace_response_aid"/);
 assert.match(html,/완료된 이번 분기의 외국 행동/);assert.match(html,/우리 정부의 다음 명령과 비용은 별도로 선택/);
});

test('elapsed foreign proposal is never described as an active agreement or an available reply',()=>{
 const state=createGame('nord',{peaceResponseStartTurn:1});state.turn=6;const item=accord({kind:'renegotiate',initiatorId:'cera',targetId:'lumen',memberIds:['cera'],formedTurn:5,startsTurn:5,untilTurn:7,status:'proposed',offerId:'peace-offer-private',reason:'식량과 물가 압박으로 새 조건을 요청했습니다.'});state.peaceAccords=[item];
 const brief=renderPeaceResponseBrief(state,item),review=renderPeaceResponseReview(state,item);
 assert.match(brief,/회신 기한 종료/);assert.match(review,/회신 가능한 분기가 지났습니다/);assert.match(review,/어떤 지원도 자동 지급되지 않습니다/);assert.doesNotMatch(review,/합의 성립|직접 회신해야/);
 item.foreignResponse.status='settled';const settled=renderPeaceResponseReview(state,item);assert.match(settled,/평화 회복 제안의 처리 결과/);assert.match(settled,/회신 처리가 끝났습니다/);assert.doesNotMatch(settled,/회신 대기|새 합의 성립/);
});

test('renewal correspondence is source-guarded while retaining the existing explicit reply vocabulary',()=>{
 const state=createGame('nord');state.turn=5;state.goalConflicts=[{id:'peace-compliance-private-5',status:'active',peaceComplianceAccordId:'peace-accord-private-5',initiatorId:'cera',targetId:'lumen',sanctionMembers:[],responseMembers:[],startTurn:5,endTurn:8,events:[]}];
 state.peaceOffers=[{id:'peace-offer-private',origin:'peace_response',accordId:'peace-accord-private-5',conflictId:'peace-compliance-private-5',fromId:'cera',createdTurn:5,expiresTurn:8,status:'pending',terms:{conflictId:'peace-compliance-private-5',goal:'peace',condition:'mutual',food:4,money:6},reason:{summary:'위반 뒤 새 평화 조건을 요청했습니다.'},reply:null}];
 const brief=renderPeaceOfferBrief(state),history=renderPeaceOfferHistory(state);
 assert.match(brief,/data-peace-offer-origin="peace-response"/);assert.match(brief,/타국의 평화 회복 제안/);assert.match(brief,/원문과 조건 검토/);
 assert.match(history,/합의 위반 뒤 평화 회복 요청/);assert.match(history,/기존 합의와 이어지는 새 제안/);assert.doesNotMatch(history,/peace-accord-private-5/);
});

test('a canonical foreign renewal opens through the existing controller and keeps accept, change and decline explicit',()=>{
 const state=createGame('nord'),item=accord(null);state.turn=3;item.violation.turn=3;state.peaceAccords=[item];state.countries.cera.food=22;state.countries.cera.price=155;state.relations['cera:lumen']=62;
 const offered=advanceTurn(state,'maintain'),offer=offered.peaceOffers.find(item=>item.origin==='peace_response'),before=structuredClone(offered);assert.ok(offer);
 const strip=renderConflictBrief(offered);assert.equal((strip.match(/class="peace-offer-brief"/g)??[]).length,1);assert.doesNotMatch(strip,/class="peace-compliance-brief peace-response-brief"/);
 const result=renderConflictResults(offered);assert.match(result,/먼저 도착한 평화 제안과 회신/);assert.doesNotMatch(result,/타국의 자율 대응 결과/);
 const review=renderPeaceOfferReview(offered,offer.id);assert.match(review,/타국의 평화 회복 제안/);assert.match(review,/아직 합의가 아니며/);assert.match(review,/수락 시 실제 부담/);
 assert.match(review,/data-response="accept"/);assert.match(review,/data-action="counter-peace-offer"/);assert.match(review,/data-response="decline"/);
 let rerenders=0;const controller=createMediationController({state:()=>offered,resolveAction:command=>getAction(offered,command),decisionContent:()=>({querySelector(){return null;}}),clearCompeting(){},rerender(){rerenders++;},commit(){throw new Error('review must not execute');},focus(){}});
 controller.openOffer(offer.id);assert.match(controller.render(),/외국이 제안한 새 조건/);controller.dispatch('counter-peace-offer',{id:offer.id});assert.match(controller.render(),/도착한 원안/);assert.match(controller.render(),/한 가지 이상 바꿔야 역제안/);assert.match(controller.render(),/id="send-mediation" disabled/);
 assert.equal(rerenders,2);assert.deepEqual(offered,before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderConflictBrief,renderConflictResults,renderConflictWorld} from '../dist/conflict-ui.mjs';
import {renderMediationForm} from '../dist/mediation-ui.mjs';
import {renderPeaceOfferReview,renderPeaceOfferResults} from '../dist/peace-offer-ui.mjs';
import {pendingPeaceOffers,peaceCounterCommand} from '../dist/peace-offers.mjs';

const conflict=()=>({id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:8,duration:6,playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌'});
const world=()=>{
 const state=createGame('nord');state.turn=2;state.goalConflicts=[conflict()];state.conflictCooldownUntil=10;
 state.peaceOffers=[{id:'peace-offer-goal-conflict-cera-lumen-1-2',conflictId:state.goalConflicts[0].id,fromId:'cera',createdTurn:2,expiresTurn:5,status:'pending',terms:{conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:4,money:6},reason:{summary:'식량 압박으로 제재 완화를 요청했습니다.',disputeAge:2,food:43,price:127,need:14,relation:52,affectedTrade:2,goalProgress:1,currentlyAcceptable:true,acceptanceGap:0},reply:null}];
 return state;
};

const naturalOffer=()=>{let state=createGame('lumen');for(let i=0;i<4;i++)state=advanceTurn(state,'maintain');return state;};

test('a later agreement with a foreign counter remains visible after the original reply quarter',()=>{
 const state=naturalOffer(),offer=pendingPeaceOffers(state)[0];
 const reply=advanceTurn(state,peaceCounterCommand({...offer.terms,offerId:offer.id,food:0,money:0}));
 const record=reply.mediations.at(-1);assert.equal(record.status,'countered');
 const settled=advanceTurn(reply,`mediate-accept:${record.id}`);assert.equal(settled.mediations.at(-1).status,'accepted');
 assert.equal(settled.lastPeaceOfferEvents.length,0);
 assert.match(renderConflictResults(settled),/data-mediation-event="mediation_accepted"/);
});

test('accepted changed terms retain their actual recipient transfers and relation deltas in the result',()=>{
 const state=naturalOffer(),offer=pendingPeaceOffers(state)[0];
 const result=advanceTurn(state,peaceCounterCommand({...offer.terms,offerId:offer.id,food:4,money:12}));
 const reply=result.peaceOffers.find(item=>item.id===offer.id).reply;assert.equal(reply.outcome,'accepted');
 const html=renderPeaceOfferResults(result);
 assert.match(html,/회신 조건 ·[^<]*식량 4 · 국고 12/);
 assert.match(html,/배분 · 식량 마린 2 · 노르드 2 · 재정 마린 6 · 노르드 6/);
 assert.match(html,/루멘–마린 관계/);
 assert.match(html,/마린–노르드 관계/);
});

test('a real pending foreign offer appears as one compact executable dispatch',()=>{
 const state=world(),html=renderConflictBrief(state,'decision');
 assert.match(html,/타국 평화 전문 · 1건/);
 assert.match(html,/세라의 교역 제재 완화 요청/);
 assert.match(html,/4분기까지 실행/);
 assert.match(html,/data-action="review-peace-offer"/);
 assert.match(html,/data-id="peace-offer-goal-conflict-cera-lumen-1-2"/);
 assert.doesNotMatch(renderConflictBrief(createGame('nord')),/타국 평화 전문/);
});

test('offer review shows original letter, motives, exact burden, current reactions and three replies',()=>{
 const state=world(),html=renderPeaceOfferReview(state,state.peaceOffers[0].id);
 assert.match(html,/세라 측이 먼저 보낸 협상안/);
 assert.match(html,/식량 압박으로 제재 완화를 요청했습니다/);
 assert.match(html,/도착한 원안/);
 assert.match(html,/제안 당시 합의 전망/);
 assert.match(html,/실제 식량 배분/);
 assert.match(html,/수락 시 실제 부담 · 식량 <strong>4<\/strong> · 국고 <strong>6/);
 assert.match(html,/현재 조건의 예상 결과/);
 assert.match(html,/data-action="peace-offer-reply"[^>]+data-response="accept"/);
 assert.match(html,/data-action="counter-peace-offer"/);
 assert.match(html,/data-response="decline"/);
 assert.match(html,/수락·역제안·거절 회신은 각각 한 분기 명령/);
 assert.equal(state.turn,2);
});

test('counter composer preserves offer context and requires a materially changed term',()=>{
 const state=world(),offer=state.peaceOffers[0],unchanged=renderMediationForm(state,{...offer.terms,offerId:offer.id});
 assert.match(unchanged,/name="offerId" value="peace-offer-goal-conflict-cera-lumen-1-2"/);
 assert.match(unchanged,/도착한 원안/);
 assert.match(unchanged,/우리 역제안/);
 assert.match(unchanged,/한 가지 이상 바꿔야 역제안할 수 있습니다/);
 assert.match(unchanged,/id="send-mediation" disabled>한 가지 이상 조건을 변경하세요/);
 const changed=renderMediationForm(state,{...offer.terms,offerId:offer.id,food:8});
 assert.match(changed,/변경 항목 · 식량/);
 assert.match(changed,/id="send-mediation" >변경 조건을 역제안하고 한 분기 진행/);
});

test('an original disagreement explains the response gap while keeping counter and decline available',()=>{
 const state=world(),offer=state.peaceOffers[0];offer.reason.currentlyAcceptable=false;offer.reason.acceptanceGap=7;state.countries.nord.food=0;
 const html=renderPeaceOfferReview(state,offer.id);
 assert.match(html,/반응 점수 7 보완 필요/);
 assert.match(html,/data-response="accept" disabled>현재 조건으로 수락 불가/);
 assert.match(html,/data-action="counter-peace-offer"/);
 assert.match(html,/data-response="decline"/);
});

test('correspondence result identifies sender, original request, reply outcome and actual cost once',()=>{
 const state=world(),offer=state.peaceOffers[0];
 offer.status='accepted';offer.reply={turn:3,kind:'counter',command:'peace-counter:x',outcome:'accepted',terms:{...offer.terms,food:8},costs:{food:8,money:6},mediationRecordId:'mediation-1',text:'수정안에 합의했습니다.'};
 state.lastPeaceOfferEvents=[{turn:3,type:'peace_offer_accepted',offerId:offer.id,conflictId:offer.conflictId,fromId:'cera',text:'세라 제안에 회신했습니다.',status:'accepted',reply:offer.reply}];
 state.mediations=[{id:'mediation-1',status:'accepted',costs:{food:8,money:6},text:'수정안에 합의했습니다.'}];
 state.lastMediationEvents=[{turn:3,type:'mediation_accepted',recordId:'mediation-1',text:'수정안에 합의했습니다.'}];
 const html=renderConflictResults(state);
 assert.match(html,/세라 · 수정안 합의/);
 assert.match(html,/요청 원안 · 교역 제재 완화/);
 assert.match(html,/우리 회신 · 조건 변경 · 수정안 합의/);
 assert.match(html,/실제 이행 · 식량 8, 국고 6/);
 assert.doesNotMatch(html,/평화 협상 결과/);
});

test('closed offers remain readable in world correspondence without reopening commands',()=>{
 const state=world();state.peaceOffers[0].status='expired';state.turn=5;
 const html=renderConflictWorld(state);
 assert.match(html,/타국이 먼저 보낸 평화 제안/);
 assert.match(html,/세라 → 노르드/);
 assert.match(html,/회신 기한 종료/);
 assert.doesNotMatch(html,/data-action="review-peace-offer"/);
});

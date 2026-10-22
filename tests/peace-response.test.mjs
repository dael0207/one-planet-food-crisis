import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction} from '../dist/engine.mjs';
import {peaceResponseCountryLabel,peaceResponseMarketContext,peaceResponsePairContext,peaceResponsePairs,peaceResponseSummary} from '../dist/peace-response-model.mjs';

const accord=(overrides={})=>({
 id:'peace-accord-cera-lumen-3',conflictId:'goal-conflict-cera-lumen-1',sourceConflictId:'goal-conflict-cera-lumen-1',
 mediationId:'mediation-goal-conflict-cera-lumen-1-2',offerId:null,revisionOf:null,replacedById:null,sourceGoal:'peace',
 terms:{goal:'peace',condition:'mutual',food:0,money:0},principalIds:['cera','lumen'],createdTurn:2,startTurn:3,endTurn:7,
 status:'violated',checks:[],violation:{countryId:'cera',turn:3,reason:'낮은 관계와 수출 목표 충돌',startsTurn:4,untilTurn:6},response:null,foreignResponse:null,events:[],obligation:'상업 교역을 열어 둡니다.',...overrides,
});
const alliance=(overrides={})=>({id:'foreign-lumen-altia-2-alliance',playerId:'lumen',targetId:'altia',kind:'alliance',food:4,money:0,duration:4,status:'active',startTurn:2,endTurn:6,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[],...overrides});
const trade=(overrides={})=>({id:'foreign-cera-altia-2-trade_sell',playerId:'cera',targetId:'altia',kind:'trade_sell',food:4,money:8,duration:4,status:'active',startTurn:2,endTurn:6,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[],...overrides});
const total=(state,key)=>Object.values(state.countries).reduce((sum,country)=>sum+country[key],0);
// Canonical V19 command paths stay frozen so V29 strategy cannot preempt their response fixtures.
const play=(playerId,commands)=>commands.reduce((state,command)=>advanceTurn(state,command),createGame(playerId,{foreignSiteStartTurn:999,foreignStrategyStartTurn:999}));
const naturalRequest=()=>play('lumen',[...Array(32).fill('maintain'),'mediate:goal-conflict-nord-marin-30:relief:mutual:4:12','maintain','maintain']);
const materialCommands=['invest','strategic_reserve','secure_imports','mediate:goal-conflict-cera-lumen-3:peace:mutual:8:6','secure_imports','subsidy','strategic_reserve','mandate_nord_1','secure_imports','maintain','secure_imports','maintain','mediate:goal-conflict-lumen-cera-12:peace:mutual:8:12','secure_imports','maintain','mandate_nord_1','secure_imports','mandate_nord_1','strategic_reserve','maintain','secure_imports','mediate:goal-conflict-lumen-cera-21:relief:mutual:0:0','subsidy','strategic_reserve','maintain','mandate_nord_2','maintain','maintain','subsidy','mandate_nord_2','mediate:goal-conflict-cera-lumen-30:peace:target:8:6','maintain','maintain','mandate_nord_2','secure_imports','maintain','subsidy','maintain','subsidy','mediate:goal-conflict-cera-lumen-39:peace:target:8:0','secure_imports','strategic_reserve','strategic_reserve','maintain','mandate_nord_1','maintain','mandate_nord_1','strategic_reserve','mediate:goal-conflict-cera-lumen-48:peace:mutual:8:12','strategic_reserve','strategic_reserve','strategic_reserve','subsidy','strategic_reserve','subsidy','maintain','mandate_nord_1','mediate:goal-conflict-cera-lumen-57:peace:target:8:0','secure_imports','mandate_nord_1','strategic_reserve','strategic_reserve','subsidy','maintain','secure_imports','maintain','mediate:goal-conflict-cera-lumen-66:peace:mutual:8:12','maintain','mandate_nord_2','maintain','secure_imports','mandate_nord_1','strategic_reserve','strategic_reserve','secure_imports','mediate:goal-conflict-lumen-cera-75:peace:mutual:8:6','strategic_reserve','maintain','strategic_reserve','strategic_reserve','secure_imports','secure_imports','mandate_nord_1','maintain','mediate:goal-conflict-lumen-cera-84:peace:mutual:8:6','secure_imports','maintain'];

test('V19 games validate and persist the response activation marker',()=>{
 const state=createGame('nord',{peaceResponseStartTurn:4});
 assert.equal(state.version,13);assert.equal(state.peaceResponseStartTurn,4);
 assert.throws(()=>createGame('nord',{peaceResponseStartTurn:0}),/평화 위반 대응/);
});

test('a victim and only its active qualifying foreign allies sanction before commerce for three executions',()=>{
 const state=createGame('nord',{foreignSiteStartTurn:999});state.turn=3;state.conflictCooldownUntil=99;state.peaceAccords=[accord()];state.foreignTreaties=[alliance(),trade({endTurn:10})];
 state.relations['altia:lumen']=80;state.relations['altia:cera']=30;state.relations['cera:lumen']=20;
 const next=advanceTurn(state,'maintain'),response=next.peaceAccords[0].foreignResponse,route=next.foreignTreaties.find(item=>item.id===trade().id);
 assert.deepEqual(response.memberIds,['lumen','altia']);assert.equal(response.kind,'sanction');assert.equal(response.startsTurn,4);assert.equal(response.untilTurn,7);assert.equal(response.status,'active');
 assert.equal(route.lastOutcome.type,'suspended');assert.ok(next.history.at(-1).worldActions.some(item=>item.source==='peace_response'&&item.type==='peace_response_sanction'));
 assert.deepEqual(peaceResponsePairs(next).map(({fromId,toId})=>[fromId,toId]),[['lumen','cera'],['altia','cera']]);
 assert.equal(peaceResponsePairContext(next,'altia','cera','trade_sell').scoreDelta,-100);
 assert.equal(peaceResponseMarketContext(next,'cera','buy').scoreDelta,8);assert.equal(peaceResponseMarketContext(next,'altia','buy').scoreDelta,-32);assert.equal(peaceResponseMarketContext(next,'altia','sell').scoreDelta,8);
 assert.equal(getAction({...next,playerId:'altia'},'propose:cera:sell:2:6').preview.response,'reject');
 assert.match(peaceResponseCountryLabel(next,'altia'),/연대/);assert.match(peaceResponseCountryLabel(next,'cera'),/대상/);
 assert.deepEqual(peaceResponseSummary(next,next.peaceAccords[0]).memberNames,['루멘','알티아']);
 let current=next;for(let turn=5;turn<=6;turn++){current=advanceTurn(current,'maintain');assert.ok(current.history.at(-1).worldActions.some(item=>item.type==='sanction'&&item.countryId==='cera'&&item.targetId==='altia'));}assert.equal(peaceResponsePairs(current).length,2);
 current=advanceTurn(current,'maintain');assert.equal(peaceResponsePairs(current).length,0);assert.equal(current.peaceAccords[0].foreignResponse.status,'expired');assert.equal(peaceResponseMarketContext(current,'cera','buy').scoreDelta,0);assert.equal(peaceResponseMarketContext(current,'altia','sell').scoreDelta,0);assert.ok(current.history.at(-1).worldActions.some(item=>item.source==='foreign_treaty'&&item.type==='trade'));
});

test('coalition aid uses real member stock and humanitarian negotiation remains exempt',()=>{
 const state=createGame('nord');state.turn=3;state.peaceAccords=[accord()];state.foreignTreaties=[alliance()];state.relations['altia:lumen']=80;state.relations['altia:cera']=30;state.relations['cera:lumen']=20;
 state.countries.lumen.food=39;state.countries.altia.food=80;
 const food=total(state,'food'),money=total(state,'treasury'),next=advanceTurn(state,'maintain'),aid=next.history.at(-1).worldActions.find(item=>item.type==='peace_response_aid');
 assert.ok(aid.food>0);assert.equal(aid.countryId,'altia');assert.equal(aid.targetId,'lumen');assert.equal(total(next,'food')-total(advanceTurn(structuredClone(state),'maintain'),'food'),0);assert.equal(total(next,'treasury'),total(advanceTurn(structuredClone(state),'maintain'),'treasury'));
 assert.deepEqual(peaceResponseMarketContext(next,'cera','aid_out'),{scoreDelta:0,reasons:[]});assert.equal(food<=total(next,'food')+100,true);assert.equal(money<=total(next,'treasury')+100,true);
});

test('a later player sanction keeps the accord open through the maximum independent deadline',()=>{
 const state=createGame('nord');state.turn=3;state.peaceAccords=[accord()];state.relations['cera:lumen']=20;
 let current=advanceTurn(state,'maintain'),id=current.peaceAccords[0].id;assert.equal(current.peaceAccords[0].foreignResponse.untilTurn,7);
 current=advanceTurn(current,`peace-compliance:${id}:sanction`);assert.equal(current.peaceAccords[0].response.untilTurn,8);
 current=advanceTurn(current,'maintain');current=advanceTurn(current,'maintain');assert.equal(current.turn,7);assert.equal(current.peaceAccords[0].status,'sanctioned');assert.equal(current.peaceAccords[0].foreignResponse.status,'expired');
 current=advanceTurn(current,'maintain');assert.equal(current.turn,8);assert.equal(current.peaceAccords[0].status,'completed');
});

test('foreign pressure creates a real unanswered peace offer and declining cleans its synthetic conflict',()=>{
 const state=createGame('nord');state.turn=3;state.peaceAccords=[accord()];state.countries.lumen.food=22;state.countries.lumen.price=155;state.relations['cera:lumen']=62;
 const offered=advanceTurn(state,'maintain'),response=offered.peaceAccords[0].foreignResponse,offer=offered.peaceOffers.find(item=>item.id===response.offerId),conflict=offered.goalConflicts.find(item=>item.id===offer.conflictId);
 assert.equal(response.kind,'renegotiate');assert.equal(response.status,'proposed');assert.equal(offer.origin,'peace_response');assert.equal(offer.accordId,state.peaceAccords[0].id);assert.equal(conflict.peaceComplianceAccordId,state.peaceAccords[0].id);
 const action=getAction(offered,`peace-reply:${offer.id}:decline`);assert.equal(action.cost,0);assert.equal(action.foodCost,0);
 const declined=advanceTurn(offered,action.id),closed=declined.goalConflicts.find(item=>item.id===conflict.id);
 assert.equal(declined.peaceOffers.find(item=>item.id===offer.id).status,'declined');assert.equal(declined.peaceAccords[0].foreignResponse.status,'settled');assert.notEqual(closed.status,'active');
});

test('prospective foreign response changes negotiation context without mutating review state',()=>{
 const state=createGame('nord');state.turn=3;state.peaceAccords=[accord()];state.foreignTreaties=[alliance(),trade()];state.relations['altia:lumen']=80;state.relations['altia:cera']=30;state.relations['cera:lumen']=20;
 const before=structuredClone(state),context=peaceResponseMarketContext(state,'cera','buy'),action=getAction(state,'propose:cera:buy:2:6');
 assert.notEqual(context.scoreDelta,0);assert.ok(context.reasons.length>0);assert.ok(action.preview.reasons.some(reason=>reason.includes('평화')));assert.deepEqual(state,before);
});

test('a stored response does not shift a separate forecast across treaty boundaries',()=>{
 const stored=accord({id:'stored',foreignResponse:{kind:'sanction',initiatorId:'lumen',targetId:'cera',memberIds:['lumen'],reason:'stored',formedTurn:3,startsTurn:3,untilTurn:6,status:'active',offerId:null}});
 const forecast=accord({id:'forecast',principalIds:['marin','solis'],violation:{countryId:'solis',turn:3,reason:'forecast',startsTurn:4,untilTurn:6}}),state=createGame('nord');state.turn=3;state.peaceAccords=[stored,forecast];state.relations['marin:solis']=20;
 state.foreignTreaties=[trade({id:'forecast-route',playerId:'marin',targetId:'solis',startTurn:4,endTurn:6})];
 assert.equal(peaceResponseMarketContext(state,'marin','buy').scoreDelta,8);
 state.foreignTreaties[0].endTurn=4;assert.equal(peaceResponseMarketContext(state,'marin','buy').scoreDelta,0);
});

test('response kind is planned from the before-state even when the player gives humanitarian aid',()=>{
 const state=createGame('nord');state.turn=3;state.peaceAccords=[accord()];state.countries.lumen.food=34;state.countries.lumen.price=130;state.relations['cera:lumen']=20;
 const action=getAction(state,'propose:lumen:aid_out:8:0');assert.equal(action.preview.response,'accept');
 const next=advanceTurn(state,action.id),response=next.peaceAccords[0].foreignResponse;assert.equal(next.countries.lumen.food>state.countries.lumen.food,true);assert.equal(response.kind,'renegotiate');
});

test('canonical unmodified campaigns naturally reach solo, allied, and negotiation responses',()=>{
 const solo=play('altia',[...Array(3).fill('maintain'),'mediate:goal-conflict-cera-lumen-3:relief:mutual:8:12','maintain','maintain']),soloResponse=solo.peaceAccords.find(item=>item.foreignResponse).foreignResponse;
 assert.equal(soloResponse.kind,'sanction');assert.equal(soloResponse.memberIds.length,1);
 const joint=play('nord',[...Array(30).fill('maintain'),'mediate:goal-conflict-cera-lumen-30:relief:mutual:0:6','maintain','maintain']),jointResponse=joint.peaceAccords.find(item=>item.foreignResponse).foreignResponse;
 assert.equal(jointResponse.kind,'sanction');assert.deepEqual(jointResponse.memberIds,['lumen','altia']);assert.ok(joint.foreignTreaties.some(item=>item.id==='foreign-lumen-altia-29-alliance'&&item.startTurn<=jointResponse.startsTurn&&item.endTurn>jointResponse.startsTurn&&item.resolvedTurn===jointResponse.startsTurn));
 const request=play('lumen',[...Array(32).fill('maintain'),'mediate:goal-conflict-nord-marin-30:relief:mutual:4:12','maintain','maintain']),requestAccord=request.peaceAccords.find(item=>item.foreignResponse),requestResponse=requestAccord.foreignResponse;
 assert.equal(requestResponse.kind,'renegotiate');assert.equal(requestResponse.status,'proposed');assert.ok(request.peaceOffers.some(item=>item.id===requestResponse.offerId&&item.origin==='peace_response'&&item.accordId===requestAccord.id));
});

test('acceptance replaces the old accord before commerce and a counter remains cost-free until fresh acceptance',()=>{
 const offered=naturalRequest(),old=offered.peaceAccords.find(item=>item.foreignResponse),offer=offered.peaceOffers.find(item=>item.id===old.foreignResponse.offerId),accept=`peace-reply:${offer.id}:accept`,acceptAction=getAction(offered,accept);
 assert.equal(acceptAction.mediationPreview.outcome,'accepted');
 const accepted=advanceTurn(offered,accept),replaced=accepted.peaceAccords.find(item=>item.id===old.id),revision=accepted.peaceAccords.find(item=>item.revisionOf===old.id);
 assert.equal(replaced.status,'replaced');assert.equal(replaced.foreignResponse.status,'settled');assert.equal(replaced.foreignResponse.untilTurn,accepted.turn);assert.equal(revision.status,'monitoring');assert.equal(peaceResponsePairs(accepted).length,0);
 const fresh=naturalRequest(),freshOld=fresh.peaceAccords.find(item=>item.foreignResponse),freshOffer=fresh.peaceOffers.find(item=>item.id===freshOld.foreignResponse.offerId),unchanged=`peace-counter:${freshOffer.id}:${freshOffer.terms.goal}:${freshOffer.terms.condition}:${freshOffer.terms.food}:${freshOffer.terms.money}`,counter=`peace-counter:${freshOffer.id}:relief:mutual:0:0`;
 assert.equal(getAction(fresh,unchanged),null);const counterAction=getAction(fresh,counter);assert.equal(counterAction.cost,0);assert.equal(counterAction.foodCost,0);assert.equal(counterAction.mediationPreview.outcome,'countered');
 const countered=advanceTurn(fresh,counter);assert.equal(countered.peaceAccords.find(item=>item.id===freshOld.id).foreignResponse.status,'proposed');
 const expired=advanceTurn(countered,'maintain'),expiredResponse=expired.peaceAccords.find(item=>item.id===freshOld.id).foreignResponse;
 assert.equal(expiredResponse.status,'expired');assert.ok(!expired.goalConflicts.some(item=>item.peaceComplianceAccordId===freshOld.id&&item.status==='active'));
});

test('a canonical campaign exposes newly available seller capacity from a suspended obligation',()=>{
 const state=play('nord',materialCommands),accord=state.peaceAccords.find(item=>item.foreignResponse?.formedTurn===87),route=state.foreignTreaties.find(item=>item.id==='foreign-lumen-cera-85-trade_sell'),context=peaceResponseMarketContext(state,'lumen','buy');
 assert.equal(accord.foreignResponse.kind,'sanction');assert.equal(route.lastOutcome.type,'suspended');assert.equal(route.lastOutcome.turn,87);assert.notEqual(context.scoreDelta,0);assert.ok(context.reasons.length>0);
 assert.ok(state.history.at(-1).worldActions.some(item=>item.source==='peace_response'&&item.type==='sanction'&&item.conflictSuspension));
 const without=materialCommands.reduce((current,command)=>advanceTurn(current,command),createGame('nord',{peaceResponseStartTurn:999,foreignSiteStartTurn:999,foreignStrategyStartTurn:999})),baseline=without.foreignTreaties.find(item=>item.id===route.id);
 assert.equal(baseline.lastOutcome.type,'suspended');assert.equal(peaceResponseMarketContext(without,'lumen','buy').scoreDelta,0);assert.equal(total(state,'food'),total(without,'food'));assert.equal(total(state,'treasury'),total(without,'treasury'));
});

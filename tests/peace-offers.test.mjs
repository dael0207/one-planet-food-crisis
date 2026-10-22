import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,advanceTurn,createGame,getAction,pendingPeaceOffers,peaceCounterCommand,peaceOfferPreview,peaceReplyCommand} from '../dist/engine.mjs';

const run=(state,count,command='maintain')=>{for(let i=0;i<count;i++)state=advanceTurn(state,command);return state;};
const offered=(playerId='lumen')=>run(createGame(playerId,{foreignSiteStartTurn:999}),4);

test('all six campaigns receive deterministic foreign offers driven by live conflicts',()=>{
 const goals=new Set(),needs=new Set(),relations=new Set();
 for(const playerId of COUNTRY_IDS){
  const state=offered(playerId),offers=pendingPeaceOffers(state);assert.equal(offers.length,1,playerId);
  const offer=offers[0],conflict=state.goalConflicts.find(item=>item.id===offer.conflictId);goals.add(offer.terms.goal);
  assert.ok([conflict.initiatorId,conflict.targetId].includes(offer.fromId));assert.notEqual(offer.fromId,playerId);
  assert.equal(offer.createdTurn,conflict.formedTurn+1);assert.equal(offer.expiresTurn,offer.createdTurn+3);assert.ok(offer.expiresTurn<=conflict.endTurn);
  assert.equal(typeof offer.reason.summary,'string');for(const key of ['disputeAge','food','price','need','relation','affectedTrade','goalProgress','acceptanceGap'])assert.equal(typeof offer.reason[key],'number',key);assert.equal(typeof offer.reason.currentlyAcceptable,'boolean');needs.add(offer.reason.need);relations.add(offer.reason.relation);
  assert.ok(peaceReplyCommand(offer.id,'decline').length<160);
 }
 assert.deepEqual([...goals].sort(),['peace','relief']);
 assert.ok(needs.size>1);assert.ok(relations.size>1);
});

test('forming an offer transfers no resource and preserves pre-V17 simulation behind its marker',()=>{
 const active=offered('lumen'),fenced=run(createGame('lumen',{peaceOfferStartTurn:5,foreignSiteStartTurn:999}),4);
 assert.deepEqual(active.countries,fenced.countries);assert.deepEqual(active.relations,fenced.relations);assert.deepEqual(active.mediations,[]);
 assert.equal(active.history.flatMap(item=>item.worldActions).some(item=>item.type==='mediation_transfer'),false);
 assert.equal(fenced.peaceOffers.length,0);
});

test('acceptance revalidates authoritative mediation costs and records actual effects',()=>{
 const state=offered(),offer=pendingPeaceOffers(state)[0],preview=peaceOfferPreview(state,offer.id),command=peaceReplyCommand(offer.id,'accept'),action=getAction(state,command);
 assert.equal(preview.canAccept,true);assert.equal(action.mediationPreview.outcome,'accepted');
 const next=advanceTurn(state,command),record=next.mediations.find(item=>item.id===next.peaceOffers.at(-1).reply.mediationRecordId),reply=next.peaceOffers.at(-1).reply;
 assert.equal(next.peaceOffers.at(-1).status,'accepted');assert.deepEqual(reply.costs,record.costs);assert.deepEqual(reply.costs,{food:action.foodCost,money:action.cost});
 assert.ok(reply.relationChanges.length);assert.equal(next.goalConflicts.find(item=>item.id===offer.conflictId).ceasefireStartTurn,next.turn);
 assert.ok(next.history.at(-1).worldActions.filter(item=>item.type.startsWith('mediation_')).every(item=>item.source==='peace_offer'));
});

test('declining costs no aid or hidden relation penalty while ordinary simulation continues',()=>{
 const state=offered(),offer=pendingPeaceOffers(state)[0],declined=advanceTurn(state,peaceReplyCommand(offer.id,'decline')),maintained=advanceTurn(state,'maintain');
 assert.deepEqual(declined.countries,maintained.countries);assert.deepEqual(declined.relations,maintained.relations);
 assert.equal(declined.peaceOffers.at(-1).status,'declined');assert.deepEqual(declined.peaceOffers.at(-1).reply.costs,{food:0,money:0});assert.deepEqual(declined.peaceOffers.at(-1).reply.relationChanges,[]);
 assert.equal(declined.lastPeaceOfferEvents[0].type,'peace_offer_declined');
});

test('meaningful counteroffers use mediation outcomes without charging before agreement',()=>{
 const state=offered(),offer=pendingPeaceOffers(state)[0];
 const counteredCommand=peaceCounterCommand({offerId:offer.id,conflictId:offer.conflictId,goal:'relief',condition:'mutual',food:0,money:0});
 assert.equal(getAction(state,counteredCommand).mediationPreview.outcome,'countered');
 const countered=advanceTurn(state,counteredCommand),counterReply=countered.peaceOffers.at(-1).reply;
 assert.equal(countered.peaceOffers.at(-1).status,'countered');assert.deepEqual(counterReply.costs,{food:0,money:0});assert.equal(countered.mediations.at(-1).status,'countered');
 const escalatedCommand=peaceCounterCommand({offerId:offer.id,conflictId:offer.conflictId,goal:'peace',condition:'target',food:0,money:0}),beforeEnd=state.goalConflicts.find(item=>item.id===offer.conflictId).endTurn;
 const escalated=advanceTurn(state,escalatedCommand);assert.equal(escalated.peaceOffers.at(-1).status,'escalated');assert.equal(escalated.peaceOffers.at(-1).reply.costs.food,0);assert.equal(escalated.goalConflicts.find(item=>item.id===offer.conflictId).endTurn,beforeEnd+2);
 const acceptedCommand=peaceCounterCommand({offerId:offer.id,conflictId:offer.conflictId,goal:'relief',condition:'mutual',food:4,money:12}),acceptedAction=getAction(state,acceptedCommand),accepted=advanceTurn(state,acceptedCommand);
 assert.equal(acceptedAction.mediationPreview.outcome,'accepted');assert.deepEqual(accepted.peaceOffers.at(-1).reply.costs,{food:acceptedAction.foodCost,money:acceptedAction.cost});
 assert.equal(getAction(state,peaceCounterCommand({offerId:offer.id,conflictId:offer.conflictId,...offer.terms})),null);
});

test('exclusive reply cutoff exposes exactly two execution quarters then expires',()=>{
 const turn4=offered(),offer=turn4.peaceOffers[0],decline=peaceReplyCommand(offer.id,'decline');assert.ok(getAction(turn4,decline));
 const turn5=advanceTurn(turn4,'maintain');assert.ok(getAction(turn5,decline));assert.equal(peaceOfferPreview(turn5,offer.id).lastReplyTurn,6);
 const turn6=advanceTurn(turn5,'maintain');assert.equal(getAction(turn6,decline),null);assert.equal(turn6.peaceOffers.find(item=>item.id===offer.id).status,'expired');assert.equal(turn6.lastPeaceOfferEvents[0].type,'peace_offer_expired');
});

test('unexecutable offers cancel when conflict state changes and records remain bounded',()=>{
 const state=offered(),offer=state.peaceOffers[0];state.goalConflicts.find(item=>item.id===offer.conflictId).status='resolved';
 const cancelled=advanceTurn(state,'maintain');assert.equal(cancelled.peaceOffers.find(item=>item.id===offer.id).status,'cancelled');assert.equal(cancelled.lastPeaceOfferEvents[0].type,'peace_offer_cancelled');
 const long=run(createGame('nord'),120);assert.ok(long.peaceOffers.length<=16);assert.ok(long.peaceOffers.every(item=>item.id.length<160));
});

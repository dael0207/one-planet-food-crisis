import {COUNTRIES} from './country-data.mjs?v=30';
import {createPeaceResponseOffer} from './peace-offers.mjs?v=30';
import {peaceResponseDecision,peaceResponseEnabled} from './peace-response-model.mjs?v=30';

const record=(state,accord,event,actions)=>{
 state.lastPeaceComplianceEvents.push(event);accord.events=[...(accord.events??[]),structuredClone(event)].slice(-20);actions.push({...event,source:'peace_response'});
};

function declare(state,before,accord,actions){
 const decision=peaceResponseDecision({...before,turn:state.turn,peaceResponseStartTurn:state.peaceResponseStartTurn},accord,state.turn);if(!decision)return;
 if(decision.kind==='sanction'){
  accord.foreignResponse={...decision,formedTurn:state.turn,startsTurn:state.turn,untilTurn:state.turn+3,status:'active',offerId:null};
  const text=`${COUNTRIES[decision.initiatorId].name}이 ${COUNTRIES[decision.targetId].name}의 평화 합의 위반에 3회 실행 상업 제재를 선언했습니다. 참여국: ${decision.memberIds.map(id=>COUNTRIES[id].name).join(' · ')}. ${decision.reason}`;
  record(state,accord,{turn:state.turn,type:'peace_response_sanction',accordId:accord.id,countryId:decision.initiatorId,targetId:decision.targetId,memberIds:[...decision.memberIds],startsTurn:state.turn,untilTurn:state.turn+3,text},actions);return;
 }
 const offer=createPeaceResponseOffer(state,accord,decision.initiatorId,actions);if(!offer)return;
 accord.foreignResponse={...decision,formedTurn:state.turn,startsTurn:state.turn,untilTurn:offer.expiresTurn,status:'proposed',offerId:offer.id};
 const text=`${COUNTRIES[decision.initiatorId].name}이 평화 합의 재협상을 요청했습니다. ${decision.reason}`;
 record(state,accord,{turn:state.turn,type:'peace_response_proposed',accordId:accord.id,countryId:decision.initiatorId,targetId:decision.targetId,memberIds:[decision.initiatorId],offerId:offer.id,startsTurn:state.turn,untilTurn:offer.expiresTurn,text},actions);
}

function expire(state,accord,actions){
 const response=accord.foreignResponse;if(response?.kind!=='sanction'||response.status!=='active'||state.turn<response.untilTurn)return false;
 response.status='expired';const text=`${COUNTRIES[response.initiatorId].name} 주도의 평화 위반 상업 제재가 3회 실행 뒤 종료됐습니다.`;
 record(state,accord,{turn:state.turn,type:'peace_response_expired',accordId:accord.id,countryId:response.initiatorId,targetId:response.targetId,memberIds:[...response.memberIds],text},actions);return true;
}

function support(state,accord,actions){
 const response=accord.foreignResponse,victim=state.countries[response.initiatorId];if(response.kind!=='sanction'||response.status!=='active'||state.turn<response.startsTurn||state.turn>=response.untilTurn||victim.food>=40)return;
 const donorId=response.memberIds.slice(1).find(id=>state.countries[id].food>45);if(!donorId)return;
 const donor=state.countries[donorId],food=Math.min(2,donor.food-40,100-victim.food),money=victim.treasury<20?Math.min(1,Math.max(0,donor.treasury-30),100-victim.treasury):0;if(food<=0&&!money)return;
 donor.food-=food;victim.food+=food;donor.treasury-=money;victim.treasury+=money;
 const text=`${COUNTRIES[donorId].name}이 압박받는 ${COUNTRIES[response.initiatorId].name}에 식량 ${food}${money?`·지원금 ${money}`:''}을 보냈습니다.`;
 record(state,accord,{turn:state.turn,type:'peace_response_aid',accordId:accord.id,countryId:donorId,targetId:response.initiatorId,memberIds:[...response.memberIds],food,money,text},actions);
}

export function runPeaceResponses(state,before,actions=[]){
 if(!peaceResponseEnabled(state))return;state.lastPeaceComplianceEvents??=[];
 for(const accord of state.peaceAccords??[]){
  if(expire(state,accord,actions))continue;
  if(!accord.foreignResponse&&accord.violation&&accord.violation.turn<state.turn)declare(state,before,accord,actions);
  if(accord.foreignResponse?.kind==='sanction')support(state,accord,actions);
 }
}

export function finishPeaceResponses(state,actions=[]){
 for(const accord of state.peaceAccords??[]){
  const response=accord.foreignResponse;if(response?.kind!=='renegotiate'||response.status!=='proposed')continue;
  const offer=(state.peaceOffers??[]).find(item=>item.id===response.offerId),mediationRecord=(state.mediations??[]).find(item=>item.id===offer?.reply?.mediationRecordId);if(!mediationRecord||!['expired','cancelled','rejected','escalated'].includes(mediationRecord.status))continue;
  response.status=mediationRecord.status==='expired'?'expired':'settled';response.untilTurn=state.turn;const conflict=(state.goalConflicts??[]).find(item=>item.id===offer.conflictId);if(conflict?.status==='active'){conflict.status=response.status;conflict.resolvedTurn=state.turn;}
  const text=`${COUNTRIES[response.initiatorId].name}의 평화 합의 재협상 절차가 ${response.status==='expired'?'기한 만료':'합의 없이'} 종료됐습니다.`;
  record(state,accord,{turn:state.turn,type:`peace_response_${response.status}`,accordId:accord.id,offerId:offer.id,countryId:response.initiatorId,targetId:response.targetId,text},actions);
 }
}

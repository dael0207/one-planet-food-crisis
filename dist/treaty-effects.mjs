import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=31';
import {adjustRelation,getRelation} from './negotiations.mjs?v=31';

const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
export const ensureTreatyState=state=>{
 state.treaties??=[];state.lastTreatyEvents??=[];state.reliability??=Object.fromEntries(COUNTRY_IDS.map(id=>[id,70]));
 for(const id of COUNTRY_IDS)if(!Number.isFinite(state.reliability[id]))state.reliability[id]=70;
};
export const changeReliability=(state,id,delta)=>{ensureTreatyState(state);state.reliability[id]=clamp(state.reliability[id]+delta);};

export function treatyEvent(state,treaty,type,text,data={}){
 const targetId=treaty.targetId===state.playerId?treaty.playerId:treaty.targetId;
 const event={treatyId:treaty.id,targetId,turn:state.turn,type,text,relationBefore:getRelation(state,treaty.playerId,treaty.targetId),relationAfter:getRelation(state,treaty.playerId,treaty.targetId),...data};
 state.lastTreatyEvents.push(event);treaty.events=[...(treaty.events??[]),event].slice(-12);treaty.lastOutcome=event;
 return event;
}

export function rewardFulfillment(state,treaty,actorId,otherActorId){
 const relationBefore=getRelation(state,treaty.playerId,treaty.targetId),reliabilityBefore=state.reliability[actorId];
 adjustRelation(state,treaty.playerId,treaty.targetId,1);changeReliability(state,actorId,1);
 const otherReliabilityBefore=otherActorId?state.reliability[otherActorId]:undefined;if(otherActorId)changeReliability(state,otherActorId,1);
 return {actorId,relationBefore,relationAfter:getRelation(state,treaty.playerId,treaty.targetId),reliabilityBefore,reliabilityAfter:state.reliability[actorId],...(otherActorId?{otherActorId,otherReliabilityBefore,otherReliabilityAfter:state.reliability[otherActorId]}:{})};
}

export function punishBreach(state,treaty,responsibleId,actions){
 const otherId=responsibleId===treaty.playerId?treaty.targetId:treaty.playerId,relationBefore=getRelation(state,treaty.playerId,treaty.targetId),reliabilityBefore=state.reliability[responsibleId];
 adjustRelation(state,treaty.playerId,treaty.targetId,-5);changeReliability(state,responsibleId,-6);
 const observers=COUNTRY_IDS.filter(id=>id!==responsibleId&&id!==otherId).map(countryId=>{
  adjustRelation(state,countryId,responsibleId,-1);const text=`${COUNTRIES[countryId].name} 측은 ${COUNTRIES[responsibleId].name} 측의 약속 불이행을 경계했습니다.`;
  actions.push({countryId,targetId:responsibleId,type:'reaction',source:'treaty',text});return {countryId,text,delta:-1};
 });
 return {actorId:responsibleId,relationBefore,relationAfter:getRelation(state,treaty.playerId,treaty.targetId),reliabilityBefore,reliabilityAfter:state.reliability[responsibleId],observers};
}

export function completeTreaty(state,treaty,actions){
 treaty.status='completed';const relationBefore=getRelation(state,treaty.playerId,treaty.targetId);
 if(treaty.breaches){const text=`${COUNTRIES[treaty.playerId].name} · ${COUNTRIES[treaty.targetId].name} 양국의 협정 기간이 끝났지만 ${treaty.breaches}회 불이행 기록이 남았습니다.`;const event=treatyEvent(state,treaty,'completed',text,{relationBefore,relationAfter:relationBefore});actions.push({countryId:treaty.playerId,targetId:treaty.targetId,type:'expiry',source:'treaty',text});return event;}
 adjustRelation(state,treaty.playerId,treaty.targetId,3);changeReliability(state,treaty.playerId,2);changeReliability(state,treaty.targetId,2);
 const observers=COUNTRY_IDS.filter(id=>id!==treaty.playerId&&id!==treaty.targetId).map(countryId=>{
  adjustRelation(state,countryId,treaty.playerId,1);adjustRelation(state,countryId,treaty.targetId,1);
  const text=`${COUNTRIES[countryId].name} 측은 ${COUNTRIES[treaty.playerId].name} · ${COUNTRIES[treaty.targetId].name} 양국의 협정 완수를 높이 평가했습니다.`;
  actions.push({countryId,targetId:treaty.playerId,type:'reaction',source:'treaty',text});return {countryId,text,delta:1};
 });
 const text=`${COUNTRIES[treaty.playerId].name} · ${COUNTRIES[treaty.targetId].name} 양국의 협정이 약속된 기간을 마쳤습니다.`;
 const event=treatyEvent(state,treaty,'completed',text,{relationBefore,relationAfter:getRelation(state,treaty.playerId,treaty.targetId),observers});
 actions.push({countryId:treaty.playerId,targetId:treaty.targetId,type:'expiry',source:'treaty',text});return event;
}

export function breakTreaty(state,treaty,breakerId,actions){
 const otherId=breakerId===treaty.playerId?treaty.targetId:treaty.playerId,relationBefore=getRelation(state,treaty.playerId,treaty.targetId),reliabilityBefore=state.reliability[breakerId];
 treaty.status='broken';treaty.resolvedTurn=state.turn;adjustRelation(state,treaty.playerId,treaty.targetId,-12);changeReliability(state,breakerId,-12);
 const observers=COUNTRY_IDS.filter(id=>id!==breakerId&&id!==otherId).map(countryId=>{
  adjustRelation(state,countryId,breakerId,-2);const text=`${COUNTRIES[countryId].name} 측은 ${COUNTRIES[breakerId].name} 측의 협정 파기를 공개적으로 우려했습니다.`;
  actions.push({countryId,targetId:breakerId,type:'reaction',source:'treaty',text});return {countryId,text,delta:-2};
 });
 const text=`${COUNTRIES[breakerId].name} 측이 ${COUNTRIES[otherId].name} 측과의 협정을 자발적으로 파기했습니다.`;
 const event=treatyEvent(state,treaty,'broken',text,{actorId:breakerId,relationBefore,relationAfter:getRelation(state,treaty.playerId,treaty.targetId),reliabilityBefore,reliabilityAfter:state.reliability[breakerId],observers});
 actions.push({countryId:breakerId,targetId:otherId,type:'treaty',source:'treaty',text});return event;
}

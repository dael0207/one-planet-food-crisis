import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';
import {goalPairAffinity} from './goal-relations.mjs?v=30';
import {getRelation} from './negotiations.mjs?v=30';

export const ACCORD_ID=/^peace-accord-[a-z0-9-]+-\d+$/;
export const TERMS={goals:['relief','peace'],conditions:['mutual','target'],food:[0,4,8],money:[0,6,12]};
export const enabled=state=>Number.isSafeInteger(state?.peaceComplianceStartTurn)&&state.turn>=state.peaceComplianceStartTurn;
export const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));

export function parseDraft(value){
 if(!value||typeof value!=='object'||!TERMS.goals.includes(value.goal)||!TERMS.conditions.includes(value.condition)||!TERMS.food.includes(value.food)||!TERMS.money.includes(value.money))return null;
 return {goal:value.goal,condition:value.condition,food:value.food,money:value.money};
}
export function accordById(state,id){return (state.peaceAccords??[]).find(item=>item.id===id)??null;}
export function otherPrincipal(accord,countryId){return accord.principalIds.find(id=>id!==countryId)??null;}
export function obligation(terms){return terms.goal==='peace'?'종결한 제재와 공동 대응을 재개하지 않고 상업 교역을 열어 둡니다.':'합의된 휴전 기간에 상업 제재와 공동 대응을 중단합니다.';}
export function accordId(conflictId,turn){return `peace-accord-${conflictId.replace(/^goal-conflict-/,'')}-${turn}`;}
export function syntheticConflictId(accord,turn){return `goal-conflict-${accord.principalIds[0]}-${accord.principalIds[1]}-${1000000+turn}`;}

export function complianceAssessment(state,accord,countryId){
 const otherId=otherPrincipal(accord,countryId),country=state.countries[countryId],pairRelation=getRelation(state,countryId,otherId),mediatorRelation=getRelation(state,state.playerId,countryId),reliability=state.reliability?.[countryId]??70;
 const foodPressure=Math.max(0,45-country.food)*1.2,pricePressure=Math.max(0,country.price-125)*.35,goal=goalPairAffinity(state,countryId,otherId,'alliance');
 const score=Math.round(58+(pairRelation-50)*.25+(mediatorRelation-50)*.12+(reliability-50)*.35+goal.scoreDelta-foodPressure-pricePressure);
 const reasons=[];
 if(foodPressure)reasons.push(`식량 ${Math.round(country.food)}의 압박`);if(pricePressure)reasons.push(`물가 ${Math.round(country.price)}의 압박`);
 if(pairRelation<45)reasons.push(`상대국 관계 ${pairRelation}`);if(mediatorRelation<45)reasons.push(`중재국 관계 ${mediatorRelation}`);if(reliability<55)reasons.push(`약속 신뢰 ${reliability}`);if(goal.scoreDelta<0)reasons.push('경쟁하는 국가 목표');
 return {countryId,otherId,score,reason:reasons.length?`${reasons.join(' · ')} 때문에 합의 이행 의지가 약해졌습니다.`:'현재 자원·관계·약속 신뢰가 합의를 지킬 수 있는 수준입니다.',pairRelation,mediatorRelation,reliability};
}

export function activeRestriction(state,a,b){
 if(!a||!b||a===b||!enabled(state))return null;
 for(const accord of state.peaceAccords??[]){
  const violation=accord.violation;if(!violation)continue;
  const starts=accord.response?.kind==='sanction'?accord.response.turn:violation.startsTurn??violation.turn+1,until=accord.response?.kind==='sanction'?accord.response.untilTurn:violation.untilTurn;
  if(!Number.isSafeInteger(until)||state.turn<starts||state.turn>=until)continue;
  const otherId=otherPrincipal(accord,violation.countryId),blocked=[otherId,state.playerId].filter(Boolean);
  if(a===violation.countryId&&blocked.includes(b)||b===violation.countryId&&blocked.includes(a))return accord;
 }
 return null;
}

export function restrictionContext(state,a,b,kind){
 if(!['buy','sell','trade_buy','trade_sell'].includes(kind))return {scoreDelta:0,reasons:[]};
 const accord=activeRestriction(state,a,b);if(!accord)return {scoreDelta:0,reasons:[]};
 const violator=accord.violation.countryId;
 return {scoreDelta:-100,reasons:[`${COUNTRIES[violator].name}의 평화 합의 위반에 따른 한시적 상업 거래 제한이 적용됩니다.`]};
}

export function observerIds(state,accord,violatorId){
 const otherId=otherPrincipal(accord,violatorId);return COUNTRY_IDS.filter(id=>![state.playerId,violatorId,otherId].includes(id));
}

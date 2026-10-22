import {COUNTRIES} from './country-data.mjs?v=29';
import {goalPairAffinity} from './goal-relations.mjs?v=29';
import {getRelation} from './negotiations.mjs?v=29';

const COMMERCIAL_KINDS=['buy','sell','trade_buy','trade_sell'];
const otherPrincipal=(accord,id)=>accord.principalIds?.find(countryId=>countryId!==id)??null;
const activeAt=(treaty,turn)=>treaty.kind==='alliance'&&treaty.status==='active'&&turn>=treaty.startTurn&&turn<treaty.endTurn;
const responseEffective=(response,turn)=>response?.kind==='sanction'&&response.status==='active'&&turn>=response.startsTurn&&turn<response.untilTurn;

export const peaceResponseEnabled=state=>Number.isSafeInteger(state?.peaceResponseStartTurn)&&state.turn>=state.peaceResponseStartTurn;

export function peaceResponseDecision(state,accord,effectiveTurn=state.turn){
 if(!peaceResponseEnabled({...state,turn:effectiveTurn})||!accord?.violation||accord.foreignResponse||['completed','replaced'].includes(accord.status)||effectiveTurn<=accord.violation.turn)return null;
 const targetId=accord.violation.countryId,initiatorId=otherPrincipal(accord,targetId);
 if(!initiatorId||[initiatorId,targetId].includes(state.playerId))return null;
 const allies=(state.foreignTreaties??[]).filter(treaty=>activeAt(treaty,effectiveTurn)&&[treaty.playerId,treaty.targetId].includes(initiatorId))
  .map(treaty=>treaty.playerId===initiatorId?treaty.targetId:treaty.playerId)
  .filter((id,index,items)=>id!==state.playerId&&id!==targetId&&items.indexOf(id)===index&&getRelation(state,id,initiatorId)>=getRelation(state,id,targetId)).sort();
 const country=state.countries[initiatorId],relation=getRelation(state,initiatorId,targetId),goal=goalPairAffinity(state,initiatorId,targetId,'alliance'),pressure=Math.max(0,45-country.food)+Math.max(0,country.price-125)/2;
 const kind=country.food>=35&&country.treasury>=20&&pressure<25&&(relation<45||goal.scoreDelta<0)?'sanction':'renegotiate';
 const reason=kind==='sanction'
  ?`양국 관계 ${relation}${goal.scoreDelta<0?'와 충돌하는 국가 목표':''}, 가용 식량 ${country.food}·국고 ${country.treasury}를 근거로 상업 제재를 선언했습니다.`
  :pressure?`식량 ${country.food}·물가 ${country.price}의 압박과 양국 관계 ${relation}를 근거로 새 평화 조건을 요청했습니다.`:`현재 식량 ${country.food}·물가 ${country.price}가 안정적이고 양국 관계 ${relation}로 외교적 재합의 여지가 있어 새 평화 조건을 요청했습니다.`;
 return {kind,initiatorId,targetId,memberIds:[initiatorId,...allies],reason};
}

export function peaceResponsePairs(state){
 if(!peaceResponseEnabled(state))return [];
 const pairs=[];
 for(const accord of state.peaceAccords??[]){
  const response=accord.foreignResponse;if(['completed','replaced'].includes(accord.status)||!responseEffective(response,state.turn))continue;
  for(const fromId of response.memberIds)pairs.push({accordId:accord.id,fromId,toId:response.targetId,initiatorId:response.initiatorId,memberIds:[...response.memberIds],startsTurn:response.startsTurn,untilTurn:response.untilTurn,status:response.status,reason:response.reason});
 }
 return pairs;
}

function prospectivePairs(state){
 const turn=state.peaceResponseForecastTurn??state.turn+1,pairs=[];
 for(const accord of state.peaceAccords??[]){
  const decision=peaceResponseDecision(state,accord,turn);if(decision?.kind!=='sanction')continue;
  for(const fromId of decision.memberIds)pairs.push({accordId:accord.id,fromId,toId:decision.targetId,initiatorId:decision.initiatorId,memberIds:decision.memberIds,startsTurn:turn,untilTurn:turn+3,status:'active',reason:decision.reason});
 }
 return pairs;
}

export function peaceResponseTradeBlocked(state,a,b){
 if(!a||!b||a===b)return false;
 return peaceResponsePairs(state).some(pair=>pair.fromId===a&&pair.toId===b||pair.fromId===b&&pair.toId===a);
}

export function peaceResponsePairContext(state,a,b,kind){
 if(!COMMERCIAL_KINDS.includes(kind))return {scoreDelta:0,reasons:[]};
 const pair=peaceResponsePairs(state).find(item=>item.fromId===a&&item.toId===b||item.fromId===b&&item.toId===a);if(!pair)return {scoreDelta:0,reasons:[]};
 return {scoreDelta:-100,reasons:[`${COUNTRIES[pair.initiatorId].name} 주도의 평화 합의 위반 대응으로 ${COUNTRIES[a].name}·${COUNTRIES[b].name} 사이 상업 거래가 중단됩니다.`]};
}

export function peaceResponseMarketContext(state,targetId,kind){
 if(!COMMERCIAL_KINDS.includes(kind))return {scoreDelta:0,reasons:[]};
 const current=peaceResponsePairs(state).map(pair=>({...pair,effectiveTurn:state.turn})),forecast=prospectivePairs(state).map(pair=>({...pair,effectiveTurn:pair.startsTurn}));
 const pairs=[...current,...forecast].filter((pair,index,items)=>items.findIndex(item=>item.accordId===pair.accordId&&item.fromId===pair.fromId)===index);
 const routes=(state.foreignTreaties??[]).filter(treaty=>treaty.status==='active'&&treaty.kind==='trade_sell'&&[treaty.playerId,treaty.targetId].includes(targetId)&&pairs.some(pair=>pair.effectiveTurn>=treaty.startTurn&&pair.effectiveTurn<treaty.endTurn&&(pair.fromId===targetId&&pair.toId===(treaty.playerId===targetId?treaty.targetId:treaty.playerId)||pair.toId===targetId&&pair.fromId===(treaty.playerId===targetId?treaty.targetId:treaty.playerId))));
 if(!routes.length)return {scoreDelta:0,reasons:[]};
 const supplying=routes.filter(treaty=>treaty.playerId===targetId).reduce((sum,treaty)=>sum+treaty.food,0),importing=routes.filter(treaty=>treaty.targetId===targetId).reduce((sum,treaty)=>sum+treaty.food,0),reasons=[];let scoreDelta=0;
 if(['buy','trade_buy'].includes(kind)&&supplying){scoreDelta+=Math.min(18,supplying*2);reasons.push(`${COUNTRIES[targetId].name}의 막힌 식량 ${supplying} 공급 의무만큼 새 판매 여력이 생겼습니다.`);}
 if(['buy','trade_buy'].includes(kind)&&importing){scoreDelta-=Math.min(40,importing*8);reasons.push(`${COUNTRIES[targetId].name}의 식량 ${importing} 수입 의무가 막혀 새 수출 여력이 줄었습니다.`);}
 if(['sell','trade_sell'].includes(kind)&&importing){scoreDelta+=Math.min(18,importing*2);reasons.push(`${COUNTRIES[targetId].name}의 막힌 식량 ${importing} 수입 의무만큼 새 구매 수요가 생겼습니다.`);}
 return {scoreDelta,reasons};
}

export function peaceResponseCountryLabel(state,id){
 const pairs=peaceResponsePairs(state),led=pairs.some(pair=>pair.initiatorId===id),member=pairs.some(pair=>pair.fromId===id),target=pairs.some(pair=>pair.toId===id);
 if(target)return '평화 위반 제재 대상';if(led)return '평화 대응 주도국';if(member)return '평화 제재 연대국';return null;
}

export function peaceResponseSummary(state,accord){
 const response=accord?.foreignResponse;if(!response)return null;
 return {...structuredClone(response),initiatorName:COUNTRIES[response.initiatorId]?.name??response.initiatorId,targetName:COUNTRIES[response.targetId]?.name??response.targetId,memberNames:response.memberIds.map(id=>COUNTRIES[id]?.name??id)};
}

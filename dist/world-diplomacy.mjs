import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=31';
import {adjustRelation} from './negotiations.mjs?v=31';
import {goalRequest} from './goal-relations.mjs?v=31';
import {tradeBlocked} from './goal-conflicts.mjs?v=31';
export const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(value)));

const openingPartner={lumen:'altia',nord:'cera',cera:'altia',altia:'cera',marin:'cera',solis:'marin'};
export function initialRequest(playerId='lumen'){
 const fromId=openingPartner[playerId]??'altia',partner=COUNTRIES[fromId];
 if(fromId==='altia')return {id:`request-${fromId}-0`,fromId,type:'technology',title:`${partner.name}의 생산 기술 협력 제안`,description:`${partner.name} 측이 기술진을 파견하겠다고 먼저 연락했습니다. 공동 연구비를 내면 네 분기 동안 생산을 지원합니다.`,createdTurn:0,expiresTurn:3,status:'pending',terms:{food:3,treasury:12,duration:4}};
 return {id:`request-${fromId}-0`,fromId,type:'trade',title:`${partner.name}의 곡물 공급 제안`,description:`${partner.name} 측이 네 분기 동안 안정적으로 곡물을 공급하겠다고 제안했습니다.`,createdTurn:0,expiresTurn:3,status:'pending',terms:{food:3,treasury:12,duration:4}};
}

export function requestAction(state,id){
 if(typeof id!=='string')return null;
 const [verb,requestId]=id.split(':');if(!['accept','counter','decline'].includes(verb))return null;
 const request=state.requests.find(item=>item.id===requestId&&item.fromId!==state.playerId&&item.status==='pending'&&item.expiresTurn>state.turn);if(!request)return null;
 if(verb!=='decline'&&request.type==='trade'&&tradeBlocked({...state,turn:state.turn+1},state.playerId,request.fromId))return null;
 const factor=verb==='counter'?.5:1,decline=verb==='decline',cost=decline?0:Math.ceil(request.terms.treasury*factor);
 const foodCost=!decline&&request.type==='aid'?Math.ceil(request.terms.food*factor):0,food=decline?0:Math.ceil(request.terms.food*factor),duration=decline?0:verb==='counter'?2:request.terms.duration;
 const effect=request.type==='aid'?`즉시 식량 ${food} · 국고 ${cost} 전달`:request.type==='trade'?`${duration}분기 동안 매 분기 식량 +${food}, 국고 −${Math.ceil(cost/Math.max(1,duration))}`:`연구비 ${cost} 지급 · ${duration}분기 동안 생산 +${food}`;
 return {id,name:`${COUNTRIES[request.fromId].name} ${decline?'요청 거절':verb==='counter'?'축소안으로 협상':'요청 수락'}`,cost:request.type==='trade'&&!decline?Math.ceil(cost/duration):cost,foodCost,tag:'외교',targetId:request.fromId,requestId,verb,terms:{food,treasury:cost,duration},description:decline?'제안을 거절합니다. 상대국의 신뢰가 낮아집니다.':effect,forecast:decline?'추가 비용 없음 · 상대국 신뢰 −3':effect};
}

export function applyRequest(next,action,parts,actions){
 if(!action.requestId)return;
 const playerId=next.playerId,request=next.requests.find(item=>item.id===action.requestId),partner=next.countries[request.fromId],player=next.countries[playerId];
 request.status='resolved';request.response=action.verb;request.resolvedTurn=next.turn;
 if(action.verb==='decline'){partner.trust-=3;adjustRelation(next,playerId,partner.id,-3);actions.push({countryId:playerId,targetId:partner.id,type:'agreement',source:'agreement',text:`${partner.name}의 제안을 거절했습니다. 상대 신뢰 −3.`});return;}
 partner.trust+=5;player.trust+=2;partner.treasury+=action.cost;adjustRelation(next,playerId,partner.id,action.verb==='counter'?2:5);
 if(request.type==='aid'){player.food-=action.terms.food;partner.food+=action.terms.food;parts.push({label:`${partner.name} 긴급 식량 지원`,value:-action.terms.food});actions.push({countryId:playerId,targetId:partner.id,type:'aid',source:'agreement',text:`${partner.name}에 식량 ${action.terms.food}·지원금 ${action.cost} 전달.`});return;}
 next.agreements.push({id:`agreement-${request.id}`,fromId:partner.id,targetId:playerId,type:request.type,startTurn:next.turn,endTurn:next.turn+action.terms.duration,firstPaidTurn:next.turn,food:action.terms.food,treasury:request.type==='trade'?Math.ceil(action.terms.treasury/action.terms.duration):0});
 actions.push({countryId:partner.id,targetId:playerId,type:'agreement',source:'agreement',text:`${partner.name} 측과 ${action.terms.duration}분기 ${request.type==='trade'?'곡물 공급':'기술 협력'} 협약 체결.`});
}

export function applyAgreements(next,parts,actions){
 const playerId=next.playerId,player=next.countries[playerId],current=[];
 for(const agreement of next.agreements){
  const partner=next.countries[agreement.fromId];
  if(next.turn>=agreement.endTurn){actions.push({countryId:partner.id,targetId:playerId,type:'expiry',source:'agreement',text:`${partner.name} 측과 맺은 협약이 만료되었습니다.`});continue;}
  current.push(agreement);
  if(agreement.type==='technology'){player.food+=agreement.food;parts.push({label:`${partner.name} 기술 협력 생산`,value:agreement.food});continue;}
  if(tradeBlocked(next,playerId,agreement.fromId)){actions.push({countryId:agreement.fromId,targetId:playerId,type:'sanction',source:'goal_conflict',text:'무역 제재로 '+partner.name+' 공급 협약이 이번 분기 중지됐습니다. 협약 기간은 그대로 흐릅니다.'});continue;}
  const prepaid=agreement.firstPaidTurn===next.turn,amount=Math.min(agreement.food,Math.max(0,partner.food-20),prepaid?agreement.food:Math.floor(player.treasury/Math.max(1,agreement.treasury))*agreement.food);
  if(prepaid&&amount<agreement.food){const refund=agreement.treasury-Math.ceil(agreement.treasury*amount/agreement.food);player.treasury+=refund;partner.treasury-=refund;actions.push({countryId:partner.id,targetId:playerId,type:'agreement',source:'agreement',text:`공급 부족분의 선불 대금 반환 · ${refund}.`});}
  if(amount>0){const paid=prepaid?0:Math.ceil(agreement.treasury*amount/agreement.food);player.treasury-=paid;partner.treasury+=paid;partner.food-=amount;player.food+=amount;parts.push({label:`${partner.name} 공급 협약`,value:amount});actions.push({countryId:partner.id,targetId:playerId,type:'trade',source:'agreement',text:`협약에 따라 식량 ${amount} 공급 · ${prepaid?'이번 분기 대금은 수락 시 지급':`${COUNTRIES[playerId].name} 국고 −${paid}`}.`});}
  else actions.push({countryId:partner.id,targetId:playerId,type:'austerity',source:'agreement',text:'재고 또는 대금 부족으로 이번 분기 협약 공급이 중단되었습니다.'});
 }
 next.agreements=current;
}

function proposal(next,id){
 const country=next.countries[id],poor=country.food<45||country.treasury<25;
 if(poor)return {type:'aid',title:`${country.name}의 긴급 지원 요청`,description:`요청 당시 식량 안정 ${country.food}, 국고 ${country.treasury}. ${country.name} 측이 비축 식량과 긴급 지원금을 요청했습니다.`,terms:{food:7,treasury:4,duration:0}};
 if(id==='altia')return {type:'technology',title:'알티아의 생산 기술 공동 연구',description:'알티아가 계절에 대비하는 생산 기술 협력을 제안했습니다.',terms:{food:3,treasury:12,duration:4}};
 return {type:'trade',title:`${country.name}의 곡물 공급 협상`,description:`${country.name} 측이 항구와 비축망을 활용한 네 분기 공급 계약을 제안했습니다.`,terms:{food:3,treasury:12,duration:4}};
}
export function updateRequests(next,actions){
 const playerId=next.playerId;
 for(const request of next.requests)if(request.status==='pending'&&next.turn>=request.expiresTurn){request.status='expired';actions.push({countryId:request.fromId,targetId:playerId,type:'expiry',text:`${COUNTRIES[request.fromId].name}의 제안 기한이 지났습니다.`});}
 const foreign=COUNTRY_IDS.filter(id=>id!==playerId),ordered=foreign.map((_,index)=>foreign[(next.turn-1+index)%foreign.length]).sort((a,b)=>Number(next.countries[b].food<45)-Number(next.countries[a].food<45));
 for(const id of ordered){
  if(next.turn-(next.lastRequestTurn[id]??-10)<7)continue;
  const goalWorld=Number.isSafeInteger(next.worldGoalStartTurn)&&next.turn>=next.worldGoalStartTurn;
  const offer=goalWorld?goalRequest(next,id):proposal(next,id);if(!offer)continue;
  if(next.requests.some(item=>item.status==='pending'&&item.fromId===id&&item.type===offer.type))continue;if(offer.type!=='aid'&&next.agreements.some(item=>item.fromId===id&&item.type===offer.type))continue;
  const request={id:`request-${id}-${next.turn}`,fromId:id,...offer,createdTurn:next.turn,expiresTurn:next.turn+3,status:'pending'};next.requests.push(request);next.lastRequestTurn[id]=next.turn;
  actions.push({countryId:id,targetId:playerId,type:'request',...(offer.goalTitle?{source:'national_goal',goalTitle:offer.goalTitle,reason:offer.goalReason}:{}),text:`${COUNTRIES[id].name} 측이 먼저 ${offer.type==='aid'?'긴급 지원을 요청':offer.type==='technology'?'기술 협력을 제안':'공급 협상을 제안'}했습니다.${offer.goalReason?` ${offer.goalReason}`:''} 응답 기한 ${request.expiresTurn}분기.`});break;
 }
 const pending=next.requests.filter(item=>item.status==='pending'),archived=next.requests.filter(item=>item.status!=='pending').slice(-(20-pending.length));next.requests=[...archived,...pending].sort((a,b)=>a.createdTurn-b.createdTurn);
}

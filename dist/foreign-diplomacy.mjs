import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {goalMarketContext,goalPairAffinity} from './goal-relations.mjs?v=29';
import {conflictMarketContext,tradeBlocked} from './goal-conflicts.mjs?v=29';
import {peaceResponseTradeBlocked} from './peace-response-model.mjs?v=29';
import {foreignStrategyContext} from './foreign-strategy.mjs?v=29';

const relationKey=(a,b)=>[a,b].sort().join(':');
const relation=(state,a,b)=>a===b?100:state.relations?.[relationKey(a,b)]??50;
const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
const pairKey=(a,b)=>[a,b].sort().join(':');
const participants=treaty=>[treaty.playerId,treaty.targetId];
const particle=(word,withBatchim,withoutBatchim)=>{const code=word.charCodeAt(word.length-1);return `${word}${code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28?withBatchim:withoutBatchim}`;};

function adjustRelation(state,a,b,delta){
 if(!a||!b||a===b)return;
 state.relations??={};state.relations[relationKey(a,b)]=clamp(relation(state,a,b)+delta);
}
function changeReliability(state,id,delta){
 state.reliability??=Object.fromEntries(COUNTRY_IDS.map(countryId=>[countryId,70]));
 state.reliability[id]=clamp((state.reliability[id]??70)+delta);
}
function event(state,treaty,type,text,data={}){
 const item={treatyId:treaty.id,turn:state.turn,type,countryId:treaty.playerId,targetId:treaty.targetId,text,...data};
 state.lastForeignEvents.push(item);treaty.events=[...(treaty.events??[]),item].slice(-8);treaty.lastOutcome=item;
 return item;
}
function action(actions,treaty,type,text,source='foreign_network',data={}){
 actions.push({countryId:treaty.playerId,targetId:treaty.targetId,type,source,text,...data});
}
function archive(state){
 const active=state.foreignTreaties.filter(item=>item.status==='active');
 const closed=state.foreignTreaties.filter(item=>item.status!=='active').slice(-(50-active.length));
 state.foreignTreaties=[...closed,...active].sort((a,b)=>a.startTurn-b.startTurn||a.id.localeCompare(b.id));
 state.foreignTreatyHistory=state.foreignTreaties.filter(item=>item.status!=='active').slice(-30);
}
function ensure(state){
 state.foreignTreaties??=[];state.foreignTreatyHistory??=[];state.lastForeignEvents??=[];state.foreignPairCooldowns??={};
}

export function activeForeignTreaties(state){return (state.foreignTreaties??[]).filter(item=>item.status==='active');}

export function marketContext(state,targetId,kind,effectiveTurn=state.turn){
 const active=activeForeignTreaties(state),outgoing=active.filter(item=>item.kind==='trade_sell'&&item.playerId===targetId),incoming=active.filter(item=>item.kind==='trade_sell'&&item.targetId===targetId),alliances=active.filter(item=>item.kind==='alliance'&&participants(item).includes(targetId));
 const reservedFood=outgoing.reduce((sum,item)=>sum+item.food,0),competingFood=incoming.reduce((sum,item)=>sum+item.food,0),reasons=[];let scoreDelta=0;
 if(kind==='buy'&&reservedFood){scoreDelta-=Math.min(18,reservedFood*2);reasons.push(`${particle(COUNTRIES[targetId].name,'은','는')} 다른 나라에 분기당 식량 ${reservedFood} 공급을 이미 약속해 판매 여력이 줄었습니다.`);}
 if(kind==='sell'&&competingFood){scoreDelta-=Math.min(16,competingFood*2);reasons.push(`${particle(COUNTRIES[targetId].name,'은','는')} 다른 협정으로 분기당 식량 ${competingFood} 공급을 받아 추가 수입 필요가 낮습니다.`);}
 if(kind==='aid_out'&&alliances.length){scoreDelta-=Math.min(8,alliances.length*4);reasons.push(`${particle(COUNTRIES[targetId].name,'은','는')} ${alliances.length}개 상호 지원 동맹의 보호를 받고 있습니다.`);}
 if(kind==='aid_in'&&(reservedFood||alliances.length)){scoreDelta-=Math.min(14,reservedFood+alliances.length*3);reasons.push(`${COUNTRIES[targetId].name}의 기존 공급·동맹 의무가 추가 지원 여력을 제한합니다.`);}
 if(kind==='trade_buy'&&reservedFood){scoreDelta-=Math.min(15,reservedFood*1.5);reasons.push(`기존 외국 간 공급 약속 ${reservedFood} 때문에 장기 판매 여력이 낮아졌습니다.`);}
 if(kind==='trade_sell'&&competingFood){scoreDelta-=Math.min(15,competingFood*1.5);reasons.push(`다른 공급국의 약속 ${competingFood}과 경쟁해야 합니다.`);}
 if(kind==='alliance'&&alliances.length){scoreDelta-=10;reasons.push(`${particle(COUNTRIES[targetId].name,'은','는')} 이미 다른 식량 동맹 의무를 지고 있습니다.`);}
 const goal=goalMarketContext(state,targetId,kind);scoreDelta+=goal.scoreDelta;reasons.push(...goal.reasons);
 const conflict=conflictMarketContext({...state,turn:effectiveTurn,peaceResponseForecastTurn:effectiveTurn},state.playerId,targetId,kind);scoreDelta+=conflict.scoreDelta;reasons.push(...conflict.reasons);
 const strategy=foreignStrategyContext(state,targetId,kind,effectiveTurn);scoreDelta+=strategy.scoreDelta;reasons.push(...strategy.reasons);
 return {scoreDelta:Math.round(scoreDelta),reasons,reservedFood,competingFood,activeCount:outgoing.length+incoming.length+alliances.length,strategyScoreDelta:strategy.scoreDelta,strategyRemaining:strategy.remaining,strategyPosture:strategy.posture};
}

function networkScores(state,treaty){
 if(treaty.kind==='trade_sell')return {buy:marketContext(state,treaty.playerId,'buy').scoreDelta,sell:marketContext(state,treaty.targetId,'sell').scoreDelta};
 return {first:marketContext(state,treaty.playerId,'alliance').scoreDelta,second:marketContext(state,treaty.targetId,'alliance').scoreDelta};
}
function negotiationImpact(treaty,before,after){
 if(treaty.kind==='trade_sell'){
  const buy=after.buy-before.buy,sell=after.sell-before.sell;if(!buy&&!sell)return undefined;
  return {scoreDelta:buy,tradeSellScoreDelta:sell,text:`${COUNTRIES[treaty.playerId].name} 대상 식량 구매 제안 반응 ${buy>0?'+':''}${buy}점 · ${COUNTRIES[treaty.targetId].name} 대상 식량 판매 제안 반응 ${sell>0?'+':''}${sell}점`};
 }
 const first=after.first-before.first,second=after.second-before.second;if(!first&&!second)return undefined;
 return {scoreDelta:first,otherScoreDelta:second,text:`${COUNTRIES[treaty.playerId].name} 동맹 제안 반응 ${first>0?'+':''}${first}점 · ${COUNTRIES[treaty.targetId].name} 동맹 제안 반응 ${second>0?'+':''}${second}점`};
}

export function foreignMarketSummary(state){
 const active=activeForeignTreaties(state),trades=active.filter(item=>item.kind==='trade_sell'),alliances=active.filter(item=>item.kind==='alliance'),lastPlayerImpact=(state.lastForeignEvents??[]).filter(item=>item.playerImpact).map(item=>item.playerImpact);
 return {activeCount:active.length,tradeCount:trades.length,allianceCount:alliances.length,committedFood:active.reduce((sum,item)=>sum+item.food,0),playerTreasuryDelta:lastPlayerImpact.reduce((sum,item)=>sum+(item.treasury??0),0),items:active.map(item=>({id:item.id,playerId:item.playerId,targetId:item.targetId,kind:item.kind,food:item.food,money:item.money,startTurn:item.startTurn,endTurn:item.endTurn,remaining:Math.max(0,item.endTurn-Math.max(item.startTurn,state.turn+1)),status:item.status,lastOutcome:item.lastOutcome}))};
}

function reward(state,treaty,actorIds){
 adjustRelation(state,treaty.playerId,treaty.targetId,1);for(const id of actorIds)changeReliability(state,id,1);
}
function punish(state,treaty,responsibleId){
 adjustRelation(state,treaty.playerId,treaty.targetId,-5);changeReliability(state,responsibleId,-6);
 for(const observerId of COUNTRY_IDS.filter(id=>!participants(treaty).includes(id)))adjustRelation(state,observerId,responsibleId,-1);
}
function cancelAfterBreaches(state,treaty,responsibleId,actions){
 if(treaty.streak<2)return;
 const before=networkScores(state,treaty);treaty.status='cancelled';treaty.resolvedTurn=state.turn;const otherId=participants(treaty).find(id=>id!==responsibleId),text=`${particle(COUNTRIES[otherId].name,'이','가')} ${COUNTRIES[responsibleId].name}의 2분기 연속 불이행으로 협정을 종료했습니다.`,playerImpact=negotiationImpact(treaty,before,networkScores(state,treaty));
 event(state,treaty,'cancelled',text,{actorId:responsibleId,...(playerImpact?{playerImpact}:{})});action(actions,treaty,'treaty',text);
}
function executeTrade(state,treaty,actions){
 if(tradeBlocked(state,treaty.playerId,treaty.targetId)){const response=peaceResponseTradeBlocked(state,treaty.playerId,treaty.targetId),text='무역 제재로 '+COUNTRIES[treaty.playerId].name+' → '+COUNTRIES[treaty.targetId].name+' 외국 간 협정 이행이 중지됐습니다. 불이행으로 기록되지 않습니다.';event(state,treaty,'suspended',text,{promisedFood:treaty.food,promisedMoney:treaty.money,food:0,money:0});action(actions,treaty,'sanction',text,response?'peace_response':'goal_conflict',{conflictSuspension:true});return;}
 const seller=state.countries[treaty.playerId],buyer=state.countries[treaty.targetId],before={sellerFood:seller.food,sellerCash:seller.treasury,buyerCash:buyer.treasury,buyerCapacity:100-buyer.food};let delivered=Math.min(treaty.food,Math.max(0,seller.food-20),Math.max(0,100-buyer.food));
 while(delivered>0&&(Math.ceil(treaty.money*delivered/treaty.food)>buyer.treasury||seller.treasury+Math.ceil(treaty.money*delivered/treaty.food)>100))delivered--;
 const paid=delivered?Math.ceil(treaty.money*delivered/treaty.food):0;seller.food-=delivered;seller.treasury+=paid;buyer.food+=delivered;buyer.treasury-=paid;
 if(delivered)action(actions,treaty,'trade',`외국 간 협정 이행: ${seller.name} → ${buyer.name} 식량 ${delivered} · 대금 ${paid}.`,'foreign_treaty',{food:delivered,money:paid});
 if(delivered===treaty.food&&paid===treaty.money){treaty.fulfilled++;treaty.streak=0;reward(state,treaty,[treaty.playerId,treaty.targetId]);event(state,treaty,'fulfilled',`${particle(seller.name,'과','와')} ${particle(buyer.name,'이','가')} 식량 ${delivered}·대금 ${paid} 약속을 모두 지켰습니다.`,{food:delivered,money:paid,promisedFood:treaty.food,promisedMoney:treaty.money});return;}
 const sellerBlocked=before.sellerFood-20<treaty.food||before.sellerCash+treaty.money>100,responsibleId=sellerBlocked?treaty.playerId:before.buyerCash<treaty.money||before.buyerCapacity<treaty.food?treaty.targetId:treaty.playerId;
 treaty.breaches++;treaty.streak++;punish(state,treaty,responsibleId);event(state,treaty,'breach',`${COUNTRIES[responsibleId].name} 사정으로 식량 ${treaty.food}·대금 ${treaty.money} 약속 중 식량 ${delivered}·대금 ${paid}만 이행됐습니다.`,{actorId:responsibleId,food:delivered,money:paid,promisedFood:treaty.food,promisedMoney:treaty.money});cancelAfterBreaches(state,treaty,responsibleId,actions);
}
function executeAlliance(state,treaty,actions){
 const needy=participants(treaty).filter(id=>state.countries[id].food<35).sort((a,b)=>state.countries[a].food-state.countries[b].food);
 if(!needy.length){treaty.streak=0;event(state,treaty,'standby',`${COUNTRIES[treaty.playerId].name}·${COUNTRIES[treaty.targetId].name} 모두 식량 경보선 이상이라 동맹 지원은 대기했습니다.`);return;}
 const recipientId=needy[0],donorId=participants(treaty).find(id=>id!==recipientId),donor=state.countries[donorId],recipient=state.countries[recipientId],promisedMoney=recipient.treasury<25?treaty.money:0;
 const food=Math.min(treaty.food,Math.max(0,donor.food-20),Math.max(0,100-recipient.food)),money=Math.min(promisedMoney,Math.max(0,donor.treasury-20),Math.max(0,100-recipient.treasury));donor.food-=food;recipient.food+=food;donor.treasury-=money;recipient.treasury+=money;
 if(food||money)actions.push({countryId:donorId,targetId:recipientId,type:'aid',source:'foreign_treaty',food,money,text:`외국 간 식량 동맹 발동: ${COUNTRIES[donorId].name} → ${COUNTRIES[recipientId].name} 식량 ${food}${money?` · 지원금 ${money}`:''}.`});
 if(food===treaty.food&&money===promisedMoney){treaty.fulfilled++;treaty.streak=0;reward(state,treaty,[donorId]);event(state,treaty,'fulfilled',`${particle(COUNTRIES[donorId].name,'이','가')} 동맹 지원 식량 ${food}${money?`·지원금 ${money}`:''}을 보냈습니다.`,{actorId:donorId,food,money,promisedFood:treaty.food,promisedMoney});return;}
 treaty.breaches++;treaty.streak++;punish(state,treaty,donorId);event(state,treaty,'breach',`${particle(COUNTRIES[donorId].name,'이','가')} 동맹 약속 식량 ${treaty.food} 중 ${food}만 지원했습니다.`,{actorId:donorId,food,money,promisedFood:treaty.food,promisedMoney});cancelAfterBreaches(state,treaty,donorId,actions);
}
function complete(state,treaty,actions){
 const before=networkScores(state,treaty);treaty.status='completed';treaty.resolvedTurn=state.turn;let text;
 if(treaty.breaches)text=`${COUNTRIES[treaty.playerId].name}·${COUNTRIES[treaty.targetId].name} 협정이 ${treaty.breaches}회 불이행 기록을 남기고 만료됐습니다.`;
 else{adjustRelation(state,treaty.playerId,treaty.targetId,3);changeReliability(state,treaty.playerId,2);changeReliability(state,treaty.targetId,2);text=`${COUNTRIES[treaty.playerId].name}·${COUNTRIES[treaty.targetId].name} 협정이 약속한 기간을 모두 마쳤습니다.`;}
 const playerImpact=negotiationImpact(treaty,before,networkScores(state,treaty));event(state,treaty,'completed',text,playerImpact?{playerImpact}:{});action(actions,treaty,'expiry',text);
}
function maybeBreak(state,treaty,actions){
 if(state.turn<=treaty.startTurn)return false;
 const buyer=treaty.kind==='trade_sell'?state.countries[treaty.targetId]:null,threshold=treaty.breaches?48:treaty.kind==='alliance'?38:30;
 const members=participants(treaty).map(id=>state.countries[id]),needEnded=treaty.fulfilled>0&&(buyer?buyer.food>=68:members.every(country=>country.food>=55)),fiscalExit=buyer&&treaty.fulfilled>0&&buyer.treasury<12;
 if(relation(state,treaty.playerId,treaty.targetId)>=threshold&&(!buyer||buyer.treasury>=5)&&!needEnded&&!fiscalExit)return false;
 const breakerId=buyer&&(buyer.treasury<12||needEnded)?treaty.targetId:participants(treaty).sort((a,b)=>(state.reliability?.[a]??70)-(state.reliability?.[b]??70))[0],otherId=participants(treaty).find(id=>id!==breakerId);
 const before=networkScores(state,treaty);treaty.status='broken';treaty.resolvedTurn=state.turn;adjustRelation(state,treaty.playerId,treaty.targetId,-10);changeReliability(state,breakerId,-10);for(const id of COUNTRY_IDS.filter(id=>!participants(treaty).includes(id)))adjustRelation(state,id,breakerId,-2);
 const reason=needEnded?'식량 수요가 회복돼':fiscalExit?'국고 부담이 커져':'관계 악화와 이행 부담으로',text=`${particle(COUNTRIES[breakerId].name,'이','가')} ${reason} ${particle(COUNTRIES[otherId].name,'과','와')}의 협정을 파기했습니다.`,playerImpact=negotiationImpact(treaty,before,networkScores(state,treaty));event(state,treaty,'broken',text,{actorId:breakerId,...(playerImpact?{playerImpact}:{})});action(actions,treaty,'treaty',text);return true;
}
function candidates(state){
 const ids=COUNTRY_IDS.filter(id=>id!==state.playerId),active=activeForeignTreaties(state),result=[];
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const a=ids[i],b=ids[j],pair=pairKey(a,b);if((state.foreignPairCooldowns[pair]??-99)>state.turn)continue;
  const rel=relation(state,a,b);if(rel<45)continue;
  const countries=[a,b].sort((x,y)=>state.countries[y].food-state.countries[x].food),sellerId=countries[0],buyerId=countries[1],seller=state.countries[sellerId],buyer=state.countries[buyerId];
  if(buyer.food<50&&seller.food>55&&!active.some(item=>item.kind==='alliance'&&pairKey(item.playerId,item.targetId)===pair))result.push({kind:'alliance',playerId:sellerId,targetId:buyerId,score:110+(50-buyer.food)*3+(seller.food-55)+rel,food:Math.min(5,Math.max(2,Math.floor((seller.food-45)/5))),money:buyer.treasury<25?2:0,duration:4});
  if(!tradeBlocked(state,a,b)&&seller.food>60&&buyer.food<65&&buyer.treasury>=8&&!active.some(item=>item.kind==='trade_sell'&&pairKey(item.playerId,item.targetId)===pair))result.push({kind:'trade_sell',playerId:sellerId,targetId:buyerId,score:(seller.food-buyer.food)*2+rel+(state.reliability?.[sellerId]??70),food:Math.min(5,Math.max(2,Math.floor((seller.food-buyer.food)/8))),money:Math.min(10,Math.max(4,Math.floor((seller.food-buyer.food)/4))),duration:4});
 }
 return result.map(item=>{const affinity=goalPairAffinity(state,item.playerId,item.targetId,item.kind),sellerMode=state.foreignStrategies?.[item.playerId]?.mode,buyerMode=state.foreignStrategies?.[item.targetId]?.mode,strategyDelta=(sellerMode==='trade'?6:0)+(buyerMode==='food'||buyerMode==='resilience'?6:0);return {...item,score:item.score+affinity.scoreDelta+strategyDelta,goalReason:affinity.reason,strategyReason:strategyDelta?`${COUNTRIES[item.playerId].name}의 교역 전략과 ${COUNTRIES[item.targetId].name}의 공급 전략이 상대 선택에 반영됐습니다.`:undefined};}).sort((a,b)=>b.score-a.score||a.playerId.localeCompare(b.playerId)||a.targetId.localeCompare(b.targetId));
}
function form(state,actions){
 if(activeForeignTreaties(state).length>=4||state.turn!==state.networkStartTurn&&state.turn>1&&state.turn%2===0)return;
 const chosen=candidates(state)[0];if(!chosen)return;
 const id=`foreign-${chosen.playerId}-${chosen.targetId}-${state.turn}-${chosen.kind}`,startTurn=state.turn+1,treaty={id,playerId:chosen.playerId,targetId:chosen.targetId,kind:chosen.kind,food:chosen.food,money:chosen.money,duration:chosen.duration,status:'active',startTurn,endTurn:startTurn+chosen.duration,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]},before=networkScores(state,treaty);
 if(chosen.goalReason)treaty.goalReason=chosen.goalReason;
 if(chosen.strategyReason)treaty.strategyReason=chosen.strategyReason;
 state.foreignTreaties.push(treaty);state.foreignPairCooldowns[pairKey(chosen.playerId,chosen.targetId)]=state.turn+4;adjustRelation(state,chosen.playerId,chosen.targetId,2);
 const label=chosen.kind==='alliance'?'상호 식량 지원 동맹':'곡물 무역 협정',text=`${particle(COUNTRIES[chosen.playerId].name,'과','와')} ${particle(COUNTRIES[chosen.targetId].name,'이','가')} 다음 분기부터 이행하는 ${chosen.duration}분기 ${label}을 맺었습니다.`,playerImpact=negotiationImpact(treaty,before,networkScores(state,treaty));event(state,treaty,'formed',text,{food:chosen.food,money:chosen.money,...(playerImpact?{playerImpact}:{})});action(actions,treaty,'treaty',text);
}
function applyPlayerMarketEffect(state,actions){
 const delivered=state.lastForeignEvents.filter(item=>item.type==='fulfilled'&&state.foreignTreaties.find(treaty=>treaty.id===item.treatyId)?.kind==='trade_sell');if(!delivered.length)return;
 if(state.playerId==='marin'){
  const sourceTreaty=state.foreignTreaties.find(item=>item.id===delivered[0].treatyId),payer=state.countries[sourceTreaty.playerId],fee=Math.min(1,payer.treasury,Math.max(0,100-state.countries.marin.treasury));if(!fee)return;
  payer.treasury-=fee;state.countries.marin.treasury+=fee;const text=`외국 간 협정 화물을 운송해 마린 국고에 항로 수입 ${fee}이 들어왔습니다.`;state.lastForeignEvents.push({treatyId:sourceTreaty.id,turn:state.turn,type:'market',countryId:sourceTreaty.playerId,targetId:'marin',text,playerImpact:{treasury:fee}});actions.push({countryId:sourceTreaty.playerId,targetId:'marin',type:'market',source:'foreign_network',text,playerImpact:{treasury:fee}});
 }
 if(['lumen','cera'].includes(state.playerId)){
  if(state.playerId==='lumen'&&state.activePolicy==='embargo')return;
  const matched=delivered.find(item=>['nord','marin','solis'].includes(item.targetId));if(!matched)return;
  const buyer=state.countries[matched.targetId],loss=Math.min(1,state.countries[state.playerId].treasury,Math.max(0,100-buyer.treasury));if(!loss)return;
  state.countries[state.playerId].treasury-=loss;buyer.treasury+=loss;const text=`${particle(COUNTRIES[matched.targetId].name,'이','가')} 장기 공급 계약으로 수요를 돌려 ${COUNTRIES[state.playerId].name}의 현물 수출 수입 ${loss}이 줄고, 같은 금액을 자국에 남겼습니다.`;state.lastForeignEvents.push({treatyId:matched.treatyId,turn:state.turn,type:'market',countryId:matched.targetId,targetId:state.playerId,text,playerImpact:{treasury:-loss}});actions.push({countryId:matched.targetId,targetId:state.playerId,type:'market',source:'foreign_network',text,playerImpact:{treasury:-loss}});
 }
}

export function runForeignDiplomacy(state,actions=[]){
 ensure(state);state.lastForeignEvents=[];
 if(!Number.isSafeInteger(state.networkStartTurn)||state.turn<state.networkStartTurn)return;
 for(const treaty of activeForeignTreaties(state).sort((a,b)=>a.startTurn-b.startTurn||a.id.localeCompare(b.id))){
  if(maybeBreak(state,treaty,actions))continue;
  if(state.turn>=treaty.startTurn&&state.turn<treaty.endTurn){if(treaty.kind==='alliance')executeAlliance(state,treaty,actions);else executeTrade(state,treaty,actions);}
  if(treaty.status==='active'&&state.turn===treaty.endTurn-1)complete(state,treaty,actions);
 }
 form(state,actions);applyPlayerMarketEffect(state,actions);archive(state);
}

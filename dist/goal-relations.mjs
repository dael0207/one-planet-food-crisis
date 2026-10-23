import {COUNTRIES} from './country-data.mjs?v=30';
import {OBJECTIVE_PLANS} from './objectives-data.mjs?v=30';

const EXPORTERS=['lumen','cera'];
const IMPORTERS=['nord','marin','solis'];
const pairKey=(a,b)=>[a,b].sort().join(':');
const relation=(state,a,b)=>a===b?100:state.relations?.[pairKey(a,b)]??50;
const active=state=>Number.isSafeInteger(state.worldGoalStartTurn)&&state.turn>=state.worldGoalStartTurn;
const clampScore=value=>Math.max(-12,Math.min(12,Math.round(value)));
const title=(a,b)=>`${OBJECTIVE_PLANS[a].title} ↔ ${OBJECTIVE_PLANS[b].title}`;

function pairType(state,a,b){
 const key=pairKey(a,b),allowed=relation(state,a,b)>=35;
 if(key==='cera:lumen'&&state.countries.lumen.food>=40&&state.countries.cera.food>=40)return {type:'competition',reason:'두 곡물 수출국의 장기 목표가 같은 해외 수요를 두고 겹칩니다.'};
 if(!allowed)return null;
 if(key==='altia:solis')return {type:'cooperation',reason:'농업 기술 보급과 가뭄 회복 목표가 공동 기후 사업으로 이어집니다.'};
 if(key==='marin:nord')return {type:'cooperation',reason:'안정적인 수입선과 끊기지 않는 해상 물류 목표가 서로 맞닿아 있습니다.'};
 const supplier=EXPORTERS.find(id=>id===a||id===b),importer=IMPORTERS.find(id=>id===a||id===b);
 if(supplier&&importer&&state.countries[supplier].food>55&&state.countries[importer].food<70)return {type:'cooperation',reason:'공급국의 수출 여력과 수입국의 비축 목표가 장기 공급 협력에 맞습니다.'};
 return null;
}

export function goalRelations(state){
 if(!active(state)||!OBJECTIVE_PLANS[state.playerId])return [];
 const ids=Object.keys(OBJECTIVE_PLANS),result=[];
 for(let first=0;first<ids.length;first++)for(let second=first+1;second<ids.length;second++){
  const countryId=ids[first],targetId=ids[second],match=pairType(state,countryId,targetId);if(!match)continue;
  result.push({countryId,targetId,type:match.type,title:title(countryId,targetId),reason:match.reason});
 }
 const relevant=item=>Number([item.countryId,item.targetId].includes(state.playerId));
 return result.sort((a,b)=>relevant(b)-relevant(a)||Number(b.type==='competition')-Number(a.type==='competition')||pairKey(a.countryId,a.targetId).localeCompare(pairKey(b.countryId,b.targetId))).slice(0,8);
}

export function goalPairAffinity(state,a,b,kind){
 if(!active(state)||!OBJECTIVE_PLANS[a]||!OBJECTIVE_PLANS[b]||a===b)return {scoreDelta:0,reason:''};
 const match=pairType(state,a,b);if(!match)return {scoreDelta:0,reason:''};
 if(match.type==='competition'){
  const lowRelation=relation(state,a,b)<45,trade=['trade_sell','trade_buy','sell','buy'].includes(kind);
  const scoreDelta=lowRelation?(trade?-8:-10):trade?-3:-5;
  return {scoreDelta,reason:`${title(a,b)} 목표가 같은 수출 시장에서 경쟁해 제안 부담이 ${Math.abs(scoreDelta)}점 커졌습니다.`};
 }
 const directionalTrade=kind==='trade_sell'&&EXPORTERS.includes(a)&&IMPORTERS.includes(b);
 const scoreDelta=directionalTrade?10:kind==='alliance'?8:4;
 return {scoreDelta,reason:`${title(a,b)} 목표가 서로 맞아 제안 반응이 ${scoreDelta}점 좋아졌습니다.`};
}

export function goalMarketContext(state,targetId,kind){
 if(!active(state)||!OBJECTIVE_PLANS[targetId]||targetId===state.playerId)return {scoreDelta:0,reasons:[]};
 const routes={buy:[targetId,state.playerId,'trade_sell'],trade_buy:[targetId,state.playerId,'trade_sell'],sell:[state.playerId,targetId,'trade_sell'],trade_sell:[state.playerId,targetId,'trade_sell'],alliance:[state.playerId,targetId,'alliance'],aid_out:[state.playerId,targetId,'alliance'],aid_in:[targetId,state.playerId,'alliance']};
 const route=routes[kind];if(!route)return {scoreDelta:0,reasons:[]};
 const [sourceId,destinationId,affinityKind]=route,source=state.countries[sourceId],destination=state.countries[destinationId];
 if(source.food<=30)return {scoreDelta:-8,reasons:[`${COUNTRIES[sourceId].name}의 식량 ${source.food}로는 국가 목표에 맞는 공급·지원 약속을 지키기 어려워 반응이 8점 낮아졌습니다.`]};
 if(destination.food>=97)return {scoreDelta:-6,reasons:[`${COUNTRIES[destinationId].name}의 저장 여력이 부족해 목표 협력의 실익이 낮아져 반응이 6점 낮아졌습니다.`]};
 const affinity=goalPairAffinity(state,sourceId,destinationId,affinityKind),relationDelta=relation(state,sourceId,destinationId)<35?-4:0;
 const scoreDelta=clampScore(affinity.scoreDelta+relationDelta);
 const reasons=[];if(affinity.reason)reasons.push(affinity.reason);if(relationDelta)reasons.push(`양국 관계 ${relation(state,sourceId,destinationId)}로 목표 협력의 신뢰가 낮아 반응이 4점 낮아졌습니다.`);
 return {scoreDelta,reasons};
}

function activeContract(state,sellerId,buyerId){
 const foreign=(state.foreignTreaties??[]).some(item=>item.status==='active'&&item.kind==='trade_sell'&&item.playerId===sellerId&&item.targetId===buyerId);
 const player=(state.treaties??[]).some(item=>item.status==='active'&&((item.kind==='trade_sell'&&item.playerId===sellerId&&item.targetId===buyerId)||(item.kind==='trade_buy'&&item.targetId===sellerId&&item.playerId===buyerId)));
 const agreement=(state.agreements??[]).some(item=>item.type==='trade'&&item.fromId===sellerId&&item.targetId===buyerId&&item.endTurn>state.turn);
 return foreign||player||agreement;
}

function competitionMarket(state,actions){
 const shipments=actions.filter(item=>item.type==='trade'&&EXPORTERS.includes(item.countryId)&&IMPORTERS.includes(item.targetId));
 for(const buyerId of IMPORTERS){
  const has=exporterId=>shipments.some(item=>item.countryId===exporterId&&item.targetId===buyerId)||activeContract(state,exporterId,buyerId);
  if(has('lumen')&&has('cera')&&shipments.some(item=>item.targetId===buyerId))return {buyerId,shipments};
 }
 return null;
}

function adjustRelation(state,a,b,delta){
 state.relations??={};const key=pairKey(a,b);state.relations[key]=Math.max(0,Math.min(100,Math.round(relation(state,a,b)+delta)));
}

export function runGoalRelations(next,before,parts,actions){
 next.lastGoalEvents=[];
 if(!active(next))return;
 const formed=(next.lastForeignEvents??[]).filter(item=>item.turn===next.turn&&item.type==='formed');
 for(const item of formed){
  const treaty=(next.foreignTreaties??[]).find(candidate=>candidate.id===item.treatyId),affinity=goalPairAffinity(next,item.countryId,item.targetId,treaty?.kind);if(!treaty||affinity.scoreDelta<=0)continue;
  const event={turn:next.turn,countryId:item.countryId,targetId:item.targetId,type:'cooperation',title:title(item.countryId,item.targetId),reason:affinity.reason,text:`${COUNTRIES[item.countryId].name}·${COUNTRIES[item.targetId].name}의 국가 목표가 새 협정으로 이어졌습니다.`,playerImpact:{treasury:0,relationDelta:0,text:'즉시 자원 이전은 없으며 체결된 협정 조건만 이후 분기에 이행됩니다.'}};
  next.lastGoalEvents.push(event);actions.push({...event,source:'national_goal'});
 }
 if(next.turn%4!==0)return;
 const market=competitionMarket(next,actions);if(!market)return;
 const playerExporter=EXPORTERS.includes(next.playerId),embargo=playerExporter&&next.activePolicy==='embargo';if(embargo)return;
 let sellerId=null,discount=0;
 if(playerExporter&&market.shipments.some(item=>item.countryId===next.playerId&&item.targetId===market.buyerId)){
  sellerId=next.playerId;discount=Math.min(1,next.countries[sellerId].treasury,Math.max(0,100-next.countries[market.buyerId].treasury));
 }else if(!playerExporter){
  const paid=market.shipments.find(item=>item.targetId===market.buyerId&&Number.isFinite(item.food)&&item.food>0&&Number.isFinite(item.money)&&item.money>0);sellerId=paid?.countryId??null;
  if(sellerId)discount=Math.min(1,next.countries[sellerId].treasury,Math.max(0,100-next.countries[market.buyerId].treasury));
 }
 if(!sellerId||!discount)return;
 next.countries[sellerId].treasury-=discount;next.countries[market.buyerId].treasury+=discount;const relationBefore=relation(next,'lumen','cera');adjustRelation(next,'lumen','cera',-2);const relationDelta=relation(next,'lumen','cera')-relationBefore,playerTreasury=sellerId===next.playerId?0-discount:market.buyerId===next.playerId?discount:0;
 const reason='루멘과 세라의 수출 목표가 같은 구매국의 실제 발주에서 겹쳤습니다.',text=`${COUNTRIES[market.buyerId].name} 측이 경쟁 조건으로 대금 ${discount}을 덜 지불해 ${COUNTRIES[sellerId].name}의 수출 수입이 같은 금액만큼 줄었습니다.`;
 const otherExporter=next.playerId==='lumen'?'cera':'lumen',impactText=playerExporter?`수출 수입 ${discount} 감소 · ${COUNTRIES[otherExporter].name} 관계 ${relationDelta}`:market.buyerId===next.playerId?`경쟁 조건으로 구매 대금 ${discount} 절감`:`두 수출국 관계 ${relationDelta}`;
 const event={turn:next.turn,countryId:'lumen',targetId:'cera',type:'competition',title:title('lumen','cera'),reason,text,marketImpact:{buyerId:market.buyerId,sellerId,discount},playerImpact:{treasury:playerTreasury,relationDelta:playerExporter?relationDelta:0,text:impactText}};
 next.lastGoalEvents.push(event);actions.push({...event,source:'national_goal'});
}

export function goalRequest(next,id){
 if(!active(next)||!OBJECTIVE_PLANS[id]||id===next.playerId)return null;
 const player=next.countries[next.playerId],country=next.countries[id],rel=relation(next,next.playerId,id);if(rel<30)return null;
 const base={goalTitle:OBJECTIVE_PLANS[id].title,goalReason:''};
 if(id==='altia'&&player.treasury>=12&&player.food<=97)return {...base,type:'technology',title:'알티아의 목표 기술 협력',description:'알티아가 연구 성과를 실제 농지에 보급할 공동 사업을 제안했습니다.',terms:{food:3,treasury:12,duration:4},goalReason:'연구 기술의 보급 범위를 넓히려는 협력입니다.'};
 if(EXPORTERS.includes(id)&&country.food>55&&player.food<=97&&player.treasury>=3)return {...base,type:'trade',title:`${COUNTRIES[id].name}의 목표 공급 협상`,description:`${COUNTRIES[id].name} 측이 비축 여력을 활용한 장기 공급 계약을 제안했습니다.`,terms:{food:3,treasury:12,duration:4},goalReason:'공급국의 수출 목표와 우리 비축 목표가 같은 계약으로 이어집니다.'};
 const need=id==='solis'?country.food<45:IMPORTERS.includes(id)&&country.food<53;
 if(need&&player.food>=35&&player.treasury>=2)return {...base,type:'aid',title:`${COUNTRIES[id].name}의 공동 비축 요청`,description:`${COUNTRIES[id].name} 측이 현재 부족분을 넘길 소규모 비축 지원을 요청했습니다.`,terms:{food:id==='solis'?5:4,treasury:2,duration:0},goalReason:id==='solis'?'다음 가뭄을 견딜 최소 비축을 먼저 확보하려는 요청입니다.':'수입 충격을 줄일 공동 비축을 만들려는 요청입니다.'};
 return null;
}

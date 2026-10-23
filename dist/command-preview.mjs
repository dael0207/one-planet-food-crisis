import {COUNTRIES,COUNTRY_IDS,PROFILES,SITE_DEFS,advanceTurn,getAction} from './engine.mjs?v=31';

const METRICS=[['food','식량'],['treasury','국고']];
const COUNTRY_METRICS=[['food','식량'],['treasury','국고'],['price','생활물가'],['approval','지지도'],['trust','신뢰']];
const relationKey=(a,b)=>[a,b].sort().join(':');
const signed=value=>`${value>0?'+':value<0?'−':''}${Math.abs(value)}`;
const pinBase=(id,countryId,siteKind,label,value,icon)=>({id,countryId,siteKind,label,value,tone:'preview',icon,action:'focus-order',changeId:null});

function metricModel(state,selected,baseline){
 const playerId=state.playerId??'lumen';
 return METRICS.map(([key,label])=>{
  const before=state.countries[playerId][key],after=selected.countries[playerId][key];
  return {key,label,before,after,delta:after-before,commandEffect:after-baseline.countries[playerId][key]};
 });
}

function strongestPlayerMetric(state,selected,baseline,kind){
 const playerId=state.playerId??'lumen',preferred=kind==='city'?'price':'food';
 return COUNTRY_METRICS.map(([key,label])=>({key,label,before:state.countries[playerId][key],after:selected.countries[playerId][key],effect:selected.countries[playerId][key]-baseline.countries[playerId][key]}))
  .filter(item=>item.effect!==0)
  .sort((a,b)=>(b.key===preferred)-(a.key===preferred)||Math.abs(b.effect)-Math.abs(a.effect))[0]??{key:'food',label:'식량',before:state.countries[playerId].food,after:selected.countries[playerId].food,effect:0};
}

function facilityPin(state,action,selected,baseline){
 const playerId=state.playerId??'lumen';
 if(action.jointInvestment){
  const {targetId,kind}=action.jointInvestment,accepted=action.jointPreview?.outcome==='accepted';
  const remaining=accepted?Math.max(0,(action.jointPreview?.dueTurn??selected.turn)-(state.turn+1)):0;
  const value=accepted?`착공 예정 · ${remaining}분기 뒤`:'협상 결과 거절 예상 · 투자금 지출 없음';
  return pinBase(`preview:joint:${targetId}:${kind}`,targetId,kind,SITE_DEFS[kind].name,value,accepted?'build':'reply');
 }
 if(action.site){
  const {kind,operation}=action.site,label=SITE_DEFS[kind].name;
  if(operation==='upgrade'){
   const project=selected.history.at(-1)?.siteDevelopment?.started?.find(item=>item.countryId===playerId&&item.siteKind===kind);
   const remaining=Math.max(0,(project?.dueTurn??selected.turn)-selected.turn);
   return pinBase(`preview:site:${playerId}:${kind}`,playerId,kind,label,`착공 예정 · ${remaining}분기 뒤`,'build');
  }
  const metric=strongestPlayerMetric(state,selected,baseline,kind);
  return pinBase(`preview:site:${playerId}:${kind}`,playerId,kind,label,`${metric.label} ${metric.before} → ${metric.after} 예상${metric.effect?` · 유지 대비 ${signed(metric.effect)}`:''}`,'arrow');
 }
 const project=selected.history.at(-1)?.development?.started?.find(item=>item.countryId===playerId);
 const baselineProjects=baseline.history.at(-1)?.development?.started??[];
 if(project&&!baselineProjects.some(item=>item.countryId===project.countryId&&item.dueTurn===project.dueTurn)){
  const remaining=Math.max(0,(project?.dueTurn??selected.turn)-selected.turn);
  return pinBase(`preview:project:${playerId}`,playerId,null,PROFILES[playerId].facilityName,`착공 예정 · ${remaining}분기 뒤`,'build');
 }
 return null;
}

function targetIds(state,action){
 const offer=action.peaceReply?.offerId&&state.peaceOffers?.find(item=>item.id===action.peaceReply.offerId);
 const treaty=action.treatyBreakId&&state.treaties?.find(item=>item.id===action.treatyBreakId);
 const request=action.requestId&&state.requests?.find(item=>item.id===action.requestId);
 const mediationRecord=action.mediation?.recordId&&state.mediations?.find(item=>item.id===action.mediation.recordId);
 const conflictId=action.mediationPreview?.draft?.conflictId??mediationRecord?.conflictId??action.conflictChoice?.conflictId;
 const conflict=conflictId&&state.goalConflicts?.find(item=>item.id===conflictId);
 const targets=[action.site?.sellerId,action.jointInvestment?.targetId,action.proposal?.targetId,action.treatyDraft?.targetId,action.targetId,offer?.fromId,treaty?.targetId,request?.fromId,action.peaceCompliancePreview?.violatorId,conflict?.initiatorId,conflict?.targetId];
 if(action.negotiationId)targets.push(state.negotiations?.find(item=>item.id===action.negotiationId)?.targetId);
 return targets.filter((id,index)=>id&&targets.indexOf(id)===index);
}

function foreignPin(state,action,selected,baseline){
 const playerId=state.playerId??'lumen',targets=targetIds(state,action);
 const candidates=COUNTRY_IDS.filter(id=>id!==playerId).map(countryId=>{
  const resources=METRICS.map(([key,label])=>({key,label,before:state.countries[countryId][key],after:selected.countries[countryId][key],effect:selected.countries[countryId][key]-baseline.countries[countryId][key]})).filter(item=>item.effect!==0);
  const key=relationKey(playerId,countryId),relation={before:state.relations?.[key]??50,after:selected.relations?.[key]??50,effect:(selected.relations?.[key]??50)-(baseline.relations?.[key]??50)};
  const other=COUNTRY_METRICS.slice(2).map(([metric,label])=>({metric,label,before:state.countries[countryId][metric],after:selected.countries[countryId][metric],effect:selected.countries[countryId][metric]-baseline.countries[countryId][metric]})).filter(item=>item.effect!==0);
  const effectScore=resources.reduce((sum,item)=>sum+Math.abs(item.effect),0)+Math.abs(relation.effect)+other.reduce((sum,item)=>sum+Math.abs(item.effect),0);
  const score=effectScore+(effectScore&&targets.includes(countryId)?1000:0);
  return {countryId,resources,relation,other,score};
 }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.countryId.localeCompare(b.countryId));
 const candidate=candidates[0];
 if(!candidate)return null;
 const name=COUNTRIES[candidate.countryId].name;
 if(candidate.resources.length){
  const value=`유지 대비 ${candidate.resources.map(item=>`${item.label} ${signed(item.effect)}`).join(' · ')} 예상`;
  return pinBase(`preview:country:${candidate.countryId}`,candidate.countryId,null,name,value,'arrow');
 }
 if(candidate.relation.effect){
  return pinBase(`preview:relation:${candidate.countryId}`,candidate.countryId,null,`${name} 관계`,`관계 ${candidate.relation.before} → ${candidate.relation.after} 예상 · 유지 대비 ${signed(candidate.relation.effect)}`,'reply');
 }
 const metric=candidate.other[0];
 return pinBase(`preview:country:${candidate.countryId}:${metric.metric}`,candidate.countryId,null,name,`${metric.label} ${metric.before} → ${metric.after} 예상 · 유지 대비 ${signed(metric.effect)}`,'arrow');
}

function responsePin(state,action){
 const target=targetIds(state,action).find(id=>id!==state.playerId&&COUNTRIES[id]);
 if(!target)return null;
 const outcome=action.treatyPreview?.response??action.preview?.response??action.mediationPreview?.outcome;
 const outcomes={accept:'수락 예상',accepted:'합의 예상',reject:'거절 예상',rejected:'거절 예상',counter:'역제안 예상',countered:'역제안 예상',escalated:'갈등 확대 예상'};
 const value=action.peaceReply?.kind==='decline'?'평화 제안 거절 예정 · 직접 변화 없음':outcomes[outcome]??`${action.name} 예정`;
 return pinBase(`preview:response:${target}`,target,null,COUNTRIES[target].name,value,'reply');
}

function playerFoodPin(state,selected){
 const playerId=state.playerId??'lumen',before=state.countries[playerId].food,after=selected.countries[playerId].food;
 return pinBase(`preview:food:${playerId}`,playerId,null,'분기 식량',`식량 ${before} → ${after} 예상`,'arrow');
}

const compactBreakdown=record=>(record?.foodBreakdown??[]).map(part=>({label:String(part.label??''),value:Number(part.value)||0}));
const compactFacilities=record=>{
 const rows=[];
 for(const item of record?.development?.started??[])rows.push({countryId:record.playerId,siteKind:'national',status:'started',dueTurn:item.dueTurn});
 for(const item of record?.development?.completed??[])rows.push({countryId:record.playerId,siteKind:'national',status:'completed',dueTurn:item.dueTurn});
 for(const item of record?.siteDevelopment?.started??[])rows.push({countryId:item.countryId,siteKind:item.siteKind,status:'started',dueTurn:item.dueTurn});
 for(const item of record?.siteDevelopment?.completed??[])rows.push({countryId:item.countryId,siteKind:item.siteKind,status:'completed',dueTurn:item.dueTurn});
 for(const item of record?.jointInvestmentEvents??[]){
  if(item.type==='started'&&item.targetId&&item.kind)rows.push({countryId:item.targetId,siteKind:item.kind,status:'started',dueTurn:item.dueTurn});
 }
 return rows.slice(0,2);
};
const compactOutcomes=(record,playerId)=>(record?.worldActions??[]).filter(item=>(item.countryId===playerId||item.targetId===playerId)&&['trade','agreement','delivery','fulfilled','suspended','breach','sanction'].includes(item.type)).map(item=>({source:String(item.source??''),type:String(item.type??''),countryId:item.countryId??null,targetId:item.targetId??null,food:Number(item.food)||0,money:Number(item.money)||0})).slice(0,12);
function projectionModel(state,action,selected,baseline,pins){
 const playerId=state.playerId??'lumen',record=selected.history.at(-1);
 const facilities=compactFacilities(record);
 if(action.jointInvestment&&action.jointPreview?.outcome==='accepted'){
  const contract=(selected.jointInvestments??[]).find(item=>item.targetId===action.jointInvestment.targetId&&item.kind===action.jointInvestment.kind&&item.status==='building');
  if(contract)facilities.unshift({countryId:contract.targetId,siteKind:contract.kind,status:'started',dueTurn:contract.dueTurn});
 }
 const displayedCountries=[...new Set(pins.map(pin=>pin.countryId).filter(id=>id&&id!==playerId))];
 const foreign=displayedCountries.map(countryId=>{
  const metrics=METRICS.filter(([key])=>selected.countries[countryId][key]!==baseline.countries[countryId][key]).map(([key])=>({key,value:selected.countries[countryId][key]}));
  const key=relationKey(playerId,countryId),relation=(selected.relations?.[key]??50)!==(baseline.relations?.[key]??50)?selected.relations?.[key]??50:null;
  return {countryId,metrics,relation};
 }).filter(item=>item.metrics.length||item.relation!==null);
 return {
  metrics:{food:selected.countries[playerId].food,treasury:selected.countries[playerId].treasury},
  actionCost:Number(action.cost)||0,
  foodBreakdown:compactBreakdown(record),
  relations:(record?.policyRelationEffects??[]).filter(item=>displayedCountries.includes(item.countryId)).map(item=>({countryId:item.countryId,after:item.after})).slice(0,2),
  foreign:foreign.slice(0,2),
  facilities:facilities.slice(0,2),
  outcomes:compactOutcomes(record,playerId)
 };
}

export function commandPreview(state,command){
 if(!state||typeof command!=='string'||!command)return null;
 const playerId=state.playerId??'lumen',action=getAction({...state,playerId},command),player=state.countries?.[playerId];
 if(!action||!player||player.treasury<action.cost||player.food<(action.foodCost??0))return null;
 const selected=advanceTurn(structuredClone(state),command),baseline=advanceTurn(structuredClone(state),'maintain');
 const primary=facilityPin(state,action,selected,baseline),foreign=foreignPin(state,action,selected,baseline)??responsePin(state,action);
 const pins=[];
 if(primary)pins.push(primary);
 if(foreign&&(!primary||foreign.countryId!==primary.countryId||foreign.siteKind!==primary.siteKind))pins.push(foreign);
 if(pins.length<2)pins.push(playerFoodPin(state,selected));
 const visiblePins=pins.slice(0,2);
 return {mode:'preview',heading:action.name,actionLabel:'선택한 명령',commandId:command,context:{playerId,sourceTurn:state.turn},notice:'현재 조건 모의계산 · 실행 전',pins:visiblePins,metrics:metricModel(state,selected,baseline),projection:projectionModel(state,action,selected,baseline,visiblePins)};
}

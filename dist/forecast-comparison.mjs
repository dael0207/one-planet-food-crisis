import {COUNTRIES,COUNTRY_IDS,PROFILES,SITE_DEFS,SITE_KINDS} from './engine.mjs?v=31';

const relationKey=(a,b)=>[a,b].sort().join(':');
const number=value=>Number.isFinite(value)?value:null;
const validId=id=>COUNTRY_IDS.includes(id);
const compactPart=part=>part&&typeof part.label==='string'&&Number.isFinite(part.value)?{label:part.label.slice(0,80),value:part.value}:null;
const validFacility=item=>item&&validId(item.countryId)&&(item.siteKind==='national'||SITE_KINDS.includes(item.siteKind))&&['started','completed'].includes(item.status)&&Number.isSafeInteger(item.dueTurn);
const clone=value=>structuredClone(value);
const array=value=>Array.isArray(value)?value:[];

export function forecastSnapshot(model,state,command){
 if(!model||model.mode!=='preview'||model.commandId!==command||!state||typeof command!=='string'||!model.projection)return null;
 const playerId=state.playerId??'lumen',projection=model.projection;
 const food=number(projection.metrics?.food),treasury=number(projection.metrics?.treasury),actionCost=number(projection.actionCost);
 if(!validId(playerId)||!Number.isSafeInteger(state.turn)||model.context?.playerId!==playerId||model.context?.sourceTurn!==state.turn||food===null||treasury===null||actionCost===null||actionCost<0)return null;
 return {
  playerId,commandId:command,sourceTurn:state.turn,resultTurn:state.turn+1,heading:String(model.heading??'').slice(0,80),
  projection:{
   metrics:{food,treasury},
   actionCost,
   foodBreakdown:array(projection.foodBreakdown).map(compactPart).filter(Boolean).slice(0,24),
   relations:array(projection.relations).filter(item=>validId(item?.countryId)&&item.countryId!==playerId&&Number.isFinite(item.after)).map(item=>({countryId:item.countryId,after:item.after})).slice(0,2),
   foreign:array(projection.foreign).filter(item=>validId(item?.countryId)&&item.countryId!==playerId).map(item=>({countryId:item.countryId,metrics:array(item.metrics).filter(metric=>['food','treasury'].includes(metric?.key)&&Number.isFinite(metric.value)).map(metric=>({key:metric.key,value:metric.value})).slice(0,2),relation:number(item.relation)})).filter(item=>item.metrics.length||item.relation!==null).slice(0,2),
   facilities:array(projection.facilities).filter(validFacility).map(item=>({countryId:item.countryId,siteKind:item.siteKind,status:item.status,dueTurn:item.dueTurn})).slice(0,2),
   outcomes:array(projection.outcomes).filter(item=>item&&typeof item.source==='string'&&typeof item.type==='string'&&(item.countryId===null||validId(item.countryId))&&(item.targetId===null||validId(item.targetId))&&Number.isFinite(item.food)&&Number.isFinite(item.money)).map(item=>({source:item.source.slice(0,40),type:item.type.slice(0,40),countryId:item.countryId,targetId:item.targetId,food:item.food,money:item.money})).slice(0,12)
  }
 };
}

export function validForecastSnapshot(value,{playerId,commandId,resultTurn}={}){
 if(!value||typeof value!=='object'||!validId(value.playerId)||typeof value.commandId!=='string'||!value.commandId||value.commandId.length>160||!Number.isSafeInteger(value.sourceTurn)||!Number.isSafeInteger(value.resultTurn)||value.resultTurn!==value.sourceTurn+1||!value.projection)return null;
 if(playerId&&value.playerId!==playerId||commandId&&value.commandId!==commandId||resultTurn&&value.resultTurn!==resultTurn)return null;
 const safe=forecastSnapshot({mode:'preview',commandId:value.commandId,heading:value.heading,context:{playerId:value.playerId,sourceTurn:value.sourceTurn},projection:value.projection},{playerId:value.playerId,turn:value.sourceTurn},value.commandId);
 return safe&&safe.resultTurn===value.resultTurn?safe:null;
}

export function attachForecast(state,snapshot){
 const last=state?.history?.at(-1),safe=validForecastSnapshot(snapshot,{playerId:state?.playerId,commandId:last?.policyId,resultTurn:state?.turn});
 if(!safe||!last)return state;
 return {...state,history:[...state.history.slice(0,-1),{...last,forecast:clone(safe)}]};
}

const signed=value=>`${value>0?'+':value<0?'−':''}${Math.abs(value)}`;
const category=label=>/기후|가뭄|강수|수확/.test(label)?'기후·수확':/무역|교역|수입|수출|공급|협정/.test(label)?'무역·협정':/시설|농경지|생산/.test(label)?'생산·시설':/소비|배급/.test(label)?'소비':'기타';
const categoryTotals=parts=>(parts??[]).reduce((groups,part)=>{const key=category(String(part.label??''));(groups[key]??=[]).push(part);return groups;},{});
const sum=items=>(items??[]).reduce((total,item)=>total+(Number(item.value)||0),0);
const facilityName=item=>item.siteKind==='national'?PROFILES[item.countryId].facilityName:SITE_DEFS[item.siteKind].name;
const facilityValue=(item,resultTurn,actual=false)=>item.status==='completed'?(actual?'완공':'완공 예정'):`${actual?'착공':'착공 예정'} · ${Math.max(0,item.dueTurn-resultTurn)}분기 뒤`;

export function forecastComparison(state){
 const last=state?.history?.at(-1),snapshot=validForecastSnapshot(last?.forecast,{playerId:state?.playerId,commandId:last?.policyId,resultTurn:state?.turn});
 if(!last||!snapshot)return {status:'missing',summary:'실행 전 예상 기록이 없습니다.',rows:[],reasons:[]};
 const expected=snapshot.projection,actualCountry=state.countries[state.playerId],rows=[];
 for(const [key,label,unit] of [['food','식량',''],['treasury','국고','억']]){
  const forecast=expected.metrics[key],actual=actualCountry[key],difference=actual-forecast;
  rows.push({key,label,expected:forecast,actual,difference,unit});
 }
 for(const item of expected.relations){
  const actual=state.relations?.[relationKey(state.playerId,item.countryId)]??50;
  rows.push({key:`relation:${item.countryId}`,label:`${COUNTRIES[item.countryId].name} 관계`,expected:item.after,actual,difference:actual-item.after,unit:''});
 }
 for(const foreign of expected.foreign){
  for(const metric of foreign.metrics){
   const actual=state.countries[foreign.countryId][metric.key];
   rows.push({key:`foreign:${foreign.countryId}:${metric.key}`,label:`${COUNTRIES[foreign.countryId].name} ${metric.key==='food'?'식량':'국고'}`,expected:metric.value,actual,difference:actual-metric.value,unit:metric.key==='treasury'?'억':''});
  }
  if(foreign.relation!==null&&!rows.some(row=>row.key===`relation:${foreign.countryId}`)){
   const actual=state.relations?.[relationKey(state.playerId,foreign.countryId)]??50;
   rows.push({key:`relation:${foreign.countryId}`,label:`${COUNTRIES[foreign.countryId].name} 관계`,expected:foreign.relation,actual,difference:actual-foreign.relation,unit:''});
  }
 }
 const actualFacilities=[...(last.development?.started??[]).map(item=>({countryId:last.playerId,siteKind:'national',status:'started',dueTurn:item.dueTurn})),...(last.development?.completed??[]).map(item=>({countryId:last.playerId,siteKind:'national',status:'completed',dueTurn:item.dueTurn})),...(last.siteDevelopment?.started??[]).map(item=>({...item,status:'started'})),...(last.siteDevelopment?.completed??[]).map(item=>({...item,status:'completed'})),...(state.jointInvestments??[]).filter(item=>item.status==='building').map(item=>({countryId:item.targetId,siteKind:item.kind,status:'started',dueTurn:item.dueTurn}))];
 for(const item of expected.facilities){
  const match=actualFacilities.find(actual=>actual.countryId===item.countryId&&actual.siteKind===item.siteKind&&actual.status===item.status&&actual.dueTurn===item.dueTurn);
  rows.push({key:`facility:${item.countryId}:${item.siteKind}:${item.status}`,label:`${COUNTRIES[item.countryId].name} ${facilityName(item)}`,expected:facilityValue(item,snapshot.resultTurn),actual:match?facilityValue(item,state.turn,true):'기록 없음',difference:match?0:null,unit:''});
 }
 const reasons=[];
 const expectedGroups=categoryTotals(expected.foodBreakdown),actualGroups=categoryTotals(last.foodBreakdown);
 let foodEvidence=0;
 for(const name of new Set([...Object.keys(expectedGroups),...Object.keys(actualGroups)])){
  const forecast=sum(expectedGroups[name]),actual=sum(actualGroups[name]),delta=actual-forecast;
  if(delta){foodEvidence+=delta;reasons.push(`${name}: 예상 ${signed(forecast)} → 실제 ${signed(actual)} (${signed(delta)}).`);}
 }
 const costEvidence=expected.actionCost-last.actionCost;
 if(costEvidence)reasons.push(`명령 비용이 예상 ${expected.actionCost}억, 실제 ${last.actionCost}억으로 달랐습니다.`);
 const actualOutcomes=(last.worldActions??[]).filter(item=>(item.countryId===state.playerId||item.targetId===state.playerId)&&['trade','agreement','delivery','fulfilled','suspended','breach','sanction'].includes(item.type)).map(item=>({source:String(item.source??''),type:String(item.type??''),countryId:item.countryId??null,targetId:item.targetId??null,food:Number(item.food)||0,money:Number(item.money)||0})).slice(0,12);
 if(JSON.stringify(actualOutcomes)!==JSON.stringify(expected.outcomes))reasons.push('무역·협정 이행 기록이 실행 전 예상과 달랐습니다.');
 for(const row of rows){
  if(row.difference===0)continue;
  const evidence=row.key==='food'?foodEvidence:row.key==='treasury'?costEvidence:0;
  const residual=typeof row.difference==='number'?row.difference-evidence:null;
  if(residual===0)continue;
  const forecast=typeof row.expected==='number'?`${row.expected}${row.unit}`:row.expected,actual=typeof row.actual==='number'?`${row.actual}${row.unit}`:row.actual;
  const remainder=evidence&&residual!==null?` 중 ${signed(residual)}${row.unit}`:'';
  reasons.push(`${row.label}: 예상 ${forecast} → 실제 ${actual} 차이${remainder}의 원인은 기록에서 확인되지 않았습니다.`);
 }
 const different=rows.some(row=>row.difference!==0)||reasons.length>0;
 return {status:different?'different':'matched',summary:different?'예상과 실제가 달랐습니다.':'예상대로',rows,reasons,snapshot:clone(snapshot)};
}

export {signed};

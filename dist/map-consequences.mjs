import {COUNTRIES, COUNTRY_IDS} from './country-data.mjs?v=31';
import {quarterDate} from './calendar.mjs?v=31';
import {PROFILES} from './nation-profiles.mjs?v=31';
import {SITE_DEFS, SITE_KINDS} from './site-operations.mjs?v=31';
import {jointConstructionBenefit} from './construction-benefits.mjs?v=31';

const JOINT_LABELS={farm:'공동 농경지',port:'공동 항만'};
const SANCTION_TYPES=new Set(['sanction','conflict','ceasefire_ended','expiry','accord_sanctioned','accord_restriction_expired','peace_response_sanction','peace_response_expired']);
const SANCTION_SOURCES=new Set(['goal_conflict','peace_compliance','peace_response']);
const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const validCountry=id=>COUNTRY_IDS.includes(id);
const validSite=kind=>SITE_KINDS.includes(kind);
const lastRecord=state=>Array.isArray(state?.history)?state.history.at(-1):null;
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const calendar=turn=>{const date=quarterDate(Math.max(0,number(turn)-1));return `${date.year}년 ${date.quarter}분기`;};

function consequence(record,{rank,kind,countryId,siteKind=null,title,detail,sequence=0}){
 if(!validCountry(countryId)||siteKind!==null&&!validSite(siteKind))return null;
 const turn=Number.isSafeInteger(record?.turn)?record.turn:0;
 return {id:`${turn}:${kind}:${countryId}:${siteKind??'country'}:${sequence}`,countryId,...(siteKind?{siteKind}:{}),kind,title,detail,turn,rank};
}

function domesticConsequences(state,record){
 const countryId=validCountry(record.playerId)?record.playerId:(validCountry(state.playerId)?state.playerId:'lumen');
 const country=COUNTRIES[countryId].name,items=[];
 for(const [sequence,project] of (record.development?.completed??[]).entries())items.push(consequence(record,{rank:84,kind:'national-completed',countryId,title:`${country} ${PROFILES[countryId].facilityName} 완공`,detail:`${number(record.development.levelAfter)}단계 운영 시작`,sequence}));
 for(const [sequence,project] of (record.development?.started??[]).entries())items.push(consequence(record,{rank:72,kind:'national-started',countryId,title:`${country} ${PROFILES[countryId].facilityName} 착공`,detail:`국고 ${number(record.actionCost)}억 지출 · ${calendar(project.dueTurn)} 완공 예정`,sequence}));
 for(const [sequence,project] of (record.siteDevelopment?.completed??[]).entries()){
  if(!validSite(project.siteKind))continue;
  items.push(consequence(record,{rank:88,kind:'site-completed',countryId,siteKind:project.siteKind,title:`${country} ${SITE_DEFS[project.siteKind].name} 완공`,detail:`${number(project.level)}단계 운영 시작`,sequence}));
 }
 for(const [sequence,project] of (record.siteDevelopment?.started??[]).entries()){
  if(!validSite(project.siteKind))continue;
  const operation=(record.siteOperations??[]).find(item=>item.source==='site'&&item.kind===project.siteKind&&item.operation==='upgrade');
  const cost=Math.abs(number(operation?.money));
  items.push(consequence(record,{rank:76,kind:'site-started',countryId,siteKind:project.siteKind,title:`${country} ${SITE_DEFS[project.siteKind].name} 착공`,detail:`국고 ${cost}억 지출 · ${calendar(project.dueTurn)} 완공 예정 · ${SITE_DEFS[project.siteKind].benefit}`,sequence}));
 }
 return items.filter(Boolean);
}

function jointConsequence(state,record,event,sequence){
 if(event?.source!=='joint_investment'||!validCountry(event.countryId)||!['farm','port'].includes(event.kind))return null;
 const country=COUNTRIES[event.countryId].name,facility=JOINT_LABELS[event.kind],base={countryId:event.countryId,siteKind:event.kind,sequence};
 const site=state.foreignSites?.[event.countryId]?.[event.kind],contract=(state.jointInvestments??[]).find(item=>item.targetId===event.countryId&&item.kind===event.kind&&item.proposedTurn===record.turn),level=number(site?.project?.level||site?.level);
 if(event.operation==='settlement'&&number(event.food)>0)return consequence(record,{...base,rank:120,kind:'joint-food',title:`${country} ${facility} 식량 배분`,detail:`식량 +${number(event.food)} · 실제 배분 완료`});
 if(event.operation==='settlement'&&number(event.money)>0)return consequence(record,{...base,rank:118,kind:'joint-revenue',title:`${country} ${facility} 수익 배분`,detail:`국고 +${number(event.money)}억 · 실제 정산 완료`});
 if(event.operation==='suspended')return consequence(record,{...base,rank:112,kind:'joint-suspended',title:`${country} ${facility} 공급 중단`,detail:event.reason||'공급과 정산 중단'});
 if(event.operation==='resumed')return consequence(record,{...base,rank:108,kind:'joint-resumed',title:`${country} ${facility} 공급 재개`,detail:event.reason||'공급과 정산 재개'});
 if(event.operation==='activated')return consequence(record,{...base,rank:102,kind:'joint-activated',title:`${country} ${facility}${level?` ${level}단계`:''} 완공`,detail:'공동 운영과 성과 배분 시작'});
 if(event.operation==='accepted')return consequence(record,{...base,rank:96,kind:'joint-started',title:level>1?`${country} ${facility} ${level}단계 시설 확장`:`${country} ${facility} 착공`,detail:`투자금 ${number(event.money)}억 집행 · ${calendar(contract?.dueTurn??site?.project?.dueTurn)} 완공 예정 · ${jointConstructionBenefit(state,contract)}`});
 if(event.operation==='completed')return consequence(record,{...base,rank:82,kind:'joint-completed',title:`${country} ${facility} 약정 종료`,detail:event.reason||'약정 기간 만료'});
 return null;
}

function tradeConsequences(state,record){
 return (record.worldActions??[]).flatMap((action,sequence)=>{
  if(action?.type!=='trade'||action.source==='joint_investment'||!(number(action.food)>0))return [];
  const fromId=validCountry(action.shipmentFromId)?action.shipmentFromId:action.countryId,toId=validCountry(action.shipmentToId)?action.shipmentToId:action.targetId,player=state.playerId;
  if(!validCountry(fromId)||!validCountry(toId)||![fromId,toId].includes(player))return [];
  const incoming=toId===player,impact=Number.isFinite(Number(action.playerImpact?.food))?Number(action.playerImpact.food):(incoming?number(action.food):-number(action.food));
  const siteKind=action.source==='foreign_site'&&validSite(action.kind)?action.kind:null,countryId=siteKind?action.countryId:(incoming?fromId:toId);
  return [consequence(record,{rank:68,kind:'food-trade',countryId,siteKind,title:`${COUNTRIES[fromId].name} → ${COUNTRIES[toId].name} 식량 ${incoming?'유입':'공급'}`,detail:`식량 ${impact>0?'+':'−'}${Math.abs(impact)} · 실제 이동 완료`,sequence})];
 }).filter(Boolean);
}

function sanctionConsequences(state,record){
 const partners=new Set((state.jointInvestments??[]).map(item=>item.targetId).filter(validCountry));
 const relevant=id=>id===state.playerId||partners.has(id);
 return (record.worldActions??[]).flatMap((action,sequence)=>{
  if(!SANCTION_SOURCES.has(action?.source)||!SANCTION_TYPES.has(action.type)||!validCountry(action.countryId)||!validCountry(action.targetId))return [];
  if(!relevant(action.countryId)&&!relevant(action.targetId))return [];
  const ended=['ceasefire_ended','expiry','accord_restriction_expired','peace_response_expired'].includes(action.type),title=`${COUNTRIES[action.countryId].name}–${COUNTRIES[action.targetId].name} ${ended?'제재 상태 변경':'교역 제재'}`;
  return [consequence(record,{rank:104,kind:`sanction-${action.type}`,countryId:relevant(action.targetId)?action.targetId:action.countryId,title,detail:action.text||'기록된 교역 제한 상태 변경',sequence})];
 }).filter(Boolean);
}

export function mapConsequences(state){
 const record=lastRecord(state);
 if(!record||!Number.isSafeInteger(record.turn))return [];
 const items=[...domesticConsequences(state,record),...(record.jointInvestmentEvents??[]).map((event,index)=>jointConsequence(state,record,event,index)).filter(Boolean),...sanctionConsequences(state,record),...tradeConsequences(state,record)];
 return items.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id)).slice(0,3).map(({rank,...item})=>item);
}

export function renderMapConsequences(state,phase='decision'){
 const items=mapConsequences(state);if(!items.length)return '';
 const turn=items[0].turn,period=phase==='result'?`이번 완료 분기 · ${calendar(turn)}`:`지난 완료 분기 · ${calendar(turn)}`;
 return `<section class="map-consequences" data-map-consequences data-phase="${phase==='result'?'result':'decision'}" aria-labelledby="map-consequences-title"><header><span>${escape(period)}</span><strong id="map-consequences-title">지도에서 달라진 곳</strong></header><ul>${items.map(item=>`<li data-change-id="${escape(item.id)}"><div><strong>${escape(item.title)}</strong><details><summary>실제 영향 보기</summary><p>${escape(item.detail)}</p></details></div><button type="button" class="text-button" data-action="focus-map-change" data-change-id="${escape(item.id)}" data-country="${escape(item.countryId)}"${item.siteKind?` data-site="${escape(item.siteKind)}"`:''}>지도에서 보기</button></li>`).join('')}</ul></section>`;
}

export function updateMapConsequences(svg,state,phase='decision'){
 if(!svg)return [];
 for(const target of svg.querySelectorAll('[data-map-consequence]')){delete target.dataset.mapConsequence;target.classList.remove('is-map-consequence');}
 const items=mapConsequences(state);
 for(const [index,item] of items.entries()){
  const selectors=[`.land[data-country="${item.countryId}"]`,item.siteKind?`.map-site-target[data-country="${item.countryId}"][data-site="${item.siteKind}"]`:null].filter(Boolean);
  for(const selector of selectors){const target=svg.querySelector(selector);if(!target)continue;if(!target.dataset.mapConsequence)target.dataset.mapConsequence=String(index+1);target.classList.add('is-map-consequence');}
 }
 svg.dataset.mapConsequencePhase=phase==='result'?'result':'decision';
 return items;
}

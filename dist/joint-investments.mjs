import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';
import {tradeBlocked} from './goal-conflicts.mjs?v=30';
import {createForeignSites} from './foreign-sites.mjs?v=30';
import {getRelation} from './negotiations.mjs?v=30';

const KINDS=['port','farm'];
const CAPITALS=[12,20,28];
const SHARES=[25,50,75];
const DURATIONS=[4,8,12];
const THRESHOLD=70;
const RESERVE=20;
const COSTS={port:level=>14+5*level,farm:level=>12+4*level};

const enabledAt=(state,turn)=>Number.isSafeInteger(state.jointStartTurn)&&turn>=state.jointStartTurn&&turn>=(state.foreignSiteStartTurn??1);
const activeStatus=status=>['building','active','suspended'].includes(status);
const relationKey=(a,b)=>[a,b].sort().join(':');
const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));

function parseDraft(draft){
 if(!draft||typeof draft!=='object')return null;
 const normalized={targetId:draft.targetId,kind:draft.kind,capital:Number(draft.capital),share:Number(draft.share),duration:Number(draft.duration)};
 return COUNTRY_IDS.includes(normalized.targetId)&&KINDS.includes(normalized.kind)&&CAPITALS.includes(normalized.capital)&&SHARES.includes(normalized.share)&&DURATIONS.includes(normalized.duration)?normalized:null;
}

export function jointCommand(draft){
 const parsed=parseDraft(draft);
 return parsed?`join:${parsed.targetId}:${parsed.kind}:${parsed.capital}:${parsed.share}:${parsed.duration}`:null;
}

function parseCommand(command){
 if(typeof command!=='string')return null;
 const match=/^join:([a-z]+):(port|farm):(12|20|28):(25|50|75):(4|8|12)$/.exec(command);
 if(!match)return null;
 const draft={targetId:match[1],kind:match[2],capital:Number(match[3]),share:Number(match[4]),duration:Number(match[5])};
 return jointCommand(draft)===command?draft:null;
}

function unavailablePreview(draft,blockedReason){
 return {valid:Boolean(draft),eligible:false,outcome:'rejected',score:0,threshold:THRESHOLD,reasons:blockedReason?[blockedReason]:[],blockedReason,affordable:false,cost:0,relation:0,expectedFood:0,expectedRevenue:0,constructionCost:0,dueTurn:null,endTurn:null,draft};
}

function evaluate(state,input,turn){
 const draft=parseDraft(input);
 if(!draft)return unavailablePreview(null,'공동 투자 조건이 올바르지 않습니다.');
 const playerId=state.playerId??'lumen';
 if(draft.targetId===playerId)return unavailablePreview(draft,'자국 현장에는 공동 투자할 수 없습니다.');
 if(!enabledAt(state,turn))return unavailablePreview(draft,'공동 투자 협의가 아직 시작되지 않았습니다.');
 const site=state.foreignSites?.[draft.targetId]?.[draft.kind]??{level:0,project:null};
 const existing=(state.jointInvestments??[]).find(item=>item.targetId===draft.targetId&&item.kind===draft.kind&&activeStatus(item.status));
 if(site.level>=3)return unavailablePreview(draft,'상대국 현장이 이미 최대 단계입니다.');
 if(site.project)return unavailablePreview(draft,'상대국 현장이 이미 건설 중입니다.');
 if(existing)return unavailablePreview(draft,'같은 상대국 현장에 진행 중인 공동 투자가 있습니다.');
 const relation=getRelation(state,playerId,draft.targetId),host=state.countries[draft.targetId],constructionCost=COSTS[draft.kind](site.level);
 const blocked=tradeBlocked({...state,turn},playerId,draft.targetId),need=draft.kind==='farm'?Math.max(0,65-host.food):Math.max(0,60-host.food)+Math.max(0,host.price-105)/2;
 const capitalScore={12:0,20:8,28:16}[draft.capital],shareScore={25:12,50:4,75:-10}[draft.share],durationScore={4:0,8:6,12:10}[draft.duration];
 const financeReady=host.treasury+draft.capital-constructionCost>=RESERVE&&host.treasury+draft.capital-constructionCost<=100;
 let score=clamp(relation+Math.min(16,Math.floor(need/2))+capitalScore+shareScore+durationScore+(blocked?-100:0)+(financeReady?0:-30));
 const reasons=[`양국 관계 ${relation}`,`현지 필요도 ${Math.min(16,Math.floor(need/2))}`,`투자금 조건 +${capitalScore}`,`수익 배분 조건 ${shareScore>=0?'+':''}${shareScore}`,`운영 기간 +${durationScore}`];
 if(relation<45)reasons.push('관계가 35 미만으로 내려가면 공급과 정산이 중단되며 45 이상에서만 재개됩니다.');
 if(blocked)reasons.push('현재 무역 제재로 공동 운영과 정산이 불가능합니다.');
 if(!financeReady)reasons.push('현지 공동 부담 뒤 비축 국고 20억과 국고 상한을 지킬 수 없습니다.');
 const outcome=!blocked&&financeReady&&score>=THRESHOLD?'accepted':'rejected',cost=outcome==='accepted'?draft.capital:0,dueTurn=turn+2,endTurn=dueTurn+draft.duration,level=site.level+1;
 const decisionBlocker=blocked?'현재 무역 제재로 공동 운영과 정산이 불가능합니다.':!financeReady?'현지 공동 부담 뒤 비축 국고 20억과 국고 상한을 지킬 수 없습니다.':null;
 return {valid:true,eligible:true,outcome,score,threshold:THRESHOLD,reasons,blockedReason:null,decisionBlocker,affordable:(state.countries[playerId]?.treasury??0)>=draft.capital,cost,relation,expectedFood:draft.kind==='farm'?Math.ceil(level*3*draft.share/100):0,expectedRevenue:draft.kind==='port'?Math.ceil(level*2*draft.share/100):0,constructionCost,dueTurn,endTurn,draft};
}

export function previewJointInvestment(state,draft){
 return evaluate(state,draft,(state.turn??0)+1);
}

export function jointInvestmentAction(state,command){
 const draft=parseCommand(command);if(!draft)return null;
 const preview=previewJointInvestment(state,draft);if(!preview.valid||!preview.eligible)return null;
 return {id:command,name:`${COUNTRIES[draft.targetId].name} ${draft.kind==='farm'?'지역 농경지':'국제 항만'} 공동 투자`,tag:'외교',cost:preview.cost,foodCost:0,jointInvestment:draft,jointPreview:preview,description:`현지와 건설비를 함께 부담하고 완공 뒤 ${draft.duration}분기 동안 실제 성과의 ${draft.share}%를 배분합니다.`,forecast:preview.outcome==='accepted'?`투자금 ${draft.capital}억 · ${preview.dueTurn}분기 완공 · 예상 분기 최대 ${draft.kind==='farm'?`식량 ${preview.expectedFood}`:`순운영 수익 ${preview.expectedRevenue}억`}`:'상대국이 현재 조건을 거절 · 투자금 지출 없음'};
}

function event(state,contract,{operation,...fields}){
 return {source:'joint_investment',type:fields.shipmentFromId?'trade':operation==='accepted'?'investment':'operation',kind:contract.kind,operation,countryId:contract.targetId,targetId:state.playerId,contractId:contract.id,turn:state.turn,food:fields.food??0,money:fields.money??0,reason:fields.reason,text:fields.text,...(fields.shipmentFromId?{shipmentFromId:fields.shipmentFromId,shipmentToId:state.playerId}:{}),...(fields.playerImpact?{playerImpact:fields.playerImpact}:{})};
}

export function applyJointInvestmentDecision(next,action,parts=[],actions=[]){
 if(!action?.jointInvestment)return false;
 const draft=parseCommand(action.id),preview=draft?evaluate(next,draft,next.turn):null;
 if(!draft||jointCommand(action.jointInvestment)!==action.id||!preview?.eligible||preview.outcome!==action.jointPreview?.outcome||preview.score!==action.jointPreview?.score||action.cost!==preview.cost)throw new Error('변경되었거나 위조된 공동 투자 조건입니다.');
 if(preview.outcome==='rejected'){
  actions.push({source:'joint_investment',type:'operation',kind:draft.kind,operation:'rejected',countryId:draft.targetId,targetId:next.playerId,turn:next.turn,food:0,money:0,reason:preview.reasons.at(-1),text:`${COUNTRIES[draft.targetId].name} 측이 공동 투자 조건을 거절했습니다. 투자금은 지출되지 않았습니다.`,playerImpact:{food:0,treasury:0}});return true;
 }
 next.foreignSites??=createForeignSites(next.playerId??'lumen');
 const site=next.foreignSites[draft.targetId][draft.kind],host=next.countries[draft.targetId],level=site.level+1;
 host.treasury+=draft.capital-preview.constructionCost;
 site.project={level,startTurn:next.turn,dueTurn:preview.dueTurn};
 site.lastDecision={turn:next.turn,operation:'upgrade',reason:'양국 공동 투자 조건이 합의되어 실제 현장 건설을 시작했습니다.'};
 next.jointInvestments??=[];
 const contract={id:`joint-${next.playerId}-${draft.targetId}-${draft.kind}-${next.turn}`,targetId:draft.targetId,kind:draft.kind,capital:draft.capital,share:draft.share,duration:draft.duration,proposedTurn:next.turn,startTurn:preview.dueTurn,dueTurn:preview.dueTurn,endTurn:preview.endTurn,status:'building',totalFood:0,totalRevenue:0,accruedOutput:0,accountedEntitlement:0,lastReason:'건설 중'};
 next.jointInvestments.push(contract);
 actions.push(event(next,contract,{operation:'accepted',money:draft.capital,reason:'제안 조건이 승인되어 현지 공동 부담과 함께 건설비가 집행됐습니다.',text:`${COUNTRIES[draft.targetId].name} ${draft.kind==='farm'?'지역 농경지':'국제 항만'} 공동 투자 승인 · 투자금 ${draft.capital}억 · 건설비 ${preview.constructionCost}억 · ${preview.dueTurn}분기 완공 예정.`,playerImpact:{food:0,treasury:-draft.capital}}));return true;
}

function actualOutput(actions,contract){
 const passive=actions.find(item=>item.source==='foreign_site'&&item.countryId===contract.targetId&&item.kind===contract.kind&&item.operation==='passive');
 if(!passive)return 0;
 return contract.kind==='farm'?Math.max(0,passive.food??0):Math.max(0,passive.money??0);
}

export function runJointInvestments(next,parts=[],actions=[]){
 if(!enabledAt(next,next.turn)||!Array.isArray(next.jointInvestments))return [];
 const settled=[];
 for(const contract of next.jointInvestments.filter(item=>activeStatus(item.status))){
  if(next.turn>=contract.endTurn){contract.status='completed';contract.lastReason='약정 기간 만료';actions.push(event(next,contract,{operation:'completed',reason:contract.lastReason,text:`${COUNTRIES[contract.targetId].name} 공동 투자의 약정 기간이 만료됐습니다.`}));continue;}
  if(contract.status==='building'&&next.turn>=contract.dueTurn){contract.status='active';contract.lastReason='현장 완공과 공동 운영 시작';actions.push(event(next,contract,{operation:'activated',reason:contract.lastReason,text:`${COUNTRIES[contract.targetId].name} 공동 투자 현장이 완공되어 성과 배분을 시작합니다.`}));}
  if(contract.status==='building')continue;
  const relation=next.relations?.[relationKey(next.playerId,contract.targetId)]??50,blocked=tradeBlocked(next,next.playerId,contract.targetId);
  if(contract.status==='active'&&(blocked||relation<35)){contract.status='suspended';contract.lastReason=blocked?'무역 제재로 공급과 정산 중단':`양국 관계 ${relation}로 공급과 정산 중단`;actions.push(event(next,contract,{operation:'suspended',reason:contract.lastReason,text:`${COUNTRIES[contract.targetId].name} 공동 투자 정산이 중단됐습니다. ${contract.lastReason}.`}));continue;}
  if(contract.status==='suspended'){
   if(blocked||relation<45){contract.lastReason=blocked?'무역 제재가 계속되어 정산 중단':`양국 관계 ${relation}로 정산 재개 기준 45 미달`;continue;}
   contract.status='active';contract.lastReason='관계 회복으로 공급과 정산 재개';actions.push(event(next,contract,{operation:'resumed',reason:contract.lastReason,text:`${COUNTRIES[contract.targetId].name} 공동 투자 정산이 재개됐습니다.`}));
  }
  const output=actualOutput(actions,contract),accrued=(contract.accruedOutput??0)+output,earned=Math.floor(accrued*contract.share/100),wanted=Math.max(0,earned-(contract.accountedEntitlement??0)),host=next.countries[contract.targetId],player=next.countries[next.playerId];contract.accruedOutput=accrued;contract.accountedEntitlement=earned;
  if(!wanted){contract.lastReason=output?'소수 배분 몫 이월':'이번 분기 실제 성과 없음';settled.push({contractId:contract.id,food:0,revenue:0});continue;}
  if(contract.kind==='farm'){
   const food=Math.min(wanted,Math.max(0,host.food-RESERVE),Math.max(0,100-player.food));host.food-=food;player.food+=food;contract.totalFood+=food;contract.lastReason=food?'실제 수확 배분':'재고·저장 상한으로 식량 배분 없음';if(food)parts.push({label:`${COUNTRIES[contract.targetId].name} 공동 농경지 배분`,value:food});
   if(food)actions.push(event(next,contract,{operation:'settlement',food,reason:contract.lastReason,shipmentFromId:contract.targetId,text:`${COUNTRIES[contract.targetId].name} 공동 농경지 → ${COUNTRIES[next.playerId].name}: 식량 ${food} 배분.`,playerImpact:{food,treasury:0}}));settled.push({contractId:contract.id,food,revenue:0});continue;
  }
  const revenue=Math.min(wanted,Math.max(0,host.treasury-RESERVE),Math.max(0,100-player.treasury));host.treasury-=revenue;player.treasury+=revenue;contract.totalRevenue+=revenue;contract.lastReason=revenue?'실제 항만 서비스 수익 배분':'국고·수납 상한으로 수익 배분 없음';
  if(revenue)actions.push(event(next,contract,{operation:'settlement',money:revenue,reason:contract.lastReason,text:`${COUNTRIES[contract.targetId].name} 공동 항만 서비스 수익 ${revenue}억을 ${COUNTRIES[next.playerId].name}에 배분했습니다.`,playerImpact:{food:0,treasury:revenue}}));settled.push({contractId:contract.id,food:0,revenue});
 }
 return settled;
}

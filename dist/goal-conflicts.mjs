import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=31';
import {goalPairAffinity,goalRelations} from './goal-relations.mjs?v=31';
import {reliefActive} from './mediation.mjs?v=31';
import {peaceComplianceMarketContext,peaceComplianceTradeBlocked} from './peace-compliance.mjs?v=31';
import {peaceResponseMarketContext,peaceResponsePairContext,peaceResponseTradeBlocked} from './peace-response-model.mjs?v=31';

const STANCES=['sanction','response','neutral'];
const pairKey=(a,b)=>[a,b].sort().join(':');
const relation=(state,a,b)=>a===b?100:state.relations?.[pairKey(a,b)]??50;
const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
const enabled=state=>Number.isSafeInteger(state?.conflictStartTurn)&&state.turn>=state.conflictStartTurn;
const baseMembers=(conflict,side)=>side==='sanction'?conflict.sanctionMembers:conflict.responseMembers;

function adjustRelation(state,a,b,delta){
 if(!a||!b||a===b)return;
 state.relations??={};state.relations[pairKey(a,b)]=clamp(relation(state,a,b)+delta);
}
function ensure(state){state.goalConflicts??=[];state.lastConflictEvents??=[];state.conflictCooldownUntil??=0;}
function sideMembers(state,conflict,side){
 return [...baseMembers(conflict,side)];
}
function conflictById(state,id){return activeConflicts(state).find(item=>item.id===id)??null;}

export function activeConflicts(state){
 return (state.goalConflicts??[]).filter(item=>item.status==='active'&&state.turn<item.endTurn);
}

export function tradeBlocked(state,a,b){
 if(!a||!b||a===b)return false;
 if(peaceResponseTradeBlocked(state,a,b))return true;
 if(peaceComplianceTradeBlocked(state,a,b))return true;
 if(!enabled(state))return false;return activeConflicts(state).some(conflict=>{
  if(state.turn<conflict.startTurn||reliefActive(state,conflict))return false;
  const sanction=sideMembers(state,conflict,'sanction'),response=sideMembers(state,conflict,'response');
  return sanction.includes(a)&&response.includes(b)||sanction.includes(b)&&response.includes(a);
 });
}

export function conflictMarketContext(state,a,b,kind){
 const compliance=peaceComplianceMarketContext(state,a,b,kind);if(compliance.scoreDelta)return compliance;
 const directResponse=peaceResponsePairContext(state,a,b,kind);if(directResponse.scoreDelta)return directResponse;
 const response=peaceResponseMarketContext(state,b,kind);if(response.scoreDelta)return response;
 if(!tradeBlocked(state,a,b)||!['buy','sell','trade_buy','trade_sell'].includes(kind))return {scoreDelta:0,reasons:[]};
 const conflict=activeConflicts(state).find(item=>{
  const sanction=sideMembers(state,item,'sanction'),response=sideMembers(state,item,'response');
  return sanction.includes(a)&&response.includes(b)||sanction.includes(b)&&response.includes(a);
 });
 return {scoreDelta:-100,reasons:[COUNTRIES[conflict.initiatorId].name+'의 무역 제재와 '+COUNTRIES[conflict.targetId].name+'의 공동 대응이 이어져 양국 간 식량 거래가 중단됩니다.']};
}

export function conflictChoicePreview(state,conflictId,stance){
 const conflict=conflictById(state,conflictId);
 if(!conflict||conflict.playerStance||!STANCES.includes(stance)||state.turn>=conflict.endTurn-1)return null;
 const remaining=Math.max(0,conflict.endTurn-Math.max(state.turn+1,conflict.startTurn));
 const effects={
  sanction:{relationChanges:[{countryId:conflict.initiatorId,delta:6},{countryId:conflict.targetId,delta:-8}],restrictedIds:[...conflict.responseMembers],recurringText:'대응 측과 무역 중단 · 매 분기 제재 주도국에서 식량 최대 1 구매, 대금 최대 1 지급'},
  response:{relationChanges:[{countryId:conflict.initiatorId,delta:-8},{countryId:conflict.targetId,delta:6}],restrictedIds:[...conflict.sanctionMembers],recurringText:'제재 측과 무역 중단 · 이행 분기마다 대응국에 식량 최대 2 제공, 대금 최대 1 수령'},
  neutral:{relationChanges:[{countryId:conflict.initiatorId,delta:-2},{countryId:conflict.targetId,delta:-2}],restrictedIds:[],recurringText:'교역 제한·식량 분담 없음 · 추가 정기 비용 없음'},
 }[stance];
 const relationChanges=effects.relationChanges.map(item=>({...item,delta:clamp(relation(state,state.playerId,item.countryId)+item.delta)-relation(state,state.playerId,item.countryId)}));
 const startsTurn=Math.max(state.turn+1,conflict.startTurn),pausedQuarters=reliefActive({...state,turn:startsTurn},conflict)?Math.min(remaining,conflict.ceasefireUntil-startsTurn):0;
 return {conflictId,stance,remaining,startsTurn,endsTurn:conflict.endTurn-1,...effects,relationChanges,...(conflict.ceasefireUntil?{pausedQuarters,activeQuarters:remaining-pausedQuarters,resumesTurn:Math.max(startsTurn,conflict.ceasefireUntil)}:{})};
}

export function conflictAction(state,id){
 if(typeof id!=='string')return null;
 const match=id.match(/^stance:([^:]+):(sanction|response|neutral)$/);if(!match)return null;
 const preview=conflictChoicePreview(state,match[1],match[2]);if(!preview)return null;
 const conflict=conflictById(state,match[1]),names={sanction:'무역 제재 연대',response:'공동 대응',neutral:'중립'};
 const relations=preview.relationChanges.map(item=>COUNTRIES[item.countryId].name+' 관계 '+(item.delta>0?'+':'')+item.delta).join(' · ');
 const paused=preview.pausedQuarters>0&&match[2]!=='neutral';
 const restricted=paused&&!preview.activeQuarters?'분쟁 종료까지 교역 제한 유예':preview.restrictedIds.length?(paused?'휴전 종료 후 교역 중단: ':'교역 중단: ')+preview.restrictedIds.map(id=>COUNTRIES[id].name).join(' · '):'양측과 교역 유지';
 const afterRelief=preview.activeQuarters?`${preview.resumesTurn}분기부터 ${preview.activeQuarters}분기 동안 ${preview.recurringText}`:'휴전 종료와 함께 분쟁 종료 · 추가 제재·분담 없음';
 const forecast=paused?`다음 ${preview.pausedQuarters}분기는 휴전으로 교역 제한·정기 분담 없음 · ${afterRelief}`:preview.remaining+'분기 동안 '+preview.recurringText;
 return {id,name:names[match[2]]+' 선택',tag:'외교',cost:0,foodCost:0,conflictChoice:{conflictId:conflict.id,stance:match[2]},conflictPreview:preview,relationChanges:preview.relationChanges,recurringText:preview.recurringText,restrictedIds:preview.restrictedIds,description:'선언 즉시 '+relations+' · '+restricted,forecast:forecast+(match[2]==='neutral'?'':' · 재고·국고·저장 여력 안에서만 이전')};
}

export function applyConflictChoice(next,action,parts=[],actions=[]){
 if(!action.conflictChoice)return;
 const conflict=(next.goalConflicts??[]).find(item=>item.id===action.conflictChoice.conflictId),preview=action.conflictPreview;
 if(!conflict||conflict.status!=='active'||conflict.playerStance||!preview)throw new Error('선택할 수 없는 국제 분쟁 입장입니다.');
 conflict.playerStance=preview.stance;conflict.stanceTurn=next.turn;
 conflict.commitment={recurringText:preview.recurringText,restrictedIds:[...preview.restrictedIds],relationChanges:structuredClone(preview.relationChanges)};
 if(preview.stance!=='neutral'){const members=preview.stance==='sanction'?conflict.sanctionMembers:conflict.responseMembers;if(!members.includes(next.playerId))members.push(next.playerId);}
 for(const item of preview.relationChanges)adjustRelation(next,next.playerId,item.countryId,item.delta);
 const labels={sanction:'무역 제재 연대에 합류',response:'공동 대응에 합류',neutral:'중립 선언'};
 const text=COUNTRIES[next.playerId].name+': '+labels[preview.stance]+'. '+preview.remaining+'분기 동안 여파가 이어집니다.',event={turn:next.turn,type:'choice',conflictId:conflict.id,stance:preview.stance,text};
 conflict.events.push(event);next.lastConflictEvents.push(event);actions.push({countryId:next.playerId,targetId:conflict.targetId,type:'conflict_choice',source:'goal_conflict',conflictId:conflict.id,stance:preview.stance,text});
}

function supporterScore(state,id,principalId,otherId,kind){
 return relation(state,id,principalId)-relation(state,id,otherId)+goalPairAffinity(state,id,principalId,kind).scoreDelta;
}
function supporters(state,initiatorId,targetId){
 const candidates=COUNTRY_IDS.filter(id=>![initiatorId,targetId,state.playerId].includes(id));
 const sanctionMembers=candidates.filter(id=>supporterScore(state,id,initiatorId,targetId,'trade_sell')>=6)
  .sort((a,b)=>supporterScore(state,b,initiatorId,targetId,'trade_sell')-supporterScore(state,a,initiatorId,targetId,'trade_sell')||a.localeCompare(b)).slice(0,2);
 const responseMembers=candidates.filter(id=>!sanctionMembers.includes(id)&&supporterScore(state,id,targetId,initiatorId,'alliance')>=0)
  .sort((a,b)=>supporterScore(state,b,targetId,initiatorId,'alliance')-supporterScore(state,a,targetId,initiatorId,'alliance')||a.localeCompare(b)).slice(0,2);
 return {sanctionMembers:[...(initiatorId===state.playerId?[]:[initiatorId]),...sanctionMembers],responseMembers:[...(targetId===state.playerId?[]:[targetId]),...responseMembers]};
}
function form(state,actions){
 if(activeConflicts(state).length||state.turn<(state.conflictStartTurn??1)+2||state.turn<(state.conflictCooldownUntil??0))return;
 const rivalry=goalRelations(state).find(item=>item.type==='competition'&&![item.countryId,item.targetId].includes(state.playerId))
  ??(!['nord','marin'].includes(state.playerId)&&state.countries.nord.food<80&&state.countries.marin.food<80?{countryId:'nord',targetId:'marin',type:'competition',reason:'안정적인 수입선과 해상 물류 목표가 제한된 곡물 공급과 운송 우선권을 두고 충돌합니다.'}:null);
 if(!rivalry)return;
 const first=state.countries[rivalry.countryId],second=state.countries[rivalry.targetId];
 const initiatorId=first.food>second.food||first.food===second.food&&rivalry.countryId.localeCompare(rivalry.targetId)<0?rivalry.countryId:rivalry.targetId;
 const targetId=initiatorId===rivalry.countryId?rivalry.targetId:rivalry.countryId,{sanctionMembers,responseMembers}=supporters(state,initiatorId,targetId);
 const conflict={id:'goal-conflict-'+initiatorId+'-'+targetId+'-'+state.turn,status:'active',type:'trade_sanctions',initiatorId,targetId,sanctionMembers,responseMembers,formedTurn:state.turn,startTurn:state.turn+1,endTurn:state.turn+5,duration:4,playerStance:null,stanceTurn:null,events:[],reason:rivalry.reason};
 state.goalConflicts.push(conflict);state.conflictCooldownUntil=conflict.endTurn+4;
 const text=COUNTRIES[initiatorId].name+' 측이 '+COUNTRIES[targetId].name+'에 4분기 무역 제재를 선언했습니다. '+COUNTRIES[targetId].name+' 측은 공동 대응을 조직합니다.';
 const event={turn:state.turn,type:'formed',conflictId:conflict.id,text};conflict.events.push(event);state.lastConflictEvents.push(event);actions.push({countryId:initiatorId,targetId,type:'conflict',source:'goal_conflict',conflictId:conflict.id,text});
}
function transfer(state,fromId,toId,wanted,payment,actions,label){
 if(fromId===toId)return null;
 const from=state.countries[fromId],to=state.countries[toId];let food=Math.min(wanted,Math.max(0,from.food-20),Math.max(0,100-to.food));
 while(food>0&&Math.ceil(payment*food/wanted)>Math.min(to.treasury,100-from.treasury))food--;
 if(food<=0)return null;
 const money=Math.ceil(payment*food/wanted);from.food-=food;from.treasury+=money;to.food+=food;to.treasury-=money;
 actions.push({countryId:fromId,targetId:toId,type:'conflict_support',source:'goal_conflict',food,money,text:label+': '+COUNTRIES[fromId].name+' → '+COUNTRIES[toId].name+' 식량 '+food+' · 대금 '+money+'.'});return {food,money};
}
function applyQuarter(state,conflict,parts,actions){
 if(reliefActive(state,conflict))return;
 for(const supporterId of conflict.responseMembers.filter(id=>id!==conflict.targetId&&id!==state.playerId))transfer(state,supporterId,conflict.targetId,1,1,actions,'공동 대응 공급');
 if(conflict.playerStance==='sanction'&&state.playerId!==conflict.initiatorId){
  const result=transfer(state,conflict.initiatorId,state.playerId,1,1,actions,'제재 연대 대체 시장');if(result)parts.push({label:'제재 연대 대체 시장',value:result.food});
 }
 if(conflict.playerStance==='response'&&state.playerId!==conflict.targetId){
  const result=transfer(state,state.playerId,conflict.targetId,2,1,actions,'공동 대응 분담');if(result)parts.push({label:'공동 대응 식량 분담',value:-result.food});
 }
}

export function prepareGoalConflicts(next,before,parts=[],actions=[]){
 if(!enabled(next))return;
 ensure(next);
 for(const conflict of activeConflicts(next).filter(item=>item.ceasefireUntil===next.turn)){
  const text='교역 휴전이 끝나 '+COUNTRIES[conflict.initiatorId].name+'·'+COUNTRIES[conflict.targetId].name+' 양측의 제재와 공동 대응이 다시 적용됩니다.';
  const event={turn:next.turn,type:'ceasefire_ended',conflictId:conflict.id,text};conflict.events.push(event);actions.push({countryId:conflict.initiatorId,targetId:conflict.targetId,type:event.type,source:'goal_conflict',conflictId:conflict.id,text});
 }
 for(const conflict of next.goalConflicts.filter(item=>item.status==='active'&&next.turn>=item.endTurn)){
  conflict.status='completed';conflict.resolvedTurn=next.turn;
  const text=conflict.duration===4?COUNTRIES[conflict.initiatorId].name+'·'+COUNTRIES[conflict.targetId].name+' 사이의 무역 제재와 공동 대응이 4분기 만에 종료됐습니다.':COUNTRIES[conflict.initiatorId].name+'·'+COUNTRIES[conflict.targetId].name+' 사이의 연장된 무역 제재와 공동 대응이 종료됐습니다.';
  const event={turn:next.turn,type:'completed',conflictId:conflict.id,text};conflict.events.push(event);next.lastConflictEvents.push(event);actions.push({countryId:conflict.initiatorId,targetId:conflict.targetId,type:'expiry',source:'goal_conflict',conflictId:conflict.id,text});
 }
 for(const conflict of activeConflicts(next))if(next.turn>=conflict.startTurn)applyQuarter(next,conflict,parts,actions);
}

export function runGoalConflicts(next,before,parts=[],actions=[]){
 if(!enabled(next))return;
 ensure(next);
 form(next,actions);
 next.goalConflicts=[...next.goalConflicts.filter(item=>item.status!=='active').slice(-12),...activeConflicts(next)];
}

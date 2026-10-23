import {COUNTRIES} from './country-data.mjs?v=31';
import {adjustRelation,getRelation} from './negotiations.mjs?v=31';
import {changeReliability} from './treaty-effects.mjs?v=31';
import {mediationAction,mediationCommand,previewMediation} from './mediation.mjs?v=31';
import {ACCORD_ID,accordById,accordId,activeRestriction,clamp,complianceAssessment,enabled,obligation,observerIds,otherPrincipal,parseDraft,restrictionContext,syntheticConflictId} from './peace-compliance-model.mjs?v=31';

const recordEvent=(state,accord,event,actions=[])=>{state.lastPeaceComplianceEvents.push(event);accord.events=[...(accord.events??[]),structuredClone(event)].slice(-20);actions.push({...event,source:'peace_compliance'});return event;};
const executable=(state,accord)=>accord?.status==='violated'&&!accord.response&&accord.violation&&state.turn+1<accord.violation.untilTurn;
const COMPLIANCE_SCORE=63;

function parseCommand(command){
 if(typeof command!=='string'||command.length>160)return null;
 let match=command.match(/^peace-compliance:(peace-accord-[a-z0-9-]+-\d+):sanction$/);if(match)return {accordId:match[1],response:'sanction',draft:null};
 match=command.match(/^peace-compliance:(peace-accord-[a-z0-9-]+-\d+):renegotiate:(relief|peace):(mutual|target):(0|4|8):(0|6|12)$/);
 return match?{accordId:match[1],response:'renegotiate',draft:{goal:match[2],condition:match[3],food:Number(match[4]),money:Number(match[5])}}:null;
}
function relationChange(state,countryId,delta){const before=getRelation(state,state.playerId,countryId),after=clamp(before+delta);return {countryId,before,after,delta:after-before};}
function syntheticConflict(state,accord,id){
 return {id,status:'active',type:'peace_compliance_renegotiation',initiatorId:accord.principalIds[0],targetId:accord.principalIds[1],sanctionMembers:[],responseMembers:[],formedTurn:state.turn,startTurn:state.turn+1,endTurn:state.turn+3,duration:2,playerStance:'neutral',stanceTurn:state.turn,events:[],escalated:true,extraQuarters:0,reason:'중재국이 중립 조건으로 위반된 평화 합의를 다시 협상합니다.',peaceComplianceAccordId:accord.id};
}
function renegotiationPreview(state,accord,draft){
 const parsed=parseDraft(draft);if(!parsed)return null;
 const conflictId=syntheticConflictId(accord,state.turn+1),shadow=structuredClone(state);shadow.goalConflicts=[...(shadow.goalConflicts??[]),syntheticConflict(shadow,accord,conflictId)];
 return previewMediation(shadow,{conflictId,...parsed});
}

export function peaceComplianceCommand(accordIdValue,response,draft=null){
 if(typeof accordIdValue!=='string'||!ACCORD_ID.test(accordIdValue)||!['sanction','renegotiate'].includes(response))return null;
 const parsed=response==='renegotiate'?parseDraft(draft):null;if(response==='renegotiate'&&!parsed)return null;
 const command=response==='sanction'?`peace-compliance:${accordIdValue}:sanction`:`peace-compliance:${accordIdValue}:renegotiate:${parsed.goal}:${parsed.condition}:${parsed.food}:${parsed.money}`;
 return command.length<=160?command:null;
}
export function peaceCompliancePreview(state,id,response='sanction',draft=null){
 const accord=accordById(state,id);if(!enabled(state)||!executable(state,accord)||!['sanction','renegotiate'].includes(response))return null;
 const violatorId=accord.violation.countryId,base={response,accordId:id,violatorId,startsTurn:state.turn+1,quarters:response==='sanction'?3:1,restrictedIds:response==='sanction'?[violatorId]:[],relationChanges:[],observerChanges:[],costs:{food:0,money:0}};
 if(response==='sanction'){
  const relationChanges=[relationChange(state,violatorId,-5)],observerChanges=observerIds(state,accord,violatorId).map(countryId=>{const before=getRelation(state,countryId,violatorId),after=clamp(before-1);return {countryId,before,after,delta:after-before};});
  return {...base,untilTurn:state.turn+4,relationChanges,observerChanges,description:`${COUNTRIES[violatorId].name}과의 상업 거래를 3회 실행 동안 다시 제한합니다.`,forecast:'현재 실행부터 3회 동안 상업 거래 중단 · 인도 지원 면제 · 직접 지원 비용 없음'};
 }
 const mediation=renegotiationPreview(state,accord,draft);if(!mediation)return null;
 return {...base,untilTurn:null,costs:{food:mediation.outcome==='accepted'?mediation.costs.food:0,money:mediation.outcome==='accepted'?mediation.costs.money:0},mediation,description:`위반된 합의를 ${mediation.description} 조건으로 다시 중재합니다.`,forecast:{accepted:'합의가 발효되면 기존 제한을 끝내고 새 이행 점검을 시작합니다.',countered:'상대국의 역제안을 기다리는 동안 기존 위반 제한은 원래 기한까지 유지됩니다.',rejected:'재합의 없이 기존 위반 제한이 원래 기한까지 유지됩니다.',escalated:'강압적 조건이 거절되며 기존 위반 제한은 원래 기한까지 유지됩니다.'}[mediation.outcome]};
}
export function peaceComplianceAction(state,command){
 const parsed=parseCommand(command),preview=parsed&&peaceCompliancePreview(state,parsed.accordId,parsed.response,parsed.draft);if(!parsed||!preview)return null;
 if(parsed.response==='sanction')return {id:command,name:'평화 합의 재제재',tag:'외교',cost:0,foodCost:0,peaceCompliance:{accordId:parsed.accordId,response:'sanction'},peaceCompliancePreview:preview,description:preview.description,forecast:preview.forecast};
 const delegated=mediationAction({...state,goalConflicts:[...(state.goalConflicts??[]),syntheticConflict(state,accordById(state,parsed.accordId),preview.mediation.draft.conflictId)]},mediationCommand(preview.mediation.draft));
 if(!delegated)return null;
 return {...delegated,id:command,name:'평화 합의 재협상',peaceCompliance:{accordId:parsed.accordId,response:'renegotiate'},peaceCompliancePreview:preview,mediationPreview:preview.mediation,description:preview.description,forecast:preview.forecast};
}

export function preparePeaceComplianceMediation(next,action){
 if(action.peaceCompliance?.response!=='renegotiate'||!action.mediationPreview)return;
 const accord=accordById(next,action.peaceCompliance.accordId),id=action.mediationPreview.draft.conflictId;if(!accord||next.goalConflicts.some(item=>item.id===id))return;
 next.goalConflicts.push(syntheticConflict({...next,turn:next.turn-1},accord,id));
}
export function applyPeaceComplianceResponse(next,action,actions=[]){
 if(!action.peaceCompliance)return;
 const accord=accordById(next,action.peaceCompliance.accordId);if(!accord||accord.status!=='violated'||accord.response||!accord.violation||next.turn>=accord.violation.untilTurn)throw new Error('대응할 수 없는 평화 합의입니다.');
 if(action.peaceCompliance.response==='sanction'){
  const preview=action.peaceCompliancePreview;accord.status='sanctioned';accord.violation.untilTurn=preview.untilTurn;accord.response={kind:'sanction',turn:next.turn,untilTurn:preview.untilTurn};
  for(const item of preview.relationChanges)adjustRelation(next,next.playerId,item.countryId,item.delta);for(const item of preview.observerChanges)adjustRelation(next,item.countryId,preview.violatorId,item.delta);
  const text=`${COUNTRIES[next.playerId].name}이 ${COUNTRIES[preview.violatorId].name}의 합의 위반에 3회 실행의 상업 제재로 대응했습니다.`;
  recordEvent(next,accord,{turn:next.turn,type:'accord_sanctioned',accordId:accord.id,countryId:next.playerId,targetId:preview.violatorId,text,relationChanges:structuredClone(preview.relationChanges),observerChanges:structuredClone(preview.observerChanges),costs:{food:0,money:0},untilTurn:preview.untilTurn},actions);return;
 }
 const record=(next.mediations??[]).findLast(item=>item.conflictId===action.mediationPreview.draft.conflictId&&item.turn===next.turn),status=record?.status??action.mediationPreview.outcome;
 accord.response={kind:'renegotiate',turn:next.turn,untilTurn:record?.expiresTurn??accord.violation.untilTurn,mediationId:record?.id??null};
 if(status==='countered')accord.status='renegotiating';
 if(!['accepted','countered'].includes(status)){const conflict=next.goalConflicts.find(item=>item.id===action.mediationPreview.draft.conflictId);if(conflict){conflict.status='resolved';conflict.resolvedTurn=next.turn;conflict.resolvedBy='peace_compliance';}}
 const type=status==='countered'?'accord_renegotiation_countered':status==='accepted'?'accord_renegotiation_accepted':'accord_renegotiation_rejected',text=record?.text??'평화 합의 재협상 결과가 기록됐습니다.';
 recordEvent(next,accord,{turn:next.turn,type,accordId:accord.id,countryId:next.playerId,targetId:accord.violation.countryId,text,costs:structuredClone(record?.costs??{food:0,money:0}),mediationId:record?.id??null},actions);
}

function registerAccepted(next,actions){
 for(const record of (next.mediations??[]).filter(item=>item.status==='accepted'&&item.turn>=next.peaceComplianceStartTurn)){
  if(next.peaceAccords.some(item=>item.mediationId===record.id))continue;
  const conflict=(next.goalConflicts??[]).find(item=>item.id===record.conflictId);if(!conflict)continue;
  const id=accordId(conflict.id,record.turn);if(next.peaceAccords.some(item=>item.id===id))continue;
  const revisionOf=conflict.peaceComplianceAccordId??null,old=revisionOf?accordById(next,revisionOf):null,sourceConflictId=old?.sourceConflictId??old?.conflictId??conflict.id,createdTurn=next.turn,startTurn=next.turn+1,endTurn=record.terms.goal==='relief'?Math.max(startTurn,conflict.ceasefireUntil??startTurn):next.turn+5;
  const offer=(next.peaceOffers??[]).find(item=>item.reply?.mediationRecordId===record.id),accord={id,conflictId:conflict.id,sourceConflictId,mediationId:record.id,offerId:offer?.id??null,revisionOf,replacedById:null,sourceGoal:record.terms.goal,terms:structuredClone(record.terms),principalIds:[conflict.initiatorId,conflict.targetId],createdTurn,startTurn,endTurn,status:'monitoring',checks:[],violation:null,response:null,events:[],obligation:obligation(record.terms)};
  next.peaceAccords.push(accord);const text=`${COUNTRIES[accord.principalIds[0]].name} · ${COUNTRIES[accord.principalIds[1]].name}의 ${record.terms.goal==='peace'?'평화':'휴전'} 합의 이행 점검이 다음 실행부터 시작됩니다.`;
  recordEvent(next,accord,{turn:next.turn,type:'accord_registered',accordId:id,countryId:accord.principalIds[0],targetId:accord.principalIds[1],text,startTurn,endTurn},actions);
  if(old){
   const source=(next.goalConflicts??[]).find(item=>item.id===sourceConflictId&&item.status==='active'&&next.turn<item.endTurn&&accord.principalIds.every(countryId=>[item.initiatorId,item.targetId].includes(countryId)));
   if(source){
    if(record.terms.goal==='peace'){source.status='resolved';source.resolvedTurn=next.turn;source.resolvedBy='peace_compliance';}
    else{source.ceasefireStartTurn=next.turn;source.ceasefireUntil=Math.min(source.endTurn,next.turn+2);}
    source.events=[...(source.events??[]),{turn:next.turn,type:'peace_compliance_reconciled',conflictId:source.id,recordId:record.id,accordId:old.id,goal:record.terms.goal,text:record.terms.goal==='peace'?'재협상된 평화 합의가 원래 분쟁과 교역 제한을 종료했습니다.':'재협상된 휴전 합의가 원래 분쟁의 제재와 공동 대응을 다시 멈췄습니다.'}];
   }
   old.status='replaced';old.replacedById=id;if(old.violation)old.violation.untilTurn=next.turn;old.response={...(old.response??{kind:'renegotiate',turn:next.turn}),untilTurn:next.turn,mediationId:record.id};if(old.foreignResponse){old.foreignResponse.status='settled';old.foreignResponse.untilTurn=next.turn;}recordEvent(next,old,{turn:next.turn,type:'accord_replaced',accordId:old.id,countryId:old.violation?.countryId??null,targetId:id,text:'재협상이 수락돼 기존 위반 합의를 새 합의로 대체했습니다.',replacementId:id},actions);
  }
  if(conflict.peaceComplianceAccordId)conflict.status='resolved';
 }
}
function honor(next,accord,assessments,actions){
 const [a,b]=accord.principalIds,relationBefore=getRelation(next,a,b);adjustRelation(next,a,b,1);
 const results=assessments.map(item=>{const reliabilityBefore=next.reliability?.[item.countryId]??70;changeReliability(next,item.countryId,1);return {...item,status:'fulfilled',relationBefore,relationAfter:getRelation(next,a,b),reliabilityBefore,reliabilityAfter:next.reliability[item.countryId]};});
 accord.checks.push({turn:next.turn,status:'fulfilled',results});
 for(const item of results)recordEvent(next,accord,{turn:next.turn,type:'accord_fulfilled',accordId:accord.id,countryId:item.countryId,targetId:item.otherId,text:`${COUNTRIES[item.countryId].name} 측이 평화 합의를 지켰습니다. ${item.reason}`,score:item.score,relationBefore:item.relationBefore,relationAfter:item.relationAfter,reliabilityBefore:item.reliabilityBefore,reliabilityAfter:item.reliabilityAfter},actions);
}
function breach(next,accord,item,actions){
 const relationBefore=getRelation(next,...accord.principalIds),mediatorRelationBefore=getRelation(next,next.playerId,item.countryId),reliabilityBefore=next.reliability?.[item.countryId]??70;adjustRelation(next,...accord.principalIds,-7);adjustRelation(next,next.playerId,item.countryId,-6);changeReliability(next,item.countryId,-8);
 const mediatorRelationAfter=getRelation(next,next.playerId,item.countryId),relationChanges=[{countryId:item.countryId,before:mediatorRelationBefore,after:mediatorRelationAfter,delta:mediatorRelationAfter-mediatorRelationBefore}];
 const observers=observerIds(next,accord,item.countryId).map(countryId=>{const before=getRelation(next,countryId,item.countryId);adjustRelation(next,countryId,item.countryId,-2);return {countryId,before,after:getRelation(next,countryId,item.countryId),delta:getRelation(next,countryId,item.countryId)-before};});
 const result={...item,status:'breached',relationBefore,relationAfter:getRelation(next,...accord.principalIds),reliabilityBefore,reliabilityAfter:next.reliability[item.countryId]};accord.checks.push({turn:next.turn,status:'breached',results:[result]});accord.status='violated';accord.violation={countryId:item.countryId,turn:next.turn,reason:item.reason,startsTurn:next.turn+1,untilTurn:next.turn+3};
 const text=`${COUNTRIES[item.countryId].name} 측이 평화 합의를 위반했습니다. ${item.reason} 다음 실행부터 2회 동안 관련 상업 거래가 제한됩니다.`;recordEvent(next,accord,{turn:next.turn,type:'accord_breached',accordId:accord.id,countryId:item.countryId,targetId:item.otherId,text,score:item.score,reason:item.reason,relationBefore:result.relationBefore,relationAfter:result.relationAfter,reliabilityBefore:result.reliabilityBefore,reliabilityAfter:result.reliabilityAfter,relationChanges,observerChanges:observers,startsTurn:accord.violation.startsTurn,untilTurn:accord.violation.untilTurn},actions);
}
function expire(next,accord,actions){
 accord.status='completed';const violator=accord.violation?.countryId??null,text=violator?`${COUNTRIES[violator].name}의 합의 위반에 따른 한시적 상업 거래 제한이 종료됐습니다.`:'평화 합의의 점검 기간이 종료됐습니다.';
 recordEvent(next,accord,{turn:next.turn,type:violator?'accord_restriction_expired':'accord_completed',accordId:accord.id,countryId:violator,targetId:violator?otherPrincipal(accord,violator):accord.principalIds[1],text},actions);
}
export function reconcilePeaceCompliance(next,actions=[]){
 if(!enabled(next))return;next.peaceAccords??=[];next.lastPeaceComplianceEvents??=[];registerAccepted(next,actions);
}
export function runPeaceCompliance(next,before,actions=[]){
 if(!enabled(next))return;reconcilePeaceCompliance(next,actions);
 for(const accord of next.peaceAccords){
  if(accord.status==='replaced'||accord.createdTurn===next.turn)continue;
  if(accord.status==='renegotiating'){
   const record=(next.mediations??[]).find(item=>item.id===accord.response?.mediationId);if(record&&record.status==='countered')continue;accord.status='violated';
  }
  if(['violated','sanctioned'].includes(accord.status)){const deadlines=[accord.violation?.untilTurn,accord.response?.kind==='sanction'?accord.response.untilTurn:null,accord.foreignResponse?.status==='active'?accord.foreignResponse.untilTurn:null].filter(Number.isSafeInteger),until=deadlines.length?Math.max(...deadlines):null;if(Number.isSafeInteger(until)&&next.turn>=until)expire(next,accord,actions);continue;}
  if(accord.status!=='monitoring')continue;if(next.turn>=accord.endTurn){expire(next,accord,actions);continue;}if(next.turn<accord.startTurn||accord.checks.some(item=>item.turn===next.turn))continue;
  const assessments=accord.principalIds.map(id=>complianceAssessment(next,accord,id)),failed=assessments.filter(item=>item.score<COMPLIANCE_SCORE).sort((a,b)=>a.score-b.score||a.countryId.localeCompare(b.countryId))[0];if(failed)breach(next,accord,failed,actions);else{honor(next,accord,assessments,actions);if(next.turn+1>=accord.endTurn)expire(next,accord,actions);}
 }
 const active=next.peaceAccords.filter(item=>!['completed','replaced'].includes(item.status)),archive=next.peaceAccords.filter(item=>['completed','replaced'].includes(item.status)).slice(-(24-active.length));next.peaceAccords=[...archive,...active].sort((a,b)=>a.createdTurn-b.createdTurn);
}

export const peaceComplianceTradeBlocked=(state,a,b)=>Boolean(activeRestriction(state,a,b));
export const peaceComplianceMarketContext=restrictionContext;

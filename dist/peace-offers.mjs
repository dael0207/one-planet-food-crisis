import {COUNTRIES} from './country-data.mjs?v=31';
import {mediationAction,mediationCommand,pendingMediationCounters,previewMediation,reliefActive} from './mediation.mjs?v=31';
import {syntheticConflictId} from './peace-compliance-model.mjs?v=31';

const GOALS=['relief','peace'],CONDITIONS=['mutual','target'],FOOD=[0,4,8],MONEY=[0,6,12];
const pairKey=(a,b)=>[a,b].sort().join(':');
const relation=(state,a,b)=>a===b?100:state.relations?.[pairKey(a,b)]??50;
const enabled=state=>Number.isSafeInteger(state?.peaceOfferStartTurn)&&state.turn>=state.peaceOfferStartTurn;
const conflictById=(state,id)=>(state.goalConflicts??[]).find(item=>item.id===id&&item.status==='active'&&state.turn<item.endTurn)??null;
const offerById=(state,id)=>(state.peaceOffers??[]).find(item=>item.id===id)??null;
const principalIds=conflict=>[conflict.initiatorId,conflict.targetId];
const executable=(state,offer)=>offer?.status==='pending'&&state.turn+1<offer.expiresTurn&&state.turn+1<(conflictById(state,offer.conflictId)?.endTurn??0);
const changed=(a,b)=>['goal','condition','food','money'].some(key=>a[key]!==b[key]);

function parseDraft(value){
 if(!value||typeof value!=='object'||typeof value.conflictId!=='string'||!GOALS.includes(value.goal)||!CONDITIONS.includes(value.condition)||!FOOD.includes(value.food)||!MONEY.includes(value.money))return null;
 return {conflictId:value.conflictId,goal:value.goal,condition:value.condition,food:value.food,money:value.money};
}
function parseCommand(command){
 if(typeof command!=='string'||command.length>160)return null;
 let match=command.match(/^peace-reply:(peace-offer-[\w-]+-\d+):(accept|decline)$/);
 if(match)return {offerId:match[1],kind:match[2]};
 match=command.match(/^peace-counter:(peace-offer-[\w-]+-\d+):(relief|peace):(mutual|target):(0|4|8):(0|6|12)$/);
 return match?{offerId:match[1],kind:'counter',draft:{goal:match[2],condition:match[3],food:Number(match[4]),money:Number(match[5])}}:null;
}
function playerCanPay(state,action){const player=state.countries?.[state.playerId];return player&&player.treasury>=action.cost&&player.food>=action.foodCost;}

export function peaceReplyCommand(offerId,response){
 if(typeof offerId!=='string'||!['accept','decline'].includes(response))return null;const command=`peace-reply:${offerId}:${response}`;return command.length<=160?command:null;
}
export function peaceCounterCommand(value){
 const offerId=value?.offerId,draft=parseDraft(value);if(typeof offerId!=='string'||!draft)return null;const command=`peace-counter:${offerId}:${draft.goal}:${draft.condition}:${draft.food}:${draft.money}`;return command.length<=160?command:null;
}
export function pendingPeaceOffers(state){return enabled(state)?(state.peaceOffers??[]).filter(offer=>executable(state,offer)):[];}
export function peaceOfferPreview(state,id){
 const offer=offerById(state,id);if(!enabled(state)||!executable(state,offer))return null;
 const mediation=previewMediation(state,offer.terms),action=mediation&&mediationAction(state,mediationCommand(offer.terms));
 return {offer:structuredClone(offer),mediation,lastReplyTurn:offer.expiresTurn-1,canAccept:Boolean(action&&mediation.outcome==='accepted'&&playerCanPay(state,action)),canCounter:true};
}
export function peaceOfferAction(state,command){
 const parsed=parseCommand(command),offer=parsed&&offerById(state,parsed.offerId);if(!enabled(state)||!parsed||!executable(state,offer))return null;
 if(parsed.kind==='decline')return {id:command,name:'평화 제안 거절',tag:'외교',cost:0,foodCost:0,peaceReply:{offerId:offer.id,kind:'decline'},description:'지원이나 양보 없이 제안을 거절합니다.',forecast:'거절 자체의 직접 지원 비용·관계 불이익 없음 · 일반 국정과 세계 운영은 계속'};
 const draft=parsed.kind==='accept'?offer.terms:{...parsed.draft,conflictId:offer.conflictId};
 if(parsed.kind==='counter'&&(!changed(offer.terms,draft)||draft.conflictId!==offer.conflictId))return null;
 const delegated=mediationAction(state,mediationCommand(draft));
 if(!delegated||parsed.kind==='accept'&&(delegated.mediationPreview.outcome!=='accepted'||!playerCanPay(state,delegated)))return null;
 return {...delegated,id:command,name:parsed.kind==='accept'?'타국 평화 제안 수락':'평화 조건 역제안',peaceReply:{offerId:offer.id,kind:parsed.kind,delegatedCommand:delegated.id},forecast:parsed.kind==='accept'?'현재 관계와 재고로 합의가 이번 분기에 발효됩니다.':delegated.forecast};
}

function replyEvent(next,offer,reply,text){
 const event={turn:next.turn,type:'peace_offer_'+reply.outcome,offerId:offer.id,conflictId:offer.conflictId,fromId:offer.fromId,text,status:offer.status,reply:structuredClone(reply)};
 next.lastPeaceOfferEvents.push(event);return event;
}
function closePeaceResponse(next,offer,status,actions){
 if(offer.origin!=='peace_response'||status==='countered')return;
 const accord=(next.peaceAccords??[]).find(item=>item.id===offer.accordId),conflict=(next.goalConflicts??[]).find(item=>item.id===offer.conflictId);if(!accord?.foreignResponse)return;
 accord.foreignResponse.status=status==='expired'?'expired':'settled';accord.foreignResponse.untilTurn=next.turn;
 if(conflict?.status==='active'){conflict.status=status;conflict.resolvedTurn=next.turn;}
 const text=`${COUNTRIES[offer.fromId].name}의 평화 합의 재협상 요청이 ${status==='expired'?'기한 만료':'회신'}로 종료됐습니다.`,event={turn:next.turn,type:`peace_response_${status}`,accordId:accord.id,offerId:offer.id,countryId:offer.fromId,targetId:accord.foreignResponse.targetId,text};
 next.lastPeaceComplianceEvents.push(event);accord.events=[...(accord.events??[]),structuredClone(event)].slice(-20);actions.push({...event,source:'peace_response'});
}
export function applyPeaceReply(next,action,parts=[],actions=[]){
 if(!action.peaceReply)return;
 next.peaceOffers??=[];next.lastPeaceOfferEvents??=[];
 const offer=offerById(next,action.peaceReply.offerId);if(!offer||offer.status!=='pending')throw new Error('회신할 수 없는 평화 제안입니다.');
 if(action.peaceReply.kind==='decline'){
  offer.status='declined';offer.reply={turn:next.turn,kind:'decline',command:action.id,outcome:'declined',terms:structuredClone(offer.terms),costs:{food:0,money:0},mediationRecordId:null,relationChanges:[],text:'조건을 수락하지 않아 제안이 종료됐습니다. 거절 자체의 직접 지원 비용과 관계 불이익은 없습니다.'};
 }else{
  const record=(next.mediations??[]).findLast(item=>item.conflictId===offer.conflictId&&item.turn===next.turn),outcome=record?.status??action.mediationPreview?.outcome??'rejected';
  offer.status=action.peaceReply.kind==='accept'?'accepted':outcome;
  offer.reply={turn:next.turn,kind:action.peaceReply.kind,command:action.id,outcome,terms:structuredClone(action.mediationPreview.draft),costs:structuredClone(record?.costs??{food:0,money:0}),mediationRecordId:record?.id??null,relationChanges:structuredClone(record?.relationChanges??[]),text:record?.text??'제안에 회신했습니다.'};
  for(const item of actions.filter(item=>item.conflictId===offer.conflictId&&item.type?.startsWith('mediation_'))){item.source='peace_offer';item.offerId=offer.id;}
 }
 const text=offer.reply.kind==='decline'?`${COUNTRIES[next.playerId].name}이 ${COUNTRIES[offer.fromId].name}의 제안을 거절했습니다. 거절 자체의 직접 지원 비용과 관계 불이익은 없습니다.`:`${COUNTRIES[next.playerId].name}이 ${COUNTRIES[offer.fromId].name}의 제안에 회신했습니다. ${offer.reply.text}`;
 const event=replyEvent(next,offer,offer.reply,text);actions.push({countryId:next.playerId,targetId:offer.fromId,type:event.type,source:'peace_offer',offerId:offer.id,conflictId:offer.conflictId,text});
 closePeaceResponse(next,offer,offer.status,actions);
}

function stress(state,id){const country=state.countries[id];return Math.max(0,60-country.food)+Math.max(0,country.price-110)/2;}
function affectedTrade(conflict,actions){
 const crosses=item=>conflict.sanctionMembers.includes(item.countryId)&&conflict.responseMembers.includes(item.targetId)||conflict.responseMembers.includes(item.countryId)&&conflict.sanctionMembers.includes(item.targetId);
 return actions.filter(item=>item.type==='sanction'&&crosses(item)).length;
}
function termsFor(state,conflict,preferredGoal){
 const player=state.countries[state.playerId],rank={accepted:3,countered:2,rejected:1,escalated:0},drafts=[];
 for(const goal of [preferredGoal,...GOALS.filter(item=>item!==preferredGoal)])for(const condition of CONDITIONS)for(const food of FOOD)for(const money of MONEY){
  const draft={conflictId:conflict.id,goal,condition,food,money},result=previewMediation(state,draft);if(!result||result.costs.food>player.food||result.costs.money>player.treasury)continue;
  drafts.push({draft,result,score:Math.min(...result.reactions.map(item=>item.score))});
 }
 drafts.sort((a,b)=>rank[b.result.outcome]-rank[a.result.outcome]||(a.draft.condition==='mutual'?-1:1)-(b.draft.condition==='mutual'?-1:1)||(a.draft.goal===preferredGoal?-1:1)-(b.draft.goal===preferredGoal?-1:1)||a.draft.food+a.draft.money-b.draft.food-b.draft.money||b.score-a.score);
 return drafts[0]?.draft??null;
}
export function createPeaceResponseOffer(next,accord,fromId,actions=[]){
 const targetId=accord.violation.countryId,conflictId=syntheticConflictId(accord,next.turn),conflict={id:conflictId,status:'active',type:'peace_response_renegotiation',initiatorId:fromId,targetId,sanctionMembers:[],responseMembers:[],formedTurn:next.turn,startTurn:next.turn,endTurn:next.turn+4,duration:4,playerStance:'neutral',stanceTurn:next.turn,events:[],escalated:true,extraQuarters:0,reason:'외국 당사국이 위반된 평화 합의를 다시 협상해 달라고 요청했습니다.',peaceComplianceAccordId:accord.id};
 if((next.goalConflicts??[]).some(item=>item.id===conflictId))return null;
 next.goalConflicts??=[];next.goalConflicts.push(conflict);
 const country=next.countries[fromId],preferred=country.food<50||country.price>125?'relief':'peace',terms=termsFor(next,conflict,preferred);if(!terms){next.goalConflicts.pop();return null;}
 const preview=previewMediation(next,terms),offer={id:`peace-offer-${conflict.id}-${next.turn}`,conflictId:conflict.id,accordId:accord.id,origin:'peace_response',fromId,createdTurn:next.turn,expiresTurn:next.turn+3,status:'pending',terms,reason:{summary:'위반된 평화 합의의 새 조건을 요청했습니다.',food:country.food,price:country.price,relation:relation(next,next.playerId,fromId),currentlyAcceptable:preview?.outcome==='accepted'},reply:null};
 next.peaceOffers??=[];next.lastPeaceOfferEvents??=[];next.peaceOffers.push(offer);
 const text=`${COUNTRIES[fromId].name}이 위반된 평화 합의의 재협상을 먼저 요청했습니다.`,event={turn:next.turn,type:'peace_offer_created',offerId:offer.id,conflictId:conflict.id,accordId:accord.id,fromId,text,status:'pending'};next.lastPeaceOfferEvents.push(event);actions.push({countryId:fromId,targetId:next.playerId,type:event.type,source:'peace_offer',offerId:offer.id,conflictId:conflict.id,accordId:accord.id,text});return offer;
}
function mayGenerate(next,before,conflict,actions){
 if(conflict.peaceComplianceAccordId)return false;
 if(next.turn<=conflict.formedTurn||next.turn+2>=conflict.endTurn||reliefActive(next,conflict))return false;
 if((next.peaceOffers??[]).some(item=>item.conflictId===conflict.id&&item.status==='pending'))return false;
 if(pendingMediationCounters(next).some(item=>item.conflictId===conflict.id))return false;
 if(actions.some(item=>item.countryId===next.playerId&&item.conflictId===conflict.id&&item.type?.startsWith('mediation_')))return false;
 const last=(next.peaceOffers??[]).filter(item=>item.conflictId===conflict.id).at(-1);if(!last)return true;
 if(last.status==='accepted')return false;const ended=last.reply?.turn??last.expiresTurn-1;return next.turn>=ended+2;
}
function createOffer(next,conflict,actions){
 const ids=principalIds(conflict),urgent=ids.some(id=>next.countries[id].food<50||next.countries[id].price>125),terms=termsFor(next,conflict,urgent?'relief':'peace');if(!terms)return;const goal=terms.goal;
 const progress=id=>(next.foreignGoals?.[id]?.objectives?.completed??[]).length;
 const fromId=ids.filter(id=>id!==next.playerId).sort((a,b)=>stress(next,b)-stress(next,a)||progress(b)-progress(a)||relation(next,next.playerId,b)-relation(next,next.playerId,a)||a.localeCompare(b))[0];if(!fromId)return;
 const country=next.countries[fromId],need=Math.round(stress(next,fromId)),rel=relation(next,next.playerId,fromId),trade=affectedTrade(conflict,actions),termsPreview=previewMediation(next,terms),lowest=Math.min(...termsPreview.reactions.map(item=>item.score)),summary=goal==='peace'?'현재 교역 제한을 끝내기 위해 분쟁 종결을 먼저 제안했습니다.':urgent?'식량·물가 압박과 현재 교역 제한을 줄이기 위해 제재 완화를 먼저 요청했습니다.':'현재 관계로 종결 합의는 어려워, 수용 가능한 제재 완화부터 요청했습니다.';
 const offer={id:`peace-offer-${conflict.id}-${next.turn}`,conflictId:conflict.id,fromId,createdTurn:next.turn,expiresTurn:Math.min(conflict.endTurn,next.turn+3),status:'pending',terms,reason:{summary,disputeAge:next.turn-conflict.formedTurn,food:country.food,price:country.price,need,relation:rel,affectedTrade:trade,goalProgress:progress(fromId),currentlyAcceptable:termsPreview.outcome==='accepted',acceptanceGap:Math.max(0,62-lowest)},reply:null};
 next.peaceOffers.push(offer);const text=`${COUNTRIES[fromId].name}이 ${goal==='peace'?'분쟁 종결':'제재 완화'} 협상을 먼저 제안했습니다. ${summary}`;
 const event={turn:next.turn,type:'peace_offer_created',offerId:offer.id,conflictId:conflict.id,fromId,text,status:'pending'};next.lastPeaceOfferEvents.push(event);actions.push({countryId:fromId,targetId:next.playerId,type:event.type,source:'peace_offer',offerId:offer.id,conflictId:conflict.id,text});
}
export function runPeaceOffers(next,before,actions=[]){
 if(!enabled(next))return;next.peaceOffers??=[];next.lastPeaceOfferEvents??=[];
 for(const offer of next.peaceOffers.filter(item=>item.status==='pending')){
  const conflict=conflictById(next,offer.conflictId),status=!conflict||next.turn+1>=conflict.endTurn?'cancelled':next.turn+1>=offer.expiresTurn?'expired':null;if(!status)continue;
  offer.status=status;const text=status==='expired'?`${COUNTRIES[offer.fromId].name}의 협상 회신 기한이 지나 제안이 종료됐습니다.`:'분쟁 상태가 바뀌어 남아 있던 협상 제안이 종료됐습니다.';
  const event={turn:next.turn,type:'peace_offer_'+status,offerId:offer.id,conflictId:offer.conflictId,fromId:offer.fromId,text,status};next.lastPeaceOfferEvents.push(event);actions.push({countryId:offer.fromId,targetId:next.playerId,type:event.type,source:'peace_offer',offerId:offer.id,conflictId:offer.conflictId,text});
  closePeaceResponse(next,offer,status,actions);
 }
 for(const conflict of (next.goalConflicts??[]).filter(item=>item.status==='active'&&next.turn<item.endTurn))if(mayGenerate(next,before,conflict,actions))createOffer(next,conflict,actions);
 next.peaceOffers=next.peaceOffers.slice(-16);
}

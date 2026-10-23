import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';
import {marketContext} from './foreign-diplomacy.mjs?v=30';
import {tradeBlocked} from './goal-conflicts.mjs?v=30';

const KINDS=['buy','sell','aid_out','aid_in'];
const INITIAL={
 'lumen:nord':73,'cera:lumen':49,'altia:lumen':77,'lumen:marin':61,'lumen:solis':45,
 'cera:nord':69,'altia:nord':53,'marin:nord':65,'nord:solis':49,
 'altia:cera':57,'cera:marin':81,'cera:solis':61,
 'altia:marin':69,'altia:solis':53,'marin:solis':73,
};
const key=(a,b)=>[a,b].sort().join(':');
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(value)));
const effect=(kind,food,money)=>{
 switch(kind){
 case 'buy':return {playerEffect:{food,treasury:-money},partnerEffect:{food:-food,treasury:money}};
 case 'sell':return {playerEffect:{food:-food,treasury:money},partnerEffect:{food,treasury:-money}};
 case 'aid_out':return {playerEffect:{food:-food,treasury:-money},partnerEffect:{food,treasury:money}};
 case 'aid_in':return {playerEffect:{food,treasury:money},partnerEffect:{food:-food,treasury:-money}};
 default:return {playerEffect:{food:0,treasury:0},partnerEffect:{food:0,treasury:0}};
 }
};

export const initialRelations=()=>({...INITIAL});
export const getRelation=(state,a,b)=>a===b?100:state.relations?.[key(a,b)]??50;
export const relationLabel=score=>score>=75?'긴밀':score>=60?'우호':score>=45?'신중':score>=30?'긴장':'적대';
export function adjustRelation(state,a,b,delta){
 if(!a||!b||a===b)return;
 state.relations??=initialRelations();state.relations[key(a,b)]=clamp(getRelation(state,a,b)+delta);
}
export function proposalCommand(draft){return `propose:${draft.targetId}:${draft.kind}:${draft.food}:${draft.money}`;}

function parseDraft(state,draft){
 if(!draft||!COUNTRY_IDS.includes(draft.targetId)||draft.targetId===state.playerId||!KINDS.includes(draft.kind))return {error:'협상 상대나 유형이 올바르지 않습니다.'};
 const food=Number(draft.food),money=Number(draft.money);
 if(!Number.isSafeInteger(food)||food<1||food>12||!Number.isSafeInteger(money)||money<0||money>30||(draft.kind==='buy'||draft.kind==='sell')&&money<1)return {error:'식량은 1~12, 거래 대금은 1~30 범위의 정수여야 합니다.'};
 const player=state.countries[state.playerId];
 if((draft.kind==='buy'&&player.treasury<money)||(draft.kind==='sell'&&player.food<food)||(draft.kind==='aid_out'&&(player.food<food||player.treasury<money)))return {error:'제안한 조건을 이행할 식량 또는 국고가 부족합니다.'};
 if((draft.kind==='buy'&&player.food+food>100)||(draft.kind==='sell'&&player.treasury+money>100)||(draft.kind==='aid_in'&&(player.food+food>100||player.treasury+money>100)))return {error:'받을 식량 또는 국고가 보관 상한을 넘습니다.'};
 return {draft:{targetId:draft.targetId,kind:draft.kind,food,money}};
}

function counterTerms(kind,food,money){
 switch(kind){
 case 'buy':return {food:Math.max(1,food-2),money:Math.min(30,money+2)};
 case 'sell':return {food:Math.max(1,food-1),money:Math.max(1,money-2)};
 case 'aid_out':return {food:Math.max(1,food-1),money:Math.max(0,money-2)};
 case 'aid_in':return {food:Math.max(1,Math.ceil(food*.6)),money:Math.floor(money*.5)};
 default:return {food,money};
 }
}

export function previewProposal(state,input){
 const parsed=parseDraft(state,input);
 if(parsed.error)return {valid:false,error:parsed.error};
 const draft=parsed.draft,player=state.countries[state.playerId],partner=state.countries[draft.targetId],relation=getRelation(state,state.playerId,draft.targetId),unit=draft.money/draft.food;
 let score=relation,reasons=[`양국 관계 ${relation} · ${relationLabel(relation)}`];
 switch(draft.kind){
 case 'buy':score+=(partner.food-55)*.8+(unit-2)*12-draft.food*.5;reasons.push(`상대 비축 식량 ${partner.food} · ${partner.food>=65?'판매 여력 있음':'판매 여력 낮음'}`,`식량 1당 제안 대금 ${unit.toFixed(1)}`);break;
 case 'sell':score+=(60-partner.food)*.8+(2-unit)*10-draft.food*.5+(partner.treasury-40)*.2;reasons.push(`상대 식량 안정 ${partner.food} · ${partner.food<55?'수입 필요 높음':'수입 필요 낮음'}`,`상대 국고 ${partner.treasury}`);break;
 case 'aid_out':score+=Math.max(0,55-partner.food)+draft.food*2+draft.money*.4;reasons.push(`상대 식량 안정 ${partner.food} · ${partner.food<55?'지원 필요 높음':'긴급성 낮음'}`,`무상 지원 규모 식량 ${draft.food}·국고 ${draft.money}`);break;
 case 'aid_in':score+=Math.max(0,55-player.food)*.8+Math.max(-20,partner.food-60)*.8-draft.food*3-draft.money*.8;reasons.push(`우리 식량 안정 ${player.food} · ${player.food<55?'지원 필요 높음':'긴급성 낮음'}`,`상대 비축 식량 ${partner.food} · ${partner.food>=65?'지원 여력 있음':'지원 여력 낮음'}`);break;
 }
 const network=marketContext(state,draft.targetId,draft.kind,state.turn+1);score+=network.scoreDelta;reasons.push(...network.reasons);
 const partnerCannot=!canSettle(state,draft.kind,draft.targetId,{food:draft.food,money:draft.money});
 if(partnerCannot){score=Math.min(score,20);reasons.push('양국의 보유량 또는 저장 여력으로는 제안 조건을 이행할 수 없습니다.');}
 score=clamp(score);let response=score>=65?'accept':score>=40?'counter':'reject',terms=response==='counter'?counterTerms(draft.kind,draft.food,draft.money):undefined;
 if(response==='counter'&&(terms.food===draft.food&&terms.money===draft.money||!canSettle(state,draft.kind,draft.targetId,terms))){response='reject';terms=undefined;reasons.push('이행 가능한 역제안 조건을 만들 수 없습니다.');}
 return {valid:true,relation,relationLabel:relationLabel(relation),response,score,reasons,counterTerms:terms,...effect(draft.kind,draft.food,draft.money),command:proposalCommand(draft)};
}

function parseCommand(state,id){
 if(typeof id!=='string')return null;
 const proposal=id.match(/^propose:([a-z]+):(buy|sell|aid_out|aid_in):(0|[1-9]\d*):(0|[1-9]\d*)$/);
 if(proposal){const draft={targetId:proposal[1],kind:proposal[2],food:Number(proposal[3]),money:Number(proposal[4])},preview=previewProposal(state,draft);return preview.valid&&id===proposalCommand(draft)?{type:'proposal',draft,preview}:null;}
 const reply=id.match(/^reply:([^:]+):(accept|decline)$/);
 if(reply){
  const record=state.negotiations?.find(item=>item.id===reply[1]&&item.status==='countered'&&item.expiresTurn>state.turn);if(!record)return null;
  if(reply[2]==='accept'&&!canSettle(state,record.kind,record.targetId,record.counterTerms))return null;
  return {type:'reply',record,verb:reply[2]};
 }
 return null;
}
export function negotiationAction(state,id){
 const parsed=parseCommand(state,id);if(!parsed)return null;
 if(parsed.type==='proposal')return {id,name:`${COUNTRIES[parsed.draft.targetId].name}에 협상 제안`,cost:0,foodCost:0,tag:'외교',proposal:parsed.draft,preview:parsed.preview,description:'이번 분기 한 번의 거래 또는 지원을 제안합니다.',forecast:'상대국이 관계와 현재 자원에 따라 응답합니다.'};
 return {id,name:`${COUNTRIES[parsed.record.targetId].name} 역제안 ${parsed.verb==='accept'?'수락':'거절'}`,cost:0,foodCost:0,tag:'외교',negotiationId:parsed.record.id,verb:parsed.verb,description:'보관된 역제안에 답합니다.',forecast:'답변과 관계 변화가 이번 분기에 반영됩니다.'};
}

function canSettle(state,kind,targetId,terms){
 if(['buy','sell'].includes(kind)&&tradeBlocked({...state,turn:state.turn+1},state.playerId,targetId))return false;
 const player=state.countries[state.playerId],partner=state.countries[targetId],{food,money}=terms;
 const {playerEffect,partnerEffect}=effect(kind,food,money),metrics=['food','treasury'];
 return metrics.every(metric=>player[metric]+playerEffect[metric]>=0&&player[metric]+playerEffect[metric]<=100&&partner[metric]+partnerEffect[metric]>=0&&partner[metric]+partnerEffect[metric]<=100);
}
function settle(next,record,terms,parts,actions){
 const {playerEffect,partnerEffect}=effect(record.kind,terms.food,terms.money),player=next.countries[next.playerId],partner=next.countries[record.targetId];
 player.food+=playerEffect.food;player.treasury+=playerEffect.treasury;partner.food+=partnerEffect.food;partner.treasury+=partnerEffect.treasury;
 record.settlement={foodDelta:playerEffect.food,moneyDelta:playerEffect.treasury,terms:{...terms}};parts.push({label:`${partner.name} 협상 거래`,value:playerEffect.food});
 const aid=record.kind.startsWith('aid'),fromId=playerEffect.food<0?next.playerId:record.targetId,toId=fromId===next.playerId?record.targetId:next.playerId;
 const payment=record.kind==='buy'?`${COUNTRIES[next.playerId].name} → ${partner.name}: 대금 ${terms.money}`:record.kind==='sell'?`${partner.name} → ${COUNTRIES[next.playerId].name}: 대금 ${terms.money}`:'';
 actions.push({countryId:fromId,targetId:toId,type:aid?'aid':'trade',source:'negotiation',text:aid?`${COUNTRIES[fromId].name} → ${COUNTRIES[toId].name}: 식량 ${terms.food}${terms.money?` · 지원금 ${terms.money}`:''} 무상 지원.`:`${COUNTRIES[fromId].name} → ${COUNTRIES[toId].name}: 식량 ${terms.food} · ${payment}.`});
}
export function applyNegotiation(next,action,parts,actions){
 if(action.proposal){
  for(const item of next.negotiations)if(item.targetId===action.proposal.targetId&&item.status==='countered')item.status='superseded';
  const preview=action.preview,relationBefore=getRelation(next,next.playerId,action.proposal.targetId),record={id:`neg-${next.playerId}-${action.proposal.targetId}-${next.turn}`,playerId:next.playerId,targetId:action.proposal.targetId,kind:action.proposal.kind,terms:{food:action.proposal.food,money:action.proposal.money},status:preview.response==='accept'?'accepted':preview.response==='counter'?'countered':'rejected',createdTurn:next.turn,reasons:preview.reasons,relationBefore,relationAfter:relationBefore};
  if(record.status==='accepted'){settle(next,record,record.terms,parts,actions);adjustRelation(next,next.playerId,record.targetId,4);record.resolvedTurn=next.turn;}
  else if(record.status==='countered'){record.counterTerms=preview.counterTerms;record.expiresTurn=next.turn+3;adjustRelation(next,next.playerId,record.targetId,1);actions.push({countryId:record.targetId,targetId:next.playerId,type:'negotiation',source:'negotiation',text:`${COUNTRIES[record.targetId].name} 측이 조건을 조정해 역제안했습니다.`});}
  else{record.resolvedTurn=next.turn;adjustRelation(next,next.playerId,record.targetId,-3);actions.push({countryId:record.targetId,targetId:next.playerId,type:'negotiation',source:'negotiation',text:`${COUNTRIES[record.targetId].name} 측이 현재 관계와 자원 사정으로 제안을 거절했습니다.`});}
  record.relationAfter=getRelation(next,next.playerId,record.targetId);next.negotiations.push(record);return;
 }
 if(!action.negotiationId)return;
 const record=next.negotiations.find(item=>item.id===action.negotiationId);record.resolvedTurn=next.turn;record.replyRelationBefore=getRelation(next,next.playerId,record.targetId);
 if(action.verb==='decline'){record.status='declined';adjustRelation(next,next.playerId,record.targetId,-1);actions.push({countryId:next.playerId,targetId:record.targetId,type:'negotiation',source:'negotiation',text:'역제안을 거절했습니다.'});}
 else{record.status='accepted';settle(next,record,record.counterTerms,parts,actions);adjustRelation(next,next.playerId,record.targetId,3);}
 record.relationAfter=getRelation(next,next.playerId,record.targetId);
}
export function updateNegotiations(next,actions){
 for(const item of next.negotiations)if(item.status==='countered'&&next.turn>=item.expiresTurn){item.status='expired';item.resolvedTurn=next.turn;actions.push({countryId:item.targetId,targetId:next.playerId,type:'expiry',source:'negotiation',text:`${COUNTRIES[item.targetId].name}의 역제안 기한이 지났습니다.`});}
 const pending=next.negotiations.filter(item=>item.status==='countered'),archive=next.negotiations.filter(item=>item.status!=='countered').slice(-(40-pending.length));next.negotiations=[...archive,...pending].sort((a,b)=>a.createdTurn-b.createdTurn);
}
export const pendingCounters=state=>(state.negotiations??[]).filter(item=>item.status==='countered'&&item.expiresTurn>state.turn);

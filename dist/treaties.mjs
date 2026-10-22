import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {getRelation,relationLabel} from './negotiations.mjs?v=29';
import {breakTreaty,ensureTreatyState} from './treaty-effects.mjs?v=29';
import {executeTreaties} from './treaty-execution.mjs?v=29';
import {marketContext} from './foreign-diplomacy.mjs?v=29';
import {tradeBlocked} from './goal-conflicts.mjs?v=29';

const KINDS=['trade_buy','trade_sell','alliance'],DURATIONS=[4,8,12];
export const getReliability=(state,id)=>Math.max(0,Math.min(100,Math.round(state.reliability?.[id]??70)));
export const activeTreaties=state=>(state.treaties??[]).filter(item=>item.status==='active');
export const treatyCommand=draft=>`treaty:${draft.targetId}:${draft.kind}:${draft.food}:${draft.money}:${draft.duration}`;
const category=kind=>kind==='alliance'?'alliance':'trade';

function parseDraft(state,input){
 if(!input||!COUNTRY_IDS.includes(input.targetId)||input.targetId===state.playerId||!KINDS.includes(input.kind))return {error:'협정 상대나 유형이 올바르지 않습니다.'};
 const food=Number(input.food),money=Number(input.money),duration=Number(input.duration),alliance=input.kind==='alliance';
 if(!Number.isSafeInteger(food)||food<1||food>(alliance?6:8)||!Number.isSafeInteger(money)||money<(alliance?0:1)||money>(alliance?6:20)||!DURATIONS.includes(duration))return {error:alliance?'동맹 지원은 식량 1~6, 지원금 0~6, 기간 4·8·12분기여야 합니다.':'무역은 식량 1~8, 대금 1~20, 기간 4·8·12분기여야 합니다.'};
 if(activeTreaties(state).some(item=>item.targetId===input.targetId&&category(item.kind)===category(input.kind)))return {error:'같은 상대와 같은 종류의 활성 협정이 이미 있습니다.'};
 return {draft:{targetId:input.targetId,kind:input.kind,food,money,duration}};
}

export function previewTreaty(state,input){
 const parsed=parseDraft(state,input);if(parsed.error)return {valid:false,error:parsed.error};
 const draft=parsed.draft,player=state.countries[state.playerId],partner=state.countries[draft.targetId],relation=getRelation(state,state.playerId,draft.targetId),reliability=getReliability(state,state.playerId),unit=draft.money/draft.food;
 let score=relation*.55+reliability*.25-draft.duration*.55,reasons=[`양국 관계 ${relation} · ${relationLabel(relation)}`,`우리 약속 신뢰도 ${reliability}`,`${draft.duration}분기 동안 매 분기 이행`];
 if(draft.kind==='trade_buy'){score+=(partner.food-45)*.45+(unit-1.5)*8-draft.food*.5;reasons.push(`상대 식량 안정 ${partner.food}`,`식량 1당 대금 ${unit.toFixed(1)}`);}
 if(draft.kind==='trade_sell'){score+=(55-partner.food)*.45+(partner.treasury-35)*.25+(2.5-unit)*5-draft.food*.4;reasons.push(`상대 식량 안정 ${partner.food} · 국고 ${partner.treasury}`,`식량 1당 대금 ${unit.toFixed(1)}`);}
 if(draft.kind==='alliance'){score+=(Math.max(0,55-player.food)+Math.max(0,55-partner.food))*.25+(relation-50)*.15-draft.food*.6;reasons.push(`양국 식량 안정 ${player.food} / ${partner.food}`,`위기 시 최대 식량 ${draft.food}${draft.money?`·지원금 ${draft.money}`:''} 상호 지원`);}
 const network=marketContext(state,draft.targetId,draft.kind,state.turn+1);score+=network.scoreDelta;reasons.push(...network.reasons);
 const blocked=draft.kind!=='alliance'&&tradeBlocked({...state,turn:state.turn+1},state.playerId,draft.targetId);
 score=blocked?0:Math.max(0,Math.min(100,Math.round(score)));const response=score>=52?'accept':'reject';
 if(response==='reject')reasons.push(score<40?'관계와 약속 신뢰가 장기 의무를 감당하기 어렵습니다.':'조건과 기간에 비해 상대국의 이익이 충분하지 않습니다.');
 return {valid:true,response,score,reasons,relation,reliability,command:treatyCommand(draft)};
}

function parseAction(state,id){
 if(typeof id!=='string')return null;
 const match=id.match(/^treaty:([a-z]+):(trade_buy|trade_sell|alliance):(0|[1-9]\d*):(0|[1-9]\d*):(4|8|12)$/);
 if(match){const draft={targetId:match[1],kind:match[2],food:Number(match[3]),money:Number(match[4]),duration:Number(match[5])},preview=previewTreaty(state,draft);return preview.valid&&id===treatyCommand(draft)?{draft,preview}:null;}
 const broken=id.match(/^break:([^:]+)$/);if(!broken)return null;
 const treaty=activeTreaties(state).find(item=>item.id===broken[1]&&(item.playerId===state.playerId||item.targetId===state.playerId));return treaty?{treaty}:null;
}
export function treatyAction(state,id){
 const parsed=parseAction(state,id);if(!parsed)return null;
 if(parsed.treaty)return {id,name:`${COUNTRIES[parsed.treaty.targetId].name} 협정 파기`,cost:0,foodCost:0,tag:'협정',treatyBreakId:parsed.treaty.id,description:'남은 이행 의무를 즉시 끝내고 관계와 약속 신뢰도에 불이익을 받습니다.',forecast:'양국 관계 −12 · 파기국 신뢰도 −12 · 제3국 관계 −2'};
 return {id,name:`${COUNTRIES[parsed.draft.targetId].name}에 장기 협정 제안`,cost:0,foodCost:0,tag:'협정',treatyDraft:parsed.draft,treatyPreview:parsed.preview,description:'이번 분기 협정을 제안하고, 수락되면 같은 분기 생산 뒤 첫 의무를 이행합니다.',forecast:`${parsed.draft.duration}분기 동안 매 분기 이행`};
}

export function applyTreatyDecision(next,action,parts,actions){
 ensureTreatyState(next);
 if(action.treatyBreakId){const treaty=activeTreaties(next).find(item=>item.id===action.treatyBreakId);if(treaty)breakTreaty(next,treaty,next.playerId,actions);return;}
 if(!action.treatyDraft)return;
 const preview=action.treatyPreview,draft=action.treatyDraft,id=`treaty-${next.playerId}-${draft.targetId}-${next.turn}-${category(draft.kind)}`;
 const treaty={id,playerId:next.playerId,targetId:draft.targetId,kind:draft.kind,food:draft.food,money:draft.money,duration:draft.duration,status:preview.response==='accept'?'active':'rejected',startTurn:next.turn,endTurn:next.turn+draft.duration,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]};
 next.treaties.push(treaty);const text=preview.response==='accept'?`${COUNTRIES[draft.targetId].name} 측이 ${draft.duration}분기 협정을 수락했습니다. 이번 분기부터 첫 의무를 이행합니다.`:`${COUNTRIES[draft.targetId].name} 측이 관계·신뢰도·조건을 검토한 뒤 장기 협정을 거절했습니다.`;
 next.lastTreatyEvents.push({treatyId:id,targetId:draft.targetId,turn:next.turn,type:preview.response==='accept'?'accepted':'rejected',text,reasons:preview.reasons,relationBefore:preview.relation,relationAfter:preview.relation,reliabilityBefore:preview.reliability,reliabilityAfter:preview.reliability});
 actions.push({countryId:draft.targetId,targetId:next.playerId,type:'treaty',source:'treaty',text});
 const active=next.treaties.filter(item=>item.status==='active'),archive=next.treaties.filter(item=>item.status!=='active').slice(-(50-active.length));next.treaties=[...archive,...active].sort((a,b)=>a.startTurn-b.startTurn);
}
export function runTreaties(next,parts,actions){ensureTreatyState(next);executeTreaties(next,parts,actions);}

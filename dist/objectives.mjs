import {COUNTRY_IDS} from './country-data.mjs?v=31';
import {OBJECTIVE_PLANS,OBJECTIVE_POLICIES} from './objectives-data.mjs?v=31';

const MAX_COUNT=99;
const TRACKED=new Set([
 'balanced','secure_imports','strategic_reserve','export_push','research','expand_routes','emergency_import','resilience',
 ...COUNTRY_IDS.flatMap(id=>[`mandate_${id}_1`,`mandate_${id}_2`]),'fulfilledTreaties',
]);
const capped=value=>Math.max(0,Math.min(MAX_COUNT,Math.floor(Number(value)||0)));

export const createObjectives=playerId=>{
 if(!COUNTRY_IDS.includes(playerId))throw new Error('목표를 만들 수 없는 국가입니다.');
 return {playerId,completed:[],counts:{},stableQuarters:0,pendingEvent:null};
};

const normalized=(value,playerId)=>{
 const base=createObjectives(playerId),candidate=value&&typeof value==='object'?value:base,source=candidate.playerId&&candidate.playerId!==playerId?base:candidate;
 const completed=(Array.isArray(source.completed)?source.completed:[]).filter(item=>[1,2,3].includes(item?.stage)).map(item=>structuredClone(item));
 const counts={};for(const [key,value] of Object.entries(source.counts??{}))if(TRACKED.has(key)&&capped(value)>0)counts[key]=capped(value);
 return {playerId,completed,counts,stableQuarters:capped(source.stableQuarters),pendingEvent:source.pendingEvent?structuredClone(source.pendingEvent):null};
};
const currentStage=objectives=>[1,2,3].find(stage=>!objectives.completed.some(item=>item.stage===stage))??4;
const metricValue=(state,key)=>key==='farmLevel'?state.farmLevel??0:state.countries?.[state.playerId]?.[key]??0;
const progress=(requirement,state,objectives)=>{
 let current=0;
 if(requirement.kind==='count')current=requirement.keys.reduce((sum,key)=>sum+capped(objectives.counts[key]),0);
 if(requirement.kind==='metric')current=metricValue(state,requirement.key);
 if(requirement.kind==='stable')current=objectives.stableQuarters;
 return {label:requirement.label,current,target:requirement.target,met:current>=requirement.target};
};
const stageProgress=(plan,stage,state,objectives)=>plan.stages[stage-1].requirements.map(item=>progress(item,state,objectives));

export function advanceObjectives(before,next,actionId){
 const playerId=next.playerId??before.playerId??'lumen';if(!COUNTRY_IDS.includes(playerId))return createObjectives('lumen');
 const objectives=normalized(before.objectives,playerId),boundary=Number.isSafeInteger(next.objectiveStartTurn)?next.objectiveStartTurn:Number.isSafeInteger(before.objectiveStartTurn)?before.objectiveStartTurn:before.turn+1;
 if(next.turn<boundary)return objectives;
 objectives.pendingEvent=null;
 const actual=typeof actionId==='string'?actionId:next.history?.at(-1)?.policyId;
 if(TRACKED.has(actual))objectives.counts[actual]=capped((objectives.counts[actual]??0)+1);
 const fulfilled=(next.lastTreatyEvents??[]).filter(event=>event?.type==='fulfilled').length;
 if(fulfilled)objectives.counts.fulfilledTreaties=capped((objectives.counts.fulfilledTreaties??0)+fulfilled);
 const plan=OBJECTIVE_PLANS[playerId],stage=currentStage(objectives);
 if(stage===2){const country=next.countries?.[playerId]??{},healthy=country.food>=plan.health.food&&country.price<=plan.health.price;objectives.stableQuarters=healthy?capped(objectives.stableQuarters+1):0;}
 if(stage>3)return objectives;
 const requirements=stageProgress(plan,stage,next,objectives);if(!requirements.every(item=>item.met))return objectives;
 const definition=plan.stages[stage-1],unlockId=definition.unlockId;
 objectives.completed.push({stage,turn:next.turn,title:definition.title,unlockId});
 if(stage===2)objectives.pendingEvent={id:`mandate_${playerId}_briefing`,title:plan.briefingTitle,description:plan.briefingDescription,openedTurn:next.turn,options:[unlockId,OBJECTIVE_POLICIES[playerId][0].id,'maintain']};
 return objectives;
}

export function getObjectiveView(state){
 const playerId=state.playerId??'lumen',plan=OBJECTIVE_PLANS[playerId],objectives=normalized(state.objectives,playerId),stage=currentStage(objectives),done=stage===4;
 const definition=done?plan.stages[2]:plan.stages[stage-1],nextUnlock=definition.unlockId?OBJECTIVE_POLICIES[playerId].find(item=>item.id===definition.unlockId)??null:null;
 return {title:plan.title,stage,stageTitle:done?'국가 목표 달성':definition.title,requirements:done?[]:stageProgress(plan,stage,state,objectives),completed:structuredClone(objectives.completed),nextUnlock:nextUnlock?{id:nextUnlock.id,name:nextUnlock.name,description:nextUnlock.description}:null,done,pendingEvent:objectives.pendingEvent?structuredClone(objectives.pendingEvent):null};
}

export function unlockedPolicies(state){
 const playerId=state.playerId??'lumen';if(!COUNTRY_IDS.includes(playerId))return [];
 if(Number.isSafeInteger(state.objectiveStartTurn)&&state.turn+1<state.objectiveStartTurn)return [];
 const stages=new Set(normalized(state.objectives,playerId).completed.map(item=>item.stage));
 return OBJECTIVE_POLICIES[playerId].filter((item,index)=>stages.has(index+1)).map(item=>structuredClone(item));
}

export function getObjectivePlan(playerId){
 if(!COUNTRY_IDS.includes(playerId))throw new Error('목표를 찾을 수 없는 국가입니다.');
 const plan=OBJECTIVE_PLANS[playerId];
 const describe=requirement=>`${requirement.label} · ${requirement.target}${requirement.kind==='stable'?'분기':requirement.kind==='count'?'회':requirement.key==='farmLevel'?'단계':requirement.key==='treasury'?'억 이상':' 이상'}`;
 return {title:plan.title,stages:plan.stages.map(item=>({title:item.title,requirements:item.requirements.map(describe),unlockId:item.unlockId}))};
}

export {OBJECTIVE_PLANS};

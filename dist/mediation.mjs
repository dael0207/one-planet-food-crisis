import {COUNTRIES} from './country-data.mjs?v=29';

const GOALS=['relief','peace'],CONDITIONS=['mutual','target'],FOOD=[0,4,8],MONEY=[0,6,12];
const pairKey=(a,b)=>[a,b].sort().join(':');
const relation=(state,a,b)=>a===b?100:state.relations?.[pairKey(a,b)]??50;
const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
const enabled=state=>Number.isSafeInteger(state?.mediationStartTurn)&&state.turn>=state.mediationStartTurn;
const principalIds=conflict=>[conflict.initiatorId,conflict.targetId];
const findConflict=(state,id)=>state.goalConflicts?.find(item=>item.id===id&&item.status==='active'&&state.turn<item.endTurn)??null;
const recordById=(state,id)=>(state.mediations??[]).find(item=>item.id===id&&item.status==='countered'&&state.turn+1<item.expiresTurn)??null;

function parsedDraft(value){
 if(!value||typeof value!=='object'||typeof value.conflictId!=='string'||!/^goal-conflict-[a-z]+-[a-z]+-\d+$/.test(value.conflictId)||!GOALS.includes(value.goal)||!CONDITIONS.includes(value.condition)||!FOOD.includes(value.food)||!MONEY.includes(value.money))return null;
 return {conflictId:value.conflictId,goal:value.goal,condition:value.condition,food:value.food,money:value.money};
}
function allocate(state,ids,total,key){
 return ids.map((countryId,index)=>({countryId,amount:Math.min(index?Math.floor(total/2):Math.ceil(total/2),Math.max(0,100-state.countries[countryId][key]))}));
}
function projectedCosts(state,conflict,draft){
 const ids=principalIds(conflict),foodShares=allocate(state,ids,draft.food,'food'),moneyShares=allocate(state,ids,draft.money,'treasury');
 return {food:foodShares.reduce((sum,item)=>sum+item.amount,0),money:moneyShares.reduce((sum,item)=>sum+item.amount,0),foodShares,moneyShares};
}
function reaction(state,conflict,draft,costs,countryId){
 const isInitiator=countryId===conflict.initiatorId,food=costs.foodShares.find(item=>item.countryId===countryId)?.amount??0,money=costs.moneyShares.find(item=>item.countryId===countryId)?.amount??0;
 let score=relation(state,state.playerId,countryId)-15+food*2+money*.7+(draft.condition==='mutual'?4:isInitiator?8:-14)+(draft.goal==='relief'?4:-6)+((state.reliability?.[state.playerId]??70)-70)/5;
 if(conflict.playerStance==='neutral')score+=2;
 if(conflict.playerStance==='sanction')score+=isInitiator?5:-7;
 if(conflict.playerStance==='response')score+=isInitiator?-7:5;
 score=Math.round(score);
 const reasons=[`양국 관계 ${relation(state,state.playerId,countryId)}`,draft.condition==='mutual'?'양측에 같은 조건을 제시했습니다.':isInitiator?'대응국만 양보하는 조건입니다.':'자국에만 양보를 요구하는 조건입니다.'];
 if(food||money)reasons.push(`제안 몫 식량 ${food} · 재정 ${money}.`);
 return {countryId,score,attitude:score>=62?'accept':score>=48?'counter':'reject',reasons};
}
function preview(state,draft){
 if(!enabled(state))return null;
 const parsed=parsedDraft(draft),conflict=parsed&&findConflict(state,parsed.conflictId),executionTurn=state.turn+1;
 if(!parsed||!conflict||executionTurn>=conflict.endTurn||state.mediationOfferTurnByConflict?.[conflict.id]===executionTurn)return null;
 const costs=projectedCosts(state,conflict,parsed),reactions=principalIds(conflict).map(id=>reaction(state,conflict,parsed,costs,id)),lowest=Math.min(...reactions.map(item=>item.score));
 let outcome=reactions.every(item=>item.score>=62)?'accepted':lowest>=48?'countered':parsed.condition==='target'&&lowest<=38?'escalated':'rejected';
 const counterTerms=outcome==='countered'?{...parsed,condition:'mutual',food:Math.max(8,parsed.food),money:Math.max(12,parsed.money)}:null;
 const reliefQuarters=Math.min(2,conflict.endTurn-executionTurn),goalLabel=parsed.goal==='peace'?'분쟁 종결':`${reliefQuarters}분기 제재 완화`,conditionLabel=parsed.condition==='mutual'?'상호 양보':'대응국 단독 양보';
 return {outcome,reactions,reliefQuarters,terms:{goal:parsed.goal,condition:parsed.condition,food:costs.food,money:costs.money},draft:parsed,counterTerms,costs,description:`${goalLabel} · ${conditionLabel} · 실제 부담 식량 ${costs.food}, 국고 ${costs.money}`};
}

export function mediationCommand(draft){
 const parsed=parsedDraft(draft);return parsed?`mediate:${parsed.conflictId}:${parsed.goal}:${parsed.condition}:${parsed.food}:${parsed.money}`:null;
}
export function previewMediation(state,draft){return preview(state,draft);}
export function pendingMediationCounters(state){return (state.mediations??[]).filter(item=>item.status==='countered'&&state.turn+1<item.expiresTurn&&findConflict(state,item.conflictId));}
export function reliefActive(state,conflict){return conflict?.status==='active'&&Number.isSafeInteger(conflict.ceasefireStartTurn)&&Number.isSafeInteger(conflict.ceasefireUntil)&&state.turn>=conflict.ceasefireStartTurn&&state.turn<conflict.ceasefireUntil;}

export function mediationAction(state,id){
 if(typeof id!=='string')return null;
 const accept=id.match(/^mediate-accept:(mediation-[\w-]+-\d+)$/);
 if(accept){
  const record=recordById(state,accept[1]),fresh=record&&preview(state,record.counterTerms);if(!fresh)return null;
  const settles=fresh.outcome==='accepted';
  return {id,name:'중재 역제안 회신',tag:'외교',cost:settles?fresh.costs.money:0,foodCost:settles?fresh.costs.food:0,mediation:{kind:'accept-counter',recordId:record.id},mediationPreview:fresh,description:fresh.description,forecast:settles?'현재 관계에서도 양국이 동의해 이번 분기에 바로 적용됩니다.':'관계 변화로 양국의 동의가 무너져 비용 없이 협상이 결렬됩니다.'};
 }
 const match=id.match(/^mediate:([^:]{1,96}):(relief|peace):(mutual|target):(0|4|8):(0|6|12)$/);if(!match)return null;
 const draft={conflictId:match[1],goal:match[2],condition:match[3],food:Number(match[4]),money:Number(match[5])},result=preview(state,draft);if(!result)return null;
 return {id,name:draft.goal==='peace'?'분쟁 중재안 제시':'제재 완화안 제시',tag:'외교',cost:result.outcome==='accepted'?result.costs.money:0,foodCost:result.outcome==='accepted'?result.costs.food:0,mediation:{kind:'offer'},mediationPreview:result,description:result.description,forecast:{accepted:'이번 분기에 합의가 발효됩니다.',countered:'상대국이 강화된 조건을 역제안합니다. 수락 전에는 비용이 없습니다.',rejected:'합의 없이 분쟁이 이어집니다.',escalated:'강압적 조건으로 갈등과 제재 기간이 확대됩니다.'}[result.outcome]};
}

function adjust(state,a,b,delta){if(a===b)return;state.relations[pairKey(a,b)]=clamp(relation(state,a,b)+delta);}
function transferCosts(next,conflict,previewResult,parts,actions){
 const player=next.countries[next.playerId];player.food-=previewResult.costs.food;
 for(const share of previewResult.costs.foodShares)next.countries[share.countryId].food+=share.amount;
 for(const share of previewResult.costs.moneyShares)next.countries[share.countryId].treasury+=share.amount;
 if(previewResult.costs.food)parts.push({label:'평화 협상 식량 기여',value:-previewResult.costs.food});
 actions.push({countryId:next.playerId,targetId:conflict.targetId,type:'mediation_transfer',source:'goal_conflict',conflictId:conflict.id,food:previewResult.costs.food,money:previewResult.costs.money,text:`${COUNTRIES[next.playerId].name}이 중재 합의 이행에 식량 ${previewResult.costs.food} · 국고 ${previewResult.costs.money}을 제공했습니다.`});
}
function accepted(next,conflict,result,parts,actions){
 transferCosts(next,conflict,result,parts,actions);
 const relationGain=result.draft.goal==='peace'?7:3;for(const id of principalIds(conflict))adjust(next,next.playerId,id,relationGain);adjust(next,conflict.initiatorId,conflict.targetId,result.draft.goal==='peace'?8:2);
 if(result.draft.goal==='peace'){conflict.status='resolved';conflict.resolvedTurn=next.turn;conflict.resolvedBy='mediation';}
 else{conflict.ceasefireStartTurn=next.turn;conflict.ceasefireUntil=Math.min(conflict.endTurn,next.turn+2);}
 const text=result.draft.goal==='peace'?`${COUNTRIES[conflict.initiatorId].name}과 ${COUNTRIES[conflict.targetId].name}이 중재안을 수용해 분쟁과 교역 제한을 종료했습니다.`:`양측이 중재안을 수용해 ${conflict.ceasefireUntil-next.turn}분기 동안 제재와 공동 대응을 멈춥니다.`;
 actions.push({countryId:next.playerId,targetId:conflict.targetId,type:'mediation_accepted',source:'goal_conflict',conflictId:conflict.id,text});return text;
}
export function applyMediation(next,action,parts=[],actions=[]){
 const result=action.mediationPreview;if(!action.mediation||!result) return;
 next.mediations??=[];next.lastMediationEvents??=[];next.mediationOfferTurnByConflict??={};
 const conflict=findConflict(next,result.draft.conflictId);if(!conflict)throw new Error('중재할 수 없는 국제 분쟁입니다.');
 let record=action.mediation.kind==='accept-counter'?next.mediations.find(item=>item.id===action.mediation.recordId):null;
 if(action.mediation.kind==='accept-counter'&&(!record||record.status!=='countered'||next.turn>=record.expiresTurn))throw new Error('중재 역제안이 만료되었습니다.');
 const observerIds=[...new Set([...conflict.sanctionMembers,...conflict.responseMembers].filter(id=>![next.playerId,...principalIds(conflict)].includes(id)))];
 const trackedPairs=[...new Map([...principalIds(conflict).map(id=>[next.playerId,id]),[conflict.initiatorId,conflict.targetId],...observerIds.map(id=>[next.playerId,id])].map(pair=>[pairKey(...pair),pair])).values()],beforeRelations=new Map(trackedPairs.map(([a,b])=>[pairKey(a,b),relation(next,a,b)]));
 const id=record?.id??`mediation-${conflict.id}-${next.turn}`;let text;
 if(result.outcome==='accepted')text=accepted(next,conflict,result,parts,actions);
 else if(result.outcome==='countered')text='양측이 더 균형 잡힌 지원 조건을 역제안했습니다. 수락 전에는 자원이 이전되지 않습니다.';
 else if(result.outcome==='escalated'){
  const extended=!conflict.escalated;
  if(extended){conflict.endTurn+=2;conflict.duration+=2;conflict.extraQuarters=2;conflict.escalated=true;next.conflictCooldownUntil+=2;}
  for(const principal of principalIds(conflict))adjust(next,next.playerId,principal,-5);adjust(next,conflict.initiatorId,conflict.targetId,-4);
  for(const observerId of observerIds)adjust(next,next.playerId,observerId,-1);
  text=extended?'일방적 양보 요구로 협상이 결렬되고 제재와 공동 대응이 2분기 연장됐습니다.':'일방적 양보 요구가 다시 거절돼 국가 관계가 악화됐습니다. 제재 기간은 더 늘어나지 않습니다.';actions.push({countryId:conflict.initiatorId,targetId:conflict.targetId,type:'mediation_escalated',source:'goal_conflict',conflictId:conflict.id,text});
 }else{text='양측이 제시된 조건을 거절해 분쟁이 예정대로 이어집니다.';for(const principal of principalIds(conflict))adjust(next,next.playerId,principal,-2);actions.push({countryId:next.playerId,targetId:conflict.targetId,type:'mediation_rejected',source:'goal_conflict',conflictId:conflict.id,text});}
 const relationChanges=trackedPairs.map(([a,b])=>{const before=beforeRelations.get(pairKey(a,b)),after=relation(next,a,b);return {a,b,before,after,delta:after-before};}).filter(item=>item.delta);
 const observerChanges=observerIds.map(countryId=>{const change=relationChanges.find(item=>pairKey(item.a,item.b)===pairKey(next.playerId,countryId));return {countryId,delta:change?.delta??0};}).filter(item=>item.delta);
 const transfers=result.outcome==='accepted'?{foodShares:structuredClone(result.costs.foodShares),moneyShares:structuredClone(result.costs.moneyShares)}:{foodShares:[],moneyShares:[]};
 const values={status:result.outcome==='countered'?'countered':result.outcome,turn:next.turn,expiresTurn:result.outcome==='countered'?next.turn+2:null,counterTerms:result.counterTerms??record?.counterTerms??null,costs:result.outcome==='accepted'?{food:result.costs.food,money:result.costs.money}:{food:0,money:0},transfers,relationChanges,observerChanges,reactions:structuredClone(result.reactions),terms:structuredClone(result.terms),text};
 if(record)Object.assign(record,values);else{record={id,conflictId:conflict.id,...values};next.mediations.push(record);}
 next.mediationOfferTurnByConflict[conflict.id]=next.turn;const event={turn:next.turn,type:'mediation_'+record.status,conflictId:conflict.id,recordId:id,text,costs:structuredClone(record.costs),transfers:structuredClone(record.transfers),relationChanges:structuredClone(record.relationChanges),observerChanges:structuredClone(record.observerChanges),counterTerms:record.counterTerms?structuredClone(record.counterTerms):null,expiresTurn:record.expiresTurn};next.lastMediationEvents.push(event);conflict.events.push(event);
}
export function updateMediations(next,actions=[]){
 if(!enabled(next))return;
 next.mediations??=[];next.lastMediationEvents??=[];
 for(const record of next.mediations.filter(item=>item.status==='countered'&&(next.turn+1>=item.expiresTurn||!findConflict(next,item.conflictId)))){
  const active=findConflict(next,record.conflictId),status=active?'expired':'cancelled';record.status=status;
  const text=active?'중재 역제안의 회신 기한이 지나 분쟁이 계속됩니다.':'분쟁 상태가 바뀌어 남아 있던 중재 역제안이 종료됐습니다.',event={turn:next.turn,type:'mediation_'+status,conflictId:record.conflictId,recordId:record.id,text,costs:{food:0,money:0},transfers:{foodShares:[],moneyShares:[]},relationChanges:[],observerChanges:[],counterTerms:null,expiresTurn:record.expiresTurn};next.lastMediationEvents.push(event);actions.push({countryId:next.playerId,type:'mediation_'+status,source:'goal_conflict',conflictId:record.conflictId,text});
 }
 next.mediations=next.mediations.slice(-12);
}

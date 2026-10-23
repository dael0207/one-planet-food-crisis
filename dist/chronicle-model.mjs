import {COUNTRY_IDS,advanceTurn,createGame} from './engine.mjs?v=30';

const METRICS=['food','treasury','price','trust','approval'];
const cache=new WeakMap();
const zeroEffect=()=>({food:0,treasury:0,price:0,trust:0});
const clone=value=>structuredClone(value);
const relationKey=(a,b)=>[a,b].sort().join(':');

export function quarterLabel(turn){
 if(turn===0)return '운영 시작';
 const year=2031+Math.floor((turn-1)/4),quarter=(turn-1)%4+1;
 return `${year}년 ${quarter}분기`;
}

const metricsOf=country=>Object.fromEntries(METRICS.map(metric=>[metric,country[metric]]));
const relationsOf=(state,playerId)=>Object.fromEntries(COUNTRY_IDS.filter(id=>id!==playerId).map(id=>[id,state.relations?.[relationKey(playerId,id)]??50]));
const facilityProduction=record=>(record.foodBreakdown??[]).filter(item=>(item.label?.startsWith('국가 생산 시설')||item.label?.startsWith('농경지 정기 생산'))).reduce((sum,item)=>sum+(Number(item.value)||0),0);
const developmentOf=record=>clone(record.development??{levelBefore:null,levelAfter:null,started:[],completed:[],ongoing:[]});
const objectiveAchievementsOf=record=>clone(Array.isArray(record.objectiveAchievements)?record.objectiveAchievements:[]);

function initialPoint(state){
 const country=state.countries[state.playerId],metrics=metricsOf(country);
 return {turn:0,actionLabel:'운영 시작',policyId:null,eventTitle:null,metrics,beforeMetrics:{...metrics},relations:relationsOf(state,state.playerId),relationEffects:[],facilityLevel:state.farmLevel,facilityProduction:0,investmentCost:0,cumulativeInvestmentCost:0,cumulativeFacilityProduction:0,development:{levelBefore:state.farmLevel,levelAfter:state.farmLevel,started:[],completed:[],ongoing:clone(state.projects??[])},policyEffect:zeroEffect(),worldEvents:[],objectiveAchievements:[],objectiveCompleted:0};
}

function replayChronicle(state){
 const playerId=state.playerId??'lumen',commands=state.commands;
 const networkStartTurn=state.networkStartTurn??commands.length+1,policyStartTurn=state.policyStartTurn??commands.length+1;
 let replay=createGame(playerId,{networkStartTurn,policyStartTurn,objectiveStartTurn:state.objectiveStartTurn??commands.length+1,worldGoalStartTurn:state.worldGoalStartTurn??commands.length+1,conflictStartTurn:state.conflictStartTurn??commands.length+1,mediationStartTurn:state.mediationStartTurn??commands.length+1,peaceOfferStartTurn:state.peaceOfferStartTurn??commands.length+1,peaceComplianceStartTurn:state.peaceComplianceStartTurn??commands.length+1,peaceResponseStartTurn:state.peaceResponseStartTurn??commands.length+1,foreignSiteStartTurn:state.foreignSiteStartTurn??commands.length+1,jointStartTurn:state.jointStartTurn??commands.length+1,foreignStrategyStartTurn:state.foreignStrategyStartTurn??commands.length+1}),cumulativeInvestmentCost=0,cumulativeFacilityProduction=0;
 const points=[initialPoint(replay)];
 for(const command of commands){
  const before=replay,lean={...before,history:(before.history??[]).slice(-4),commands:[]},next=advanceTurn(lean,command),record=next.history.at(-1);
  const production=facilityProduction(record),investmentCost=(record.policyId==='invest'||/^site:(city|port|farm):upgrade$/.test(record.policyId)||record.policyId?.startsWith('join:'))?record.actionCost??0:0;
  cumulativeInvestmentCost+=investmentCost;cumulativeFacilityProduction+=production;
  const relationsBefore=relationsOf(before,playerId),relationsAfter=relationsOf(next,playerId),policyByCountry=new Map((record.policyRelationEffects??[]).map(item=>[item.countryId,item.effect]));
  const relationEffects=COUNTRY_IDS.filter(id=>id!==playerId).map(countryId=>({countryId,before:relationsBefore[countryId],after:relationsAfter[countryId],delta:relationsAfter[countryId]-relationsBefore[countryId],policyEffect:policyByCountry.get(countryId)??0})).filter(item=>item.delta!==0||item.policyEffect!==0);
  points.push({...(next.siteLevels?{siteLevels:clone(next.siteLevels)}:{}),turn:next.turn,actionLabel:record.actionLabel,policyId:record.policyId,eventTitle:record.eventTitle,metrics:metricsOf(next.countries[playerId]),beforeMetrics:metricsOf(before.countries[playerId]),relations:relationsAfter,relationEffects,facilityLevel:next.farmLevel,facilityProduction:production,investmentCost,cumulativeInvestmentCost,cumulativeFacilityProduction,development:developmentOf(record),...(record.siteDevelopment?{siteDevelopment:clone(record.siteDevelopment)}:{}),policyEffect:{...zeroEffect(),...(record.policyEffect??{})},worldEvents:(record.worldActions??[]).map(item=>item.text).filter(Boolean),objectiveAchievements:objectiveAchievementsOf(record),objectiveCompleted:Array.isArray(next.objectives?.completed)?next.objectives.completed.length:0});
  replay=next;
 }
 return {playerId,totalTurns:commands.length,coverage:'complete',startTurn:0,cumulativeScope:'campaign',points,projects:clone(state.projects??replay.projects)};
}

function fallbackChronicle(state){
 const playerId=state.playerId??'lumen',records=state.history??[],points=[];
 let cumulativeInvestmentCost=0,cumulativeFacilityProduction=0,objectiveCompleted=0;
 if(state.turn===0)return {playerId,totalTurns:0,coverage:'partial',startTurn:0,cumulativeScope:'available-history',points:[initialPoint(state)],projects:clone(state.projects??[])};
 for(const record of records){
  const before=record.beforeCountries?.[playerId];if(!before)continue;
  const after={...before};for(const change of record.changes??[])if(change.countryId===playerId&&METRICS.includes(change.metric))after[change.metric]=change.after;
  const production=facilityProduction(record),investmentCost=(record.policyId==='invest'||/^site:(city|port|farm):upgrade$/.test(record.policyId)||record.policyId?.startsWith('join:'))?record.actionCost??0:0;
  cumulativeInvestmentCost+=investmentCost;cumulativeFacilityProduction+=production;
  const objectiveAchievements=objectiveAchievementsOf(record);objectiveCompleted+=objectiveAchievements.length;
  const isCurrent=record.turn===state.turn,relations=isCurrent?relationsOf(state,playerId):{};
  points.push({...(isCurrent&&state.siteLevels?{siteLevels:clone(state.siteLevels)}:{}),turn:record.turn,actionLabel:record.actionLabel,policyId:record.policyId,eventTitle:record.eventTitle,metrics:metricsOf(after),beforeMetrics:metricsOf(before),relations,relationEffects:[],facilityLevel:record.development?.levelAfter??(isCurrent?state.farmLevel:null),facilityProduction:production,investmentCost,cumulativeInvestmentCost,cumulativeFacilityProduction,development:developmentOf(record),...(record.siteDevelopment?{siteDevelopment:clone(record.siteDevelopment)}:{}),policyEffect:{...zeroEffect(),...(record.policyEffect??{})},worldEvents:(record.worldActions??[]).map(item=>item.text).filter(Boolean),objectiveAchievements,objectiveCompleted});
 }
 return {playerId,totalTurns:state.turn??0,coverage:'partial',startTurn:points[0]?.turn??null,cumulativeScope:'available-history',points,projects:clone(state.projects??[])};
}

export function buildChronicle(state){
 if(!state||typeof state!=='object')throw new TypeError('게임 상태가 필요합니다.');
 const cached=cache.get(state);if(cached)return cached;
 const commands=state.commands;
 let result;
 if(Array.isArray(commands)){
  if(commands.length!==(state.turn??commands.length)||commands.some(command=>typeof command!=='string'||!command.length))throw new Error('연대기를 재생할 명령 기록이 올바르지 않습니다.');
  result=replayChronicle(state);
 }else result=fallbackChronicle(state);
 cache.set(state,result);return result;
}

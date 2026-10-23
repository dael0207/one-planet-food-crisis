import {COUNTRY_IDS,EVENTS,eventForTurn} from './country-data.mjs?v=30';
import {siteView} from './site-operations.mjs?v=30';

const RECOVERY_QUARTERS=4;
const DROUGHT_WORDS=/가뭄|비가 오지|저수지가 마르|강수량이 줄|위기의 여름/;

const climateEvent=record=>{
 const turn=Number.isSafeInteger(record?.turn)?record.turn:null;
 if(turn===null||turn<1)return null;
 const event=eventForTurn(turn-1);
 if(record.eventTitle===event.title)return event;
 return EVENTS.find(candidate=>candidate.title===record.eventTitle)??null;
};

function climateImpact(record,countryId,playerId){
 const event=climateEvent(record);
 if(!event)return null;
 if(countryId===playerId){
  const part=record.foodBreakdown?.find(item=>item?.label==='기후·수확');
  return Number.isFinite(part?.value)?part.value:null;
 }
 const regional=Number(event.regional?.[countryId]);
 if(!Number.isFinite(regional))return null;
 return (Math.round(event.foodDelta*regional)||0)+(Number(event.regionalEffects?.[countryId])||0);
}

const isDrought=(record,countryId,playerId)=>{
 const event=climateEvent(record),impact=climateImpact(record,countryId,playerId);
 return event!==null&&impact!==null&&impact<0&&DROUGHT_WORDS.test(`${event.title} ${event.description}`);
};

const severityOf=impact=>Math.abs(impact)>=8?3:Math.abs(impact)>=4?2:1;

function droughtFacts(history,countryId,playerId,currentTurn){
 const droughtIndex=history.findLastIndex(record=>isDrought(record,countryId,playerId));
 if(droughtIndex<0)return {phase:'healthy',severity:0,reason:'no-drought-observed',droughtStartTurn:null,lastDroughtTurn:null,lastDroughtImpact:null,recoveryElapsed:null};
 const last=history[droughtIndex],lastTurn=last.turn,lastImpact=climateImpact(last,countryId,playerId);
 let startIndex=droughtIndex;
 while(startIndex>0&&history[startIndex-1]?.turn===history[startIndex].turn-1&&isDrought(history[startIndex-1],countryId,playerId))startIndex-=1;
 const elapsed=Math.max(0,currentTurn-lastTurn),baseSeverity=severityOf(lastImpact);
 if(elapsed===0)return {phase:'drought',severity:baseSeverity,reason:'observed-drought',droughtStartTurn:history[startIndex].turn,lastDroughtTurn:lastTurn,lastDroughtImpact:lastImpact,recoveryElapsed:0};
 if(elapsed<RECOVERY_QUARTERS)return {phase:'recovering',severity:Math.max(1,baseSeverity-Math.floor(elapsed/2)),reason:'post-drought-recovery',droughtStartTurn:history[startIndex].turn,lastDroughtTurn:lastTurn,lastDroughtImpact:lastImpact,recoveryElapsed:elapsed};
 return {phase:'healthy',severity:0,reason:'recovered-drought',droughtStartTurn:history[startIndex].turn,lastDroughtTurn:lastTurn,lastDroughtImpact:lastImpact,recoveryElapsed:elapsed};
}

function infrastructure(state,countryId,playerId){
 const view=siteView(state,countryId,'farm');
 const nationalProject=countryId===playerId?(state.projects??[]).find(project=>(project?.type===undefined||project?.type==='facility')&&(project.countryId===undefined||project.countryId===playerId))??null:null;
 const nationalLevel=countryId===playerId?Math.max(0,Math.min(3,Math.trunc(Number(state.farmLevel)||0))):null;
 const siteLevel=Number.isFinite(view?.level)?view.level:null;
 return {
  siteLevel,
  nationalLevel,
  siteProject:view?.project??null,
  siteDueTurn:view?.dueTurn??null,
  nationalProject:nationalProject?structuredClone(nationalProject):null,
  nationalDueTurn:nationalProject?.dueTurn??null,
  stage:view?.stage??'unknown',
  irrigated:nationalLevel!==null&&nationalLevel>0,
  expanded:siteLevel!==null&&siteLevel>0,
 };
}

export function farmLandscape(state,countryId){
 if(!COUNTRY_IDS.includes(countryId))return null;
 const playerId=COUNTRY_IDS.includes(state?.playerId)?state.playerId:'lumen';
 const history=Array.isArray(state?.history)?state.history:[],turn=Number.isSafeInteger(state?.turn)?state.turn:0;
 const latest=[...history].reverse().find(record=>climateEvent(record))??null;
 return {
  countryId,
  ...droughtFacts(history,countryId,playerId,turn),
  climateTurn:latest?.turn??null,
  climateImpact:latest?climateImpact(latest,countryId,playerId):null,
  climateEvent:latest?.eventTitle??null,
  stockPressure:Number(state?.countries?.[countryId]?.food)<35,
  climateCueOnly:true,
  infrastructure:infrastructure(state,countryId,playerId),
 };
}

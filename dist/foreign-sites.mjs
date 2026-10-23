import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=31';
import {SITE_DEFS,SITE_KINDS} from './site-operations.mjs?v=31';

const emptySite=()=>({level:0,project:null,lastDecision:null});

export const foreignSitesActive=state=>Number.isSafeInteger(state?.foreignSiteStartTurn)&&state.turn>=state.foreignSiteStartTurn;

export function createForeignSites(playerId){
 return Object.fromEntries(COUNTRY_IDS.filter(id=>id!==playerId).map(id=>[id,Object.fromEntries(SITE_KINDS.map(kind=>[kind,emptySite()]))]));
}

export function foreignSiteEvent(state,{countryId,targetId=countryId,kind,operation,food=0,money=0,reason,text,playerImpact,shipmentFromId,shipmentToId}){
 const type=shipmentFromId?'trade':operation==='upgrade'?'investment':operation==='completion'?'development':operation==='passive'?'operation':'policy';
 return {source:'foreign_site',type,kind,operation,countryId,targetId,food,money,reason,turn:state.turn,text,...(shipmentFromId?{shipmentFromId,shipmentToId}:{}),...(playerImpact?{playerImpact}: {})};
}

const projectRecord=(countryId,kind,project)=>({countryId,siteKind:kind,level:project.level,startTurn:project.startTurn,dueTurn:project.dueTurn});

export function foreignSiteDevelopment(state,started=[],completed=[]){
 if(!foreignSitesActive(state)||!state.foreignSites)return null;
 const ongoing=[];
 for(const [countryId,sites] of Object.entries(state.foreignSites))for(const kind of SITE_KINDS){
  const project=sites[kind].project;if(project)ongoing.push(projectRecord(countryId,kind,project));
 }
 return {started:structuredClone(started),completed:structuredClone(completed),ongoing};
}

export function prepareForeignSites(next,actions=[]){
 if(!foreignSitesActive(next))return {started:[],completed:[]};
 next.foreignSites??=createForeignSites(next.playerId??'lumen');
 const completed=[];
 for(const countryId of COUNTRY_IDS.filter(id=>id!==(next.playerId??'lumen'))){
  const sites=next.foreignSites[countryId],country=next.countries[countryId];
  for(const kind of SITE_KINDS){
   const site=sites[kind],project=site.project;
   if(project&&project.dueTurn<=next.turn){
    site.level=Math.min(3,Math.max(site.level,project.level));site.project=null;
    const record=projectRecord(countryId,kind,project);completed.push(record);
    actions.push(foreignSiteEvent(next,{countryId,kind,operation:'completion',reason:'두 분기 건설이 끝나 현장이 가동을 시작했습니다.',text:`${COUNTRIES[countryId].name} ${SITE_DEFS[kind].name} ${site.level}단계가 완공됐습니다.`}));
   }
  }
  const totalService=sites.port.level*3,service=Math.min(totalService,Math.max(0,100-country.treasury));country.treasury+=service;
  for(const kind of SITE_KINDS){
   const level=sites[kind].level;if(!level)continue;
   const upkeep=Math.min(level,country.treasury);country.treasury-=upkeep;
   const food=kind==='farm'?level*3:0,price=kind==='city'?-level*2:0,approval=kind==='city'?level:0,income=kind==='port'?service:0;
   country.food+=food;country.price+=price;country.approval+=approval;
   actions.push(foreignSiteEvent(next,{countryId,kind,operation:'passive',food,money:income-upkeep,reason:'완공된 현장의 정기 생산과 운영비를 반영했습니다.',text:`${COUNTRIES[countryId].name} ${SITE_DEFS[kind].name} ${level}단계 정기 운영 · 식량 ${food>=0?'+':''}${food} · 국고 ${income-upkeep>=0?'+':''}${income-upkeep}억.`}));
  }
 }
 return {started:[],completed};
}

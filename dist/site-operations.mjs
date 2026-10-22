import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {tradeBlocked} from './goal-conflicts.mjs?v=29';

export const SITE_KINDS=Object.freeze(['city','port','farm']);
export const SITE_DEFS=Object.freeze({
 city:Object.freeze({name:'도시 생활권',benefit:'단계마다 분기 생활물가 −2 · 지지도 +1 · 유지비 1억',manageName:'생활 안정 운영'}),
 port:Object.freeze({name:'국제 항만',benefit:'단계마다 분기 서비스 수입 +3억 · 유지비 1억',manageName:'현물 식량 조달'}),
 farm:Object.freeze({name:'지역 농경지',benefit:'단계마다 분기 식량 +3 · 유지비 1억',manageName:'긴급 증산'}),
});

const levelsOf=state=>Object.fromEntries(SITE_KINDS.map(kind=>[kind,Math.max(0,Math.min(3,state.siteLevels?.[kind]??0))]));
const exposeLevels=state=>Object.defineProperty(state,'siteLevels',{value:levelsOf(state),writable:true,enumerable:true,configurable:true});
const isSiteProject=project=>project?.type==='site'&&SITE_KINDS.includes(project.siteKind);
const ownProject=(state,kind)=>(state.projects??[]).find(project=>isSiteProject(project)&&project.countryId===(state.playerId??'lumen')&&project.siteKind===kind)??null;
const operationFromCommand=command=>{
 const match=/^site:(city|port|farm):(upgrade|manage)$/.exec(command);
 return match?{kind:match[1],operation:match[2]}:null;
};

function siteHistory(state){
 return [...(state.history??[])].reverse().map(item=>item.siteDevelopment).find(Boolean)??null;
}

function foreignSiteHistory(state){
 return [...(state.history??[])].reverse().map(item=>item.foreignSiteDevelopment).find(Boolean)??null;
}

export function siteView(state,countryId,kind){
 if(!COUNTRY_IDS.includes(countryId)||!SITE_KINDS.includes(kind))return null;
 const playerId=state.playerId??'lumen',owned=countryId===playerId,project=owned?ownProject(state,kind):null;
 const foreignSite=owned?null:state.foreignSites?.[countryId]?.[kind]??null;
 if(!owned&&foreignSite){
  const history=foreignSiteHistory(state),foreignProject=foreignSite.project;
  const justStarted=history?.started?.some(item=>item.countryId===countryId&&item.siteKind===kind);
  const justCompleted=history?.completed?.some(item=>item.countryId===countryId&&item.siteKind===kind);
  const stage=justCompleted?'completed':justStarted?'started':foreignProject?'building':foreignSite.level>0?'operating':'idle';
  return {kind,countryId,name:SITE_DEFS[kind].name,owned:false,level:foreignSite.level,aggregateInfrastructure:state.countries?.[countryId]?.infrastructure??0,project:foreignProject?structuredClone(foreignProject):null,dueTurn:foreignProject?.dueTurn??null,remaining:foreignProject?Math.max(0,foreignProject.dueTurn-state.turn):null,stage,lastDecision:foreignSite.lastDecision?structuredClone(foreignSite.lastDecision):null};
 }
 const level=owned?levelsOf(state)[kind]:null,history=owned?siteHistory(state):null;
 const justStarted=history?.started?.some(item=>item.countryId===playerId&&item.siteKind===kind);
 const justCompleted=history?.completed?.some(item=>item.countryId===playerId&&item.siteKind===kind);
 const stage=justCompleted?'completed':justStarted?'started':project?'building':owned&&level>0?'operating':'idle';
 return {kind,countryId,name:SITE_DEFS[kind].name,owned,level,aggregateInfrastructure:state.countries?.[countryId]?.infrastructure??0,project:project?structuredClone(project):null,dueTurn:project?.dueTurn??null,remaining:project?Math.max(0,project.dueTurn-state.turn):null,stage};
}

function portSupply(state){
 const playerId=state.playerId??'lumen',executionState={...state,turn:state.turn+1},buyerRoom=Math.max(0,100-(state.countries?.[playerId]?.food??0));
 return COUNTRY_IDS.filter(id=>id!==playerId&&!tradeBlocked(executionState,id,playerId))
  .map(id=>({sellerId:id,amount:Math.min(5,buyerRoom,Math.max(0,Math.floor((state.countries?.[id]?.food??0)-20)))}))
  .filter(item=>item.amount>0)
  .sort((a,b)=>b.amount-a.amount||(state.countries[b.sellerId].food-state.countries[a.sellerId].food)||a.sellerId.localeCompare(b.sellerId))[0]??null;
}

export function siteAction(state,command){
 const parsed=operationFromCommand(command);
 if(!parsed)return null;
 const {kind,operation}=parsed,level=levelsOf(state)[kind],definition=SITE_DEFS[kind];
 if(operation==='upgrade'){
  if(level>=3||ownProject(state,kind))return null;
  const cost={farm:12+4*level,city:10+4*level,port:14+5*level}[kind];
  return {id:command,name:`${definition.name} ${level+1}단계 착공`,cost,foodCost:0,description:`두 분기 뒤 ${definition.name} ${level+1}단계가 가동됩니다.`,forecast:`국고 −${cost} · 2분기 뒤 완공 · ${definition.benefit}`,site:{kind,operation}};
 }
 if(kind==='farm')return {id:command,name:definition.manageName,cost:6,foodCost:0,description:'현재 농경지에 긴급 증산 인력을 투입합니다.',forecast:'국고 −6 · 식량 +5 · 지지도 −2',site:{kind,operation}};
 if(kind==='city')return {id:command,name:definition.manageName,cost:6,foodCost:0,description:'도시 생활비를 낮추는 단기 안정 조치를 집행합니다.',forecast:'국고 −6 · 생활물가 −12 · 지지도 +3',site:{kind,operation}};
 const supply=portSupply(state);
 if(!supply)return null;
 return {id:command,name:definition.manageName,cost:5,foodCost:0,description:`${COUNTRIES[supply.sellerId].name}에서 가용 재고를 현물 조달합니다.`,forecast:`국고 5억 선납 · 예상 식량 +${supply.amount} · 예상 대금 ${supply.amount}억${supply.amount<5?` · 미집행 ${5-supply.amount}억 환급`:' · 공급 불발 시 환급'}`,site:{kind,operation,sellerId:supply.sellerId,amount:supply.amount,payment:supply.amount}};
}

export function applySiteDecision(next,action,context={}){
 if(!action?.site)return false;
 exposeLevels(next);
 const {parts=[],actions=[]}=context,playerId=next.playerId??'lumen',player=next.countries[playerId],{kind,operation}=action.site;
 if(!SITE_KINDS.includes(kind)||!['upgrade','manage'].includes(operation))throw new Error('알 수 없는 현장 운영 명령입니다.');
 if(operation==='upgrade'){
  const level=levelsOf(next)[kind]+1;
  next.projects.push({type:'site',siteKind:kind,level,countryId:playerId,dueTurn:next.turn+2});
  actions.push({countryId:playerId,type:'development',source:'site',kind,operation,money:-action.cost,text:`${SITE_DEFS[kind].name} ${level}단계 착공 · 국고 ${action.cost}억 지출 · ${next.turn+2}분기 완공 예정.`});
  return true;
 }
 if(kind==='farm'){
  player.food+=5;player.approval-=2;parts.push({label:'농경지 긴급 증산',value:5});
  actions.push({countryId:playerId,type:'policy',source:'site',kind,operation,food:5,money:-6,approval:-2,text:'농경지 긴급 증산 · 식량 +5 · 지지도 −2 · 국고 6억 지출.'});
  return true;
 }
 if(kind==='city'){
  player.price-=12;player.approval+=3;
  actions.push({countryId:playerId,type:'policy',source:'site',kind,operation,price:-12,approval:3,money:-6,text:'도시 생활 안정 · 생활물가 −12 · 지지도 +3 · 국고 6 지출.'});
  return true;
 }
 const sellerId=action.site.sellerId,seller=next.countries[sellerId];
 const possible=seller&&!tradeBlocked(next,sellerId,playerId)?Math.min(action.site.amount,Math.max(0,100-player.food),Math.max(0,Math.floor(seller.food-20))):0;
 const payment=Math.min(action.cost,possible),refund=action.cost-payment;
 player.treasury+=refund;
 if(possible){seller.food-=possible;seller.treasury+=payment;player.food+=possible;parts.push({label:`${COUNTRIES[sellerId].name} 항만 현물 조달`,value:possible});}
 actions.push({countryId:playerId,targetId:sellerId,type:possible?'trade':'sanction',source:'site',kind,operation,food:possible,money:-payment,refund,text:possible?`${COUNTRIES[sellerId].name} 항만 현물 조달 · 식량 +${possible} · 실제 대금 ${payment}억${refund?` · 미집행 ${refund}억 환급`:''}.`:`항만 현물 조달 불발 · 실제 대금 0억 · 선납금 ${refund}억 전액 환급.`});
 return true;
}

export function completeSiteProjects(state,mature){
 const completed=(mature??[]).filter(isSiteProject);
 if(completed.length)exposeLevels(state);
 else if(state.siteLevels)state.siteLevels=levelsOf(state);
 for(const project of completed){
  if(project.countryId!==(state.playerId??'lumen'))continue;
  state.siteLevels[project.siteKind]=Math.max(state.siteLevels[project.siteKind],Math.min(3,project.level??state.siteLevels[project.siteKind]+1));
 }
 return completed;
}

export function runSiteEffects(state,context={}){
 const {parts=[],actions=[]}=context,playerId=state.playerId??'lumen',player=state.countries[playerId],levels=levelsOf(state);
 const food=levels.farm*3,price=levels.city*-2,approval=levels.city,service=levels.port*3,upkeep=levels.farm+levels.city+levels.port;
 if(food){player.food+=food;parts.push({label:`농경지 정기 생산 ${levels.farm}단계`,value:food});}
 if(price)player.price+=price;
 if(approval)player.approval+=approval;
 const treasuryBefore=player.treasury,treasuryAfter=Math.max(0,treasuryBefore+service-upkeep),money=treasuryAfter-treasuryBefore,actualUpkeep=Math.min(upkeep,treasuryBefore+service);
 player.treasury=treasuryAfter;
 if(food||price||approval||service||upkeep)actions.push({countryId:playerId,type:'operation',source:'site',kind:null,operation:'passive',food,money,price,approval,upkeep:actualUpkeep,text:`현장 정기 운영 · 식량 ${food>=0?'+':''}${food} · 생활물가 ${price>=0?'+':''}${price} · 지지도 ${approval>=0?'+':''}${approval} · 서비스 수입 +${service}억 · 실제 유지비 −${actualUpkeep}억.`});
 return {food,money,price,approval,service,upkeep:actualUpkeep};
}

import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {tradeBlocked} from './goal-conflicts.mjs?v=29';
import {foreignSiteDevelopment,foreignSiteEvent,foreignSitesActive} from './foreign-sites.mjs?v=29';
import {SITE_DEFS} from './site-operations.mjs?v=29';

const PLANS={lumen:['farm','port','city'],nord:['city','port','farm'],cera:['port','farm','city'],altia:['city','farm','port'],marin:['port','city','farm'],solis:['farm','city','port']};
const COSTS={city:level=>10+4*level,port:level=>14+5*level,farm:level=>12+4*level};
const RESERVE=20;

function decide(state,countryId,actions,started){
 const sites=state.foreignSites[countryId],country=state.countries[countryId];
 const mode=state.foreignStrategies?.[countryId]?.mode;
 const completionOrder=mode==='development'?['city','farm','port']:mode==='trade'?['port','city','farm']:['farm','city','port'];
 const newlyCompletedKind=completionOrder.find(kind=>sites[kind].level&&!sites[kind].project&&sites[kind].lastDecision?.operation==='upgrade'&&(mode||((kind!=='farm'||country.food<85)&&(kind!=='city'||country.price>70)&&(kind!=='port'||country.food<85))));
 const manageKind=newlyCompletedKind??(country.food<35&&sites.farm.level?'farm':country.price>120&&sites.city.level?'city':country.food<55&&sites.port.level?'port':null);
 if(manageKind&&country.treasury>=RESERVE+6&&manage(state,countryId,manageKind,actions))return;
 if(mode==='fiscal'&&country.food>=30)return;
 const crisisKind=country.food<35?'farm':country.price>120?'city':null;
 const preferred=mode==='food'||mode==='resilience'?['farm','port','city']:mode==='trade'?['port','city','farm']:mode==='development'?['city','farm','port']:PLANS[countryId];
 const order=[crisisKind,...preferred].filter((kind,index,list)=>kind&&list.indexOf(kind)===index);
 for(const kind of order){
  const site=sites[kind],cost=COSTS[kind](site.level);
  if(site.level>=3||site.project||country.treasury<RESERVE+cost)continue;
  country.treasury-=cost;site.project={level:site.level+1,startTurn:state.turn,dueTurn:state.turn+2};
  const reason=kind==='farm'&&country.food<35?`식량 ${country.food}의 공급 위기에 대응해 지역 농경지를 확충합니다.`:kind==='city'&&country.price>120?`생활물가 ${country.price}의 부담을 낮추기 위해 도시 생활권을 확충합니다.`:`${COUNTRIES[countryId].roleLabel} 장기 운영 우선순위로 ${SITE_DEFS[kind].name}을 선택하고 국고 ${RESERVE}억을 남겼습니다.`;
  site.lastDecision={turn:state.turn,operation:'upgrade',reason};
  const record={countryId,siteKind:kind,...site.project};started.push(record);
  actions.push(foreignSiteEvent(state,{countryId,kind,operation:'upgrade',money:-cost,reason:site.lastDecision.reason,text:`${COUNTRIES[countryId].name} ${SITE_DEFS[kind].name} ${site.project.level}단계 착공 · 국고 ${cost}억 지출 · ${site.project.dueTurn}분기 완공 예정.`}));return;
 }
}

function procurement(state,buyerId){
 const buyer=state.countries[buyerId],room=Math.max(0,100-buyer.food),budget=Math.max(0,buyer.treasury-RESERVE);
 const candidates=COUNTRY_IDS.filter(id=>id!==buyerId&&id!==state.playerId&&!tradeBlocked(state,id,buyerId))
  .map(id=>({id,amount:Math.min(5,room,budget,Math.max(0,state.countries[id].food-20),Math.max(0,100-state.countries[id].treasury))}))
  .filter(item=>item.amount>0).sort((a,b)=>b.amount-a.amount||state.countries[b.id].food-state.countries[a.id].food||a.id.localeCompare(b.id));
 return candidates[0]??null;
}

function manage(state,countryId,kind,actions){
 const site=state.foreignSites[countryId][kind],country=state.countries[countryId],commissioning=site.lastDecision?.operation==='upgrade';
 const reason=commissioning?(kind==='farm'?'새 농경지의 첫 수확을 공급 안정에 투입합니다.':kind==='city'?'새 생활권의 첫 운영을 생활 안정에 집중합니다.':'새 항만의 첫 운항으로 실제 공급선을 확보합니다.'):(kind==='farm'?'식량 위기에 긴급 증산이 필요합니다.':kind==='city'?'높은 생활물가를 낮출 필요가 있습니다.':'항만을 통해 부족한 식량을 실제 조달합니다.');
 if(kind==='port'){
  const supply=procurement(state,countryId);if(!supply)return false;
  const seller=state.countries[supply.id];seller.food-=supply.amount;seller.treasury+=supply.amount;country.food+=supply.amount;country.treasury-=supply.amount;
  site.lastDecision={turn:state.turn,operation:'manage',reason};
  actions.push(foreignSiteEvent(state,{countryId,targetId:supply.id,kind,operation:'manage',food:supply.amount,money:-supply.amount,reason,shipmentFromId:supply.id,shipmentToId:countryId,text:`${COUNTRIES[countryId].name} 항만이 ${COUNTRIES[supply.id].name}에서 식량 ${supply.amount}을 조달하고 대금 ${supply.amount}억을 지급했습니다.`}));return true;
 }
 country.treasury-=6;if(kind==='farm'){country.food+=5;country.approval-=2;}else{country.price-=12;country.approval+=3;}
 site.lastDecision={turn:state.turn,operation:'manage',reason};
 actions.push(foreignSiteEvent(state,{countryId,kind,operation:'manage',food:kind==='farm'?5:0,money:-6,reason,text:`${COUNTRIES[countryId].name} ${SITE_DEFS[kind].name} 집중 운영 · 국고 6억 지출${kind==='farm'?' · 식량 +5':' · 생활물가 −12'}.`}));return true;
}

function portExports(state,parts,actions){
 const playerId=state.playerId??'lumen',buyer=state.countries[playerId];if(buyer.food>=65||buyer.treasury<=0)return;
 for(const sellerId of COUNTRY_IDS.filter(id=>id!==playerId)){
  const level=state.foreignSites[sellerId].port.level,seller=state.countries[sellerId];if(!level||tradeBlocked(state,sellerId,playerId))continue;
  const strategy=state.foreignStrategies?.[sellerId],available=Math.min(level*2,65-buyer.food,buyer.treasury,Math.max(0,seller.food-20),Math.max(0,100-seller.treasury));if(available<=0)continue;
  const protectedReserve=['food','resilience'].includes(strategy?.mode)?35:20,amount=strategy?.posture==='contain'?0:Math.min(available,Math.max(0,seller.food-protectedReserve));
  if(amount<available){const withheldFood=available-amount,reason=strategy?.posture==='contain'?`${COUNTRIES[playerId].name}의 정책에 대응해 공개시장 선적을 보류했습니다.`:`${COUNTRIES[sellerId].name}의 ${strategy?.label??'공급'} 전략이 국내 비축을 우선했습니다.`;actions.push({...foreignSiteEvent(state,{countryId:sellerId,targetId:playerId,kind:'port',operation:'withheld',reason,text:`${COUNTRIES[sellerId].name} 항만이 가능한 공개시장 식량 ${withheldFood} 선적을 보류했습니다. 실제 이전은 없습니다.`,playerImpact:{food:0,treasury:0,text:'실제 이전 없음'}}),withheldFood});}
  if(amount<=0)continue;
  seller.food-=amount;seller.treasury+=amount;buyer.food+=amount;buyer.treasury-=amount;parts.push({label:`${COUNTRIES[sellerId].name} 외국 항만 시장 조달`,value:amount});
  actions.push(foreignSiteEvent(state,{countryId:sellerId,targetId:playerId,kind:'port',operation:'trade',food:amount,money:amount,shipmentFromId:sellerId,shipmentToId:playerId,reason:`${COUNTRIES[playerId].name}의 식량 부족과 지불 능력에 맞춘 공개시장 선적입니다.`,text:`${COUNTRIES[sellerId].name} 항만 → ${COUNTRIES[playerId].name}: 식량 ${amount} 선적 · 대금 ${amount}억 이전.`,playerImpact:{food:amount,treasury:-amount}}));
 }
}

export function runForeignSiteDecisions(state,parts=[],actions=[],development={started:[],completed:[]}){
 if(!foreignSitesActive(state)||!state.foreignSites)return null;
 for(const countryId of COUNTRY_IDS.filter(id=>id!==(state.playerId??'lumen')))decide(state,countryId,actions,development.started);
 portExports(state,parts,actions);
 return foreignSiteDevelopment(state,development.started,development.completed);
}

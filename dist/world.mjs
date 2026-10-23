import {COUNTRY_IDS,COUNTRIES} from './country-data.mjs?v=31';
import {clamp} from './world-diplomacy.mjs?v=31';
import {tradeBlocked} from './goal-conflicts.mjs?v=31';
export {initialRequest,requestAction,applyRequest,applyAgreements,updateRequests} from './world-diplomacy.mjs?v=31';

const production={lumen:23,nord:7,cera:17,altia:10,marin:10,solis:10};

export function produce(next,state,event,parts,actions=[]){
 const playerId=state.playerId??'lumen';
 for(const id of COUNTRY_IDS){
  const before=state.countries[id],country=next.countries[id];
  let climate=Math.round(event.foodDelta*event.regional[id])||0;
  if(id===playerId&&next.activePolicy==='resilience'&&climate<0)climate=Math.ceil(climate*.55);
  const response=Math.round((55-before.food)*.12)||0;
  const spoilage=0-Math.max(0,Math.round((before.food-65)*.3));
  const output=production[id]+before.infrastructure*2+response,consumption=-10;
  country.food+=output+consumption+climate+spoilage+(event.regionalEffects?.[id]??0);
  country.treasury+=Math.round((65-before.treasury)*.13)+(id==='lumen'?0:1);
  country.trust+=Math.round((65-before.trust)*.12);
  if(id===playerId)parts.push({label:'기후·수확',value:climate+(event.regionalEffects?.[id]??0)},{label:'기본 생산·수요 대응',value:output},{label:'국내 소비',value:consumption},{label:'재고 보관 손실',value:spoilage});
 }
 const lumenRestricted=playerId==='lumen'&&next.activePolicy==='embargo';
 const planned=lumenRestricted?{nord:2,marin:2,solis:2}:{nord:7,marin:3,solis:3},available=Math.max(0,next.countries.lumen.food-20),plannedTotal=Object.values(planned).reduce((sum,value)=>sum+value,0);
 let remaining=Math.min(available,plannedTotal),exportFood=0;
 for(const [id,wanted] of Object.entries(planned)){if(tradeBlocked(next,'lumen',id)){actions.push({countryId:'lumen',targetId:id,type:'sanction',source:'goal_conflict',text:'무역 제재로 루멘 → '+COUNTRIES[id].name+' 기존 공급이 이번 분기 중단됐습니다.'});continue;}const amount=Math.min(wanted,remaining);remaining-=amount;exportFood+=amount;next.countries[id].food+=amount;if(playerId===id)parts.push({label:'루멘 기존 공급 계약',value:amount});if(amount)actions.push({countryId:'lumen',targetId:id,type:'trade',source:playerId==='lumen'?'policy':'structural',text:`루멘이 기존 계약으로 ${COUNTRIES[id].name}에 식량 ${amount} 공급.`});}
 next.countries.lumen.food-=exportFood;if(playerId==='lumen')parts.push({label:lumenRestricted?'수출 제한 중 필수 인도 물량':'기존 계약 수출',value:-exportFood});
 const facilityFood=next.farmLevel*4;next.countries[playerId].food+=facilityFood;parts.push({label:`국가 생산 시설 ${next.farmLevel}단계`,value:facilityFood});
 let operatingRevenue=0;
 if(playerId==='lumen'){
  operatingRevenue=lumenRestricted?0:Math.round(3*state.marketShare);next.countries.lumen.treasury+=operatingRevenue-2;
  if(lumenRestricted){next.countries.lumen.trust-=5;next.countries.nord.trust-=7;next.countries.nord.price+=9;}
 }else next.countries[playerId].treasury-=2;
 if(playerId==='cera'){
  const restricted=next.activePolicy==='embargo',routes=restricted?{nord:1,solis:1,marin:1}:{nord:3,solis:3,marin:3},stock=Math.max(0,next.countries.cera.food-20);let left=Math.min(stock,Object.values(routes).reduce((sum,value)=>sum+value,0)),sent=0;
  for(const [id,wanted] of Object.entries(routes)){if(tradeBlocked(next,'cera',id)){actions.push({countryId:'cera',targetId:id,type:'sanction',source:'goal_conflict',text:'무역 제재로 세라 → '+COUNTRIES[id].name+' 곡물 공급이 이번 분기 중단됐습니다.'});continue;}const amount=Math.min(wanted,left);left-=amount;sent+=amount;next.countries[id].food+=amount;if(amount)actions.push({countryId:'cera',targetId:id,type:'trade',source:'policy',text:`세라가 ${COUNTRIES[id].name}에 곡물 ${amount} 공급.`});}
  next.countries.cera.food-=sent;parts.push({label:restricted?'수출 제한 중 인도 물량':'세라 곡물 수출',value:-sent});const revenue=restricted?1:3;next.countries.cera.treasury+=revenue;operatingRevenue+=revenue;
  if(restricted){next.countries.cera.trust-=5;next.countries.nord.trust-=4;}
 }
 return operatingRevenue;
}

export function runForeignActions(next,state,actions){
 const playerId=state.playerId??'lumen',snapshot=state.countries;
 const working=Object.fromEntries(COUNTRY_IDS.map(id=>[id,{food:Math.max(0,snapshot[id].food-20),treasury:snapshot[id].treasury}]));
 const trade=(sellerId,buyerId,wanted,price=1)=>{
  if(sellerId===playerId||buyerId===playerId)return;
  if(tradeBlocked(next,sellerId,buyerId)){actions.push({countryId:sellerId,targetId:buyerId,type:'sanction',source:'goal_conflict',text:'무역 제재로 '+COUNTRIES[sellerId].name+' → '+COUNTRIES[buyerId].name+' 현물 거래가 중단됐습니다.'});return;}
  const amount=Math.min(wanted,working[sellerId].food,Math.max(0,next.countries[sellerId].food-20),Math.floor(Math.min(working[buyerId].treasury,Math.max(0,next.countries[buyerId].treasury))/price));
  if(amount<=0)return;
  const seller=next.countries[sellerId],buyer=next.countries[buyerId],payment=amount*price;
  working[sellerId].food-=amount;working[buyerId].treasury-=payment;seller.food-=amount;seller.treasury+=payment;buyer.food+=amount;buyer.treasury-=payment;
  actions.push({countryId:sellerId,targetId:buyerId,type:'trade',source:'autonomous',text:`${seller.name} → ${buyer.name}: 식량 ${amount} 판매 · 대금 ${payment} 이전.`});
 };
 if(snapshot.nord.food<65||next.activePolicy==='embargo')trade('cera','nord',next.activePolicy==='embargo'?6:3);
 if(snapshot.altia.food<60)trade('marin','altia',3);
 if(snapshot.solis.food<55)trade('cera','solis',4);
 if(snapshot.marin.food<55)trade('cera','marin',3);
 if(playerId!=='lumen'&&snapshot.lumen.food>68){trade('lumen','nord',3);trade('lumen','solis',2);}
 if(snapshot.solis.food<32&&playerId!=='solis'){
  const candidates=['cera','marin'].filter(id=>id!==playerId),donorId=candidates.sort((a,b)=>snapshot[b].food-snapshot[a].food)[0];
  if(donorId){const amount=Math.min(6,working[donorId].food,Math.max(0,next.countries[donorId].food-20));if(amount>0){working[donorId].food-=amount;next.countries[donorId].food-=amount;next.countries.solis.food+=amount;next.countries.solis.trust+=3;actions.push({countryId:donorId,targetId:'solis',type:'aid',source:'autonomous',text:`${COUNTRIES[donorId].name} 측이 솔리스에 식량 ${amount} 무상 지원.`});}}
 }
 for(const id of COUNTRY_IDS.filter(id=>id!==playerId)){
  const before=snapshot[id],country=next.countries[id];
  if((state.turn+COUNTRY_IDS.indexOf(id)+1)%4===0&&before.infrastructure<3&&working[id].treasury>=12&&country.treasury>=12&&before.food<70){working[id].treasury-=12;country.treasury-=12;country.infrastructure+=1;actions.push({countryId:id,targetId:id,type:'investment',source:'autonomous',text:`${country.name} 측이 국고 12로 생산 기반을 확충했습니다. 다음 분기부터 생산 +2.`});}
  else if(before.treasury<25){country.treasury+=3;country.approval-=1;actions.push({countryId:id,targetId:id,type:'austerity',source:'autonomous',text:`${country.name} 측이 긴축 예산을 편성했습니다. 국고 +3 · 지지도 −1.`});}
 }
}

export function finalizeCountries(next){
 for(const country of Object.values(next.countries)){
  country.food=clamp(country.food);const targetPrice=100+(55-country.food)*1.2;country.price=clamp(country.price+(targetPrice-country.price)*.3,50,220);
  const targetApproval=70+(country.food-55)*.2-(country.price-100)*.3;country.approval=clamp(country.approval+(targetApproval-country.approval)*.2);
  country.treasury=clamp(country.treasury);country.trust=clamp(country.trust);
 }
}

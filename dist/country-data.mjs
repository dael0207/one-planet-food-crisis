export const COUNTRY_IDS = ['lumen', 'nord', 'cera', 'altia', 'marin', 'solis'];
export const COUNTRIES = {
 lumen: {id:'lumen',name:'루멘',role:'agriculture',roleLabel:'농업국',description:'곡물과 관개 기술로 세계의 식탁을 지키는 농업국',color:'#b5c97e'},
 nord: {id:'nord',name:'노르드',role:'importindustry',roleLabel:'산업 수입국',description:'산업은 강하지만 식량 수입에 의존하는 북부 국가',color:'#b6c6ca'},
 cera: {id:'cera',name:'세라',role:'exportgrain',roleLabel:'곡물 수출국',description:'넓은 곡창에서 곡물을 수출하는 생산국',color:'#d4a780'},
 altia: {id:'altia',name:'알티아',role:'technology',roleLabel:'기술국',description:'농업 기술과 관개 설비를 개발하는 고원 국가',color:'#b9b2cf'},
 marin: {id:'marin',name:'마린',role:'maritimetrade',roleLabel:'해상 무역국',description:'항구와 선박으로 식량을 운송하는 해상 무역국',color:'#83b9b0'},
 solis: {id:'solis',name:'솔리스',role:'climatevulnerable',roleLabel:'기후 취약국',description:'기후 충격과 수입 물가에 취약한 남부 국가',color:'#d9c17f'},
};
export const COUNTRY_DEFS=COUNTRIES;
const initial={lumen:[68,62,64,100,70],nord:[51,72,61,112,66],cera:[73,48,64,96,60],altia:[59,76,68,104,72],marin:[63,66,65,102,68],solis:[42,35,52,126,62]};
export const initialCountries=()=>Object.fromEntries(COUNTRY_IDS.map(id=>{const [food,treasury,approval,price,trust]=initial[id];return[id,{...COUNTRIES[id],food,treasury,approval,price,trust,infrastructure:0}];}));
export const EVENTS=[
 {title:'비가 오지 않는 봄',description:'루멘의 강수량이 줄었습니다. 여섯 나라는 첫 수확을 지켜봅니다.',foodDelta:-8},
 {title:'가뭄 경보',description:'저수지가 마르며 세계의 곡물 가격이 흔들립니다.',foodDelta:-12},
 {title:'위기의 여름',description:'루멘의 수확량이 감소했습니다. 수입국들이 공급을 확인합니다.',foodDelta:-10},
 {title:'항구의 긴 줄',description:'다음 수확 전까지 식량을 확보하려는 배들이 모입니다.',foodDelta:-5},
 {title:'첫 빗방울',description:'비가 돌아왔지만 새 곡물이 나오려면 시간이 필요합니다.',foodDelta:0},
 {title:'회복의 수확',description:'곡물이 돌아오고 외국은 장기 공급 계약을 검토합니다.',foodDelta:8},
 {title:'새로운 무역 질서',description:'공급처가 분산되면서 거래 상대와 외교 관계가 변합니다.',foodDelta:5},
 {title:'짧은 한파',description:'계절 밖 추위가 작물과 운송에 충격을 줍니다.',foodDelta:-3},
 {title:'풍요로운 가을',description:'늘어난 수확이 생활에 닿을 수 있도록 관리해야 합니다.',foodDelta:8},
 {title:'위기 이후의 첫 계절',description:'첫 위기가 지나도 세계의 운영과 외교는 계속됩니다.',foodDelta:6},
];
const seasons=[
 {title:'봄비와 파종',description:'봄비가 농지를 적십니다. 새해의 공급 계획이 시작됩니다.',foodDelta:2},
 {title:'더운 여름',description:'솔리스의 열파와 높아진 냉방 수요가 교역에 영향을 줍니다.',foodDelta:-5},
 {title:'가을 수확',description:'루멘과 세라의 수확기가 돌아왔습니다.',foodDelta:6},
 {title:'겨울 운송',description:'겨울의 소비와 항구 운송 부담을 관리해야 합니다.',foodDelta:-2},
];
export function eventForTurn(turn){
 if(turn<EVENTS.length)return {...EVENTS[turn],regional:{lumen:1,nord:.3,cera:.25,altia:.2,marin:.15,solis:.65}};
 const season=seasons[turn%4],cycle=Math.floor((turn-10)/4),variation=[0,-2,1,2,-1][cycle%5];
 const crisis=(turn-10)%6===5,affected=COUNTRY_IDS[1+Math.floor((turn-10)/6)%5];
 const regionalEffects=crisis?{[affected]:affected==='cera'?-50:-42}:{};
 return {...season,title:crisis?`${COUNTRIES[affected].name}의 ${affected==='marin'?'항구 태풍':'작황 위기'}`:`${season.title} · ${cycle+1}번째 순환`,description:crisis?`${COUNTRIES[affected].name}의 지역 재해가 비축 식량을 훼손했습니다. 주변국의 교역과 지원이 필요합니다.`:season.description,foodDelta:season.foodDelta+variation,regionalEffects,regional:{lumen:1,nord:.3,cera:.4,altia:.2,marin:.15,solis:turn%4===1?1.6:.7}};
}

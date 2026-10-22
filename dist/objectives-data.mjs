import {COUNTRY_IDS} from './country-data.mjs?v=29';
import {PROFILES} from './nation-profiles.mjs?v=29';

const policy=(country,stage,name,tag,cost,description,forecast,goalEffects)=>({
 id:`mandate_${country}_${stage}`,name,tag,cost,foodCost:0,description,forecast,goalEffects,
});

export const OBJECTIVE_POLICIES={
 lumen:[
  policy('lumen',1,'스마트 관개 순환','생산 안정',8,'관개 시간을 조정해 같은 물로 더 많은 작물을 지킵니다.','국고 −8 · 식량 +6 · 물가 −4 · 신뢰 +2 · 지지도 +1',{food:6,price:-4,trust:2,approval:1}),
  policy('lumen',2,'수확 손실 방지단','손실 감축',13,'공동 수확단과 건조 시설로 국내 수확 손실을 줄입니다.','국고 −13 · 식량 +8 · 물가 −3 · 신뢰 +3 · 지지도 +2',{food:8,price:-3,trust:3,approval:2}),
 ],
 nord:[
  policy('nord',1,'산업 급식 계약','생활 안정',9,'산업단지 공동 급식 계약으로 유통 손실과 가계 부담을 낮춥니다.','국고 −9 · 식량 +5 · 물가 −7 · 신뢰 +1 · 지지도 +3',{food:5,price:-7,trust:1,approval:3}),
  policy('nord',2,'북부 저장 회전제','비축 운영',14,'저장고 재고를 정기적으로 교체해 폐기 손실과 가격 급등을 막습니다.','국고 −14 · 식량 +7 · 물가 −8 · 신뢰 +2 · 지지도 +2',{food:7,price:-8,trust:2,approval:2}),
 ],
 cera:[
  policy('cera',1,'국내 완충 비축','시장 완충',6,'국내 출하분을 따로 확보해 풍작 뒤의 가격과 식탁을 함께 지킵니다.','국고 −6 · 식량 +4 · 물가 −5 · 신뢰 +2 · 지지도 +3',{food:4,price:-5,trust:2,approval:3}),
  policy('cera',2,'곡물 품질 회수망','품질 관리',12,'저장·운송 중 손상된 곡물을 빠르게 회수해 국내 손실을 줄입니다.','국고 −12 · 식량 +6 · 물가 −4 · 신뢰 +4 · 지지도 +1',{food:6,price:-4,trust:4,approval:1}),
 ],
 altia:[
  policy('altia',1,'정밀 재배 보급','기술 보급',11,'센서와 재배 지침을 국내 농가에 보급해 생산 오차를 줄입니다.','국고 −11 · 식량 +7 · 물가 −2 · 신뢰 +3 · 지지도 +2',{food:7,price:-2,trust:3,approval:2}),
  policy('altia',2,'종자 회수 연구','연구 순환',16,'사용 종자를 회수·분석해 다음 작기의 국내 손실을 낮춥니다.','국고 −16 · 식량 +9 · 물가 −3 · 신뢰 +4 · 지지도 +2',{food:9,price:-3,trust:4,approval:2}),
 ],
 marin:[
  policy('marin',1,'항만 냉장 회랑','항만 안정',10,'항만 안에 냉장 이동선을 마련해 하역 중 식량 손실을 줄입니다.','국고 −10 · 식량 +5 · 물가 −6 · 신뢰 +3 · 지지도 +2',{food:5,price:-6,trust:3,approval:2}),
  policy('marin',2,'선박 손실 감축제','운송 효율',15,'선박 적재와 검수 절차를 고쳐 국내 반입분의 손실을 막습니다.','국고 −15 · 식량 +8 · 물가 −5 · 신뢰 +2 · 지지도 +4',{food:8,price:-5,trust:2,approval:4}),
 ],
 solis:[
  policy('solis',1,'그늘 급식망','폭염 대응',7,'그늘 보관소와 공동 급식소로 폭염 속 폐기와 가계 부담을 줄입니다.','국고 −7 · 식량 +4 · 물가 −4 · 신뢰 +1 · 지지도 +5',{food:4,price:-4,trust:1,approval:5}),
  policy('solis',2,'내건성 순환 농법','기후 회복',13,'내건성 작물과 토양 순환으로 국내 생산 손실을 억제합니다.','국고 −13 · 식량 +9 · 물가 −2 · 신뢰 +3 · 지지도 +3',{food:9,price:-2,trust:3,approval:3}),
 ],
};

const count=(label,keys,target)=>({kind:'count',label,keys,target});
const metric=(label,key,target)=>({kind:'metric',label,key,target});
const stable=(label,target=2)=>({kind:'stable',label,target});
const stage=(title,requirements,unlockId=null)=>({title,requirements,unlockId});
const health={lumen:[55,115],nord:[50,120],cera:[55,115],altia:[50,120],marin:[50,120],solis:[40,135]};
const starts={
 lumen:[count('교역 신뢰 강화 실행',['balanced'],1),metric('관개 시설 단계','farmLevel',1)],
 nord:[count('수입선 확보·비축 방출 실행',['secure_imports','strategic_reserve'],2),metric('식량','food',50)],
 cera:[count('수출 확대 실행',['export_push'],2),metric('국고','treasury',65),metric('식량','food',40)],
 altia:[count('고수확 종자 연구 실행',['research'],2),metric('농업 연구소 단계','farmLevel',1)],
 marin:[count('대체 항로 개설 실행',['expand_routes'],1),count('긴급 선박 수입 실행',['emergency_import'],1),metric('식량','food',50)],
 solis:[count('가뭄 회복 사업 실행',['resilience'],1),metric('기후 회복 농장 단계','farmLevel',1),metric('식량','food',40)],
};
const finishes={
 lumen:[count('수확 손실 방지단 실행',['mandate_lumen_2'],1),metric('관개 시설 단계','farmLevel',2)],
 nord:[count('북부 저장 회전제 실행',['mandate_nord_2'],1),count('협정 이행',['fulfilledTreaties'],4)],
 cera:[count('곡물 품질 회수망 실행',['mandate_cera_2'],1),metric('식량','food',55),metric('국고','treasury',90)],
 altia:[count('종자 회수 연구 실행',['mandate_altia_2'],1),metric('농업 연구소 단계','farmLevel',2)],
 marin:[count('선박 손실 감축제 실행',['mandate_marin_2'],1),count('협정 이행',['fulfilledTreaties'],4)],
 solis:[count('내건성 순환 농법 실행',['mandate_solis_2'],1),metric('기후 회복 농장 단계','farmLevel',2)],
};
const copy={
 lumen:{title:'세계의 식량 안전망',stages:['물길과 수출 신뢰 복원','가뭄에도 흔들리지 않는 곡창','다음 수확을 지키는 관개망'],briefingTitle:'공동 수확단을 세울 기회',briefingDescription:'새 정책 ‘수확 손실 방지단’이 열렸습니다. 공동 수확단을 상설화할 수 있으며, 이 정책은 브리핑 뒤에도 국내 정책에서 계속 선택할 수 있습니다.'},
 nord:{title:'수입에 흔들리지 않는 식탁',stages:['수입선과 비축 체계 확보','가격 급등 없는 북부 식탁','약속으로 완성한 공급망'],briefingTitle:'북부 저장고를 순환시킬 기회',briefingDescription:'새 정책 ‘북부 저장 회전제’가 열렸습니다. 비축 폐기를 줄일 수 있으며, 이 정책은 브리핑 뒤에도 국내 정책에서 계속 선택할 수 있습니다.'},
 cera:{title:'수출 수익을 국민의 식탁으로',stages:['수출과 국내 비축의 균형','풍작이 생활 안정으로 이어지는 계절','국민의 식탁을 지키는 곡창'],briefingTitle:'곡물 품질 회수망을 이을 기회',briefingDescription:'새 정책 ‘곡물 품질 회수망’이 열렸습니다. 손상 곡물을 국내 공급으로 되돌릴 수 있으며, 이 정책은 브리핑 뒤에도 국내 정책에서 계속 선택할 수 있습니다.'},
 altia:{title:'연구실에서 모든 농지로',stages:['연구 성과를 농지로','기술이 만드는 안정된 수확','모든 농지에 닿는 연구망'],briefingTitle:'종자를 다시 연구실로 이을 기회',briefingDescription:'새 정책 ‘종자 회수 연구’가 열렸습니다. 현장의 종자를 다음 연구로 연결할 수 있으며, 이 정책은 브리핑 뒤에도 국내 정책에서 계속 선택할 수 있습니다.'},
 marin:{title:'끊기지 않는 바닷길',stages:['대체 항로와 긴급 선박 확보','파도에도 안정적인 항만','협정으로 이어진 바닷길'],briefingTitle:'선박 손실을 줄일 기회',briefingDescription:'새 정책 ‘선박 손실 감축제’가 열렸습니다. 국내 반입분의 운송 손실을 줄일 수 있으며, 이 정책은 브리핑 뒤에도 국내 정책에서 계속 선택할 수 있습니다.'},
 solis:{title:'다음 가뭄을 견디는 나라',stages:['회복 농장의 첫 물길','폭염에도 지켜지는 식탁','다음 가뭄을 견디는 농업'],briefingTitle:'내건성 농법을 넓힐 기회',briefingDescription:'새 정책 ‘내건성 순환 농법’이 열렸습니다. 토양과 작물의 회복력을 높일 수 있으며, 이 정책은 브리핑 뒤에도 국내 정책에서 계속 선택할 수 있습니다.'},
};

export const OBJECTIVE_PLANS=Object.fromEntries(COUNTRY_IDS.map(id=>{
 const [food,price]=health[id],first=OBJECTIVE_POLICIES[id][0],words=copy[id];
 return [id,{id,title:words.title,profile:PROFILES[id].challenge,health:{food,price},briefingTitle:words.briefingTitle,briefingDescription:words.briefingDescription,stages:[
  stage(words.stages[0],starts[id],first.id),
  stage(words.stages[1],[
   count(`${first.name} 실행`,[first.id],2),stable(`식량 ${food} 이상·물가 ${price} 이하 연속 분기`,2),
  ],OBJECTIVE_POLICIES[id][1].id),
  stage(words.stages[2],finishes[id]),
 ]}];
}));

const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))deepFreeze(item);}return value;};
deepFreeze(OBJECTIVE_POLICIES);deepFreeze(OBJECTIVE_PLANS);

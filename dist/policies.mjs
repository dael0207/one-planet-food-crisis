import {PROFILES} from './nation-profiles.mjs?v=31';

const shared=[
 {id:'subsidy',name:'생활비 보조금',tag:'즉시 지원',cost:12,description:'가계의 식료품 구매 부담을 덜어줍니다.',forecast:'국고 −12 · 물가 부담 감소 · 지지도 상승'},
 {id:'maintain',name:'기존 정책 유지',tag:'경과 관찰',cost:0,description:'추가 정책 지출 없이 세계의 다음 분기를 지켜봅니다.',forecast:'추가 정책 비용 없음 · 기존 정책·협약 유지 · 외국도 스스로 행동'},
];
const exclusive={
 lumen:[
  {id:'balanced',name:'교역 신뢰 강화',tag:'신뢰 투자',cost:4,description:'기존 수출 약속을 지키며 교역 상대와의 신뢰를 강화합니다.',forecast:'국고 −4 · 외교 신뢰 +4 · 루멘–노르드 관계 +6 · 기존 수출 유지'},
  {id:'embargo',name:'식량 수출 제한',tag:'국내 우선',cost:0,description:'필수 인도분만 수출하고 국내 재고를 지킵니다.',forecast:'수출 7 감소 · 신뢰 하락'},
  {id:'reopen',name:'수출 제한 해제',tag:'교역 재개',cost:0,description:'기존 거래처에 식량 공급을 재개합니다.',forecast:'공급 재개 · 시장 점유율 회복'},
  {id:'aid',name:'노르드 식량 지원',tag:'국제 협력',cost:9,foodCost:7,description:'노르드에 비축 식량과 지원금을 보냅니다.',forecast:'국고 −9 · 식량 −7 · 신뢰 회복'},
 ],
 nord:[
  {id:'secure_imports',name:'장기 수입선 확보',tag:'공급 안정',cost:10,description:'해상 운송과 곡물 구매 계약을 선결제합니다.',forecast:'국고 최대 −10 · 식량 최대 +8 · 미공급분 환불'},
  {id:'strategic_reserve',name:'전략 비축 방출',tag:'비상 대응',cost:4,description:'정부 비축분을 시장에 풀어 급등한 가격을 낮춥니다.',forecast:'국고 −4 · 식량 +4 · 물가 크게 하락'},
 ],
 cera:[
  {id:'export_push',name:'수출 확대',tag:'수익 우선',cost:2,foodCost:8,description:'추가 선적을 편성해 외화를 확보합니다.',forecast:'식량 −8 · 국고 +12 · 해외 신뢰 상승'},
  {id:'embargo',name:'곡물 수출 제한',tag:'국내 우선',cost:0,description:'추가 수출을 멈추고 국내 창고를 채웁니다.',forecast:'필수 인도만 유지 · 국내 재고 보호 · 신뢰 하락'},
  {id:'reopen',name:'곡물 수출 재개',tag:'교역 재개',cost:0,description:'세계 시장으로 곡물 선적을 다시 시작합니다.',forecast:'수출 수입과 해외 신뢰 회복'},
 ],
 altia:[
  {id:'research',name:'고수확 종자 연구',tag:'연구 투자',cost:15,description:'한 분기 집중 연구로 생산 기술을 개선합니다.',forecast:'국고 −15 · 이번 분기 식량 +5 · 신뢰 상승'},
  {id:'license',name:'기술 사용권 수출',tag:'기술 외교',cost:3,description:'외국에 농업 기술 사용권을 제공해 수익을 얻습니다.',forecast:'국고 순증 +9 · 해외 신뢰 상승'},
 ],
 marin:[
  {id:'expand_routes',name:'대체 항로 개설',tag:'물류 확장',cost:11,description:'혼잡한 항구를 우회하는 새 항로를 엽니다.',forecast:'국고 최대 −11 · 식량 최대 +6 · 미공급분 환불'},
  {id:'emergency_import',name:'긴급 선박 수입',tag:'비상 조달',cost:9,description:'즉시 사용할 곡물을 선박으로 조달합니다.',forecast:'국고 최대 −9 · 식량 최대 +9 · 미공급분 환불'},
 ],
 solis:[
  {id:'ration',name:'긴급 배급제',tag:'생존 우선',cost:3,description:'남은 식량을 공공 배급망으로 돌립니다.',forecast:'국고 −3 · 식량 손실 억제 · 지지도 상승'},
  {id:'resilience',name:'가뭄 회복 사업',tag:'기후 대응',cost:10,description:'토양 복원과 소형 저수지에 투자합니다.',forecast:'국고 −10 · 식량 +5 · 이후 계절 기후 충격 완화'},
 ],
};

export function getPolicies(state){
 const id=state?.playerId??'lumen',profile=PROFILES[id];
 if(!profile)return [];
 const invest={id:'invest',name:`${profile.facilityName} 투자`,tag:'장기 투자',cost:profile.investmentCost,description:`두 분기 뒤 완공되는 ${profile.facilityName}을 건설합니다.`,forecast:'두 분기 뒤 생산 +4 · 최대 세 단계'};
 return [...exclusive[id],shared[0],invest,shared[1]];
}
export const LUMEN_POLICIES=getPolicies({playerId:'lumen'});

import {cabinetTerms} from './cabinet-ui.mjs?v=30';
export function policyTradeoffs(state, action) {
  if(action.source==='cabinet')return cabinetTerms(state,action);
  const cost = `국고 ${action.cost}억`;
  if(action.goalEffects){
    const labels={food:'식량',price:'물가',trust:'신뢰',approval:'지지도'};
    const gain=Object.entries(action.goalEffects).filter(([,value])=>value).map(([key,value])=>`${labels[key]} ${value>0?'+':''}${value}`).join(' · ');
    return {gain,sacrifice:`${cost} · 이번 분기 효과 · 시설 증설 없음`};
  }
  const entries = {
    balanced: action.cost ? ['신뢰 최대 +4 · 노르드 관계 최대 +6', `${cost} · 기존 식량 수출은 계속`] : ['기존 교역 유지 · 신뢰 소폭 개선', '국내 식량은 기존대로 수출'],
    embargo: ['국내 식량 보호 · 계획 수출 축소', '수출 수익·신뢰 감소 · 제한 지속'],
    maintain: ['추가 정책 비용 없이 예산 보존', state.activePolicy === 'embargo' ? '수출 제한·대외 비용도 계속' : '기존 소비·교역 계속 · 새 공급 보강 없음'],
    invest: ['완공 뒤 기본 생산 +4 / 분기', `${cost} · 착공 뒤 2분기 대기`],
    subsidy: ['이번 분기 물가 부담 완화 · 지지도 상승', `${cost} · 생산 증설 없음`],
    reopen: ['정상 수출 재개 · 수출 수입 회복', '국내 식량을 더 수출 · 시장 회복에 시차'],
    aid: ['노르드 식량 지원 · 양국 관계 개선', `식량 ${action.foodCost} · ${cost} 제공`],
    secure_imports: ['식량 최대 +8 · 물가 부담 완화', `${cost} 한도 · 공급 부족 시 축소`],
    strategic_reserve: ['식량 +4 · 물가 급등 완화', `${cost} · 생산 증설 없음`],
    export_push: ['국고 순증 최대 +12 · 해외 신뢰 상승', '추가 식량 8 수출 · 국내 비축 감소'],
    research: ['이번 분기 식량 +5 · 신뢰 개선', `${cost} · 시설 증설 없음`],
    license: ['국고 순증 최대 +9 · 기술 교류', `${cost} 선지출 · 수입은 변동`],
    expand_routes: ['식량 최대 +6 · 물가 부담 완화', `${cost} 한도 · 공급 상황 영향`],
    emergency_import: ['이번 분기 식량 최대 +9', `${cost} 한도 · 생산 증설 없음`],
    ration: ['이번 분기 식량 손실 완화 · 물가 하락', `${cost} · 다음 분기 재결정`],
    resilience: ['식량 +5 · 이후 계절 기후 피해 완화', `${cost} · 기후 피해 일부는 남음`],
  };
  const [gain, sacrifice] = entries[action.id] ?? [action.description, action.cost ? cost : '별도 정책 지출 없음'];
  return { gain, sacrifice };
}

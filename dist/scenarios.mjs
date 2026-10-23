import {nationalProjects,siteProjects} from './project-state.mjs?v=30';
import { PROFILES, getPolicies, getAction, eventForTurn, COUNTRIES, currentAgenda } from './engine.mjs?v=30';

import {getObjectiveView} from './objectives.mjs?v=30';

const seasons = ['봄', '여름', '가을', '겨울'];
const NATIONAL_CHOICES = {
  lumen: ['embargo', 'balanced', 'aid', 'reopen'],
  nord: ['secure_imports', 'strategic_reserve'],
  cera: ['export_push', 'embargo', 'reopen'],
  altia: ['research', 'license'],
  marin: ['expand_routes', 'emergency_import'],
  solis: ['ration', 'resilience'],
};
const FOOD_RELIEF = {
  lumen: 'embargo',
  nord: 'strategic_reserve',
  cera: 'embargo',
  altia: 'research',
  marin: 'emergency_import',
  solis: 'ration',
};
const NATIONAL_COPY = {
  lumen: { pressure: ['수출 곡물과 국내 식탁 사이의 긴장이 커집니다', '관개와 비축으로 다음 수확을 준비합니다', '곡물 외교가 주변국의 선택을 바꾸고 있습니다', '겨울 비축량과 수출 약속을 함께 점검합니다'], lowFood: '수출국의 창고가 빠르게 비고 있습니다', highPrice: '곡물은 있어도 시민이 체감하는 식비가 높습니다' },
  nord: { pressure: ['새해 수입 계약과 항만 재고를 정해야 합니다', '산업 도시의 식탁을 지킬 공급선이 필요합니다', '전략 비축고를 채울 적기인지 판단해야 합니다', '겨울 물류비와 수입 의존도를 점검합니다'], lowFood: '산업국의 수입 식량 재고가 위험선에 닿았습니다', highPrice: '수입 가격 상승이 산업 도시의 가계를 압박합니다' },
  cera: { pressure: ['곡창의 파종량과 수출 계약을 함께 정합니다', '수출 확대와 토양 회복의 균형이 필요합니다', '풍작의 이익을 어디에 먼저 돌릴지 결정합니다', '겨울 전에 곡물 계약과 비축을 조정합니다'], lowFood: '수출 확대 뒤 자국 비축량이 빠듯해졌습니다', highPrice: '곡창의 풍요가 국내 식탁 가격으로 이어지지 않습니다' },
  altia: { pressure: ['새 농업 기술의 연구 예산을 배분합니다', '시험 설비를 현장에 적용할 시점을 고릅니다', '기술 특허의 수익과 국제 보급을 조율합니다', '다음 연구 주기와 설비 유지비를 검토합니다'], lowFood: '기술 강국도 먹거리는 연구실에서 만들 수 없습니다', highPrice: '높은 기술력과 달리 시민의 식비 부담이 커졌습니다' },
  marin: { pressure: ['항로와 선박을 어느 교역에 배치할지 정합니다', '태풍철을 앞두고 항만 운송망을 재편합니다', '수확기 물동량을 처리할 새 항로가 필요합니다', '겨울 바다의 운송 위험과 수익을 저울질합니다'], lowFood: '항구는 붐비지만 국내 식량 재고는 부족합니다', highPrice: '운송 수익이 시민의 장바구니 물가를 낮추지 못합니다' },
  solis: { pressure: ['건기 배급과 기후 대비 예산을 정합니다', '폭염 속에서 취약 가구와 농지를 지켜야 합니다', '짧은 수확을 비축과 복원에 나눌 때입니다', '다음 건기를 견딜 식량과 시설을 점검합니다'], lowFood: '기후 충격으로 식량 비축이 가장 먼저 흔들립니다', highPrice: '수입 물가가 취약 가구의 식탁을 위협합니다' },
};

function option(state, id, label = null) {
  const action = getAction(state, id);
  if (!action) return null;
  const forecast = action.description === action.forecast ? '' : ` ${action.forecast}`;
  const resource = action.foodCost ? ` · 식량 ${action.foodCost}` : '';
  return { id, label: label ?? action.name, detail: `${action.description}${forecast} · 국고 비용 ${action.cost}${resource}` };
}

export function getDomesticOrders(state) {
  return [...new Set(getPolicies(state).map((action) => action.id))]
    .filter(id=>id!=='reopen'||state.activePolicy==='embargo')
    .filter(id=>id!=='embargo'||state.activePolicy!=='embargo')
    .map((id) => option(state, id))
    .filter(Boolean);
}

function uniqueValidOptions(state, preferred) {
  const available = getDomesticOrders(state).map((action) => action.id);
  const chosen = [];
  for (const id of [...preferred, ...available, 'maintain']) {
    if (chosen.includes(id) || !available.includes(id)) continue;
    chosen.push(id);
    if (chosen.length === 3) break;
  }
  if (!chosen.includes('maintain') && getAction(state, 'maintain')) chosen[chosen.length - 1] = 'maintain';
  const result = [...new Set(chosen)].map((id) => option(state, id)).filter(Boolean);
  if (result.length !== 3) throw new Error(`플레이 가능한 정책 세 가지를 만들 수 없습니다: ${state.playerId}`);
  return result;
}

function domesticScenario(state) {
  const playerId = state.playerId;
  const profile = PROFILES[playerId];
  const player = state.countries[playerId];
  const previous = state.history.at(-1)?.policyId;
  const nationals = NATIONAL_CHOICES[playerId];
  const facility = `${profile.facilityName} ${state.farmLevel}단계`;

  if (player.food < 38) {
    const restricted=state.activePolicy==='embargo';
    const followup=currentAgenda(state)?.options.find(action=>action.cost<=player.treasury&&action.foodCost<=player.food)?.id??'subsidy';
    return { title: NATIONAL_COPY[playerId].lowFood, description: restricted?'수출 제한이 이미 시행 중입니다. 비축을 지키면서 다음 공급을 보강할지 검토하세요.':`${profile.tagline}. 즉시 공급 대응과 다음 분기를 위한 조치의 비용을 비교하세요.`, options: uniqueValidOptions(state, restricted?['maintain',followup,'invest']:[FOOD_RELIEF[playerId], followup, 'maintain']) };
  }
  if (player.price > 135) {
    return { title: NATIONAL_COPY[playerId].highPrice, description: `${profile.tagline}. 시민이 체감하는 식비를 낮추는 조치를 먼저 검토하고, 국가별 공급 대응이나 기존 정책 유지도 선택할 수 있습니다.`, options: uniqueValidOptions(state, ['subsidy', FOOD_RELIEF[playerId], 'maintain']) };
  }
  if (state.turn === 0) {
    return { title: profile.openingTitle, description: profile.openingDescription, options: uniqueValidOptions(state, [...nationals.slice(0, 2), 'maintain']) };
  }
  const agenda=currentAgenda(state);
  if(agenda)return {title:agenda.title,description:agenda.origin,agenda:{family:agenda.family,title:agenda.title,origin:agenda.origin},options:uniqueValidOptions(state,[...agenda.options.map(action=>action.id),'maintain'])};
  if (state.activePolicy === 'embargo' && getAction(state, 'reopen')) {
    return { title: '수출 제한을 이어갈까요, 교역을 다시 열까요', description: '국내 비축은 보호받고 있지만 수출 수익이 줄고 있습니다. 거래처는 다른 공급국을 찾는 중입니다.', options: uniqueValidOptions(state, ['reopen', 'subsidy', 'maintain']) };
  }
  const nationalProject=nationalProjects(state)[0],localProjects=siteProjects(state);
  if (nationalProject) {
    const remaining = Math.max(1, nationalProject.dueTurn - state.turn);
    return { title: `${profile.facilityName} 완공 전, 이번 분기의 부담을 관리합니다`, description: `공사는 ${remaining}분기 뒤 완공됩니다. 생산이 늘기 전까지 생활비 부담과 식량 공급을 관리해야 합니다.`, options: uniqueValidOptions(state, ['subsidy', nationals[0], 'maintain']) };
  }
  if(localProjects.length)return {title:`지도 시설 ${localProjects.length}곳의 공사를 진행합니다`,description:`현장 시설은 국가 사업과 별도로 완공됩니다. 완공까지 ${Math.min(...localProjects.map(project=>project.dueTurn-state.turn))}분기 남았습니다.`,options:uniqueValidOptions(state,['subsidy',nationals[0],'maintain'])};
  if (previous?.startsWith('accept:') || previous?.startsWith('counter:') || previous?.startsWith('decline:')) {
    return { title: '외교 회신 뒤, 국내에 남은 여력을 확인합니다', description: `협상 결과가 재정과 공급망에 반영됐습니다. 이제 ${profile.challenge}에 남은 예산을 배분할 차례입니다.`, options: uniqueValidOptions(state, [player.food < 45 ? nationals[1] : 'subsidy', 'invest', 'maintain']) };
  }
  if (previous && nationals.includes(previous)) {
    return { title: `${state.history.at(-1)?.actionLabel ?? getAction(state, previous)?.name}의 후속 효과를 점검합니다`, description: `지난 선택이 물가와 주변국 행동에 이어집니다. 현재 ${facility}입니다. 새 대응에 투자할지, 기존 정책을 이어갈지 정하세요.`, options: uniqueValidOptions(state, [nationals.find((id) => id !== previous), 'subsidy', 'maintain']) };
  }
  const copy = NATIONAL_COPY[playerId];
  const title = copy.pressure[state.turn % 4];
  const seasonalNational = state.turn % 2 === 0 ? nationals[0] : nationals[1];
  const shared = state.farmLevel < 3 ? 'invest' : 'subsidy';
  return { title, description: `${profile.tagline}. ${facility}로 다음 계절을 준비합니다. 국내에 투자하거나 지금의 대응을 이어갈 수 있습니다.`, options: uniqueValidOptions(state, [seasonalNational, player.price > 135 ? 'subsidy' : shared, 'maintain']) };
}

export function getScenario(state, requestId = null) {
  const event = eventForTurn(state.turn);
  const date = `${2031 + Math.floor(state.turn / 4)}년 ${seasons[state.turn % 4]}`;
  const request = requestId === null ? null : state.requests.find((item) => item.id === requestId && item.fromId !== state.playerId && item.status === 'pending' && item.expiresTurn > state.turn && COUNTRIES[item.fromId]);
  if(request&&request.type==='trade'&&!getAction(state,`accept:${request.id}`))return {
    id:`blocked-${request.id}`,title:'제재로 공급 협상이 보류됐습니다',
    description:`${COUNTRIES[request.fromId].name}와의 식량 무역은 현재 제재로 중단되어 수락할 수 없습니다. 회신 기한은 계속 흐릅니다.`,
    context:`응답 기한까지 ${request.expiresTurn-state.turn}분기 · 제재 종료 뒤 조건을 다시 검토할 수 있습니다.`,
    options:[option(state,`decline:${request.id}`,'공급 제안을 거절한다'),option(state,'maintain','회신을 보류하고 기존 정책을 유지한다')],
  };
  if (request && getAction(state, `accept:${request.id}`)) {
    return {
      id: `diplomacy-${request.id}`,
      title: `${COUNTRIES[request.fromId].name}의 제안 · ${request.title}`,
      description: `${request.description} 응답은 이번 분기의 결정으로 처리되며, 검토만 하면 시간은 흐르지 않습니다.`,
      context: `${date} · ${state.turn + 1}번째 결정 · 응답 기한까지 ${Math.max(0, request.expiresTurn - state.turn)}분기`,
      options: [option(state, `accept:${request.id}`, '제안한 조건을 받아들인다'), option(state, `counter:${request.id}`, '부담을 나누는 대안을 제안한다'), option(state, `decline:${request.id}`, '이번 제안을 정중히 거절한다')],
    };
  }
  const objective=getObjectiveView(state),incident=objective.pendingEvent;
  const scenario = incident ? {title:incident.title,description:incident.description,options:uniqueValidOptions(state,incident.options)} : domesticScenario(state);
  const unlockedId=`mandate_${state.playerId}_${objective.stage===2?1:2}`;
  if(!incident&&!scenario.agenda&&!objective.done&&[2,3].includes(objective.stage)&&!(state.objectives?.counts?.[unlockedId]>0)&&getAction(state,unlockedId))scenario.options=uniqueValidOptions(state,[unlockedId,...scenario.options.map(item=>item.id)]);
  return {
    id: `quarter-${state.playerId}-${state.turn + 1}-${state.activePolicy}-${state.history.at(-1)?.policyId ?? 'start'}`,
    ...scenario,
    context: `${date} · ${state.turn + 1}번째 결정 · ${event.title} · 세계 기후 식량 ${event.foodDelta >= 0 ? '+' : ''}${event.foodDelta} · ${PROFILES[state.playerId].tagline}`,
  };
}

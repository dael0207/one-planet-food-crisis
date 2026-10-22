const METRICS = ['food', 'treasury', 'price', 'trust', 'approval'];
const clone = value => structuredClone(value);

const ACTIONS = [
  ['national:lumen', 'reserve', '종자 비축 전환', 10, 2, '지금 종자와 물을 떼어 둡니다.', '이번 분기 식량 2와 지지도 2를 감수합니다.', {approval: -2}, {food: 3}, 3],
  ['national:lumen', 'export_insurance', '수출 안정 기금', 5, 4, '계약 물량을 보장해 다음 수출 정산을 지킵니다.', '이번 분기 식량 4를 계약분으로 묶습니다.', {trust: 2}, {treasury: 4}, 2],
  ['national:nord', 'stockpile', '항만 재고 회전', 14, 0, '항만 손실을 줄여 산업 도시의 재고를 보강합니다.', '큰 선행 예산과 현장 조정 부담이 듭니다.', {approval: -2}, {food: 3}, 3],
  ['national:nord', 'shift_ration', '산업 교대 급식', 5, 0, '공장 급식을 재편해 가계 물가를 낮춥니다.', '배급 조정으로 이번 분기 지지도가 떨어집니다.', {price: -8, approval: -3}, {treasury: 3}, 2],
  ['national:cera', 'soil_rest', '토양 휴경 보상', 9, 3, '일부 경작지를 쉬게 해 다음 수확을 회복합니다.', '이번 분기 식량 3과 보상 예산을 씁니다.', {}, {food: 4}, 3],
  ['national:cera', 'forward_sale', '수확 선도 계약', 2, 5, '곡물 일부를 미리 계약해 정산 수입을 확보합니다.', '이번 분기 식량 5가 계약 물량으로 빠집니다.', {trust: 2}, {treasury: 4}, 3],
  ['national:altia', 'field_trial', '현장 실증망', 13, 0, '시험 기술을 농가에 적용해 수확 손실을 줄입니다.', '실증 실패 부담으로 이번 분기 지지도가 낮아집니다.', {approval: -2}, {food: 3}, 3],
  ['national:altia', 'patent_pool', '공공 특허 기금', 7, 0, '기술 사용료를 묶어 안정적인 정산 수입을 만듭니다.', '독점 완화 논쟁으로 외교 신뢰가 낮아집니다.', {trust: -3}, {treasury: 4}, 3],
  ['national:marin', 'cold_chain', '항만 냉장망', 14, 0, '하역 손실을 줄여 국내 식량과 항만 수입을 지킵니다.', '큰 선행 예산과 공사 기간이 필요합니다.', {approval: -2}, {food: 2, treasury: 2}, 3],
  ['national:marin', 'convoy', '선단 보증 운송', 7, 2, '선단 손실을 공동 부담해 운송 수입을 안정시킵니다.', '이번 분기 식량 2를 선원 비축으로 씁니다.', {trust: 2}, {treasury: 4}, 2],
  ['national:solis', 'reservoir', '건기 저수 운용', 12, 1, '물을 먼저 저장해 다음 건기의 수확 손실을 줄입니다.', '이번 분기 식량 1과 지지도 2를 감수합니다.', {approval: -2}, {food: 4}, 3],
  ['national:solis', 'kitchen', '지역 공동 급식소', 8, 3, '취약 지역의 식비와 불안을 즉시 낮춥니다.', '이번 분기 식량 3과 운영 예산을 씁니다.', {price: -8}, {approval: 3}, 2],
  ['fiscal', 'austerity', '부처 지출 동결', 0, 0, '두 분기 동안 비핵심 지출을 국고로 돌립니다.', '이번 분기 지지도 6과 물가 안정 여력을 잃습니다.', {approval: -6, price: 3}, {treasury: 5}, 2],
  ['fiscal', 'staged_revenue', '분할 세입 징수', 1, 0, '징수 시점을 나눠 세 분기 동안 국고를 보강합니다.', '이번 분기 지지도 2와 신뢰 3의 반발을 감수합니다.', {approval: -2, trust: -3}, {treasury: 3}, 3],
  ['subsidy', 'targeted', '선별 식비 지원', 6, 0, '지원 대상을 좁혀 물가 부담을 즉시 낮춥니다.', '두 분기 동안 행정 운영비가 이어집니다.', {price: -10, approval: 2}, {treasury: -2}, 2],
  ['subsidy', 'phaseout', '보조금 단계 종료', 0, 0, '보조금을 줄여 다음 분기 재정 여력을 회복합니다.', '이번 분기 물가 4와 지지도 3의 반발을 감수합니다.', {price: 4, approval: -3}, {treasury: 4}, 2],
  ['surplus', 'preserve', '잉여 수확 보존망', 10, 2, '남는 수확을 가공해 다음 세 분기 손실을 줄입니다.', '이번 분기 식량 2와 시설 예산을 씁니다.', {}, {food: 3}, 3],
  ['surplus', 'dividend', '수확 배당 계약', 0, 6, '잉여 식량을 국내 계약 물량으로 전환해 정산 수입을 만듭니다.', '이번 분기 식량 6을 계약분으로 묶습니다.', {approval: 3}, {treasury: 4}, 3],
].map(([family, key, name, cost, foodCost, gain, sacrifice, immediate, effects, duration]) => ({
  id: `cabinet:${family}:${key}`,
  family,
  key,
  name,
  tag: '국정 의제',
  source: 'cabinet',
  cost,
  foodCost,
  gain,
  sacrifice,
  tradeoffs: {gain, sacrifice},
  description: gain,
  immediate: clone(immediate),
  effects: clone(effects),
  plan: {duration, effects: clone(effects)},
  forecast: `이번 분기 ${[cost ? `국고 −${cost}` : null, foodCost ? `식량 −${foodCost}` : null].filter(Boolean).join(' · ') || '자원 선행 지출 없음'} · 다음 분기부터 ${duration}분기 후속 효과`,
}));

export const CABINET_FAMILIES = Object.freeze(Object.groupBy(ACTIONS, action => action.family));
const recentRecords = state => (state.history ?? []).slice(-4);
const activePlan = (state, family) => (state.cabinetPlans ?? []).some(plan => plan.family === family && plan.endTurn >= state.turn);
const coolingDown = (state, family) => Number.isSafeInteger(state.cabinetMemory?.cooldowns?.[family]) && state.turn < state.cabinetMemory.cooldowns[family];
const available = (state, family) => Boolean(CABINET_FAMILIES[family]) && !activePlan(state, family) && !coolingDown(state, family);

function candidateFamilies(state) {
  const country = state.countries?.[state.playerId];
  if (!country || state.turn < 2 || !(state.history?.length || state.cabinetMemory)) return [];
  const recent = recentRecords(state);
  const costlyRun = recent.slice(-3).reduce((sum, record) => sum + (record.actionCost ?? 0), 0) >= 30;
  const repeatedSubsidy = recent.slice(-2).length === 2 && recent.slice(-2).every(record => record.policyId === 'subsidy');
  const completed = recent.some(record => (record.development?.completed?.length ?? 0) + (record.siteDevelopment?.completed?.length ?? 0) > 0);
  return [
    country.treasury <= 28 || costlyRun ? 'fiscal' : null,
    repeatedSubsidy || country.price >= 128 && state.activePolicy === 'embargo' ? 'subsidy' : null,
    country.food >= 72 || completed || state.farmLevel >= 2 ? 'surplus' : null,
    `national:${state.playerId}`,
  ].filter(Boolean);
}

function agendaCopy(state, family) {
  const recent = recentRecords(state), previous = recent.at(-1), repeated = recent.slice(-2).length === 2 && recent.slice(-2).every(record => record.policyId === previous?.policyId);
  if (family === 'fiscal') return {title: '재정 공백 대응', origin: state.countries[state.playerId].treasury <= 28 ? '국고가 위험선에 가까워졌습니다.' : '최근 세 차례의 큰 지출이 다음 사업 여력을 줄였습니다.'};
  if (family === 'subsidy') return {title: '보조금의 출구', origin: repeated ? '생활비 보조를 연속 집행해 재정 부담이 누적됐습니다.' : '수출 제한 속 물가 부담이 다시 커졌습니다.'};
  if (family === 'surplus') return {title: '수확 보존과 배당', origin: state.countries[state.playerId].food >= 72 ? '현재 비축이 충분해 보존과 배당 중 하나를 선택할 수 있습니다.' : '완공된 생산 기반의 성과를 다음 분기로 연결할 때입니다.'};
  const prior = previous?.actionLabel ? `지난 결정 ‘${previous.actionLabel}’ 뒤` : '국가 운영이 안정된 지금';
  const titles = {lumen: '종자 비축과 수출 보장', nord: '항만 비축과 산업 급식', cera: '토양 휴경과 선도 계약', altia: '현장 실증과 특허 수익', marin: '냉장망과 선단 보증', solis: '저수와 공동 급식'};
  return {title: titles[state.playerId], origin: `${prior} 국가 특화 사업의 비용과 성과를 다시 선택해야 합니다.`};
}

export function currentAgenda(state) {
  const family = candidateFamilies(state).find(candidate => available(state, candidate));
  if (!family) return null;
  const copy = agendaCopy(state, family);
  return {family, ...copy, options: CABINET_FAMILIES[family].map(action => ({...clone(action), origin: copy.origin}))};
}

export function cabinetAction(state, id) {
  if (typeof id !== 'string' || !id.startsWith('cabinet:')) return null;
  const agenda = currentAgenda(state);
  return clone(agenda?.options.find(action => action.id === id) ?? null);
}

function applyMetrics(country, effects, parts, label) {
  const applied = {};
  for (const metric of METRICS) {
    const value = effects[metric] ?? 0;
    if (!value) continue;
    const before = country[metric], minimum = metric === 'price' ? 50 : 0, maximum = metric === 'price' ? 220 : 100;
    country[metric] = Math.max(minimum, Math.min(maximum, before + value));
    applied[metric] = country[metric] - before;
    if (metric === 'food' && applied[metric]) parts.push({label, value: applied[metric], source: 'cabinet'});
  }
  return applied;
}

export function applyCabinetDecision(next, action, {parts, actions}) {
  if (action.source !== 'cabinet') return;
  const canonical = ACTIONS.find(item => item.id === action.id);
  if (!canonical || canonical.family.startsWith('national:') && canonical.family !== `national:${next.playerId}` || canonical.cost !== action.cost || canonical.foodCost !== action.foodCost) throw new Error('위조된 국정 의제입니다.');
  const country = next.countries[next.playerId];
  country.food -= action.foodCost;
  if (action.foodCost) parts.push({label: `${action.name} 선행 투입`, value: -action.foodCost, source: 'cabinet'});
  const appliedImmediate = applyMetrics(country, action.immediate, parts, `${action.name} 즉시 효과`);
  const startTurn = next.turn + 1, endTurn = next.turn + action.plan.duration;
  next.cabinetPlans = [...(next.cabinetPlans ?? []), {id: `${action.id}:${next.turn}`, family: action.family, actionId: action.id, name: action.name, origin: action.origin, originatingTurn: next.turn, startTurn, endTurn, effects: clone(action.effects)}].slice(-8);
  next.cabinetMemory = {lastFamily: action.family, lastDecisionTurn: next.turn, cooldowns: {...(next.cabinetMemory?.cooldowns ?? {}), [action.family]: next.turn + 6}};
  const immediate = {...appliedImmediate, food: (appliedImmediate.food ?? 0) - action.foodCost, treasury: (appliedImmediate.treasury ?? 0) - action.cost};
  actions.push({source: 'cabinet', operation: 'decision', type: 'policy', countryId: next.playerId, originatingName: action.name, originatingTurn: next.turn, effects: immediate, food: immediate.food, money: immediate.treasury, plan: {startTurn, endTurn, duration: action.plan.duration, effects: clone(action.effects)}, text: `${action.name}을 시작했습니다. 후속 효과는 다음 분기부터 ${action.plan.duration}분기 이어집니다.`});
}

export function runCabinetFollowthrough(next, {parts, actions}) {
  if (!Array.isArray(next.cabinetPlans)) return;
  for (const plan of next.cabinetPlans) {
    if (next.turn < plan.startTurn || next.turn > plan.endTurn) continue;
    const applied = applyMetrics(next.countries[next.playerId], plan.effects, parts, `${plan.name} 후속 효과`);
    actions.push({source: 'cabinet', operation: 'followthrough', type: 'policy', countryId: next.playerId, originatingName: plan.name, originatingTurn: plan.originatingTurn, planId: plan.id, effects: applied, food: applied.food ?? 0, money: applied.treasury ?? 0, text: `${plan.name} 후속 효과가 반영됐습니다.`});
  }
  next.cabinetPlans = next.cabinetPlans.filter(plan => plan.endTurn >= next.turn).slice(-8);
}

const quarterLabel = turn => `${2031 + Math.floor((turn - 1) / 4)}년 ${(turn - 1) % 4 + 1}분기`;
export function cabinetPlanFacts(state) {
  return (state.cabinetPlans ?? []).filter(plan => plan.endTurn > state.turn).map(plan => {const nextTurn = Math.max(state.turn + 1, plan.startTurn);return {...clone(plan), remaining: Math.max(0, plan.endTurn - Math.max(state.turn, plan.startTurn - 1)), nextTurn, nextLabel: quarterLabel(nextTurn), endLabel: quarterLabel(plan.endTurn)};});
}

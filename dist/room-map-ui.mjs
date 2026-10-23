import {nationalProjects} from './project-state.mjs?v=30';
import { COUNTRY_IDS, COUNTRIES, eventForTurn } from './country-data.mjs?v=30';
import { PROFILES } from './nation-profiles.mjs?v=30';
import {renderForeignGoalIntel} from './world-goals-ui.mjs?v=30';

const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value))}`;
const playerId = (state) => COUNTRY_IDS.includes(state?.playerId) ? state.playerId : 'lumen';
const relationKey = (first, second) => [first, second].sort().join(':');
export const completedTurnLabel = (state) => state.turn > 0 ? `${state.turn}분기 완료 기록` : '아직 완료한 분기 없음';

export const MAP_LANDMARKS = {
  lumen: { contours: ['M-67-26Q-38-48-12-26T51-29', 'M-72 21Q-39 4-9 24T62 18'], farms: ['M-62 45h34m-30-10 32 5m-26-15 30 7'], settlement: [-48, -4] },
  nord: { contours: ['M-68-18Q-38-52-8-18T65-24', 'M-76 33Q-37 10-2 32T71 27'], hills: [[-45, -37], [18, -42], [53, -18]], settlement: [-31, 36] },
  cera: { contours: ['M-72-20Q-42-45-8-18T69-26', 'M-76 29Q-36 5 3 28T73 20'], farms: ['M-65 43h37m-32-12 35 7m-25-18 30 8', 'M27 40h34m-30-11 31 7'], settlement: [44, -4] },
  altia: { contours: ['M-65-4Q-37-45-4-9T64-17', 'M-70 35Q-30 8 3 34T67 26'], hills: [[-45, -28], [4, -42], [43, -19]], settlement: [28, 38] },
  marin: { contours: ['M-72-15Q-39-41-4-13T69-20', 'M-68 32Q-34 10 0 31T67 23'], coast: 'M-76 43Q-45 30-17 44T42 40T73 29', settlement: [-31, -27] },
  solis: { contours: ['M-68-15Q-35-42-3-13T68-20', 'M-72 35Q-36 8-1 34T70 27'], hills: [[-44, -27], [39, -30]], farms: ['M-44 44h35m-30-11 32 7'], settlement: [25, 20] },
};

function currentProject(state, id) {
  return nationalProjects(state,id)[0];
}

function facilityFact(state, id) {
  const own = id === playerId(state);
  const level = own ? numeric(state.farmLevel) : numeric(state.countries[id]?.infrastructure);
  const project = currentProject(state, id);
  const due = project ? numeric(project.dueTurn) : null;
  const remaining = due === null ? null : Math.max(0, due - numeric(state.turn));
  return {
    name: PROFILES[id].facilityName,
    level,
    project,
    due,
    detail: project ? `${remaining}분기 뒤 ${level + 1}단계 완공` : level > 0 ? own ? `${level}단계 운영 중 · 기본 생산 +${level * 4}/분기` : `${level}단계 운영 중` : '투자 전',
  };
}

export function mapCountryResult(state, id, phase = 'decision') {
  if (!state?.countries?.[id] || !COUNTRY_IDS.includes(id)) return null;
  const facility = facilityFact(state, id);
  const record = phase === 'result' ? state.history?.at(-1) : null;
  const before = record?.beforeCountries?.[id];
  const foodDelta = before ? numeric(state.countries[id].food) - numeric(before.food) : null;
  let development = null;
  if (id === playerId(state) && record?.development) {
    if (record.development.completed?.length) development = 'completed';
    else if (record.development.started?.length) development = 'started';
    else if (record.development.ongoing?.length) development = 'building';
  }
  return {
    food: numeric(state.countries[id].food),
    foodBefore: before ? numeric(before.food) : null,
    foodDelta,
    facilityLevel: facility.level,
    facilityName: facility.name,
    development,
    projectDueTurn: facility.due,
  };
}

export function renderCountryIntel(state, id, phase = 'decision') {
  if (!state?.countries || !COUNTRY_IDS.includes(id)) return '';
  const player = playerId(state);
  const own = id === player;
  const country = state.countries[id];
  const facility = facilityFact(state, id);
  const relation = own ? null : numeric(state.relations?.[relationKey(player, id)], 50);
  const relationMarkup = own
    ? '<div class="country-intel-fact"><span>통치 상태</span><b>당신의 나라</b></div>'
    : `<div class="country-intel-fact" data-relation="${relation}"><span>${escape(COUNTRIES[player].name)} · 양국 관계</span><b>${relation}점</b></div>`;
  const projectAttribute = facility.due === null ? '' : ` data-project-due="${facility.due}"`;
  const action = own
    ? '<button type="button" class="country-intel-action" data-action="close-country-inspect">지도 전체 보기</button>'
    : `${phase==='decision'?`<button type="button" class="country-intel-action" data-action="open-proposal" data-country="${id}">${escape(COUNTRIES[id].name)}와 단기 협상</button><button type="button" class="country-intel-action is-quiet" data-action="open-treaty" data-country="${id}">장기 협정</button>`:'<span class="country-intel-note">결과 확인 중 · 다음 분기에 협상 가능</span>'}<button type="button" class="country-intel-action is-quiet" data-action="close-country-inspect">내 나라로</button>`;
  return `<article class="country-intel" data-country-intel="${id}" data-phase="${escape(phase)}"${projectAttribute}><header><span>${own ? '통치 국가' : '국가 정보'}</span><h3>${escape(COUNTRIES[id].name)}</h3><p>${escape(COUNTRIES[id].roleLabel)}</p></header><div class="country-intel-metrics"><div data-food="${numeric(country.food)}"><span>식량</span><b>${numeric(country.food)}</b></div><div data-treasury="${numeric(country.treasury)}"><span>국고</span><b>${numeric(country.treasury)}억</b></div><div data-price="${numeric(country.price)}"><span>물가</span><b>${numeric(country.price)}</b></div></div><div class="country-intel-facts">${relationMarkup}<div class="country-intel-fact"><span>${escape(facility.name)}</span><b>${escape(facility.detail)}</b></div></div>${renderForeignGoalIntel(state,id)}<footer>${action}</footer></article>`;
}

function resultFoodChanges(state, record) {
  const recorded = new Map((record.changes ?? [])
    .filter((change) => change.metric === 'food' && COUNTRY_IDS.includes(change.countryId))
    .map((change) => [change.countryId, numeric(change.after) - numeric(change.before)]));
  for (const id of COUNTRY_IDS) {
    if (recorded.has(id) || !record.beforeCountries?.[id] || !state.countries[id]) continue;
    const delta = numeric(state.countries[id].food) - numeric(record.beforeCountries[id].food);
    if (delta) recorded.set(id, delta);
  }
  return recorded;
}

export function renderMapBrief(state, phase = 'decision') {
  if (!state?.countries) return '';
  if (phase !== 'result' || !state.history?.length) {
    const event = eventForTurn(numeric(state.turn));
    return `<section class="map-brief" data-map-brief-phase="decision"><span>현재 상황</span><strong>${escape(event.title)}</strong></section>`;
  }
  const record = state.history.at(-1);
  const player = playerId(state);
  const changes = resultFoodChanges(state, record);
  const items = [...changes].map(([id, total]) => {
    const directAttribute = id === player ? ` data-direct-food="${numeric(record.policyEffect?.food)}"` : '';
    const direct = '';
    return `<li data-country="${id}" data-total-food="${total}"${directAttribute}><strong>${escape(COUNTRIES[id].name)}</strong><b>${signed(total)}</b>${direct}</li>`;
  }).join('');
  const development = record.development ?? {};
  const milestone = development.completed?.length
    ? `${PROFILES[player].facilityName} ${numeric(development.levelAfter)}단계 완공`
    : development.started?.length ? `${PROFILES[player].facilityName} 공사 시작` : '';
  return `<section class="map-brief" data-map-brief-phase="result"><header><span>이번 분기 식량 총변화</span><strong>${escape(record.eventTitle ?? eventForTurn(Math.max(0, numeric(state.turn) - 1)).title)}</strong></header><ul>${items || '<li class="map-brief-empty">기록된 식량 변동 없음</li>'}</ul>${milestone ? `<p class="map-brief-milestone">${escape(milestone)}</p>` : ''}<details class="map-brief-detail"><summary>직접 효과와 총변화 기준</summary><p>총변화는 세계 운영 전체의 결과이며, 정책 직접 비교는 같은 세계에서 현 정책을 유지했을 때와의 차이입니다.</p></details></section>`;
}

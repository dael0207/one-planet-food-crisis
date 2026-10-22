import {nationalProjects,siteProjects} from './project-state.mjs?v=29';
import { COUNTRY_IDS, COUNTRIES } from './country-data.mjs?v=29';
import { eventForTurn } from './engine.mjs?v=29';
import { mapRoutes, routeGeometry } from './map-geometry.mjs?v=29';
import { PROFILES } from './nation-profiles.mjs?v=29';
import { updateNetworkMap } from './map-network-ui.mjs?v=29';
import { mapCountryResult, completedTurnLabel } from './room-map-ui.mjs?v=29';
import { buildAtlas } from './atlas-art.mjs?v=29';
import {updateCountryAppearance} from './atlas-state.mjs?v=29';
import { conflictCountryLabel } from './conflict-ui.mjs?v=29';
import {peaceResponseCountryLabel} from './peace-response-model.mjs?v=29';
import {updatePeaceResponseMap} from './peace-response-map.mjs?v=29';

const NS = 'http://www.w3.org/2000/svg';
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const percent = (value) => Math.max(0, Math.min(100, Math.round(numeric(value))));
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value))}`;
const lastTurn = (state) => state.history?.at(-1);
const foodStatus = (food) => food < 35 ? ['critical', '공급 위험'] : food < 55 ? ['stressed', '재고 부족'] : ['healthy', '공급 안정'];
const roleLabel = (id) => COUNTRIES[id].roleLabel;
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const getPlayerId = (state) => COUNTRY_IDS.includes(state?.playerId) ? state.playerId : 'lumen';

function climate(state, phase = 'decision') {
  const event = eventForTurn(Math.max(0, numeric(state.turn) - (phase === 'result' ? 1 : 0)));
  const delta = numeric(event.foodDelta);
  return { title: event.title, detail: delta < 0 ? '수확 감소 · 식량 재고를 살펴보세요' : delta > 0 ? '수확 회복 · 각국의 거래가 이어집니다' : '기후와 소비가 재고에 반영됩니다', key: delta <= -5 ? 'drought' : delta < 0 ? 'cold' : delta > 0 ? 'recovery' : 'rain' };
}

function previousValue(state, countryId, metric) {
  const last = lastTurn(state);
  const change = last?.changes?.find((item) => item.countryId === countryId && item.metric === metric);
  return numeric(last?.beforeCountries?.[countryId]?.[metric] ?? change?.before ?? state.countries[countryId][metric]);
}

function node(tag, attributes = {}, text = '') {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
}

export const actualShipmentRoutes = (state) => mapRoutes(state).filter((route) => route.liveAction === true);

function updateRoutes(svg, state, focus, phase) {
  const layer = svg.querySelector('#map-route-layer');
  layer.setAttribute('aria-hidden', 'true');
  layer.replaceChildren();
  for (const route of actualShipmentRoutes(state)) {
    const geometry = routeGeometry(route.countryId, route.targetId);
    if (!geometry) continue;
    const active = route.countryId === focus || route.targetId === focus;
    const group = node('g', { class: `map-route${route.blocked ? ' is-blocked' : ''}${route.liveAction ? ' is-world-action' : ''}${phase === 'result' && active ? ' is-active-route' : ''}`, 'data-from': route.countryId, 'data-to': route.targetId, 'data-type': route.type });
    group.append(node('title', {}, `${COUNTRIES[route.countryId].name} → ${COUNTRIES[route.targetId].name} · ${route.label}`));
    group.append(node('path', { d: geometry.d, stroke: `var(--${route.countryId})`, fill: 'none', 'stroke-width': route.liveAction ? 5 : route.type === 'agreement' ? 4 : 2.5, 'marker-end': route.blocked ? '' : 'url(#map-trade-arrow)' }));
    layer.append(group);
  }
}

const pendingRequests = (state, id) => {
  const player = getPlayerId(state);
  return (state.requests ?? []).filter((request) => request.status === 'pending' && request.expiresTurn > state.turn && request.fromId !== player && (!request.targetId || request.targetId === player) && (!id || request.fromId === id));
};

export function getWorldStatus(state, phase = 'decision') {
  const player = getPlayerId(state);
  const actions = (lastTurn(state)?.worldActions ?? []).filter((action) => action.countryId !== player).length;
  const policy = state.activePolicy === 'embargo' ? `${COUNTRIES[player].name}의 수출 제한 유지` : '국경을 넘는 식량 교역';
  return `${climate(state, phase).title} · ${policy} · ${completedTurnLabel(state)} · 타국 행동 ${actions}건 · 대기 요청 ${pendingRequests(state).length}건`;
}

function countryNote(state, id) {
  const player = getPlayerId(state);
  if (id === player) {
    const national=nationalProjects(state,id)[0],local=siteProjects(state,id);
    const projects=[national?`${PROFILES[id].facilityName} 공사 · ${Math.max(0,national.dueTurn-state.turn)}분기 뒤 완공`:null,local.length?`지도 시설 ${local.length}곳 공사 중`:null].filter(Boolean);
    if(projects.length)return projects.join(' / ');
    if (state.farmLevel > 0) return `${PROFILES[id].facilityName} ${state.farmLevel}단계 가동`;
    return `${PROFILES[id].facilityName} 투자 전 · ${state.activePolicy === 'embargo' ? '수출 제한 유지 중' : state.activePolicy === 'resilience' ? '계절 기후 피해 완화 중' : `${PROFILES[id].policyLabel} 유지 중`}`;
  }
  const requests = pendingRequests(state, id).length;
  if (requests) return `${COUNTRIES[player].name}에 협상·지원 요청 ${requests}건`;
  const actions = lastTurn(state)?.worldActions?.filter((action) => action.countryId === id) ?? [];
  if (actions.length) return actions.at(-1).text;
  return `생활비 ${numeric(state.countries[id].price)} · 국고 ${numeric(state.countries[id].treasury)}`;
}

function updateStatusCards(state, focus) {
  const target = document.querySelector('#world-status');
  if (!target) return;
  const player = getPlayerId(state);
  const requests = pendingRequests(state).length;
  const routes = [...new Map(actualShipmentRoutes(state).map(route => [`${route.countryId}-${route.targetId}-${route.label}`, route])).values()];
  const routeKey = routes.length ? `<ul class="map-route-key" aria-label="${escape(completedTurnLabel(state))}의 거래와 지원">${routes.map(route => `<li style="--route-color:var(--${route.countryId})"><span>${escape(COUNTRIES[route.countryId].name)} → ${escape(COUNTRIES[route.targetId].name)}</span><b>${escape(route.label)}</b></li>`).join('')}</ul>` : `<p class="network-empty">${escape(completedTurnLabel(state))}에 실행된 거래나 지원이 없습니다.</p>`;
  target.innerHTML = `<div class="world-status-heading"><span class="world-climate-tag">${escape(completedTurnLabel(state))}</span><p>${requests ? `타국의 요청 ${requests}건이 기다립니다. 외교 우편함에서 조건을 확인하세요.` : '나라를 눌러 재고와 생활을 살펴보세요. 화살표는 마지막으로 완료한 분기의 실제 식량 이동입니다.'}</p></div>${routeKey}<div class="world-country-status">${COUNTRY_IDS.map((id) => {
    const food = percent(state.countries[id].food);
    const before = previousValue(state, id, 'food');
    const [status, label] = foodStatus(state.countries[id].food);
    return `<article class="world-country-card ${status}${focus === id ? ' is-focused' : ''}" data-country-status="${id}"><div class="world-country-card-top"><strong>${COUNTRIES[id].name}</strong><span>${label}</span></div><div class="world-country-role">${escape(roleLabel(id))}${id === player ? ' · 당신의 나라' : ''}</div><div class="world-food-value"><span>식량</span><b>${lastTurn(state) ? `<small>${before} → </small>` : ''}${food}</b><em>${lastTurn(state) ? signed(food - before) : '/ 100'}</em></div><div class="world-food-meter"><i style="width:${food}%"></i></div><p>${escape(countryNote(state, id))}</p></article>`;
  }).join('')}</div>`;
}

export function updateMap(state, { phase = 'decision', selectedCountry = null, mapMode = 'network', mapFilter = 'all' } = {}) {
  const svg = document.querySelector('.world-map');
  if (!svg || !state?.countries) return;
  buildAtlas(svg);
  const weather = climate(state, phase);
  const player = getPlayerId(state);
  const focus = COUNTRY_IDS.includes(selectedCountry) ? selectedCountry : player;
  svg.dataset.climate = weather.key;
  svg.dataset.phase = phase;
  svg.setAttribute('aria-label', `여섯 나라의 현재 세계 지도. ${getWorldStatus(state, phase)}. 국가 선택은 아래 버튼으로도 할 수 있습니다.`);
  for (const id of COUNTRY_IDS) {
    const facts = mapCountryResult(state, id, phase);
    const food = percent(facts.food);
    const [status, label] = foodStatus(food);
    const land = svg.querySelector(`.land[data-country="${id}"]`);
    land.dataset.foodStatus = status;
    land.classList.toggle('is-focused', focus === id);
    const side=peaceResponseCountryLabel({...state,turn:state.turn+(phase==='decision'?1:0)},id)||conflictCountryLabel(state,id);
    land.querySelector('.country-role').textContent = side ? `${id===player?'당신 · ':''}${side}` : (id === player ? '당신의 나라' : roleLabel(id));
    const resultDelta = facts.foodDelta === null ? '' : `, 이번 분기 총변화 ${signed(facts.foodDelta)}`;
    land.setAttribute('aria-label', `${COUNTRIES[id].name} ${id === player ? '당신의 나라' : roleLabel(id)}, 식량 안정 ${food}${resultDelta}, ${label} 살펴보기`);
    land.setAttribute('aria-pressed', String(focus === id));
    if (facts.foodDelta === null) delete land.dataset.foodDelta;
    else land.dataset.foodDelta = String(facts.foodDelta);
    const foodLabel = svg.querySelector(`#map-food-${id}`);
    foodLabel.textContent = facts.foodDelta === null ? `식량 ${food}` : `식량 ${food} · ${signed(facts.foodDelta)}`;
    foodLabel.classList.toggle('is-positive', facts.foodDelta > 0);
    foodLabel.classList.toggle('is-negative', facts.foodDelta < 0);
    svg.querySelector(`#map-bar-${id}`).setAttribute('width', String(.88 * food));
    const development = facts.development === 'completed' ? ' · 이번 분기 완공' : facts.development === 'started' ? ' · 이번 분기 착공' : facts.development === 'building' ? ' · 공사 중' : '';
    const facilityLabel = svg.querySelector(`#map-infrastructure-${id}`);
    facilityLabel.textContent = `${facts.facilityName} ${facts.facilityLevel}단계${development}`;
    facilityLabel.dataset.development = facts.development ?? '';
    const requests = pendingRequests(state, id).length;
    svg.querySelector(`#map-request-${id}`).style.display = requests ? '' : 'none';
    svg.querySelector(`#map-request-count-${id}`).textContent = `요청 ${requests}`;
  }
  svg.querySelector('#map-climate-title').textContent = weather.title;
  svg.querySelector('#map-climate-detail').textContent = weather.detail;
  const foreignActions = (lastTurn(state)?.worldActions ?? []).filter((action) => action.countryId !== player).length;
  svg.querySelector('#map-action-count').textContent = `${completedTurnLabel(state)} · 타국 행동 ${foreignActions}건`;
  svg.querySelector('#map-record-period').textContent = `${completedTurnLabel(state)} · 화살표는 실제 교역·지원`;
  if (!updateNetworkMap(svg, state, { focus, mode: mapMode, filter: mapFilter })) updateRoutes(svg, state, focus, phase);
  updatePeaceResponseMap(svg,state,phase);
  updateCountryAppearance(svg,state,phase);
  updateStatusCards(state, focus);
}

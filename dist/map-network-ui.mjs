import { COUNTRY_IDS, COUNTRIES } from './country-data.mjs?v=31';
import { GEOGRAPHY } from './map-geometry.mjs?v=31';
import { mapTreatyChanges, mapTreatyLinks } from './map-network.mjs?v=31';

const NS = 'http://www.w3.org/2000/svg';
const LIVE = new Set(['active', 'new']);
const STATUS = {
  active: '유효',
  new: '신규',
  broken: '파기',
  cancelled: '종료',
  completed: '기간 완료',
};
const KIND = { trade: '무역 협정', alliance: '식량 상호지원 동맹' };
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function svgNode(tag, attributes = {}, text = '') {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
}

function ensureNetworkDefs(svg) {
  const defs = svg.querySelector('defs');
  if (!defs || defs.querySelector('#map-network-arrow')) return;
  const marker = svgNode('marker', { id: 'map-network-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' });
  marker.append(svgNode('path', { d: 'M0 0 10 5 0 10Z', fill: 'context-stroke' }));
  defs.append(marker);
}

function geometry(link) {
  const [lowId, highId] = [link.fromId, link.toId].sort();
  const low = GEOGRAPHY[lowId];
  const high = GEOGRAPHY[highId];
  if (!low || !high || lowId === highId) return null;
  const dx = high.x - low.x;
  const dy = high.y - low.y;
  const distance = Math.hypot(dx, dy);
  const ux = dx / distance;
  const uy = dy / distance;
  const start = { x: low.x + ux * 96, y: low.y + uy * 86 };
  const end = { x: high.x - ux * 100, y: high.y - uy * 90 };
  const lane = link.kind === 'trade' ? -32 : 32;
  const control = { x: (start.x + end.x) / 2 - uy * lane, y: (start.y + end.y) / 2 + ux * lane };
  const forward = link.fromId === lowId;
  const from = forward ? start : end;
  const to = forward ? end : start;
  return {
    d: `M${from.x} ${from.y}Q${control.x} ${control.y} ${to.x} ${to.y}`,
    x: (start.x + 2 * control.x + end.x) / 4,
    y: (start.y + 2 * control.y + end.y) / 4,
  };
}

function accessibleLabel(link) {
  const pair = `${COUNTRIES[link.fromId].name}${link.kind === 'trade' ? ' → ' : ' ↔ '}${COUNTRIES[link.toId].name}`;
  return `${pair} · ${KIND[link.kind]} · ${STATUS[link.status]}. ${link.description ?? ''}`.trim();
}

function drawStatusMark(group, link, point) {
  if (LIVE.has(link.status)) return;
  const mark = svgNode('g', { class: 'map-network-state', transform: `translate(${point.x} ${point.y})` });
  if (link.status !== 'completed') {
    mark.append(svgNode('path', { d: 'M-6-6 6 6M6-6-6 6' }));
  }
  const label = STATUS[link.status];
  const width = label.length * 13 + 18;
  mark.append(svgNode('rect', { x: -width / 2, y: 10, width, height: 24, rx: 4 }));
  mark.append(svgNode('text', { y: 27, 'text-anchor': 'middle' }, label));
  group.append(mark);
}

function drawLinks(svg, links, focus) {
  ensureNetworkDefs(svg);
  const layer = svg.querySelector('#map-route-layer');
  layer.removeAttribute('aria-hidden');
  layer.replaceChildren();
  for (const link of links) {
    const point = geometry(link);
    if (!point) continue;
    const connected = link.fromId === focus || link.toId === focus;
    const group = svgNode('g', {
      class: `map-network-link is-${link.kind} is-${link.status}${connected ? ' is-connected' : ''}`,
      'data-from': link.fromId,
      'data-to': link.toId,
      'data-kind': link.kind,
      'data-status': link.status,
    });
    group.append(svgNode('title', {}, accessibleLabel(link)));
    group.append(svgNode('path', {
      class: 'map-network-path',
      d: point.d,
      'marker-end': link.kind === 'trade' && LIVE.has(link.status) ? 'url(#map-network-arrow)' : '',
    }));
    drawStatusMark(group, link, point);
    layer.append(group);
  }
}

function detailText(link) {
  const terms = link.description ? [link.description] : [];
  if (!link.description && link.food) terms.push(`식량 ${link.food}`);
  if (!link.description && link.money) terms.push(`대금 ${link.money}`);
  if (link.startsIn > 0) terms.push(`${link.startsIn}분기 뒤 시작`);
  else if (LIVE.has(link.status) && Number.isFinite(link.remaining)) terms.push(`${link.remaining}회 남음`);
  return escape(terms.join(' · ') || '조건 기록 없음');
}

function linkItem(link) {
  const arrow = link.kind === 'trade' ? ' → ' : ' ↔ ';
  return `<li class="network-key-item is-${link.kind} is-${link.status}"><div class="network-key-main"><span class="network-line-sample" aria-hidden="true"></span><strong>${escape(COUNTRIES[link.fromId].name)}${arrow}${escape(COUNTRIES[link.toId].name)}</strong><span class="network-status">${STATUS[link.status]}</span></div><div class="network-key-meta"><span>${KIND[link.kind]}</span><span>${detailText(link)}</span></div></li>`;
}

function countsMarkup(links, focus) {
  const counts = Object.fromEntries(COUNTRY_IDS.map((id) => [id, { trade: 0, alliance: 0 }]));
  for (const link of links.filter((item) => LIVE.has(item.status))) {
    counts[link.fromId][link.kind] += 1;
    counts[link.toId][link.kind] += 1;
  }
  return `<div class="network-country-counts" aria-label="국가별 유효한 협정 수">${COUNTRY_IDS.map((id) => `<div${id === focus ? ' class="is-focused"' : ''}><strong>${escape(COUNTRIES[id].name)}</strong><span>무역 ${counts[id].trade} · 동맹 ${counts[id].alliance}</span></div>`).join('')}</div>`;
}

function renderControls(mode, filter) {
  const target = document.querySelector('#map-network-controls');
  if (!target) return;
  target.classList.add('map-network-controls');
  if (!target.children.length) target.innerHTML = '<div class="map-control-group" role="group" aria-label="지도 표시"><button type="button" data-action="map-mode" data-mode="network">협정망</button><button type="button" data-action="map-mode" data-mode="shipments">거래 기록</button></div><div class="map-control-group map-filter-group" role="group" aria-label="협정 종류"><button type="button" data-action="map-filter" data-filter="all">전체</button><button type="button" data-action="map-filter" data-filter="trade">무역</button><button type="button" data-action="map-filter" data-filter="alliance">동맹</button></div><div class="map-network-legend" aria-label="협정망 선 범례"><span class="is-trade"><i aria-hidden="true"></i>무역</span><span class="is-alliance"><i aria-hidden="true"></i>동맹</span><span class="is-closed"><i aria-hidden="true"></i>파기·종료</span></div>';
  for (const button of target.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  for (const button of target.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  target.querySelector('.map-filter-group').hidden = mode !== 'network';
  target.querySelector('.map-network-legend').hidden = mode !== 'network';
}

function renderSummary(state, links, allLinks, focus, filter) {
  const target = document.querySelector('#map-network-summary');
  if (!target) return;
  target.classList.add('map-network-summary');
  const live = links.filter((link) => LIVE.has(link.status));
  const changes = mapTreatyChanges(state).filter((link) => filter === 'all' || link.kind === filter);
  const filterName = filter === 'trade' ? '무역 협정' : filter === 'alliance' ? '식량 동맹' : '협정';
  const liveMarkup = live.length ? `<ul class="network-key-list">${live.map(linkItem).join('')}</ul>` : `<p class="network-empty">현재 표시할 ${filterName}이 없습니다.</p>`;
  const changeMarkup = changes.length ? `<section class="network-changes"><h3>최근 완료된 ${state.turn}분기 변화</h3><ul class="network-key-list">${changes.map(linkItem).join('')}</ul></section>` : '';
  target.innerHTML = `<div class="network-summary-heading"><div><span class="eyebrow">LIVE TREATY NETWORK</span><h3>유효한 관계 ${live.length}건</h3></div><p>선은 여러 분기의 약속입니다. 실제로 이동한 식량은 ‘거래 기록’에서 확인하세요.</p></div>${countsMarkup(allLinks, focus)}${liveMarkup}${changeMarkup}`;
}

export function updateNetworkMap(svg, state, { focus, mode = 'network', filter = 'all' } = {}) {
  const safeMode = mode === 'shipments' ? 'shipments' : 'network';
  const safeFilter = ['trade', 'alliance'].includes(filter) ? filter : 'all';
  renderControls(safeMode, safeFilter);
  svg.dataset.mapMode = safeMode;
  document.querySelector('#map-network-summary')?.toggleAttribute('hidden', safeMode !== 'network');
  document.querySelector('#world-status')?.toggleAttribute('hidden', safeMode === 'network');
  if (safeMode !== 'network') return false;
  const links = mapTreatyLinks(state, safeFilter);
  const allLinks = safeFilter === 'all' ? links : mapTreatyLinks(state);
  drawLinks(svg, links, focus);
  renderSummary(state, links, allLinks, focus, safeFilter);
  const liveCounts = Object.fromEntries(COUNTRY_IDS.map((id) => [id, allLinks.filter((link) => LIVE.has(link.status) && (link.fromId === id || link.toId === id)).length]));
  for (const id of COUNTRY_IDS) {
    const land = svg.querySelector(`.land[data-country="${id}"]`);
    land?.setAttribute('aria-label', `${land.getAttribute('aria-label')}, 유효한 협정 ${liveCounts[id]}건`);
  }
  return true;
}

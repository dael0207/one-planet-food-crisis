import {COUNTRIES, COUNTRY_IDS} from './country-data.mjs?v=29';
import {GEOGRAPHY} from './map-geometry.mjs?v=29';
import {SCENE_LAYOUT, countryAppearance} from './atlas-state.mjs?v=29';
import {siteView} from './site-operations.mjs?v=29';
import {jointAt,JOINT_STATUS} from './joint-investments-ui.mjs?v=29';
import {buildMapSiteScene} from './map-art.mjs?v=29';

const NS = 'http://www.w3.org/2000/svg';
export const SITE_KINDS = ['city', 'port', 'farm'];
export const SITE_LABELS = {city: '도시', port: '항구', farm: '농경지'};

const svgNode = (tag, attributes = {}, text = '') => {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (text) element.textContent = text;
  return element;
};

export function sitePoint(countryId, kind) {
  const geography = GEOGRAPHY[countryId];
  if (!geography || !SITE_KINDS.includes(kind)) return null;
  const local = kind === 'port' ? geography.port : SCENE_LAYOUT[countryId]?.[kind === 'city' ? 'town' : 'farm'];
  return local ? {x: geography.x + local[0], y: geography.y + local[1]} : null;
}

export const MAP_SITE_POSITIONS = Object.freeze(Object.fromEntries(COUNTRY_IDS.map((countryId) => [
  countryId,
  Object.freeze(Object.fromEntries(SITE_KINDS.map((kind) => [kind, Object.freeze(sitePoint(countryId, kind))]))),
])));

export function mapSiteModels(state, selection = null) {
  return COUNTRY_IDS.flatMap((countryId) => SITE_KINDS.map((kind) => ({
    countryId,
    kind,
    point: MAP_SITE_POSITIONS[countryId][kind],
    selected: selection?.countryId === countryId && selection?.kind === kind,
    view: siteView(state, countryId, kind),
    joint: jointAt(state,countryId,kind),
    appearance: countryAppearance(state, countryId),
  })));
}

function buildTarget(model) {
  const {countryId, kind, point} = model;
  const target = svgNode('g', {
    class: `map-site-target map-site-${kind}`,
    transform: `translate(${point.x} ${point.y})`,
    role: 'button', tabindex: '0',
    'data-action': 'open-facility', 'data-country': countryId, 'data-site': kind, 'data-map-site': 'true',
  });
  target.append(svgNode('circle', {class: 'map-site-hit', r: 22}));
  target.append(svgNode('circle', {class: 'map-site-ring', r: 17}));
  target.append(buildMapSiteScene(svgNode, kind, countryId));
  target.append(svgNode('circle', {class: 'map-site-focus', r: 25}));
  target.append(svgNode('text', {class: 'map-site-label', y: point.y>560?-36:35, 'text-anchor': 'middle'}, SITE_LABELS[kind]), svgNode('text', {class: 'map-site-status', y: point.y>560?-24:46, 'text-anchor': 'middle'}),svgNode('text',{class:'map-site-joint',y:-32,'text-anchor':'middle','aria-hidden':'true'}));
  return target;
}

function applyTarget(target, model) {
  const {countryId, kind, selected, view, joint, appearance} = model;
  const jointLabel=joint&&['building','active','suspended'].includes(joint.status)?JOINT_STATUS[joint.status]:'';
  target.setAttribute('data-joint-status',jointLabel?joint.status:'none');
  target.querySelector('.map-site-joint').textContent=jointLabel;
  const level = view.level;
  const status = view.remaining !== null ? `공사 ${view.remaining}분기` : level === null ? `국가 기반 ${view.aggregateInfrastructure}단계` : `${level}단계`;
  target.setAttribute('data-owned', String(view.owned));
  target.setAttribute('data-level', level === null ? 'unknown' : String(level));
  target.setAttribute('data-national-level', String(view.aggregateInfrastructure ?? 0));
  target.setAttribute('data-national-construction', String(kind === 'city' && appearance?.construction === true));
  target.setAttribute('data-food-status', appearance?.foodStatus ?? 'secure');
  target.setAttribute('data-stage', String(view.stage));
  target.setAttribute('data-selected', String(selected));
  target.setAttribute('aria-pressed', String(selected));
  target.querySelector('.map-site-status').textContent = status;
  const siteName = view.name ?? SITE_LABELS[kind];
  const fact = level === null
    ? `현지 단계 미확인, 국가 기반 시설 ${view.aggregateInfrastructure}단계`
    : `${level}단계${view.remaining !== null ? `, 완공까지 ${view.remaining}분기` : ''}`;
  const reason=view.lastDecision?.reason?`, 최근 자국 결정: ${view.lastDecision.reason}`:'';
  target.setAttribute('aria-label', `${COUNTRIES[countryId].name} ${siteName}, ${fact}${reason}${jointLabel?', '+jointLabel:''}`);
}

function wireKeyboard(layer) {
  layer.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest?.('.map-site-target');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
  });
}

export function updateMapSites(svg, state, selection = null) {
  if (!svg || !state?.countries) return null;
  let layer = svg.querySelector('#map-site-layer');
  if (!layer) {
    layer = svgNode('g', {id: 'map-site-layer', 'aria-label': '도시, 항구, 농경지'});
    wireKeyboard(layer);
  }
  const models = mapSiteModels(state, selection);
  for (const model of models) {
    let target = layer.querySelector(`.map-site-target[data-country="${model.countryId}"][data-site="${model.kind}"]`);
    if (!target) {
      target = buildTarget(model);
      layer.append(target);
    }
    applyTarget(target, model);
  }
  svg.append(layer);
  return layer;
}

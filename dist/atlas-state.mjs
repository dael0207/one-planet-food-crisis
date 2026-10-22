import { COUNTRY_IDS } from './country-data.mjs?v=29';
import { mapCountryResult } from './room-map-ui.mjs?v=29';
import {SITE_KINDS,siteView} from './site-operations.mjs?v=29';

const NS = 'http://www.w3.org/2000/svg';
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const node = (tag, attributes = {}, text = '') => {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text) element.textContent = text;
  return element;
};

const foodBand = (food) => food < 35 ? 'critical' : food < 55 ? 'strained' : 'secure';
const foodCue = (status) => status === 'critical' ? '식량 위기' : status === 'strained' ? '식량 긴장' : '식량 안정';

function facilityCue({ affordability, construction, development, facilityLevel, siteConstructionCount, siteOperatingCount }) {
  if (construction) return '시설 공사 중';
  if (development === 'completed') return `시설 ${facilityLevel}단계 완공`;
  if (siteConstructionCount) return `현장 시설 ${siteConstructionCount}곳 공사 중`;
  if (siteOperatingCount) return `현장 시설 ${siteOperatingCount}곳 운영`;
  if (affordability === 'pressure') return '생활비 압박';
  return facilityLevel > 0 ? `시설 ${facilityLevel}단계 운영` : '시설 투자 전';
}

export function countryAppearance(state, id, phase = 'decision') {
  const facts = mapCountryResult(state, id, phase);
  if (!facts) return null;
  const playerId = COUNTRY_IDS.includes(state?.playerId) ? state.playerId : 'lumen';
  const food = numeric(facts.food);
  const price = numeric(state.countries[id].price);
  const facilityLevel = Math.max(0, Math.min(3, Math.trunc(numeric(facts.facilityLevel))));
  const appearance = {
    id,
    food,
    foodStatus: foodBand(food),
    affordability: price >= 125 ? 'pressure' : 'stable',
    price,
    facilityLevel,
    development: facts.development,
    siteConstructionCount:SITE_KINDS.filter(kind=>siteView(state,id,kind)?.project).length,
    siteOperatingCount:SITE_KINDS.filter(kind=>(siteView(state,id,kind)?.level??0)>0).length,
    construction: id === playerId && facts.projectDueTurn !== null,
  };
  return { ...appearance, cues: [foodCue(appearance.foodStatus), facilityCue(appearance)] };
}

export const SCENE_LAYOUT={
 lumen:{farm:[-35,100],town:[-10,-60]},nord:{farm:[100,25],town:[-125,30]},
 cera:{farm:[-40,110],town:[0,-65]},altia:{farm:[-15,-65],town:[85,10]},
 marin:{farm:[-70,105],town:[95,-20]},solis:{farm:[-75,45],town:[-70,-55]},
};

export function buildCountryAppearance(parent, id) {
  if (!parent || !COUNTRY_IDS.includes(id)) return null;
  const existing = parent.querySelector('.atlas-country-appearance');
  if (existing) return existing;
  const root = node('g', { class: 'atlas-country-appearance', 'data-country-appearance': id });
  root.append(node('text', { y: 76, 'text-anchor': 'middle', class: 'map-state-summary' }));
  const label = parent.querySelector('.country-name');
  if (label) parent.insertBefore(root, label);
  else parent.append(root);
  return root;
}

function applyAppearance(root, appearance) {
  for (const [name, value] of Object.entries({
    'data-food': appearance.food,
    'data-food-status': appearance.foodStatus,
    'data-price': appearance.price,
    'data-affordability': appearance.affordability,
    'data-facility-level': appearance.facilityLevel,
    'data-development': appearance.development ?? '',
    'data-construction': appearance.construction,
  })) root.setAttribute(name, String(value));
  root.querySelector('.map-state-summary').textContent = appearance.cues.join(' · ');
}

export function updateCountryAppearance(svg, state, phase = 'decision') {
  if (!svg || !state?.countries) return;
  for (const id of COUNTRY_IDS) {
    const parent = svg.querySelector(`.land[data-country="${id}"]`);
    const appearance = countryAppearance(state, id, phase);
    if (!parent || !appearance) continue;
    applyAppearance(buildCountryAppearance(parent, id), appearance);
    const summary = appearance.cues.join(' · ');
    const previous = parent.getAttribute('data-state-summary') ?? '';
    const label = parent.getAttribute('aria-label');
    if (label) {
      const priorSuffix = previous ? `, ${previous}` : '';
      const base = priorSuffix && label.endsWith(priorSuffix) ? label.slice(0, -priorSuffix.length) : label;
      parent.setAttribute('aria-label', `${base}, ${summary}`);
    }
    parent.setAttribute('data-state-summary', summary);
  }
}

import { COUNTRY_IDS, COUNTRIES } from './country-data.mjs?v=31';
import { GEOGRAPHY } from './map-geometry.mjs?v=31';
import {CONTINENT_PATH,NATIONAL_BORDERS} from './continent-geometry.mjs?v=31';
import {buildCountryAppearance} from './atlas-state.mjs?v=31';
import { ATLAS_FEATURES } from './atlas-relief.mjs?v=31';

export { ATLAS_FEATURES } from './atlas-relief.mjs?v=31';

const NS = 'http://www.w3.org/2000/svg';
const n = (tag, attrs = {}, text = '') => {
  const item = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  if (text) item.textContent = text;
  return item;
};
const paths = (parent, list, className) => list?.forEach((d) => parent.append(n('path', { d, class: className })));

function addDefs(svg) {
  const defs = n('defs');
  defs.innerHTML = '<radialGradient id="map-ocean"><stop stop-color="var(--map-card)"/><stop offset="1" stop-color="var(--ocean)"/></radialGradient><linearGradient id="atlas-shelf" x2="0" y2="1"><stop stop-color="var(--map-water)" stop-opacity=".22"/><stop offset="1" stop-color="var(--map-water)" stop-opacity="0"/></linearGradient><pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="var(--map-grid)" stroke-width=".65"/></pattern><pattern id="map-grain" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="3" cy="6" r=".7" fill="var(--ocean)" opacity=".13"/></pattern><marker id="map-trade-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill="context-stroke"/></marker>';
  for (const id of COUNTRY_IDS) {
    const clip = n('clipPath', { id: `atlas-clip-${id}`, clipPathUnits: 'userSpaceOnUse' });
    clip.append(n('path', { d: GEOGRAPHY[id].land }));
    defs.append(clip);
  }
  svg.append(defs);
}

function addOcean(svg) {
  svg.append(n('rect', { width: 900, height: 620, fill: 'url(#map-ocean)' }));
  svg.append(n('path', { d: 'M0 118C180 94 298 139 449 111S728 83 900 121V0H0ZM0 488C179 518 309 477 452 506s285 41 448-2v116H0Z', class: 'atlas-ocean-depth' }));
  paths(svg, [
    'M12 173C145 145 271 183 388 157S641 128 884 171',
    'M21 352C173 326 285 366 422 342S689 314 881 350',
    'M31 535C195 506 323 548 475 526S727 496 870 523',
  ], 'atlas-depth-line');
  svg.append(n('rect', { width: 900, height: 620, fill: 'url(#map-grid)' }));

}

function addTerrain(parent, id) {
  const feature = ATLAS_FEATURES[id];
  const terrain = n('g', { class: `atlas-terrain is-${feature.biome}`, 'clip-path': `url(#atlas-clip-${id})`, 'aria-hidden': 'true' });
  terrain.append(n('image', {href:'terrain-relief-v22.webp',x:-GEOGRAPHY[id].x,y:-GEOGRAPHY[id].y,width:900,height:620,preserveAspectRatio:'xMidYMid slice',class:'atlas-material'}));
  paths(terrain, feature.relief, 'atlas-relief');
  paths(terrain, feature.contours, 'atlas-contour');
  paths(terrain, feature.ridges, 'atlas-ridge');
  paths(terrain, feature.rivers, 'atlas-river');
  paths(terrain, feature.dryRivers, 'atlas-dry-river');
  paths(terrain, feature.channels, 'atlas-channel');
  paths(terrain, feature.farms, 'atlas-farm');
  feature.lakes?.forEach(([cx,cy,rx,ry]) => terrain.append(n('ellipse', { cx, cy, rx, ry, class: 'atlas-lake' })));
  parent.append(terrain);
}

function addCountry(layer, id) {
  const geo = GEOGRAPHY[id];
  const feature = ATLAS_FEATURES[id];
  const group = n('g', { class: 'land', 'data-country': id, transform: `translate(${geo.x} ${geo.y})`, role: 'button', tabindex: 0 });
  group.append(n('path', { d: geo.land, fill: `var(--${id})`, class: 'map-country-shape' }));
  group.append(n('path', { d: geo.land, fill: 'url(#map-grain)', class: 'map-grain' }));
  addTerrain(group, id);
  group.append(n('path',{d:geo.land,class:'country-condition-wash','aria-hidden':'true'}));
  buildCountryAppearance(group,id);
  group.append(n('path',{d:geo.land,class:'country-focus-ring','aria-hidden':'true'}));
  group.append(n('text', { y: feature.labelY, 'text-anchor': 'middle', class: 'country-name' }, COUNTRIES[id].name));
  group.append(n('text', { y: feature.labelY + 22, 'text-anchor': 'middle', class: 'country-role' }, COUNTRIES[id].roleLabel));
  group.append(n('text', { y: feature.labelY + 43, 'text-anchor': 'middle', class: 'map-land-food', id: `map-food-${id}` }));
  group.append(n('rect', { x: -44, y: 43, width: 88, height: 5, rx: 2.5, class: 'map-food-track' }));
  group.append(n('rect', { x: -44, y: 43, width: 0, height: 5, rx: 2.5, class: 'map-food-bar', id: `map-bar-${id}` }));
  group.append(n('text', { y: 58, 'text-anchor': 'middle', class: 'map-facility-label', id: `map-infrastructure-${id}` }));
  layer.append(group);
}

function addForeground(svg) {
  const foreground = n('g', { id: 'map-live-foreground', 'aria-hidden': 'true' });
  for (const id of COUNTRY_IDS) {
    const geo = GEOGRAPHY[id];
    const request = n('g', { id: `map-request-${id}`, class: 'map-request-badge', transform: `translate(${geo.x + 48} ${geo.y - 63})` });
    request.append(n('rect', { x: -2, y: -18, width: 65, height: 27, rx: 4 }));
    request.append(n('text', { x: 30, y: 1, 'text-anchor': 'middle', id: `map-request-count-${id}` }));
    foreground.append(request);
  }
  const weather = n('g', { transform: 'translate(32 31)', class: 'map-climate' });
  weather.append(n('text', { id: 'map-climate-title', class: 'map-climate-title' }));
  weather.append(n('text', { y: 23, id: 'map-climate-detail', class: 'map-climate-detail' }));
  foreground.append(weather);
  foreground.append(n('text', { x: 868, y: 31, 'text-anchor': 'end', class: 'map-climate-title', id: 'map-action-count' }));
  foreground.append(n('text', { x: 868, y: 600, 'text-anchor': 'end', class: 'map-coordinates', id: 'map-record-period' }));
  svg.append(foreground);
}

export function buildAtlas(svg) {
  if (svg.querySelector('#map-country-layer')) return;
  svg.setAttribute('viewBox', '0 0 900 620');
  svg.replaceChildren();
  addDefs(svg);
  addOcean(svg);
  const coast=n('g',{class:'continent-coast','aria-hidden':'true'});
  coast.append(n('path',{d:CONTINENT_PATH,class:'continent-shelf'}));
  coast.append(n('path',{d:CONTINENT_PATH,class:'continent-outline'}));
  svg.append(coast);
  const countries = n('g', { id: 'map-country-layer' });
  for (const id of COUNTRY_IDS) addCountry(countries, id);
  svg.append(countries);
  const borders=n('g',{id:'map-frontier-layer','aria-hidden':'true'});
  for(const border of NATIONAL_BORDERS){borders.append(n('path',{d:border.d,class:'national-frontier-underlay'}));borders.append(n('path',{d:border.d,class:'national-frontier','data-countries':border.countries.join(':')}));}
  svg.append(borders);
  svg.append(n('g', { id: 'map-route-layer', class: 'trade-routes', 'aria-hidden': 'true' }));
  addForeground(svg);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {createGame, advanceTurn} from '../dist/engine.mjs';
import {COUNTRY_IDS} from '../dist/country-data.mjs';
import {GEOGRAPHY} from '../dist/map-geometry.mjs';
import {MAP_SITE_POSITIONS, SITE_KINDS, mapSiteModels, updateMapSites} from '../dist/map-sites.mjs';

class SvgElement {
  constructor() { this.attributes = new Map(); this.children = []; this.listeners = new Map(); this.textContent = ''; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) {
    for (const child of children) {
      const prior = this.children.indexOf(child);
      if (prior >= 0) this.children.splice(prior, 1);
      this.children.push(child);
    }
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  matches(selector) {
    const id = selector.match(/^#([\w-]+)$/)?.[1];
    if (id) return this.getAttribute('id') === id;
    const className = selector.match(/^\.([\w-]+)/)?.[1];
    if (className && !this.getAttribute('class')?.split(/\s+/).includes(className)) return false;
    return [...selector.matchAll(/\[([\w-]+)="([^"]+)"\]/g)].every(([, name, value]) => this.getAttribute(name) === value);
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

test('map exposes city, coastal port and farm positions for all six countries', () => {
  const positions = COUNTRY_IDS.flatMap((countryId) => SITE_KINDS.map((kind) => MAP_SITE_POSITIONS[countryId][kind]));
  assert.equal(positions.length, 18);
  for (const [index, countryId] of COUNTRY_IDS.entries()) {
    const port = MAP_SITE_POSITIONS[countryId].port;
    assert.deepEqual(port, {x: GEOGRAPHY[countryId].x + GEOGRAPHY[countryId].port[0], y: GEOGRAPHY[countryId].y + GEOGRAPHY[countryId].port[1]});
    assert.ok(port.x >= 40 && port.x <= 860 && port.y >= 35 && port.y <= 590, `${countryId} port remains inside the map margin`);
    assert.equal(new Set(SITE_KINDS.map((kind) => JSON.stringify(MAP_SITE_POSITIONS[countryId][kind]))).size, 3, `country ${index + 1} sites do not overlap`);
  }
});

test('site models keep foreign local levels unknown and expose only the selected exact target', () => {
  const state = createGame('marin');
  const models = mapSiteModels(state, {countryId: 'marin', kind: 'port'});
  assert.equal(models.length, 18);
  assert.deepEqual(models.filter((model) => model.selected).map(({countryId, kind}) => [countryId, kind]), [['marin', 'port']]);
  assert.equal(models.filter((model) => model.view.owned).length, 3);
  assert.ok(models.filter((model) => !model.view.owned).every((model) => model.view.level === null));
  assert.ok(models.filter((model) => !model.view.owned).every((model) => Number.isFinite(model.view.aggregateInfrastructure)));
});

test('site models reflect actual local construction rather than national appearance art', () => {
  const state = advanceTurn(createGame('marin'), 'site:farm:upgrade');
  const farm = mapSiteModels(state).find((model) => model.countryId === 'marin' && model.kind === 'farm');
  const city = mapSiteModels(state).find((model) => model.countryId === 'marin' && model.kind === 'city');
  assert.equal(farm.view.stage, 'started');
  assert.equal(farm.view.remaining, 2);
  assert.equal(city.view.stage, 'idle');
  assert.equal(city.view.project, null);
});

test('map updater mounts and refreshes exactly eighteen top-level interactive site targets', () => {
  const previous = globalThis.document;
  globalThis.document = {createElementNS: () => new SvgElement()};
  try {
    const svg = new SvgElement();
    const state = createGame('lumen');
    const layer = updateMapSites(svg, state, {countryId: 'lumen', kind: 'city'});
    assert.equal(layer.children.length, 18);
    assert.equal(svg.children.at(-1), layer);
    const city = layer.querySelector('.map-site-target[data-country="lumen"][data-site="city"]');
    assert.equal(city.getAttribute('role'), 'button');
    assert.equal(city.getAttribute('tabindex'), '0');
    assert.equal(city.getAttribute('data-action'), 'open-facility');
    assert.equal(city.getAttribute('aria-pressed'), 'true');
    assert.equal(city.getAttribute('data-level'), '0');
    assert.equal(city.getAttribute('data-food-status'), 'secure');
    assert.equal(city.getAttribute('data-national-level'), '0');
    assert.match(city.getAttribute('aria-label'), /루멘 도시 생활권, 0단계/);
    updateMapSites(svg, state, {countryId: 'cera', kind: 'port'});
    assert.equal(layer.children.length, 18);
    assert.equal(city.getAttribute('aria-pressed'), 'false');
  } finally {
    globalThis.document = previous;
  }
});

test('render contract uses a separate keyboard-operable top layer with 44-unit hit targets', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('../dist/map-sites.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/map-sites.css', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /id: 'map-site-layer'/);
  assert.match(source, /'data-action': 'open-facility'/);
  assert.match(source, /role: 'button', tabindex: '0'/);
  assert.match(source, /r: 22/);
  assert.match(source, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(source, /buildMapSiteScene/);
  assert.match(source, /data-national-level/);
  assert.match(source, /data-food-status/);
  assert.match(css, /\.map-site-target:focus-visible \.map-site-ring/);
  assert.match(css, /\.map-site-ring,[\s\S]*fill: none/s);
  assert.match(css, /\.map-site-raster\s*\{[\s\S]*drop-shadow/s);
  assert.match(css, /\.map-site-workcrane/);
  assert.match(css, /data-camera-zoom="2"[\s\S]*\.map-state-summary[\s\S]*display: none !important/);
});

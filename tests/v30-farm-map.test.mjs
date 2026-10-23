import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';

import {createGame} from '../dist/engine.mjs';
import {COUNTRY_IDS} from '../dist/country-data.mjs';
import {FARM_LANDSCAPE_ASSETS, buildFarmScene, updateFarmScene} from '../dist/farm-map.mjs';
import {mapSiteModels, updateMapSites} from '../dist/map-sites.mjs';

class SvgElement {
  constructor(tag = 'g', attributes = {}) {
    this.tag = tag;
    this.attributes = new Map(Object.entries(attributes).map(([name, value]) => [name, String(value)]));
    this.children = [];
    this.listeners = new Map();
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) {
    for (const child of children) {
      const prior = this.children.indexOf(child);
      if (prior >= 0) this.children.splice(prior, 1);
      this.children.push(child);
    }
  }
  insertBefore(child, anchor) {
    const prior = this.children.indexOf(child);
    if (prior >= 0) this.children.splice(prior, 1);
    const index = this.children.indexOf(anchor);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
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

const make = (tag, attributes = {}) => new SvgElement(tag, attributes);
const descendants = (root) => root.children.flatMap((child) => [child, ...descendants(child)]);
const landscape = (overrides = {}) => ({
  countryId: 'lumen', phase: 'healthy', severity: 0, reason: 'no-drought-observed',
  droughtStartTurn: null, lastDroughtTurn: null, recoveryElapsed: null,
  climateImpact: null, climateEvent: null, stockPressure: false, climateCueOnly: true,
  infrastructure: {siteLevel: 0, nationalLevel: 0, siteProject: null, siteDueTurn: null, nationalProject: null, nationalDueTurn: null, stage: 'idle', irrigated: false, expanded: false},
  ...overrides,
});

test('Given climate phases When farm scenes render Then each uses its real transparent landscape asset', async () => {
  assert.deepEqual(FARM_LANDSCAPE_ASSETS, {
    healthy: 'farm-healthy-v30.webp', drought: 'farm-drought-v30.webp', recovering: 'farm-recovering-v30.webp',
    expansion: 'farm-expansion-v30.webp',
  });
  await access(new URL(`../dist/${FARM_LANDSCAPE_ASSETS.expansion}`, import.meta.url));
  for (const [phase, file] of Object.entries(FARM_LANDSCAPE_ASSETS).filter(([key]) => key !== 'expansion')) {
    await access(new URL(`../dist/${file}`, import.meta.url));
    const scene = buildFarmScene(make, 'lumen');
    updateFarmScene(scene, landscape({phase}));
    const base = scene.querySelector('.farm-landscape-base');
    assert.equal(base.getAttribute('href'), file);
    assert.equal(base.getAttribute('width'), '100');
    assert.equal(base.getAttribute('height'), '72');
    assert.equal(scene.getAttribute('aria-hidden'), 'true');
  }
});

test('Given completed farm levels When scene updates Then parcels, canals and service paths accumulate by actual level', () => {
  const scene = buildFarmScene(make, 'cera');
  updateFarmScene(scene, landscape({countryId: 'cera', infrastructure: {...landscape().infrastructure, siteLevel: 3, irrigated: true, expanded: true}}));
  assert.equal(scene.getAttribute('data-farm-level'), '3');
  assert.equal(descendants(scene).filter((node) => node.getAttribute('class')?.includes('farm-parcel')).length, 3);
  assert.equal(descendants(scene).filter((node) => node.getAttribute('class')?.includes('farm-expansion')).length, 3);
  assert.ok(scene.querySelector('.farm-irrigation'));
  assert.ok(scene.querySelector('.farm-service-path'));
  assert.equal(scene.querySelector('.farm-planned-works').getAttribute('aria-hidden'), 'true');
});

test('Given a pending upgrade When scene updates Then unfinished soil works show without granting the next completed level', () => {
  const scene = buildFarmScene(make, 'marin');
  updateFarmScene(scene, landscape({countryId: 'marin', infrastructure: {...landscape().infrastructure, siteLevel: 1, siteProject: {level: 2}, siteDueTurn: 4, stage: 'building'}}));
  assert.equal(scene.getAttribute('data-farm-level'), '1');
  assert.equal(scene.getAttribute('data-farm-building'), 'true');
  assert.equal(scene.getAttribute('data-planned-level'), '2');
  assert.equal(scene.getAttribute('data-national-irrigation-building'), 'false');
  assert.equal(scene.querySelector('.farm-survey-line').getAttribute('d').includes('M-38-27 43 26'), false);
});

test('Given actual national irrigation When Lumen builds and completes Then trenches precede completed water channels', () => {
  const scene = buildFarmScene(make, 'lumen');
  updateFarmScene(scene, landscape({infrastructure: {...landscape().infrastructure, nationalLevel: 0, nationalProject: {dueTurn: 3}, nationalDueTurn: 3}}));
  assert.equal(scene.getAttribute('data-national-irrigation-building'), 'true');
  assert.equal(scene.getAttribute('data-national-farm-level'), '0');
  assert.equal(scene.getAttribute('data-farm-building'), 'false');
  assert.ok(scene.querySelector('.farm-national-trench'));
  assert.equal(descendants(scene).filter((node) => node.getAttribute('class')?.includes('farm-national-channel')).length, 3);

  updateFarmScene(scene, landscape({infrastructure: {...landscape().infrastructure, nationalLevel: 1, nationalProject: null, irrigated: true}}));
  assert.equal(scene.getAttribute('data-national-irrigation-building'), 'false');
  assert.equal(scene.getAttribute('data-national-farm-level'), '1');
});

test('Given nonagricultural national investment When farm art updates Then it never fabricates irrigation', () => {
  const altia = buildFarmScene(make, 'altia');
  updateFarmScene(altia, landscape({countryId: 'altia', infrastructure: {...landscape().infrastructure, nationalLevel: 3, nationalProject: {dueTurn: 4}, irrigated: true}}));
  assert.equal(altia.getAttribute('data-national-irrigation-building'), 'false');
  assert.equal(altia.getAttribute('data-national-farm-level'), '0');

  const solis = buildFarmScene(make, 'solis');
  updateFarmScene(solis, landscape({countryId: 'solis', infrastructure: {...landscape().infrastructure, nationalLevel: 2, nationalProject: null, irrigated: true}}));
  assert.equal(solis.getAttribute('data-national-farm-level'), '2');
});

test('Given identical climate history When only food stock falls Then the farm bitmap phase does not become drought', () => {
  const normal = createGame('lumen');
  const pressured = structuredClone(normal);
  pressured.countries.lumen.food = 1;
  const normalFarm = mapSiteModels(normal).find(({countryId, kind}) => countryId === 'lumen' && kind === 'farm');
  const pressuredFarm = mapSiteModels(pressured).find(({countryId, kind}) => countryId === 'lumen' && kind === 'farm');
  assert.equal(normalFarm.landscape.phase, 'healthy');
  assert.equal(pressuredFarm.landscape.phase, normalFarm.landscape.phase);
  assert.equal(pressuredFarm.landscape.stockPressure, true);
});

test('Given the existing strategic map When sites mount Then all eighteen controls remain and only farms use the new scene', () => {
  const previous = globalThis.document;
  globalThis.document = {createElementNS: (_ns, tag) => new SvgElement(tag)};
  try {
    const svg = new SvgElement('svg');
    const countries = new SvgElement('g', {id: 'map-country-layer'});
    for (const countryId of COUNTRY_IDS) {
      const country = new SvgElement('g', {class: 'land', 'data-country': countryId});
      country.append(new SvgElement('g', {class: 'atlas-country-appearance'}), new SvgElement('path', {class: 'country-focus-ring'}), new SvgElement('text', {class: 'country-name'}));
      countries.append(country);
    }
    const frontier = new SvgElement('g', {id: 'map-frontier-layer'});
    svg.append(countries, frontier);
    const state = createGame('lumen');
    const layer = updateMapSites(svg, state, {countryId: 'lumen', kind: 'farm'});
    assert.equal(layer.children.length, 18);
    assert.equal(layer.querySelector('.map-site-target[data-country="lumen"][data-site="farm"]').getAttribute('aria-pressed'), 'true');
    assert.match(layer.querySelector('.map-site-target[data-country="lumen"][data-site="farm"]').getAttribute('aria-label'), /0단계, 관측된 가뭄 없음/);
    const lumenCountry = svg.querySelector('.land[data-country="lumen"]');
    const lumenClip = lumenCountry.querySelector('.farm-landscape-clip[data-country="lumen"]');
    assert.equal(lumenClip.getAttribute('clip-path'), 'url(#atlas-clip-lumen)');
    assert.equal(lumenClip.querySelector('.farm-landscape[data-country="lumen"]').getAttribute('transform'), 'translate(-35 100)');
    assert.equal(lumenClip.querySelector('.farm-landscape[data-country="lumen"]').getAttribute('data-selected'), 'true');
    assert.equal(lumenCountry.children.indexOf(lumenClip) < lumenCountry.children.indexOf(lumenCountry.querySelector('.atlas-country-appearance')), true);
    assert.equal(layer.querySelector('.map-site-target[data-country="lumen"][data-site="farm"]').querySelector('.farm-landscape'), null);
    assert.equal(COUNTRY_IDS.filter((countryId) => {
      const country = svg.querySelector(`.land[data-country="${countryId}"]`);
      const clip = country.querySelector(`.farm-landscape-clip[data-country="${countryId}"]`);
      return clip && country.children.indexOf(clip) < country.children.indexOf(country.querySelector('.country-name'));
    }).length, 6);
    updateMapSites(svg, state, {countryId: 'altia', kind: 'farm'});
    assert.equal(lumenClip.querySelector('.farm-landscape').getAttribute('data-selected'), 'false');
    assert.equal(svg.querySelector('.farm-landscape[data-country="altia"]').getAttribute('data-selected'), 'true');
    assert.equal(COUNTRY_IDS.filter((countryId) => svg.querySelector(`.farm-landscape-clip[data-country="${countryId}"]`)).length, 6);
    assert.ok(layer.querySelector('.map-site-scene'));
    assert.equal(layer.querySelector('.map-site-target[data-country="lumen"][data-site="city"]').querySelector('.map-site-label').getAttribute('y'), '35');
    assert.equal(layer.querySelector('.map-site-target[data-country="marin"][data-site="farm"]').querySelector('.map-site-label').getAttribute('y'), '-51');
    assert.equal(mapSiteModels(state).filter(({landscape}) => landscape).length, 6);
  } finally {
    globalThis.document = previous;
  }
});

test('Given farm climate art When styles are inspected Then food stock does not drive drought and planned works stay distinct', async () => {
  const [source, css, oldCss] = await Promise.all([
    readFile(new URL('../dist/map-sites.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/farm-map.css', import.meta.url), 'utf8'),
    readFile(new URL('../dist/map-sites.css', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /farmLandscape\(state, countryId\)/);
  assert.match(source, /buildFarmScene/);
  assert.match(source, /updateFarmScene/);
  assert.doesNotMatch(css, /food-status/);
  assert.doesNotMatch(oldCss, /\.map-site-farm\[data-food-status/);
  assert.match(css, /data-farm-building="true"/);
  assert.match(css, /data-recovery-elapsed="3"/);
  assert.match(css, /data-farm-phase="drought"\] \.farm-expansion/);
  assert.match(css, /data-recovery-elapsed="1"\] \.farm-expansion/);
  assert.match(css, /data-national-irrigation-building="true"/);
  assert.match(css, /data-national-farm-level="3"/);
  assert.match(css, /\.farm-parcel/);
  assert.match(css, /pointer-events:\s*none/);
});

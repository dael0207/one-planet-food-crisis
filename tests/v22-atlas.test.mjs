import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_FEATURES, buildAtlas } from '../dist/atlas-art.mjs';
import { GEOGRAPHY, routeGeometry } from '../dist/map-geometry.mjs';

const IDS = ['lumen', 'nord', 'cera', 'altia', 'marin', 'solis'];
const ANCHORS = {
  lumen: [180, 250], nord: [470, 145], cera: [720, 250],
  altia: [190, 475], marin: [475, 440], solis: [740, 475],
};

class FakeNode {
  constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  querySelector(selector) {
    const id = selector.startsWith('#') ? selector.slice(1) : null;
    return this.descendants().find((item) => id && item.attributes.id === id) ?? null;
  }
  descendants() { return this.children.flatMap((item) => [item, ...item.descendants()]); }
  set innerHTML(value) { this.html = value; }
}

const renderAtlas = () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new FakeNode(tag) };
  try {
    const svg = new FakeNode('svg');
    buildAtlas(svg);
    return { svg, all: svg.descendants() };
  } finally {
    globalThis.document = previousDocument;
  }
};

test('Atlas request labels stay above every country terrain and obsolete factory glyphs are absent', () => {
  const {svg, all} = renderAtlas();
  const foreground = svg.querySelector('#map-live-foreground');
  for (const id of IDS) {
    assert.ok(foreground.querySelector(`#map-request-${id}`), `${id} request belongs in foreground`);
    const land = all.find((item) => item.attributes['data-country'] === id);
    assert.equal(land.querySelector(`#map-request-${id}`), null);
  }
  assert.equal(all.some((item) => ['atlas-industry', 'atlas-harbor'].includes(item.attributes.class)), false);
});

test('V22 keeps route anchors while coastlines are predominantly authored curves', () => {
  for (const id of IDS) {
    const { x, y, land } = GEOGRAPHY[id];
    assert.deepEqual([x, y], ANCHORS[id]);
    assert.ok((land.match(/[CQST]/g) ?? []).length >= 6, `${id} needs a continuous curved coast`);
    assert.ok((land.match(/L/g) ?? []).length <= 1, `${id} still has a cut-paper polygon coast`);
  }
  for (const target of IDS.slice(1)) assert.ok(routeGeometry('lumen', target)?.d);
});

test('V22 terrain uses clipped relief masses and geographic waterways without tree glyph repetition', () => {
  for (const id of IDS) {
    const feature = ATLAS_FEATURES[id];
    assert.ok(feature.relief?.length >= 2, `${id} needs broad shaded relief`);
    assert.ok(feature.contours?.length >= 2, `${id} needs landform contours`);
    assert.ok(feature.capital?.length === 2 && GEOGRAPHY[id].port?.length === 2);
  }
  assert.ok(ATLAS_FEATURES.lumen.rivers.length >= 2);
  assert.ok(ATLAS_FEATURES.cera.rivers.length >= 1);
  assert.ok(ATLAS_FEATURES.altia.lakes.length >= 2);
  assert.ok(ATLAS_FEATURES.marin.channels.length >= 2);
  assert.ok(ATLAS_FEATURES.solis.dryRivers.length >= 1);

  const { all } = renderAtlas();
  assert.equal(all.filter((item) => item.attributes.class === 'atlas-material').length, 6);
  assert.equal(all.some((item) => ['atlas-relief','atlas-river','atlas-lake'].includes(item.attributes.class)), false, 'waterways and relief belong to the shared terrain material rather than floating glyphs');
  assert.equal(all.some((item) => item.attributes.class === 'atlas-tree'), false);
});

test('V22 settlements stay outside the central country name and food reading band', () => {
  for (const id of IDS) {
    const feature = ATLAS_FEATURES[id];
    const halfWidth = 60;
    const top = feature.labelY - 24;
    const bottom = feature.labelY + 52;
    for (const [kind, point] of [['capital', feature.capital], ['port', GEOGRAPHY[id].port]]) {
      const [x, y] = point;
      const overlaps = Math.abs(x) < halfWidth && y > top && y < bottom;
      assert.equal(overlaps, false, `${id} ${kind} overlaps the live label band`);
    }
  }
});

test('V22 preserves all live countries, labels, state overlays and route insertion points', () => {
  const { svg, all } = renderAtlas();
  const lands = all.filter((item) => item.attributes.class === 'land');
  assert.deepEqual(lands.map((item) => item.attributes['data-country']), IDS);
  assert.ok(lands.every((item) => item.attributes.role === 'button' && item.attributes.tabindex === '0'));
  for (const id of IDS) {
    assert.ok(all.some((item) => item.attributes.id === `map-food-${id}`));
    assert.ok(all.some((item) => item.attributes.id === `map-bar-${id}`));
    assert.ok(all.some((item) => item.attributes.id === `map-infrastructure-${id}`));
    assert.ok(all.some((item) => item.attributes.id === `map-request-${id}`));
    assert.ok(all.some((item) => item.attributes.id === `map-request-count-${id}`));
  }
  for(const id of IDS){
    const terrain=all.find(item=>item.attributes['clip-path']===`url(#atlas-clip-${id})`);
    assert.ok(terrain.children.some(item=>item.tag==='image'&&item.attributes.href==='terrain-relief-v35.webp'));
  }
  const countryIndex = svg.children.findIndex((item) => item.attributes.id === 'map-country-layer');
  const facilityIndex = svg.children.findIndex((item) => item.attributes.id === 'map-frontier-layer');
  const routeIndex = svg.children.findIndex((item) => item.attributes.id === 'map-route-layer');
  const foregroundIndex = svg.children.findIndex((item) => item.attributes.id === 'map-live-foreground');
  assert.ok(countryIndex < facilityIndex && facilityIndex < routeIndex && routeIndex < foregroundIndex);
});

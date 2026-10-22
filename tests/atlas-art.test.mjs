import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_FEATURES, buildAtlas } from '../dist/atlas-art.mjs';
import { CONTINENT_PATH, GEOGRAPHY, NATIONAL_BORDERS, routeGeometry } from '../dist/map-geometry.mjs';

const IDS = ['lumen', 'nord', 'cera', 'altia', 'marin', 'solis'];
const ANCHORS = {
  lumen: [180, 250], nord: [470, 145], cera: [720, 250],
  altia: [190, 475], marin: [475, 440], solis: [740, 475],
};

test('atlas preserves operational route anchors across six curved contiguous territories', () => {
  for (const id of IDS) {
    assert.deepEqual([GEOGRAPHY[id].x, GEOGRAPHY[id].y], ANCHORS[id]);
    assert.match(GEOGRAPHY[id].land, /^M.*C.*Z$/);
  }
  assert.equal(new Set(IDS.map((id) => GEOGRAPHY[id].land)).size, 6);
  assert.equal(new Set(IDS.map((id) => routeGeometry('lumen', id)?.d).filter(Boolean)).size, 5);
  assert.match(CONTINENT_PATH, /^M.*C.*Z$/);
  assert.equal(NATIONAL_BORDERS.length, 9);
});

test('country territory coordinates remain bounded inside the 900 by 620 atlas', () => {
  for (const id of IDS) {
    const values = [...GEOGRAPHY[id].land.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
    const [x, y] = ANCHORS[id];
    const points = Array.from({ length: values.length / 2 }, (_, index) => [values[index * 2] + x, values[index * 2 + 1] + y]);
    assert.ok(points.every(([px, py]) => px >= 40 && px <= 860 && py >= 40 && py <= 590), `${id} leaves the atlas land bounds`);
  }
});

test('six terrain identities expose clipped cartographic features and settlements', () => {
  assert.deepEqual(IDS.map((id) => ATLAS_FEATURES[id].biome), [
    'river-plain', 'northern-ridges', 'grain-plains',
    'alpine-lakes', 'archipelago-harbor', 'savanna-dryriver',
  ]);
  for (const id of IDS) {
    const feature = ATLAS_FEATURES[id];
    assert.equal(feature.capital.length, 2);
    assert.ok(feature.contours.length >= 2);
  }
  assert.ok(ATLAS_FEATURES.lumen.rivers.length >= 2);
  assert.ok(ATLAS_FEATURES.nord.ridges.length >= 3);
  assert.ok(ATLAS_FEATURES.cera.farms.length >= 4);
  assert.ok(ATLAS_FEATURES.altia.lakes.length >= 2 && ATLAS_FEATURES.altia.ridges.length >= 3);
  assert.ok(ATLAS_FEATURES.marin.channels.length >= 2);
  assert.ok(ATLAS_FEATURES.solis.dryRivers.length);
});

test('fixed country ids produce unique terrain clip-path identifiers', () => {
  const clips = IDS.map((id) => `atlas-clip-${id}`);
  assert.equal(new Set(clips).size, IDS.length);
  assert.ok(clips.every((id) => /^atlas-clip-[a-z]+$/.test(id)));
});

test('atlas builder keeps terrain clipped below the reusable live route layer', () => {
  class FakeNode {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = [...items]; }
    querySelector(selector) {
      const id = selector.startsWith('#') ? selector.slice(1) : null;
      return [...this.children].flatMap(function walk(item) { return [item, ...item.children.flatMap(walk)]; })
        .find((item) => id && item.attributes.id === id) ?? null;
    }
    set innerHTML(value) { this.html = value; }
  }
  const previousDocument = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new FakeNode(tag) };
  try {
    const svg = new FakeNode('svg');
    buildAtlas(svg);
    const all = svg.children.flatMap(function walk(item) { return [item, ...item.children.flatMap(walk)]; });
    assert.equal(all.filter((item) => item.attributes.class === 'land').length, 6);
    assert.equal(all.filter((item) => item.tag === 'clipPath').length, 6);
    assert.equal(all.filter((item) => item.attributes.class?.startsWith('atlas-terrain')).length, 6);
    const countryIndex = svg.children.findIndex((item) => item.attributes.id === 'map-country-layer');
    const routeIndex = svg.children.findIndex((item) => item.attributes.id === 'map-route-layer');
    assert.ok(routeIndex > countryIndex);
    assert.equal(svg.children.at(-1).attributes.id, 'map-live-foreground');
  } finally {
    globalThis.document = previousDocument;
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';

import {createGame, advanceTurn} from '../dist/engine.mjs';
import {MAP_SITE_ASSETS, PORT_ROTATIONS, buildMapSiteScene} from '../dist/map-art.mjs';
import {mapSiteModels} from '../dist/map-sites.mjs';

class Node {
  constructor(tag, attributes = {}) { this.tag = tag; this.attributes = new Map(Object.entries(attributes).map(([key, value]) => [key, String(value)])); this.children = []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  append(...children) { this.children.push(...children); }
}

const make = (tag, attributes = {}) => new Node(tag, attributes);
const descendants = (root) => root.children.flatMap((child) => [child, ...descendants(child)]);

test('V34 uses three real transparent orthographic map scene assets as decorative SVG images', async () => {
  assert.deepEqual(MAP_SITE_ASSETS, {city: 'map-city-v34.webp', port: 'map-port-v34.webp', farm: 'farm-healthy-v34.webp'});
  for (const [kind, file] of Object.entries(MAP_SITE_ASSETS)) {
    await access(new URL(`../dist/${file}`, import.meta.url));
    const scene = buildMapSiteScene(make, kind);
    const image = descendants(scene).find((item) => item.tag === 'image');
    assert.equal(image.attributes.get('href'), file);
    assert.equal(scene.attributes.get('aria-hidden'), 'true');
    assert.equal(image.attributes.get('aria-hidden'), undefined);
    assert.equal(image.attributes.get('preserveAspectRatio'), 'xMidYMid meet');
    assert.ok(Number(image.attributes.get('width')) >= 70 && Number(image.attributes.get('width')) <= 88);
  }
});

test('V28 turns the decorative quay toward each real coast without moving its hit target', () => {
  assert.deepEqual(PORT_ROTATIONS, {lumen: 180, nord: -90, cera: 0, altia: 90, marin: 90, solis: 0});
  for (const [countryId, rotation] of Object.entries(PORT_ROTATIONS)) {
    const scene = buildMapSiteScene(make, 'port', countryId);
    assert.equal(scene.attributes.get('data-coast-rotation'), String(rotation));
    assert.equal(scene.children[0].attributes.get('transform'), `rotate(${rotation})`);
  }
});

test('V28 scene growth follows canonical local tiers while foreign tiers remain unknown', () => {
  const opening = mapSiteModels(createGame('lumen'));
  assert.ok(opening.filter(({countryId}) => countryId !== 'lumen').every(({view}) => view.level === null));
  const state = advanceTurn(advanceTurn(advanceTurn(createGame('lumen'), 'site:city:upgrade'), 'maintain'), 'maintain');
  const models = mapSiteModels(state);
  assert.equal(models.find(({countryId, kind}) => countryId === 'lumen' && kind === 'city').view.level, 1);
  assert.ok(models.every(({appearance}) => ['critical', 'strained', 'secure'].includes(appearance.foodStatus)));
});

test('V28 removes duplicate settlement glyphs and giant crossed scaffolds', async () => {
  const [atlas, state, sites] = await Promise.all([
    readFile(new URL('../dist/atlas-art.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/atlas-state.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/map-sites.mjs', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(atlas, /atlas-settlement|addSettlement/);
  assert.doesNotMatch(state, /atlas-state-town|atlas-state-farm|atlas-state-scaffold/);
  assert.doesNotMatch(sites, /M-18 13V-15H18V13|map-site-scaffold/);
});

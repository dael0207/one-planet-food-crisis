import test from 'node:test';
import assert from 'node:assert/strict';

import {COUNTRY_IDS} from '../dist/country-data.mjs';
import {createGame} from '../dist/engine.mjs';
import {GEOGRAPHY,CONTINENT_PATH} from '../dist/map-geometry.mjs';
import {PORT_ROTATIONS} from '../dist/map-art.mjs';
import {MAP_SITE_POSITIONS, updateMapSites} from '../dist/map-sites.mjs';

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
  querySelectorAll(selector) { return descendants(this).filter(child=>child.matches(selector)); }
}

function atlasFixture() {
  const svg = new SvgElement('svg');
  const countries = new SvgElement('g', {id: 'map-country-layer'});
  for (const countryId of COUNTRY_IDS) {
    const country = new SvgElement('g', {class: 'land', 'data-country': countryId});
    country.append(
      new SvgElement('path', {class: 'country-condition-wash'}),
      new SvgElement('g', {class: 'atlas-country-appearance'}),
      new SvgElement('path', {class: 'country-focus-ring'}),
      new SvgElement('text', {class: 'country-name'}),
    );
    countries.append(country);
  }
  svg.append(countries, new SvgElement('g', {id: 'map-frontier-layer'}), new SvgElement('g', {id: 'map-route-layer'}));
  return svg;
}

const descendants = (root) => root.children.flatMap((child) => [child, ...descendants(child)]);

test('Given mounted facilities When the top interaction layer is inspected Then it contains no raster site art', () => {
  const previous = globalThis.document;
  globalThis.document = {createElementNS: (_namespace, tag) => new SvgElement(tag)};
  try {
    const svg = atlasFixture();
    const layer = updateMapSites(svg, createGame('lumen'));
    assert.equal(layer.children.length, 18);
    assert.equal(layer.querySelector('.map-site-scene'), null);
    assert.equal(layer.querySelector('.map-site-raster'), null);
    assert.equal(descendants(layer).some((node) => node.tag === 'image'), false);
  } finally {
    globalThis.document = previous;
  }
});

test('Given a country When grounded facilities mount Then roads sit below clipped city art and the coast-facing port', () => {
  const previous = globalThis.document;
  globalThis.document = {createElementNS: (_namespace, tag) => new SvgElement(tag)};
  try {
    const svg = atlasFixture();
    updateMapSites(svg, createGame('lumen'), {countryId: 'lumen', kind: 'port'});
    const country = svg.querySelector('.land[data-country="lumen"]');
    const grounding = country.querySelector('.map-site-grounding[data-country="lumen"]');
    const roads = grounding.querySelector('.map-settlement-roads');
    const cityClip = grounding.querySelector('.map-city-clip');
    const port = grounding.querySelector('.map-site-scene[data-site-scene="port"]');
    assert.equal(grounding.getAttribute('data-grounded'), 'true');
    assert.equal(cityClip.getAttribute('clip-path'), 'url(#atlas-clip-lumen)');
    assert.equal(port.getAttribute('clip-path'), null);
    assert.equal(grounding.children.indexOf(roads) < grounding.children.indexOf(cityClip), true);
    assert.equal(grounding.children.indexOf(roads) < grounding.children.indexOf(port), true);
    assert.equal(port.getAttribute('transform'), `translate(${GEOGRAPHY.lumen.port[0]} ${GEOGRAPHY.lumen.port[1]})`);
    assert.equal(port.getAttribute('data-selected'), 'true');
    assert.equal(port.getAttribute('data-level'), '0');
    assert.equal(country.children.indexOf(grounding) < country.children.indexOf(country.querySelector('.country-name')), true);
    assert.ok(country.children.indexOf(grounding)<country.children.indexOf(country.querySelector('.country-condition-wash')));
    assert.ok(country.children.indexOf(country.querySelector('.farm-landscape-clip'))<country.children.indexOf(country.querySelector('.country-condition-wash')));
    assert.deepEqual(
      roads.children.map((road) => [road.getAttribute('data-road-from'), road.getAttribute('data-road-to')]),
      [['town', 'farm'], ['town', 'port']],
    );
    for (const road of roads.children) {
      assert.equal(road.getAttribute('clip-path'), 'url(#atlas-clip-lumen)');
      const d = road.children[0].getAttribute('d');
      assert.match(d, /^M-10 -60Q.+/);
      const destination = road.getAttribute('data-road-to') === 'farm'
        ? MAP_SITE_POSITIONS.lumen.farm
        : MAP_SITE_POSITIONS.lumen.port;
      assert.match(d, new RegExp(`${destination.x - GEOGRAPHY.lumen.x} ${destination.y - GEOGRAPHY.lumen.y}$`));
    }
  } finally {
    globalThis.document = previous;
  }
});

test('Given the six real coasts When ports render Then shipward down faces outward', () => {
  const values=[...CONTINENT_PATH.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
  const points=Array.from({length:values.length/2},(_unused,index)=>[values[index*2],values[index*2+1]]);
  const segments=Array.from({length:(points.length-1)/3},(_unused,index)=>points.slice(index*3,index*3+4));
  const unit=([x,y])=>[x/Math.hypot(x,y),y/Math.hypot(x,y)];
  for(const [id,geo] of Object.entries(GEOGRAPHY)){
    const point=[geo.x+geo.port[0],geo.y+geo.port[1]],same=p=>p[0]===point[0]&&p[1]===point[1];
    const incoming=segments.find(segment=>same(segment[3])),outgoing=segments.find(segment=>same(segment[0]));
    assert.ok(incoming&&outgoing,`${id}: port must sit at a real coastal join`);
    const before=unit([point[0]-incoming[2][0],point[1]-incoming[2][1]]),after=unit([outgoing[1][0]-point[0],outgoing[1][1]-point[1]]);
    const [dx,dy]=unit([before[0]+after[0],before[1]+after[1]]),angle=PORT_ROTATIONS[id]*Math.PI/180;
    const alignment=(-Math.sin(angle))*dy+Math.cos(angle)*(-dx);
    assert.ok(alignment>.995,`${id}: warehouses must face land and ships the outward coastline normal`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, stat} from 'node:fs/promises';

import {MAP_SITE_ASSETS} from '../dist/map-art.mjs';
import {FARM_LANDSCAPE_ASSETS} from '../dist/farm-map.mjs';

const ACTIVE = Object.freeze([
  'terrain-relief-v35.webp',
  'map-city-v35.webp',
  'map-port-v34.webp',
  'farm-healthy-v35.webp',
  'farm-drought-v35.webp',
  'farm-recovering-v35.webp',
]);

const transparent = new Set(['map-port-v34.webp']);
const bytes = (file) => readFile(new URL(`../dist/${file}`, import.meta.url));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

function vp8xSize(buffer) {
  const offset = buffer.indexOf(Buffer.from('VP8X'));
  if (offset < 0) {
    const frame=buffer.indexOf(Buffer.from([0x9d,0x01,0x2a]));
    return frame<0?null:{width:buffer.readUInt16LE(frame+3)&0x3fff,height:buffer.readUInt16LE(frame+5)&0x3fff};
  }
  const start = offset + 12;
  const width = 1 + buffer[start] + (buffer[start + 1] << 8) + (buffer[start + 2] << 16);
  const height = 1 + buffer[start + 3] + (buffer[start + 4] << 8) + (buffer[start + 5] << 16);
  return {width, height};
}

test('V35 activates six grounded materials and cutouts and retires old live references', async () => {
  assert.deepEqual(MAP_SITE_ASSETS, {
    city: 'map-city-v35.webp', port: 'map-port-v34.webp', farm: 'farm-healthy-v35.webp',
  });
  assert.deepEqual(FARM_LANDSCAPE_ASSETS, {
    healthy: 'farm-healthy-v35.webp', drought: 'farm-drought-v35.webp',
    recovering: 'farm-recovering-v35.webp', expansion: 'farm-healthy-v35.webp',
  });
  const [atlas, mapArt, farms] = await Promise.all([
    readFile(new URL('../dist/atlas-art.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/map-art.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/farm-map.mjs', import.meta.url), 'utf8'),
  ]);
  const source = `${atlas}\n${mapArt}\n${farms}`;
  for (const file of ACTIVE) assert.match(source, new RegExp(file.replace('.', '\\.')));
  assert.doesNotMatch(source, /terrain-relief-v(?:22|34)|map-(?:city|port|farm)-v28|farm-(?:healthy|drought|recovering|expansion)-v(?:30|34)/);
});

test('V34 transparent sprites keep real alpha and enough resolution for phone zoom', async () => {
  for (const file of ACTIVE) {
    const buffer = await bytes(file);
    assert.equal(buffer.subarray(0, 4).toString(), 'RIFF', `${file} is WebP RIFF`);
    assert.equal(buffer.subarray(8, 12).toString(), 'WEBP', `${file} is WebP`);
    if (!transparent.has(file)) continue;
    assert.notEqual(buffer.indexOf(Buffer.from('ALPH')), -1, `${file} carries an alpha plane`);
    const size = vp8xSize(buffer);
    assert.ok(size && Math.min(size.width, size.height) >= 480, `${file} is large enough to inspect`);
  }
});

test('V34 climate variants preserve the master frame while remaining distinct', async () => {
  const files = ['farm-healthy-v35.webp', 'farm-drought-v35.webp', 'farm-recovering-v35.webp'];
  const buffers = await Promise.all(files.map(bytes));
  assert.deepEqual(buffers.map(vp8xSize), [
    {width: 768, height: 768}, {width: 768, height: 768}, {width: 768, height: 768},
  ]);
  assert.equal(new Set(buffers.map(hash)).size, files.length);
});

test('V34 active image payload stays proportionate to the map surface', async () => {
  const sizes = await Promise.all(ACTIVE.map(async (file) => (await stat(new URL(`../dist/${file}`, import.meta.url))).size));
  const total = sizes.reduce((sum, value) => sum + value, 0);
  assert.ok(total < 2_500_000, `active image payload is ${total} bytes`);
  assert.ok(Math.max(...sizes) < 800_000, 'no single map image dominates initial delivery');
});

test('V34 presentation avoids painted pedestal shadows around orthographic cutouts', async () => {
  const [mapCss, farmCss] = await Promise.all([
    readFile(new URL('../dist/map-sites.css', import.meta.url), 'utf8'),
    readFile(new URL('../dist/farm-map.css', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(mapCss, /map-site-raster[^}]*drop-shadow/s);
  assert.doesNotMatch(farmCss, /farm-landscape-base[\s\S]*?drop-shadow/);
});
